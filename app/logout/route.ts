import { NextResponse } from "next/server";

import { DEV_AUTH_COOKIE, isSupabaseConfigured } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Logout endpoint.
 * - Signs out from Supabase when configured.
 * - Always clears local dev auth cookie.
 * - Redirects back to `/login`.
 */
export async function GET(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  // Clearing this cookie is harmless in Supabase mode and required in local fallback mode.
  response.cookies.set({
    name: DEV_AUTH_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
