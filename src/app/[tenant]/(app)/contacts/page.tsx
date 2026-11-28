import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { ROW_GRID, type ContactSummary } from "./contact-row";
import { AddContactDialog } from "./add-contact-dialog";
import { ContactSelection } from "./contact-selection";

export const metadata = { title: "Kontaktcloud" };

const PAGE_SIZE = 50;
type SortKey = "datum" | "name" | "tag";

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export default async function ContactsPage(props: PageProps<"/[tenant]/contacts">) {
  const user = await requireUser();
  const base = tenantPath(user.tenant.slug, "/contacts");
  const leadBase = tenantPath(user.tenant.slug, "/leads");
  const sp = await props.searchParams;
  const sort: SortKey = (["datum", "name", "tag"] as const).find((k) => k === one(sp.sort)) ?? "datum";
  const dir: "asc" | "desc" = one(sp.dir) === "asc" ? "asc" : one(sp.dir) === "desc" ? "desc" : sort === "datum" ? "desc" : "asc";
  const q = one(sp.q).trim();
  const tag = one(sp.tag);
  const mail = one(sp.mail);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const where: Prisma.LeadWhereInput = { ...leadScope(user) };
  if (q) where.OR = [{ fullName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q.replace(/\s/g, "") } }];
  if (tag) where.tags = { some: { tag: { name: tag } } };
  if (mail === "abgemeldet") where.emailOptOut = true;
  if (mail === "aktiv") where.emailOptOut = false;

  const [leads, allTags, stages] = await Promise.all([
    db.lead.findMany({
      where,
      select: {
        id: true, fullName: true, email: true, phone: true, receivedAt: true, emailOptOut: true, emailOptOutAt: true,
        stage: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
        _count: { select: { notes: true } },
      },
    }),
    db.tag.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" }, select: { name: true } }),
    user.role === "ADMIN"
      ? db.pipelineStage.findMany({ where: { tenantId: user.tenantId }, orderBy: { position: "asc" }, select: { id: true, name: true, isDefault: true } })
      : Promise.resolve([]),
  ]);

  const rows = leads.map((l) => ({
    id: l.id,
    receivedAt: l.receivedAt.toISOString(),
    name: l.fullName ?? "",
    email: l.email,
    phone: l.phone,
    tags: l.tags.map((t) => t.tag.name).sort((a, b) => a.localeCompare(b, "de")),
    stage: l.stage?.name ?? null,
    optOut: l.emailOptOut,
    optOutAt: l.emailOptOutAt?.toISOString() ?? null,
    notes: l._count.notes,
  })) satisfies ContactSummary[];

  const factor = dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    let r = 0;
    if (sort === "name") {
      // Kontakte ohne Namen ans Ende, unabhängig von der Richtung.
      if (!a.name !== !b.name) return a.name ? -1 : 1;
      r = a.name.localeCompare(b.name, "de", { sensitivity: "base" });
    } else if (sort === "tag") {
      if (!a.tags.length !== !b.tags.length) return a.tags.length ? -1 : 1;
      r = (a.tags[0] ?? "").localeCompare(b.tags[0] ?? "", "de", { sensitivity: "base" });
    } else {
      r = a.receivedAt.localeCompare(b.receivedAt);
    }
    return r * factor || a.receivedAt.localeCompare(b.receivedAt) * -1;
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const href = (over: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string> = { q, tag, mail, sort, dir, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };
  const sortHref = (key: SortKey) => href({ sort: key, dir: sort === key ? (dir === "asc" ? "desc" : "asc") : key === "datum" ? "desc" : "asc", page: "" });
  const arrow = (key: SortKey) => (sort === key ? (dir === "asc" ? " ▲" : " ▼") : "");
  const sortLink = (key: SortKey, label: string) => (
    <Link href={sortHref(key)} className={`hover:text-slate-900 ${sort === key ? "text-slate-900" : ""}`}>
      {label}
      {arrow(key)}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Kontaktcloud</h1>
          <p className="text-sm text-slate-500">Alle Kontakte an einem Ort. Klick auf eine Zeile zeigt Protokoll, Notizen und die Facebook-Formulardaten.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{total} Kontakte</span>
          {user.role === "ADMIN" && <AddContactDialog stages={stages} knownTags={allTags.map((t) => t.name)} leadsBase={leadBase} />}
        </div>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" defaultValue={q} placeholder="Name, E-Mail, Telefon …" className="input lg:col-span-2" />
        <select name="tag" defaultValue={tag} className="input" aria-label="Tag">
          <option value="">Alle Tags</option>
          {allTags.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        <select name="mail" defaultValue={mail} className="input" aria-label="E-Mail-Verteiler">
          <option value="">Verteiler: alle</option>
          <option value="aktiv">Angemeldet</option>
          <option value="abgemeldet">Abgemeldet</option>
        </select>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex gap-2">
          <button className="btn-primary">Filtern</button>
          <Link href={base} className="btn-secondary">Zurücksetzen</Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm md:hidden">
        <span className="text-slate-500">Sortieren:</span>
        {(["name", "datum", "tag"] as const).map((k) => (
          <Link key={k} href={sortHref(k)} className={sort === k ? "btn-primary !px-3 !py-1" : "btn-secondary !px-3 !py-1"}>
            {k === "name" ? "Name" : k === "datum" ? "Datum" : "Tag"}
            {arrow(k)}
          </Link>
        ))}
      </div>

      <ContactSelection rows={shown} leadBase={leadBase} knownTags={allTags.map((t) => t.name)} header={
        <div className={`hidden border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 ${ROW_GRID}`}>
          <div />
          <div>{sortLink("datum", "Datum")}</div>
          <div>{sortLink("name", "Name")}</div>
          <div>Kontakt</div>
          <div>{sortLink("tag", "Tags")}</div>
          <div>Phase</div>
          <div>E-Mail</div>
          <div />
          <div />
        </div>
      } />

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {current > 1 && <Link href={href({ page: String(current - 1) })} className="btn-secondary">← Zurück</Link>}
          <span className="text-slate-500">Seite {current} von {pages}</span>
          {current < pages && <Link href={href({ page: String(current + 1) })} className="btn-secondary">Weiter →</Link>}
        </div>
      )}
    </div>
  );
}
