import { redirect } from "next/navigation";

export default async function TenantHome(props: PageProps<"/[tenant]">) {
  const { tenant } = await props.params;
  redirect(`/${tenant}/dashboard`);
}
