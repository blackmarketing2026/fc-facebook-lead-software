import { ACCESS_DENIED_MESSAGE } from "@/lib/access-lock";
import { displayName, getTenant } from "@/lib/tenant";
export const metadata = { title: ACCESS_DENIED_MESSAGE };
export default async function DeniedPage() {
  const tenant = await getTenant();
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <section role="alert" className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-3xl" aria-hidden="true">⛔</div>
      <p className="mb-2 text-sm font-semibold tracking-wide text-slate-500">{displayName(tenant)}</p>
      <h1 className="text-2xl font-bold text-red-700">{ACCESS_DENIED_MESSAGE}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Dieser Zugang wurde gesperrt. Bitte wende dich bei Fragen an Function Concept.</p>
    </section>
  </main>;
}
