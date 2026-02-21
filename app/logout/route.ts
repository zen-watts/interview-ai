import { NextResponse } from "next/server";

import { DEV_AUTH_COOKIE } from "@/lib/auth";

/**
 * Logout endpoint.
 * - Clears local auth cookie.
 * - Redirects back to `/login`.
 */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set({
    name: DEV_AUTH_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
