import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID, prepareBatch, createBatch } from "../scripts/generator.js";
import { STAT_KEYS, natureAdjusted, obeysBaseRelation } from "../scripts/rules.js";

// Contract doubles for Carbon 4.4.3's public generator and document API.
// They verify our integration; a licensed Foundry world is still needed for live QA.
const base = { hp: 4, atk: 5, def: 4, spatk: 6, spdef: 5, spd: 7 };
const natures = { Neutral: ["HP", "HP"] };
let created;
let resolved;
function setup() {
  created = [];
  resolved = new Map([
    ["move", { type: "move", name: "Scratch" }],
    ["ability", { type: "ability", name: "Blaze" }],
    ["capability", { type: "capability", name: "Firestarter" }]
  ]);
  const species = {
    name: "Charmander", type: "species", slug: "charmander", uuid: "Compendium.ptu.species.Item.charmander", img: "charmander.webp",
    system: { number: 4, stats: base, abilities: { basic: [{ slug: "blaze", uuid: "ability" }], advanced: [{ slug: "flame", uuid: "ability2" }], high: [{ slug: "power", uuid: "ability3" }] }, moves: { level: [{ slug: "scratch", uuid: "move", level: 1 }] }, capabilities: { other: [{ slug: "firestarter", uuid: "capability" }] }, evolutions: [] },
    clone() { const clone = { ...this, system: structuredClone(this.system) }; clone.toObject = () => ({ type: "species", name: clone.name, system: structuredClone(clone.system), flags: {} }); return clone; }
  };
  class Generator {
    constructor(copy) { this.species = copy; }
    async prepare(options) {
      assert.equal(options.preventEvolution, true);
      this.prepareStats(); this.prepareAbilities(); this.prepareMoves();
      this.capabilities = this.species.system.capabilities.other;
      if (!this.shiny) this.prepareShinyness(options.shinyChance);
      this.species.system.form = "isolated-form";
      this.gender = "Male";
      this.img = "art.webp";
    }
    async create({ generate, folder }) {
      assert.equal(generate, false); assert.equal(folder, null);
      const items = [this.species.toObject(), ...this.moves.map(m => ({ ...resolved.get(m.uuid) })), ...this.abilities.map(a => ({ ...resolved.get(a.data.uuid) })), ...this.capabilities.map(c => ({ ...resolved.get(c.uuid) }))];
      return { actor: { name: this.species.name, type: "pokemon", img: this.img, system: { nature: { value: this.nature }, stats: this.stats, level: { exp: this.level }, shiny: this.shiny }, prototypeToken: { texture: { src: this.img } } }, items };
    }
  }
  class Actor {
    constructor(data) { this.data = data; this.system = structuredClone(data.system); }
    prepareData() {
      const bases = natureAdjusted(base, this.system.nature.value, natures);
      for (const key of STAT_KEYS) this.system.stats[key].value = bases[key];
      this.system.levelUpPoints = this.system.level.exp + 10 - Object.values(this.system.stats).reduce((total, s) => total + s.levelUp, 0);
      this.system.health = { max: 10 + this.system.level.exp + 3 * (bases.hp + this.system.stats.hp.levelUp) };
    }
    static async createDocuments(data) { created.push(...data); return data; }
  }
  globalThis.game = { system: { id: "ptu", version: "4.4.3" }, user: { isGM: true }, ptu: { species: { generator: Generator } }, packs: new Map([["ptu.species", { documentName: "Item", async getDocuments() { return [species]; } }]]), folders: new Map() };
  globalThis.CONFIG = { PTU: { data: { natureData: natures } }, Actor: { documentClass: Actor } };
  globalThis.fromUuid = async uuid => resolved.get(uuid);
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  return species;
}

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
