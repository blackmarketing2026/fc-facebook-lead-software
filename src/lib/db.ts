import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Die MySQL-Datenbank (All-Inkl) erlaubt nur wenige gleichzeitige Verbindungen pro Benutzer. Auf Vercel laufen
 * mehrere Instanzen parallel (direkt nach einem Deployment alte und neue), und pausierte Instanzen halten ihre
 * Verbindungen offen. Deshalb in Produktion fest: 1 Verbindung pro Instanz, ungenutzte Verbindungen nach 10 s
 * schließen und auf eine freie Verbindung der Instanz lieber warten, statt eine weitere zu öffnen. Diese Werte überschreiben
 * gleichnamige Parameter in DATABASE_URL.
 */
const POOL_PARAMS = {
  connection_limit: "1",
  max_idle_connection_lifetime: "10",
  pool_timeout: "20",
  connect_timeout: "10",
};

function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || process.env.NODE_ENV !== "production") return raw;
  try {
    const url = new URL(raw);
    for (const [key, value] of Object.entries(POOL_PARAMS)) url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return raw;
  }
}

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
