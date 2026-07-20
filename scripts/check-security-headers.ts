export {};

const baseUrl = process.env.NEHEMIAH_BASE_URL ?? 'http://127.0.0.1:3000';
const requiredHeaders: Record<string, string | RegExp> = {
  'content-security-policy': /default-src 'self'/,
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

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

const response = await fetchWithRetry(`${baseUrl}/`);
const failures: string[] = [];
for (const [name, expected] of Object.entries(requiredHeaders)) {
  const actual = response.headers.get(name) ?? '';
  const valid = typeof expected === 'string' ? actual === expected : expected.test(actual);
  if (!valid) failures.push(`${name} is missing or invalid.`);
}
console.log(JSON.stringify({ status: failures.length ? 'fail' : 'pass', failures }, null, 2));
if (failures.length) process.exit(1);
