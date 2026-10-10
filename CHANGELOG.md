# Changelog

## 0.2.6

- Resolve legacy references such as bubblebeam against Bubble Beam / bubble-beam when exact slug lookup fails. Require a unique match in the typed Carbon compendium; different spellings and ambiguous matches still fail.
- Add trainer-party regression coverage for two trainers with three Pokemon each, verifying Bubble Beam is embedded and source species remain unchanged. Add collision and exact-match precedence checks.

## 0.2.5

- Resolve missing or stale move, ability and capability UUIDs by exact slug in the corresponding Carbon system compendium before native creation. Update only the isolated generation data. Reject absent or ambiguous matches without dropping items.
- Add Torrent stale-reference and ambiguous-reference regression tests.

## 0.2.4

- Check item-backed ChoiceSet references before Carbon refresh, including automatic feature and edge prerequisites. Candidates with missing documents are skipped before Carbon can dereference a null item or leave its refresh mutex locked.
- Add regression coverage for missing direct choices and missing choices in prerequisite features.

## 0.2.3

Fixes trainer generation aborting on unsupported or unmet feature prerequisites. Replaces Carbon's hypothetical-skill randomizeAll selection with incremental trials against real ranks and Carbon's native prerequisite/dependency resolver. Rejects and rolls back incompatible candidates, including the reported Mystic Senses and I'm a Doctor requirements, while keeping compatible features. Enforces rank/advancement budgets, unique sources, at most four classes and resolved choices. Adds regression tests for the reported errors and full trial rollback.

## 0.2.2

Adds an unchecked Include Legendary and Mythical Pokémon checkbox to the Pokémon pool. Both Pokémon-only and trainer-party generation exclude those species by default, including alternate and Mega forms; enabling the option permits them while preserving all other filters. Uses National Pokédex classification through Pecharunt. Adds ordinary-pool, party, form, and Mega interaction regression tests.

## 0.2.1

Limits pool choices to compendiums with species. Ordinary rolls exclude Mega forms regardless of Include forms; trainer party mode has an explicit checkbox for exactly one Mega within the party size. All actors use a reusable Random Encounter Gen root folder. Trainer and token names use random ordinary game-opponent first names. Shiny chance defaults to 0.01%. The window is height-limited and its entire content scrolls. Adds regression coverage for these generation behaviors.

## 0.2.0

Adds Pokémon-only, trainer-only, and trainer-with-party generation. Trainers have independent selectable levels (1–50, subject to the world's advancement variant), Carbon NPC classes/features/edges/skills, full health and AP, and generic ORAS portraits with matching token textures. Parties contain 1–6 Pokémon per trainer and retain Carbon trainer ownership links. Optional placement creates actual tokens on the open scene. Adds source attribution for bundled unmodified game artwork and automated mode, level, linking, asset and token checks. Live-world QA remains pending.

## 0.1.0

Initial development release for Pokémon Carbon 4.4.3 and Foundry VTT 13. Adds filtered random generation, batch preview, exact actor creation, PTU stat allocation, cumulative ability pools, six-move limits, species isolation, validation, tests, and creator attribution. Live-world QA is pending.
