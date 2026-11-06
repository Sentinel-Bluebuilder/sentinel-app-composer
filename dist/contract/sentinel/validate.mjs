import fs from 'node:fs';
import path from 'node:path';
import { validateManifest } from './contract.mjs';

const root = process.cwd();
const manifest = validateManifest(JSON.parse(fs.readFileSync('sentinel/manifest.json', 'utf8')));
for (const item of manifest.implementations) {
  const files = [...item.paths, ...item.integration.entryPoints, item.integration.documentation,
    ...item.creators.map(creator => creator.declarationPath), ...item.tests.map(test => test.workflowPath)];
  for (const file of files) {
    const resolved = fs.realpathSync(path.resolve(root, file));
    if (!resolved.startsWith(fs.realpathSync(root) + path.sep) || !fs.statSync(resolved).isFile()) throw new Error(`Invalid file ${file}`);
  }
}
console.log(`Validated ${manifest.implementations.length} implementation contracts.`);
