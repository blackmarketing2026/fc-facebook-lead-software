"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { addStep, deleteChain, deleteStep, moveStep, reorderSteps, sendTestStep, setChainActive, updateChain, updateStep, type ChainState } from "@/app/actions/chains";

type StepData = { id: string; type: "EMAIL" | "WAIT"; subject: string; body: string; waitValue: number; waitUnit: "MINUTES" | "HOURS" | "DAYS"; waitTime: string };
/** `key` bleibt stabil, auch wenn aus der vorläufigen ID nach dem Speichern die echte wird. */
type Step = StepData & { key: string; saving?: boolean };
type Chain = { id: string; name: string; active: boolean; tag: string };
export type StepStatsData = { sent: number; bounced: number; opened: number; clicked: number };

const UNITS: Record<StepData["waitUnit"], string> = { MINUTES: "Minuten", HOURS: "Stunden", DAYS: "Tage" };

function Status({ state }: { state: ChainState }) {
  return (
    <>
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </>
  );
}

export function ChainEditor({ chain, steps: initialSteps, knownTags, testEmail, stats, tracking }: { chain: Chain; steps: StepData[]; knownTags: string[]; testEmail: string; stats: Record<string, StepStatsData>; tracking: boolean }) {
  const [settings, settingsAction, settingsPending] = useActionState(updateChain.bind(null, chain.id), undefined);
  const [busy, start] = useTransition();
  const [info, setInfo] = useState<ChainState>();
  const [steps, setSteps] = useState<Step[]>(() => initialSteps.map((s) => ({ ...s, key: s.id })));
  const tempCounter = useRef(0);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const run = (fn: () => Promise<ChainState | void>) =>
    start(async () => {
      const res = await fn();
      setInfo(res ?? undefined);
    });

  // Änderungen erscheinen sofort; der Server zieht im Hintergrund nach. Bei einem Fehler wird der alte Stand wiederhergestellt.
  function insert(index: number, type: "EMAIL" | "WAIT") {
    const key = `tmp-${++tempCounter.current}`;
    const fresh: Step = { key, id: key, type, subject: "", body: "", waitValue: 1, waitUnit: "DAYS", waitTime: "", saving: true };
    const before = steps;
    setSteps((cur) => [...cur.slice(0, index), fresh, ...cur.slice(index)]);
    void addStep(chain.id, index, type).then((res) => {
      if (res?.id) setSteps((cur) => cur.map((s) => (s.key === key ? { ...s, id: res.id!, saving: false } : s)));
      else {
        setSteps(before);
        setInfo({ error: res?.error ?? "Schritt konnte nicht hinzugefügt werden." });
      }
    });
  }

  function remove(step: Step) {
    if (!confirm("Diesen Schritt löschen?")) return;
    const before = steps;
    setSteps((cur) => cur.filter((s) => s.key !== step.key));
    void deleteStep(step.id).then((res) => {
      if (res?.error) {
        setSteps(before);
        setInfo(res);
      }
    });
  }

  function move(step: Step, direction: -1 | 1) {
    const before = steps;
    setSteps((cur) => {
      const i = cur.findIndex((s) => s.key === step.key);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    void moveStep(step.id, direction).then((res) => {
      if (res?.error) {
        setSteps(before);
        setInfo(res);
      }
    });
  }

  /** Drag & Drop: Schritt `fromKey` an die Einfüge-Position `toIndex` (0 = direkt nach dem Start) verschieben. */
  function reorder(fromKey: string, toIndex: number) {
    setDragKey(null);
    if (steps.some((s) => s.saving)) return;
    const from = steps.findIndex((s) => s.key === fromKey);
    if (from < 0) return;
    const insertAt = toIndex > from ? toIndex - 1 : toIndex;
    if (insertAt === from) return;
    const before = steps;
    const next = [...steps];
    const [moved] = next.splice(from, 1);
    next.splice(insertAt, 0, moved);
    setSteps(next);
    void reorderSteps(chain.id, next.map((s) => s.id)).then((res) => {
      if (res?.error) {
        setSteps(before);
        setInfo(res);
      }
    });
  }

  const saved = (key: string, patch: Partial<StepData>) => setSteps((cur) => cur.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{chain.name}</h1>
          <span className={`badge ${chain.active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{chain.active ? "aktiv" : "pausiert"}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={chain.active ? "btn-secondary" : "btn-primary"} onClick={() => run(() => setChainActive(chain.id, !chain.active))}>
              {chain.active ? "Pausieren" : "Kette aktivieren"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn-secondary text-red-700"
              onClick={() => confirm(`Kette „${chain.name}“ mit allen Läufen löschen?`) && run(() => deleteChain(chain.id))}
            >
              Löschen
            </button>
          </div>
        </div>
        <Status state={info} />
        <form action={settingsAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="label">Name</span>
            <input name="name" defaultValue={chain.name} required maxLength={120} className="input" />
          </label>
          <label className="block">
            <span className="label">Start-Tag</span>
            <input name="tag" defaultValue={chain.tag} required maxLength={80} list="chain-tags" className="input" />
            <datalist id="chain-tags">
              {knownTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <button disabled={settingsPending} className="btn-secondary">{settingsPending ? "…" : "Speichern"}</button>
          <div className="sm:col-span-3"><Status state={settings} /></div>
        </form>
        <p className="text-xs text-slate-500">
          Die Kette startet für Leads, die den Start-Tag ab dem Aktivieren bekommen – bereits getaggte Leads werden nicht nachträglich gestartet.
          Jeder Lead durchläuft die Kette nur einmal. In jeder Mail steht ein Abmelde-Link.
        </p>
      </section>

      {/* Grafische Schrittkette */}
      <section className="mx-auto flex w-full max-w-xl flex-col items-stretch">
        <div className="mx-auto flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow">
          ▶ Start · Tag „{chain.tag}“ wird vergeben
        </div>
        <Connector index={0} onAdd={insert} dragKey={dragKey} onDropStep={reorder} />
        {steps.map((step, i) => (
          <div key={step.key} className="flex flex-col items-stretch">
            <StepCard step={step} index={i} total={steps.length} testEmail={testEmail} onMove={move} onRemove={remove} onSaved={saved} stats={stats[step.id]} tracking={tracking} dragKey={dragKey} setDragKey={setDragKey} onDropStep={reorder} />
            <Connector index={i + 1} onAdd={insert} dragKey={dragKey} onDropStep={reorder} />
          </div>
        ))}
        {steps.length === 0 && <p className="mb-2 text-center text-xs text-slate-400">Noch keine Schritte – füge mit „+“ eine E-Mail oder Wartezeit hinzu.</p>}
        <div className="mx-auto flex items-center gap-2 rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-white shadow">■ Ende</div>
      </section>
    </div>
  );
}

function Connector({ index, onAdd, dragKey, onDropStep }: { index: number; onAdd: (index: number, type: "EMAIL" | "WAIT") => void; dragKey: string | null; onDropStep: (fromKey: string, toIndex: number) => void }) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const add = (type: "EMAIL" | "WAIT") => {
    setOpen(false);
    onAdd(index, type);
  };
  return (
    <div
      className="relative mx-auto flex h-14 w-full flex-col items-center"
      onDragOver={(e) => {
        if (!dragKey) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (dragKey) onDropStep(dragKey, index);
      }}
    >
      <div className={`h-full w-px ${over ? "bg-blue-500" : "bg-slate-300"}`} />
      {over && <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-blue-500" />}
      <div className="absolute inset-0 flex items-center justify-center">
        {open ? (
          <div className="flex gap-2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={() => add("EMAIL")}>✉️ E-Mail</button>
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={() => add("WAIT")}>⏱ Wartezeit</button>
            <button type="button" aria-label="Abbrechen" className="px-2 text-slate-400" onClick={() => setOpen(false)}>✕</button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Schritt hinzufügen"
            onClick={() => setOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-semibold text-slate-500 shadow ring-1 ring-slate-300 hover:bg-slate-50 hover:text-slate-800"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

type CardProps = {
  step: Step;
  index: number;
  total: number;
  testEmail: string;
  onMove: (step: Step, direction: -1 | 1) => void;
  onRemove: (step: Step) => void;
  onSaved: (key: string, patch: Partial<StepData>) => void;
  stats?: StepStatsData;
  tracking: boolean;
  dragKey: string | null;
  setDragKey: (key: string | null) => void;
  onDropStep: (fromKey: string, toIndex: number) => void;
};

function StepControls({ step, index, total, onMove, onRemove, setDragKey, cardRef }: Pick<CardProps, "step" | "index" | "total" | "onMove" | "onRemove" | "setDragKey"> & { cardRef: React.RefObject<HTMLDivElement | null> }) {
  const locked = Boolean(step.saving);
  return (
    <div className="flex items-center gap-1 text-slate-500">
      <span
        draggable={!locked}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", step.key);
          if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24);
          setDragKey(step.key);
        }}
        onDragEnd={() => setDragKey(null)}
        title="Ziehen, um den Schritt zu verschieben"
        aria-label="Schritt per Drag and Drop verschieben"
        className={`hidden cursor-grab select-none rounded px-2 py-1 text-base leading-none hover:bg-slate-100 active:cursor-grabbing md:inline-block ${locked ? "opacity-30" : ""}`}
      >
        ⠿
      </span>
      <button type="button" disabled={locked || index === 0} aria-label="Nach oben" className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => onMove(step, -1)}>↑</button>
      <button type="button" disabled={locked || index === total - 1} aria-label="Nach unten" className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => onMove(step, 1)}>↓</button>
      <button type="button" disabled={locked} aria-label="Schritt löschen" className="rounded px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-30" onClick={() => onRemove(step)}>🗑</button>
    </div>
  );
}

function StepCard(props: CardProps) {
  const { step, onSaved } = props;
  const [state, setState] = useState<ChainState>();
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateStep(step.id, undefined, form);
      setState(res);
      if (res?.ok) {
        if (step.type === "WAIT") onSaved(step.key, { waitValue: Number(form.get("waitValue")), waitUnit: String(form.get("waitUnit")) as StepData["waitUnit"], waitTime: form.get("useTime") === "on" ? String(form.get("waitTime") ?? "") : "" });
        else onSaved(step.key, { subject: String(form.get("subject") ?? "").trim(), body: String(form.get("body") ?? "") });
      }
    });
  };
  const disabled = pending || Boolean(step.saving);

  const cardRef = useRef<HTMLDivElement>(null);
  const [dropSide, setDropSide] = useState<"before" | "after" | null>(null);
  const { dragKey, onDropStep, index } = props;
  const droppable = Boolean(dragKey) && dragKey !== step.key;

  return (
    <div
      ref={cardRef}
      className={`relative ${dragKey === step.key ? "opacity-40" : ""}`}
      onDragOver={(e) => {
        if (!droppable) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setDropSide(e.clientY < r.top + r.height / 2 ? "before" : "after");
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={(e) => {
        e.preventDefault();
        const side = dropSide;
        setDropSide(null);
        if (dragKey && droppable) onDropStep(dragKey, side === "after" ? index + 1 : index);
      }}
    >
      {droppable && dropSide === "before" && <div className="absolute -top-1 left-0 right-0 z-10 h-1 rounded bg-blue-500" />}
      {droppable && dropSide === "after" && <div className="absolute -bottom-1 left-0 right-0 z-10 h-1 rounded bg-blue-500" />}
      {step.type === "WAIT" ? (
        <WaitCard {...props} cardRef={cardRef} submit={submit} state={state} disabled={disabled} pending={pending} />
      ) : (
        <EmailCard {...props} cardRef={cardRef} submit={submit} state={state} disabled={disabled} pending={pending} />
      )}
    </div>
  );
}

const STAT_ITEMS: { key: keyof StepStatsData; icon: string; label: string }[] = [
  { key: "sent", icon: "✉️", label: "Erhalten (verschickt)" },
  { key: "bounced", icon: "⚠️", label: "Bounce / Spam-Beschwerde" },
  { key: "opened", icon: "👁", label: "Geöffnet" },
  { key: "clicked", icon: "🖱", label: "Auf Link geklickt" },
];

/** Statistik einer E-Mail: Icons mit der Zahl schattiert darunter. */
export function StatsRow({ stats, tracking }: { stats?: StepStatsData; tracking: boolean }) {
  const s = stats ?? { sent: 0, bounced: 0, opened: 0, clicked: 0 };
  const pct = (n: number) => (s.sent ? `${Math.round((n / s.sent) * 100)} % der verschickten` : "noch nichts verschickt");
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-center" aria-label="Statistik">
      {STAT_ITEMS.map((it) => {
        const off = !tracking && (it.key === "opened" || it.key === "clicked");
        return (
          <div key={it.key} title={off ? `${it.label}: Messung ausgeschaltet` : `${it.label}: ${s[it.key]} (${it.key === "sent" ? "Anzahl" : pct(s[it.key])})`} className={off ? "opacity-40" : ""}>
            <div className="text-xl leading-none" aria-hidden="true">{it.icon}</div>
            <div className="mt-1 text-xs tabular-nums text-slate-400">{off ? "aus" : s[it.key]}</div>
            <div className="sr-only">{it.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function EmailCard({ step, index, total, testEmail, onMove, onRemove, setDragKey, cardRef, stats, tracking, submit, state, disabled, pending }: CardProps & { cardRef: React.RefObject<HTMLDivElement | null>; submit: (e: React.FormEvent<HTMLFormElement>) => void; state: ChainState; disabled: boolean; pending: boolean }) {
  const [open, setOpen] = useState(!step.subject);
  const [to, setTo] = useState(testEmail);
  const [testing, startTest] = useTransition();
  const [testState, setTestState] = useState<ChainState>();
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="text-sm font-semibold text-blue-900">✉️ E-Mail {step.saving && <span className="font-normal text-blue-600">· wird angelegt …</span>}</span>
          <span className="block truncate text-sm text-slate-600">{step.subject || "Noch kein Betreff – zum Bearbeiten öffnen"}</span>
        </button>
        <StepControls step={step} index={index} total={total} onMove={onMove} onRemove={onRemove} setDragKey={setDragKey} cardRef={cardRef} />
      </div>
      <StatsRow stats={stats} tracking={tracking} />
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <label className="block">
            <span className="label">Betreff</span>
            <input name="subject" defaultValue={step.subject} maxLength={300} className="input" placeholder="Willkommen, {{vorname}}!" />
          </label>
          <label className="block">
            <span className="label">Text</span>
            <textarea name="body" defaultValue={step.body} rows={9} className="input font-mono text-sm" placeholder={"Hallo {{vorname}},\n\nvielen Dank für deine Anfrage …"} />
          </label>
          <p className="text-xs text-slate-500">Platzhalter: <code>{"{{vorname}}"}</code>, <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>. Der Abmelde-Link wird automatisch angehängt.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={disabled} className="btn-primary">{pending ? "Speichern …" : "Speichern"}</button>
            <Status state={state} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-64 max-w-full" aria-label="Test-Empfänger" />
            <button type="button" disabled={testing || Boolean(step.saving)} className="btn-secondary" onClick={() => startTest(async () => setTestState(await sendTestStep(step.id, to)))}>
              {testing ? "Sende …" : "Test-Mail senden"}
            </button>
            <Status state={testState} />
          </div>
        </form>
      )}
    </div>
  );
}

const UNTIL_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: "am selben Tag (sonst am nächsten Tag)" },
  { days: 1, label: "am nächsten Tag" },
  { days: 2, label: "nach 2 Tagen" },
  { days: 3, label: "in 3 Tagen" },
  { days: 5, label: "in 5 Tagen" },
  { days: 7, label: "in 7 Tagen" },
  { days: 14, label: "in 14 Tagen" },
  { days: 30, label: "in 30 Tagen" },
];

function WaitCard({ step, index, total, onMove, onRemove, setDragKey, cardRef, submit, state, disabled, pending }: CardProps & { cardRef: React.RefObject<HTMLDivElement | null>; submit: (e: React.FormEvent<HTMLFormElement>) => void; state: ChainState; disabled: boolean; pending: boolean }) {
  const [mode, setMode] = useState<"duration" | "until">(step.waitTime ? "until" : "duration");
  const [unit, setUnit] = useState<StepData["waitUnit"]>(step.waitUnit);
  const [days, setDays] = useState(step.waitTime ? step.waitValue : 1);
  const untilOptions = UNTIL_OPTIONS.some((o) => o.days === days) ? UNTIL_OPTIONS : [...UNTIL_OPTIONS, { days, label: `in ${days} Tagen` }].sort((x, y) => x.days - y.days);
  const radio = "flex items-center gap-2 text-sm text-amber-900";
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-amber-900">⏱ Wartezeit {step.saving && <span className="font-normal text-amber-700">· wird angelegt …</span>}</span>
        <StepControls step={step} index={index} total={total} onMove={onMove} onRemove={onRemove} setDragKey={setDragKey} cardRef={cardRef} />
      </div>
      <form onSubmit={submit} className="mt-2 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <label className={radio}>
            <input type="radio" name="waitMode" checked={mode === "duration"} onChange={() => setMode("duration")} className="h-4 w-4" />
            ⏳ Eine Dauer abwarten
          </label>
          <label className={radio}>
            <input type="radio" name="waitMode" checked={mode === "until"} onChange={() => setMode("until")} className="h-4 w-4" />
            🕗 Bis zu einer Uhrzeit warten
          </label>
        </div>

        {mode === "duration" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-amber-900">Warte</span>
            <input name="waitValue" type="number" min={1} defaultValue={step.waitTime ? 1 : step.waitValue} className="input !w-24" aria-label="Dauer" />
            <select name="waitUnit" value={unit} onChange={(e) => setUnit(e.target.value as StepData["waitUnit"])} className="input !w-auto" aria-label="Einheit">
              {Object.entries(UNITS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-amber-900">Warte bis</span>
              <select name="waitValue" value={days} onChange={(e) => setDays(Number(e.target.value))} className="input !w-auto" aria-label="Tag">
                {untilOptions.map((o) => (
                  <option key={o.days} value={o.days}>{o.label}</option>
                ))}
              </select>
              <span className="text-sm text-amber-900">um</span>
              <input name="waitTime" type="time" defaultValue={step.waitTime || "08:00"} required className="input !w-32" aria-label="Uhrzeit" />
              <span className="text-sm text-amber-900">Uhr</span>
            </div>
            <input type="hidden" name="waitUnit" value="DAYS" />
            <input type="hidden" name="useTime" value="on" />
            <p className="text-xs text-amber-800">
              {days === 0
                ? "Beim Erreichen dieses Schritts geht es am selben Tag zur gewählten Uhrzeit weiter. Ist diese bereits erreicht oder vorbei, geht es am nächsten Tag weiter."
                : days === 1
                  ? "Ab dem Erreichen dieses Schritts geht es am nächsten Kalendertag zur gewählten Uhrzeit weiter (deutsche Zeit)."
                  : `Ab dem Erreichen dieses Schritts geht es nach ${days} Kalendertagen zur gewählten Uhrzeit weiter (deutsche Zeit).`}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button disabled={disabled} className="btn-secondary !py-1.5 text-sm">{pending ? "…" : "Speichern"}</button>
          <Status state={state} />
        </div>
      </form>
    </div>
  );
}
