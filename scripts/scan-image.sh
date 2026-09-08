#!/usr/bin/env bash
set -euo pipefail
umask 077

# Official Trivy 0.74.0 Linux amd64 archive, verified against release checksums.
scan_dir="${RUNNER_TEMP:-/tmp}/landing-archive-scanner"
mkdir -p "$scan_dir"
curl --fail --location --retry 3 --output "$scan_dir/trivy.tar.gz" \
  https://github.com/aquasecurity/trivy/releases/download/v0.74.0/trivy_0.74.0_Linux-64bit.tar.gz
printf '%s  %s\n' 2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a "$scan_dir/trivy.tar.gz" | sha256sum --check --status
tar -xzf "$scan_dir/trivy.tar.gz" -C "$scan_dir" trivy
"$scan_dir/trivy" image --image-src docker --scanners vuln --timeout 10m \
  --format json --output image-vulnerabilities.json "$PREVIEW_IMAGE"
node scripts/check-image-security.mjs image-vulnerabilities.json

# Never print or upload secret values, including when a gate fails.
"$scan_dir/trivy" image --image-src docker --scanners secret --image-config-scanners secret \
  --timeout 10m --format json --output "$scan_dir/secrets.json" "$PREVIEW_IMAGE"
node --input-type=module - "$scan_dir/secrets.json" <<'JS'
import { readFileSync, rmSync } from 'node:fs';
const file = process.argv[2];
const report = JSON.parse(readFileSync(file, 'utf8'));
rmSync(file);
const count = (report.Results || []).reduce((total, result) => total + (result.Secrets || []).length, 0);
console.log(`Image secret matches: ${count}`);
if (count) process.exitCode = 1;
JS
