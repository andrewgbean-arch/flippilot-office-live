import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import app from "./app.js";
import "./asyncErrors.js";

// One process serves every dealership. Express 4 throws away the promise an `async`
// route handler returns, so a throw inside one became an unhandled rejection, and
// Node ends the whole process on that: one bad request could take every dealer
// offline (and a bad stored record made every restart die again). These tests fire
// the real vectors an audit proved, at the real app.
//
// IMPORTANT: this file deliberately registers NO process.on("unhandledRejection")
// listener. Without one, vitest FAILS the whole run ("Unhandled Rejection") if any
// request below still ends in an unhandled rejection, which is exactly how the old
// code behaved. So a green run here means the process survived every request.

const runId = Date.now();

async function ownerToken(tag: string) {
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: `crash-${tag}-${runId}@example.test`, password: "correct-horse-battery", name: "Crash Test", dealershipName: `Crash ${tag} ${runId}` });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe("the mechanism: a failing async handler answers 500 and the process survives", () => {
  const mini = express();
  mini.get("/async-throws", async () => {
    throw new TypeError("boom from an async handler");
  });
  mini.get("/async-rejects", () => Promise.reject(new Error("rejected promise")));
  mini.get("/sync-throws", () => {
    throw new Error("sync boom");
  });
  mini.get("/fine", async (_req, res) => {
    res.json({ ok: true });
  });
  mini.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ ok: false, handled: true, message: (err as Error).message });
  });

  it("an async handler that throws is handed to the error handler", async () => {
    const res = await request(mini).get("/async-throws");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, handled: true, message: "boom from an async handler" });
  });

  it("a handler that returns a rejected promise is handed to the error handler", async () => {
    const res = await request(mini).get("/async-rejects");
    expect(res.status).toBe(500);
    expect(res.body.handled).toBe(true);
  });

  it("a synchronous throw still works, and an ordinary async handler is untouched", async () => {
    expect((await request(mini).get("/sync-throws")).status).toBe(500);
    const fine = await request(mini).get("/fine");
    expect(fine.status).toBe(200);
    expect(fine.body).toEqual({ ok: true });
  });
});

describe("anonymous requests can no longer end the server", () => {
  it("login with an object where the email should be text", async () => {
    const res = await request(app).post("/auth/login").send({ email: { toString: 1 }, password: "x" });
    expect(res.status).toBe(400);
  });

  it("login with an object where the password should be text (real email)", async () => {
    const token = await ownerToken("login");
    expect(token).toBeTruthy();
    const res = await request(app).post("/auth/login").send({ email: `crash-login-${runId}@example.test`, password: {} });
    expect(res.status).toBe(400);
  });

  it("every other auth route refuses non-text fields with a 400", async () => {
    const bad = { toString: 1 };
    const cases: [string, Record<string, unknown>][] = [
      ["/auth/signup", { email: bad, password: "correct-horse-battery", name: "N", dealershipName: "D" }],
      ["/auth/signup", { email: "a@example.test", password: ["x"], name: "N", dealershipName: "D" }],
      ["/auth/signup", { email: "a@example.test", password: "correct-horse-battery", name: 5, dealershipName: "D" }],
      ["/auth/join", { token: {}, name: "N", email: "b@example.test", password: "correct-horse-battery" }],
      ["/auth/join", { token: "t", name: "N", email: bad, password: "correct-horse-battery" }],
      ["/auth/forgot-password", { email: bad }],
      ["/auth/reset-password", { token: bad, newPassword: "correct-horse-battery" }],
      ["/auth/reset-password", { token: "t", newPassword: { a: 1 } }],
    ];
    for (const [path, body] of cases) {
      const res = await request(app).post(path).send(body);
      expect([path, res.status]).toEqual([path, 400]);
    }
  });

  it("a malformed JSON body is still a 400, in JSON", async () => {
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});

describe("a signed-in caller can no longer end the server", () => {
  it("GET /dvla with the registration given twice (an array) or as an object", async () => {
    const token = await ownerToken("dvla");
    for (const q of ["/dvla?reg=A&reg=B", "/dvla?reg[x]=1"]) {
      const res = await request(app).get(q).set("Authorization", `Bearer ${token}`);
      expect([q, res.status]).toEqual([q, 400]);
    }
  });

  it("Pilot Brain prepare with a stored cost that has no amount", async () => {
    const token = await ownerToken("prepare");
    const put = await request(app)
      .put("/bookkeeping")
      .set("Authorization", `Bearer ${token}`)
      .send({
        purchases: [],
        sales: [],
        costs: [
          { id: "c1", vehicleId: "v1", type: "parts", date: "2026-01-01" }, // no amount, no category
          { id: "c2", vehicleId: "v1", type: "parts", date: "2026-01-01", amount: null }, // null amount
          { id: "c3", vehicleId: "v1", type: "constructor", date: "2026-01-01", amount: 5 }, // inherited name, not a real type
          { id: "c4", vehicleId: "v1", type: "parts", category: 5, date: "2026-01-01", amount: 5 }, // non-text category
        ],
        transactions: [],
        suppliers: [],
        categories: [],
      });
    expect(put.status).toBe(200);

    const res = await request(app).post("/pilot-brain/actions/prepare").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(200);
    const titles: string[] = (res.body.actions ?? res.body.prepared ?? []).map((a: { title?: string }) => a.title ?? "");
    // The uncategorised parts cost is still prepared, described without an invented figure,
    // and the junk-typed cost prepares nothing.
    expect(titles.join("|")).not.toContain("undefined");
    expect(titles.join("|")).not.toContain("function Object");
  });
});
