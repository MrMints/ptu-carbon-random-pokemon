import { STAT_KEYS, integer, pick, natureAdjusted, allocateStats, chooseAbilities, chooseMoves, matchesSpecies, minimumSpeciesLevel } from "./rules.js";

export const MODULE_ID = "ptu-carbon-random-pokemon";

export function checkSystem() {
  if (game.system.id !== "ptu" || game.system.version !== "4.4.3" || !game.ptu?.species?.generator) {
    throw new Error("This release requires Pokémon Carbon 4.4.3 (system ID ptu) on Foundry VTT 13. Other PTU forks have not been validated.");
  }
  if (!game.user.isGM) throw new Error("Only a GM can generate Pokémon.");
}

export function validateOptions(input = {}) {
  const options = {
    ...input,
    amount: integer(input.amount ?? 1, "Amount", 1, 50),
    minLevel: integer(input.minLevel ?? 5, "Minimum level", 1, 100),
    maxLevel: integer(input.maxLevel ?? 10, "Maximum level", 1, 100),
    shinyChance: Number(input.shinyChance ?? 0.01),
    statStyle: input.statStyle ?? "balanced",
    moveStyle: input.moveStyle ?? "latest",
    folder: input.folder ?? ""
  };
  if (options.minLevel > options.maxLevel) throw new Error("Minimum level must not exceed maximum level.");
  if (!Number.isFinite(options.shinyChance) || options.shinyChance < 0 || options.shinyChance > 100) throw new Error("Shiny chance must be from 0 to 100 percent.");
  if (!["balanced", "random", "physical", "special", "defensive"].includes(options.statStyle)) throw new Error("Unknown stat style.");
  if (!["latest", "random"].includes(options.moveStyle)) throw new Error("Unknown move style.");
  if (options.nature && !CONFIG.PTU.data.natureData[options.nature]) throw new Error("Unknown nature.");
  if (options.folder && game.folders.get(options.folder)?.type !== "Actor") throw new Error("Select a valid Actor folder.");
  return options;
}

export async function loadSpecies(packId = "ptu.species") {
  checkSystem();
  const pack = game.packs.get(packId);
  if (!pack || pack.documentName !== "Item") throw new Error("Select an Item compendium containing species.");
  return (await pack.getDocuments()).filter(item => item.type === "species");
}

export async function speciesCompendiums() {
  const packs = game.packs.filter(pack => pack.documentName === "Item");
  const eligible = await Promise.all(packs.map(async pack => {
    const index = await pack.getIndex({ fields: ["type"] });
    return [...index].some(item => item.type === "species") ? pack : null;
  }));
  return eligible.filter(Boolean);
}

async function checkReferences(generator) {
  const references = [
    ...generator.moves.map(data => ({ data, type: "move" })),
    ...generator.abilities.map(({ data }) => ({ data, type: "ability" })),
    ...generator.capabilities.map(data => ({ data, type: "capability" }))
  ];
  for (const { data, type } of references) {
    const document = data.uuid ? await fromUuid(data.uuid) : null;
    if (!document || document.type !== type) throw new Error(`Missing ${type} reference: ${data.slug ?? data.uuid ?? "unnamed"}. Repair this species in its compendium before generating it.`);
  }
}

