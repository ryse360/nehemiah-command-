import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const engineFiles = [
  'src/components/organism/organism-engine.tsx',
  'src/components/organism/luminous-core.tsx',
];

const labShellFile = 'src/components/organism/organism-lab.tsx';

test('the organism engine has no knowledge of Leva', () => {
  for (const file of engineFiles) {
    const source = readSource(file);
    assert.ok(
      !/from ['"]leva['"]/.test(source),
      `${file} must not import leva — Leva belongs only to the laboratory shell`,
    );
  }
});

test('the laboratory shell is where Leva is confined', () => {
  const source = readSource(labShellFile);
  assert.ok(/from ['"]leva['"]/.test(source), 'the lab shell should wire up Leva controls');
});

test('visual values come from the centralized parameter module, not the shell', () => {
  const source = readSource(labShellFile);
  assert.ok(
    source.includes('organism-parameters'),
    'the shell should resolve overrides through the centralized parameter model',
  );
});

test('the resting status label is visible in the laboratory shell', () => {
  const source = readSource(labShellFile);
  assert.ok(source.includes('organism-lab-contract'));
});

test('production pages do not import the organism laboratory', () => {
  const prohibitedImportTargets = ['organism-lab', 'organism-engine', 'luminous-core'];
  const productionPages = [
    'src/app/page.tsx',
  ];

  for (const page of productionPages) {
    const source = readSource(page);
    for (const target of prohibitedImportTargets) {
      assert.ok(
        !source.includes(target),
        `${page} must not reference ${target} — the organism lab is isolated`,
      );
    }
  }
});

test('the laboratory does not resurrect prohibited dashboard elements', () => {
  const prohibitedStrings = [
    'Founder Agenda',
    'Active Projects',
    'Live Context',
    'Personal Standard',
  ];
  const labFiles = [labShellFile, 'src/app/lab/organism/page.tsx'];

  for (const file of labFiles) {
    const source = readSource(file);
    for (const prohibited of prohibitedStrings) {
      assert.ok(
        !source.includes(prohibited),
        `${file} must not contain "${prohibited}"`,
      );
    }
  }
});
