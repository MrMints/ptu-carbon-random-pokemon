import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID, prepareBatch, createBatch, speciesCompendiums, validateOptions } from "../scripts/generator.js";
import { STAT_KEYS, natureAdjusted, obeysBaseRelation } from "../scripts/rules.js";

import { setup, created, resolved, base } from "./carbon-fixture.js";

test("preview is read-only, uses copies, preserves source UUIDs, and creation saves exact preview", async () => {
  const species = setup();
  const batch = await prepareBatch({ minLevel: 5, maxLevel: 5, shinyChance: 100, amount: 3 });
  assert.equal(created.length, 0);
  assert.equal(species.system.form, undefined);
  for (const entry of batch) {
    const points = Object.fromEntries(STAT_KEYS.map(key => [key, entry.data.system.stats[key].levelUp]));
    assert.ok(obeysBaseRelation(base, points));
    assert.equal(Object.values(points).reduce((a, b) => a + b), 15);
    assert.equal(entry.summary.shiny, true);
    assert.equal(entry.data.items.find(i => i.type === "species").flags.core.sourceId, species.uuid);
    assert.equal(entry.data.flags[MODULE_ID].level, 5);
    assert.equal(entry.data.system.health.value, entry.summary.hp);
  }
  await createBatch(batch);
  assert.equal(created.length, 3);
  assert.deepEqual(created, batch.map(entry => entry.data));
});

test("zero percent shiny remains false", async () => {
  setup();
  const batch = await prepareBatch({ shinyChance: 0 });
  assert.equal(batch[0].summary.shiny, false);
});

test("Legendary and Mythical species require opt-in and still obey other filters", async () => {
  const normal = setup();
  const legendary = { ...normal, name: "Articuno", system: { ...normal.system, number: 144 } };
  const mythical = { ...normal, name: "Mew", system: { ...normal.system, number: "151" } };
  game.packs.get("ptu.species").getDocuments = async () => [legendary, mythical, normal];
  const ordinary = await prepareBatch({ amount: 20, includeForms: true });
  assert.ok(ordinary.every(entry => entry.data.name === "Charmander"));
  for (const search of ["Articuno", "Mew"]) {
    await assert.rejects(prepareBatch({ search }), /No species/);
    const enabled = await prepareBatch({ search, includeLegendary: true });
    assert.equal(enabled[0].data.name, search);
  }
  await assert.rejects(prepareBatch({ search: "Articuno", includeLegendary: true, type: "Water" }), /No species/);
  assert.equal(created.length, 0);
});

test("pool choices only contain compendiums with species and shiny defaults to 0.01 percent", async () => {
  setup();
  const packs = [
    { documentName: "Item", collection: "species", getIndex: async () => [{ type: "species" }] },
    { documentName: "Item", collection: "moves", getIndex: async () => [{ type: "move" }] },
    { documentName: "Actor", collection: "actors" }
  ];
  game.packs = packs;
  assert.deepEqual((await speciesCompendiums()).map(pack => pack.collection), ["species"]);
  assert.equal(validateOptions().shinyChance, 0.01);
});

test("missing references fail without silently omitting moves or creating actors", async () => {
  setup(); resolved.delete("move");
  await assert.rejects(prepareBatch(), /Missing move reference/);
  assert.equal(created.length, 0);
});

test("GM and compatibility checks reject unsupported systems", async () => {
  setup(); game.user.isGM = false;
  await assert.rejects(prepareBatch(), /Only a GM/);
  setup(); game.system.version = "4.4.2";
  await assert.rejects(prepareBatch(), /requires Pokémon Carbon/);
});

test("no eligible species, invalid folders, and empty creation are rejected", async () => {
  setup();
  await assert.rejects(prepareBatch({ search: "nonexistent" }), /No species/);
  await assert.rejects(prepareBatch({ folder: "unknown" }), /valid Actor folder/);
  await assert.rejects(createBatch([]), /Preview a batch/);
});
