import { hashPassword } from '../lib/regime/password';

const password = process.env.REGIME_PASSWORD ?? '';

if (password.length < 12) {
  process.stderr.write('REGIME_PASSWORD must be at least 12 characters.\n');
  process.stderr.write("Example: REGIME_PASSWORD='choose-a-long-password' npm run regime:hash-password\n");
  process.exit(1);
}

process.stderr.write('Copy the line below into REGIME_PASSWORD_HASH, then unset REGIME_PASSWORD. Do not commit the hash.\n');
process.stdout.write(`${hashPassword(password)}\n`);
