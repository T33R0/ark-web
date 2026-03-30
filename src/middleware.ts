import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const PUBLIC_API_PATHS = ["/api/auth/", "/api/access-request"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate API mutations
  if (!pathname.startsWith("/api/") || !MUTATING_METHODS.has(req.method)) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const role = req.cookies.get("ark_role")?.value;
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Spectator mode — read-only access" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
