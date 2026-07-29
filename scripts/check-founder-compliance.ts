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
// 4. Production shares the APPROVED ORGANISM, never the laboratory shell.
//
// Step 3 connected the authenticated dashboard to the real orb: the production
// shell renders <NehemiahOrb>, which drives the SAME OrganismEngine the lab
// uses. That shared presentation component is sanctioned. What must NEVER reach
// production is the lab SHELL itself (organism-lab) or its dev tooling (Leva) —
// production drives the engine from sanitized production state, not from Leva
// sliders and the fixture state machine.
const productionSurface =
  read('src/app/page.tsx') + read('src/components/nehemiah-shell.tsx');
const labShellLeaks = ['organism-lab', "from 'leva'", 'from "leva"'].filter((target) =>
  productionSurface.includes(target),
);
check(
  'production isolated from the lab shell',
  labShellLeaks.length === 0,
  labShellLeaks.length === 0
    ? 'production renders the shared organism via the orb; no lab shell or Leva'
    : `leaks: ${labShellLeaks.join(', ')}`,
);

// ---------------------------------------------------------------------------
// 4b. The production orb consumes ONLY the sanitized OrbStateDTO.
//
// The client boundary that keeps Founder content out of the visual layer lives
// at <NehemiahOrb>: it must take the derived DTO and nothing that can carry a
// title, note, command, proof, lesson, name, or identifier. This check makes a
// raw-data import at that seam impossible to merge (the contract tests prove the
// derivation strips content; this proves the component can't be handed it).
const orbComponent = read('src/components/organism/nehemiah-orb.tsx');
const rawFounderModules = [
  'founder-memory',
  'founder-journey',
  'decision-record-integrity',
  'shell-model',
];
const orbRawLeaks = rawFounderModules.filter((target) => orbComponent.includes(target));
check(
  'orb consumes only the sanitized DTO',
  orbRawLeaks.length === 0 && orbComponent.includes('OrbStateDTO'),
  orbRawLeaks.length === 0
    ? 'NehemiahOrb takes OrbStateDTO only — no raw Founder data at the client boundary'
    : `raw Founder data reached the orb boundary: ${orbRawLeaks.join(', ')}`,
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
  'src/nehemiah/orb-state.test.ts',
  'src/nehemiah/orb-parameters.test.ts',
  'src/nehemiah/organism-ecology.test.ts',
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
// 11b. The primary structure (intelligence ecology) is present and governed.
// The geodesic network globe was REJECTED by the Founder: placing nodes evenly
// on a shell and joining nearest neighbours guarantees uniform tessellation,
// geodesic wrapping and equally-prominent nodes. It was replaced by the
// volumetric intelligence ecology, whose anti-uniformity properties are locked
// by tests in organism-ecology.test.ts. This check keeps the new primary shape
// in the compliance surface so it cannot be silently removed or zeroed.
const ecologyModelPresent = existsSync(path.join(root, 'src/nehemiah/organism-ecology.ts'));
const ecologySource = ecologyModelPresent ? read('src/nehemiah/organism-ecology.ts') : '';
check(
  'primary intelligence ecology governed',
  /<EcologyField/.test(engine) &&
    /organism-ecology/.test(engine) &&
    ecologyModelPresent &&
    /nodeCount:\s*\d+/.test(ecologySource),
  'engine renders EcologyField via the pure ecology model with parameterised node count',
);

// ---------------------------------------------------------------------------
// 11c. The rejected shape must not come back. A geodesic net is re-introduced
// by shell placement + nearest-neighbour joining, so the engine must not render
// the old globe at all.
check(
  'rejected geodesic globe stays retired',
  !/<NetworkGlobe/.test(engine),
  'the engine no longer renders the shell-wrapped network globe',
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
