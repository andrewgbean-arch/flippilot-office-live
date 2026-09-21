import { describe, expect, it } from "vitest";
import { FLIPPILOT_VOICES, OPENAI_VOICES, availableVoices, resolveVoice, speechRequest } from "./pilotBrainVoices";

describe("Pilot Brain voices: what this server can speak with", () => {
  it("offers nothing when no provider key is set", () => {
    expect(availableVoices({})).toEqual([]);
    expect(resolveVoice("wendy", {})).toBeNull();
  });

  it("offers FlipPilot's own voices first when the ElevenLabs key is set, then OpenAI's when that key is set too", () => {
    const both = availableVoices({ ELEVENLABS_API_KEY: "el", OPENAI_API_KEY: "oa" });
    expect(both.map((v) => v.id)).toEqual(["wendy", "pilot", "alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
    expect(availableVoices({ OPENAI_API_KEY: "oa" })).toEqual(OPENAI_VOICES);
    expect(availableVoices({ ELEVENLABS_API_KEY: "el" })).toEqual(FLIPPILOT_VOICES);
  });

  it("resolves a requested voice by id, and falls back to the first available one for anything else", () => {
    const env = { ELEVENLABS_API_KEY: "el", OPENAI_API_KEY: "oa" };
    expect(resolveVoice("nova", env)?.id).toBe("nova");
    expect(resolveVoice("pilot", env)?.providerVoiceId).toBe("5NDrq8EroHbiPJVnz4dL");
    expect(resolveVoice("made-up", env)?.id).toBe("wendy");
    expect(resolveVoice(undefined, env)?.id).toBe("wendy");
    expect(resolveVoice({ evil: true }, env)?.id).toBe("wendy");
    // Without the ElevenLabs key, "wendy" can't be produced: the OpenAI default is used instead.
    expect(resolveVoice("wendy", { OPENAI_API_KEY: "oa" })?.id).toBe("alloy");
  });

  it("builds an ElevenLabs streaming request for a FlipPilot voice, keyed by the workspace key, never by anything the client sent", () => {
    const wendy = FLIPPILOT_VOICES.find((v) => v.id === "wendy")!;
    const { url, init } = speechRequest(wendy, "Hello Boss.", { ELEVENLABS_API_KEY: "el-secret" });
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/UryOOkXFzyQ2AZGyEJ2g/stream?output_format=mp3_44100_128");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("el-secret");
    expect(JSON.parse(String(init.body))).toEqual({ text: "Hello Boss.", model_id: "eleven_multilingual_v2" });
  });

  it("builds the same OpenAI request as before for a stock voice", () => {
    const fable = OPENAI_VOICES.find((v) => v.id === "fable")!;
    const { url, init } = speechRequest(fable, "Hello Boss.", { OPENAI_API_KEY: "oa-secret" });
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer oa-secret");
    expect(JSON.parse(String(init.body))).toEqual({ model: "tts-1", voice: "fable", input: "Hello Boss." });
  });
});
