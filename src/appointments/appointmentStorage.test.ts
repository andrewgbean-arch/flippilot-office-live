import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { BASE_URL } from "@/lib/apiBaseUrl";
import { loadAppointments, updateAppointment } from "./appointmentStorage.web";

// The booking list is fetched again every minute and whenever the Bookings
// screen opens. A read that fails must say so (null), never pass for "no
// bookings", or one network blip would empty the dealer's screen.

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const booking = { id: "a1", customerName: "Sam Carter", status: "pending" };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", { getItem: () => "test-token", setItem: () => undefined, removeItem: () => undefined });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadAppointments", () => {
  it("returns the list, read with the login token", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, items: [booking] }));
    expect(await loadAppointments()).toEqual([booking]);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe(`${BASE_URL}/appointments`);
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("an empty list is a real answer", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, items: [] }));
    expect(await loadAppointments()).toEqual([]);
  });

  it("is null, not empty, when the server refuses or errors", async () => {
    fetchMock.mockResolvedValue(json(500, { ok: false, error: "boom" }));
    expect(await loadAppointments()).toBeNull();
    fetchMock.mockResolvedValue(json(401, { ok: false, error: "Not signed in" }));
    expect(await loadAppointments()).toBeNull();
  });

  it("is null when the server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await loadAppointments()).toBeNull();
  });

  it("is null when the answer has no list in it", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    expect(await loadAppointments()).toBeNull();
  });
});

describe("updateAppointment", () => {
  it("hands back the server's list after a save", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, items: [{ ...booking, status: "confirmed" }] }));
    const res = await updateAppointment("a1", { status: "confirmed" });
    expect(res).toEqual({ ok: true, error: undefined, items: [{ ...booking, status: "confirmed" }] });
  });

  it("never hands back an empty list it didn't get", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    expect((await updateAppointment("a1", { status: "confirmed" })).items).toBeNull();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await updateAppointment("a1", { status: "confirmed" })).toEqual({ ok: false, error: "Network error", items: null });
  });
});
