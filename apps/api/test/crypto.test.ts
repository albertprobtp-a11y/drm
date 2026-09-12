import { describe, it, expect } from "vitest";
import {
  generateDataKey,
  wrapDataKey,
  unwrapDataKey,
  encryptDocument,
  decryptDocument,
  sha256,
} from "../src/lib/crypto.js";

describe("chiffrement AES-256-GCM", () => {
  it("chiffre puis déchiffre un document et retrouve le contenu original", () => {
    const dataKey = generateDataKey();
    const plaintext = Buffer.from("Contenu confidentiel du document.", "utf8");

    const encrypted = encryptDocument(plaintext, dataKey);
    expect(encrypted.ciphertext.equals(plaintext)).toBe(false);

    const decrypted = decryptDocument(encrypted, dataKey);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it("échoue à déchiffrer avec la mauvaise clé de données", () => {
    const plaintext = Buffer.from("secret", "utf8");
    const encrypted = encryptDocument(plaintext, generateDataKey());

    expect(() => decryptDocument(encrypted, generateDataKey())).toThrow();
  });

  it("échoue à déchiffrer si le ciphertext a été altéré (intégrité GCM)", () => {
    const dataKey = generateDataKey();
    const encrypted = encryptDocument(Buffer.from("secret"), dataKey);
    encrypted.ciphertext[0] = (encrypted.ciphertext[0] ?? 0) ^ 0xff;

    expect(() => decryptDocument(encrypted, dataKey)).toThrow();
  });

  it("enveloppe puis déballe une clé de données avec la master key", () => {
    const dataKey = generateDataKey();
    const wrapped = wrapDataKey(dataKey);
    expect(wrapped).not.toEqual(dataKey.toString("base64"));

    const unwrapped = unwrapDataKey(wrapped);
    expect(unwrapped.equals(dataKey)).toBe(true);
  });

  it("produit une empreinte sha256 stable et déterministe", () => {
    const buf = Buffer.from("hello world");
    expect(sha256(buf)).toBe(sha256(Buffer.from("hello world")));
    expect(sha256(buf)).toHaveLength(64);
  });
});
