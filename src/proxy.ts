import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

// Grobe Vorprüfung: ohne Session-Cookie geht es zur Login-Seite.
// Die echte Prüfung (Signatur, Rolle, aktiver Benutzer) passiert serverseitig in jeder Seite/Action.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("lc_session");
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|icon.svg).*)"],
};
