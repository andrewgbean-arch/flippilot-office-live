import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hostedPhotoUrl } from "./photoStore.js";

// Field-level stock saving, through the real app: PUT /inventory with
// `changes: [{ id, set?, unset? }]`. See routes/inventory.ts and inventoryMerge.ts.
//
// The point of it: the web app used to send the WHOLE car for a one-field edit,
// so a screen left open all day silently undid whatever other people had
// changed on that car (or brought back a car that had been deleted). A change
// carries only the fields the person touched and is applied to the car as the
// server holds it right now.
//
// The pure rules are in inventoryChanges.test.ts; this file proves they are
// wired in: that a bad request writes nothing at all, that the two-writers
// story really works over HTTP, and that nothing leaks between dealerships.

// ---- This file has a database of its own (same reasons as stockIntegrity.test.ts) ----
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

async function signup(label: string): Promise<Account> {
  const res = await request(app)
    .post("/auth/signup")
    .send({
      email: `inventory-changes-${label}-${randomUUID()}@test.local`,
      password: "integrationtestpass123",
      name: `Inventory Changes ${label}`,
      dealershipName: `Inventory Changes Dealership ${label}`,
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
      email: `inventory-changes-joined-${randomUUID()}@test.local`,
      password: "joinedtestpass123",
    });
  if (!join.body.token) throw new Error(`joinStaff failed: ${JSON.stringify(join.body)}`);
  return { token: join.body.token as string };
}

beforeAll(async () => {
  const runFolder = process.env.DATA_DIR;
  if (!runFolder) throw new Error("DATA_DIR isn't set: refusing to run against the default (real) database");
  process.env.DATA_DIR = path.join(runFolder, `inventory-changes-${process.pid}`);

  app = ((await import("./app.js")) as unknown as { default: import("express").Express }).default;
  ({ writeTenantCollection, readTenantCollection, deleteTenantData, insertPhoto, countPhotos, getPhoto } = await import("./db.js"));

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
  registration: `${id.toUpperCase()} REG`,
  notes: `notes for ${id}`,
  costs: [{ label: "valet", amount: 20 }],
  mot: { expiry: "2026-12-01" },
  ...extra,
});

const put = (token: string, body: unknown) => request(app).put("/inventory").set(auth(token)).send(body as object);
// A raw JSON text, sent exactly as written (so "__proto__" arrives as a real key).
const putRaw = (token: string, json: string) =>
  request(app).put("/inventory").set(auth(token)).set("Content-Type", "application/json").send(json);
const edit = (token: string, changes: unknown, extra: Record<string, unknown> = {}) => put(token, { items: [], changes, ...extra });
const change = (id: string, set?: Record<string, unknown>, unset?: string[]) => ({
  id,
  ...(set ? { set } : {}),
  ...(unset ? { unset } : {}),
});

const stock = async (token: string) => (await request(app).get("/inventory").set(auth(token))).body.items as any[];
const ids = (items: any[]) => items.map(v => v.id);
// What is stored, as text: "the same" here means the same bytes.
const stored = (account: Account) => JSON.stringify(readTenantCollection<unknown>(account.dealershipId, "vehicles"));
const seed = (account: Account, cars: unknown[]) => writeTenantCollection(account.dealershipId, "vehicles", cars);

function seedPhoto(dealershipId: string, refId: string, opts: { old?: boolean } = {}) {
  const id = randomUUID();
  insertPhoto({
    id,
    dealershipId,
    kind: "vehicle",
    refId,
    uploadedBy: null,
    mime: "image/jpeg",
    size: 3,
    data: Buffer.from([0xff, 0xd8, 0xff]),
    createdAt: opts.old ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
  });
  return id;
}
const photoUrl = (photoId: string) => hostedPhotoUrl("http://localhost", photoId, "image/jpeg");

