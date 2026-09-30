// Startet eine lokale MySQL-Datenbank für die Entwicklung (ohne Docker/Installation).
// Beim ersten Start wird MySQL heruntergeladen. Die Daten sind flüchtig: Nach jedem Start
// werden Migrationen und Testdaten (Seed) automatisch neu eingespielt.
import { execSync } from "node:child_process";
import { createDB } from "mysql-memory-server";

const PORT = 3307;
const db = await createDB({ port: PORT, dbName: "leadcenter", version: "8.4", logLevel: "WARN" });
const url = `mysql://${db.username}@127.0.0.1:${db.port}/${db.dbName}`;
console.log(`MySQL läuft auf localhost:${db.port} (Datenbank: ${db.dbName}).`);

const env = { ...process.env, DATABASE_URL: url };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx prisma db seed", { stdio: "inherit", env });
console.log(`Bereit. In .env: DATABASE_URL="${url}"  –  Beenden mit Strg+C.`);

const stop = async () => {
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// Prozess am Leben halten, sonst beendet sich die Datenbank sofort.
setInterval(() => {}, 1 << 30);
