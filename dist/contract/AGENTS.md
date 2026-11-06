# Sentinel contribution contract v1

Every agent contributing a feature must follow README.md and sentinel/manifest.json.

## Implementation agent

Give each implementation a stable local ID. Use the platform's published feature, platform and protocol vocabulary. Map real source files and entry points. Declare every creator with an attribution file. Document installation, interfaces, compatibility, license, dependencies, conflicts and rollback. Update the manifest whenever the code contract changes.

## Testing agent

Define falsifiable assertions for each claimed scope. Run the tests on the declared OS and protocol. Derive results from actual assertions. Include failures, skipped cases, missing coverage and exact dependency commit SHAs. Produce report.json using sentinel/record-evidence.mjs and upload its evidence directory through GitHub Actions, including failed runs. Preserve source SHA, run ID and run attempt. Never manufacture a passing case from a successful shell command alone. Run tunnel and firewall tests on disposable environments.

## Review agent

Inspect the implementation, test code and evidence at the exact commit. Identify gaps and limitations. Record a structured sentinel-review comment on that GitHub commit using the format in README.md. Authenticate as the account doing the review. Include the implementation contract hash, test IDs inspected, findings and decision. Re-review after code or contract changes. Creator reviews remain visibly attributed to the creator.

## Handoff

Run node sentinel/validate.mjs. Ensure declared files exist, CI artifacts use the required naming convention, and evidence contains no credentials or personal contact information. Send the repository URL and branch to the platform maintainer. After registration, the sync imports future revisions automatically. Platform registration grants read access to metadata and artifacts. Keep source execution inside the contributor's CI environment.
