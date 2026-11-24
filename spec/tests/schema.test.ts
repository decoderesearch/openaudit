import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bundle } from "../scripts/generate.mjs";

const schema = bundle();
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
ajv.addSchema(schema);

const read = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"),
  );
const RECORDS = [
  "Organization",
  "Document",
  "Model",
  "Eval",
  "EvalSuite",
  "EvalVersion",
  "EvalSample",
  "SystemCard",
  "EvalResult",
  "EvalRun",
  "EvalAttempt",
  "Transcript",
  "OpenAuditCardVersion",
  "OpenAuditSnippet",
  "OrgIncident",
  "OrgIncidentEvent",
  "OrgDeparture",
  "Commitment",
  "OrgCommitment",
  "OrgCommitmentEvent",
  "Method",
  "MethodVariant",
  "MethodExpertView",
  "MethodArtifact",
  "MethodResult",
] as const;
const examples = Object.fromEntries(
  RECORDS.map((t) => [t, read(`${t}.json`)]),
) as Record<(typeof RECORDS)[number], Record<string, unknown>[]>;
const invalid: { why: string; type: string; record: unknown }[] =
  read("invalid.json");

const validate = (type: string, record: unknown) => {
  const check = ajv.getSchema(`${schema.$id}#/$defs/${type}`);
  if (!check) throw new Error(`No schema for ${type}`);
  return { ok: check(record), errors: check.errors };
};

describe("spec examples", () => {
  it("every record type in the bundle has examples", () => {
    const types = schema.anyOf.map((r: { $ref: string }) =>
      r.$ref.split("/").pop(),
    );
    expect(types.sort()).toEqual([...RECORDS].sort());
  });

  for (const type of RECORDS) {
    it(`${type} examples are valid`, () => {
      for (const record of examples[type]) {
        const { ok, errors } = validate(type, record);
        expect(errors ?? [], `${type} ${record.id}`).toEqual([]);
        expect(ok).toBe(true);
      }
    });
  }

  for (const c of invalid) {
    it(`refuses: ${c.why}`, () => {
      expect(validate(c.type, c.record).ok).toBe(false);
    });
  }

  it("examples point only to records that exist", () => {
    const ids = (t: (typeof RECORDS)[number]) =>
      new Set(examples[t].map((r) => r.id));
    const [organizations, documents, models] = [
      ids("Organization"),
      ids("Document"),
      ids("Model"),
    ];
    for (const d of examples.Document)
      expect(organizations).toContain(d.publisherId);
    for (const m of examples.Model) {
      expect(organizations).toContain(m.organizationId);
      for (const id of m.documentIds as string[])
        expect(documents).toContain(id);
      if (m.parentId) expect(models).toContain(m.parentId);
    }
    const evals = ids("Eval");
    const [versions, runs] = [ids("EvalVersion"), ids("EvalRun")];
    for (const e of examples.Eval) {
      for (const m of e.maintainers as { organizationId?: string }[]) {
        if (m.organizationId) expect(organizations).toContain(m.organizationId);
      }
    }
    for (const v of examples.EvalVersion) expect(evals).toContain(v.evalId);
    const splits = new Map(
      examples.EvalVersion.map((v) => [
        v.id,
        (
          (v.dataset as { splits: { name: string }[] } | undefined)?.splits ??
          []
        ).map((s) => s.name),
      ]),
    );
    for (const s of examples.EvalSample)
      expect(splits.get(s.evalVersionId as string), s.id as string).toContain(
        s.split,
      );
    for (const c of examples.SystemCard) {
      for (const id of [c.documentId, ...(c.alsoDocumentIds as string[])])
        expect(documents).toContain(id);
      for (const cover of c.covers as { modelId?: string }[])
        if (cover.modelId) expect(models).toContain(cover.modelId);
    }
    for (const r of examples.EvalResult) {
      if (r.evalId) expect(evals).toContain(r.evalId);
      if (r.modelId) expect(models).toContain(r.modelId);
      const source = r.source as { documentId: string } | undefined;
      if (source) expect(documents).toContain(source.documentId);
      if (r.evalRunId) expect(runs).toContain(r.evalRunId);
    }
    for (const r of examples.EvalRun) {
      expect(evals).toContain(r.evalId);
      expect(models).toContain(r.modelId);
      expect(versions).toContain(r.evalVersionId);
    }
    for (const a of examples.EvalAttempt) expect(runs).toContain(a.runId);
    for (const t of ["OrgIncident", "OrgDeparture"] as const)
      for (const r of examples[t])
        expect(organizations).toContain(r.organizationId);
    const incidents = ids("OrgIncident");
    for (const e of examples.OrgIncidentEvent)
      expect(incidents).toContain(e.incidentId);
    const methods = ids("Method");
    for (const r of [...examples.MethodVariant, ...examples.MethodExpertView])
      expect(methods).toContain(r.methodId);
    const [variants, artifacts] = [ids("MethodVariant"), ids("MethodArtifact")];
    for (const v of examples.MethodVariant) {
      for (const c of v.componentIds as string[]) expect(variants).toContain(c);
      if (v.supersedesId) expect(variants).toContain(v.supersedesId);
    }
    for (const v of examples.MethodExpertView)
      for (const m of v.variantIds as string[]) expect(variants).toContain(m);
    for (const a of examples.MethodArtifact)
      expect(variants).toContain(a.variantId);
    for (const r of examples.MethodResult) {
      expect(artifacts).toContain(r.artifactId);
      expect(versions).toContain(r.evalVersionId);
    }
  });

  // Rules JSON Schema cannot state. The API checks them too.
  it("versions: metrics name real scores, one headline at most, one version name per eval", () => {
    const seen = new Set<string>();
    for (const v of examples.EvalVersion) {
      const key = `${v.evalId}/${v.version}`;
      expect(seen, key).not.toContain(key);
      seen.add(key);
      const scores = new Set((v.scores as { key: string }[]).map((s) => s.key));
      const metrics = v.metrics as {
        key: string;
        score?: string;
        aggregation: string;
        headline?: boolean;
      }[];
      for (const m of metrics) {
        if (m.aggregation === "custom") continue;
        expect(scores, `${key} ${m.key}`).toContain(m.score);
      }
      expect(metrics.filter((m) => m.headline).length, key).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it("lab-internal evals have versions without a dataset", () => {
    const internal = new Set(
      examples.Eval.filter((e) => e.access === "lab_internal").map((e) => e.id),
    );
    for (const v of examples.EvalVersion) {
      if (internal.has(v.evalId as string))
        expect(v.dataset, v.id as string).toBeUndefined();
    }
  });
});
