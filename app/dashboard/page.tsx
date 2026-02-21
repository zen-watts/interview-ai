import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as: {user.email}</p>
      <Link href="/logout">Log out</Link>
    </main>
  );
}
