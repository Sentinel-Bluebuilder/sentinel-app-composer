import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validResolverAddress } from '../src/dns-input.mjs';

const cases = [];
function check(assertionId, test) {
  let result = 'passed';
  try { test(); } catch (error) { result = 'failed'; console.error(error.message); }
  cases.push({ assertionId, platformId: 'ubuntu-24.04', protocol: null, result });
}
check('accept-valid-ipv4', () => assert.equal(validResolverAddress('1.1.1.1'), true));
check('reject-invalid-ipv4', () => {
  for (const value of ['256.1.1.1', '1.1.1', '1.1.1.1.extra', '01.1.1.1', '', null, 123]) assert.equal(validResolverAddress(value), false);
});
fs.mkdirSync('sentinel-output', { recursive: true });
fs.writeFileSync('sentinel-output/results.json', JSON.stringify({ dependencies: {}, cases }, null, 2) + '\n');
process.exitCode = cases.some(item => item.result === 'failed') ? 1 : 0;
