import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { featureDependencies, qualifiedProof } from '../dist/configuration.js';
import { configurationReadiness, implementationReadiness, readinessGates } from '../dist/readiness.js';

globalThis.location = new URL('http://127.0.0.1:4173/');
const { loadGeneration, readData, syncOverdue } = await import('../dist/data-source.js');
const payload = { schema: 2, taxonomy: { featureCategories: [] } };
const revision = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const catalogue = { ...payload, revision };
const status = { status: 'synced', checkedAt: '2026-11-06T01:00:00Z', intervalMinutes: 30, catalogueRevision: revision };

test('feature dependencies include the complete chain and terminate on cycles', () => {
  const rules = { requires: { a: { features: ['b'] }, b: { features: ['c'] }, c: { features: ['a'] } } };
  assert.deepEqual(featureDependencies('a', rules), ['a', 'b', 'c']);
  assert.deepEqual(featureDependencies('standalone', rules), ['standalone']);
});

test('functional proof requires a current attestation and preserves unsupported states', () => {
  assert.equal(qualifiedProof({ state: 'proven', evidence: null, verification: 'missing' }).state, 'untested');
  assert.equal(qualifiedProof({ state: 'proven', evidence: 'Earlier VM', verification: 'historical' }).state, 'historical');
  assert.equal(qualifiedProof({ state: 'proven', evidence: 'VM', verification: 'current' }).state, 'proven');
  assert.equal(qualifiedProof({ state: 'no', evidence: 'Unsupported', verification: 'historical' }).state, 'no');
  assert.equal(qualifiedProof(undefined).recordedState, 'untested');
});

test('stale and invalid timestamps are treated as overdue consistently', () => {
  assert.equal(syncOverdue(status, Date.parse('2026-11-06T02:00:00Z')), false);
  assert.equal(syncOverdue(status, Date.parse('2026-11-06T04:00:00Z')), true);
  assert.equal(syncOverdue({ checkedAt: 'invalid' }), true);
  assert.equal(syncOverdue({ ...status, intervalMinutes: 90 }, Date.parse('2026-11-06T04:00:00Z')), false);
});

test('a supplied status loads exactly its immutable generation without rereading the pointer', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(String(url));
    return { ok: true, json: async () => catalogue };
  });
  const result = await loadGeneration(status);
  assert.equal(result.status, status);
  assert.equal(requests.length, 1);
  assert(requests[0].endsWith(`/revisions/${revision}.json`));
});

test('a failed synchronization retains access to the last validated generation', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => catalogue }));
  const result = await loadGeneration({ ...status, status: 'failed' });
  assert.equal(result.catalogue.revision, revision);
  assert.equal(result.status.status, 'failed');
});

test('catalogue loading rejects altered contents even when the revision field matches', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ ...catalogue, schema: 9 }) }));
  await assert.rejects(loadGeneration(status), /content hash mismatch/);
});

test('catalogue loading rejects mismatched revisions and invalid pointers', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ ...catalogue, revision: '0'.repeat(64) }) }));
  await assert.rejects(loadGeneration(status), /revision mismatch/);
  await assert.rejects(loadGeneration({ ...status, catalogueRevision: '../invalid' }), /not available/);
});

test('data loading reports HTTP failures', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await assert.rejects(readData('sync-status.json'), /HTTP 503/);
});

function readyImplementation() {
  const levels = ['unit', 'integration', 'ui', 'live', 'security'];
  return {
    id: 'example/kill', featureId: 'kill-switch', files: [{ path: 'kill.ts', sha: 'a'.repeat(40) }], codeFingerprint: 'b'.repeat(64),
    attribution: { status: 'indexed', contributors: [{ github: 'alice' }], files: [{ status: 'indexed' }] },
    integrity: { status: 'passed', platforms: ['linux'] },
    contract: { integration: { documentationUrl: 'https://github.com/example/app/blob/main/integration.md', entryPoints: ['kill.ts'], license: 'MIT', appShells: ['electron'] },
      tests: levels.map(id => ({ id: `${id}-test`, level: id })), reviews: [{ decision: 'approved', relationship: 'contributor', testIds: levels.map(id => `${id}-test`) }] },
    testing: levels.map(id => ({ id, scopes: [{ testId: `${id}-test`, platformIds: ['linux'], protocols: ['wireguard'], result: 'passed' }] })),
  };
}

test('readiness requires every weighted gate for the exact platform and protocol', () => {
  assert.equal(readinessGates.reduce((sum, gate) => sum + gate.weight, 0), 100);
  const item = readyImplementation();
  assert.equal(implementationReadiness(item, { platformId: 'linux', protocols: ['wireguard'], appShell: 'electron' }).score, 100);
  item.testing.find(level => level.id === 'live').scopes[0].protocols = ['openvpn'];
  assert.equal(implementationReadiness(item, { platformId: 'linux', protocols: ['wireguard'], appShell: 'electron' }).score, 85);
});

test('configuration readiness cannot average away a weak component', () => {
  const strong = readyImplementation();
  const weak = readyImplementation();
  weak.id = 'example/dns';
  weak.testing.find(level => level.id === 'security').scopes = [];
  assert.equal(configurationReadiness([strong, weak], { platformId: 'linux', protocols: ['wireguard'], appShell: 'electron' }).score, 90);
});
