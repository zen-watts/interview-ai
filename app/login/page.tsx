"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { DEV_AUTH_COOKIE } from "@/lib/auth";

type AuthMode = "signin" | "signup";

/**
 * Login page in local-only mode.
 * Stores the signed-in email in a browser cookie and redirects to `/dashboard`.
 */
export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (!email.trim()) {
      setMessage("Please enter an email.");
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setMessage("Please enter a password.");
      setLoading(false);
      return;
    }

    document.cookie = `${DEV_AUTH_COOKIE}=${encodeURIComponent(email)}; Path=/; Max-Age=604800; SameSite=Lax`;
    router.push("/dashboard");
    router.refresh();

    setLoading(false);
  };

  return (
    <main>
      <h1>Login</h1>
      <p>Sign in or create an account with email + password.</p>
      <p>Local browser storage auth mode is enabled.</p>

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
