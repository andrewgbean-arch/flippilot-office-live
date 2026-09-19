import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hostedPhotoUrl } from "./photoStore.js";
import { mergeVehicleSave, parseDeletedIds } from "./inventoryMerge.js";

// A stale or partial screen must never delete cars — or their pictures —
// that someone else added. Saving stock adds and updates; a car is only
// removed when it is listed, on purpose, in `deletedIds`.
//
// The audit that led to this reproduced it with two sessions on one
// dealership: B loaded [c1, c2], A added c3 and two photos, then B saved a
// price edit from its old copy. The server went to [c1, c2] and, once the
// photos were a day old, deleted them too.

// ---- This file has a database of its own ------------------------------------
// The backend test files each run in their own process, and by default they all
// share ONE SQLite file that has no busy timeout. Two processes writing at the
// same moment then fail with "database is locked", and a write-heavy file added
// beside the others makes the whole run flaky (with this file sharing the
// database, integration.test.ts started failing at random). Signup has a related
// race of its own: it reads the whole users list, waits ~0.4s for the password
// hash, then writes that stale list back, wiping any account another process
// created in between.
//
// So this file points DATA_DIR at a private folder (inside the run's own private
// folder, so it is cleaned up with it) BEFORE the app is loaded. The app and
// database modules are therefore loaded in beforeAll, after that is set.
let app!: import("express").Express;
let writeTenantCollection!: typeof import("./db.js").writeTenantCollection;
let readTenantCollection!: typeof import("./db.js").readTenantCollection;
let deleteTenantData!: typeof import("./db.js").deleteTenantData;
let insertPhoto!: typeof import("./db.js").insertPhoto;
let countPhotos!: typeof import("./db.js").countPhotos;
let getPhoto!: typeof import("./db.js").getPhoto;

type Account = { token: string; dealershipId: string };
let shared: Account;
let secondScreen: { token: string }; // another person in the SAME dealership as `shared`
let otherDealer: Account;

// Real signup and join, so the accounts are exactly what a dealer gets.
async function signup(label: string): Promise<Account> {
  const res = await request(app)
    .post("/auth/signup")
    .send({
      email: `stock-integrity-${label}-${randomUUID()}@test.local`,
      password: "integrationtestpass123",
      name: `Stock Integrity ${label}`,
      dealershipName: `Stock Integrity Dealership ${label}`,
    });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, dealershipId: res.body.user.dealershipId as string };
}

async function joinStaff(ownerToken: string): Promise<{ token: string }> {
  const invite = await request(app)
    .post("/dealership/invite")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ inviteeName: "Second Screen", staffRole: "sales" });
  const join = await request(app)
    .post("/auth/join")
    .send({
      token: invite.body.token,
      name: "Second Screen",
      email: `stock-integrity-joined-${randomUUID()}@test.local`,
      password: "joinedtestpass123",
    });
  if (!join.body.token) throw new Error(`joinStaff failed: ${JSON.stringify(join.body)}`);
  return { token: join.body.token as string };
}

beforeAll(async () => {
  const runFolder = process.env.DATA_DIR;
  // Never fall back to the developer's real data folder.
  if (!runFolder) throw new Error("DATA_DIR isn't set: refusing to run against the default (real) database");
  process.env.DATA_DIR = path.join(runFolder, `stock-integrity-${process.pid}`);

  app = ((await import("./app.js")) as unknown as { default: import("express").Express }).default;
  ({ writeTenantCollection, readTenantCollection, deleteTenantData, insertPhoto, countPhotos, getPhoto } = await import("./db.js"));

  // Three accounts for the whole file rather than one per test (each signup is
  // a real password hash). Each test starts from an empty stock and no pictures.
  shared = await signup("owner");
  secondScreen = await joinStaff(shared.token);
  otherDealer = await signup("other-dealership");
}, 60_000);

beforeEach(() => {
  deleteTenantData(shared.dealershipId);
  deleteTenantData(otherDealer.dealershipId);
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const car = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  make: "Ford",
  model: "Fiesta",
  images: null,
  status: "in stock",
  priceRetail: 5000,
  ...extra,
});

