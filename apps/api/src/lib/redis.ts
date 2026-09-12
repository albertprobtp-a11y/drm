import { Redis } from "ioredis";
import { env } from "../config/env.js";

/** Connexion Redis partagée pour cache, sessions OTP et clés de révocation. */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

/** Connexion dédiée BullMQ (recommandé séparé de l'usage cache classique). */
export function createBullConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}
