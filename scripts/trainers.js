import { STAT_KEYS, integer, pick } from "./rules.js";
import { MODULE_ID, checkSystem } from "./generator.js";
import { TRAINER_ART, resolveTrainerPortrait } from "./trainer-art.js";

// First names of ordinary game opponents, reused with the selected generic class.
// Sources: https://bulbapedia.bulbagarden.net/wiki/Youngster_(Trainer_class)
// and https://bulbapedia.bulbagarden.net/wiki/Lass_(Trainer_class)
export const TRAINER_NAMES = Object.freeze({
  Male: Object.freeze(["Joey", "Mikey", "Ben", "Calvin", "Tristan", "Parker"]),
  Female: Object.freeze(["Janice", "Sally", "Robin", "Haley", "Suzette", "Tiana"])
});

export function validateTrainerOptions(input = {}) {
  const options = {
    ...input,
    mode: input.mode || "pokemon",
    amount: integer(input.amount ?? 1, "Amount", 1, 50),
    trainerMinLevel: integer(input.trainerMinLevel ?? 1, "Minimum trainer level", 1, 50),
    trainerMaxLevel: integer(input.trainerMaxLevel ?? 5, "Maximum trainer level", 1, 50),
    partySize: integer(input.partySize ?? 3, "Pokémon per trainer", 1, 6)
  };
  if (!["pokemon", "trainers", "party"].includes(options.mode)) throw new Error("Unknown generation mode.");
  if (options.trainerMinLevel > options.trainerMaxLevel) throw new Error("Minimum trainer level must not exceed maximum trainer level.");
  if (options.trainerArt && !TRAINER_ART.some(art => art.id === options.trainerArt)) throw new Error("Select a generic game trainer portrait.");
  if (options.folder && game.folders.get(options.folder)?.type !== "Actor") throw new Error("Select a valid Actor folder.");
  return options;
}

// Import Carbon's installed builder instead of copying its prerequisite logic.
async function loadBuilder() {
  const path = foundry.utils.getRoute("systems/ptu/src/module/apps/npc-quick-build/document.js");
  return (await import(path)).NpcQuickBuildData;
}

export async function prepareTrainer(input, { Builder } = {}) {
  checkSystem();
  const options = validateTrainerOptions(input);
  const art = options.trainerArt ? TRAINER_ART.find(a => a.id === options.trainerArt) : pick(TRAINER_ART);
  const portrait = await resolveTrainerPortrait(art);
  const level = options.trainerMinLevel + Math.floor(Math.random() * (options.trainerMaxLevel - options.trainerMinLevel + 1));
  const NativeBuilder = Builder ?? await loadBuilder();
  const builder = new NativeBuilder();
  await builder.preload();
  builder.trainer.level = level;
  builder.trainer.partySize = 0;
  builder.party = {};
  builder.trainer.sex = [{ value: art.sex, label: art.sex }];
  builder.trainer.name = pick(TRAINER_NAMES[art.sex]);
  builder.manuallyUpdatedFields.add("trainer.level");
  builder.manuallyUpdatedFields.add("trainer.sex");
  builder.manuallyUpdatedFields.add("trainer.name");
  await builder.randomizeAll();
  // The native randomizer samples with replacement. Keep a single acquisition
  // of each source and respect PTU's four-class limit before recalculating prerequisites.
  const unique = choices => choices.filter((choice, index) => choices.findIndex(other => other.uuid === choice.uuid) === index);
  builder.trainer.classes.selected = unique(builder.trainer.classes.selected).slice(0, 4);
  builder.trainer.features.selected = unique(builder.trainer.features.selected);
  builder.trainer.edges.selected = unique(builder.trainer.edges.selected);
  await builder.refresh();
  const problems = [...(builder.warnings?.unmet ?? []), ...(builder.warnings?.unknown ?? [])];
  if (problems.length) throw new Error(`Carbon could not validate this trainer's prerequisites: ${problems.join(" ")} Reroll the preview.`);
  const trainer = builder.trainer;
  const items = [];
  for (const item of [...trainer.features.computed, ...trainer.edges.computed]) {
    const source = await fromUuid(item.uuid);
    if (!source || !["feat", "edge"].includes(source.type)) throw new Error(`Missing trainer feature or edge: ${item.label ?? item.uuid}`);
    const data = source.toObject();
    delete data._id;
    data.flags ??= {};
    data.flags.core ??= {};
    data.flags.core.sourceId = item.uuid;
    const choices = (data.system?.rules ?? []).filter(rule => rule.key === "ChoiceSet");
    for (const [index, choice] of choices.entries()) {
      const key = `${item.label ?? item.name}-${index}`.replaceAll(".", "-");
      choice.selection = trainer.subSelectables[key]?.selected ?? null;
      if (choice.selection === null) throw new Error(`Trainer choice is unresolved: ${item.label ?? item.name}. Reroll the preview.`);
    }
    items.push(data);
  }
  const skills = Object.fromEntries(Object.entries(trainer.skills).map(([slug, skill]) => [slug, {
    slug, value: { value: skill.value, mod: 0 }, modifier: { value: 0, mod: 0 }
  }]));
  const data = {
    _id: foundry.utils.randomID(), name: `${art.label.replace(/ \((Female|Male)\)$/, "")} ${trainer.name}`, type: "character", img: portrait,
    folder: options.folder || null, items,
    system: { alliance: builder.alliance, sex: art.sex, level: { milestones: level - 1, miscexp: 0 }, skills,
      stats: Object.fromEntries(STAT_KEYS.map(key => [key, { levelUp: 0 }])), health: { value: 0 }, ap: { value: 0 } },
    prototypeToken: { name: `${art.label.replace(/ \((Female|Male)\)$/, "")} ${trainer.name}`, actorLink: true, width: 1, height: 1,
      texture: { src: portrait }, disposition: builder.alliance === "opposition" ? -1 : 0 },
    flags: { [MODULE_ID]: { generated: true, version: "0.2.1", level, art: art.id, artSource: art.source } }
  };
  // Carbon's actor preparation includes the world's advancement variant and item rules.
  const temporary = new CONFIG.Actor.documentClass(data);
  temporary.prepareData();
  if (temporary.system.level.current !== level) throw new Error(`This world's advancement variant does not support trainer level ${level}. Choose a supported level.`);
  const budget = integer(temporary.system.levelUpPoints, "Trainer stat budget", 0, 1000);
  for (let point = 0; point < budget; point++) data.system.stats[pick(STAT_KEYS)].levelUp++;
  const complete = new CONFIG.Actor.documentClass(data);
  complete.prepareData();
  data.system.health.value = complete.system.health.max;
  data.system.ap.value = complete.system.ap.max;
  const warnings = [...(builder.warnings?.unmet ?? []), ...(builder.warnings?.unknown ?? [])];
  return { data, summary: { trainer: true, name: data.name, img: portrait, token: portrait, level,
    gender: art.sex, hp: complete.system.health.max, artSource: art.source,
    features: items.filter(i => i.type === "feat").map(i => i.name).join(", "),
    edges: items.filter(i => i.type === "edge").map(i => i.name).join(", "), warnings: warnings.join(" "),
    stats: STAT_KEYS.map(key => `${key.toUpperCase()}: ${complete.system.stats[key].total}`).join(" · ") } };
}