const put = (token: string, body: unknown) => request(app).put("/inventory").set(auth(token)).send(body as object);
const save = (token: string, items: unknown[], deletedIds?: unknown) =>
  put(token, deletedIds === undefined ? { items } : { items, deletedIds });
const stock = async (token: string) => (await request(app).get("/inventory").set(auth(token))).body.items as any[];
const ids = (items: any[]) => items.map(v => v.id);

const twoDaysAgo = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

// A hosted photo for `refId`, put straight into the table so its age can be
// chosen (the upload route always stamps "now"). Returns the photo's id.
function seedPhoto(dealershipId: string, refId: string, opts: { old?: boolean; kind?: "vehicle" | "message" } = {}) {
  const id = randomUUID();
  insertPhoto({
    id,
    dealershipId,
    kind: opts.kind ?? "vehicle",
    refId,
    uploadedBy: null,
    mime: "image/jpeg",
    size: 3,
    data: Buffer.from([0xff, 0xd8, 0xff]),
    createdAt: opts.old ? twoDaysAgo() : new Date().toISOString(),
  });
  return id;
}
const photoUrl = (photoId: string) => hostedPhotoUrl("http://localhost", photoId, "image/jpeg");
const photoStatus = async (photoId: string) => (await request(app).get(`/photos/${photoId}.jpg`)).status;

function seed(account: Account, vehicleIds: string[]) {
  writeTenantCollection(account.dealershipId, "vehicles", vehicleIds.map(id => car(id)));
  return account;
}
async function setup(vehicleIds: string[] = ["car-1", "car-2", "car-3"]) {
  return seed(shared, vehicleIds);
}

describe("a stale screen's save never deletes cars or pictures added elsewhere", () => {
  it("keeps a car added by someone else, and its pictures — even pictures more than a day old", async () => {
    const owner = shared;
    const second = secondScreen;

    // The second screen loads the stock: [c1, c2].
    await save(owner.token, [car("c1"), car("c2")]);
    expect(ids(await stock(second.token))).toEqual(["c1", "c2"]);

    // Meanwhile the owner adds c3 with two pictures (a day-plus old by the time it matters).
    const p1 = seedPhoto(owner.dealershipId, "c3", { old: true });
    const p2 = seedPhoto(owner.dealershipId, "c3", { old: true });
    await save(owner.token, [car("c1"), car("c2"), car("c3", { images: [photoUrl(p1), photoUrl(p2)] })]);
    expect(countPhotos(owner.dealershipId, "vehicle")).toBe(2);

    // The second screen, still holding [c1, c2], saves a price edit.
    const stale = await save(second.token, [car("c1", { priceRetail: 5750 }), car("c2")]);
    expect(stale.status).toBe(200);

    // c3 is still there with both pictures, and the edit still went through.
    const after = await stock(owner.token);
    expect(ids(after)).toEqual(["c1", "c2", "c3"]);
    expect(after[0].priceRetail).toBe(5750);
    expect(after[2].images).toHaveLength(2);
    expect(getPhoto(p1)).not.toBeNull();
    expect(getPhoto(p2)).not.toBeNull();
    expect(await photoStatus(p1)).toBe(200);
    expect(await photoStatus(p2)).toBe(200);

    // ...and it stays that way across further stale saves.
    await save(second.token, [car("c1", { priceRetail: 5800 })]);
    expect(ids(await stock(owner.token))).toEqual(["c1", "c2", "c3"]);
    expect(countPhotos(owner.dealershipId, "vehicle")).toBe(2);
  });

  it("answers with the whole merged list, so the stale screen can catch up on what it missed", async () => {
    const owner = shared;
    await save(owner.token, [car("c1"), car("c2"), car("c3")]);

    const stale = await save(owner.token, [car("c1", { priceRetail: 4200 })]);
    expect(stale.body.ok).toBe(true);
    expect(ids(stale.body.items)).toEqual(["c1", "c2", "c3"]);
    expect(stale.body.items[0].priceRetail).toBe(4200);
    expect(stale.body.items).toEqual(await stock(owner.token));
  });

  it("an empty list changes nothing: it is not a request to clear the stock", async () => {
    const owner = await setup();
    const p = seedPhoto(owner.dealershipId, "car-1", { old: true });

    const res = await save(owner.token, []);
    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(["car-1", "car-2", "car-3"]);
    expect(ids(await stock(owner.token))).toEqual(["car-1", "car-2", "car-3"]);
    expect(getPhoto(p)).not.toBeNull();
  });

  it("never removes pictures because of a save, however old, even ones whose car isn't anywhere", async () => {
    const owner = await setup(["car-1"]);
    const orphan = seedPhoto(owner.dealershipId, "gone-1", { old: true });
    const ofLive = seedPhoto(owner.dealershipId, "car-1", { old: true });

    await save(owner.token, []);
    await save(owner.token, [car("car-1")]);
    await save(owner.token, [car("car-1"), car("car-2")]);

    expect(getPhoto(orphan)).not.toBeNull();
    expect(getPhoto(ofLive)).not.toBeNull();
  });

  it("still keeps a phone photo on a car that IS in the stale list", async () => {
    const owner = await setup(["car-1", "car-2"]);
    const photo = seedPhoto(owner.dealershipId, "car-1", { old: true });

    // The stale copy of car-1 has no pictures at all.
    const stale = await save(owner.token, [car("car-1", { priceRetail: 5750 }), car("car-2")]);
    expect(stale.body.items[0].priceRetail).toBe(5750);
    expect(stale.body.items[0].images).toHaveLength(1);
    expect(stale.body.items[0].images[0]).toContain(`/photos/${photo}.jpg`);
    expect((await stock(owner.token))[0].images[0]).toContain(`/photos/${photo}.jpg`);
  });

  it("an older client that still sends the whole list keeps working, it just can't delete", async () => {
    const owner = await setup(["a", "b"]);

    const whole = await save(owner.token, [car("a", { priceRetail: 1 }), car("b", { priceRetail: 2 })]);
    expect(whole.status).toBe(200);
    expect(whole.body.items.map((v: any) => v.priceRetail)).toEqual([1, 2]);

    // Dropping b from the list (its old way of deleting it) leaves b alone.
    const dropped = await save(owner.token, [car("a", { priceRetail: 3 })]);
    expect(ids(dropped.body.items)).toEqual(["a", "b"]);
    expect((await stock(owner.token)).map((v: any) => v.priceRetail)).toEqual([3, 2]);
  });
});

