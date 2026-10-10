import { MODULE_ID, checkSystem, prepareBatch, createBatch } from "./generator.js";
import { prepareTrainer, validateTrainerOptions } from "./trainers.js";
export { MODULE_ID, checkSystem };

export async function prepareEncounter(input = {}, dependencies = {}) {
  checkSystem();
  if (!input.mode || input.mode === "pokemon") return prepareBatch(input);
  const options = validateTrainerOptions(input);
  const batch = [];
  for (let index = 0; index < options.amount; index++) {
    const trainer = await prepareTrainer(options, dependencies);
    batch.push(trainer);
    if (options.mode !== "party") continue;
    const pokemon = [];
    if (options.trainerHasMega) pokemon.push(...await prepareBatch({ ...options, amount: 1 }, { megaOnly: true }));
    const ordinaryCount = options.partySize - pokemon.length;
    if (ordinaryCount) pokemon.push(...await prepareBatch({ ...options, amount: ordinaryCount }));
    for (const entry of pokemon) {
      entry.data._id = foundry.utils.randomID();
      entry.data.flags.ptu ??= {};
      entry.data.flags.ptu.party = { trainer: trainer.data._id, boxed: false };
      entry.data.system.alliance = trainer.data.system.alliance;
      entry.summary.owner = trainer.data.name;
    }
    batch.push(...pokemon);
  }
  return batch;
}

export async function createEncounter(batch, { placeTokens = false } = {}) {
  if (placeTokens && !canvas?.ready) throw new Error("Open a scene before placing tokens.");
  checkSystem();
  if (!Array.isArray(batch) || !batch.length || batch.length > 350) throw new Error("Preview a batch of 1–350 actors first.");
  const prepared = foundry.utils.deepClone(batch);
  const existing = [...game.folders.values()].find(folder => folder.type === "Actor" && folder.name === "Random Encounter Gen" && !folder.folder);
  const root = existing ?? await Folder.create({ name: "Random Encounter Gen", type: "Actor", folder: null });
  for (const entry of prepared) entry.data.folder = root.id;
  // Carbon's party sheet expects a trainer folder and a Party child folder.
  for (const entry of prepared.filter(entry => entry.data.type === "character")) {
    const folder = await Folder.create({ name: entry.data.name, type: "Actor", folder: entry.data.folder || null });
    entry.data.folder = folder.id;
    const party = prepared.filter(member => member.data.flags?.ptu?.party?.trainer === entry.data._id);
    if (!party.length) continue;
    const partyFolder = await Folder.create({ name: "Party", type: "Actor", folder: folder.id, sorting: "m" });
    for (const member of party) member.data.folder = partyFolder.id;
  }
  const actors = await createBatch(prepared);
  if (placeTokens) {
    const size = canvas.grid.size;
    const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
    const tokens = [];
    for (const [index, actor] of actors.entries()) {
      const token = await actor.getTokenDocument({ x: sceneX + (index % 8) * size * 2, y: sceneY + Math.floor(index / 8) * size * 2 });
      tokens.push(token.toObject());
    }
    try { await canvas.scene.createEmbeddedDocuments("Token", tokens); }
    catch (error) { throw new Error(`Actors were created, but token placement failed: ${error.message}. Drag the actors onto the scene.`); }
  }
  return actors;
}
