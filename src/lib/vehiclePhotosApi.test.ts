import { describe, it, expect, vi, afterEach } from "vitest";
import { deleteVehiclePhoto, hostedPhotoId } from "./vehiclePhotosApi";

const ID = "3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hostedPhotoId", () => {
  it("finds the id in a hosted photo's address", () => {
    expect(hostedPhotoId(`https://api.example.com/photos/${ID}.jpg`)).toBe(ID);
    expect(hostedPhotoId(`http://localhost:4001/photos/${ID}.png?v=2`)).toBe(ID);
    expect(hostedPhotoId(`https://x.test/photos/${ID.toUpperCase()}.webp`)).toBe(ID);
  });

  it("is null for inline pictures and anything that isn't ours", () => {
    expect(hostedPhotoId("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBeNull();
    expect(hostedPhotoId("https://cdn.example.com/cars/fiesta.jpg")).toBeNull();
    expect(hostedPhotoId(`https://x.test/photos/${ID}.exe`)).toBeNull();
    expect(hostedPhotoId("")).toBeNull();
    // a huge inline picture is dismissed without running the pattern over it
    expect(hostedPhotoId(`data:image/jpeg;base64,${"A".repeat(400_000)}`)).toBeNull();
  });
});

describe("deleteVehiclePhoto", () => {
  it("calls the delete endpoint for that vehicle and photo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const result = await deleteVehiclePhoto("car 1", ID);
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(new RegExp(`/inventory/car%201/photos/${ID}$`));
    expect(init.method).toBe("DELETE");
  });

  it("treats 'already gone' as done, so a retried save can't get stuck", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    expect((await deleteVehiclePhoto("car-1", ID)).ok).toBe(true);
  });

  it("reports the server's reason when it refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Not allowed" }) })
    );
    const result = await deleteVehiclePhoto("car-1", ID);
    expect(result).toEqual({ ok: false, error: "Not allowed" });
  });

  it("reports a network failure instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await deleteVehiclePhoto("car-1", ID);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach the server/);
  });
});
