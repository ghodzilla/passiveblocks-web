import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';

/** Matches the scrypt$16384$8$1$salt$hash strings produced by scripts/regime-password-hash.ts. */
export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 32 } as const;
const SALT_LEN = 16;

function b64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function fromB64url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const buf = Buffer.from(value, 'base64url');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export function hashPassword(password: string, salt: Buffer = randomBytes(SALT_LEN)): string {
  const { N, r, p, keyLen } = SCRYPT_PARAMS;
  const key = scryptSync(password, salt, keyLen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${b64url(salt)}$${b64url(key)}`;
}

interface ParsedHash {
  salt: Buffer;
  hash: Buffer;
}

function parseHash(encoded: string): ParsedHash | null {
  const parts = encoded.split('$');
  if (parts.length !== 6) return null;
  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (scheme !== 'scrypt') return null;
  if (Number(nRaw) !== SCRYPT_PARAMS.N || Number(rRaw) !== SCRYPT_PARAMS.r || Number(pRaw) !== SCRYPT_PARAMS.p) {
    return null;
  }
  const salt = fromB64url(saltRaw);
  const hash = fromB64url(hashRaw);
  if (!salt || salt.length !== SALT_LEN || !hash || hash.length !== SCRYPT_PARAMS.keyLen) return null;
  return { salt, hash };
}

export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  if (!password || password.length > 256 || !encoded) return false;
  const parsed = parseHash(encoded);
  if (!parsed) return false;
  const { N, r, p, keyLen } = SCRYPT_PARAMS;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, parsed.salt, keyLen, { N, r, p }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  if (derived.length !== parsed.hash.length) return false;
  return timingSafeEqual(derived, parsed.hash);
}
