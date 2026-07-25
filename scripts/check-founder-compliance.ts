import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Founder compliance gate for the living interface.
//
// Turns Founder-locked decisions and the Orbital Filament System acceptance
// criteria into machine-enforced checks. Runs in CI on every push and
// locally via `npm run governance:organism`. A red gate blocks the branch —
// evidence before claims, always.

const root = process.cwd();

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

function read(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Dependency freeze — no unapproved rendering/animation dependencies.
//
// The freeze was deliberately reopened by Founder decision to adopt a full
// platform stack for the node-graph artifact and surrounding interface.
// Sanctioned additions, each with trade-offs stated to the Founder before
// install:
//   2026-07-25a: 3d-force-graph, r3f-forcegraph (force-graph engine + R3F
//     wrapper); @react-three/postprocessing + postprocessing (bloom — was
//     banned by name, override accepted); react-glass-ui (glass cards).
//   2026-07-25b: ai (Vercel AI SDK); motion (framer-motion's successor — the
//     animation lib, was banned by name, override accepted); @theatre/core +
//     @theatre/studio (Theatre.js — was in the ORIGINAL locked prohibition,
//     override accepted); promptfoo (dev, LLM evals).
// The denylist below still catches animation/particle libs the Founder has
// NOT sanctioned, so the freeze stays meaningful for everything unapproved.
const pkg = JSON.parse(read('package.json')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const forbiddenDeps = [
  'gsap',
  'tsparticles',
  'anime.js',
  'animejs',
];
const foundForbidden = forbiddenDeps.filter((dep) => dep in allDeps);
check(
  'dependency freeze holds',
  foundForbidden.length === 0,
  foundForbidden.length === 0
    ? 'no unapproved rendering/animation dependencies (force-graph + bloom + glass sanctioned 2026-07-25)'
    : `forbidden: ${foundForbidden.join(', ')}`,
);

// ---------------------------------------------------------------------------
// 2. Palette is locked to the reference-derived tokens.
const palette = read('src/nehemiah/organism-palette.ts');
const requiredTokens: Array<[string, string]> = [
  ['background', '#F4EBE2'],
  ['shellWhite', '#FDFEF4'],
  ['coreUmber', '#443529'],
  ['goldMid', '#D9B784'],
  ['lavenderMid', '#A694BF'],
  ['contactShadow', 'rgba(68, 53, 41, 0.15)'],
];
const missingTokens = requiredTokens.filter(([, value]) => !palette.includes(value));
check(
  'reference palette tokens locked',
  missingTokens.length === 0,
  missingTokens.length === 0
    ? 'all reference-derived tokens verbatim'
    : `missing: ${missingTokens.map(([token]) => token).join(', ')}`,
);

// ---------------------------------------------------------------------------
// 3. Leva is confined to the laboratory shell.
const engineFiles = [
  'src/components/organism/organism-engine.tsx',
  'src/components/organism/luminous-core.tsx',
];
const engineWithLeva = engineFiles.filter((file) => /from ['"]leva['"]/.test(read(file)));
check(
  'Leva confined to the lab shell',
  engineWithLeva.length === 0 &&
    /from ['"]leva['"]/.test(read('src/components/organism/organism-lab.tsx')),
  engineWithLeva.length === 0
    ? 'engine layers free of dev-tool imports'
    : `leva leaked into: ${engineWithLeva.join(', ')}`,
);

// ---------------------------------------------------------------------------
// 4. Production interface stays untouched by the laboratory.
const productionPage = read('src/app/page.tsx');
const labLeaks = ['organism-lab', 'organism-engine', 'luminous-core', 'organism-field'].filter(
  (target) => productionPage.includes(target),
);
check(
  'production interface isolated from the lab',
  labLeaks.length === 0,
  labLeaks.length === 0 ? 'src/app/page.tsx has no lab imports' : `leaks: ${labLeaks.join(', ')}`,
);

// ---------------------------------------------------------------------------
// 5. Prohibited dashboard language never returns to the lab.
const prohibitedStrings = [
  'Founder Agenda',
  'Active Projects',
  'Live Context',
  'Personal Standard',
];
const labFiles = [
  'src/components/organism/organism-lab.tsx',
  'src/app/lab/organism/page.tsx',
];
const prohibitedHits = labFiles.flatMap((file) =>
  prohibitedStrings.filter((s) => read(file).includes(s)).map((s) => `${file}: "${s}"`),
);
check(
  'no dashboard language in the lab',
  prohibitedHits.length === 0,
  prohibitedHits.length === 0 ? 'lab copy stays quiet' : prohibitedHits.join('; '),
);

// ---------------------------------------------------------------------------
// 6. Approved adaptive sizing — Founder-approved presence, no regression.
const labCss = read('src/components/organism/organism-lab.module.css');
check(
  'approved adaptive sizing in force',
  labCss.includes('58vh') && labCss.includes('760px') && labCss.includes('100dvh - 22rem'),
  'stage clamp targets 58vh with the approved 760px ceiling and no-scroll guard',
);

// ---------------------------------------------------------------------------
// 7. Tense-arc labels locked, WITNESSED closes past-tense.
const contract = read('src/nehemiah/organism-lab-contract.ts');
const requiredLabels = ['BREATHING', 'ATTENDING', 'SURFACING', 'WEIGHING', 'ENACTING', 'WITNESSED'];
const missingLabels = requiredLabels.filter((label) => !contract.includes(`'${label}'`));
check(
  'lifecycle labels locked',
  missingLabels.length === 0,
  missingLabels.length === 0 ? 'six tense-arc labels verbatim' : `missing: ${missingLabels.join(', ')}`,
);

// ---------------------------------------------------------------------------
// 8. The command surface never becomes functionally active in the lab.
check(
  'command surface stays inert',
  !/active:\s*true/.test(contract),
  'no lab command-surface entry declares active: true',
);

// ---------------------------------------------------------------------------
// 9. Reduced-motion support present in the motion system.
const motion = read('src/nehemiah/organism-motion.ts');
const transition = read('src/nehemiah/organism-transition.ts');
check(
  'reduced-motion support present',
  motion.includes('motionScale') && transition.includes('reducedMotion'),
  'motion helpers and transition personalities honor prefers-reduced-motion',
);

// ---------------------------------------------------------------------------
// 10. Test coverage exists for every governed module.
const requiredTestFiles = [
  'src/nehemiah/organism-palette.test.ts',
  'src/nehemiah/organism-field.test.ts',
  'src/nehemiah/organism-parameters.test.ts',
  'src/nehemiah/organism-transition.test.ts',
  'src/nehemiah/organism-sleep.test.ts',
  'src/nehemiah/organism-lab-contract.test.ts',
  'src/nehemiah/organism-motion.test.ts',
  'src/nehemiah/organism-architecture.test.ts',
  'src/nehemiah/organism-globe-model.test.ts',
];
const missingTests = requiredTestFiles.filter((file) => !existsSync(path.join(root, file)));
check(
  'governed modules carry tests',
  missingTests.length === 0,
  missingTests.length === 0 ? 'all governed test files present' : `missing: ${missingTests.join(', ')}`,
);

// ---------------------------------------------------------------------------
// 11. No monolithic rotation — the organism must not rotate as one object.
// The root group (body, core, star field, membrane, contact shadow) carries
// breathing/float only and must never spin. The network-globe node shell DOES
// rotate on its own sub-group (spinRef) — that is the sanctioned "rotation
// lives in sub-layers" case, not the whole organism tumbling as a block, since
// everything outside the net stays put.
const engine = read('src/components/organism/organism-engine.tsx');
check(
  'no monolithic rotation',
  !/root\.current\.rotation/.test(engine),
  'root carries breathing/float only; only the globe net sub-layer spins',
);

// ---------------------------------------------------------------------------
// 11b. The primary shape (network globe) is present, gated, and parameterised.
// The globe replaced the filament shape as THE artifact, so it must stay in
// the compliance surface: rendered by the engine, driven by the pure model,
// and configured by real field parameters (guards against it being silently
// removed or zeroed while the older shape's checks keep passing).
const globeModelPresent = existsSync(path.join(root, 'src/nehemiah/organism-globe-model.ts'));
const fieldSource = read('src/nehemiah/organism-field.ts');
check(
  'primary network-globe shape governed',
  /<NetworkGlobe/.test(engine) &&
    /organism-globe-model/.test(engine) &&
    globeModelPresent &&
    /globeNodeCount:\s*\d+/.test(fieldSource),
  'engine renders NetworkGlobe via the pure globe model with parameterised node count',
);

// ---------------------------------------------------------------------------
// 12. Sleep mode present with the five-minute default.
const sleep = read('src/nehemiah/organism-sleep.ts');
check(
  'five-minute idle sleep locked',
  sleep.includes('5 * 60 * 1000'),
  'SLEEP_TIMEOUT_MS remains five minutes',
);

// ---------------------------------------------------------------------------
// 13. Security headers survive config edits. They were silently dropped once
// when next.config.ts was rewritten for the worktree Turbopack root; this
// check makes that class of regression impossible to merge.
const nextConfig = read('next.config.ts');
const requiredHeaders = [
  'Content-Security-Policy',
  'Referrer-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
];
const missingHeaders = requiredHeaders.filter((header) => !nextConfig.includes(header));
check(
  'security headers declared',
  missingHeaders.length === 0 && nextConfig.includes('poweredByHeader: false'),
  missingHeaders.length === 0
    ? 'all seven security headers present in next.config.ts'
    : `missing: ${missingHeaders.join(', ')}`,
);

// ---------------------------------------------------------------------------
const failed = results.filter((result) => !result.ok);

for (const result of results) {
  const mark = result.ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${result.name} — ${result.detail}`);
}

console.log(`\n${results.length - failed.length}/${results.length} compliance checks passed`);

if (failed.length > 0) {
  console.error('\nFounder compliance gate is RED. Fix the failures above before pushing.');
  process.exit(1);
}
