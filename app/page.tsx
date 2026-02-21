import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decodeCookieValue, DEV_AUTH_COOKIE } from "@/lib/auth";

/**
 * Entry route for the app.
 * Redirects authenticated users to `/dashboard`, otherwise to `/login`.
 * Uses local browser cookie storage only.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const email = decodeCookieValue(cookieStore.get(DEV_AUTH_COOKIE)?.value);

  if (email) {
    redirect("/dashboard");
  }

  redirect("/login");
}
