// Cookie key used to store local auth state in the browser.
export const DEV_AUTH_COOKIE = "dev_auth_email";

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
