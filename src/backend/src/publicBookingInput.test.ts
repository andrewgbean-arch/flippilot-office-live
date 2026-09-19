import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, readTenantCollection, writeTenantDoc, deleteTenantData } from "./db.js";
import { londonToday } from "./routes/publicBooking.js";

// The open booking form is the one part of the app anyone on the internet can
// write to. These tests cover what it accepts as a customer's contact details:
// an email address that can safely go into a mailto: link, a phone number that
// is judged by one consistent length rule, and the "n/a" people type into a box
// they would rather leave empty. (What it does with names and notes is in
// brainUntrustedText.test.ts.)

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];
let dealershipId: string;

afterAll(() => {
  try {
    const users = readCollection<any>("users");
    writeCollection("users", users.filter(u => !cleanupEmails.includes(u.email)));
    const dealerships = readCollection<any>("dealerships");
    writeCollection("dealerships", dealerships.filter(d => !cleanupDealershipIds.includes(d.id)));
    for (const id of cleanupDealershipIds) deleteTenantData(id);
  } catch (err) {
    console.error("publicBookingInput cleanup failed:", err);
  }
});

function shiftDate(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

beforeAll(async () => {
  const email = `public-booking-input-${runId}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "integrationtestpass123",
    name: "Booking Input Owner",
    dealershipName: "Booking Input Motors",
  });
  cleanupEmails.push(email);
  dealershipId = res.body.user.dealershipId;
  cleanupDealershipIds.push(dealershipId);
  // Open every day, so these tests don't depend on which weekday they run on.
  writeTenantDoc(dealershipId, "bookingSettings", {
    openDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    openTime: "09:00",
    closeTime: "18:00",
    slotMinutes: 30,
    closedDates: [],
  });
});

// A fresh (date, time) for every booking, so no test ever runs into a slot that
// an earlier one took (18 half-hour slots a day).
let slotCounter = 0;
function nextSlot() {
  const n = slotCounter++;
  const mins = 9 * 60 + (n % 18) * 30;
  return {
    requestedDate: shiftDate(londonToday(), 2 + Math.floor(n / 18)),
    requestedTime: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
  };
}

let phoneCounter = 0;
const uniquePhone = () => `07700 9${String(++phoneCounter).padStart(5, "0")}`;

// A booking that would be accepted, with whatever the test wants changed.
const book = (extra: Record<string, unknown> = {}) =>
  request(app)
    .post(`/public/${dealershipId}/appointments`)
    .send({
      type: "mot",
      customerVehicleReg: "AB12CDE",
      customerName: "Pat Jones",
      ...nextSlot(),
      ...extra,
    });

const appointmentCount = () => readTenantCollection<any>(dealershipId, "appointments").length;

describe("booking email: nothing that means something in a mailto link or web address can be kept", () => {
  // Exactly what an independent review sent through the open form.
  const REVIEWER_PAYLOADS = [
    "x@evil.example?cc=victim%40other.example&bcc=another%40other.example&x=",
    "a@b.co?x=1",
    "a@b.co&x=1",
    "a@b.co%0d%0aBcc%3Dx",
    "a%2Cb@c.co",
  ];
  // Each of the six characters, put in each part of an otherwise good address
  const EACH_CHARACTER = ["?", "&", "=", "%", "#", "/"].flatMap(ch => [
    `a${ch}b@example.com`,
    `ab@exa${ch}mple.com`,
    `${ch}ab@example.com`,
    `ab@example.com${ch}`,
  ]);

  it.each([...REVIEWER_PAYLOADS, ...EACH_CHARACTER])("turns down %s with a 400, and books nothing", async email => {
    const before = appointmentCount();
    const res = await book({ customerPhone: uniquePhone(), customerEmail: email });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(appointmentCount()).toBe(before);
  });

  // Written with code points, so they stay legible here whatever the editor does.
  const REAL_ADDRESSES = [
    "someone@example.com",
    "SOMEONE@EXAMPLE.COM",
    "first.last@sub.example.co.uk",
    "jo+cars@example.com",
    "o'brien@example.co.uk",
    "O'Brien@Example.CO.UK",
    "a-b_c@d-e.example.org",
    "someone@example.photography", // a long top-level domain
    "someone@example.international",
    "m\u{fc}ller@m\u{fc}nchen.de", // ü
    "jos\u{e9}@example.es", // é
    "\u{674e}@example.cn", // 李
  ];

  it.each(REAL_ADDRESSES)("still takes the real address %s, stored exactly as typed", async email => {
    const res = await book({ customerPhone: uniquePhone(), customerEmail: email });
    expect(res.status, email).toBe(200);
    expect(res.body.appointment.customerEmail).toBe(email);
    const lead = readTenantCollection<any>(dealershipId, "leads").find(l => l.id === res.body.appointment.leadId);
    expect(lead.email).toBe(email);
  });

  it("strips the spaces around an address, as before", async () => {
    const res = await book({ customerEmail: "  padded@example.com  " });
    expect(res.status).toBe(200);
    expect(res.body.appointment.customerEmail).toBe("padded@example.com");
  });
});