export async function prepareBatch(input = {}, { megaOnly = false } = {}) {
  checkSystem();
  const options = validateOptions(input);
  const species = (await loadSpecies(options.pack)).filter(entry => matchesSpecies(entry, { ...options, megaOnly }));
  if (!species.length) throw new Error(megaOnly ? "No Mega species match these filters. Choose a species compendium with Mega forms or broaden the filters." : "No species match these filters. Try a broader search or include forms.");
  // Draw a level uniformly from levels that have eligible species, then a species uniformly.
  const levels = [];
  for (let level = options.minLevel; level <= options.maxLevel; level++) {
    const pool = species.filter(entry => minimumSpeciesLevel(entry) <= level);
    if (pool.length) levels.push({ level, pool });
  }
  if (!levels.length) throw new Error("No matching species meet the selected level range. Raise the level or change species.");
  const batch = [];
  for (let i = 0; i < options.amount; i++) {
    const { level, pool } = pick(levels);
    const source = pick(pool);
    // Carbon's form generator mutates its species. Give it an isolated document.
    const copy = source.clone({}, { keepId: true });
    const generator = new game.ptu.species.generator(copy);
    generator.level = level;
    generator.nature = options.nature || pick(Object.keys(CONFIG.PTU.data.natureData));
    if (copy.system.form) generator.form = copy.system.form;
    generator.shiny = Math.random() * 100 < options.shinyChance;
    // Override only this instance; never modify Carbon's prototypes or settings.
    generator.prepareShinyness = () => generator.shiny;
    generator.prepareStats = () => {
      generator.stats = Object.fromEntries(STAT_KEYS.map(key => [key, { base: copy.system.stats[key], levelUp: 0 }]));
      return generator.stats;
    };
    generator.prepareAbilities = () => generator.abilities = chooseAbilities(copy.system.abilities, level);
    generator.prepareMoves = () => generator.moves = chooseMoves(copy.system.moves.level, level, options.moveStyle);
    await generator.prepare({ minLevel: level, maxLevel: level, shinyChance: 0, statRandomness: 0, preventEvolution: true, saveDefault: false });
    await checkReferences(generator);
    const { actor, items } = await generator.create({ generate: false, folder: null });
    const speciesItem = items.find(item => item.type === "species");
    speciesItem.flags ??= {};
    speciesItem.flags.core ??= {};
    speciesItem.flags.core.sourceId = source.uuid;
    // Let Carbon prepare static ability rules before allocating points.
    const temporary = new CONFIG.Actor.documentClass({ ...actor, items });
    temporary.prepareData();
    const fallback = natureAdjusted(copy.system.stats, generator.nature, CONFIG.PTU.data.natureData);
    const bases = Object.fromEntries(STAT_KEYS.map(key => [key, temporary.system.stats[key]?.value ?? fallback[key]]));
    const budget = temporary.system.levelUpPoints ?? level + 10;
    const points = allocateStats(bases, budget, options.statStyle);
    for (const key of STAT_KEYS) actor.system.stats[key].levelUp = points[key];
    // Set full HP after Carbon has prepared abilities, species special cases, and points.
    const complete = new CONFIG.Actor.documentClass({ ...actor, items });
    complete.prepareData();
    actor.system.health = { value: complete.system.health.max };
    actor.folder = options.folder || null;
    actor.items = items;
    actor.flags ??= {};
    actor.flags[MODULE_ID] = { generated: true, version: "0.2.2", source: source.uuid, level, statStyle: options.statStyle };
    // Missing art should use the species icon rather than produce a broken texture.
    actor.img ||= source.img || "icons/svg/mystery-man.svg";
    actor.prototypeToken.texture ??= {};
    actor.prototypeToken.texture.src ||= actor.img;
    batch.push({
      data: actor,
      summary: { name: actor.name, img: actor.img, level, nature: generator.nature, gender: generator.gender,
        shiny: generator.shiny, form: actor.system.form || "", hp: complete.system.health.max,
        moves: items.filter(item => item.type === "move").map(item => item.name).join(", "),
        abilities: items.filter(item => item.type === "ability").map(item => item.name).join(", "),
        stats: STAT_KEYS.map(key => `${key.toUpperCase()}: ${bases[key] + points[key]}`).join(" · ") }
    });
  }
  return batch;
}

export async function createBatch(batch) {
  checkSystem();
  if (!Array.isArray(batch) || !batch.length || batch.length > 350) throw new Error("Preview a batch of 1–350 actors first.");
  // A single creation call embeds all items at actor creation, avoiding half-built actors.
  const data = batch.map(entry => foundry.utils.deepClone(entry.data));
  return CONFIG.Actor.documentClass.createDocuments(data, { keepId: data.some(actor => actor._id) });
}
