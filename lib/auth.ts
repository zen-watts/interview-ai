// Cookie key for local-development auth fallback (used only when Supabase is not configured).
export const DEV_AUTH_COOKIE = "dev_auth_email";

/**
 * Returns true when required Supabase public env vars are available.
 * This toggles the app between Supabase auth mode and local fallback mode.
 */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Safely decodes a cookie value. Returns `null` for empty input.
 * Falls back to original value if decode fails.
 */
export function decodeCookieValue(value: string | undefined) {
  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
