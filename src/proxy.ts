import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/signup", "/forgot-password", "/reset-password", "/api/cron"];

// Fast, optimistic gate: bounce visitors without a session cookie to the login
// page. Real session and role checks happen on the server in every layout,
// page and action.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.has("lb_session")) return NextResponse.next();
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
