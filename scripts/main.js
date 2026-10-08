import { MODULE_ID, checkSystem, prepareBatch, createBatch } from "./generator.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class RandomPokemonApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    classes: ["ptu-carbon-generator"],
    tag: "form",
    window: { title: "PTU Carbon Random Pokémon", resizable: true },
    position: { width: 740, height: 760 },
    form: { closeOnSubmit: false, handler: RandomPokemonApp.preview },
    actions: { create: RandomPokemonApp.create }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/generator.hbs`, scrollable: [""] } };

  batch = [];
  busy = false;
  values = { amount: 1, minLevel: 5, maxLevel: 10, shinyChance: 1, includeForms: false, pack: "ptu.species", statStyle: "balanced", moveStyle: "latest" };
  message = "Choose your filters, then preview a random Pokémon.";
  listenerController;

  async _prepareContext() {
    const pack = game.packs.get(this.values.pack);
    const index = pack ? await pack.getIndex({ fields: ["type", "system.types", "system.habitats"] }) : [];
    const species = [...index].filter(item => item.type === "species");
    const choices = (values, selected) => [...new Set(values)].sort().map(value => ({ value, selected: value === selected }));
    return {
      values: this.values, busy: this.busy, message: this.message,
      hasPreview: this.batch.length > 0, batch: this.batch.map(entry => entry.summary),
      packs: game.packs.filter(p => p.documentName === "Item").map(p => ({ id: p.collection, label: p.metadata.label, selected: p.collection === this.values.pack })),
      folders: game.folders.filter(f => f.type === "Actor").map(f => ({ id: f.id, name: f.name, selected: f.id === this.values.folder })),
      types: choices(species.flatMap(s => s.system?.types ?? []), this.values.type),
      habitats: choices(species.flatMap(s => s.system?.habitats ?? []), this.values.habitat),
      natures: choices(Object.keys(CONFIG.PTU.data.natureData), this.values.nature),
      statStyles: ["balanced", "random", "physical", "special", "defensive"].map(value => ({ value, selected: this.values.statStyle === value })),
      moveStyles: ["latest", "random"].map(value => ({ value, selected: this.values.moveStyle === value }))
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.listenerController?.abort();
    this.listenerController = new AbortController();
    this.element.addEventListener("change", async event => {
      if (!event.target.name || this.busy) return;
      this.values = RandomPokemonApp.readForm(this.element);
      this.batch = [];
      this.message = "Options changed. Preview again before creating actors.";
      await this.render();
    }, { signal: this.listenerController.signal });
  }

  static readForm(form) {
    const values = Object.fromEntries(new FormData(form));
    values.includeForms = form.elements.includeForms.checked;
    return values;
  }

  static async preview(event, form, formData) {
    if (this.busy) return;
    this.values = RandomPokemonApp.readForm(form);
    this.busy = true;
    this.batch = [];
    this.message = "Generating preview…";
    await this.render();
    try {
      this.batch = await prepareBatch(this.values);
      this.message = `${this.batch.length} Pokémon ready. Create actors to save this exact preview.`;
    } catch (error) {
      console.error(`${MODULE_ID} | Preview failed`, error);
      this.message = error.message;
      ui.notifications.error(error.message);
    } finally {
      this.busy = false;
      await this.render();
    }
  }

  static async create() {
    if (this.busy || !this.batch.length) return;
    this.busy = true;
    this.message = "Creating actors…";
    await this.render();
    try {
      const actors = await createBatch(this.batch);
      this.batch = [];
      this.message = `Created ${actors.length} Pokémon in the Actors directory.`;
      ui.notifications.info(this.message);
      if (actors.length === 1) actors[0].sheet.render(true);
    } catch (error) {
      console.error(`${MODULE_ID} | Creation failed`, error);
      this.message = `${error.message} Check the Actors directory before retrying.`;
      this.batch = [];
      ui.notifications.error(this.message);
    } finally {
      this.busy = false;
      await this.render();
    }
  }
}

let application;
function openGenerator() {
  try {
    checkSystem();
    application ??= new RandomPokemonApp();
    return application.render({ force: true });
  } catch (error) { ui.notifications.error(error.message); }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "generator", {
    name: "Random Pokémon Generator", label: "Open Generator", hint: "Generate PTU Pokémon with a preview before saving.",
    icon: "fas fa-dice", type: RandomPokemonApp, restricted: true
  });
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  module.api = Object.freeze({ open: openGenerator, preview: prepareBatch, create: createBatch });
  if (game.user.isGM) {
    try { checkSystem(); } catch (error) { ui.notifications.warn(error.message); }
  }
});

function addDirectoryButton(app, html) {
  if (!game.user.isGM || game.system.id !== "ptu") return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const footer = root?.querySelector(".directory-footer");
  if (!footer || footer.querySelector(`[data-module="${MODULE_ID}"]`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.module = MODULE_ID;
  button.innerHTML = '<i class="fas fa-dice" aria-hidden="true"></i> Random Pokémon';
  button.addEventListener("click", openGenerator);
  footer.append(button);
}
Hooks.on("renderActorDirectory", addDirectoryButton);
