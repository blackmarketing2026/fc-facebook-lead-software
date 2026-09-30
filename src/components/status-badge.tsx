import type { LeadStatus } from "@prisma/client";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}