describe("a change sets and removes fields on the car as it stands, and nothing else moves", () => {
  it("set: the named fields change; every other field of that car and every other car is exactly as before", async () => {
    const before = [car("a"), car("b", { sellPrice: 4000 }), car("c", { status: "sold" })];
    seed(shared, before);

    const res = await edit(shared.token, [change("b", { priceRetail: 4500, status: "reserved" })]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      items: [before[0], { ...before[1], priceRetail: 4500, status: "reserved" }, before[2]],
      changed: 1,
      notFound: [],
    });
    expect(await stock(shared.token)).toEqual(res.body.items);
    expect(readTenantCollection<any>(shared.dealershipId, "vehicles")[0]).toEqual(before[0]);
  });

  it("unset: the field is truly gone from the stored car, and only that field", async () => {
    const before = [car("a"), car("b", { sellPrice: 4000 })];
    seed(shared, before);

    const res = await edit(shared.token, [change("b", undefined, ["sellPrice", "notes"])]);

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(1);
    const { sellPrice, notes, ...rest } = before[1] as Record<string, unknown>;
    expect(sellPrice).toBe(4000);
    expect(notes).toBe("notes for b");
    expect(res.body.items).toEqual([before[0], rest]);
    const inStore = readTenantCollection<any>(shared.dealershipId, "vehicles")[1];
    expect("sellPrice" in inStore).toBe(false);
    expect("notes" in inStore).toBe(false);
    expect(stored(shared)).toBe(JSON.stringify([before[0], rest]));
  });

  it("set and unset together, in one entry", async () => {
    seed(shared, [car("a", { sellPrice: 1 })]);
    const res = await edit(shared.token, [change("a", { status: "sold", soldDate: "2026-09-01" }, ["sellPrice"])]);
    expect(res.body.items[0]).toEqual({ ...car("a"), status: "sold", soldDate: "2026-09-01", sellPrice: undefined });
    expect("sellPrice" in res.body.items[0]).toBe(false);
  });

  it("a list or object field is replaced as a whole", async () => {
    seed(shared, [car("a", { costs: [{ label: "one", amount: 1 }, { label: "two", amount: 2 }] })]);
    const res = await edit(shared.token, [change("a", { costs: [{ label: "three", amount: 3 }], mot: { expiry: "2027-06-01" } })]);
    expect(res.body.items[0].costs).toEqual([{ label: "three", amount: 3 }]);
    expect(res.body.items[0].mot).toEqual({ expiry: "2027-06-01" });
  });

  it("two entries for one car apply in order (later wins per field), and unset really removes", async () => {
    seed(shared, [car("a", { sellPrice: 1 })]);
    const res = await edit(shared.token, [
      change("a", { priceRetail: 1, notes: "first" }),
      change("a", { priceRetail: 2 }, ["sellPrice"]),
      change("a", { notes: "third" }),
      change("a", undefined, ["notes"]),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(4);
    const [a] = res.body.items;
    expect(a.priceRetail).toBe(2);
    expect("sellPrice" in a).toBe(false);
    expect("notes" in a).toBe(false);
    expect(stored(shared)).toBe(JSON.stringify([a]));
  });

  it("the edited car keeps its place in the list", async () => {
    seed(shared, [car("a"), car("b"), car("c")]);
    const res = await edit(shared.token, [change("c", { priceRetail: 1 }), change("a", { priceRetail: 2 })]);
    expect(ids(res.body.items)).toEqual(["a", "b", "c"]);
    expect(ids(await stock(shared.token))).toEqual(["a", "b", "c"]);
  });

  it("copes with a big stock and a lot of edits at once", async () => {
    const many = Array.from({ length: 2000 }, (_, i) => car(`bulk-${i}`));
    seed(shared, many);
    const changes = Array.from({ length: 500 }, (_, i) => change(`bulk-${i * 4}`, { priceRetail: i }));
    const res = await edit(shared.token, changes);
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(500);
    expect(res.body.items).toHaveLength(2000);
    expect(res.body.items[4].priceRetail).toBe(1);
    expect(res.body.items[5].priceRetail).toBe(5000);
  });
});

describe("two people editing the same car: both edits survive", () => {
  it("A changes the price; B, on an older copy, marks it sold: the car has BOTH", async () => {
    seed(shared, [car("car-1"), car("car-2")]);
    const a = shared;
    const b = secondScreen;

    // Both load the stock; B's screen then sits open, holding the old copy.
    expect((await stock(a.token))[0].priceRetail).toBe(5000);
    expect((await stock(b.token))[0].status).toBe("in stock");

    // A drops the price.
    expect((await edit(a.token, [change("car-1", { priceRetail: 4500 })])).status).toBe(200);

    // B marks it sold. B's copy still says 5000, but B only sends what B changed.
    const bReply = await edit(b.token, [change("car-1", { status: "sold", sellPrice: 4300 })]);
    expect(bReply.status).toBe(200);
    expect(bReply.body.changed).toBe(1);

    const final = (await stock(a.token))[0];
    expect(final.priceRetail).toBe(4500); // A's edit survived
    expect(final.status).toBe("sold"); // B's edit landed
    expect(final.sellPrice).toBe(4300);
    // and B's reply is the whole truth, so B's screen catches up on A's price
    expect(bReply.body.items[0]).toEqual(final);
  });

  it("(for contrast) the same story with a whole-car save from B does undo A's price: that's why the client sends changes", async () => {
    seed(shared, [car("car-1")]);
    const staleCopy = (await stock(secondScreen.token))[0];

    await edit(shared.token, [change("car-1", { priceRetail: 4500 })]);
    await put(secondScreen.token, { items: [{ ...staleCopy, status: "sold", sellPrice: 4300 }] });

    expect((await stock(shared.token))[0].priceRetail).toBe(5000); // A's change was overwritten by the stale whole car
  });

  it("edits to different fields by different people over several rounds all stack up", async () => {
    seed(shared, [car("car-1")]);
    await edit(shared.token, [change("car-1", { priceRetail: 4900 })]);
    await edit(secondScreen.token, [change("car-1", { notes: "b was here" })]);
    await edit(shared.token, [change("car-1", { status: "reserved" })]);
    await edit(secondScreen.token, [change("car-1", undefined, ["registration"])]);

    const finalCar = (await stock(shared.token))[0];
    expect(finalCar).toEqual({ ...car("car-1"), priceRetail: 4900, notes: "b was here", status: "reserved", registration: undefined });
    expect("registration" in finalCar).toBe(false);
  });

  it("the same field edited twice: the later save wins (a deliberate limit)", async () => {
    seed(shared, [car("car-1")]);
    await edit(shared.token, [change("car-1", { priceRetail: 4900 })]);
    await edit(secondScreen.token, [change("car-1", { priceRetail: 4700 })]);
    expect((await stock(shared.token))[0].priceRetail).toBe(4700);
  });

  it("someone else's newly added car is never lost by an edit from a screen that hasn't seen it", async () => {
    seed(shared, [car("c1")]);
    const staleScreen = secondScreen; // loaded [c1]
    await put(shared.token, { items: [car("c2")] }); // A adds c2

    const res = await edit(staleScreen.token, [change("c1", { priceRetail: 1 })]);
    expect(ids(res.body.items)).toEqual(["c1", "c2"]);
    expect(ids(await stock(shared.token))).toEqual(["c1", "c2"]);
  });
});

describe("a change never brings back a car that isn't there", () => {
  it("a car deleted elsewhere: its id comes back in notFound, nothing is re-created, the other edits still land", async () => {
    seed(shared, [car("a"), car("b")]);
    const photoOfB = seedPhoto(shared.dealershipId, "b", { old: true });
    const staleScreen = secondScreen;
    expect(ids(await stock(staleScreen.token))).toEqual(["a", "b"]); // it loads [a, b] and then sits open

    // Somebody deletes b (and its picture).
    expect((await put(shared.token, { items: [], deletedIds: ["b"] })).status).toBe(200);
    const afterDelete = readTenantCollection<any>(shared.dealershipId, "vehicles");
    expect(ids(afterDelete)).toEqual(["a"]);
    expect(getPhoto(photoOfB)).toBeNull();

    // The stale screen edits b (gone) and a (still there) in one save.
    const res = await edit(staleScreen.token, [change("b", { priceRetail: 1, make: "Ford", model: "Focus" }), change("a", { priceRetail: 2 })]);

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(1);
    expect(res.body.notFound).toEqual(["b"]);
    expect(res.body.items).toEqual([{ ...afterDelete[0], priceRetail: 2 }]);
    expect(await stock(shared.token)).toEqual(res.body.items); // b is not back, whole or in part
    expect(getPhoto(photoOfB)).toBeNull();
  });

  it("when the only change is for a missing car, the stored stock is byte-for-byte the same", async () => {
    seed(shared, [car("a"), car("b")]);
    const before = stored(shared);

    const res = await edit(shared.token, [change("ghost", { priceRetail: 1 })]);

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(0);
    expect(res.body.notFound).toEqual(["ghost"]);
    expect(stored(shared)).toBe(before);
  });

  it("a change and deletedIds for the SAME id in one request: the car is gone, and the id is in neither changed nor notFound", async () => {
    seed(shared, [car("a"), car("b")]);
    const photo = seedPhoto(shared.dealershipId, "b", { old: true });

    const res = await edit(shared.token, [change("b", { priceRetail: 1 })], { deletedIds: ["b"] });

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(0);
    expect(res.body.notFound).toEqual([]);
    expect(ids(res.body.items)).toEqual(["a"]);
    expect(ids(await stock(shared.token))).toEqual(["a"]);
    expect(getPhoto(photo)).toBeNull(); // deleted with the car
  });

  it("the same, next to a change for another car and a missing one: only those are counted", async () => {
    seed(shared, [car("a"), car("b")]);
    const res = await edit(shared.token, [change("b", { priceRetail: 1 }), change("a", { priceRetail: 2 }), change("ghost", { priceRetail: 3 })], { deletedIds: ["b"] });
    expect(res.body.changed).toBe(1);
    expect(res.body.notFound).toEqual(["ghost"]);
    expect(res.body.items).toEqual([car("a", { priceRetail: 2 })]);
  });

  it("a mixed request: the known id is applied, the unknown id is reported, changed is 1", async () => {
    seed(shared, [car("a"), car("b")]);
    const res = await edit(shared.token, [change("a", { priceRetail: 1 }), change("nobody", { priceRetail: 2 })]);
    expect(res.body.changed).toBe(1);
    expect(res.body.notFound).toEqual(["nobody"]);
    expect(res.body.items).toEqual([car("a", { priceRetail: 1 }), car("b")]);
  });

  it("an unknown id named several times is reported once", async () => {
    seed(shared, [car("a")]);
    const res = await edit(shared.token, [change("x", { p: 1 }), change("y", { p: 1 }), change("x", { p: 2 }), change("x", undefined, ["p"])]);
    expect(res.body.notFound).toEqual(["x", "y"]);
    expect(res.body.changed).toBe(0);
  });

  it("ids like 'constructor' or '__proto__' are just unknown ids", async () => {
    seed(shared, [car("a")]);
    const res = await edit(shared.token, [change("constructor", { p: 1 }), change("__proto__", { p: 1 }), change("toString", { p: 1 })]);
    expect(res.status).toBe(200);
    expect(res.body.notFound).toEqual(["constructor", "__proto__", "toString"]);
    expect(res.body.changed).toBe(0);
    expect(res.body.items).toEqual([car("a")]);
  });
});

describe("changes ride alongside items and deletedIds, in a fixed order", () => {
  it("changes are applied AFTER the whole cars in `items`: an edit to a car that the same request replaces still lands", async () => {
    seed(shared, [car("a")]);
    const res = await put(shared.token, {
      items: [car("a", { priceRetail: 1, notes: "from the whole car" })],
      changes: [change("a", { priceRetail: 2 })],
    });
    expect(res.body.items[0].priceRetail).toBe(2); // the change won over the whole car
    expect(res.body.items[0].notes).toBe("from the whole car"); // ...and the whole car's other fields are there
    expect(res.body.changed).toBe(1);
  });

  it("a change for a car that the same request adds is applied to it (it exists by then)", async () => {
    seed(shared, [car("a")]);
    const res = await put(shared.token, { items: [car("new")], changes: [change("new", { priceRetail: 9 })] });
    expect(res.body.changed).toBe(1);
    expect(res.body.notFound).toEqual([]);
    expect(res.body.items[1]).toEqual(car("new", { priceRetail: 9 }));
  });

  it("everything at once: add a car, edit one, delete one; their pictures follow the deletion", async () => {
    seed(shared, [car("a"), car("b"), car("c")]);
    const photoB = seedPhoto(shared.dealershipId, "b", { old: true });
    const photoA = seedPhoto(shared.dealershipId, "a", { old: true });

    const res = await put(shared.token, { items: [car("d")], changes: [change("a", { priceRetail: 1 })], deletedIds: ["b"] });

    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(["a", "c", "d"]);
    expect(res.body.items[0].priceRetail).toBe(1);
    expect(res.body.changed).toBe(1);
    expect(getPhoto(photoB)).toBeNull();
    expect(getPhoto(photoA)).not.toBeNull();
    expect(await stock(shared.token)).toEqual(res.body.items);
  });
});

describe("a request that fails any check writes NOTHING", () => {
  // Every case is sent WITH a perfectly good add, edit and delete alongside, to prove the
  // good parts are not applied either. A bad request must leave the stock byte-for-byte alone.
  async function refuses(label: string, send: (accompanying: Record<string, unknown>) => Promise<request.Response>) {
    const owner = shared;
    seed(owner, [car("a"), car("b"), car("c")]);
    const photo = seedPhoto(owner.dealershipId, "b", { old: true });
    const before = stored(owner);
    const photosBefore = countPhotos(owner.dealershipId, "vehicle");

    const res = await send({ items: [car("new-car"), car("a", { priceRetail: 1 })], deletedIds: ["b"] });

    expect(res.status, label).toBe(400);
    expect(res.body.ok, label).toBe(false);
    expect(typeof res.body.error, label).toBe("string");
    expect(res.body.error.length, label).toBeGreaterThan(5);
    expect(stored(owner), label).toBe(before);
    expect(countPhotos(owner.dealershipId, "vehicle"), label).toBe(photosBefore);
    expect(getPhoto(photo), label).not.toBeNull();
    expect(Object.prototype, label).not.toHaveProperty("polluted");
    expect(({} as any).polluted, label).toBeUndefined();
  }
  const withChanges = (changes: unknown) => (accompanying: Record<string, unknown>) => put(shared.token, { ...accompanying, changes });

  it("changes that isn't a list", async () => {
    for (const bad of [null, "a", 5, true, {}, { 0: change("a", { priceRetail: 1 }) }]) {
      await refuses(`changes = ${JSON.stringify(bad)}`, withChanges(bad));
    }
  });

  it("an entry that isn't an object", async () => {
    for (const bad of [null, [], ["a"], "a", 5, true]) {
      await refuses(`entry = ${JSON.stringify(bad)}`, withChanges([bad]));
      await refuses(`entry = ${JSON.stringify(bad)} after a good one`, withChanges([change("a", { priceRetail: 3 }), bad]));
    }
  });

  it("an entry with a missing, empty or non-text id", async () => {
    for (const bad of [{ set: { priceRetail: 1 } }, { id: "", set: { priceRetail: 1 } }, { id: null }, { id: 5 }, { id: ["a"] }, { id: { a: 1 } }, { id: true }]) {
      await refuses(`entry = ${JSON.stringify(bad)}`, withChanges([bad]));
    }
  });

  it("`set` that isn't an object", async () => {
    for (const bad of [[], ["priceRetail"], null, "priceRetail", 5, true]) {
      await refuses(`set = ${JSON.stringify(bad)}`, withChanges([{ id: "a", set: bad }]));
    }
  });

  it("`unset` that isn't a list of non-empty names", async () => {
    for (const bad of ["notes", null, 5, true, {}, [""], [1], [null], ["notes", ""], ["notes", 2], [["notes"]], [{}]]) {
      await refuses(`unset = ${JSON.stringify(bad)}`, withChanges([{ id: "a", unset: bad }]));
    }
  });

  it("a field with an empty name in `set`", async () => {
    await refuses("set has an empty name", withChanges([{ id: "a", set: { "": 1 } }]));
  });

  it("the forbidden field names, in `set` and in `unset` (sent as raw JSON so __proto__ is a real key)", async () => {
    for (const name of ["id", "__proto__", "constructor", "prototype"]) {
      const value = name === "__proto__" ? '{"polluted":"yes"}' : '"x"';
      await refuses(`set ${name}`, accompanying =>
        putRaw(shared.token, `{"items":${JSON.stringify(accompanying.items)},"deletedIds":["b"],"changes":[{"id":"a","set":{"${name}":${value}}}]}`)
      );
      await refuses(`set ${name} beside a fine field`, accompanying =>
        putRaw(shared.token, `{"items":${JSON.stringify(accompanying.items)},"deletedIds":["b"],"changes":[{"id":"a","set":{"priceRetail":1,"${name}":${value}}}]}`)
      );
      await refuses(`unset ${name}`, accompanying =>
        putRaw(shared.token, `{"items":${JSON.stringify(accompanying.items)},"deletedIds":["b"],"changes":[{"id":"a","unset":["${name}"]}]}`)
      );
      await refuses(`unset ${name} beside a fine field`, accompanying =>
        putRaw(shared.token, `{"items":${JSON.stringify(accompanying.items)},"deletedIds":["b"],"changes":[{"id":"a","unset":["notes","${name}"]}]}`)
      );
      // the same through the ordinary JSON path, for the names an object literal can carry
      if (name !== "__proto__") {
        await refuses(`set ${name} (plain)`, withChanges([{ id: "a", set: { [name]: "x" } }]));
        await refuses(`unset ${name} (plain)`, withChanges([{ id: "a", unset: [name] }]));
      }
    }
  });

  it("a __proto__ attack pollutes nothing, is refused, and the next normal save works", async () => {
    await refuses("attack", accompanying =>
      putRaw(shared.token, `{"items":${JSON.stringify(accompanying.items)},"changes":[{"id":"a","set":{"__proto__":{"polluted":"yes"}}}]}`)
    );
    // ...in the whole-car path too: the attack shape as a car field is only ever data.
    expect(({} as any).polluted).toBeUndefined();
    expect((Object.prototype as any).polluted).toBeUndefined();

    const next = await edit(shared.token, [change("a", { priceRetail: 1234 })]);
    expect(next.status).toBe(200);
    expect(next.body.changed).toBe(1);
    expect((await stock(shared.token))[0].priceRetail).toBe(1234);
    expect(({} as any).polluted).toBeUndefined();
    expect(JSON.stringify(await stock(shared.token))).not.toContain("polluted");
  });

  it("a field named in both `set` and `unset` of one entry", async () => {
    await refuses("both", withChanges([{ id: "a", set: { notes: "x" }, unset: ["notes"] }]));
    await refuses("both, among others", withChanges([{ id: "a", set: { priceRetail: 1, notes: "x" }, unset: ["make", "notes"] }]));
  });

  it("a bad `deletedIds` beside good changes", async () => {
    await refuses("bad deletedIds", accompanying => put(shared.token, { ...accompanying, deletedIds: [1], changes: [change("a", { priceRetail: 1 })] }));
  });

  it("no items list beside good changes", async () => {
    await refuses("no items", () => put(shared.token, { changes: [change("a", { priceRetail: 1 })] }));
    await refuses("items null", () => put(shared.token, { items: null, changes: [change("a", { priceRetail: 1 })] }));
  });

  it("a request that is refused says why in plain words", async () => {
    seed(shared, [car("a")]);
    const res = await edit(shared.token, [{ id: "a", set: { priceRetail: 1 }, unset: ["priceRetail"] }]);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: expect.stringMatching(/change 1/i) });
    expect(res.body.error).not.toMatch(/undefined|TypeError|stack|\bat \w+\./i);
  });
});

