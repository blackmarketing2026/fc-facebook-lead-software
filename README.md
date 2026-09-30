# Function Concept - Facebook Lead Software

Empfängt Leads per E-Mail, verteilt sie automatisch per gewichtetem Round-Robin an die Vertriebler und ermöglicht die Bearbeitung: Anruf-, WhatsApp- und E-Mail-Buttons, Gesprächsprotokoll, Status, Rückruf-Termine mit Erinnerung.

**Mandantenfähig:** Ein Deployment, eine Datenbank, beliebig viele Kunden-Dashboards mit eigener Domain. Function Concept verwaltet alle Dashboards zentral im Bereich **Plattform**.

**Stack:** Next.js 16 (App Router), PostgreSQL + Prisma 6, Tailwind 4, imapflow, web-push.

## Lokal starten (Windows, ohne Docker)

```bash
npm install
cp .env.example .env         # SESSION_SECRET setzen (siehe Kommentar in der Datei)
npm run db:local             # Terminal 1: eingebettetes PostgreSQL auf Port 5433
npm run db:migrate           # einmalig: Tabellen anlegen
npm run db:seed              # einmalig: Admin + Martin, Selina, Frances + Entwicklungs-Mandant
npm run dev                  # Terminal 2: http://localhost:3000 (Function Concept), http://dev.localhost:3000 (Entwicklung)
npm run worker               # Terminal 3: Postfach-Abruf + Rückruf-Erinnerungen
```

Startzugänge (änderbar in `.env` vor dem Seed, danach unter **Mitglieder**):

| Benutzer | Passwort | Rolle |
|---|---|---|
| `admin` | `admin12345` | Admin |
| `martin`, `selina`, `frances` | `vertrieb123` | Vertrieb |
| `admin`, `test1`, `test2` auf `dev.localhost:3000` | `vertrieb123` | Entwicklungs-Mandant |

Passwörter vor dem Live-Betrieb ändern.

Solange kein Postfach verbunden ist, lassen sich Leads unter **Postfach → Lead manuell importieren** testen.

## Später einzutragen (Platzhalter in `.env`)

| Variable | Wofür |
|---|---|
| `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS`, … | Lead-Postfach. Ohne diese Werte läuft der Worker im Leerlauf. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Browser-Push; erzeugen mit `npx web-push generate-vapid-keys`. Ohne diese Werte ist Push aus, Dashboard und Glocke funktionieren trotzdem. |
| `APP_URL` | Öffentliche URL (für Links in .ics-Kalendereinträgen) |
| `DATABASE_URL` | Produktions-Datenbank |
| `CRON_SECRET` | Schützt die Cron-Routen für Postfach-Abruf und Erinnerungen |
| `PLATFORM_HOSTS` | Weitere Domains des Plattform-Dashboards (`APP_URL`, `localhost` und `*.vercel.app` gelten automatisch) |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Optional: Kunden-Domains automatisch im Vercel-Projekt eintragen und prüfen |

Browser-Push funktioniert nur über **HTTPS** (oder `localhost`).

## Mandanten (Kunden-Dashboards)

- **Erkennung per Domain** (`src/lib/tenant.ts`): Jede Anfrage wird anhand der aufgerufenen Domain einem Mandanten zugeordnet (`TenantDomain`). Die Plattform-Domain gehört zu „Function Concept“. Unbekannte Domains ergeben 404. Benutzernamen gelten pro Mandant, eine Session nur für ihre Domain.
- **Plattform-Bereich** (`/platform`, nur Plattform-Admins auf der Function-Concept-Domain): Dashboards anlegen (mit erstem Admin, z. B. dem Kunden), Domains verbinden und prüfen, Lead-Zuordnungsregeln, Feature-Schalter, weitere Admins, sperren, als JSON exportieren.
- **Öffnen ohne Passwort:** „Öffnen“ erzeugt einen Einmal-Link (60 s gültig) auf die Kunden-Domain und meldet den Plattform-Admin dort als Admin an. Ein gelbes Banner zeigt den Plattform-Zugriff an. Gesperrte Dashboards bleiben für den Plattform-Admin zugänglich.
- **DNS:** Unter **Plattform → Plattform-Einstellungen** stehen CNAME-Ziel und A-Eintrag. Kunden sehen unter **Domain**, was sie bei ihrem Domain-Anbieter eintragen müssen. Ohne Vercel-API-Token muss die Domain zusätzlich im Vercel-Dashboard unter *Settings → Domains* hinzugefügt werden.
- **Lead-Zuordnung** (`src/lib/lead-routing.ts`): Alle Leads kommen im zentralen Postfach an. Regeln pro Mandant: Empfänger enthält X (z. B. ein Alias `martin@function-concept.com`, der ins zentrale Postfach weiterleitet), Betreff enthält X oder JSON-Feld `feld=wert`. Ohne passende Regel geht der Lead an Function Concept.
- **Entwicklungs-Mandant und Feature-Schalter** (`src/lib/features.ts`): Neue Funktionen kommen in die Liste `FEATURES` und werden mit `hasFeature(tenant, key)` abgefragt. Der Entwicklungs-Mandant hat alle aktiv, für Kunden werden sie im Plattform-Bereich einzeln freigeschaltet.

## Wie es funktioniert

- **Eingang:** Der Worker (`src/worker/`) oder ein Cron-Aufruf von `/api/cron/mailbox` ruft ungelesene Mails per IMAP ab (`src/lib/mailbox.ts`). Jede Mail wird geprüft: Enthält sie ein JSON-Array `[{"name": …, "values": [...]}]`, wird ein Lead angelegt, und die Mail wandert in den Ordner `Verarbeitet`. Mails ohne JSON werden als „ignoriert“ protokolliert und als gelesen markiert. Doppelte Mails (gleiche Message-ID) werden erkannt.
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

**Vercel:** Die Web-App läuft dort (Datenbank z. B. Neon oder Supabase). Der Dauer-Worker läuft auf Vercel nicht; stattdessen ruft ein Cron-Dienst jede Minute `GET /api/cron/mailbox` und `GET /api/cron/reminders` mit dem Header `Authorization: Bearer <CRON_SECRET>` auf. Das kann Vercel Cron (minütlich erst ab Vercel Pro) oder ein externer Dienst wie cron-job.org sein. Migrationen vor dem Deployment mit `npm run db:deploy` gegen die Produktions-Datenbank ausführen.
