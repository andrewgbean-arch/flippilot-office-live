import axios from "axios";
import { Express } from "express";

// Real DVSA MOT History API (OAuth2 client-credentials) + real DVLA
// Vehicle Enquiry Service (VES). This used to call a placeholder domain
// (api.vehicleinfo.dev) that was never a real government provider —
// same proven integration pattern as the sibling flippilotlatest
// project's working /vehicle endpoint, ported here. Both APIs are
// optional/independent: a missing credential set warns at startup and
// disables just that piece, matching this project's existing Stripe
// env-check pattern, rather than crashing the whole server.
const motLookupEnv = ["API_KEY", "TOKEN_URL", "CLIENT_ID", "CLIENT_SECRET", "SCOPE_URL"];
const dvlaLookupEnv = ["DVLA_API_KEY"];

let motTokenCache: { token: string; expiresAt: number } | null = null;

async function getMotAccessToken(): Promise<string> {
  if (motTokenCache && motTokenCache.expiresAt > Date.now() + 30_000) {
    return motTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CLIENT_ID!,
    client_secret: process.env.CLIENT_SECRET!,
    scope: process.env.SCOPE_URL!,
  });

  const tokenRes = await axios.post(process.env.TOKEN_URL!, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { access_token, expires_in } = tokenRes.data;
  motTokenCache = {
    token: access_token,
    expiresAt: Date.now() + Number(expires_in ?? 3600) * 1000,
  };

  return access_token;
}

async function fetchMotHistory(reg: string): Promise<any | null> {
  const token = await getMotAccessToken();

  const res = await axios.get(
    `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": process.env.API_KEY!,
      },
      validateStatus: (status) => status === 200 || status === 404,
    }
  );

  if (res.status === 404) return null;
  return res.data;
}

async function fetchDvlaVehicle(reg: string): Promise<any> {
  const res = await axios.post(
    "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
    { registrationNumber: reg },
    {
      headers: {
        "x-api-key": process.env.DVLA_API_KEY!,
        "Content-Type": "application/json",
      },
    }
  );
  return res.data;
}

// This app's convention (ultraInventory.ts seed data, and every real
// consumer — MOTInsightsPanel, VehicleOverview, MOTWorkflow) compares
// against short "PASS"/"FAIL", not DVSA's actual "PASSED"/"FAILED".
function normaliseResult(testResult: string | undefined): string {
  return testResult === "PASSED" ? "PASS" : "FAIL";
}

function extractComments(rfrAndComments: any[] | undefined, type: "ADVISORY" | "FAIL"): string[] {
  return (rfrAndComments ?? [])
    .filter((c: any) => c.type === type)
    .map((c: any) => c.text as string);
}

export default function registerDVLA(app: Express) {
  const missingMotEnv = motLookupEnv.filter((key) => !process.env[key]);
  const missingDvlaEnv = dvlaLookupEnv.filter((key) => !process.env[key]);

  if (missingMotEnv.length > 0) {
    console.warn(
      `⚠️  Missing environment variable(s): ${missingMotEnv.join(", ")} — real MOT lookup disabled until these are set in backend/.env.`
    );
  }
  if (missingDvlaEnv.length > 0) {
    console.warn(
      `⚠️  Missing environment variable(s): ${missingDvlaEnv.join(", ")} — DVLA vehicle lookup disabled until these are set in backend/.env.`
    );
  }

  app.get("/dvla", async (req, res) => {
    const reg = (req.query.reg as string)?.replace(/\s+/g, "").toUpperCase();

    if (!reg) {
      return res.status(400).json({ ok: false, error: "Missing reg" });
    }

    const motConfigured = missingMotEnv.length === 0;
    const dvlaConfigured = missingDvlaEnv.length === 0;

    if (!motConfigured && !dvlaConfigured) {
      return res.status(503).json({
        ok: false,
        error: `MOT/DVLA lookup is not configured — missing: ${[...missingMotEnv, ...missingDvlaEnv].join(", ")}`,
      });
    }

    let dvla: any = null;
    if (dvlaConfigured) {
      try {
        dvla = await fetchDvlaVehicle(reg);
      } catch (err: any) {
        console.error("DVLA lookup failed:", err.response?.data || err.message);
      }
    }

    let mot: any = null;
    if (motConfigured) {
      try {
        mot = await fetchMotHistory(reg);
      } catch (err: any) {
        console.error("MOT history lookup failed:", err.response?.data || err.message);
      }
    }

    if (!dvla && !mot) {
      return res.status(404).json({ ok: false, error: `No vehicle data found for ${reg}` });
    }

    const motTests: any[] = mot?.motTests ?? [];
    const latestMot = motTests[0] ?? null;

    return res.json({
      ok: true,
      vehicle: {
        reg,
        make: dvla?.make ?? mot?.make ?? null,
        model: dvla?.model ?? mot?.model ?? null,
        year: dvla?.yearOfManufacture ?? null,
        colour: dvla?.colour ?? mot?.primaryColour ?? null,
        mileage: latestMot?.odometerValue ?? null,
        // The actual expiry date this whole feature is about — DVLA's
        // motExpiryDate is the more current/authoritative field when
        // available, falling back to the latest MOT test's own expiry.
        expiry: dvla?.motExpiryDate ?? latestMot?.expiryDate ?? null,
        advisories: extractComments(latestMot?.rfrAndComments, "ADVISORY"),
        history: motTests.map((t) => ({
          date: t.completedDate ?? null,
          year: t.completedDate ? new Date(t.completedDate).getFullYear() : null,
          result: normaliseResult(t.testResult),
          mileage: t.odometerValue ?? null,
          advisories: extractComments(t.rfrAndComments, "ADVISORY"),
          failures: extractComments(t.rfrAndComments, "FAIL"),
        })),
      },
    });
  });
}
