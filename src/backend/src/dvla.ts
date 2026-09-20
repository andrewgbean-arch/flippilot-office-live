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

  // encodeURIComponent matters here — reg is only whitespace-stripped/
  // uppercased before reaching this function (see the /dvla handler
  // below), not restricted to a safe character set, and this URL is
  // built by raw string interpolation. Without it, a crafted reg value
  // could inject extra path segments into the real request sent to
  // DVSA's own API.
  const res = await axios.get(
    `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(reg)}`,
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

// Two real bugs here, found together: (1) this code originally read
// `rfrAndComments`, a field name from an older version of DVSA's docs —
// the live API's actual field is `defects` (confirmed via a raw,
// unmapped call to the real endpoint), so every failure/advisory
// extraction silently returned nothing no matter what. (2) `type`
// changed at the May 2018 MOT reform: tests before that date use a
// flat "FAIL", tests since then split failures into "MAJOR"/
// "DANGEROUS" (severity), with "MINOR" as a non-failing note and
// "ADVISORY" unchanged throughout — filtering only for "FAIL" would
// still return nothing for any modern (post-2018) failed test even
// with the field name fixed. Confirmed live end-to-end: a real 2023
// FAIL result went from an empty failures array to its actual 3 real
// defect descriptions once both were fixed.
const FAIL_TYPES = new Set(["FAIL", "MAJOR", "DANGEROUS"]);

function extractComments(defects: any[] | undefined, type: "ADVISORY" | "FAIL"): string[] {
  const matchesType = (c: any) => (type === "FAIL" ? FAIL_TYPES.has(c.type) : c.type === type);
  return (defects ?? [])
    .filter(matchesType)
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
    // ?reg=A&reg=B arrives as an array and ?reg[x]=1 as an object; only plain text is a registration.
    const rawReg = req.query.reg;
    const reg = typeof rawReg === "string" ? rawReg.replace(/\s+/g, "").toUpperCase() : undefined;

    if (!reg) {
      return res.status(400).json({ ok: false, error: "Missing reg" });
    }

    // Real UK registrations are alphanumeric only, no more than 7
    // characters. Rejecting anything else here — on top of the
    // encodeURIComponent below — stops a crafted value from reaching
    // the outbound request to DVSA/DVLA's real APIs at all.
    if (!/^[A-Z0-9]{1,7}$/.test(reg)) {
      return res.status(400).json({ ok: false, error: "Invalid registration format" });
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
        // DVLA-only fields (not part of MOT history) — needed to
        // compute real ULEZ/CAZ compliance client-side. Only present
        // once DVLA_API_KEY is configured.
        fuelType: dvla?.fuelType ?? null,
        euroStatus: dvla?.euroStatus ?? null,
        advisories: extractComments(latestMot?.defects, "ADVISORY"),
        history: motTests.map((t) => ({
          date: t.completedDate ?? null,
          year: t.completedDate ? new Date(t.completedDate).getFullYear() : null,
          result: normaliseResult(t.testResult),
          mileage: t.odometerValue ?? null,
          advisories: extractComments(t.defects, "ADVISORY"),
          failures: extractComments(t.defects, "FAIL"),
          // The two fields the real GOV.UK MOT history checker shows per
          // test alongside date/result/mileage that this app never
          // captured before — real DVSA fields, not derived.
          testNumber: t.motTestNumber ?? null,
          expiryDate: t.expiryDate ?? null,
        })),
      },
    });
  });
}