describe("saves without `changes` behave exactly as before, plus the two new reply fields", () => {
  it("an items-only save: same result as ever, and the reply also carries changed: 0, notFound: []", async () => {
    seed(shared, [car("a"), car("b")]);
    const res = await put(shared.token, { items: [car("a", { priceRetail: 1 }), car("c")] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items: [car("a", { priceRetail: 1 }), car("b"), car("c")], changed: 0, notFound: [] });
    expect(await stock(shared.token)).toEqual(res.body.items);
  });

  it("an empty save and a delete-only save carry them too", async () => {
    seed(shared, [car("a"), car("b")]);
    expect((await put(shared.token, { items: [] })).body).toEqual({ ok: true, items: [car("a"), car("b")], changed: 0, notFound: [] });
    expect((await put(shared.token, { items: [], deletedIds: ["b"] })).body).toEqual({ ok: true, items: [car("a")], changed: 0, notFound: [] });
    expect((await put(shared.token, { items: [], changes: [] })).body).toEqual({ ok: true, items: [car("a")], changed: 0, notFound: [] });
  });

  it("every successful reply, whatever was sent, has a numeric `changed` and a list `notFound`", async () => {
    seed(shared, [car("a"), car("b")]);
    const bodies: unknown[] = [
      { items: [] },
      { items: [car("a")] },
      { items: [car("z")], deletedIds: ["b"] },
      { items: [], changes: [] },
      { items: [], changes: [change("a", { priceRetail: 1 })] },
      { items: [], changes: [change("ghost", { priceRetail: 1 })] },
      { items: [], changes: [change("a", { priceRetail: 1 })], deletedIds: ["a"] },
      { items: [car("q")], changes: [change("q", { priceRetail: 1 }), change("nobody")], deletedIds: ["z"] },
    ];
    for (const body of bodies) {
      const res = await put(shared.token, body);
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(typeof res.body.changed, JSON.stringify(body)).toBe("number");
      expect(Array.isArray(res.body.notFound), JSON.stringify(body)).toBe(true);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
    }
  });

  it("an older client's whole-car replace still works and still can't delete (unchanged)", async () => {
    seed(shared, [car("a"), car("b")]);
    const res = await put(shared.token, { items: [car("a", { priceRetail: 3 })] });
    expect(ids(res.body.items)).toEqual(["a", "b"]);
    expect(res.body.items[0].priceRetail).toBe(3);
    expect(res.body.changed).toBe(0);
  });
});

