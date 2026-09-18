import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuthToken, setAuthToken, authHeaders } from "@/lib/authToken";

import { BASE_URL } from "@/lib/apiBaseUrl";

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

// "pending" = a brand-new dealership a platform admin hasn't approved yet
// (see requireApprovedDealership on the backend). Anything else,
// including an older account that predates the gate, is "approved".
export type ApprovalStatus = "pending" | "approved";

interface AuthContextType {
  user: AuthUser | null;
  approvalStatus: ApprovalStatus;
  refreshApprovalStatus: () => Promise<void>;
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
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("approved");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => {
        setUser(data.user);
        setApprovalStatus(data.approvalStatus === "pending" ? "pending" : "approved");
      })
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false));
  }, []);

  // Lets the "awaiting approval" screen's Check Again button re-read the
  // real status without forcing a full logout/login.
  async function refreshApprovalStatus() {
    try {
      const res = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const next: ApprovalStatus = data.approvalStatus === "pending" ? "pending" : "approved";

      // Every data provider (inventory, bookkeeping, leads...) already
      // tried to load while this dealership was pending, got blocked by
      // the gate, and fell back to in-memory demo data that was never
      // persisted. Just flipping the status would render the dashboard
      // over that stale in-memory state, out of sync with a server that
      // holds nothing. One clean reload is the reliable way to have
      // every provider start over against the now-approved account.
      if (approvalStatus === "pending" && next === "approved") {
        window.location.reload();
        return;
      }
      setApprovalStatus(next);
    } catch {
      // Leave the current status alone on a network blip.
    }
  }

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
      setApprovalStatus(data.approvalStatus === "pending" ? "pending" : "approved");
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
      setApprovalStatus(data.approvalStatus === "pending" ? "pending" : "approved");
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
      setApprovalStatus(data.approvalStatus === "pending" ? "pending" : "approved");
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server — is the backend running?" };
    }
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
    setApprovalStatus("approved");
  }

  return (
    <AuthContext.Provider
      value={{ user, approvalStatus, refreshApprovalStatus, loading, login, signup, joinDealership, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
