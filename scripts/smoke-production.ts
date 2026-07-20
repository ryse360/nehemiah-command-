export {};

const baseUrl = process.env.NEHEMIAH_BASE_URL ?? 'http://127.0.0.1:3000';
const checks = [
  { path: '/api/health', expected: 200 },
  { path: '/', expected: 200 },
  { path: '/api/founder-memory', expected: 401 },
];
let failed = false;
for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`, { redirect: 'manual' });
  console.log(`${check.path}: ${response.status}`);
  if (response.status !== check.expected) failed = true;
}
if (failed) process.exit(1);
