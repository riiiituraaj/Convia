const TOKEN_KEY = "convia_token";
const USER_KEY = "convia_user";

export interface AuthSession {
  access_token: string;
  user_id: string;
  email: string;
  full_name: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, session.access_token);
  window.localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      user_id: session.user_id,
      email: session.email,
      full_name: session.full_name,
    })
  );
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
