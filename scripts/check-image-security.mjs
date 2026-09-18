import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const matches = (report.Results || []).flatMap(result => result.Vulnerabilities || []);
const blocking = matches.filter(item => ['HIGH', 'CRITICAL', 'UNKNOWN'].includes(item.Severity) && item.FixedVersion);
const summary = { totalMatches: matches.length, distinctAdvisories: new Set(matches.map(item => item.VulnerabilityID)).size, distinctCVEs: new Set(matches.filter(item => item.VulnerabilityID.startsWith('CVE-')).map(item => item.VulnerabilityID)).size, fixableHighCriticalOrUnrated: blocking.length };
console.log(JSON.stringify(summary));
for (const item of blocking) console.error(`${item.VulnerabilityID}: ${item.PkgName} ${item.InstalledVersion} -> ${item.FixedVersion}`);
if (blocking.length) process.exitCode = 1;
