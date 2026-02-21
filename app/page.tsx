import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decodeCookieValue, DEV_AUTH_COOKIE, isSupabaseConfigured } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Entry route for the app.
 * Redirects authenticated users to `/dashboard`, otherwise to `/login`.
 * Supports both Supabase auth mode and local cookie-based dev auth mode.
 */
export default async function HomePage() {
  // Production-ready auth path: read current user from Supabase session cookies.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  } else {
    // Local dev fallback path when Supabase env vars are not configured.
    const cookieStore = await cookies();
    const email = decodeCookieValue(cookieStore.get(DEV_AUTH_COOKIE)?.value);
    if (email) {
      redirect("/dashboard");
    }
  }

  redirect("/login");
}
