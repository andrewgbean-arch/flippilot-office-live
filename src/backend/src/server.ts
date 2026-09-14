import app from "./app";

// 3001 clashes with flippilotlatest's separate backend — this office
// app has its own backend and needs its own port so both can run at
// the same time.
const PORT = 4001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 FlipPilot Office backend listening on http://0.0.0.0:${PORT}`);
});
