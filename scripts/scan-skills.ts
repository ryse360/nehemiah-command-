export {};
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const TARGET = '.claude/skills';
const BASELINE = 'docs/security/skillspector-baseline.yaml';
const OUTPUT = 'docs/security/skillspector-scan-result.json';

if (!existsSync('docs/security')) mkdirSync('docs/security', { recursive: true });

if (process.argv.includes('--accept')) {
  const accept = spawnSync(
    'skillspector',
    [
      'baseline',
      TARGET,
      '--no-llm',
      '--reason',
      'UNREVIEWED — describe why this finding is a false positive or accepted risk before committing.',
      '-o',
      BASELINE,
    ],
    { stdio: 'inherit' },
  );
  if (accept.error) {
    console.error(`SkillSpector CLI not found: ${accept.error.message}`);
    console.error('Install: uv tool install git+https://github.com/NVIDIA/skillspector.git');
    process.exit(2);
  }
  console.log(
    `\nRewrote ${BASELINE}. Every 'reason' field is a placeholder — replace each one with ` +
      `an actual review before committing. Unreviewed reasons must never be merged.`,
  );
  process.exit(accept.status ?? 0);
}

const result = spawnSync(
  'skillspector',
  ['scan', TARGET, '--no-llm', '--baseline', BASELINE, '--show-suppressed', '--format', 'json', '--output', OUTPUT],
  { encoding: 'utf8' },
);

if (result.error) {
  console.error(`SkillSpector CLI not found: ${result.error.message}`);
  console.error('Install: uv tool install git+https://github.com/NVIDIA/skillspector.git');
  process.exit(2);
}

if (result.stderr) process.stderr.write(result.stderr);

if (!existsSync(OUTPUT) || result.status === 2) {
  console.error('SkillSpector could not complete the scan.');
  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(2);
}

const report = JSON.parse(readFileSync(OUTPUT, 'utf8'));
const { score, severity, recommendation } = report.risk_assessment;

console.log(`\nSkillSpector scan: ${TARGET}`);
console.log(`Score: ${score}/100 (${severity}) — ${recommendation}`);
console.log(`Suppressed by baseline: ${report.suppressed_count ?? 0} (reviewed, see ${BASELINE})`);

// The gate is driven by the baseline, not SkillSpector's own aggregate-score
// exit code: any finding not already reviewed into the baseline blocks CI,
// even at MEDIUM severity, because it means the vendored skill tree changed
// in a way nobody has looked at yet.
const issues = report.issues ?? [];
if (issues.length > 0) {
  console.error(`\n${issues.length} unreviewed finding(s):`);
  for (const issue of issues) {
    console.error(`  [${issue.severity}] ${issue.id} ${issue.category} — ${issue.location.file}:${issue.location.start_line ?? '?'}`);
    console.error(`    ${issue.explanation}`);
  }
  console.error(
    `\nEither fix the flagged content, or if this is a reviewed false positive, ` +
      `regenerate the baseline (npm run security:scan-skills -- --accept) and document why in docs/security/skill-vetting.md.`,
  );
  process.exit(1);
}

process.exit(0);
