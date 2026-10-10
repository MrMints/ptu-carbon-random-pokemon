import test from "node:test";
import assert from "node:assert/strict";
import { setup, created } from "./carbon-fixture.js";
import { prepareTrainer, validateTrainerOptions, TRAINER_NAMES } from "../scripts/trainers.js";
import { prepareEncounter, createEncounter } from "../scripts/encounters.js";
import { TRAINER_ART, resolveTrainerPortrait } from "../scripts/trainer-art.js";
import { STAT_KEYS } from "../scripts/rules.js";
import { readFileSync } from "node:fs";

class Builder {
  constructor() {
    this.trainer = { classes: { selected: [] }, features: { computed: [], selected: [] }, edges: { computed: [], selected: [] }, skills: { command: { value: 3 } }, subSelectables: {} };
    this.manuallyUpdatedFields = new Set(); this.alliance = "opposition";
  }
  async preload() {}
  async refresh() {}
  async randomizeAll() {
    assert.ok(this.manuallyUpdatedFields.has("trainer.level"));
    assert.ok(this.manuallyUpdatedFields.has("trainer.sex"));
    assert.equal(this.trainer.partySize, 0);
    assert.ok(this.manuallyUpdatedFields.has("trainer.name"));
  }
}

function environment() {
  setup();
  let id = 0;
  foundry.utils.randomID = () => `random${String(++id).padStart(10, "0")}`;
  globalThis.Folder = { async create(data) { const folder = { ...data, id: foundry.utils.randomID() }; game.folders.set(folder.id, folder); return folder; } };
  const PokemonActor = CONFIG.Actor.documentClass;
  CONFIG.Actor.documentClass = class extends PokemonActor {
    prepareData() {
      if (this.data.type === "pokemon") return super.prepareData();
      this.system.level.current = this.system.level.milestones + 1;
      this.system.levelUpPoints = this.system.level.current + 9 - Object.values(this.system.stats).reduce((total, stat) => total + stat.levelUp, 0);
      for (const key of STAT_KEYS) this.system.stats[key].total = (key === "hp" ? 10 : 5) + this.system.stats[key].levelUp;
      this.system.health = { max: 10 + this.system.level.current * 2 + this.system.stats.hp.total * 3 };
      this.system.ap = { max: 5 + Math.floor(this.system.level.current / 5) };
    }
  };
}

test("trainer levels, full health/AP, Carbon stat budget, generic portrait and matching token", async () => {
  for (const level of [1, 5, 25, 50]) {
    environment();
    const result = await prepareTrainer({ mode: "trainers", trainerMinLevel: level, trainerMaxLevel: level, trainerArt: "ace-f" }, { Builder });
    assert.equal(created.length, 0);
    assert.equal(result.data.type, "character");
    assert.equal(result.data.system.level.milestones, level - 1);
    assert.equal(Object.values(result.data.system.stats).reduce((sum, stat) => sum + stat.levelUp, 0), level + 9);
    assert.equal(result.data.system.health.value, result.summary.hp);
    assert.equal(result.data.system.ap.value, 5 + Math.floor(level / 5));
    assert.equal(result.data.img, result.data.prototypeToken.texture.src);
    assert.equal(result.data.prototypeToken.actorLink, true);
    assert.ok(TRAINER_NAMES.Female.some(name => result.data.name === `Ace Trainer ${name}`));
    assert.equal(result.data.prototypeToken.name, result.data.name);
  }
});

