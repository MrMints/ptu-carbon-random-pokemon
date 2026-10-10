import { pick, shuffle } from "./rules.js";

const problems = builder => [...(builder.warnings?.unmet ?? []), ...(builder.warnings?.unknown ?? [])];
const computed = builder => [...builder.trainer.features.computed, ...builder.trainer.edges.computed];

// Carbon refresh dereferences every item-backed ChoiceSet option without checking
// for missing documents. Check candidates and automatic dependencies first: a
// failed refresh also leaves Carbon's mutex locked, so catching it is too late.
function referenceCheck(builder) {
  const documents = new Map();
  const resolve = uuid => {
    if (!documents.has(uuid)) documents.set(uuid, Promise.resolve().then(() => fromUuid(uuid)).catch(() => null));
    return documents.get(uuid);
  };
  return async candidate => {
    const source = await resolve(candidate.uuid);
    if (!source) return false;
    const item = { ...source.toObject(), uuid: candidate.uuid };
    const dependencies = builder.allItemPrereqs ? await builder.allItemPrereqs(item.system?.prerequisites ?? [], {
      level: builder.trainer.level,
      allComputed: [...computed(builder), item],
      skillsComputed: Object.fromEntries(Object.entries(builder.trainer.skills).map(([key, skill]) => [key, skill.value]))
    }) : {};
    for (const document of [item, ...(dependencies.allNewFeatures ?? []), ...(dependencies.allNewEdges ?? [])]) {
      for (const rule of document.system?.rules ?? []) {
        if (rule.key !== "ChoiceSet") continue;
        if (!Array.isArray(rule.choices)) return false;
        // Match Carbon's item-backed choice detection, including mixed lists.
        if (!rule.choices.every(choice => /Compendium\.([\w\.]+).Item.[a-zA-Z0-9]+/.test(choice.value))) continue;
        for (const choice of rule.choices) {
          const target = await resolve(choice.value);
          if (!target?.name || !target.uuid) return false;
        }
      }
    }
    return true;
  };
}

function spendSkillPoints(builder, budget) {
  const skills = Object.values(builder.trainer.skills);
  let used = skills.reduce((sum, skill) => sum + skill.value, 0);
  while (used < budget) {
    const available = skills.filter(skill => skill.value < Math.min(builder.skillLimit, skill.max));
    if (!available.length) break;
    pick(available).value++;
    used++;
  }
}

function validBuild(builder, featureLimit, edgeLimit) {
  const items = computed(builder);
  const skills = Object.values(builder.trainer.skills);
  const unique = new Set(items.map(item => item.uuid));
  return !problems(builder).length
    && unique.size === items.length
    && builder.trainer.features.computed.length <= featureLimit
    && builder.trainer.edges.computed.length <= edgeLimit
    && builder.trainer.features.computed.filter(item => item.system?.keywords?.includes("Class")).length <= 4
    && skills.every(skill => Number.isInteger(skill.value) && skill.value >= 1 && skill.value <= Math.min(builder.skillLimit, skill.max))
    && skills.reduce((sum, skill) => sum + skill.value, builder.trainer.edges.computed.length) <= builder.maxSkillPoints
    && Object.values(builder.trainer.subSelectables).every(choice => choice.selected !== null && choice.selected !== undefined);
}

// Carbon remains the prerequisite parser and dependency/choice resolver. Trial
// each acquisition against real ranks, then roll back the entire trial if invalid.
// Its randomizeAll instead assumes every skill is at the level cap and ignores
// unknown prerequisite text when choosing features, so it cannot be used here.
export async function prepareTrainerBuild(builder) {
  for (const bucket of ["classes", "features", "edges"]) builder.trainer[bucket].selected = [];
  await builder.refresh();
  if (problems(builder).length) throw new Error(`Carbon could not initialize trainer prerequisites: ${problems(builder).join(" ")}`);
  const featureLimit = builder.expectedFeatureNumber;
  const edgeLimit = builder.expectedEdgeNumber;
  const classLimit = Math.min(4, builder.expectedClassNumber, featureLimit);
  for (const skill of Object.values(builder.trainer.skills)) skill.value = Math.max(2, skill.min);
  // Reserve advancement points for edges before distributing the starting profile.
  spendSkillPoints(builder, builder.maxSkillPoints - edgeLimit);
  await builder.refresh();
  const skipped = new Set();
  const referencesValid = referenceCheck(builder);
  for (let pass = 0; pass < featureLimit + edgeLimit; pass++) {
    let accepted = false;
    for (const bucket of ["classes", "features", "edges"]) {
      const choices = shuffle(builder.multiselects[bucket].options);
      for (const candidate of choices) {
        if (computed(builder).some(item => item.uuid === candidate.uuid)) continue;
        const classCount = builder.trainer.features.computed.filter(item => item.system?.keywords?.includes("Class")).length;
        if (bucket === "classes" && classCount >= classLimit) break;
        if (bucket !== "edges" && builder.trainer.features.computed.length >= featureLimit) break;
        if (bucket === "edges" && builder.trainer.edges.computed.length >= edgeLimit) break;
        // Skill-advancement edges are represented by the distributed ranks already.
        if (bucket === "edges" && ["Basic Skills", "Adept Skills", "Expert Skills", "Master Skills"].includes(candidate.label)) continue;
        if (!await referencesValid(candidate)) {
          skipped.add(candidate.label);
          continue;
        }
        const previous = foundry.utils.deepClone(builder.trainer);
        builder.trainer[bucket].selected.push(candidate);
        await builder.refresh();
        // refresh applies inferred minimum ranks after collecting warnings. A
        // second pass validates OR/count prerequisites against those actual ranks.
        await builder.refresh();
        await builder.randomizeSubOptions();
        await builder.refresh();
        if (validBuild(builder, featureLimit, edgeLimit)) {
          accepted = true;
        } else {
          skipped.add(candidate.label);
          builder.trainer = previous;
          await builder.refresh();
        }
      }
    }
    if (!accepted) break;
  }
  if (!builder.trainer.features.computed.length) {
    throw new Error("No compatible trainer features were found. Check that Carbon's feature and edge compendiums are enabled in its Compendium Browser.");
  }
  spendSkillPoints(builder, builder.maxSkillPoints - builder.trainer.edges.computed.length);
  await builder.refresh();
  if (!validBuild(builder, featureLimit, edgeLimit)) throw new Error("Carbon could not validate the completed trainer build. Check the feature and edge compendium data.");
  return [...skipped];
}
