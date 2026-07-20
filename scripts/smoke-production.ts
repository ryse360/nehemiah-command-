export {};

const baseUrl = process.env.NEHEMIAH_BASE_URL ?? 'http://127.0.0.1:3000';
const checks = [
  { path: '/api/health', expected: 200 },
  { path: '/', expected: 200 },
  { path: '/api/founder-memory', expected: 401 },
  { path: '/api/deployment-readiness', expected: 401 },
  { path: '/api/founder-pilot', expected: 401 },
];

async function fetchWithRetry(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      return await fetch(url, { redirect: 'manual' });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

let failed = false;
for (const check of checks) {
  const response = await fetchWithRetry(`${baseUrl}${check.path}`);
  console.log(`${check.path}: ${response.status}`);
  if (response.status !== check.expected) failed = true;
}
if (failed) process.exit(1);
