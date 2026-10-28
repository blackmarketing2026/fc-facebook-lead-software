"use client";

import { useTransition } from "react";
import { resetLead } from "@/app/actions/leads";

export function ResetLeadButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} className="btn-danger" onClick={() => {
    if (window.confirm("Bearbeitungshistorie, Notizen und Termine dieses Leads endgültig löschen und ihn als neu markieren?")) start(() => resetLead(leadId));
  }}>{pending ? "Setze zurück …" : "Lead zurücksetzen"}</button>;
}
