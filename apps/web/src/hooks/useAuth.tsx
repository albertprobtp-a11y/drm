import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UserPublic } from "@secureview/shared";
import { apiFetch, ApiError } from "../lib/api";

interface AuthContextValue {
  user: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<UserPublic>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await apiFetch<UserPublic>("/auth/login", { method: "POST", body: { email, password } });
    setUser(result);
  }

  async function register(email: string, password: string, name: string) {
    const result = await apiFetch<UserPublic>("/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    setUser(result);
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}

export { ApiError };
