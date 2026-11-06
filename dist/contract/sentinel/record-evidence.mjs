import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { validateManifest, contractHash, verifyEvidence } from './contract.mjs';

const [testId, resultsFile, outputDirectory] = process.argv.slice(2);
if (!testId || !resultsFile || !outputDirectory) throw new Error('Use node sentinel/record-evidence.mjs TEST_ID RESULTS_JSON OUTPUT_DIRECTORY');
const manifest = validateManifest(JSON.parse(fs.readFileSync('sentinel/manifest.json', 'utf8')));
const item = manifest.implementations.find(item => item.tests.some(spec => spec.id === testId));
if (!item) throw new Error('Unknown test ID');
const spec = item.tests.find(spec => spec.id === testId);
const raw = fs.readFileSync(resultsFile);
const results = JSON.parse(raw);
const digest = crypto.createHash('sha256').update(raw).digest('hex');
const report = {
  schema: 1, implementationId: item.id, testId, contractHash: contractHash(item),
  repository: process.env.GITHUB_REPOSITORY, revision: process.env.GITHUB_SHA,
  runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
  dependencies: results.dependencies || {},
  environment: { os: `${os.type()} ${os.release()}`, architecture: os.arch(), runner: process.env.RUNNER_NAME || 'unknown' },
  cases: results.cases, evidence: [{ path: 'results.json', sha256: digest }],
};
verifyEvidence(report, item, spec, { id: report.runId, run_attempt: report.runAttempt, head_sha: report.revision,
  repository: { full_name: report.repository } }, { 'results.json': digest });
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'results.json'), raw);
fs.writeFileSync(path.join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Recorded ${testId}. Upload ${outputDirectory} as sentinel-evidence-${testId}-${report.runAttempt}.`);
