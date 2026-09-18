import { describe, it, expect } from "vitest";
import { summariseAppointmentOutcomes, type OutcomeAppointment } from "./appointmentOutcomes";

// A fixed "now" so nothing here depends on the real date: 2030-03-15 noon.
const NOW = new Date("2030-03-15T12:00:00").getTime();

function appt(date: string, patch: Partial<OutcomeAppointment> = {}): OutcomeAppointment {
  return { type: "viewing", requestedDate: date, requestedTime: "10:00", status: "completed", ...patch };
}

describe("summariseAppointmentOutcomes", () => {
  it("says plainly that nothing is recorded yet, rather than implying a rate", () => {
    const lines = summariseAppointmentOutcomes([appt("2030-03-10", { status: "confirmed" })], NOW);
    expect(lines[0]).toContain("none recorded yet");
    expect(lines.join(" ")).not.toContain("show rate");
    expect(lines[1]).toBe("1 past appointment in that window still has no recorded outcome.");
  });

  it("counts real outcomes and derives the show rate from them", () => {
    const lines = summariseAppointmentOutcomes(
      [
        appt("2030-03-01", { outcome: "showed" }),
        appt("2030-03-02", { outcome: "purchased" }),
        appt("2030-03-03", { outcome: "no_show" }),
        appt("2030-03-04", { outcome: "showed" }),
        appt("2030-03-05", { outcome: "no_show" }),
      ],
      NOW
    );
    expect(lines[0]).toContain("5 recorded");
    expect(lines[0]).toContain("3 attended (2 showed, 1 bought), 2 no-show");
    expect(lines[0]).toContain("show rate 60%");
    expect(lines[0]).not.toContain("too few"); // 5 is enough to state a rate plainly
  });

  it("flags a small sample instead of presenting a percentage as a trend", () => {
    const lines = summariseAppointmentOutcomes(
      [appt("2030-03-01", { outcome: "showed" }), appt("2030-03-02", { outcome: "no_show" })],
      NOW
    );
    expect(lines[0]).toContain("show rate 50%");
    expect(lines[0]).toContain("only 2 recorded — too few to call a trend");
  });

  it("leaves MOT bookings out of the 'did they buy' rate", () => {
    const lines = summariseAppointmentOutcomes(
      [
        appt("2030-03-01", { outcome: "purchased" }),
        appt("2030-03-02", { outcome: "showed" }),
        appt("2030-03-03", { type: "mot", outcome: "showed" }),
        appt("2030-03-04", { type: "mot", outcome: "showed" }),
      ],
      NOW
    );
    expect(lines[0]).toContain("4 attended (3 showed, 1 bought)"); // MOTs still count as turning up
    expect(lines[1]).toBe("Of 2 viewings/test drives that were attended, 1 bought (50%).");
  });

  it("ignores appointments outside the 90-day window and ones that haven't happened yet", () => {
    const lines = summariseAppointmentOutcomes(
      [
        appt("2029-11-01", { outcome: "purchased" }), // months ago
        appt("2030-03-20", { status: "confirmed" }), // still in the future
        appt("2030-03-10", { outcome: "showed" }),
      ],
      NOW
    );
    expect(lines[0]).toContain("1 recorded");
    expect(lines[0]).toContain("1 attended (1 showed, 0 bought)");
    expect(lines.join(" ")).not.toContain("no recorded outcome"); // the future one isn't "awaiting"
  });

  it("counts only past confirmed/completed appointments as awaiting an outcome", () => {
    const lines = summariseAppointmentOutcomes(
      [
        appt("2030-03-01", { status: "completed" }), // closed out, no outcome
        appt("2030-03-02", { status: "confirmed" }), // happened, never closed out
        appt("2030-03-03", { status: "pending" }), // never confirmed — not awaiting
        appt("2030-03-04", { status: "declined" }), // never happened
        appt("2030-03-05", { status: "completed", outcome: "showed" }),
      ],
      NOW
    );
    expect(lines[lines.length - 1]).toBe("2 past appointments in that window still have no recorded outcome.");
  });

  it("skips records with unreadable dates instead of producing NaN", () => {
    const lines = summariseAppointmentOutcomes(
      [appt("not-a-date", { outcome: "showed" }), appt("2030-03-01", { outcome: "showed" })],
      NOW
    );
    expect(lines.join(" ")).not.toContain("NaN");
    expect(lines[0]).toContain("1 recorded");
  });
});