describe("phone-hosted photos survive a stale screen's edit of `images`", () => {
  it("set.images from a screen that hasn't seen a phone photo: the phone photo is put back, the screen's own picture is kept", async () => {
    seed(shared, [car("car-1", { images: null }), car("car-2")]);
    const photo = seedPhoto(shared.dealershipId, "car-1", { old: true });
    const inline = "data:image/png;base64,AAAA";

    const res = await edit(shared.token, [change("car-1", { images: [inline] })]);

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(1);
    const images = res.body.items[0].images as string[];
    expect(images).toHaveLength(2);
    expect(images[0]).toBe(inline);
    expect(images[1]).toContain(`/photos/${photo}.jpg`);
    expect((await stock(shared.token))[0].images).toEqual(images);
    expect(getPhoto(photo)).not.toBeNull();
  });

  it("an empty images list from a stale screen doesn't remove the phone photo (only the photo DELETE route does)", async () => {
    seed(shared, [car("car-1", { images: null })]);
    const photo = seedPhoto(shared.dealershipId, "car-1", { old: true });

    for (const value of [[], null]) {
      const res = await edit(shared.token, [change("car-1", { images: value })]);
      expect(res.body.items[0].images).toHaveLength(1);
      expect(res.body.items[0].images[0]).toContain(`/photos/${photo}.jpg`);
    }
    expect(getPhoto(photo)).not.toBeNull();
  });

  it("unset images: the field goes, but a phone photo still comes back into it", async () => {
    seed(shared, [car("car-1", { images: [photoUrl("00000000-0000-4000-8000-000000000000")] })]);
    const photo = seedPhoto(shared.dealershipId, "car-1", { old: true });

    const res = await edit(shared.token, [change("car-1", undefined, ["images"])]);

    expect(res.status).toBe(200);
    expect(res.body.items[0].images).toHaveLength(1);
    expect(res.body.items[0].images[0]).toContain(`/photos/${photo}.jpg`);
  });

  it("unset images on a car with no phone photos really removes the field", async () => {
    seed(shared, [car("car-1", { images: ["data:image/png;base64,AAAA"] })]);
    const res = await edit(shared.token, [change("car-1", undefined, ["images"])]);
    expect("images" in res.body.items[0]).toBe(false);
  });

  it("a link to a phone photo that has since been deleted is not written back", async () => {
    seed(shared, [car("car-1", { images: null })]);
    const dead = photoUrl(randomUUID());
    const inline = "data:image/png;base64,AAAA";

    const res = await edit(shared.token, [change("car-1", { images: [dead, inline] })]);
    expect(res.body.items[0].images).toEqual([inline]);

    const onlyDead = await edit(shared.token, [change("car-1", { images: [dead] })]);
    expect(onlyDead.body.items[0].images).toBeNull();
  });

  it("only cars whose images were edited get this: a price change leaves the pictures alone, and so do other cars", async () => {
    seed(shared, [car("car-1", { images: null }), car("car-2", { images: null }), car("car-3", { images: null })]);
    seedPhoto(shared.dealershipId, "car-1", { old: true });
    seedPhoto(shared.dealershipId, "car-3", { old: true });
    const before = readTenantCollection<any>(shared.dealershipId, "vehicles");

    const res = await edit(shared.token, [change("car-1", { priceRetail: 1 }), change("car-2", { images: ["data:image/png;base64,BBBB"] })]);

    expect(res.body.items[0]).toEqual({ ...before[0], priceRetail: 1 }); // images still null: not named
    expect(res.body.items[1].images).toEqual(["data:image/png;base64,BBBB"]); // car-2 has no phone photos
    expect(res.body.items[2]).toEqual(before[2]); // untouched
  });

  it("a phone photo of ANOTHER dealership's car with the same id is never pulled in", async () => {
    seed(shared, [car("car-1", { images: null })]);
    seedPhoto(otherDealer.dealershipId, "car-1", { old: true });
    const res = await edit(shared.token, [change("car-1", { images: [] })]);
    // exactly what the sender said: the other dealership's picture is nothing to do with this car
    expect(res.body.items[0].images).toEqual([]);
    expect(countPhotos(otherDealer.dealershipId, "vehicle")).toBe(1);
  });
});