describe("deletedIds — the only way a car (and its pictures) is removed", () => {
  it("removes exactly the listed cars and their pictures, and nothing else", async () => {
    const owner = await setup(["a", "b", "c"]);
    const aOld = seedPhoto(owner.dealershipId, "a", { old: true });
    const bOld = seedPhoto(owner.dealershipId, "b", { old: true });
    const bNew = seedPhoto(owner.dealershipId, "b");
    const cOld = seedPhoto(owner.dealershipId, "c", { old: true });

    const res = await save(owner.token, [], ["b"]);
    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(["a", "c"]);
    expect(ids(await stock(owner.token))).toEqual(["a", "c"]);

    expect(getPhoto(bOld)).toBeNull();
    expect(getPhoto(bNew)).toBeNull();
    expect(await photoStatus(bOld)).toBe(404);
    expect(getPhoto(aOld)).not.toBeNull();
    expect(getPhoto(cOld)).not.toBeNull();
    expect(countPhotos(owner.dealershipId, "vehicle")).toBe(2);
  });

  it("works alongside the normal save of the other cars in the same request", async () => {
    const owner = await setup(["a", "b", "c"]);
    const res = await save(owner.token, [car("a", { priceRetail: 111 }), car("d")], ["c"]);
    expect(ids(res.body.items)).toEqual(["a", "b", "d"]);
    expect(res.body.items[0].priceRetail).toBe(111);
  });

  it("when a car is both sent and listed as deleted, the deletion wins", async () => {
    const owner = await setup(["a", "b"]);
    const photo = seedPhoto(owner.dealershipId, "b", { old: true });

    const res = await save(owner.token, [car("a"), car("b", { priceRetail: 999 })], ["b"]);
    expect(ids(res.body.items)).toEqual(["a"]);
    expect(getPhoto(photo)).toBeNull();
  });

  it("repeating a delete is harmless, so a client can safely resend it after a failure", async () => {
    const owner = await setup(["a", "b"]);
    const photo = seedPhoto(owner.dealershipId, "b");

    expect((await save(owner.token, [], ["b"])).status).toBe(200);
    const again = await save(owner.token, [], ["b"]);
    expect(again.status).toBe(200);
    expect(ids(again.body.items)).toEqual(["a"]);

    // ...and it also finishes the job if the car went but its pictures didn't.
    const leftover = seedPhoto(owner.dealershipId, "b", { old: true });
    expect((await save(owner.token, [], ["b"])).status).toBe(200);
    expect(getPhoto(leftover)).toBeNull();
    expect(getPhoto(photo)).toBeNull();
  });

  it("never touches message photos, even if a message id happens to equal a deleted vehicle id", async () => {
    const owner = await setup(["a"]);
    const messagePhoto = seedPhoto(owner.dealershipId, "a", { kind: "message" });
    const vehiclePhoto = seedPhoto(owner.dealershipId, "a");

    await save(owner.token, [], ["a"]);
    expect(getPhoto(vehiclePhoto)).toBeNull();
    expect(getPhoto(messagePhoto)).not.toBeNull();
  });

  it("another dealership's ids delete nothing there, even ids that collide with its own", async () => {
    const a = seed(shared, ["car-1", "a-only"]);
    const b = seed(otherDealer, ["car-1", "b-only"]);
    const aPhotoCar1 = seedPhoto(a.dealershipId, "car-1", { old: true });
    const aPhotoOnly = seedPhoto(a.dealershipId, "a-only", { old: true });
    const bPhotoCar1 = seedPhoto(b.dealershipId, "car-1", { old: true });
    const bPhotoOnly = seedPhoto(b.dealershipId, "b-only", { old: true });

    // B names A's car, A's other car, its own car-1 (same id as A's) and an id nobody has.
    const res = await save(b.token, [], ["a-only", "car-1", "nobody-has-this"]);
    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(["b-only"]);

    // A is exactly as it was.
    expect(ids(await stock(a.token))).toEqual(["car-1", "a-only"]);
    expect(getPhoto(aPhotoCar1)).not.toBeNull();
    expect(getPhoto(aPhotoOnly)).not.toBeNull();
    // B lost only its own car-1 (and that car's picture).
    expect(getPhoto(bPhotoCar1)).toBeNull();
    expect(getPhoto(bPhotoOnly)).not.toBeNull();
  });

  it("copes with a long list, across the batches it is worked through in", async () => {
    const owner = await setup(["first", "middle", "last", "keep"]);
    const photos = ["first", "middle", "last", "keep"].map(id => seedPhoto(owner.dealershipId, id, { old: true }));
    const many = [
      "first",
      ...Array.from({ length: 700 }, (_, i) => `nothing-${i}`),
      "middle",
      ...Array.from({ length: 700 }, (_, i) => `nothing-b-${i}`),
      "last",
    ];

    const res = await save(owner.token, [], many);
    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(["keep"]);
    expect(photos.map(p => getPhoto(p) !== null)).toEqual([false, false, false, true]);
  });

  it("refuses a deletedIds that isn't a list of ids, and changes nothing at all", async () => {
    const owner = await setup(["a", "b"]);
    const photo = seedPhoto(owner.dealershipId, "a", { old: true });

    for (const bad of ["a", { 0: "a" }, [1], [""], [null], ["a", 2], null, true]) {
      const res = await save(owner.token, [car("a", { priceRetail: 1 }), car("z")], bad);
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    }
    const after = await stock(owner.token);
    expect(ids(after)).toEqual(["a", "b"]);
    expect(after[0].priceRetail).toBe(5000); // the accompanying save was not applied either
    expect(getPhoto(photo)).not.toBeNull();
  });
});

