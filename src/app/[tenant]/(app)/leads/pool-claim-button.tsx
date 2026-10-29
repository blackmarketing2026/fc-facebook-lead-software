"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimPoolLead } from "@/app/actions/leads";

export function PoolClaimButton({ leadId }: { leadId: string }) {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <div><button type="button" disabled={pending} className="btn-primary" onClick={() => start(async () => { const result = await claimPoolLead(leadId); if (result.error) return setError(result.error); router.push(`/${tenant}/leads/${leadId}`); })}>{pending ? "Übernehme …" : "Lead übernehmen"}</button>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>;
}
