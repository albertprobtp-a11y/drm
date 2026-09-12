import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { env } from "../config/env.js";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getMasterKey(): Buffer {
  const key = Buffer.from(env.MASTER_ENCRYPTION_KEY, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `MASTER_ENCRYPTION_KEY doit être 32 octets en base64 (obtenu ${key.length} octets)`,
    );
  }
  return key;
}

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: string;
  authTag: string;
}

function encryptWithKey(plaintext: Buffer, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

function decryptWithKey(payload: EncryptedPayload, key: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
}

/** Génère une clé de données unique (32 octets) pour un document. */
export function generateDataKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

/** Enveloppe (wrap) une clé de données avec la master key — stocké en DB. */
export function wrapDataKey(dataKey: Buffer): string {
  const wrapped = encryptWithKey(dataKey, getMasterKey());
  // iv + authTag + ciphertext concaténés en un seul champ base64
  return Buffer.concat([
    Buffer.from(wrapped.iv, "base64"),
    Buffer.from(wrapped.authTag, "base64"),
    wrapped.ciphertext,
  ]).toString("base64");
}

/** Déballe (unwrap) une clé de données depuis son champ DB. */
export function unwrapDataKey(wrapped: string): Buffer {
  const buf = Buffer.from(wrapped, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);
  return decryptWithKey(
    { ciphertext, iv: iv.toString("base64"), authTag: authTag.toString("base64") },
    getMasterKey(),
  );
}

/** Chiffre le contenu d'un document avec sa clé de données unique. */
export function encryptDocument(plaintext: Buffer, dataKey: Buffer): EncryptedPayload {
  return encryptWithKey(plaintext, dataKey);
}

/** Déchiffre le contenu d'un document avec sa clé de données unique. */
export function decryptDocument(payload: EncryptedPayload, dataKey: Buffer): Buffer {
  return decryptWithKey(payload, dataKey);
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
