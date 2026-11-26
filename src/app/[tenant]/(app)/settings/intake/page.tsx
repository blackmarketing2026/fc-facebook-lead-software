import { getSubjectKeywords } from "@/lib/lead-intake";
import { requireAdmin } from "@/lib/session";
import { IntakeForm } from "./intake-form";

export const metadata = { title: "Lead-Eingang" };

export default async function IntakePage() {
  await requireAdmin();
  const keywords = await getSubjectKeywords();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lead-Eingang</h1>
        <p className="text-sm text-slate-500">
          Hier legst du fest, woran das System neue Leads erkennt. Aktuell kommen Leads über einen Kanal: das Lead-Postfach
          (E-Mail mit dem Formular-JSON von Facebook).
        </p>
      </div>
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Betreff der Lead-Mail</h2>
        <p className="mb-3 text-sm text-slate-500">
          Eine Mail wird nur dann als Lead angelegt, wenn ihr Betreff mindestens eines dieser Stichwörter enthält
          (Groß-/Kleinschreibung egal). Ein Stichwort pro Zeile oder mit Komma getrennt. Leer lassen, um jede Mail mit
          gültigem Lead-JSON anzunehmen. Mails ohne passendes Stichwort erscheinen im Postfach als „Kein Lead“ und können
          dort bei Bedarf trotzdem nachverarbeitet werden.
        </p>
        <IntakeForm initial={keywords.join("\n")} />
      </section>
    </div>
  );
}
