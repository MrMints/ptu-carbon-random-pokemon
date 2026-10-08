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
