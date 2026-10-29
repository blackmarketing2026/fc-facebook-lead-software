"use client";

import { useState } from "react";
import { tenantLoginPath } from "@/lib/tenant-paths";

export function LoginLink({ slug }: { slug: string }) {
  const path = tenantLoginPath(slug);
  const [message, setMessage] = useState("");

  async function copy() {
    const url = new URL(path, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Kopiert");
    } catch {
      setMessage("Kopieren nicht möglich");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={path} target="_blank" rel="noopener noreferrer" className="btn-secondary px-2 py-1 text-xs" title={path}>Login öffnen ↗</a>
      <button type="button" onClick={copy} className="btn-secondary px-2 py-1 text-xs" aria-label={`Login-URL für ${slug} kopieren`}>URL kopieren</button>
      <span role="status" className="text-xs text-slate-500">{message}</span>
    </div>
  );
}
