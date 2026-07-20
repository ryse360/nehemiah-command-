import { createPasswordHash } from '../src/nehemiah/security-hardening';

const password = process.argv[2];
if (!password || password.length < 16) {
  console.error('Provide a Founder passphrase of at least 16 characters.');
  process.exit(1);
}
console.log(createPasswordHash(password));
