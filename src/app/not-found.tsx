import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Nicht gefunden</h1>
      <p className="text-slate-500">Diese Seite gibt es nicht oder du hast keinen Zugriff darauf.</p>
      <Link href="/" className="btn-primary">
        Zur Startseite
      </Link>
    </main>
  );
}
