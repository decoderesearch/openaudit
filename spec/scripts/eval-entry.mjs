// Checks one eval entry (`{ eval, versions }`, as in data/seed/evals/*.json) against the Eval and
// EvalVersion schemas, the pass rules and the tiers. check-eval-seed.mjs and the eval submission
// check (submissions/check-eval.mjs) both use it.
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { bundle } from "./generate.mjs";

const SPEC_DIR = fileURLToPath(new URL("..", import.meta.url));
const SPEC = "https://openaudit.com/spec/v1/openaudit.schema.json#/$defs/";
const FAKE_ID = "01900000-0000-7000-8000-000000000000";

let validators;
function validatorsOf() {
  if (!validators) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);
    ajv.addSchema(bundle());
    validators = {
      eval: ajv.getSchema(`${SPEC}Eval`),
      version: ajv.getSchema(`${SPEC}EvalVersion`),
    };
  }
  return validators;
}

let tierNames;
/** The tiers in spec/model-ladders.yaml. */
export function tiers() {
  tierNames ??= new Set(
    Object.keys(
      YAML.parse(readFileSync(join(SPEC_DIR, "model-ladders.yaml"), "utf8"))
        .tiers,
    ),
  );
  return tierNames;
}

/** The same normalizer as the seed import. */
export const norm = (s) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

const errorsOf = (validate, value, at) =>
  validate(value)
    ? []
    : validate.errors.map(
        (e) =>
          `${at}${e.instancePath || "/"} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(", ")})` : ""}`,
      );

/** A pass rule has one kind, and its groups are metrics of the version. */
function passErrors(v, at) {
  const keys = new Set((v.metrics ?? []).map((m) => m.key));
  return (v.scores ?? []).flatMap((s) => {
    if (!s.pass) return [];
    const errors = [];
    const kinds = ["values", "byTarget", "failAtOrAbove", "none"].filter(
      (k) => s.pass[k] !== undefined,
    );
    if (kinds.length !== 1)
      errors.push(
        `${at} score ${s.key}: a pass rule needs one of values, byTarget, failAtOrAbove, none`,
      );
    for (const g of s.pass.groups ?? [])
      if (!keys.has(g))
        errors.push(
          `${at} score ${s.key}: pass group ${g} is not a metric of this version`,
        );
    return errors;
  });
}

/** Each model slot names a tier of spec/model-ladders.yaml, if it names one. */
function tierErrors(v, at) {
  return (v.runner?.models ?? [])
    .filter((m) => m.tier !== undefined && !tiers().has(m.tier))
    .map(
      (m) =>
        `${at}/runner/models ${m.id}: tier ${m.tier} is not in spec/model-ladders.yaml (${[...tiers()].join(", ")})`,
    );
}

/** The errors of an eval entry, `{ eval, versions }`. */
export function evalEntryErrors(entry) {
  const v = validatorsOf();
  const e = entry?.eval ?? {};
  // A seed names its suite by slug (`suite`); the import sets `suiteId`.
  const { suite, ...fields } = e;
  const errors = errorsOf(
    v.eval,
    { id: FAKE_ID, ...fields, ...(suite && { suiteId: FAKE_ID }) },
    "/eval",
  );
  if (!Array.isArray(entry?.versions) || !entry.versions.length)
    errors.push("/versions needs at least one version");
  (entry?.versions ?? []).forEach((ver, i) => {
    const at = `/versions/${i}`;
    errors.push(
      ...errorsOf(v.version, { id: FAKE_ID, evalId: FAKE_ID, ...ver }, at),
      ...passErrors(ver, at),
      ...tierErrors(ver, at),
    );
  });
  return errors;
}
