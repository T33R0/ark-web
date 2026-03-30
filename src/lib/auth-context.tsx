"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type AuthRole = "admin" | "spectator" | null;

interface AuthContextValue {
  role: AuthRole;
  loading: boolean;
  login: (key: string) => Promise<boolean>;
  enterSpectator: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

const COOKIE_NAME = "ark_role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AuthRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getCookie(COOKIE_NAME);
    if (stored === "admin" || stored === "spectator") {
      setRole(stored);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (key: string): Promise<boolean> => {
    const res = await fetch("/api/auth/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setCookie(COOKIE_NAME, "admin", 30);
      setRole("admin");
      return true;
    }
    return false;
  }, []);

  const enterSpectator = useCallback(() => {
    setCookie(COOKIE_NAME, "spectator", 7);
    setRole("spectator");
  }, []);

  const logout = useCallback(() => {
    deleteCookie(COOKIE_NAME);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ role, loading, login, enterSpectator, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
