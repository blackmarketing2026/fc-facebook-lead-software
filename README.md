# Function Concept - Facebook Lead Software

Empfängt Leads per E-Mail, verteilt sie automatisch per gewichtetem Round-Robin an die Vertriebler und ermöglicht die Bearbeitung: Anruf-, WhatsApp- und E-Mail-Buttons, Gesprächsprotokoll, Status, Rückruf-Termine mit Erinnerung.

**Stack:** Next.js 16 (App Router), PostgreSQL + Prisma 6, Tailwind 4, imapflow, web-push.

## Lokal starten (Windows, ohne Docker)

```bash
npm install
cp .env.example .env         # SESSION_SECRET setzen (siehe Kommentar in der Datei)
npm run db:local             # Terminal 1: eingebettetes PostgreSQL auf Port 5433
npm run db:migrate           # einmalig: Tabellen anlegen
npm run db:seed              # einmalig: Admin + Martin, Selina, Frances
npm run dev                  # Terminal 2: http://localhost:3000
npm run worker               # Terminal 3: Postfach-Abruf + Rückruf-Erinnerungen
```

Startzugänge (änderbar in `.env` vor dem Seed, danach unter **Mitglieder**):

| Benutzer | Passwort | Rolle |
|---|---|---|
| `admin` | `admin12345` | Admin |
| `martin`, `selina`, `frances` | `vertrieb123` | Vertrieb |

Passwörter vor dem Live-Betrieb ändern.

Solange kein Postfach verbunden ist, lassen sich Leads unter **Postfach → Lead manuell importieren** testen.

## Später einzutragen (Platzhalter in `.env`)

| Variable | Wofür |
|---|---|
| `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS`, … | Lead-Postfach. Ohne diese Werte läuft der Worker im Leerlauf. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Browser-Push; erzeugen mit `npx web-push generate-vapid-keys`. Ohne diese Werte ist Push aus, Dashboard und Glocke funktionieren trotzdem. |
| `APP_URL` | Öffentliche URL (für Links in .ics-Kalendereinträgen) |
| `DATABASE_URL` | Produktions-Datenbank |

Browser-Push funktioniert nur über **HTTPS** (oder `localhost`).

## Wie es funktioniert

- **Eingang:** Der Worker (`src/worker/`) ruft alle 60 s ungelesene Mails per IMAP ab. Jede Mail wird geprüft: Enthält sie ein JSON-Array `[{"name": …, "values": [...]}]`, wird ein Lead angelegt, und die Mail wandert in den Ordner `Verarbeitet`. Mails ohne JSON werden als „ignoriert“ protokolliert und als gelesen markiert. Doppelte Mails (gleiche Message-ID) werden erkannt.
- **Parser** (`src/lib/lead-parser.ts`): `full_name`, `email`, `phone_number` und `Sprache` werden zu Lead-Feldern; alle Fragen und Antworten werden zusätzlich gespeichert. Neue Formularfelder erscheinen automatisch, ohne Code-Änderung.
- **Verteilung** (`src/lib/distribution.ts`): Smooth Weighted Round-Robin. Reihenfolge, Gewicht (1–10) und Pause sind unter **Verteilung** einstellbar, mit Vorschau. Die Zuweisung läuft in einer gesperrten Transaktion, damit gleichzeitig eingehende Leads sich nicht überschneiden.
- **Rechte:** Vertriebler sehen nur ihre eigenen Leads (serverseitig erzwungen), der Admin sieht alles und verwaltet Mitglieder, Verteilung und Postfach.
- **Erinnerungen:** Rückrufe erscheinen im Dashboard („Als Nächstes anrufen“) und in der Glocke. Der Worker schickt 5 Minuten vorher eine Push-Nachricht. Jeder Termin lässt sich als `.ics` in Outlook oder Google Kalender übernehmen.

## Befehle

| Befehl | |
|---|---|
| `npm test` | Unit-Tests (Parser, Verteilung) |
| `npm run typecheck` / `npm run lint` | Prüfungen |
| `npm run build` | Produktions-Build |
| `npm run db:deploy` | Migrationen auf dem Server anwenden |

## Server-Betrieb (Docker)

```bash
cp .env.example .env    # echte Werte eintragen, POSTGRES_PASSWORD setzen
docker compose up -d --build
docker compose exec app npx prisma db seed   # einmalig
```

Startet drei Container: `db` (PostgreSQL), `app` (Port 3000, wendet Migrationen beim Start an) und `worker`. Davor gehört ein Reverse-Proxy mit HTTPS (z. B. Caddy oder nginx).

**Vercel:** Die Web-App läuft auch dort (Datenbank z. B. Neon oder Supabase). Der Worker braucht aber einen dauerhaft laufenden Prozess, also einen kleinen Server oder Dienst wie Railway oder Fly.io.
