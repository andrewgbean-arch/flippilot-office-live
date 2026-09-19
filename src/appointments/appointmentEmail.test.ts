import { describe, it, expect } from "vitest";
import { appointmentEmailHref } from "./appointmentEmail";
import type { Appointment } from "./appointmentTypes";

// The "Email Customer" link staff get after confirming or declining a request
// from the open booking form. The address in it was typed by a stranger.

const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: "a1",
  vehicleLabel: "AB12 CDE — Ford Fiesta",
  customerName: "Pat O'Brien",
  customerEmail: "pat@example.com",
  type: "viewing",
  requestedDate: "2026-10-01",
  requestedTime: "10:00",
  status: "pending",
  createdAt: "2026-09-20T09:00:00.000Z",
  ...over,
});

function parts(href: string) {
  const url = new URL(href);
  return {
    recipient: decodeURIComponent(url.pathname),
    subject: url.searchParams.get("subject"),
    body: url.searchParams.get("body"),
    names: [...url.searchParams.keys()],
  };
}

const confirmed = { typeLabel: "viewing", savedStatus: "confirmed" as const, date: "2026-10-01", time: "10:00", timeChanged: false };

describe("appointmentEmailHref", () => {
  it("writes the confirmation the way staff have always sent it", () => {
    const seen = parts(appointmentEmailHref({ appointment: appointment(), ...confirmed })!);
    expect(seen.recipient).toBe("pat@example.com");
    expect(seen.subject).toBe("Your viewing — AB12 CDE — Ford Fiesta");
    expect(seen.body).toBe("Hi Pat O'Brien,\n\nYour viewing is confirmed for 2026-10-01 at 10:00.\n\nThanks,");
  });

  it("says what changed when staff moved the time, and gives the original request", () => {
    const seen = parts(
      appointmentEmailHref({ appointment: appointment(), ...confirmed, date: "2026-10-02", time: "11:30", timeChanged: true })!
    );
    expect(seen.body).toContain(
      "We'd like to confirm your viewing for 2026-10-02 at 11:30 (your original request was 2026-10-01 at 10:00). Let us know if that works."
    );
  });

  it("writes the decline when the request was declined", () => {
    const seen = parts(appointmentEmailHref({ appointment: appointment(), ...confirmed, savedStatus: "declined" })!);
    expect(seen.body).toContain("Unfortunately we're unable to confirm your requested slot");
  });

  it("gives no link when the customer left no email (they gave a phone number instead)", () => {
    expect(appointmentEmailHref({ appointment: appointment({ customerEmail: "" }), ...confirmed })).toBeNull();
    const { customerEmail: _dropped, ...noEmail } = appointment();
    expect(appointmentEmailHref({ appointment: noEmail, ...confirmed })).toBeNull();
  });

  it("keeps a stranger's address from adding a cc or bcc, or swallowing the dealer's own subject", () => {
    const hostile = "x@evil.example?cc=victim%40other.example&bcc=another%40other.example&x=";
    const seen = parts(appointmentEmailHref({ appointment: appointment({ customerEmail: hostile }), ...confirmed })!);
    // what the mail program sees: one recipient and the dealer's own subject and body, nothing else
    expect(seen.names).toEqual(["subject", "body"]);
    expect(seen.recipient).toBe(hostile);
    expect(seen.subject).toBe("Your viewing — AB12 CDE — Ford Fiesta");
    expect(seen.body).toContain("Your viewing is confirmed for 2026-10-01 at 10:00.");
  });

  it("copes with a customer name or vehicle that itself holds & = ? or a line break", () => {
    const seen = parts(
      appointmentEmailHref({
        appointment: appointment({ customerName: "Sam & Pat = friends?", vehicleLabel: "Fiesta #2\nsecond line" }),
        ...confirmed,
      })!
    );
    expect(seen.names).toEqual(["subject", "body"]);
    expect(seen.subject).toBe("Your viewing — Fiesta #2\nsecond line");
    expect(seen.body!.startsWith("Hi Sam & Pat = friends?,")).toBe(true);
  });
});
