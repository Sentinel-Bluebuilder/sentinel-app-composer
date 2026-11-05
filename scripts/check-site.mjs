import fs from 'node:fs';
import assert from 'node:assert/strict';

const status = JSON.parse(fs.readFileSync('dist/data/sync-status.json', 'utf8'));
assert.match(status.catalogueRevision, /^[a-f0-9]{64}$/);
const catalogue = JSON.parse(fs.readFileSync(`dist/data/revisions/${status.catalogueRevision}.json`, 'utf8'));
assert.equal(catalogue.revision, status.catalogueRevision);
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
console.log(`Validated ${features.length} features and catalogue ${catalogue.revision.slice(0, 12)}.`);
