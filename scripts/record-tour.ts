// Records Wendy's tour narration with ElevenLabs, one MP3 per step, into
// public/tour/audio/<step id>.mp3, and keeps public/tour/audio/manifest.json:
// step id -> a fingerprint of the words recorded. A step is only (re)recorded
// when its words change, so editing one line costs one line.
//
//   npx tsx scripts/record-tour.ts            record what is new or changed
//   npx tsx scripts/record-tour.ts --only a,b just these steps
//   npx tsx scripts/record-tour.ts --dry      say what would be recorded, and
//                                             how many characters (the cost)
//
// The key is read from ELEVENLABS_API_KEY, or from src/backend/.env, and is
// never printed.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOUR_CHAPTERS } from "../src/tour/tourSteps";

const WENDY = "UryOOkXFzyQ2AZGyEJ2g"; // FlipPilot Wendy, the app's own voice
const MODEL = "eleven_multilingual_v2"; // the model the app speaks with (routes/pilotBrain.ts)
const OUT = join(process.cwd(), "public", "tour", "audio");
const MANIFEST = join(OUT, "manifest.json");

function apiKey(): string {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  for (const env of [join(process.cwd(), "src", "backend", ".env"), join(process.cwd(), "..", "..", "..", "src", "backend", ".env")]) {
    if (!existsSync(env)) continue;
    const line = readFileSync(env, "utf8").split(/\r?\n/).find(l => l.startsWith("ELEVENLABS_API_KEY="));
    if (line) return line.slice("ELEVENLABS_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("No ELEVENLABS_API_KEY found (environment or src/backend/.env)");
}

const fingerprint = (text: string) => createHash("sha256").update(`${WENDY}|${MODEL}|${text}`).digest("hex").slice(0, 16);

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const onlyArg = args[args.indexOf("--only") + 1];
  const only = args.includes("--only") && onlyArg ? new Set(onlyArg.split(",")) : null;

  mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, string> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const steps = TOUR_CHAPTERS.flatMap(c => c.pages.flatMap(p => p.steps));
  const todo = steps.filter(
    s => (only ? only.has(s.id) : true) && (manifest[s.id] !== fingerprint(s.narration) || !existsSync(join(OUT, `${s.id}.mp3`)))
  );
  const chars = todo.reduce((n, s) => n + s.narration.length, 0);
  console.log(`${todo.length} of ${steps.length} steps to record, ${chars.toLocaleString("en-GB")} characters`);
  if (dry || todo.length === 0) return;

  const key = apiKey();
  for (const step of todo) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${WENDY}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: step.narration,
        model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (!res.ok) {
      console.error(`${step.id}: ElevenLabs said ${res.status} ${(await res.text()).slice(0, 200)}`);
      process.exitCode = 1;
      break;
    }
    writeFileSync(join(OUT, `${step.id}.mp3`), Buffer.from(await res.arrayBuffer()));
    manifest[step.id] = fingerprint(step.narration);
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`recorded ${step.id}`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
