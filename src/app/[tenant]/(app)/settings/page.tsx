import { redirect } from "next/navigation";

export default async function SettingsIndex(props: PageProps<"/[tenant]/settings">) {
  const { tenant } = await props.params;
  redirect(`/${tenant}/settings/users`);
}
