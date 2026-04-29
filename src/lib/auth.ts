/**
 * LocalFlow Auth — client-side helpers for cookie-based JWT auth.
 *
 * The actual auth state lives server-side in SQLite.
 * These helpers are thin wrappers around the REST API.
 */

export interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
}

export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || "Something went wrong" };
  }
  return { success: true, user: data.user };
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || "Something went wrong" };
  }
  return { success: true, user: data.user };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.user : null;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

export function loginWithGoogle(): void {
  window.location.href = "/api/auth/google";
}
