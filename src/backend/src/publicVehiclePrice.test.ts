import "./testPrivateDatabase.js"; // must stay first: see that file
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, writeTenantCollection, deleteTenantData } from "./db.js";
import { publicAskingPrice } from "./routes/publicBooking.js";

// The public store page shows a stranger the price the dealer has SET on the car
// (its asking price, priceRetail) and nothing else.
//
// The route used to answer `priceRetail ?? sellPrice`. New Vehicle and the CSV
// import write the asking price to BOTH fields, but Edit Vehicle only ever touched
// priceRetail: after the dealer cleared the Retail Price (the app then shows "Not
// set") the old sellPrice was still advertised to the public.

const runId = Date.now();
const email = `public-vehicle-price-${runId}@test.local`;
let dealershipId: string;

const car = (id: string, extra: Record<string, unknown>) => ({
  id: `price-test-${runId}-${id}`,
  make: "Ford",
  model: "Fiesta",
  year: 2018,
  mileage: 40000,
  status: "new",
  ...extra,
});

async function publicPrices(): Promise<Record<string, number | null>> {
  const res = await request(app).get(`/public/${dealershipId}/vehicles`);
  expect(res.status).toBe(200);
  const out: Record<string, number | null> = {};
  for (const v of res.body.items) out[v.id.replace(`price-test-${runId}-`, "")] = v.priceRetail;
  return out;
}

beforeAll(async () => {
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "integrationtestpass123",
    name: "Public Price Owner",
    dealershipName: "Public Price Motors",
  });
  dealershipId = res.body.user.dealershipId;
});

afterAll(() => {
  try {
    writeCollection(
      "users",
      readCollection<any>("users").filter(u => u.email !== email)
    );
    writeCollection(
      "dealerships",
      readCollection<any>("dealerships").filter(d => d.id !== dealershipId)
    );
    if (dealershipId) deleteTenantData(dealershipId);
  } catch (err) {
    console.error("publicVehiclePrice cleanup failed:", err);
  }
});

describe("the public store feed only ever advertises the price the dealer has set", () => {
  it("a price cleared on Edit Vehicle stays cleared, even though sellPrice still holds the old figure", async () => {
    // What Edit Vehicle left behind after clearing the Retail Price of a car made
    // on New Vehicle: priceRetail null, sellPrice still the asking price.
    writeTenantCollection(dealershipId, "vehicles", [car("cleared", { priceRetail: null, sellPrice: 8000 })]);
    expect((await publicPrices()).cleared).toBeNull();
  });

  it("a price that is set is advertised as set", async () => {
    writeTenantCollection(dealershipId, "vehicles", [car("set", { priceRetail: 8000, sellPrice: 8000 })]);
    expect((await publicPrices()).set).toBe(8000);
  });

  it("the asking price wins over a different sellPrice, in either direction", async () => {
    writeTenantCollection(dealershipId, "vehicles", [car("changed", { priceRetail: 7500, sellPrice: 8000 })]);
    expect((await publicPrices()).changed).toBe(7500);
  });

  it("a car with no price, or a stored 0, has no public price (never £0)", async () => {
    writeTenantCollection(dealershipId, "vehicles", [
      car("none", {}),
      car("zero", { priceRetail: 0, sellPrice: 0 }),
      car("nulls", { priceRetail: null, sellPrice: null }),
    ]);
    const prices = await publicPrices();
    expect(prices.none).toBeNull();
    expect(prices.zero).toBeNull();
    expect(prices.nulls).toBeNull();
  });

  it("junk in the stored price is never passed on", () => {
    for (const junk of ["8000", NaN, Infinity, -Infinity, -100, 0, null, undefined, {}, []]) {
      expect(publicAskingPrice(junk), String(junk)).toBeNull();
    }
    expect(publicAskingPrice(8000)).toBe(8000);
    expect(publicAskingPrice(6499.5)).toBe(6499.5);
  });

  it("a sold car is not listed at all, whatever its price", async () => {
    writeTenantCollection(dealershipId, "vehicles", [car("sold", { priceRetail: 8000, sellPrice: 7600, status: "sold" })]);
    expect("sold" in (await publicPrices())).toBe(false);
  });
});
