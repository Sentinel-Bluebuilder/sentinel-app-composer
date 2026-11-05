const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const base = local ? new URL('./data/', location.href) : new URL('https://sentinel-bluebuilder.github.io/sentinel-app-composer/data/');

export async function readData(file) {
  const response = await fetch(new URL(file, base), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Source data returned HTTP ${response.status}`);
  return response.json();
}

export async function loadGeneration() {
  const status = await readData('sync-status.json');
  if (!/^[a-f0-9]{64}$/.test(status.catalogueRevision || '')) throw new Error('A validated catalogue is not available yet');
  const catalogue = await readData(`revisions/${status.catalogueRevision}.json`);
  if (catalogue.revision !== status.catalogueRevision) throw new Error('Catalogue revision mismatch');
  return { status, catalogue, snapshotUrl: new URL(`revisions/${catalogue.revision}.json`, base).href };
}
