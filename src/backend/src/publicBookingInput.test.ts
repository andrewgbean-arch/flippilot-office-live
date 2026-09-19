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

describe("booking phone: one length rule for every value, room for a real number, and a message that says what to do", () => {
  // A good email alongside, so it is always the phone number being judged.
  const withEmail = (customerPhone: unknown, n: number) => ({ customerPhone, customerEmail: `phone-test-${runId}-${n}@example.com` });
  let n = 0;

  // Real numbers as real customers type them. The first, third, fourth and
  // fifth were refused or silently cut short when the limit was 30 characters.
  const REAL_PHONES = [
    "+44 (0) 1234 567 890 ext. 12345", // 31 characters
    "Home 01234 567890, Mobile 07700 900123", // 38: two numbers
    "+44 7700 900123 (mobile, after 6pm)", // 35: used to be stored as "+44 7700 900123 (mobile, after"
    "Mobile 07700 900123 Home 01234 567890", // 37: used to lose the second number
    "07700 900123 (mobile) 01234 567890", // 34: used to be refused
    "0".repeat(40), // exactly the limit
    "0123456789".repeat(3) + "012345" + "\u{1f4de}".repeat(4), // 36 digits and 4 telephone emoji: 40 characters, though 44 UTF-16 units
  ];

  it.each(REAL_PHONES)("takes %s and keeps all of it", async phone => {
    const res = await book(withEmail(phone, n++));
    expect(res.status, phone).toBe(200);
    expect(res.body.appointment.customerPhone).toBe(phone);
    const lead = readTenantCollection<any>(dealershipId, "leads").find(l => l.id === res.body.appointment.leadId);
    expect(lead.phone).toBe(phone);
  });

  const TOO_LONG = [
    "0".repeat(41),
    "0".repeat(80),
    // 42 characters, and the 41st is a space: cut to 41 and trimmed it looks like 40, so it used to slip through cut short
    "0".repeat(40) + " 1",
    "Home 01234 567890, Mobile 07700 900123, Work 020 7946 0958", // three numbers
    "0".repeat(39) + "\u{1f4de}\u{1f4de}", // 39 digits and two emoji: 41 characters
  ];

  it.each(TOO_LONG)("turns down %s (over 40 characters) with a 400 that says what to do, and books nothing", async phone => {
    const before = appointmentCount();
    const res = await book(withEmail(phone, n++));
    expect(res.status, phone).toBe(400);
    expect(res.body.error).toContain("one phone number");
    expect(res.body.error).toContain("40 characters");
    expect(appointmentCount()).toBe(before);
  });

  it("still turns down a phone number with too few digits, or that is not text, with the same advice", async () => {
    for (const phone of ["abc", "12", "0770", { $ne: "" }, ["07700900123"], 7700900123]) {
      const res = await book(withEmail(phone, n++));
      expect(res.status, JSON.stringify(phone)).toBe(400);
      expect(res.body.error).toContain("one phone number");
    }
  });
});

describe("booking contact boxes left with a placeholder: 'n/a' is blank, not a mistake", () => {
  const PLACEHOLDERS = [
    "n/a", "N/A", "na", "NA", "none", "None", "no", "No", "-", "--", "?", "x", "X",
    "no email", "No Email", "no phone", "No Phone", "not applicable", "Not Applicable", "N/A.", "n.a", "N.A.", "nil",
  ];
  let n = 0;

  it.each(PLACEHOLDERS)("%s in the email box is treated as blank when there is a good phone number", async placeholder => {
    const phone = uniquePhone();
    const res = await book({ customerPhone: phone, customerEmail: placeholder });
    expect(res.status, placeholder).toBe(200);
    expect(res.body.appointment.customerPhone).toBe(phone);
    expect(res.body.appointment).not.toHaveProperty("customerEmail");
    const lead = readTenantCollection<any>(dealershipId, "leads").find(l => l.id === res.body.appointment.leadId);
    expect(lead).not.toHaveProperty("email");
  });

  it.each(PLACEHOLDERS)("%s in the phone box is treated as blank when there is a good email address", async placeholder => {
    const email = `placeholder-${runId}-${n++}@example.com`;
    const res = await book({ customerPhone: placeholder, customerEmail: email });
    expect(res.status, placeholder).toBe(200);
    expect(res.body.appointment.customerEmail).toBe(email);
    expect(res.body.appointment).not.toHaveProperty("customerPhone");
  });

  it("still needs one real way to reach the customer, and says so", async () => {
    const before = appointmentCount();
    for (const extra of [
      { customerPhone: "n/a", customerEmail: "none" },
      { customerPhone: "-", customerEmail: "-" },
      { customerPhone: "n/a" },
      { customerEmail: "n/a" },
      { customerPhone: "  ", customerEmail: "" },
      {},
    ]) {
      const res = await book(extra);
      expect(res.status, JSON.stringify(extra)).toBe(400);
      expect(res.body.error).toContain("phone number or email");
    }
    expect(appointmentCount()).toBe(before);
  });

  it("does not excuse a real mistake in the other box", async () => {
    const badEmail = await book({ customerPhone: "n/a", customerEmail: "not an email" });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error).toContain("name@example.com");
    const badPhone = await book({ customerPhone: "abc", customerEmail: "n/a" });
    expect(badPhone.status).toBe(400);
    expect(badPhone.body.error).toContain("one phone number");
  });

  it("does not mistake a real phone number or email for a placeholder", async () => {
    // (none of these is one of the words above, but each starts or ends like one)
    const res = await book({ customerPhone: "07700 900123 no answer after 6", customerEmail: "no.reply.sam@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.appointment.customerPhone).toBe("07700 900123 no answer after 6");
    expect(res.body.appointment.customerEmail).toBe("no.reply.sam@example.com");
  });
});

describe("booking email: length, judged before anything is cut", () => {
  it("takes an address of exactly 254 characters and turns down one of 255", async () => {
    const domain = "@example.com";
    const at254 = "a".repeat(254 - domain.length) + domain;
    const ok = await book({ customerEmail: at254 });
    expect(ok.status).toBe(200);
    expect(ok.body.appointment.customerEmail).toBe(at254);
    const tooLong = await book({ customerEmail: "a" + at254 });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error).toContain("name@example.com");
  });
});
