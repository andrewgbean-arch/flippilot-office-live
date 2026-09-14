import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuthToken, setAuthToken, authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

export type StaffRole = "sales" | "finance" | "manager" | "general";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "staff";
  staffRole?: StaffRole;
  dealershipId: string;
};

type AuthResult = { ok: true } | { ok: false; error: string };

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (
    name: string,
    dealershipName: string,
    email: string,
    password: string
  ) => Promise<AuthResult>;
  joinDealership: (
    token: string,
    name: string,
    email: string,
    password: string
  ) => Promise<AuthResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setUser(data.user))
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<AuthResult> {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? "Login failed" };

      setAuthToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server — is the backend running?" };
    }
  }

  async function signup(
    name: string,
    dealershipName: string,
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dealershipName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? "Signup failed" };

      setAuthToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server — is the backend running?" };
    }
  }

  async function joinDealership(
    token: string,
    name: string,
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const res = await fetch(`${BASE_URL}/auth/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? "Failed to join dealership" };

      setAuthToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server — is the backend running?" };
    }
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, joinDealership, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
