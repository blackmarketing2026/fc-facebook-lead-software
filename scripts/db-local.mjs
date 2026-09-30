// Startet ein eingebettetes PostgreSQL für die lokale Entwicklung (ohne Docker).
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dataDir = "./.pgdata";
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
  // Ohne diese Flags übernimmt initdb unter Windows die Codepage (WIN1252) statt UTF-8.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !existsSync(dataDir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("leadcenter");
console.log("PostgreSQL läuft auf localhost:5433 (Datenbank: leadcenter). Beenden mit Strg+C.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
