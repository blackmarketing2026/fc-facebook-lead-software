# Function Concept - Facebook Lead Software

Empfängt Leads per E-Mail, verteilt sie automatisch per gewichtetem Round-Robin an die Vertriebler und ermöglicht die Bearbeitung: Anruf-, WhatsApp- und E-Mail-Buttons, Gesprächsprotokoll, Status, Rückruf-Termine mit Erinnerung.

**Nur für Function Concept:** Die Software wird ausschließlich intern für die eigene Firma genutzt (Facebook-Leads, später E-Mail-Marketing und WhatsApp Business API). Kunden-Plattformen gibt es nicht mehr; alles liegt unter `/function-concept`.

**Stack:** Next.js 16 (App Router), MySQL/MariaDB + Prisma 6, Tailwind 4, imapflow, web-push.

## Lokal starten (Windows, ohne Docker)

```bash
npm install
cp .env.example .env         # SESSION_SECRET setzen (siehe Kommentar in der Datei)
npm run db:local             # Terminal 1: lokale MySQL auf Port 3307, spielt Migrationen + Testdaten automatisch ein
npm run dev                  # Terminal 2: http://localhost:3000/function-concept
npm run worker               # Terminal 3: Postfach-Abruf + Rückruf-Erinnerungen
```

Startzugang (lokal, änderbar in `.env` vor dem Seed): `admin` / `admin12345`. Anmelden geht mit Benutzername oder E-Mail-Adresse. Mitglieder, Abschlüsse, Verteilung und Protokoll gibt es nicht mehr.

**Master-Account:** `account@function-concept.de` (Hauptaccount, id `user_master_account`). Das aktuelle Passwort setzt die Migration `20261126120000_single_tenant_cleanup`; nach dem ersten Login unter **Mitglieder** ändern. Der Master erhält zusätzlich zu jedem neuen Lead eine ausführliche E-Mail.

Solange kein Postfach verbunden ist, lassen sich Leads unter **Postfach → Lead manuell importieren** testen.

## Später einzutragen (Platzhalter in `.env`)

| Variable | Wofür |
|---|---|
| `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS`, … | Lead-Postfach. Ohne diese Werte läuft der Worker im Leerlauf. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Browser-Push; erzeugen mit `npx web-push generate-vapid-keys`. Ohne diese Werte ist Push aus, Dashboard und Glocke funktionieren trotzdem. |
| `APP_URL` | Öffentliche URL (für Links in .ics-Kalendereinträgen) |
| `DATABASE_URL` | Produktions-Datenbank, MySQL/MariaDB: `mysql://USER:PASSWORT@HOST:3306/DATENBANK` |
| `CRON_SECRET` | Schützt die Cron-Routen für Postfach-Abruf und Erinnerungen |

Browser-Push funktioniert nur über **HTTPS** (oder `localhost`).

## Wie es funktioniert

- **Eingang:** Der Worker (`src/worker/`) oder ein Cron-Aufruf von `/api/cron/mailbox` ruft ungelesene Mails per IMAP ab (`src/lib/mailbox.ts`). Jede Mail wird geprüft: Enthält sie ein JSON-Array `[{"name": …, "values": [...]}]`, wird ein Lead angelegt. Erst wenn Mail und Lead gespeichert sind, wird die Mail im Postfach gelöscht. Mails ohne JSON werden als „ignoriert“ protokolliert und als gelesen markiert; fehlgeschlagene Mails bleiben erhalten. Doppelte Mails (gleiche Message-ID) werden mit gespeicherten Leads abgeglichen und dann gelöscht. Ein geschützter Aufruf mit `?reconcile=1` durchsucht zusätzlich gelesene Mails und den bisherigen Ordner `Verarbeitet` in kleinen Chargen.
- **Parser** (`src/lib/lead-parser.ts`): `full_name`, `email`, `phone_number` und `Sprache` werden zu Lead-Feldern; alle Fragen und Antworten werden zusätzlich gespeichert. Neue Formularfelder erscheinen automatisch, ohne Code-Änderung.
- **Verteilung** (`src/lib/distribution.ts`): Smooth Weighted Round-Robin. Reihenfolge, Gewicht (1–10) und Pause sind unter **Verteilung** einstellbar, mit Vorschau. Die Zuweisung läuft in einer gesperrten Transaktion, damit gleichzeitig eingehende Leads sich nicht überschneiden.
- **Rechte:** Vertriebler sehen nur ihre eigenen Leads (serverseitig erzwungen), der Admin sieht alles und verwaltet Mitglieder, Verteilung und Postfach.
- **Master-Benachrichtigung:** Der aktive Master-Account erhält bei jedem neuen Lead eine E-Mail an seine hinterlegte Adresse mit Kontaktdaten, Formularantworten und direkten Links zum Anrufen, für E-Mail und WhatsApp.
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
cp .env.example .env    # echte Werte eintragen, DB_PASSWORD setzen
docker compose up -d --build
docker compose exec app npx prisma db seed   # einmalig
```

Startet drei Container: `db` (MariaDB), `app` (Port 3000, wendet Migrationen beim Start an) und `worker`. Davor gehört ein Reverse-Proxy mit HTTPS (z. B. Caddy oder nginx).

**Datenbank bei All-Inkl (MySQL/MariaDB):** Im KAS eine **neue, leere** Datenbank anlegen und den **externen Zugriff** erlauben (Vercel hat keine festen IP-Adressen). `DATABASE_URL` in Vercel: `mysql://DBUSER:PASSWORT@HOST:3306/DBNAME?connection_limit=3` – Sonderzeichen im Passwort URL-kodieren. Die Migrationen legen beim Deployment alle Tabellen, das Dashboard Function Concept und den Master-Account an.

**Vercel:** Die Web-App läuft dort. Der Dauer-Worker läuft auf Vercel nicht; stattdessen ruft ein Cron-Dienst jede Minute `GET /api/cron/mailbox` und `GET /api/cron/reminders` mit dem Header `Authorization: Bearer <CRON_SECRET>` auf. Das kann Vercel Cron (minütlich erst ab Vercel Pro) oder ein externer Dienst wie cron-job.org sein. Dienste ohne eigene Header (z. B. All-Inkl-Cronjobs) hängen das Secret an die Adresse: `/api/cron/mailbox?secret=<CRON_SECRET>`. Migrationen vor dem Deployment mit `npm run db:deploy` gegen die Produktions-Datenbank ausführen.
