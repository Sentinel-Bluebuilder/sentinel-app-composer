const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const base = local ? new URL('./data/', location.href) : new URL('https://sentinel-bluebuilder.github.io/sentinel-app-composer/data/');

export async function readData(file) {
  const response = await fetch(new URL(file, base), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Source data returned HTTP ${response.status}`);
  return response.json();
}

export function syncOverdue(status, now = Date.now()) {
  const checkedAt = Date.parse(status.checkedAt);
  const interval = Number.isFinite(status.intervalMinutes) ? status.intervalMinutes : 30;
  return !Number.isFinite(checkedAt) || now - checkedAt > Math.max(120, interval * 3) * 60000;
}

export async function loadGeneration(suppliedStatus) {
  const status = suppliedStatus ?? await readData('sync-status.json');
  if (!/^[a-f0-9]{64}$/.test(status.catalogueRevision || '')) throw new Error('A validated catalogue is not available yet');
  const catalogue = await readData(`revisions/${status.catalogueRevision}.json`);
  if (catalogue.revision !== status.catalogueRevision) throw new Error('Catalogue revision mismatch');
  const { revision, ...payload } = catalogue;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== revision) throw new Error('Catalogue content hash mismatch');
  return { status, catalogue, snapshotUrl: new URL(`revisions/${catalogue.revision}.json`, base).href };
}
