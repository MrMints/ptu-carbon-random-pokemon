// Curated generic trainer classes only; never select from the full character category.
// Original game artwork remains copyright Nintendo / Creatures / GAME FREAK.
export const TRAINER_ART = Object.freeze([
  { id: "ace-f", label: "Ace Trainer (Female)", sex: "Female", file: "ORAS_Ace_Trainer_F.png", url: "https://archives.bulbagarden.net/media/upload/a/a0/ORAS_Ace_Trainer_F.png" },
  { id: "ace-m", label: "Ace Trainer (Male)", sex: "Male", file: "ORAS_Ace_Trainer_M.png", url: "https://archives.bulbagarden.net/media/upload/a/a1/ORAS_Ace_Trainer_M.png" },
  { id: "lass", label: "Lass", sex: "Female", file: "ORAS_Lass.png", url: "https://archives.bulbagarden.net/media/upload/2/29/ORAS_Lass.png" }
].map(art => Object.freeze({ ...art, game: "Pokémon Omega Ruby and Alpha Sapphire", source: `https://archives.bulbagarden.net/wiki/File:${art.file}`, portrait: `modules/ptu-carbon-random-pokemon/assets/trainers/${art.file}` })));

export async function resolveTrainerPortrait(art) {
  // Use the configured picker: Forge overrides it to resolve Bazaar and Assets
  // Library files. Do not guess an account ID or construct a Forge CDN URL.
  const Picker = foundry.applications?.apps?.FilePicker?.implementation ?? CONFIG.ux?.FilePicker;
  if (!Picker?.browse) return art.portrait;
  const directory = "modules/ptu-carbon-random-pokemon/assets/trainers";
  const result = await Picker.browse("data", directory);
  const file = result.files?.find(path => decodeURIComponent(path.split("?")[0].split("/").at(-1)) === art.file);
  if (!file) throw new Error(`Trainer artwork is missing: ${art.file}. Reinstall the complete module ZIP using its manifest URL.`);
  return file;
}
