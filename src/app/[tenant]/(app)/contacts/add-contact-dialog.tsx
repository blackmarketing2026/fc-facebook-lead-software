"use client";

import { useRef } from "react";
import { ContactForm } from "../import/contact-form";

export function AddContactDialog({ stages, knownTags, leadsBase }: {
  stages: { id: string; name: string; isDefault: boolean }[];
  knownTags: string[];
  leadsBase: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => dialogRef.current?.showModal()}>
        Lead hinzufügen
      </button>
      <dialog ref={dialogRef} aria-labelledby="add-contact-title" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="add-contact-title" className="text-xl font-semibold">Lead hinzufügen</h2>
            <p className="mt-1 text-sm text-slate-500">Lege einen Kontakt für die Pipeline und Kontaktcloud an.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()} aria-label="Dialog schließen">✕</button>
        </div>
        <ContactForm stages={stages} knownTags={knownTags} leadsBase={leadsBase} />
      </dialog>
    </>
  );
}
