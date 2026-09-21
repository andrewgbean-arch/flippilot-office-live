// The voices Pilot Brain can speak with, and which of them this server can
// actually produce right now.
//
// Two providers:
//  - FlipPilot's own voices, designed for the product and kept in the
//    company's ElevenLabs voice library. Available when ELEVENLABS_API_KEY
//    is set (a key from the SAME workspace the voices live in, or the ids
//    below don't resolve).
//  - OpenAI's six stock voices (tts-1). Available when OPENAI_API_KEY is set.
//
// The list the picker shows is built from what is configured, never from a
// fixed list, so a dealer is never offered a voice that would then fail.
// Voice ids are whitelisted here: the id a client sends is looked up, never
// passed through to a paid API.

export type VoiceProvider = "elevenlabs" | "openai";

export interface PilotVoice {
  id: string;
  label: string;
  provider: VoiceProvider;
  /** The provider's own identifier for the voice. */
  providerVoiceId: string;
}

export const FLIPPILOT_VOICES: readonly PilotVoice[] = [
  { id: "wendy", label: "Wendy (FlipPilot)", provider: "elevenlabs", providerVoiceId: "UryOOkXFzyQ2AZGyEJ2g" },
  { id: "pilot", label: "Pilot (FlipPilot, male)", provider: "elevenlabs", providerVoiceId: "5NDrq8EroHbiPJVnz4dL" },
];

export const OPENAI_VOICE_IDS = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

export const OPENAI_VOICES: readonly PilotVoice[] = OPENAI_VOICE_IDS.map((id) => ({
  id,
  label: `${id} (OpenAI)`,
  provider: "openai",
  providerVoiceId: id,
}));

export interface VoiceEnv {
  ELEVENLABS_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

/** Every voice this server can produce, FlipPilot's own first. */
export function availableVoices(env: VoiceEnv = process.env): readonly PilotVoice[] {
  const out: PilotVoice[] = [];
  if (env.ELEVENLABS_API_KEY) out.push(...FLIPPILOT_VOICES);
  if (env.OPENAI_API_KEY) out.push(...OPENAI_VOICES);
  return out;
}

/**
 * The voice to use for a request. An id the server can't produce (stale
 * choice in a browser, a provider key removed) falls back to the first
 * available voice rather than failing; the route reports which one it used.
 * Returns null only when no provider is configured at all.
 */
export function resolveVoice(requested: unknown, env: VoiceEnv = process.env): PilotVoice | null {
  const voices = availableVoices(env);
  if (voices.length === 0) return null;
  const wanted = typeof requested === "string" ? voices.find((v) => v.id === requested) : undefined;
  return wanted ?? voices[0] ?? null;
}

/** The request that produces MP3 audio for `text` in `voice`, ready for fetch(). */
export function speechRequest(voice: PilotVoice, text: string, env: VoiceEnv = process.env): { url: string; init: RequestInit } {
  if (voice.provider === "elevenlabs") {
    return {
      url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.providerVoiceId)}/stream?output_format=mp3_44100_128`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": env.ELEVENLABS_API_KEY ?? "" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      },
    };
  }
  return {
    url: "https://api.openai.com/v1/audio/speech",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}` },
      body: JSON.stringify({ model: "tts-1", voice: voice.providerVoiceId, input: text }),
    },
  };
}
