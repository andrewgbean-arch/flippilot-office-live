import { describe, it, expect } from "vitest";
import { leadUpdateForBooking, bookedStatus } from "./leadBookingStatus";

describe("bookedStatus", () => {
  it("names the stage each booking type puts a new lead in", () => {
    expect(bookedStatus("viewing")).toBe("viewing_booked");
    expect(bookedStatus("test_drive")).toBe("test_drive");
    expect(bookedStatus("mot")).toBe("mot_booked");
  });
});

describe("leadUpdateForBooking — what a website booking does to an EXISTING lead", () => {
  it("never touches a lead that has already been won, whatever they book", () => {
    for (const type of ["viewing", "test_drive", "mot"] as const) {
      expect(leadUpdateForBooking("won", type)).toEqual({ status: "won", updateInterest: false });
    }
    expect(leadUpdateForBooking(" WON ", "viewing").updateInterest).toBe(false); // however it was typed
  });

  it("treats an MOT booking as a service visit: no status change and no change of interested vehicle", () => {
    for (const status of ["new", "contacted", "viewing_booked", "negotiating", "lost"]) {
      expect(leadUpdateForBooking(status, "mot")).toEqual({ status, updateInterest: false });
    }
  });

  it("moves an earlier-stage lead forward to the stage just booked", () => {
    expect(leadUpdateForBooking("new", "viewing")).toEqual({ status: "viewing_booked", updateInterest: true });
    expect(leadUpdateForBooking("contacted", "viewing")).toEqual({ status: "viewing_booked", updateInterest: true });
    expect(leadUpdateForBooking("new", "test_drive")).toEqual({ status: "test_drive", updateInterest: true });
    expect(leadUpdateForBooking("viewing_booked", "test_drive")).toEqual({ status: "test_drive", updateInterest: true });
  });

  it("never pushes a lead back to an earlier stage", () => {
    expect(leadUpdateForBooking("test_drive", "viewing").status).toBe("test_drive");
    expect(leadUpdateForBooking("negotiating", "viewing").status).toBe("negotiating");
    expect(leadUpdateForBooking("negotiating", "test_drive").status).toBe("negotiating");
    expect(leadUpdateForBooking("viewing_booked", "viewing").status).toBe("viewing_booked"); // same stage: stay
  });

  it("reopens a lost lead who books a viewing or test drive — a real re-engagement", () => {
    expect(leadUpdateForBooking("lost", "viewing")).toEqual({ status: "viewing_booked", updateInterest: true });
    expect(leadUpdateForBooking("lost", "test_drive")).toEqual({ status: "test_drive", updateInterest: true });
  });

  it("moves a lead whose status is blank, missing, odd, or left over from an earlier MOT booking", () => {
    expect(leadUpdateForBooking("mot_booked", "viewing").status).toBe("viewing_booked");
    expect(leadUpdateForBooking("", "test_drive").status).toBe("test_drive");
    expect(leadUpdateForBooking(undefined, "viewing").status).toBe("viewing_booked");
    expect(leadUpdateForBooking(42, "viewing").status).toBe("viewing_booked");
    expect(leadUpdateForBooking("some custom stage", "viewing").status).toBe("viewing_booked");
  });

  it("keeps the status exactly as stored when it stays put (no case or spacing rewrite)", () => {
    expect(leadUpdateForBooking("Negotiating", "viewing").status).toBe("Negotiating");
  });
});
