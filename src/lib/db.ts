import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Die MySQL-Datenbank (All-Inkl) erlaubt nur wenige gleichzeitige Verbindungen pro Benutzer. Auf Vercel laufen
 * mehrere Instanzen parallel (direkt nach einem Deployment alte und neue), deshalb bekommt jede Instanz
 * höchstens 2 Verbindungen, sofern DATABASE_URL nicht selbst ein connection_limit vorgibt.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.NODE_ENV !== "production" || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=2&pool_timeout=20`;
}

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
