export function featureDependencies(featureId, rules) {
  const selected = new Set([featureId]);
  for (const id of selected) {
    for (const dependency of rules.requires?.[id]?.features || []) selected.add(dependency);
  }
  return [...selected];
}

export function qualifiedProof(cell) {
  if (!cell) return { state: 'untested', recordedState: 'untested', evidence: null };
  let state = 'untested';
  if (cell.evidence) state = 'historical';
  if (cell.verification === 'current' || cell.state === 'no') state = cell.state;
  return { ...cell, recordedState: cell.state, state };
}
