// Bundles spec/schemas/*.yaml into one JSON Schema, then makes TypeScript, Python and Swift types.
// Also checks spec/model-ladders.yaml and copies it as JSON into the TypeScript and Python packages.
// `--check` writes nothing and fails when a generated file is out of date.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const SPEC = fileURLToPath(new URL('..', import.meta.url));
const SCHEMAS = join(SPEC, 'schemas');
const GEN = join(SPEC, 'generated');
const HEADER = 'Generated from spec/schemas by spec/scripts/generate.mjs. Do not edit.';
const DATAMODEL_CODEGEN = 'datamodel-code-generator[black,isort]==0.83.0';

export const OUTPUTS = {
  bundle: join(GEN, 'openaudit.schema.json'),
  tsSchema: join(GEN, 'typescript', 'schema.json'),
  ts: join(GEN, 'typescript', 'index.ts'),
  python: join(GEN, 'python', 'openaudit_spec', 'models.py'),
  swift: join(GEN, 'swift', 'Sources', 'OpenAuditSpec', 'OpenAuditSpec.swift'),
  laddersTs: join(GEN, 'typescript', 'model-ladders.json'),
  laddersPython: join(GEN, 'python', 'openaudit_spec', 'model_ladders.json'),
};

/** spec/model-ladders.yaml, checked against `ModelLadders` and the ladder rules. */
export function ladders(schema) {
  const doc = YAML.parse(readFileSync(join(SPEC, 'model-ladders.yaml'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats.default(ajv);
  ajv.addSchema(schema);
  const valid = ajv.getSchema(`${schema.$id}#/$defs/ModelLadders`);
  if (!valid(doc)) throw new Error(`model-ladders.yaml: ${ajv.errorsText(valid.errors)}`);
  const lab = (m) => {
    const p = m.split('/')[0];
    return doc.labs[p] ?? p;
  };
  const oneLab = (name, models) => {
    const seen = new Set();
    for (const m of models) {
      if (seen.has(lab(m))) throw new Error(`model-ladders.yaml: ${name} has two models of the lab ${lab(m)}`);
      seen.add(lab(m));
    }
  };
  for (const [name, t] of Object.entries(doc.tiers)) oneLab(`tier ${name}`, t.models);
  for (const [name, r] of Object.entries(doc.roles)) {
    if (!r.tier === !r.models) throw new Error(`model-ladders.yaml: role ${name} needs a tier or models, not both`);
    if (r.tier && !doc.tiers[r.tier]) throw new Error(`model-ladders.yaml: role ${name} uses no tier "${r.tier}"`);
    if (r.models) oneLab(`role ${name}`, r.models);
  }
  return doc;
}

export function bundle() {
  const root = YAML.parse(readFileSync(join(SCHEMAS, 'index.yaml'), 'utf8'));
  const defs = {};
  const files = readdirSync(SCHEMAS)
    .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
    .sort();
  for (const file of files) {
    const doc = YAML.parse(readFileSync(join(SCHEMAS, file), 'utf8'));
    const extra = Object.keys(doc).filter((k) => k !== '$defs');
    if (extra.length) throw new Error(`${file}: only "$defs" is allowed at the top, found ${extra.join(', ')}`);
    for (const [name, def] of Object.entries(doc.$defs)) {
      if (defs[name]) throw new Error(`${file}: "${name}" is already defined in another file`);
      // Generators name types from `title`; without it, they use the field name.
      defs[name] = { title: name, ...def };
    }
  }
  const schema = { ...root, $defs: defs };
  checkRefs(schema, defs);
  return schema;
}

function checkRefs(node, defs, path = '#') {
  if (Array.isArray(node)) return node.forEach((n, i) => checkRefs(n, defs, `${path}/${i}`));
  if (!node || typeof node !== 'object') return;
  if (typeof node.$ref === 'string') {
    const m = /^#\/\$defs\/([A-Za-z0-9]+)$/.exec(node.$ref);
    if (!m || !defs[m[1]]) throw new Error(`${path}: bad $ref "${node.$ref}"`);
  }
  for (const [k, v] of Object.entries(node)) checkRefs(v, defs, `${path}/${k}`);
}

const json = (value) => JSON.stringify(value, null, 2) + '\n';

// A `$ref` with a sibling `description` makes json-schema-to-typescript copy the type
// (`CountFact1`). Name the type directly and keep the description as the field's comment.
function refsAsNames(node) {
  if (Array.isArray(node)) return node.map(refsAsNames);
  if (!node || typeof node !== 'object') return node;
  const out = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, refsAsNames(v)]));
  if (typeof out.$ref === 'string' && Object.keys(out).length > 1) {
    out.tsType = out.$ref.slice('#/$defs/'.length);
    delete out.$ref;
  }
  return out;
}

