import test from "node:test";
import assert from "node:assert/strict";
import { prepareTrainerBuild } from "../scripts/trainer-build.js";

function fixture() {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  const option = (label, uuid, extra = {}) => ({ label, uuid, ...extra });
  const base = option("General Trainer", "base", { class: true });
  const doctor = option("Medical Specialist", "doctor", { unknown: "I'm a Doctor" });
  const mystic = option("Mystic Feature", "mystic", { unknown: "The user does not have Mystic Senses" });
  const high = option("Master Feature", "high", { minimum: 6 });
  const chain = option("Linked Feature", "chain", { dependency: true });
  const edge = option("Ordinary Edge", "edge");
  const builder = {
    expectedFeatureNumber: 3, expectedEdgeNumber: 2, expectedClassNumber: 1, skillLimit: 3, maxSkillPoints: 7,
    trainer: { classes: { selected: [] }, features: { selected: [], computed: [] }, edges: { selected: [], computed: [] }, subSelectables: {},
      skills: { command: { min: 1, max: 6, value: 2 }, focus: { min: 1, max: 6, value: 2 } } },
    multiselects: { classes: { options: [doctor, mystic, base] }, features: { options: [doctor, mystic, high, chain] }, edges: { options: [edge] } },
    async refresh() {
      this.warnings = { unknown: [], unmet: [] };
      const selected = [...this.trainer.classes.selected, ...this.trainer.features.selected, ...this.trainer.edges.selected];
      const features = selected.filter(item => item.uuid !== "edge");
      for (const item of selected) {
        if (item.unknown) this.warnings.unknown.push(`Unknown prerequisite "${item.unknown}"`);
        if (item.minimum) {
          this.trainer.skills.command.value = Math.max(this.trainer.skills.command.value, item.minimum);
          this.trainer.skills.command.min = item.minimum;
        }
      }
      if (features.some(item => item.dependency) && !features.some(item => item.uuid === "base")) features.push(base);
      this.trainer.features.computed = features.map(item => ({ ...item, system: { keywords: item.class ? ["Class"] : [] } }));
      this.trainer.edges.computed = selected.filter(item => item.uuid === "edge");
    },
    async randomizeSubOptions() {}
  };
  return builder;
}

test("exact reported prerequisite failures skip candidates while producing a valid trainer", async () => {
  const builder = fixture();
  const skipped = await prepareTrainerBuild(builder);
  assert.ok(skipped.includes("Medical Specialist"));
  assert.ok(skipped.includes("Mystic Feature"));
  assert.deepEqual(builder.warnings, { unknown: [], unmet: [] });
  assert.ok(builder.trainer.features.computed.some(item => item.uuid === "base"));
  assert.ok(builder.trainer.features.computed.some(item => item.uuid === "chain"));
  assert.ok(!builder.trainer.features.computed.some(item => ["doctor", "mystic", "high"].includes(item.uuid)));
});

test("rejected trials roll back skill changes and dependencies, and respect rank and advancement budgets", async () => {
  const builder = fixture();
  await prepareTrainerBuild(builder);
  assert.ok(Object.values(builder.trainer.skills).every(skill => skill.value <= 3 && skill.min < 6));
  assert.ok(Object.values(builder.trainer.skills).reduce((sum, skill) => sum + skill.value, builder.trainer.edges.computed.length) <= 7);
  const items = [...builder.trainer.features.computed, ...builder.trainer.edges.computed];
  assert.equal(new Set(items.map(item => item.uuid)).size, items.length);
});

test("an entirely unsupported compendium reports an actionable error instead of creating invalid actors", async () => {
  const builder = fixture();
  builder.multiselects.classes.options = builder.multiselects.classes.options.filter(item => item.unknown);
  builder.multiselects.features.options = [];
  await assert.rejects(prepareTrainerBuild(builder), /No compatible trainer features.*Compendium Browser/);
  assert.equal(builder.trainer.features.computed.length, 0);
});
