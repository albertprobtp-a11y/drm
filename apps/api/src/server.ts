import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function main() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "SecureView API démarrée");
}

main().catch((err) => {
  logger.error({ err }, "échec du démarrage de l'API");
  process.exit(1);
});
