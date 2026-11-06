# Sentinel contributor contract v1

Follow this structure once. Register the repository URL once. The platform then imports the repository's feature definitions, creators, source files, integration documentation, CI evidence and commit reviews during each synchronization.

## Start

Copy this starter into a repository. It includes a working DNS IPv4 input-validation example to demonstrate the evidence pipeline. Replace the example with your implementation, creator handles, documentation and assertions before registering a production feature. Existing repositories can copy the sentinel directory and adapt the workflow and test output.

Use Node 22 or later. Run `node sentinel/validate.mjs`, then run your declared test commands. Commit the manifest, implementation, test code, creator declarations, documentation and workflow together. Build outputs go under the ignored sentinel-output directory.

```text
sentinel/manifest.json         implementations and required assertions
sentinel/contract.mjs          portable validator and contract hashing
sentinel/validate.mjs          local validation command
sentinel/record-evidence.mjs   CI evidence recorder
src/                         feature code
tests/                       tests producing assertion results
docs/integration.md          instructions for the integrating agent
AUTHORS.md                   creator declarations
.github/workflows/           contributor-owned test execution
```

The download also includes JSON Schemas for the manifest, evidence report and review, plus vocabulary.json containing the platform's accepted feature, platform and protocol IDs. Multiple implementations and creators can share one repository. Two creators' kill switches get different local IDs and independent histories. Global IDs are assigned as source-id/local-implementation-id.

## Declare an implementation

In sentinel/manifest.json, provide a stable ID, featureId from vocabulary.json, title, source paths, supported platform IDs, dependency source IDs, creator declarations and integration instructions. Define app shells, entry points and license. Dependency source IDs must already be registered with the platform. Use an empty tests array when tests are pending.

Each test has a repository-wide unique ID, one of unit/integration/ui/live/security, workflow path, exact GitHub job name, reproduction command, platform IDs, protocol IDs and assertions. An empty protocols array means protocol-independent assertions. Every assertion must produce one result for every declared platform/protocol combination. Split jobs into separate test declarations when their scopes differ. Declare the actual environment used by the job.

## Produce evidence automatically

Your test adapter writes results.json with dependencies and cases. Each case has assertionId, platformId, protocol (or null), and result (passed, failed or skipped). The dependency map contains the exact commit SHAs of dependencies checked out by that job. The starter shows a real assertion-based adapter.

After the test step, run the recorder with an always condition so failures remain visible.

```sh
node sentinel/record-evidence.mjs TEST_ID sentinel-output/results.json sentinel-output/artifact
```

Upload the directory as `sentinel-evidence-TEST_ID-RUN_ATTEMPT`. The recorder reads the repository, source commit, run ID and attempt from GitHub's environment, hashes the implementation contract and raw results, and records the runner environment. For additional evidence such as logs or captures, include files in the artifact and their SHA-256 hashes in report.json's evidence array. Scrub secrets before upload. Limits are 10 MiB compressed and uncompressed, 200 entries, and 1 MiB for report.json.

The importer checks GitHub repository, workflow, job, commit and attempt against the artifact report, validates all declared assertions, and recomputes evidence hashes. A failed job remains failed. Missing or skipped assertions produce incomplete coverage. Missing, invalid or expired artifacts remain unverified. Dependency or source changes make earlier results historical. Workflow scope declarations and assertion adequacy remain visible for review.

The importer examines the latest 20 runs per declared workflow on the registered branch. Push, manual, scheduled and repository-dispatch runs from the registered repository are eligible. A completed rerun uses its new attempt number. Keep artifacts available while relying on their evidence. The starter retains them for 90 days. Run history beyond the discovery window remains in GitHub; the website states the window explicitly.

## Record a review

Review the exact commit and its test evidence. Compute the implementation hash from the manifest checked out at that commit.

```sh
node --input-type=module -e "import fs from 'node:fs'; import {contractHash} from './sentinel/contract.mjs'; const m=JSON.parse(fs.readFileSync('sentinel/manifest.json')); console.log(contractHash(m.implementations[0]));"
```

Post a GitHub commit comment on the reviewed SHA containing this fenced block. Replace the example values with the actual findings and hash.

````text
```sentinel-review
{
  "schema": 1,
  "implementationId": "dns-input-validation",
  "contractHash": "FULL_64_CHARACTER_HASH",
  "decision": "approved",
  "summary": "Describe what was inspected and the conclusion",
  "testIds": ["dns-unit"],
  "findings": []
}
```
````

Use changes-requested when issues remain. The importer takes reviewer identity, commit and timestamp from GitHub. It shows each review and whether the reviewer is a declared creator. Approval is attributed to that reviewer. Test execution and review decisions have separate displays. Only reviews attached to the indexed commit with a matching contract hash appear as current. The first 100 commit comments are inspected; reaching the limit displays incomplete review discovery.

## Register the repository

The platform maintainer runs this command in sentinel-builder-sync using its GitHub account.

```sh
npm run source:add -- https://github.com/OWNER/REPOSITORY
```

An optional final argument selects the branch. Registration validates the manifest and referenced files before updating config/sources.json. Run npm test and npm run sync, then commit and push that configuration. Repeating the registration is rejected without changing it. Private repos need access for the sync account. External repositories need no platform token in their workflows. Scheduled synchronization picks up completed CI runs and reviews, normally on the next half-hourly check; GitHub can delay schedules.

The public catalogue contains declarations, test specifications, revision metadata, reviewer handles, findings, assertion counts, evidence hashes and links. Raw evidence stays in the source repository's GitHub artifacts with its original access controls. Invalid manifests appear on Sources with an error; their implementations are withheld until corrected.

## Integration into an app

The importer brings the implementation and its evidence into the feature library. The consuming agent follows the versioned integration documentation and entry points, pins the selected implementation and dependencies, and runs integration tests against the host app. Evidence from that integration must identify those exact revisions. The current reference-app composer assembles its four configured clients; selecting arbitrary component implementations for automatic source assembly requires an adapter for their declared interfaces.
