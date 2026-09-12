import { CarRecord } from "@/types/carTypes";



const DVLA_URL =
  "https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests";

const API_KEY = "YOUR_DVLA_API_KEY"; // replace with your real key

export async function fetchMotData(
  reg: string
): Promise<CarRecord["mot"] | undefined> {
  try {
    const response = await fetch(`${DVLA_URL}?registration=${reg}`, {
      method: "GET",
      headers: {
        "x-api-key": API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.log("DVLA MOT lookup failed:", response.status);
      return undefined;
    }

    const data = await response.json();

    const vehicle = data?.[0];
    if (!vehicle || !vehicle.motTests?.length) return undefined;

    const latest = vehicle.motTests[0];

    return {
      expiry: latest?.expiryDate ?? null,
      mileageHistory:
        latest?.odometerHistory?.map((m: any) => ({
          date: m.date,
          mileage: Number(m.value),
        })) ?? [],
      advisories: latest?.advisoryNoticeItems ?? [],
      failures: latest?.failureReasonItems ?? [],
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    console.log("MOT fetch error:", err);
    return undefined;
  }
}
