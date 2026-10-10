import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { listChanges, readTenantCollection } from "./db.js";

// Correcting a customer's details (PUT /customers/:id): a mistyped number or a
// new email address, without deleting them and their consent record.

const runId = Date.now();
let counter = 0;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function signup(tag: string) {
  counter += 1;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: `cust-edit-${runId}-${tag}-${counter}@test.local`, password: "custedittestpass123", name: `Owner ${tag}`, dealershipName: `Edit Motors ${tag}` });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, d: res.body.user.dealershipId as string };
}

let owner: Awaited<ReturnType<typeof signup>>;
let salesToken = "";

beforeAll(async () => {
  owner = await signup("main");
  const invite = await request(app).post("/dealership/invite").set(bearer(owner.token)).send({ inviteeName: "Sam", staffRole: "sales" });
  const joined = await request(app)
    .post("/auth/join")
    .send({ token: invite.body.token, name: "Sam Sales", email: `cust-edit-${runId}-sam@test.local`, password: "custedittestpass123" });
  salesToken = joined.body.token;
});

async function addCustomer(extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/customers")
    .set(bearer(owner.token))
    .send({ name: "Jo Bloggs", phone: "07700 900111", email: "jo@example.com", emailConsent: { status: "opted_in", method: "signed form" }, ...extra });
  return res.body.entry as { id: string };
}
const edit = (id: string, body: object, token = salesToken) => request(app).put(`/customers/${id}`).set(bearer(token)).send(body);
const stored = (id: string) => readTenantCollection<Record<string, any>>(owner.d, "customers").find((c) => c.id === id)!;

describe("correcting a customer's details", () => {
  it("anyone on the team can fix their name, number, email, what they're after and the notes", async () => {
    const c = await addCustomer();
    const res = await edit(c.id, { name: "Jo Bloggs-Smith", phone: "07700 900222", email: "jo.new@example.com", vehicleInterests: "Small SUV", notes: "Prefers mornings" });
    expect(res.status).toBe(200);
    expect(stored(c.id)).toMatchObject({ name: "Jo Bloggs-Smith", phone: "07700 900222", email: "jo.new@example.com", vehicleInterests: "Small SUV", notes: "Prefers mornings" });
  });

  it("keeps their consent record exactly as it was", async () => {
    const c = await addCustomer();
    const before = stored(c.id).emailConsent;
    await edit(c.id, { phone: "07700 900333" });
    expect(stored(c.id).emailConsent).toEqual(before);
    expect(stored(c.id).emailConsent.status).toBe("opted_in");
  });

  it("an emptied box removes that detail, as long as an email or a phone is left", async () => {
    const c = await addCustomer({ vehicleInterests: "Estate" });
    const res = await edit(c.id, { email: "", vehicleInterests: "" });
    expect(res.status).toBe(200);
    expect(stored(c.id)).not.toHaveProperty("email");
    expect(stored(c.id)).not.toHaveProperty("vehicleInterests");
    expect(stored(c.id).phone).toBe("07700 900111");
  });

  it("refuses to leave them with no email and no phone, and changes nothing", async () => {
    const c = await addCustomer();
    const before = stored(c.id);
    const res = await edit(c.id, { email: "", phone: "  " });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Keep an email address or a phone number for them.");
    expect(stored(c.id)).toEqual(before);
  });

  it("an empty name is ignored rather than wiping it", async () => {
    const c = await addCustomer();
    await edit(c.id, { name: "   ", notes: "x" });
    expect(stored(c.id).name).toBe("Jo Bloggs");
  });

  it("the owner sees the correction in Change History, with who made it", async () => {
    const c = await addCustomer();
    await edit(c.id, { phone: "07700 900444" });
    const entry = listChanges(owner.d, { since: "2000-01-01", limit: 1000 }).find((e) => e.recordId === c.id && e.action === "changed");
    expect(entry).toMatchObject({ actorName: "Sam Sales", area: "Customers", recordLabel: "Jo Bloggs" });
    expect(entry!.changes).toEqual(expect.arrayContaining([{ field: "phone", before: "07700 900111", after: "07700 900444" }]));
  });

  it("another dealership's customer can't be touched", async () => {
    const c = await addCustomer();
    const other = await signup("other");
    const res = await edit(c.id, { name: "Hijacked" }, other.token);
    expect(res.status).toBe(404);
    expect(stored(c.id).name).toBe("Jo Bloggs");
  });
});
