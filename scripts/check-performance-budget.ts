import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePerformanceBudget } from '../src/nehemiah/accessibility-performance';

function collectFiles(root: string, predicate: (path: string) => boolean): string[] {
  try {
    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return collectFiles(path, predicate);
      return predicate(path) ? [path] : [];
    });
  } catch {
    return [];
  }
}

function sumSizes(paths: string[]): number {
  return paths.reduce((total, path) => total + statSync(path).size, 0);
}

// The organism laboratory ships an isolated WebGL engine (three.js + R3F)
// that only /lab/organism loads. The Founder compliance gate guarantees the
// production surface cannot import it, so chunks carrying WebGL markers are
// lab-only by construction and are budgeted separately: the strict
// production budget keeps protecting the Founder-facing routes, and the lab
// engine gets an explicit, bounded allowance instead of a silent pass.
const LAB_CHUNK_MARKERS = ['WebGLRenderer', 'three.module', '@react-three'];

function isLabEngineChunk(path: string): boolean {
  try {
    const content = readFileSync(path, 'utf8');
    return LAB_CHUNK_MARKERS.some((marker) => content.includes(marker));
  } catch {
    return false;
  }
}

const allJs = collectFiles('.next/static', (path) => path.endsWith('.js'));
const labJs = allJs.filter(isLabEngineChunk);
const productionJs = allJs.filter((path) => !labJs.includes(path));

const snapshot = {
  javascriptBytes: sumSizes(productionJs),
  cssBytes: sumSizes(collectFiles('.next/static', (path) => path.endsWith('.css'))),
  imageBytes: sumSizes(
    collectFiles('public', (path) => /\.(png|jpe?g|webp|avif|svg)$/i.test(path)),
  ),
};
const budget = { javascriptBytes: 750_000, cssBytes: 90_000, imageBytes: 3_000_000, totalBytes: 4_000_000 };
const result = evaluatePerformanceBudget(snapshot, budget);

const labEngineBytes = sumSizes(labJs);
const LAB_ENGINE_BUDGET_BYTES = 1_500_000;
const labStatus = labEngineBytes <= LAB_ENGINE_BUDGET_BYTES ? 'pass' : 'fail';

console.log(
  JSON.stringify(
    {
      ...result,
      labEngine: {
        status: labStatus,
        labEngineBytes,
        labEngineBudgetBytes: LAB_ENGINE_BUDGET_BYTES,
        chunkCount: labJs.length,
      },
    },
    null,
    2,
  ),
);

if (result.status === 'fail' || labStatus === 'fail') process.exit(1);
