import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { DIFFERENT_DEALERSHIP_CODE } from "./auth.js";
import { readCollection, writeCollection, deleteTenantData } from "./db.js";

// Browser tabs share one login. Sign in to a second dealership in a second tab
// and the first tab keeps showing its own dealership while every request it
// sends now carries the OTHER dealership's login: its whole-list save then
// replaced that dealership's leads with the first one's. The web app now says,
// on every request, which dealership the tab was loaded for (X-Dealership-Id),
// and the server refuses a request whose claim is not the login's dealership.

const runId = Date.now();
const emails: string[] = [];
const dealershipIds: string[] = [];

afterAll(() => {
  writeCollection("users", readCollection<any>("users").filter(u => !emails.includes(u.email)));
  writeCollection("dealerships", readCollection<any>("dealerships").filter(d => !dealershipIds.includes(d.id)));
  for (const id of dealershipIds) deleteTenantData(id);
});

async function signup(tag: string) {
  const email = `dealership-claim-${runId}-${tag}@test.local`;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email, password: "dealershipclaimpass123", name: `Claim ${tag}`, dealershipName: `Claim Dealership ${tag}` });
  emails.push(email);
  dealershipIds.push(res.body.user.dealershipId);
  return { token: res.body.token as string, dealershipId: res.body.user.dealershipId as string };
}

const lead = (name: string) => ({ id: `id-${name}`, name, status: "new" });
const names = (items: { name: string }[]) => items.map(l => l.name);

describe("a request that says which dealership it was loaded for", () => {
  it("goes through when that is the login's own dealership", async () => {
    const alpha = await signup("own");
    const res = await request(app).get("/leads").set("Authorization", `Bearer ${alpha.token}`).set("X-Dealership-Id", alpha.dealershipId);
    expect(res.status).toBe(200);
    const saved = await request(app)
      .put("/leads")
      .set("Authorization", `Bearer ${alpha.token}`)
      .set("X-Dealership-Id", alpha.dealershipId)
      .send({ items: [lead("One")] });
    expect(saved.status).toBe(200);
  });

  it("goes through when it says nothing, as the phone app and older tabs do", async () => {
    const alpha = await signup("silent");
    const res = await request(app).put("/leads").set("Authorization", `Bearer ${alpha.token}`).send({ items: [lead("One")] });
    expect(res.status).toBe(200);
  });

  it("is refused, reads and saves alike, when the login is another dealership's", async () => {
    const alpha = await signup("alpha");
    const bravo = await signup("bravo");
    // Alpha's tab, but the shared login is now Bravo's.
    const read = await request(app).get("/leads").set("Authorization", `Bearer ${bravo.token}`).set("X-Dealership-Id", alpha.dealershipId);
    expect(read.status).toBe(409);
    expect(read.body.code).toBe(DIFFERENT_DEALERSHIP_CODE);
    expect(read.body.error).toMatch(/different dealership/i);

    const save = await request(app)
      .put("/leads")
      .set("Authorization", `Bearer ${bravo.token}`)
      .set("X-Dealership-Id", alpha.dealershipId)
      .send({ items: [lead("AlphaA")] });
    expect(save.status).toBe(409);
    expect(save.body.code).toBe(DIFFERENT_DEALERSHIP_CODE);
  });

  it("writes nothing into the other dealership: its one lead is not replaced and is not binned", async () => {
    const alpha = await signup("replay-alpha");
    const bravo = await signup("replay-bravo");
    await request(app).put("/leads").set("Authorization", `Bearer ${bravo.token}`).send({ items: [lead("BravoOnly")] });

    // The case that used to succeed: the target has one lead or none, so the
    // "too many removed at once" guard did not stop it.
    const save = await request(app)
      .put("/leads")
      .set("Authorization", `Bearer ${bravo.token}`)
      .set("X-Dealership-Id", alpha.dealershipId)
      .send({ items: [lead("AlphaA"), lead("AlphaB"), lead("AlphaC")] });
    expect(save.status).toBe(409);

    const after = await request(app).get("/leads").set("Authorization", `Bearer ${bravo.token}`);
    expect(names(after.body.items)).toEqual(["BravoOnly"]);
    const bin = await request(app).get("/recently-deleted").set("Authorization", `Bearer ${bravo.token}`);
    expect(bin.body.items).toEqual([]);
  });

  it("is refused on every protected route, not just the lists", async () => {
    const alpha = await signup("routes-alpha");
    const bravo = await signup("routes-bravo");
    for (const path of ["/inventory", "/bookkeeping", "/staff", "/dealership/me"]) {
      const res = await request(app).get(path).set("Authorization", `Bearer ${bravo.token}`).set("X-Dealership-Id", alpha.dealershipId);
      expect(res.status, path).toBe(409);
    }
  });
});
