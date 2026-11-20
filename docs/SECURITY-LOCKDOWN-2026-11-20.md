# Zugangssperre – 20. November 2026

Gesperrt: Martin, Selina, Frances/Francis sowie Engel- und Guido-Kundenplattformen.
Der Function-Concept-Master bleibt zum Prüfen und Verwalten aktiv. Server-Routen, existierende JWTs und Login werden geprüft.
Die Prisma-Migration setzt User.active=false und Tenant.status=SUSPENDED; manuelles Reaktivieren in der DB reicht wegen zusätzlicher Codeprüfung nicht aus.
Der Lead-Eingang bleibt zur Datensicherung aktiv, aber gesperrte Plattformen verteilen keine Leads und schicken keine Benachrichtigungen.
Mail- und Push-Versand sowie Erinnerungen an gesperrte Mitglieder sind blockiert. Alte Datensätze bleiben erhalten.

**Ein GitHub-Push ist noch kein Live-Nachweis.** Produktiv sind die Sperren erst nach erfolgreichem Vercel-Deployment mit Prisma-Migration.
Eine echte Login-/Versandprüfung ist ohne Zugriff auf die Live-Umgebung nicht möglich.