test("all three modes produce the requested counts and parties link each Pokémon to the correct trainer", async () => {
  for (const mode of ["pokemon", "trainers", "party"]) {
    environment();
    const batch = await prepareEncounter({ mode, amount: 2, partySize: 3, minLevel: 5, maxLevel: 5 }, { Builder });
    assert.equal(batch.length, mode === "party" ? 8 : 2);
    if (mode === "party") {
      for (const start of [0, 4]) {
        const trainer = batch[start].data;
        for (const entry of batch.slice(start + 1, start + 4)) {
          assert.equal(entry.data.flags.ptu.party.trainer, trainer._id);
          assert.equal(entry.data.flags.ptu.party.boxed, false);
          assert.equal(entry.data.system.alliance, trainer.system.alliance);
        }
      }
    }
    await createEncounter(batch);
    const root = [...game.folders.values()].find(folder => folder.name === "Random Encounter Gen");
    assert.ok(root);
    if (mode === "pokemon") assert.ok(created.every(actor => actor.folder === root.id));
    else for (const actor of created.filter(actor => actor.type === "character")) assert.equal(game.folders.get(actor.folder).folder, root.id);
    assert.deepEqual(created.map(actor => ({ ...actor, folder: null })), batch.map(entry => ({ ...entry.data, folder: null })));
    if (mode === "party") {
      assert.ok(created[0].folder);
      assert.notEqual(created[0].folder, created[1].folder);
      assert.equal(created[1].folder, created[2].folder);
      assert.notEqual(created[1].folder, created[5].folder);
    }
  }
});

test("invalid trainer levels, party sizes, modes and non-curated artwork fail", () => {
  environment();
  for (const input of [{ trainerMinLevel: 0 }, { trainerMaxLevel: 51 }, { trainerMinLevel: 10, trainerMaxLevel: 5 }, { partySize: 7 }, { mode: "other" }, { trainerArt: "Ash" }]) {
    assert.throws(() => validateTrainerOptions(input));
  }
});

test("Mega checkbox includes exactly one Mega per trainer and ordinary rolls never include Megas", async () => {
  environment();
  const normal = (await game.packs.get("ptu.species").getDocuments())[0];
  const mega = { ...normal, name: "Charmander-Mega", slug: "charmander-mega", uuid: "mega-source", system: { ...normal.system, form: "mega" } };
  game.packs.get("ptu.species").getDocuments = async () => [mega, normal, { type: "move", name: "Mega Punch" }];
  for (const trainerHasMega of [false, true]) {
    for (const partySize of [1, 3, 6]) {
      const batch = await prepareEncounter({ mode: "party", amount: 2, partySize, trainerHasMega, includeForms: true, minLevel: 5, maxLevel: 5 }, { Builder });
      assert.equal(batch.length, 2 * (partySize + 1));
      for (const trainer of batch.filter(entry => entry.data.type === "character")) {
        const party = batch.filter(entry => entry.data.flags?.ptu?.party?.trainer === trainer.data._id);
        assert.equal(party.filter(entry => entry.data.name.includes("Mega")).length, trainerHasMega ? 1 : 0);
      }
    }
  }
  const wild = await prepareEncounter({ mode: "pokemon", amount: 20, includeForms: true, trainerHasMega: true });
  assert.ok(wild.every(entry => !entry.data.name.includes("Mega")));
  game.packs.get("ptu.species").getDocuments = async () => [normal];
  await assert.rejects(prepareEncounter({ mode: "party", trainerHasMega: true }, { Builder }), /No Mega species/);
  assert.equal(created.length, 0);
});

test("creation reuses the Random Encounter Gen root folder", async () => {
  environment();
  const batch = await prepareEncounter({ mode: "pokemon" });
  await createEncounter(batch);
  await createEncounter(batch);
  assert.equal([...game.folders.values()].filter(folder => folder.name === "Random Encounter Gen").length, 1);
  assert.equal(created[0].folder, created[1].folder);
});

