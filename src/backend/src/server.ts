import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import registerIntelligenceV3 from "./routes/intelligenceV3";
import registerSearchRoute from "./routes/search";
import registerLookupRoute from "./routes/lookup";
import registerInventoryRoute from "./routes/inventory";
import registerIntelligenceRoute from "./routes/intelligence";

const app = express();
const PORT = 3001;

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

registerSearchRoute(app);
registerLookupRoute(app);
registerInventoryRoute(app);
registerIntelligenceRoute(app);
registerIntelligenceV3(app);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 FlipPilot Office backend listening on http://0.0.0.0:${PORT}`);
});
