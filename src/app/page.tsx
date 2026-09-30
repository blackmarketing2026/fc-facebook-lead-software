import { redirect } from "next/navigation";
import { PLATFORM_TENANT_SLUG, tenantPath } from "@/lib/tenant-paths";

export default function Home() {
  redirect(tenantPath(PLATFORM_TENANT_SLUG));
}