async function typescript(schema) {
  // Here, not at the top: the submission checks import bundle() with only the prod packages.
  const { compile } = await import('json-schema-to-typescript');
  const input = refsAsNames(schema);
  const options = {
    additionalProperties: false,
    strictIndexSignatures: true,
    style: { singleQuote: true, printWidth: 120 },
  };
  let text = await compile(input, 'SpecRecord', { ...options, bannerComment: `/* ${HEADER} */` });
  // Types used only by name (`tsType`) are not declared by the pass above.
  const declared = (name) => new RegExp(`^export (type|interface) ${name}\\b`, 'm').test(text);
  for (const name of Object.keys(input.$defs)) {
    if (declared(name)) continue;
    const one = { ...input.$defs[name], $defs: input.$defs };
    text += await compile(one, name, { ...options, bannerComment: '', declareExternallyReferenced: false });
  }
  return text;
}

function python(bundlePath, dir) {
  const out = join(dir, 'models.py');
  execFileSync(
    'uvx',
    [
      '--from', DATAMODEL_CODEGEN, 'datamodel-codegen',
      '--input', bundlePath,
      '--input-file-type', 'jsonschema',
      '--output', out,
      '--output-model-type', 'pydantic_v2.BaseModel',
      '--base-class', 'openaudit_spec.base.SpecModel',
      '--formatters', 'black', 'isort',
      '--target-python-version', '3.11',
      '--use-annotated',
      '--use-title-as-name',
      '--field-constraints',
      '--use-standard-collections',
      '--use-union-operator',
      '--strict-nullable',
      '--enum-field-as-literal', 'all',
      '--use-schema-description',
      '--use-field-description',
      '--disable-timestamp',
      '--custom-file-header', `# ${HEADER}`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return readFileSync(out, 'utf8');
}

function swift(schema, bundlePath, dir) {
  const out = join(dir, 'OpenAuditSpec.swift');
  const bin = join(SPEC, 'node_modules', '.bin', 'quicktype');
  // One source per record: from the `SpecRecord` union, quicktype makes one struct with every field.
  const records = schema.anyOf.map((r) => ['--src', `${bundlePath}#${r.$ref.slice(1)}`]).flat();
  execFileSync(
    bin,
    [
      '--src-lang', 'schema',
      '--lang', 'swift',
      ...records,
      '--out', out,
      '--access-level', 'public',
      '--struct-or-class', 'struct',
      '--protocol', 'equatable',
      '--sendable',
      '--quiet',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return `// ${HEADER}\n\n` + readFileSync(out, 'utf8');
}

async function main() {
  const check = process.argv.includes('--check');
  const schema = bundle();
  const tmp = mkdtempSync(join(tmpdir(), 'oa-spec-'));
  try {
    const bundlePath = join(tmp, 'openaudit.schema.json');
    writeFileSync(bundlePath, json(schema));
    const files = {
      [OUTPUTS.bundle]: json(schema),
      [OUTPUTS.tsSchema]: json(schema),
      [OUTPUTS.ts]: await typescript(schema),
      [OUTPUTS.python]: python(bundlePath, tmp),
      [OUTPUTS.swift]: swift(schema, bundlePath, tmp),
      [OUTPUTS.laddersTs]: json(ladders(schema)),
      [OUTPUTS.laddersPython]: json(ladders(schema)),
    };
    const stale = [];
    for (const [path, text] of Object.entries(files)) {
      let old = null;
      try {
        old = readFileSync(path, 'utf8');
      } catch {}
      if (old === text) continue;
      stale.push(path.slice(SPEC.length));
      if (!check) writeFileSync(path, text);
    }
    if (check && stale.length) {
      console.error(`Out of date: ${stale.join(', ')}. Run "pnpm spec:generate".`);
      process.exit(1);
    }
    console.log(stale.length ? `Wrote ${stale.join(', ')}` : 'Generated files are up to date.');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
