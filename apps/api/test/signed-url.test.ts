import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import { generatePageToken, verifyAndConsumePageToken } from "../src/lib/signed-url.js";
import { redis } from "../src/lib/redis.js";

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await redis.quit();
});

describe("URLs de page signées (HMAC, TTL court, usage unique)", () => {
  it("génère un token vérifiable, lié à la shareSession et à la page", async () => {
    const { token, expiresAt } = generatePageToken("session-abc", 3);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const result = await verifyAndConsumePageToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.shareSessionId).toBe("session-abc");
      expect(result.payload.pageNumber).toBe(3);
    }
  });

  it("refuse un token déjà utilisé (usage unique)", async () => {
    const { token } = generatePageToken("session-single-use", 1);

    const first = await verifyAndConsumePageToken(token);
    expect(first.ok).toBe(true);

    const second = await verifyAndConsumePageToken(token);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("already_used");
  });

  it("refuse un token dont la signature a été altérée", async () => {
    const { token } = generatePageToken("session-tamper", 1);
    const [payload] = token.split(".");
    const tampered = `${payload}.deadbeefdeadbeefdeadbeefdeadbeef`;

    const result = await verifyAndConsumePageToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature");
  });

  it("refuse un token malformé", async () => {
    const result = await verifyAndConsumePageToken("ceci-nest-pas-un-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("refuse un token expiré (TTL de 45s dépassé)", async () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { token } = generatePageToken("session-expired", 1);

    vi.setSystemTime(now + 46_000);

    const result = await verifyAndConsumePageToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });
});