describe("dealerships stay separate", () => {
  it("dealership B changing an id that only dealership A has: notFound for B, and A's stock is untouched", async () => {
    seed(shared, [car("car-1"), car("car-2")]);
    const before = stored(shared);
    const photo = seedPhoto(shared.dealershipId, "car-1", { old: true });

    const res = await edit(otherDealer.token, [change("car-1", { priceRetail: 1 }), change("car-2", undefined, ["make"])]);

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(0);
    expect(res.body.notFound).toEqual(["car-1", "car-2"]);
    expect(res.body.items).toEqual([]);
    expect(stored(shared)).toBe(before);
    expect(stored(otherDealer)).toBe("[]");
    expect(getPhoto(photo)).not.toBeNull();
  });

  it("when both dealerships have a car with the same id, a change reaches only the sender's", async () => {
    seed(shared, [car("car-1", { make: "Ford" })]);
    seed(otherDealer, [car("car-1", { make: "Audi" })]);
    const aBefore = stored(shared);

    const res = await edit(otherDealer.token, [change("car-1", { priceRetail: 1 })]);

    expect(res.body.changed).toBe(1);
    expect(res.body.items).toEqual([car("car-1", { make: "Audi", priceRetail: 1 })]);
    expect(stored(shared)).toBe(aBefore);
  });

  it("another dealership's deletedIds and a change in one request: deletes only its own, edits only its own", async () => {
    seed(shared, [car("car-1"), car("a-only")]);
    seed(otherDealer, [car("car-1"), car("b-only")]);
    const aBefore = stored(shared);

    const res = await edit(otherDealer.token, [change("a-only", { priceRetail: 1 }), change("b-only", { priceRetail: 2 })], { deletedIds: ["car-1"] });

    expect(res.body.items).toEqual([car("b-only", { priceRetail: 2 })]);
    expect(res.body.notFound).toEqual(["a-only"]);
    expect(stored(shared)).toBe(aBefore);
  });
});
