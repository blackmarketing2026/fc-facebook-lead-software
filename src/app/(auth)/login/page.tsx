import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden · Function Concept - Facebook Lead Software" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Function Concept - Facebook Lead Software</h1>
        <p className="mt-1 text-sm text-slate-500">Bitte melde dich an.</p>
        <LoginForm />
      </div>
    </main>
  );
}
