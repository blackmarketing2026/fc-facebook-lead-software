"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { createContact, type CreateContactState } from "@/app/actions/contacts";

export function ContactForm({ stages, knownTags, leadsBase }: { stages: { id: string; name: string; isDefault: boolean }[]; knownTags: string[]; leadsBase: string }) {
  const [state, setState] = useState<CreateContactState>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Manuell absenden statt per Form-Action: So bleiben die Eingaben bei einem Fehler erhalten und werden nur nach Erfolg geleert.
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await createContact(undefined, data);
      setState(res);
      if (res?.ok) formRef.current?.reset();
    });
  }

  const defaultStage = stages.find((s) => s.isDefault)?.id ?? "";

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="label">Name</span>
        <input name="fullName" maxLength={200} autoComplete="off" className="input" placeholder="Max Mustermann" />
      </label>
      <label className="block">
        <span className="label">E-Mail</span>
        <input name="email" type="email" autoComplete="off" className="input" placeholder="max@example.com" />
      </label>
      <label className="block">
        <span className="label">Telefon</span>
        <input name="phone" type="tel" autoComplete="off" className="input" placeholder="+49 170 1234567" />
      </label>
      <label className="block">
        <span className="label">Sprache (optional)</span>
        <input name="language" maxLength={40} className="input" placeholder="Deutsch" />
      </label>
      <label className="block">
        <span className="label">Phase</span>
        <select name="stageId" defaultValue={defaultStage} className="input">
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isDefault ? " (neue Leads)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Tags (mit Komma getrennt)</span>
        <input name="tags" list="import-tags" autoComplete="off" className="input" placeholder="Messe 2026, Google Ads" />
        <datalist id="import-tags">
          {knownTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Notiz (optional)</span>
        <textarea name="note" rows={3} maxLength={5000} className="input" placeholder="Woher kommt der Kontakt, worum ging es?" />
      </label>

      <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4" />
        <span>
          <strong>E-Mail-Einwilligung liegt vor.</strong> Nur dann bekommt der Kontakt E-Mails aus deinen Ketten. Ohne Haken wird er als
          „abgemeldet“ geführt (kein E-Mail-Versand) – du kannst ihn später auf der Lead-Seite freigeben. Tags starten E-Mail-Ketten, die
          mit diesem Tag beginnen.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn-primary">{pending ? "Anlegen …" : "Kontakt anlegen"}</button>
        {state?.ok && (
          <span className="text-sm text-green-700">
            {state.ok}{" "}
            {state.id && (
              <Link href={`${leadsBase}/${state.id}`} className="font-medium underline">
                Kontakt öffnen →
              </Link>
            )}
          </span>
        )}
        {state?.error && (
          <span className="text-sm text-red-600">
            {state.error}{" "}
            {state.existingId && (
              <Link href={`${leadsBase}/${state.existingId}`} className="font-medium underline">
                Vorhandenen öffnen →
              </Link>
            )}
          </span>
        )}
      </div>
    </form>
  );
}
