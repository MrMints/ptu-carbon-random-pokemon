import assert from "node:assert/strict";
import { STAT_KEYS, natureAdjusted } from "../scripts/rules.js";
// Contract doubles for Carbon 4.4.3's public generator and document API.
// They verify our integration; a licensed Foundry world is still needed for live QA.
export const base = { hp: 4, atk: 5, def: 4, spatk: 6, spdef: 5, spd: 7 };
const natures = { Neutral: ["HP", "HP"] };
export let created;
export let resolved;
export function setup() {
  created = [];
  resolved = new Map([
    ["move", { type: "move", name: "Scratch" }],
    ["ability", { type: "ability", name: "Blaze" }],
    ["capability", { type: "capability", name: "Firestarter" }]
  ]);
  for (const [uuid, document] of resolved) document.uuid = uuid;
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
