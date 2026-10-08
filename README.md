# PTU Carbon Random Pokémon

A Foundry VTT module by **MrMints** for generating random Pokémon for **PTU 1.05** in **Pokémon Carbon 4.4.3**, on **Foundry VTT 13**.

**Thank you to Trog / [animenerdfreddurst](https://github.com/animenerdfreddurst) for making [Pokémon Carbon](https://github.com/animenerdfreddurst/pokemon_carbon) a great Foundry VTT system.** This module uses Carbon's public generator API and installed compendiums. Carbon provides the system, document models, species, moves, abilities, capabilities, sprites, and sheets that make this possible. Credit also belongs to npaisley, highmongrel, and the [Pokémon Tabletop Reunited contributors](https://github.com/pokemon-tabletop-reunited/ptr1e) behind its upstream foundation, and to the PTU authors for the tabletop game.

## Install

1. Install Pokémon Carbon 4.4.3 and create a world with that system.
2. In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

   ```text
   https://raw.githubusercontent.com/MrMints/ptu-carbon-random-pokemon/main/module.json
   ```

3. Enable **PTU Carbon Random Pokémon** in your world's **Manage Modules**.
4. As GM, click **Random Pokémon** in the Actors directory, or open it from **Configure Settings → Module Settings → Random Pokémon Generator**.

For manual installation, unzip `ptu-carbon-random-pokemon.zip` into `Data/modules/ptu-carbon-random-pokemon/`. `module.json` must be directly inside that folder. Restart Foundry, then enable the module.

## Generate

Choose a species compendium, optional name or Pokédex number, type, habitat, level range, amount, nature, shiny chance, stat style, move style, and destination Actor folder. Names or numbers separated by commas create a combined pool. Blank search means any matching species. Compendium forms are opt-in.

Click **Preview Pokémon**. Review each Pokémon's level, nature, gender, shiny status, stats, HP, abilities, and moves. Reroll as often as you like. **Create actors** saves the exact preview and embeds its species and items. A single generated actor opens its Carbon sheet. Changing an option clears the preview to prevent saving outdated results. This is GM-only, supports 1–50 actors per batch, and does not place tokens or modify compendium entries.

The level is selected uniformly among levels in the requested range that have eligible species, then the species is selected uniformly from the eligible entries at that level. Entries from multiple forms are separate choices when forms are included. Listed evolution minimum levels determine eligibility; Pokémon can remain unevolved at higher levels. Pokémon are created as their selected species; the module does not apply an extra automatic evolution.

## Rules coverage

The module handles **natural Pokémon generation** under the core PTU 1.05 rules:

- Levels 1–100 and the system's experience progression.
- All 36 PTU natures from Carbon's nature table, including HP natures.
- Nature adjustments of ±1 HP or ±2 in another stat, with minimum base stat 1.
- Allocation of level + 10 stat points, including additional points from Carbon's implemented static ability rules. Every point is spent.
- Strict Base Stat Relation for unequal nature-adjusted bases; tied bases may diverge. Stat styles influence choices within those constraints.
- One Basic ability at birth, a second from Basic/Advanced at level 20, and a third from Basic/Advanced/High at level 40. No duplicate abilities. Carbon's acquisition-slot flags are preserved for future leveling.
- Up to six distinct natural moves, selected from eligible level-up and evolution moves. Choose the latest eligible moves or a random selection.
- Species gender ratios and genderless species, capabilities, skills, typing, token size, supported cosmetic forms, artwork, and actor preparation through Carbon.
- Full HP after Carbon's actor preparation, including its implemented species exceptions such as Shedinja.
- Shiny chance from 0% (never) through 100% (always), without Carbon's percentage ambiguity.
- Missing move, ability, and capability UUIDs fail the preview rather than silently producing an incomplete actor.

**Scope and limits:** This does not automate every PTU rule or repair every rule in Carbon. Trainer Features, Poké Edges, breeding histories, inherited moves from previous evolutionary stages, purchased TMs, tutoring, held items, injuries, custom templates, Mega Evolution, and optional/house rules are applied through the normal Carbon sheets after generation. The generator uses the selected species' installed natural move list; it does not invent an evolution history. Special evolution conditions such as stones, gender, time, friendship, and temporary-form requirements need GM review. Carbon's current form handling and data determine species-specific behavior. Invalid or incomplete custom species are reported during preview. Other systems using the ID `ptu` are not automatically compatible.

## Validation status

Targeted against Pokémon Carbon **4.4.3**, upstream tree **172313d320bba4cca34c299913c3a3fe4c0abc26**. The release includes automated rules and integration-contract tests. Tests cover every nature pair at every level with every stat style (18,000 allocations), randomized base-stat spreads, ability thresholds, move limits, validation, reference failures, preview isolation, shiny endpoints, and exact actor creation data.

**Live Foundry validation remains required:** No licensed running Foundry world was available during development. The compatibility fields identify the intended target; they are not a claim of a completed live-world test. Use the [manual QA checklist](docs/TESTING.md) before relying on the module for a campaign. This first release is **0.1.0**.

## Macro API

Open the interface from a Script macro:

```js
game.modules.get("ptu-carbon-random-pokemon").api.open();
```

Prepare and create directly, as GM:

```js
const api = game.modules.get("ptu-carbon-random-pokemon").api;
const batch = await api.preview({
  amount: 3,
  minLevel: 10,
  maxLevel: 15,
  search: "Pikachu, Eevee",
  shinyChance: 1,
  statStyle: "balanced",
  moveStyle: "random",
  pack: "ptu.species"
});
console.table(batch.map(entry => entry.summary));
// Only call after reviewing the batch:
const actors = await api.create(batch);
```

## Development and releases

No runtime dependencies or build step. Use Node.js 22.15+:

```sh
npm test
npm run check
```

Package the module on Windows with `./tools/package.ps1`. A tag such as `v0.1.0` triggers the GitHub Actions release workflow, runs the tests, and publishes the module ZIP. The manifest download URL must match the version and tag. Release artifacts include only the module and documentation, not development fixtures or upstream data.

Rule references: PTU 1.05 Core, **Managing Pokémon**, pp. 198–200 ([base-stat excerpt](https://kddnewton.com/pokerpg-builder/PokeRPG-Base-Stat-Info.pdf)); Carbon's [generator API](https://github.com/animenerdfreddurst/pokemon_carbon/blob/master/src/scripts/game-ptu.js), [native generator](https://github.com/animenerdfreddurst/pokemon_carbon/blob/master/src/module/actor/pokemon/generator.js), and [actor preparation](https://github.com/animenerdfreddurst/pokemon_carbon/blob/master/src/module/actor/pokemon/document.js).

## License and attribution

Original module code is licensed under MIT; see [LICENSE](LICENSE). No Carbon source code, compendium data, PTU books, or Pokémon artwork is bundled. Those projects and assets retain their respective ownership and terms. Pokémon belongs to Nintendo, Game Freak, and The Pokémon Company. This independent fan project is not affiliated with those companies or an official Pokémon Carbon release.
