import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decodeCookieValue, DEV_AUTH_COOKIE, isSupabaseConfigured } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Protected dashboard page.
 * Users are redirected to `/login` when no valid auth context exists.
 */
export default async function DashboardPage() {
  let email: string | null = null;

  // Supabase-backed auth path.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      redirect("/login");
    }

    email = user.email ?? null;
  } else {
    // Local dev auth fallback path.
    const cookieStore = await cookies();
    email = decodeCookieValue(cookieStore.get(DEV_AUTH_COOKIE)?.value);
    if (!email) {
      redirect("/login");
    }
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as: {email}</p>
      <Link href="/logout">Log out</Link>
    </main>
  );
}
