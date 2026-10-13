import { Closings } from "@/components/closings";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Abschlüsse" };

export default async function ClosingsPage(props: PageProps<"/[tenant]/closings">) {
  const user = await requireUser();
  const filter = await props.searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Abschlüsse</h1>
        <p className="text-sm text-slate-500">
          {user.role === "ADMIN"
            ? "Alle abgeschlossenen Leads dieses Dashboards mit Provisionseinnahme."
            : "Deine abgeschlossenen Leads mit Provisionseinnahme. Die Provision trägst du beim Status „Abgeschlossen“ im Lead ein."}
        </p>
      </div>
      <Closings user={user} filter={filter} path="/closings" />
    </div>
  );
}
