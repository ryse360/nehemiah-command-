import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePerformanceBudget } from '../src/nehemiah/accessibility-performance';

function sumFiles(root: string, predicate: (path: string) => boolean): number {
  try {
    return readdirSync(root, { withFileTypes: true }).reduce((total, entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return total + sumFiles(path, predicate);
      return total + (predicate(path) ? statSync(path).size : 0);
    }, 0);
  } catch {
    return 0;
  }
}

const snapshot = {
  javascriptBytes: sumFiles('.next/static', (path) => path.endsWith('.js')),
  cssBytes: sumFiles('.next/static', (path) => path.endsWith('.css')),
  imageBytes: sumFiles('public', (path) => /\.(png|jpe?g|webp|avif|svg)$/i.test(path)),
};
const budget = { javascriptBytes: 750_000, cssBytes: 90_000, imageBytes: 3_000_000, totalBytes: 4_000_000 };
const result = evaluatePerformanceBudget(snapshot, budget);
console.log(JSON.stringify(result, null, 2));
if (result.status === 'fail') process.exit(1);
