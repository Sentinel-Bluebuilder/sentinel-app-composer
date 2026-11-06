import crypto from 'node:crypto';

const text = { type: 'string', minLength: 1, maxLength: 4000 };
const id = { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]{0,79}$' };
const scopeId = { type: 'string', pattern: '^[a-z0-9][a-z0-9._-]{0,79}$' };
const sha = { type: 'string', pattern: '^[a-f0-9]{40}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const file = { type: 'string', pattern: '^(?!/)(?!.*(?:^|/)\\.\\.?(?:/|$))[A-Za-z0-9_.@/-]+$' };
const list = (items, minItems = 0) => ({ type: 'array', items, minItems, maxItems: 200, uniqueItems: true });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const integer = { type: 'integer', minimum: 1 };
const github = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$' };
const testSpec = object({
  id, level: { enum: ['unit', 'integration', 'ui', 'live', 'security'] },
  workflowPath: { type: 'string', pattern: '^\\.github/workflows/[A-Za-z0-9_.-]+\\.ya?ml$' },
  jobName: text, command: text, platformIds: list(scopeId, 1), protocols: list(scopeId),
  assertions: list(object({ id, description: text }), 1),
});
const implementation = object({
  id, featureId: id, title: text, paths: list(file, 1), platforms: list(scopeId, 1),
  dependencies: list({ type: 'string', pattern: '^[a-z0-9][a-z0-9._-]*$' }),
  creators: list(object({ github, declarationPath: file }), 1),
  integration: object({ documentation: file, appShells: list(id, 1), entryPoints: list(file, 1), license: text }),
  tests: list(testSpec),
});
export const manifestSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...object({ schema: { const: 1 }, implementations: list(implementation, 1) }) };
export const evidenceSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', ...object({
  schema: { const: 1 }, implementationId: id, testId: id, contractHash: hash,
  repository: { type: 'string', pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' },
  revision: sha, runId: integer, runAttempt: integer,
  dependencies: { type: 'object', additionalProperties: sha },
  environment: object({ os: text, architecture: text, runner: text }),
  cases: list(object({ assertionId: id, platformId: scopeId, protocol: { anyOf: [scopeId, { const: null }] },
    result: { enum: ['passed', 'failed', 'skipped'] } }), 1),
  evidence: list(object({ path: file, sha256: hash }), 1),
}) };
export const reviewSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', ...object({
  schema: { const: 1 }, implementationId: id, contractHash: hash,
  decision: { enum: ['approved', 'changes-requested'] }, summary: text,
  testIds: list(id), findings: list(text),
}) };

// The published schemas use this deliberately small JSON Schema vocabulary.
export function validate(value, schema, location = '$') {
  const fail = () => { throw new Error(`Invalid contract value at ${location}`); };
  if (Object.hasOwn(schema, 'const') && value !== schema.const) fail();
  if (schema.enum && !schema.enum.includes(value)) fail();
  if (schema.anyOf && !schema.anyOf.some(candidate => {
    try { validate(value, candidate, location); return true; } catch { return false; }
  })) fail();
  if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? 4000) ||
      (schema.pattern && !new RegExp(schema.pattern).test(value))) fail();
  }
  if (schema.type === 'integer' && (!Number.isSafeInteger(value) || value < schema.minimum)) fail();
  if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) fail();
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) fail();
    value.forEach((item, index) => validate(item, schema.items, `${location}[${index}]`));
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail();
    for (const [key, child] of Object.entries(value)) {
      const rule = schema.properties?.[key];
      if (rule) validate(child, rule, `${location}.${key}`);
      else if (schema.additionalProperties === false) fail();
      else if (typeof schema.additionalProperties === 'object') validate(child, schema.additionalProperties, `${location}.${key}`);
    }
  }
  return value;
}

export function contractHash(value) {
  const canonical = item => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function validateManifest(manifest, { files, featureIds, platformIds, protocolIds, sourceIds } = {}) {
  validate(manifest, manifestSchema);
  const implementationIds = new Set();
  const testIds = new Set();
  for (const item of manifest.implementations) {
    if (implementationIds.has(item.id)) throw new Error(`Duplicate implementation ${item.id}`);
    implementationIds.add(item.id);
    if (featureIds && !featureIds.includes(item.featureId)) throw new Error(`Unknown feature ${item.featureId}`);
    if (platformIds && item.platforms.some(value => !platformIds.includes(value))) throw new Error('Unknown implementation platform');
    if (sourceIds && item.dependencies.some(value => !sourceIds.includes(value))) throw new Error('Register implementation dependencies first');
    const requiredFiles = [...item.paths, ...item.integration.entryPoints, item.integration.documentation, ...item.creators.map(creator => creator.declarationPath)];
    for (const spec of item.tests) {
      if (testIds.has(spec.id)) throw new Error(`Test IDs must be unique across the repository: ${spec.id}`);
      testIds.add(spec.id);
      if (testIds.size > 200) throw new Error('A repository may declare at most 200 tests');
      if (spec.platformIds.some(value => !item.platforms.includes(value))) throw new Error('Test platform exceeds implementation scope');
      if (protocolIds && spec.protocols.some(value => !protocolIds.includes(value))) throw new Error('Unknown test protocol');
      if (new Set(spec.assertions.map(assertion => assertion.id)).size !== spec.assertions.length) throw new Error('Duplicate assertion ID');
      requiredFiles.push(spec.workflowPath);
    }
    if (files && requiredFiles.some(value => !files.includes(value))) throw new Error('A declared code, documentation, attribution or workflow file is missing');
  }
  return manifest;
}

export function verifyEvidence(report, item, spec, run, fileHashes) {
  validate(report, evidenceSchema);
  if (report.implementationId !== item.id || report.testId !== spec.id || report.contractHash !== contractHash(item) ||
    report.repository.toLowerCase() !== run.repository.full_name.toLowerCase() || report.revision !== run.head_sha ||
    report.runId !== run.id || report.runAttempt !== run.run_attempt) throw new Error('Evidence does not match its contract or workflow execution');
  if (Object.keys(report.dependencies).length !== item.dependencies.length || item.dependencies.some(id => !report.dependencies[id])) throw new Error('Evidence dependency pins are incomplete');
  if (report.evidence.some(file => fileHashes[file.path] !== file.sha256 || file.path === 'report.json')) throw new Error('Evidence file hash mismatch');
  const expected = new Set(spec.assertions.flatMap(assertion => spec.platformIds.flatMap(platform =>
    (spec.protocols.length ? spec.protocols : [null]).map(protocol => JSON.stringify([assertion.id, platform, protocol])))));
  const seen = new Set();
  for (const result of report.cases) {
    const key = JSON.stringify([result.assertionId, result.platformId, result.protocol]);
    if (!expected.has(key) || seen.has(key)) throw new Error('Unexpected or duplicate assertion scope');
    seen.add(key);
  }
  const counts = Object.fromEntries(['passed', 'failed', 'skipped'].map(result => [result, report.cases.filter(item => item.result === result).length]));
  counts.missing = expected.size - seen.size;
  return { result: counts.failed ? 'failed' : counts.skipped || counts.missing ? 'incomplete' : 'passed', counts };
}
