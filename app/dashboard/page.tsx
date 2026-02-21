import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decodeCookieValue, DEV_AUTH_COOKIE } from "@/lib/auth";

/**
 * Protected dashboard page.
 * Users are redirected to `/login` when no valid auth context exists.
 * Auth state is read from local browser cookie storage.
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const email = decodeCookieValue(cookieStore.get(DEV_AUTH_COOKIE)?.value);
  if (!email) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as: {email}</p>
      <Link href="/logout">Log out</Link>
    </main>
  );
}
