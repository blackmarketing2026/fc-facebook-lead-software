import { redirect } from "next/navigation";
import { seesAllTenants } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";

export default async function TenantHome(props: PageProps<"/[tenant]">) {
  const { tenant } = await props.params;
  const user = await getCurrentUser();
  if (user && seesAllTenants(user)) redirect(`/${tenant}/platform`);
  redirect(`/${tenant}/dashboard`);
}
