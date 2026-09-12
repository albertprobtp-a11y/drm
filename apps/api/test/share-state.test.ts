import { describe, it, expect } from "vitest";
import { computeShareState, isShareActive } from "../src/modules/shares/state.js";

function baseShare() {
  return { revokedAt: null as Date | null, expiresAt: null as Date | null, maxViews: null as number | null, viewCount: 0 };
}

describe("logique de révocation et d'expiration d'un partage", () => {
  it("est actif par défaut (pas de révocation, pas d'expiration, pas de limite)", () => {
    const share = baseShare();
    expect(computeShareState(share)).toBe("ACTIVE");
    expect(isShareActive(share)).toBe(true);
  });

  it("passe en REVOKED dès que revokedAt est renseigné, quoi qu'il arrive d'autre", () => {
    const share = { ...baseShare(), revokedAt: new Date(), maxViews: 10, viewCount: 0 };
    expect(computeShareState(share)).toBe("REVOKED");
  });

  it("passe en EXPIRED quand la date d'expiration est dépassée", () => {
    const share = { ...baseShare(), expiresAt: new Date(Date.now() - 1000) };
    expect(computeShareState(share)).toBe("EXPIRED");
  });

  it("reste ACTIVE tant que la date d'expiration n'est pas atteinte", () => {
    const share = { ...baseShare(), expiresAt: new Date(Date.now() + 60_000) };
    expect(computeShareState(share)).toBe("ACTIVE");
  });

  it("passe en VIEW_LIMIT_REACHED quand le nombre de vues atteint la limite", () => {
    const share = { ...baseShare(), maxViews: 3, viewCount: 3 };
    expect(computeShareState(share)).toBe("VIEW_LIMIT_REACHED");
  });

  it("priorise la révocation sur l'expiration et la limite de vues", () => {
    const share = {
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() - 1000),
      maxViews: 1,
      viewCount: 5,
    };
    expect(computeShareState(share)).toBe("REVOKED");
  });
});
