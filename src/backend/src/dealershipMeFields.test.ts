import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection } from "./db.js";
import { TEAMMATE_DEALERSHIP_FIELDS, dealershipViewFor } from "./routes/dealership.js";
import type { Dealership, StaffRole } from "./auth.js";

// GET /dealership/me used to hand the WHOLE stored dealership record to any
// signed-in teammate, including the Stripe customer and subscription ids and
// inviteEpoch (the counter behind cancelling shared invite links). The owner
// still gets everything; everyone else gets only what the app reads.

const runId = Date.now();
let counter = 0;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const storedDealership = (id: string) => readCollection<Dealership>("dealerships").find(d => d.id === id)!;

async function signup(tag: string) {
  counter += 1;
  const res = await request(app)
    .post("/auth/signup")
    .send({
      email: `dealer-me-${runId}-${tag}-${counter}@test.local`,
      password: "dealermetestpass123",
      name: `Dealer Me ${tag}`,
      dealershipName: `Dealer Me Motors ${tag} ${counter}`,
    });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, user: res.body.user as { id: string; dealershipId: string } };
}

async function joinStaff(ownerToken: string, staffRole: StaffRole) {
  const invite = await request(app)
    .post("/dealership/invite")
    .set(bearer(ownerToken))
    .send({ inviteeName: "Team Mate", staffRole });
  counter += 1;
  const res = await request(app)
    .post("/auth/join")
    .send({
      token: invite.body.token,
      name: `Team Mate ${staffRole}`,
      email: `dealer-me-${runId}-staff-${counter}@test.local`,
      password: "dealermetestpass123",
    });
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

const getMe = (token: string) => request(app).get("/dealership/me").set(bearer(token));

// Everything the app reads from this route, worked out from its callers (see
// the comment on TEAMMATE_DEALERSHIP_FIELDS): DealerContext reads id, name,
// phone, address, vatNumber; TrialBanner and BillingScreen read
// subscriptionStatus and trialEndsAt; BillingScreen reads pilotBrainEnabled;
// approvalStatus is what this route is documented as being open for.
const READ_BY_THE_APP = [
  "id",
  "name",
  "phone",
  "address",
  "vatNumber",
  "subscriptionStatus",
  "trialEndsAt",
  "pilotBrainEnabled",
  "approvalStatus",
];
const NEVER_FOR_TEAMMATES = ["stripeCustomerId", "stripeSubscriptionId", "inviteEpoch"];

let owner: { token: string; user: { id: string; dealershipId: string } };
const teammates = {} as Record<StaffRole, string>;

beforeAll(async () => {
  owner = await signup("owner");

  // A dealership that has every field set, as a paying one with a full profile
  // would: the profile details, an active subscription with Pilot Brain, both
  // Stripe ids, and a few cancelled generations of invite links.
  const dealerships = readCollection<Dealership>("dealerships");
  writeCollection(
    "dealerships",
    dealerships.map(d =>
      d.id === owner.user.dealershipId
        ? {
            ...d,
            phone: "01803 555 777",
            address: "Unit 4, Motor Park, Paignton",
            vatNumber: "GB123456789",
            subscriptionStatus: "active" as const,
            pilotBrainEnabled: true,
            stripeCustomerId: "cus_TEST123",
            stripeSubscriptionId: "sub_TEST123",
            inviteEpoch: 3,
          }
        : d
    )
  );

  for (const role of ["general", "sales", "finance", "manager"] as const) {
    teammates[role] = await joinStaff(owner.token, role);
  }
});

describe("GET /dealership/me for the owner", () => {
  it("is the whole stored record, Stripe ids and inviteEpoch included", async () => {
    const res = await getMe(owner.token);
    expect(res.status).toBe(200);
    expect(res.body.dealership).toEqual(storedDealership(owner.user.dealershipId));
    expect(res.body.dealership).toMatchObject({
      stripeCustomerId: "cus_TEST123",
      stripeSubscriptionId: "sub_TEST123",
      inviteEpoch: 3,
      ownerId: owner.user.id,
    });
  });
});

describe("GET /dealership/me for a teammate", () => {
  it.each(["general", "sales", "finance", "manager"] as const)(
    "%s staff get every field the app reads, and nothing else",
    async role => {
      const res = await getMe(teammates[role]);
      expect(res.status).toBe(200);
      const stored = storedDealership(owner.user.dealershipId);

      // exactly the fields the app reads — none missing, none extra
      expect(Object.keys(res.body.dealership).sort()).toEqual([...READ_BY_THE_APP].sort());
      // and with the real values
      for (const field of READ_BY_THE_APP) {
        expect(res.body.dealership[field], field).toEqual(stored[field as keyof Dealership]);
      }
      expect(res.body.dealership).toMatchObject({
        name: stored.name,
        phone: "01803 555 777",
        address: "Unit 4, Motor Park, Paignton",
        vatNumber: "GB123456789",
        subscriptionStatus: "active",
        pilotBrainEnabled: true,
      });
    }
  );

  it.each(["general", "sales"] as const)("%s staff get no Stripe ids and no inviteEpoch, anywhere in the reply", async role => {
    const res = await getMe(teammates[role]);
    for (const field of NEVER_FOR_TEAMMATES) {
      expect(res.body.dealership, field).not.toHaveProperty(field);
    }
    // not tucked into some other part of the reply either
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("cus_TEST123");
    expect(text).not.toContain("sub_TEST123");
    expect(text).not.toContain("inviteEpoch");
    expect(text).not.toContain("stripe");
  });

  it("still gets the trial and subscription fields the banner and billing screen need, for a dealership on a trial", async () => {
    const trial = await signup("trial");
    const staffToken = await joinStaff(trial.token, "general");
    const res = await getMe(staffToken);
    const stored = storedDealership(trial.user.dealershipId);

    expect(res.status).toBe(200);
    expect(res.body.dealership.subscriptionStatus).toBe("trialing");
    expect(res.body.dealership.trialEndsAt).toBe(stored.trialEndsAt);
    expect(new Date(res.body.dealership.trialEndsAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.body.dealership.name).toBe(stored.name);
    // a field that was never set stays absent, as it does in the owner's copy
    for (const field of ["phone", "address", "vatNumber", "pilotBrainEnabled"]) {
      expect(res.body.dealership, field).not.toHaveProperty(field);
    }
  });

  it("can still read the status of a dealership that is awaiting approval", async () => {
    const pending = await signup("pending");
    const staffToken = await joinStaff(pending.token, "sales");
    writeCollection(
      "dealerships",
      readCollection<Dealership>("dealerships").map(d =>
        d.id === pending.user.dealershipId ? { ...d, approvalStatus: "pending" as const } : d
      )
    );
    const res = await getMe(staffToken);
    expect(res.status).toBe(200);
    expect(res.body.dealership.approvalStatus).toBe("pending");
  });

  it("still needs a sign-in", async () => {
    expect((await request(app).get("/dealership/me")).status).toBe(401);
  });
});

describe("PUT /dealership/me", () => {
  it("stays owner-only: a teammate is refused and nothing changes", async () => {
    const before = storedDealership(owner.user.dealershipId);
    for (const role of ["general", "sales", "finance", "manager"] as const) {
      const res = await request(app).put("/dealership/me").set(bearer(teammates[role])).send({ name: "Hijacked" });
      expect(res.status, role).toBe(403);
    }
    expect(storedDealership(owner.user.dealershipId)).toEqual(before);
  });

  it("gives the owner back the full record, as before", async () => {
    const res = await request(app)
      .put("/dealership/me")
      .set(bearer(owner.token))
      .send({ phone: "01803 000 111" });
    expect(res.status).toBe(200);
    expect(res.body.dealership).toEqual(storedDealership(owner.user.dealershipId));
    expect(res.body.dealership).toMatchObject({ stripeCustomerId: "cus_TEST123", inviteEpoch: 3, phone: "01803 000 111" });
  });
});

describe("dealershipViewFor", () => {
  const record: Dealership = {
    id: "d1",
    name: "Test Motors",
    ownerId: "u1",
    createdAt: "2030-01-01T00:00:00.000Z",
    subscriptionStatus: "active",
    trialEndsAt: "2030-01-15T00:00:00.000Z",
    stripeCustomerId: "cus_X",
    stripeSubscriptionId: "sub_X",
    inviteEpoch: 2,
  };

  it("gives the owner the record itself", () => {
    expect(dealershipViewFor({ role: "owner" }, record)).toBe(record);
  });

  it("gives staff only the whitelisted fields the record has", () => {
    expect(dealershipViewFor({ role: "staff" }, record)).toEqual({
      id: "d1",
      name: "Test Motors",
      subscriptionStatus: "active",
      trialEndsAt: "2030-01-15T00:00:00.000Z",
    });
  });

  it("does not copy a field into the view just because it is listed: absent stays absent", () => {
    const view = dealershipViewFor({ role: "staff" }, record);
    expect(Object.keys(view)).not.toContain("phone");
    expect(Object.keys(view)).not.toContain("pilotBrainEnabled");
  });

  it("the whitelist is exactly the list derived from the callers", () => {
    expect([...TEAMMATE_DEALERSHIP_FIELDS].sort()).toEqual([...READ_BY_THE_APP].sort());
  });
});

// The list above was worked out from the screens that call this route. This
// reads those screens' source so it stays true: a screen that starts reading
// some other field of the dealership fails here until the field is deliberately
// added to the list (and so shown to teammates), and a field left on the list
// that no screen reads has to be explained.
describe("the whitelist against the web screens that call /dealership/me", () => {
  // Vitest is run from src/backend (see vitest.config.ts), so the web code is one folder up.
  const webSrc = path.resolve(process.cwd(), "..");
  const callers = ["context/DealerContext.tsx", "components/TrialBanner.tsx", "screens/BillingScreen.tsx"];

  const readByCallers = new Set<string>();
  for (const file of callers) {
    const source = fs.readFileSync(path.join(webSrc, file), "utf8");
    if (!source.includes("/dealership/me")) throw new Error(`${file} no longer calls /dealership/me: update this test`);
    for (const match of source.matchAll(/\bdealership\??\.(\w+)/g)) {
      if (match[1]) readByCallers.add(match[1]);
    }
  }

  it("every field a caller reads is one teammates are allowed to see", () => {
    const allowed = new Set<string>(TEAMMATE_DEALERSHIP_FIELDS);
    for (const field of readByCallers) expect(allowed.has(field), `${field} is read by a screen`).toBe(true);
  });

  it("no field is on the list unless a screen reads it, apart from the documented approvalStatus", () => {
    const unread = TEAMMATE_DEALERSHIP_FIELDS.filter(field => !readByCallers.has(field));
    expect(unread).toEqual(["approvalStatus"]);
  });

  it("no screen reads a Stripe id or inviteEpoch", () => {
    for (const field of NEVER_FOR_TEAMMATES) expect(readByCallers.has(field), field).toBe(false);
  });
});
