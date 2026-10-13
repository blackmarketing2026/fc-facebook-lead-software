import { NextResponse, type NextRequest } from "next/server";
import { PLATFORM_TENANT_SLUG, slugFromPath, TENANT_HEADER, tenantLoginPath } from "@/lib/tenant-paths";

// /suspended: Hinweis für gesperrte Dashboards.
const PUBLIC_SUBPATHS = ["/login", "/suspended"];

// Jeder Mandant liegt unter /<slug>/…. Grobe Vorprüfung: ohne Session-Cookie geht es zur Login-Seite
// des Mandanten. Die echte Prüfung (Signatur, Mandant, Rolle, aktiver Benutzer) passiert serverseitig.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const slug = slugFromPath(pathname);

  // Immer neu setzen, damit niemand den Mandanten per eigenem Header vorgeben kann.
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  if (pathname === "/login") {
    headers.set(TENANT_HEADER, PLATFORM_TENANT_SLUG);
    return NextResponse.rewrite(new URL(`/${PLATFORM_TENANT_SLUG}/login`, request.url), { request: { headers } });
  }
  if (!slug) return NextResponse.next({ request: { headers } });
  headers.set(TENANT_HEADER, slug);

  const subpath = pathname.slice(slug.length + 1) || "/";
  const isPublic = PUBLIC_SUBPATHS.some((p) => subpath.startsWith(p));
  const isApi = subpath.startsWith("/api/");
  // Das Session-Cookie gilt nur für /<slug>, der Browser schickt es also nur für diesen Mandanten mit.
  if (!request.cookies.has("lc_session") && !isPublic && !isApi) {
    return NextResponse.redirect(new URL(tenantLoginPath(slug), request.url));
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|sw.js|icon.svg).*)"],
};