test("trainer parties apply Legendary/Mythical opt-in to ordinary and Mega members", async () => {
  environment();
  const normal = (await game.packs.get("ptu.species").getDocuments())[0];
  const rare = { ...normal, name: "Mew", system: { ...normal.system, number: 151 } };
  const mega = { ...normal, name: "Mewtwo-Mega-X", system: { ...normal.system, number: 150, form: "mega-x" } };
  game.packs.get("ptu.species").getDocuments = async () => [rare, mega, normal];
  const ordinary = await prepareEncounter({ mode: "party", partySize: 3 }, { Builder });
  assert.ok(ordinary.slice(1).every(entry => entry.data.name === "Charmander"));
  const mythical = await prepareEncounter({ mode: "party", search: "Mew", includeLegendary: true }, { Builder });
  assert.ok(mythical.slice(1).every(entry => entry.data.name === "Mew"));
  await assert.rejects(prepareEncounter({ mode: "party", partySize: 1, trainerHasMega: true }, { Builder }), /No Mega species/);
  const enabled = await prepareEncounter({ mode: "party", partySize: 1, trainerHasMega: true, includeLegendary: true }, { Builder });
  assert.equal(enabled[1].data.name, "Mewtwo-Mega-X");
});

test("curated generic game artwork files are real PNGs with matching source attribution", () => {
  for (const art of TRAINER_ART) {
    const file = readFileSync(new URL(`../assets/trainers/${art.file}`, import.meta.url));
    assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(file.readUInt32BE(16) > 100);
    assert.ok(file.readUInt32BE(20) > 200);
    assert.ok(art.source.endsWith(art.file));
    assert.equal(art.game, "Pokémon Omega Ruby and Alpha Sapphire");
  }
});

test("configured Forge file picker resolves hosted artwork URLs for portraits and tokens", async () => {
  environment();
  const art = TRAINER_ART[0];
  const hosted = `https://assets.forge-vtt.com/example/modules/ptu-carbon-random-pokemon/assets/trainers/${art.file}`;
  foundry.applications = { apps: { FilePicker: { implementation: { async browse(source, directory) {
    assert.equal(source, "data");
    assert.equal(directory, "modules/ptu-carbon-random-pokemon/assets/trainers");
    return { files: [hosted] };
  } } } } };
  const trainer = await prepareTrainer({ trainerArt: art.id }, { Builder });
  assert.equal(trainer.data.img, hosted);
  assert.equal(trainer.data.prototypeToken.texture.src, hosted);
  foundry.applications.apps.FilePicker.implementation.browse = async () => ({ files: [] });
  await assert.rejects(resolveTrainerPortrait(art), /artwork is missing/);
});

test("unknown and unmet native prerequisites stop trainer creation", async () => {
  environment();
  class InvalidBuilder extends Builder {
    async refresh() { this.warnings = { unknown: ["Unknown prerequisite"], unmet: [] }; }
  }
  await assert.rejects(prepareTrainer({}, { Builder: InvalidBuilder }), /could not validate/);
  assert.equal(created.length, 0);
});

test("token creation uses actor token documents, positions them on the scene, and fails before actors if no scene is open", async () => {
  environment();
  globalThis.canvas = { ready: false };
  await assert.rejects(createEncounter([{ data: {} }], { placeTokens: true }), /Open a scene/);
  assert.equal(created.length, 0);
  const placed = [];
  CONFIG.Actor.documentClass.createDocuments = async data => data.map(actor => ({ async getTokenDocument(position) { return { toObject: () => ({ actorId: actor._id, ...position, texture: actor.prototypeToken.texture }) }; } }));
  canvas = { ready: true, grid: { size: 100 }, dimensions: { sceneX: 200, sceneY: 300 }, scene: { async createEmbeddedDocuments(type, tokens) { assert.equal(type, "Token"); placed.push(...tokens); } } };
  const trainer = await prepareTrainer({ trainerMinLevel: 5, trainerMaxLevel: 5 }, { Builder });
  await createEncounter([trainer], { placeTokens: true });
  assert.equal(placed[0].actorId, trainer.data._id);
  assert.equal(placed[0].x, 200);
  assert.equal(placed[0].y, 300);
  assert.equal(placed[0].texture.src, trainer.data.img);
});
