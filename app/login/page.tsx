"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DEV_AUTH_COOKIE, isSupabaseConfigured } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

/**
 * Login page with two modes:
 * - Supabase mode (when env vars are configured): uses email/password auth APIs.
 * - Local dev mode (no Supabase yet): writes a local auth cookie for fast local iteration.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabaseEnabled = isSupabaseConfigured();
  // Only create a browser client when Supabase is configured.
  const supabase = useMemo(() => (supabaseEnabled ? createClient() : null), [supabaseEnabled]);

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    // Fallback auth path used during early development without Supabase.
    if (!supabaseEnabled || !supabase) {
      document.cookie = `${DEV_AUTH_COOKIE}=${encodeURIComponent(email)}; Path=/; Max-Age=604800; SameSite=Lax`;
      router.push("/dashboard");
      router.refresh();
      setLoading(false);
      return;
    }

    // Standard sign-in path against Supabase Auth.
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }

      setLoading(false);
      return;
    }

    // Standard sign-up path against Supabase Auth.
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
    } else if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setMessage("Account created. Check your inbox if email confirmation is enabled.");
    }

    setLoading(false);
  };

  return (
    <main>
      <h1>Login</h1>
      <p>Sign in or create an account with email + password.</p>
      {!supabaseEnabled ? <p>Local dev auth mode is enabled (Supabase not configured).</p> : null}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Working..." : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          style={{ cursor: "pointer" }}
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>

      {message ? <p>{message}</p> : null}
    </main>
  );
}
