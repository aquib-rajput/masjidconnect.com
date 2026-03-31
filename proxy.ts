import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getIdentityFromClaims, resolveDatabaseIdentity } from "@/lib/auth/server";

const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/shura(.*)", "/feed(.*)"]);
const isAuthRoute = createRouteMatcher(["/auth(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();
  const pathname = request.nextUrl.pathname;

  if (!userId && isProtectedRoute(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(url);
  }

  if (userId) {
    if (isAuthRoute(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      return NextResponse.redirect(url);
    }

    const { email, fullName, avatarUrl } = getIdentityFromClaims(sessionClaims);
    const { role } = await resolveDatabaseIdentity({
      clerkUserId: userId,
      email,
      fullName,
      avatarUrl,
      ensureProfile: false,
    });

    const userRole = role ?? "member";

    if (pathname.startsWith("/admin") && userRole !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/shura") && !["admin", "shura"].includes(userRole)) {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
