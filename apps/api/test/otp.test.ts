import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import { generateOtpCode, storeOtp, checkOtp } from "../src/lib/otp.js";
import { redis } from "../src/lib/redis.js";

afterAll(async () => {
  await redis.quit();
});

describe("flux OTP destinataire", () => {
  it("génère un code à 6 chiffres", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("accepte le bon code une seule fois puis l'invalide (consommé)", async () => {
    const shareId = randomUUID();
    const code = generateOtpCode();
    await storeOtp(shareId, code);

    expect(await checkOtp(shareId, code)).toBe("valid");
    // Le code a été supprimé après vérification réussie : une deuxième
    // tentative avec le même code doit désormais échouer.
    expect(await checkOtp(shareId, code)).toBe("expired");
  });

  it("refuse un mauvais code et incrémente les tentatives", async () => {
    const shareId = randomUUID();
    await storeOtp(shareId, "123456");

    expect(await checkOtp(shareId, "000000")).toBe("invalid");
  });

  it("verrouille après le nombre maximal de tentatives", async () => {
    const shareId = randomUUID();
    await storeOtp(shareId, "123456");

    for (let i = 0; i < 4; i++) {
      expect(await checkOtp(shareId, "000000")).toBe("invalid");
    }
    // 5e tentative erronée : verrouillage.
    expect(await checkOtp(shareId, "000000")).toBe("locked");
  });

  it("renvoie 'expired' pour un partage sans code actif", async () => {
    const shareId = randomUUID();
    expect(await checkOtp(shareId, "123456")).toBe("expired");
  });
});
