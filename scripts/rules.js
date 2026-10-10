/** Pure PTU 1.05 generation rules. No Foundry globals. */
export const STAT_KEYS = ["hp", "atk", "def", "spatk", "spdef", "spd"];
export const STAT_NAMES = { hp: "HP", atk: "Attack", def: "Defense", spatk: "Special Attack", spdef: "Special Defense", spd: "Speed" };

export function integer(value, label, min, max) {
  const number = Number(value);
  if (value === "" || value === null || !Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return number;
}

export function pick(values, rng = Math.random) {
  if (!values.length) throw new Error("No eligible choices remain.");
  return values[Math.floor(rng() * values.length)];
}

export function shuffle(values, rng = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function natureAdjusted(base, nature, natures) {
  const pair = natures[nature];
  if (!pair) throw new Error(`Unknown nature: ${nature}.`);
  return Object.fromEntries(STAT_KEYS.map(key => {
    const value = integer(base[key], `${STAT_NAMES[key]} base stat`, 1, 999);
    const amount = key === "hp" ? 1 : 2;
    return [key, Math.max(1, value + (pair[0] === STAT_NAMES[key] ? amount : 0) - (pair[1] === STAT_NAMES[key] ? amount : 0))];
  }));
}

export function obeysBaseRelation(base, points) {
  return STAT_KEYS.every(high => STAT_KEYS.every(low =>
    base[high] <= base[low] || base[high] + points[high] > base[low] + points[low]
  ));
}

/** Strict ordering for unequal bases; tied bases can diverge. */
export function allocateStats(base, budget, style = "balanced", rng = Math.random) {
  integer(budget, "Stat point budget", 0, 1000);
  for (const key of STAT_KEYS) integer(base[key], `${STAT_NAMES[key]} base stat`, 1, 999);
  if (!["balanced", "random", "physical", "special", "defensive"].includes(style)) throw new Error("Unknown stat style.");
  const points = Object.fromEntries(STAT_KEYS.map(key => [key, 0]));
  for (let n = 0; n < budget; n++) {
    const legal = STAT_KEYS.filter(key => {
      points[key]++;
      const allowed = obeysBaseRelation(base, points);
      points[key]--;
      return allowed;
    });
    let choices = legal;
    if (style === "balanced") {
      const minimum = Math.min(...legal.map(key => points[key]));
      choices = legal.filter(key => points[key] === minimum);
    } else if (style !== "random") {
      const favored = { physical: ["atk", "spd"], special: ["spatk", "spd"], defensive: ["hp", "def", "spdef"] }[style];
      choices = legal.flatMap(key => Array(favored.includes(key) ? 4 : 1).fill(key));
    }
    points[pick(choices, rng)]++;
  }
  return points;
}

function referenceKey(entry) { return entry.slug || entry.uuid; }
function unique(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    const key = referenceKey(entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chooseAbilities(abilities, level, rng = Math.random) {
  integer(level, "Level", 1, 100);
  const selected = [];
  for (const tiers of [ ["basic"], ...(level >= 20 ? [["basic", "advanced"]] : []), ...(level >= 40 ? [["basic", "advanced", "high"]] : []) ]) {
    const pool = unique(tiers.flatMap(tier => (abilities[tier] ?? []).map(data => ({ ...data, tier }))));
    const available = pool.filter(data => !selected.some(entry => referenceKey(entry.data) === referenceKey(data)));
    const data = pick(available, rng);
    // Carbon's flags identify acquisition slots (1/20/40), not the source pool.
    selected.push({ tier: ["basic", "advanced", "high"][selected.length], data });
  }
  return selected;
}

export function chooseMoves(moves, level, style = "latest", rng = Math.random) {
  integer(level, "Level", 1, 100);
  if (!["latest", "random"].includes(style)) throw new Error("Unknown move style.");
  const eligible = unique([...moves].filter(move =>
    move.level === "Evo" || (Number.isFinite(Number(move.level)) && Number(move.level) <= level)
  ).sort((a, b) => (b.level === "Evo" ? 101 : Number(b.level)) - (a.level === "Evo" ? 101 : Number(a.level))));
  return (style === "random" ? shuffle(eligible, rng) : eligible).slice(0, 6);
}

export function minimumSpeciesLevel(species) {
  const own = (species.system.evolutions ?? []).filter(stage => stage.slug === species.slug || stage.uuid === species.uuid);
  const levels = own.map(stage => Number(stage.level)).filter(Number.isFinite);
  return levels.length ? Math.max(1, Math.min(...levels)) : 1;
}

export function isMegaSpecies(species) {
  return [species.name, species.slug, species.system?.form].some(value => /(?:^|[\s_-])mega(?:$|[\s_-])/i.test(value ?? ""));
}

export function matchesSpecies(species, { search = "", type = "", habitat = "", includeForms = false, megaOnly = false } = {}) {
  if (species.type !== "species") return false;
  if (isMegaSpecies(species) !== megaOnly) return false;
  if (!megaOnly && !includeForms && species.system.form) return false;
  const terms = search.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (terms.length && !terms.some(term => species.name.toLowerCase().includes(term) || String(species.system.number) === term)) return false;
  if (type && !(species.system.types ?? []).some(t => t.toLowerCase() === type.toLowerCase())) return false;
  if (habitat && !(species.system.habitats ?? []).some(h => h.toLowerCase() === habitat.toLowerCase())) return false;
  return true;
}
