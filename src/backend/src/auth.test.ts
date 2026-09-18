import { describe, it, expect, vi, beforeAll } from "vitest";

// auth.ts imports db.ts (requireAuth looks the account up in `users`),
// and db.ts opens the real SQLite file the moment it's imported. These
// are pure-function tests that never touch storage, so keep them off
// the real database — otherwise this file would open the same file
// integration.test.ts is using, from a parallel worker, on a fresh
// checkout where neither has created it yet.
vi.mock("./db", () => ({ readCollection: vi.fn(() => []) }));

beforeAll(() => {
  // getJwtSecret() reads process.env lazily, not at import time — see
  // its own comment in auth.ts about why (bit by the opposite bug
  // twice already this project). Setting it here before any test runs
  // is enough; no .env file needed for these tests.
  process.env.JWT_SECRET = "test-secret-do-not-use-in-real-env";
});

// Dynamic import AFTER the env var is set, for the same lazy-read reason.
async function loadAuth() {
  return import("./auth.js");
}

function mockReqRes(user: any) {
  const req: any = { user };
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res: any = { status, json };
  const next = vi.fn();
  return { req, res, next, status, json };
}

describe("requireOwner", () => {
  it("passes an owner through", async () => {
    const { requireOwner } = await loadAuth();
    const { req, res, next, status } = mockReqRes({ role: "owner", dealershipId: "d1" });
    requireOwner(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("rejects a staff account with 403, regardless of staffRole", async () => {
    const { requireOwner } = await loadAuth();
    const { req, res, next, status } = mockReqRes({ role: "staff", staffRole: "manager", dealershipId: "d1" });
    requireOwner(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});

describe("requireStaffRole", () => {
  it("always passes the owner, even with an allowed list that would exclude any staffRole", async () => {
    const { requireStaffRole } = await loadAuth();
    const { req, res, next } = mockReqRes({ role: "owner", dealershipId: "d1" });
    requireStaffRole("manager")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes a staff account whose staffRole is in the allowed list", async () => {
    const { requireStaffRole } = await loadAuth();
    const { req, res, next } = mockReqRes({ role: "staff", staffRole: "finance", dealershipId: "d1" });
    requireStaffRole("finance", "manager")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a staff account whose staffRole is not in the allowed list, with a clear message", async () => {
    const { requireStaffRole } = await loadAuth();
    const { req, res, next, status, json } = mockReqRes({ role: "staff", staffRole: "sales", dealershipId: "d1" });
    requireStaffRole("finance", "manager")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: expect.stringContaining("sales") })
    );
  });

  it("treats a staff account with no staffRole set (pre-existing accounts) as the most restrictive tier, not silently granted access", async () => {
    const { requireStaffRole } = await loadAuth();
    const { req, res, next, status } = mockReqRes({ role: "staff", dealershipId: "d1" }); // staffRole omitted
    requireStaffRole("finance", "manager")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});

describe("token signing/verification round trip", () => {
  it("carries staffRole through sign → verify", async () => {
    const { signToken, verifyToken } = await loadAuth();
    const token = signToken({
      id: "u1",
      email: "a@b.com",
      name: "Test",
      role: "staff",
      staffRole: "manager",
      dealershipId: "d1",
    });
    const decoded = verifyToken(token);
    expect(decoded?.staffRole).toBe("manager");
    expect(decoded?.dealershipId).toBe("d1");
  });

  it("rejects a token with no dealershipId (pre-multi-tenancy tokens)", async () => {
    const jwt = await import("jsonwebtoken");
    const { verifyToken } = await loadAuth();
    const staleToken = jwt.sign(
      { id: "u1", email: "a@b.com", name: "Test", role: "owner" }, // no dealershipId
      process.env.JWT_SECRET!
    );
    expect(verifyToken(staleToken)).toBeNull();
  });
});

describe("invite token round trip", () => {
  it("carries staffRole and inviteeName through sign → verify", async () => {
    const { signInviteToken, verifyInviteToken } = await loadAuth();
    const token = signInviteToken({
      dealershipId: "d1",
      dealershipName: "Test Motors",
      role: "staff",
      staffRole: "sales",
      inviteeName: "Sarah",
    });
    const decoded = verifyInviteToken(token);
    expect(decoded?.staffRole).toBe("sales");
    expect(decoded?.inviteeName).toBe("Sarah");
    expect(decoded?.dealershipId).toBe("d1");
  });

  it("rejects a normal login token if passed to verifyInviteToken (different purpose)", async () => {
    const { signToken, verifyInviteToken } = await loadAuth();
    const loginToken = signToken({
      id: "u1", email: "a@b.com", name: "Test", role: "owner", dealershipId: "d1",
    });
    expect(verifyInviteToken(loginToken)).toBeNull();
  });
});
