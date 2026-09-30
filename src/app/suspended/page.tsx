import { displayName, getTenant } from "@/lib/tenant";

export const metadata = { title: "Gesperrt" };

export default async function SuspendedPage() {
  const tenant = await getTenant();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">{displayName(tenant)}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Dieses Dashboard ist derzeit gesperrt. Bitte wende dich an Function Concept.
        </p>
      </div>
    </main>
  );
}
