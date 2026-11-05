import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';

for (const filename of fs.readdirSync('dist').filter(name => /\.(html|js|css)$/.test(name))) {
  const contents = fs.readFileSync(`dist/${filename}`, 'utf8');
  const references = [
    ...contents.matchAll(/(?:src|href)=["'](\.\/[^"'#$?]+)["']/g),
    ...contents.matchAll(/from\s+["'](\.\/[^"']+)["']/g),
    ...contents.matchAll(/url\(["']?(\.\/[^"')]+)["']?\)/g),
  ];
  for (const [, reference] of references) assert(fs.existsSync(path.join('dist', reference)), `${filename} references missing ${reference}`);
  if (filename.endsWith('.html')) {
    const ids = [...contents.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${filename} has duplicate element IDs`);
  }
}

const status = JSON.parse(fs.readFileSync('dist/data/sync-status.json', 'utf8'));
assert.match(status.catalogueRevision, /^[a-f0-9]{64}$/);
const catalogue = JSON.parse(fs.readFileSync(`dist/data/revisions/${status.catalogueRevision}.json`, 'utf8'));
assert.equal(catalogue.revision, status.catalogueRevision);
const { revision, ...payload } = catalogue;
assert.equal(crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'), revision);
const features = catalogue.taxonomy.featureCategories.flatMap(category => category.features.map(feature => feature.id));
assert.equal(new Set(features).size, features.length);
for (const id of catalogue.rules.core) assert(features.includes(id));
for (const [id, rule] of Object.entries(catalogue.rules.requires)) {
  assert(features.includes(id));
  for (const dependency of rule.features) assert(features.includes(dependency));
}
for (const feature of Object.values(catalogue.matrix.features)) {
  for (const platform of catalogue.taxonomy.platformVariants) {
    assert(feature.cells[platform.id]);
    assert(['current', 'historical', 'missing'].includes(feature.cells[platform.id].verification));
  }
}
if (catalogue.library) {
  const ids = new Set();
  for (const implementation of catalogue.library.implementations) {
    assert(!ids.has(implementation.id));
    ids.add(implementation.id);
    assert(features.includes(implementation.featureId));
    assert.match(implementation.revision, /^[a-f0-9]{40}$/);
    assert.equal(implementation.testing.length, catalogue.library.testingLevels.length);
    assert(Array.isArray(implementation.creators));
    assert(Array.isArray(implementation.attribution.contributors));
    for (const report of implementation.reports) assert(report.url.startsWith('https://github.com/'));
  }
}
console.log(`Validated ${features.length} features and catalogue ${catalogue.revision.slice(0, 12)}.`);
