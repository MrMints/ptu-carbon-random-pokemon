import test from "node:test";
import assert from "node:assert/strict";
import { STAT_KEYS, STAT_NAMES, integer, natureAdjusted, allocateStats, obeysBaseRelation, chooseAbilities, chooseMoves, minimumSpeciesLevel, matchesSpecies } from "../scripts/rules.js";
import { validateOptions } from "../scripts/generator.js";

function seeded(seed) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
const base = { hp: 4, atk: 5, def: 4, spatk: 6, spdef: 5, spd: 7 };
const natures = { Neutral: ["HP", "HP"], Modest: ["Special Attack", "Attack"], Cuddly: ["HP", "Attack"] };

test("natures adjust HP by one, other stats by two, cancel neutral pairs and clamp at one", () => {
  assert.deepEqual(natureAdjusted(base, "Neutral", natures), base);
  assert.equal(natureAdjusted(base, "Modest", natures).spatk, 8);
  assert.equal(natureAdjusted(base, "Modest", natures).atk, 3);
  assert.equal(natureAdjusted(base, "Cuddly", natures).hp, 5);
  assert.equal(natureAdjusted({ ...base, atk: 1 }, "Modest", natures).atk, 1);
  assert.throws(() => natureAdjusted(base, "missing", natures));
});

test("all 36 nature pairs, levels 1–100, and five distributions obey BSR and spend the whole budget", () => {
  const rng = seeded(105);
  for (const up of Object.values(STAT_NAMES)) for (const down of Object.values(STAT_NAMES)) {
    const adjusted = natureAdjusted(base, "Test", { Test: [up, down] });
    for (let level = 1; level <= 100; level++) for (const style of ["balanced", "random", "physical", "special", "defensive"]) {
      const points = allocateStats(adjusted, level + 10, style, rng);
      assert.equal(Object.values(points).reduce((a, b) => a + b), level + 10);
      assert.ok(Object.values(points).every(value => Number.isInteger(value) && value >= 0));
      assert.ok(obeysBaseRelation(adjusted, points));
    }
  }
});

test("random species stat spreads preserve strict ordering", () => {
  const rng = seeded(408);
  for (let sample = 0; sample < 500; sample++) {
    const spread = Object.fromEntries(STAT_KEYS.map(key => [key, 1 + Math.floor(rng() * 40)]));
    assert.ok(obeysBaseRelation(spread, allocateStats(spread, 110, "random", rng)));
  }
});

test("ties can diverge; unequal bases cannot end in a tie", () => {
  const tied = Object.fromEntries(STAT_KEYS.map(key => [key, 5]));
  const points = allocateStats(tied, 11, "random", () => 0);
  assert.equal(points.hp, 11);
  assert.ok(obeysBaseRelation(tied, points));
  assert.equal(obeysBaseRelation(base, { hp: 3, atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0 }), false);
});

const ability = slug => ({ slug, uuid: `Compendium.ptu.abilities.Item.${slug}` });
const abilities = { basic: [ability("one"), ability("two")], advanced: [ability("three")], high: [ability("four")] };
test("abilities unlock at 20 and 40, use cumulative pools, and never repeat", () => {
  for (const level of [1, 19, 20, 39, 40, 100]) {
    const selected = chooseAbilities(abilities, level, () => 0);
    assert.equal(selected.length, level >= 40 ? 3 : level >= 20 ? 2 : 1);
    assert.equal(new Set(selected.map(entry => entry.data.slug)).size, selected.length);
    assert.equal(selected[0].tier, "basic");
  }
  assert.equal(chooseAbilities(abilities, 20, () => 0)[1].data.slug, "two");
  assert.equal(chooseAbilities(abilities, 20, () => 0)[1].tier, "advanced");
  assert.equal(chooseAbilities(abilities, 40, () => 0.999)[2].data.slug, "four");
  assert.throws(() => chooseAbilities({ basic: [ability("one")] }, 40));
});

test("moves exclude future levels, deduplicate, and limit even many Evo moves to six", () => {
  const moves = Array.from({ length: 10 }, (_, n) => ({ slug: `m${n}`, uuid: `u${n}`, level: n + 1 }));
  assert.equal(chooseMoves(moves, 3).length, 3);
  assert.deepEqual(chooseMoves(moves, 10).map(m => m.level), [10, 9, 8, 7, 6, 5]);
  assert.equal(chooseMoves([...moves, moves[0]], 1).length, 1);
  assert.equal(chooseMoves(moves.map(m => ({ ...m, level: "Evo" })), 1).length, 6);
  assert.equal(chooseMoves(moves, 10, "random", seeded(1)).length, 6);
});

test("species filters and minimum evolution level use Carbon's schema", () => {
  const species = { name: "Charizard", slug: "charizard", uuid: "species-zard", type: "species", system: {
    number: 6, types: ["Fire", "Flying"], habitats: ["Mountain"], evolutions: [{ slug: "charmander", level: 1 }, { slug: "charizard", level: 36 }]
  } };
  assert.equal(minimumSpeciesLevel(species), 36);
  assert.ok(matchesSpecies(species, { search: "pikachu, 6", type: "fire", habitat: "mountain" }));
  assert.equal(matchesSpecies(species, { type: "Water" }), false);
  assert.equal(matchesSpecies({ ...species, system: { ...species.system, form: "mega-x" } }), false);
  assert.equal(matchesSpecies({ ...species, system: { ...species.system, form: "mega-x" } }, { includeForms: true }), false);
  assert.ok(matchesSpecies({ ...species, system: { ...species.system, form: "mega-x" } }, { megaOnly: true }));
});

test("invalid inputs fail before actor creation", () => {
  globalThis.CONFIG = { PTU: { data: { natureData: natures } } };
  globalThis.game = { folders: new Map([["good", { type: "Actor" }], ["bad", { type: "Item" }]]) };
  assert.throws(() => integer("", "level", 1, 100));
  for (const options of [ { amount: 0 }, { amount: 51 }, { minLevel: 0 }, { maxLevel: 101 }, { minLevel: 20, maxLevel: 1 }, { shinyChance: NaN }, { shinyChance: -1 }, { shinyChance: 101 }, { folder: "bad" }, { statStyle: "bad" }, { nature: "bad" } ]) assert.throws(() => validateOptions(options));
  assert.equal(validateOptions({ minLevel: "100", maxLevel: "100", shinyChance: 0, folder: "good" }).minLevel, 100);
});
