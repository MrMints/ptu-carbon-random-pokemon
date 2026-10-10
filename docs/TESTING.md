# Foundry VTT manual QA

Target: Foundry 13.350 with Pokémon Carbon 4.4.3 and the standard Carbon species, move, ability, and capability compendiums. Run in a disposable test world.

Automated tests use contract doubles and pure rule calculations. They do not substitute for these live checks.

1. Install and enable the module. Confirm no startup errors in the browser console.
2. Open via both the Actors-directory button and the Module Settings menu. Confirm filters, scrolling, resizing, and light/dark-theme readability.
3. Preview Charmander at level 1, then 19, 20, 39, 40, and 100. Confirm one, one, two, two, three, and three abilities. Confirm all are unique and allowed at their acquisition level.
4. Create a level-20 Pokémon whose second ability is another Basic ability. Confirm its `flags.ptu.abilityChosen` is `advanced` (the level-20 acquisition slot). Check subsequent Carbon level-up behavior; Carbon's evolution UI has its own pool assumptions.
5. Check a neutral, an HP-increasing, and an Attack-decreasing nature. Compare nature-adjusted bases and level-up allocations against the PTU Core. Every originally higher base must remain strictly higher after allocation; equal bases may differ.
6. Check Pokémon with implemented static abilities that change base stats or point budgets. Compare preview and the saved sheet. Check Huge/Pure Power and other species-specific exceptions supported by Carbon.
7. Confirm no more than six distinct natural moves, and no future-level moves. Inspect species that have multiple Evo moves. The generator uses the final species' list; inherited previous-stage moves need manual review.
8. Preview and create Shedinja. Confirm maximum and current HP equal 1 on the saved sheet.
9. Generate species with gender ratios 0, 100, and -1. Confirm female-only, male-only, and genderless outputs respectively.
10. Set shiny chance to 0, 1, and 100. Confirm endpoints and sprite behavior. Confirm missing sprites fall back to a usable icon.
11. Generate cosmetic forms (Unown, flower species, Shellos, Minior, Alcremie) and regional forms from installed entries. Confirm originals in the compendium are unchanged. Review Toxtricity nature/form consistency and any special forms yourself.
12. Filter Charizard below its listed evolution level; it must be ineligible. Check a range spanning that level. Stone/item or other special evolution requirements need GM review.
13. Preview a batch of 50. Create to a selected Actor folder. Confirm correct folder, names, levels, full HP, embedded species/moves/abilities/capabilities, and source UUIDs. Changing a filter must invalidate the old preview. Clicking create twice must not duplicate actors.
14. Break a reference in a copied custom species. Preview must fail with a useful message and create no actors. Check no matches, invalid ranges, and amount >50.
15. Log in as a player. No generator button/menu should be available, and macro API requests must fail.
16. Create an actor, close/reload the world, and check the sheet again. Drag its token onto the canvas and confirm art, dimensions, health bar, and normal Carbon behavior.

Record Foundry/Carbon versions, species, options, screenshots, and console errors with any bug report. Do not publish a stable release until these checks have been completed.

## Trainer and party checks for 0.2.0

1. Switch among Pokémon only, Trainers only, and Trainers with their Pokémon. Confirm relevant controls appear and previously selected ranges survive switching. Every change invalidates the preview.
2. Generate trainers at exact levels 1, 5, 25 and 50, then in a range. Check the saved Carbon character sheet, feature/edge prerequisites, skills, spent stat points, full HP and AP. Test a world advancement variant with a lower level cap; an unsupported level must fail rather than silently change the requested level.
3. Check each generic artwork option and random artwork. Portraits and prototype token textures must resolve from installed assets after reloading, without an external artwork request. Each source must link to the matching generic ORAS trainer class.
4. Create two trainers with three Pokémon each, then one trainer with six. Confirm the correct trainer appears for every Pokémon in Carbon's party sheet; no Pokémon may switch owners after world reload. Pokémon and trainer levels must follow their independent selections.
5. Drag each trainer and Pokémon onto a scene. Check the matching token art, actor linkage, health and token controls. Enable automatic scene placement and confirm actors and actual Token documents are created. With no open scene, placement must fail before creating any actors.
6. Test trainer feature/edge references and ChoiceSet selections. Missing references, unknown/unmet prerequisites or unresolved choices must stop preview with a reroll message.

## Forge-hosted test

Use a Forge game configured for Foundry 13 and Carbon 4.4.3. Install this custom module through Bazaar → Install From Manifest using the README URL, then enable and reload. Confirm version 0.2.0, each trainer portrait and token texture, the saved party ownership and party folders after reload, and optional scene token placement. Check the portrait/token URL returned by the configured Forge file picker: both must refer to the same hosted image. No image upload, local filesystem access or Forge API key should be required. Please record console errors and the exact Foundry/system/module versions if installation or generation fails.

## 0.2.1 checks
- Pool dropdown excludes moves/abilities-only compendiums; mixed compendiums use species items only.
- Include forms never rolls a Mega in Pokemon-only mode or unchecked trainer parties.
- Checked trainer parties contain exactly one Mega per trainer, within party size; impossible filters fail preview without writes.
- Actor creation reuses Random Encounter Gen; trainers and Party subfolders stay underneath it.
- Trainer actor and prototype token share a random game-opponent name.
- New window starts at 0.01% shiny chance.
- Resize the window on a small screen and scroll from the heading through controls, previews and credit footer.


## 0.2.2 checks
- Confirm Include Legendary and Mythical Pokemon starts unchecked in both Pokemon-only and trainer-party modes.
- Search Mew or Articuno while unchecked: preview reports no matching species. Enable the checkbox: the selected species can generate at an eligible level.
- In trainer-party mode, Mega Mewtwo requires both the Mega option and Legendary/Mythical checkbox.
- Enabling rare species still respects the other filters and does not guarantee a rare roll in an unrestricted pool.


## 0.2.4 trainer prerequisite checks
- Generate trainers at levels 1, 2, 5, 6, 12, 25 and 50 using the installed feature and edge compendiums.
- Features requiring unsupported Mystic Senses negation or an unresolved I'm a Doctor prerequisite must be skipped, with compatible features retained.
- Check skill ranks, prerequisite feature dependencies, item choices and advancement budgets on the saved actor; reroll several previews.
- Generation must report an actionable compendium error if no compatible feature is available, with no actor writes.
- Automated checks cover exact reported errors and rollback. A separate development harness exercised the actual Carbon builder 140 times with controlled compendium documents. Live Forge QA remains with the user.


- Include a feature with a ChoiceSet pointing to a missing item and a feature requiring that feature. Preview should skip both without a null name error or stalled refresh.
- Version 0.2.4: 30 automated tests and 140 isolated native-builder runs passed with missing ChoiceSet documents and the reported prerequisite strings in the pool.

- Version 0.2.5: 32 automated tests pass. Test a species with a stale Torrent UUID while Torrent is present in ptu.abilities; preview should include Torrent and leave the source species unchanged. Missing/ambiguous matches must still fail.
- Female sprite 404 requests may occur during Carbon's normal fallback to standard sprites. Check the resulting actor and token images rather than treating each probe as a generation failure.
