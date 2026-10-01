import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { HOWTO_VIDEOS, lengthLabel, videosFor, videosForPage, videoFile, type HowtoVideo } from "./howtoVideos";
import HowtoVideoPlayer from "./HowtoVideoPlayer";
import type { AuthUser } from "@/context/AuthContext";

// The how-to videos in the app (howtoVideos.ts): the files are really there, the
// lengths shown are the real lengths, and each screen offers the right ones to
// the right people.

const PUBLIC = join(__dirname, "..", "..", "public");
const SRC = join(__dirname, "..");
const as = (role: "owner" | "staff", staffRole?: AuthUser["staffRole"]) =>
  ({ id: "u", email: "u@x", name: "U", role, dealershipId: "d", ...(staffRole ? { staffRole } : {}) }) as AuthUser;
const owner = as("owner");
const ids = (vs: HowtoVideo[]) => vs.map((v) => v.id);

// An MP4's length, from its movie header (the "mvhd" box): timescale and duration.
function mp4Seconds(file: string): number {
  const buf = readFileSync(file);
  const at = buf.indexOf("mvhd");
  if (at < 0) throw new Error(`${file}: no mvhd`);
  const version = buf[at + 4];
  if (version === 1) {
    const timescale = buf.readUInt32BE(at + 4 + 4 + 16);
    const duration = Number(buf.readBigUInt64BE(at + 4 + 4 + 20));
    return duration / timescale;
  }
  const timescale = buf.readUInt32BE(at + 4 + 4 + 8);
  const duration = buf.readUInt32BE(at + 4 + 4 + 12);
  return duration / timescale;
}

describe("the video files", () => {
  it("every video has its film, its still and its words, and nothing is left over", () => {
    const expected = HOWTO_VIDEOS.flatMap((v) => [`${v.id}.mp4`, `${v.id}.jpg`, `${v.id}.vtt`]).sort();
    expect(readdirSync(join(PUBLIC, "howto")).sort()).toEqual(expected);
  });

  it("the length shown is the film's real length (to the nearest second)", () => {
    for (const v of HOWTO_VIDEOS) {
      const real = mp4Seconds(join(PUBLIC, videoFile(v)));
      expect(Math.abs(real - v.seconds), v.id).toBeLessThan(1);
    }
  });

  it("stays small enough to keep the app quick: under 5 MB each", () => {
    for (const v of HOWTO_VIDEOS) {
      expect(readFileSync(join(PUBLIC, videoFile(v))).length, v.id).toBeLessThan(5 * 1024 * 1024);
    }
  });

  it("the words file is real captions with Wendy's lines in it", () => {
    for (const v of HOWTO_VIDEOS) {
      const vtt = readFileSync(join(PUBLIC, "howto", `${v.id}.vtt`), "utf8");
      expect(vtt.startsWith("WEBVTT"), v.id).toBe(true);
      expect(vtt, v.id).toMatch(/\d\d:\d\d:\d\d\.\d{3} --> \d\d:\d\d:\d\d\.\d{3}/);
    }
  });

  it("ids are unique", () => {
    expect(new Set(ids(HOWTO_VIDEOS)).size).toBe(HOWTO_VIDEOS.length);
  });
});

describe("which videos each screen offers", () => {
  it("the one for the screen you're on", () => {
    expect(ids(videosForPage("/appointments", owner))).toEqual(["howto-bookings"]);
    expect(ids(videosForPage("/pilot-brain", owner))).toEqual(["howto-wendy"]);
    expect(ids(videosForPage("/photo-studio/abc", owner))).toEqual(["howto-photos"]);
    expect(ids(videosForPage("/bookkeeping/entry/abc", owner))).toEqual(["howto-sale"]);
    expect(ids(videosForPage("/dealer/settings", owner))).toEqual(["howto-team"]);
  });

  it("a car's page offers the Car Passport video, but the stock list and its tools don't", () => {
    expect(ids(videosForPage("/dealer/inventory/a1000000-0000-4000-8000-000000000001", owner))).toEqual(["howto-passport"]);
    expect(videosForPage("/dealer/inventory", owner)).toEqual([]);
    expect(videosForPage("/dealer/inventory/mot-lookup/extra", owner)).toEqual([]);
  });

  it("screens with no video offer none", () => {
    expect(videosForPage("/dealer/sales/leads", owner)).toEqual([]);
    expect(videosForPage("/", owner)).toEqual([]);
  });

  it("never offers a video about a screen the person can't open", () => {
    const sales = as("staff", "sales");
    expect(ids(videosFor(sales))).not.toContain("howto-sale");
    expect(ids(videosFor(sales))).not.toContain("howto-team");
    expect(videosForPage("/bookkeeping", sales)).toEqual([]);
    expect(ids(videosFor(as("staff", "finance")))).toContain("howto-sale");
    expect(ids(videosFor(as("staff", "manager")))).toContain("howto-team");
    expect(ids(videosFor(owner))).toEqual(ids(HOWTO_VIDEOS));
  });
});

describe("the player", () => {
  const v = HOWTO_VIDEOS.find((x) => x.id === "howto-bookings")!;

  it("shows the still, the title and the length, and downloads nothing until Play", () => {
    const html = renderToStaticMarkup(<HowtoVideoPlayer video={v} />);
    expect(html).toContain('src="/howto/howto-bookings.jpg"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("Bookings");
    expect(html).toContain(v.about);
    expect(html).toContain("59 sec");
    expect(html).toContain(">Play<");
    expect(html).toContain('aria-label="Play the video: Bookings (59 sec)"');
    expect(html).not.toContain("<video");
    expect(html).not.toContain(".mp4");
  });

  it("in the help panel, keeps it short", () => {
    const html = renderToStaticMarkup(<HowtoVideoPlayer video={v} compact />);
    expect(html).not.toContain(v.about);
  });

  it("lengths read naturally", () => {
    expect(lengthLabel(41)).toBe("41 sec");
    expect(lengthLabel(60)).toBe("1 min");
    expect(lengthLabel(64)).toBe("1 min 4 sec");
  });
});

describe("where to find them", () => {
  const source = (f: string) => readFileSync(join(SRC, f), "utf8");

  it("Help with this page offers this screen's videos and the full set", () => {
    const help = source("tour/PageHelp.tsx");
    expect(help).toContain("videosForPage(pathname, user)");
    expect(help).toContain("<HowtoVideoPlayer key={v.id} video={v} compact />");
    expect(help).toContain('navigate("/how-to-videos")');
  });

  it("the How-to videos page is a real route with a title, and Settings links to it", () => {
    expect(source("router/AnimatedRoutes.tsx")).toContain('<Route path="how-to-videos" element={<HowtoVideosScreen />} />');
    expect(source("lib/pageTitles.ts")).toContain('"/how-to-videos": "How-to videos"');
    expect(source("dealer/settings/Settings.tsx")).toContain('<SupernovaGlowButton label="How-to Videos" onClick={() => navigate("/how-to-videos")} />');
  });

  it("the stills exist for every video (a broken image would show on the page)", () => {
    for (const v of HOWTO_VIDEOS) expect(existsSync(join(PUBLIC, "howto", `${v.id}.jpg`)), v.id).toBe(true);
  });
});
