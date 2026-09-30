import { dnsRecordFor, type DnsTarget } from "@/lib/hosts";

/** Tabelle mit dem DNS-Eintrag, den der Kunde bei seinem Domain-Anbieter setzen muss. */
export function DnsInstructions({ hostname, target }: { hostname: string; target: DnsTarget }) {
  const record = dnsRecordFor(hostname, target);
  return (
    <table className="mt-2 w-full text-sm">
      <thead className="text-left text-xs text-slate-500">
        <tr>
          <th className="pb-1 pr-4">Typ</th>
          <th className="pb-1 pr-4">Name / Host</th>
          <th className="pb-1">Wert / Ziel</th>
        </tr>
      </thead>
      <tbody>
        <tr className="font-mono">
          <td className="pr-4">{record.type}</td>
          <td className="pr-4">{record.name}</td>
          <td className="break-all">{record.value}</td>
        </tr>
      </tbody>
    </table>
  );
}