describe("a request without a real list of cars is refused, never read as 'no cars'", () => {
  it("answers 400 and leaves the stock and its pictures untouched", async () => {
    const owner = await setup(["a", "b"]);
    const photo = seedPhoto(owner.dealershipId, "a", { old: true });

    const bodies: unknown[] = [{}, { items: null }, { items: "nope" }, { items: 5 }, { items: { 0: car("x") } }, [car("x")]];
    for (const body of bodies) {
      const res = await put(owner.token, body);
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    }

    // A right-looking body in the wrong content type is read by nothing, so `items` is missing.
    const wrongType = await request(app)
      .put("/inventory")
      .set(auth(owner.token))
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ items: [car("x")] }));
    expect(wrongType.status).toBe(400);

    // No body at all.
    expect((await request(app).put("/inventory").set(auth(owner.token))).status).toBe(400);

    expect(ids(await stock(owner.token))).toEqual(["a", "b"]);
    expect(getPhoto(photo)).not.toBeNull();
  });
});

describe("the order of the saved list", () => {
  it("cars the server has keep their place, new cars are added at the end in the order sent", async () => {
    const owner = await setup(["a", "b", "c"]);
    // Sent in a different order, with two new cars in the middle.
    const res = await save(owner.token, [car("c", { priceRetail: 3 }), car("n1"), car("a", { priceRetail: 1 }), car("n2")]);
    expect(ids(res.body.items)).toEqual(["a", "b", "c", "n1", "n2"]);
    expect(res.body.items.map((v: any) => v.priceRetail)).toEqual([1, 5000, 3, 5000, 5000]);
    expect(ids(await stock(owner.token))).toEqual(["a", "b", "c", "n1", "n2"]);
  });

  it("the same rules hold for the pure merge, including entries that aren't cars", () => {
    const stored = [null, { note: "stored, no id" }, { id: "a", v: 1 }, { id: "b", v: 1 }];
    const sent = [{ id: "c", v: 2 }, "text", 5, { note: "sent, no id" }, { id: "a", v: 2 }, { id: "c", v: 3 }];

    const merged = mergeVehicleSave(stored, sent, new Set());
    expect(merged).toEqual([null, { note: "stored, no id" }, { id: "a", v: 2 }, { id: "b", v: 1 }, { id: "c", v: 3 }]);

    // A listed deletion wins over the same car being sent; unrecognisable stored entries stay.
    expect(mergeVehicleSave(stored, sent, new Set(["a", "c"]))).toEqual([null, { note: "stored, no id" }, { id: "b", v: 1 }]);
  });

  it("junk in a save is ignored rather than stored, and junk already stored is never dropped", async () => {
    const owner = shared;
    writeTenantCollection(owner.dealershipId, "vehicles", [null, { note: "stored, no id" }, car("a")]);

    const res = await save(owner.token, [car("a", { priceRetail: 1 }), "text", 5, { note: "sent, no id" }, car("b")]);
    expect(res.status).toBe(200);
    expect(readTenantCollection<any>(owner.dealershipId, "vehicles")).toEqual([
      null,
      { note: "stored, no id" },
      car("a", { priceRetail: 1 }),
      car("b"),
    ]);
  });

  it("parseDeletedIds accepts nothing or a list of ids, and rejects everything else", () => {
    expect(parseDeletedIds(undefined)).toEqual({ ok: true, ids: [] });
    expect(parseDeletedIds([])).toEqual({ ok: true, ids: [] });
    expect(parseDeletedIds(["a", "b", "a"])).toEqual({ ok: true, ids: ["a", "b"] });
    for (const bad of [null, "a", 1, {}, [1], [""], [null], ["a", {}]]) {
      expect(parseDeletedIds(bad).ok).toBe(false);
    }
  });
});

describe("the phone app's use of stock and photos is unchanged", () => {
  it("reads the stock, adds a photo, sees it on the car, and removes it again — the car stays throughout", async () => {
    const owner = await setup(["car-1", "car-2"]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(200)]);

    expect(ids(await stock(owner.token))).toEqual(["car-1", "car-2"]);

    const up = await request(app)
      .post("/inventory/car-1/photos")
      .set(auth(owner.token))
      .send({ dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
    expect(up.status).toBe(200);
    expect((await stock(owner.token))[0].images).toEqual([up.body.photo.url]);

    const del = await request(app).delete(`/inventory/car-1/photos/${up.body.photo.id}`).set(auth(owner.token));
    expect(del.status).toBe(200);
    expect(ids(await stock(owner.token))).toEqual(["car-1", "car-2"]);
    expect((await stock(owner.token))[0].images).toBeNull();
    expect(await photoStatus(up.body.photo.id)).toBe(404);
  });
});
