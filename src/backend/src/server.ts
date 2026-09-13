import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import registerIntelligenceV3 from "./routes/intelligenceV3";
import registerSearchRoute from "./routes/search";
import registerLookupRoute from "./routes/lookup";
import registerInventoryRoute from "./routes/inventory";
import registerIntelligenceRoute from "./routes/intelligence";
import registerLeadsRoute from "./routes/leads";
import registerStaffRoute from "./routes/staff";
import registerDVLA from "./dvla";
import registerSyndicationRoute from "./routes/syndication";
import registerAuthRoute from "./routes/auth";
import { requireAuth } from "./auth";

const app = express();
// 3001 clashes with flippilotlatest's separate backend — this office
// app has its own backend and needs its own port so both can run at
// the same time.
const PORT = 4001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(helmet());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "FlipPilot Office backend running",
    timestamp: new Date().toISOString()
  });
});

registerAuthRoute(app);

registerSearchRoute(app);
registerLookupRoute(app);
registerIntelligenceRoute(app);
registerIntelligenceV3(app);

// The dealer's actual business data — previously these had zero access
// control, so anyone who found the URL could read or overwrite
// inventory/leads/staff. requireAuth runs before the route handlers
// below for these exact paths.
app.use(["/inventory", "/leads", "/staff"], requireAuth);
registerInventoryRoute(app);
registerLeadsRoute(app);
registerStaffRoute(app);
// NOTE: this calls a placeholder third-party domain
// (api.vehicleinfo.dev) that was never a real, working DVLA/MOT
// provider — it's example code, not a functional lookup. Wiring it in
// so it's at least reachable instead of silently dead, but it needs a
// real provider before /dvla will actually return anything. FlipPilot's
// main mobile app (C:\flippilotlatest\backend) already has a working
// DVSA MOT History + DVLA Vehicle Enquiry Service integration with real
// credentials — worth reusing that pattern here instead of this stub.
registerDVLA(app);
registerSyndicationRoute(app);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 FlipPilot Office backend listening on http://0.0.0.0:${PORT}`);
});
