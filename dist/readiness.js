export const readinessGates = [
  ['source-mapping', 'Source mapping', 10],
  ['attribution', 'Attribution', 5],
  ['integration-contract', 'Integration contract', 10],
  ['source-integrity', 'Source integrity', 10],
  ['unit', 'Unit evidence', 10],
  ['integration', 'Integration evidence', 15],
  ['ui', 'UI / end-to-end evidence', 10],
  ['live', 'Live-network evidence', 15],
  ['security', 'Security evidence', 10],
  ['independent-review', 'Non-creator review', 5],
].map(([id, label, weight]) => ({ id, label, weight }));

const definition = id => readinessGates.find(gate => gate.id === id);
const gate = (id, passed, reason) => ({ ...definition(id), passed: Boolean(passed), current: Boolean(passed), reason });

function scopeCovers(scope, platformId, protocols) {
  if (!scope.platformIds?.includes(platformId) || scope.result !== 'passed') return false;
  if (!protocols.length || !scope.protocols?.length) return true;
  return protocols.every(protocol => scope.protocols.includes(protocol));
}

function testGate(implementation, levelId, platformId, protocols) {
  const level = implementation.testing?.find(item => item.id === levelId);
  if (!level) return gate(levelId, false, 'No current report is registered.');
  const required = implementation.contract?.tests?.filter(test => test.level === levelId).map(test => test.id) || [];
  const passed = required.length
    ? required.every(testId => level.scopes.some(scope => scope.testId === testId && scopeCovers(scope, platformId, protocols)))
    : level.scopes?.some(scope => scopeCovers(scope, platformId, protocols));
  return gate(levelId, passed, passed ? 'Current evidence covers this exact configuration.' : 'Current evidence does not cover this exact configuration.');
}

export function implementationReadiness(implementation, { platformId, protocols, appShell }) {
  const mapped = implementation.files?.length > 0 && implementation.files.every(file => /^[a-f0-9]{40}$/.test(file.sha || '')) && /^[a-f0-9]{64}$/.test(implementation.codeFingerprint || '');
  const attribution = implementation.attribution;
  const attributed = mapped && attribution?.status === 'indexed' && attribution.contributors?.length > 0 && attribution.files?.length === implementation.files.length && attribution.files.every(file => file.status === 'indexed');
  const contract = implementation.contract;
  const contracted = Boolean(contract?.integration?.documentationUrl && contract.integration.entryPoints?.length && contract.integration.license && contract.integration.appShells?.includes(appShell));
  const integrity = implementation.integrity?.status === 'passed' && implementation.integrity.platforms?.includes(platformId);
  const gates = [
    gate('source-mapping', mapped, mapped ? 'Mapped files are pinned by hash.' : 'Hash-pinned source mapping is missing.'),
    gate('attribution', attributed, attributed ? 'Mapped-file attribution is complete.' : 'Mapped-file attribution is incomplete.'),
    gate('integration-contract', contracted, contracted ? 'A compatible integration contract is registered.' : 'A compatible integration contract is missing.'),
    gate('source-integrity', integrity, integrity ? 'Composed source integrity passed for this platform.' : 'Current source-integrity proof is missing for this platform.'),
    ...['unit', 'integration', 'ui', 'live', 'security'].map(level => testGate(implementation, level, platformId, protocols)),
  ];
  const requiredReviewTests = contract?.tests?.map(test => test.id) || [];
  const reviews = contract?.reviews?.filter(review => review.decision === 'approved' && review.relationship !== 'creator') || [];
  const reviewed = reviews.length > 0 && requiredReviewTests.every(testId => reviews.some(review => review.testIds?.includes(testId)));
  gates.push(gate('independent-review', reviewed, reviewed ? 'A non-creator approval covers every declared test.' : 'A complete non-creator approval is missing.'));
  const score = gates.filter(item => item.passed).reduce((sum, item) => sum + item.weight, 0);
  return { score, status: score === 100 ? 'ready' : score > 0 ? 'incomplete' : 'blocked', gates, missing: gates.filter(item => !item.passed).map(item => item.id) };
}

export function configurationReadiness(implementations, options) {
  if (!implementations.length || implementations.some(item => !item)) return { score: 0, status: 'blocked', components: [], missing: ['implementation-selection'] };
  const components = implementations.map(item => ({ implementationId: item.id, featureId: item.featureId, ...implementationReadiness(item, options) }));
  const score = Math.min(...components.map(item => item.score));
  return { score, status: score === 100 ? 'ready' : score > 0 ? 'incomplete' : 'blocked', components, missing: [...new Set(components.flatMap(item => item.missing))] };
}
