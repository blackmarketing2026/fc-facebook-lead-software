import { imapSettings, readStoredImap } from "@/lib/imap-settings";
import { getRecipientKeywords, getSubjectKeywords } from "@/lib/lead-intake";
import { requireAdmin } from "@/lib/session";
import { ImapForm, IntakeRulesForm } from "./intake-form";

export const metadata = { title: "Lead-Empfang" };

export default async function IntakePage() {
  await requireAdmin();
  const [subject, recipient, imap, stored] = await Promise.all([getSubjectKeywords(), getRecipientKeywords(), imapSettings(), readStoredImap()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lead-Empfang</h1>
        <p className="text-sm text-slate-500">
          So kommen Leads ins System: Das System ruft das Postfach unten regelmäßig ab. Jede Mail, die die Bedingungen
          erfüllt und ein gültiges Lead-JSON enthält, wird als Lead importiert und danach aus dem Postfach gelöscht. Alle
          anderen Mails bleiben liegen (als gelesen markiert) und stehen im Bereich Postfach als „Kein Lead“.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">1. Postfach</h2>
        <p className="mb-3 text-sm text-slate-500">
          An dieses Postfach (IMAP) müssen die Lead-Mails geschickt werden. Du kannst dasselbe Postfach wie für den
          E-Mail-Versand (SMTP) verwenden.
        </p>
        <ImapForm
          initial={{ host: imap.host ?? "", port: imap.port, secure: imap.secure, user: imap.user ?? "", hasPassword: Boolean(imap.pass) }}
          source={imap.source}
          hasStored={Boolean(stored)}
        />
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">2. Bedingungen für den Import</h2>
        <p className="mb-3 text-sm text-slate-500">
          Beide Bedingungen müssen erfüllt sein. Pro Bedingung genügt ein passendes Stichwort (eines pro Zeile oder mit
          Komma getrennt, Groß-/Kleinschreibung egal). Leer = keine Einschränkung.
        </p>
        <IntakeRulesForm subject={subject.join("\n")} recipient={recipient.join("\n")} />
      </section>
    </div>
  );
}
