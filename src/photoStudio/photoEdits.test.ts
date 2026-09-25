import { describe, it, expect } from "vitest";
import {
  NO_EDITS,
  adjustPixels,
  cropBox,
  hasEdits,
  laplacianVariance,
  meanOf,
  qualityIssues,
  straightenScale,
  toGrey,
  turnedSize,
  SHOT_LIST,
  BANNERS,
} from "./photoEdits";

describe("turning and straightening", () => {
  it("swaps width and height for a quarter turn only", () => {
    expect(turnedSize(1600, 1200, 0)).toEqual({ w: 1600, h: 1200 });
    expect(turnedSize(1600, 1200, 90)).toEqual({ w: 1200, h: 1600 });
    expect(turnedSize(1600, 1200, 180)).toEqual({ w: 1600, h: 1200 });
    expect(turnedSize(1600, 1200, 270)).toEqual({ w: 1200, h: 1600 });
  });

  it("does not zoom when level, and zooms enough to hide the corners when tilted", () => {
    expect(straightenScale(1600, 1200, 0)).toBe(1);
    const s = straightenScale(1600, 1200, 5);
    expect(s).toBeGreaterThan(1);
    // a picture turned 5° and enlarged by s still covers its own frame: the
    // frame's corner, turned back, must land inside the enlarged picture
    const a = (5 * Math.PI) / 180;
    const cx = 800;
    const cy = 600;
    const x = cx * Math.cos(a) + cy * Math.sin(a);
    const y = -cx * Math.sin(a) + cy * Math.cos(a);
    expect(Math.abs(x)).toBeLessThanOrEqual(800 * s + 1e-6);
    expect(Math.abs(y)).toBeLessThanOrEqual(600 * s + 1e-6);
  });
});

describe("the crop box", () => {
  it("is the whole picture with no crop", () => {
    expect(cropBox(1600, 1200, NO_EDITS)).toEqual({ x: 0, y: 0, w: 1600, h: 1200 });
  });

  it("is the largest square, centred, for Square", () => {
    expect(cropBox(1600, 1200, { ...NO_EDITS, aspect: "1:1" })).toEqual({ x: 200, y: 0, w: 1200, h: 1200 });
  });

  it("fits 16:9 inside a 4:3 picture by trimming the top and bottom", () => {
    const b = cropBox(1600, 1200, { ...NO_EDITS, aspect: "16:9" });
    expect(b.w).toBe(1600);
    expect(b.h).toBe(900);
    expect(b.y).toBe(150);
  });

  it("shrinks with zoom and moves with pan, never leaving the picture", () => {
    const z = cropBox(1600, 1200, { ...NO_EDITS, zoom: 2 });
    expect(z).toEqual({ x: 400, y: 300, w: 800, h: 600 });
    const left = cropBox(1600, 1200, { ...NO_EDITS, zoom: 2, panX: -1, panY: -1 });
    expect(left).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    const right = cropBox(1600, 1200, { ...NO_EDITS, zoom: 2, panX: 1, panY: 1 });
    expect(right.x + right.w).toBe(1600);
    expect(right.y + right.h).toBe(1200);
    // out-of-range values are held at the edges
    expect(cropBox(1600, 1200, { ...NO_EDITS, zoom: 9, panX: 5 }).x + cropBox(1600, 1200, { ...NO_EDITS, zoom: 9, panX: 5 }).w).toBe(1600);
  });
});

describe("light", () => {
  it("leaves pixels alone at zero", () => {
    const d = new Uint8ClampedArray([10, 100, 200, 255]);
    adjustPixels(d, 0, 0);
    expect([...d]).toEqual([10, 100, 200, 255]);
  });

  it("brightens and darkens, and never touches transparency", () => {
    const up = new Uint8ClampedArray([100, 100, 100, 77]);
    adjustPixels(up, 30, 0);
    expect(up[0]).toBeGreaterThan(100);
    expect(up[3]).toBe(77);
    const down = new Uint8ClampedArray([100, 100, 100, 255]);
    adjustPixels(down, -30, 0);
    expect(down[0]).toBeLessThan(100);
  });

  it("contrast pushes values away from the middle", () => {
    const d = new Uint8ClampedArray([60, 128, 200, 255]);
    adjustPixels(d, 0, 40);
    expect(d[0]).toBeLessThan(60);
    expect(d[1]).toBe(128);
    expect(d[2]).toBeGreaterThan(200);
  });
});

describe("quality checks", () => {
  function rgba(grey: number[]): Uint8ClampedArray {
    const d = new Uint8ClampedArray(grey.length * 4);
    grey.forEach((g, i) => d.set([g, g, g, 255], i * 4));
    return d;
  }

  it("measures brightness as the average grey", () => {
    expect(meanOf(toGrey(rgba([0, 100, 200])))).toBeCloseTo(100, 5);
  });

  it("finds a flat picture blurry and a checkerboard sharp", () => {
    const w = 12;
    const h = 12;
    const flat = toGrey(rgba(new Array(w * h).fill(120)));
    const checks = toGrey(rgba(Array.from({ length: w * h }, (_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0)));
    expect(laplacianVariance(flat, w, h)).toBe(0);
    expect(laplacianVariance(checks, w, h)).toBeGreaterThan(1000);
  });

  it("puts problems in plain English", () => {
    expect(qualityIssues({ width: 1600, height: 1200, brightness: 40, sharpness: 500 })).toEqual(["Too dark"]);
    expect(qualityIssues({ width: 1600, height: 1200, brightness: 230, sharpness: 500 })).toEqual(["Too bright"]);
    expect(qualityIssues({ width: 640, height: 480, brightness: 120, sharpness: 20 })).toEqual(["Looks blurry", "Small picture"]);
    expect(qualityIssues({ width: 1600, height: 1200, brightness: 120, sharpness: 500 })).toEqual([]);
  });
});

describe("the choices on screen", () => {
  it("knows when anything has been changed", () => {
    expect(hasEdits(NO_EDITS)).toBe(false);
    expect(hasEdits({ ...NO_EDITS, banner: "sold" })).toBe(true);
  });

  it("offers the banners dealers use and an eight-shot list", () => {
    expect(BANNERS.map((b) => b.label)).toEqual(["No banner", "Just Arrived", "Reduced", "Low Miles", "Reserved", "Sold", "Price strip"]);
    expect(SHOT_LIST).toHaveLength(8);
  });
});
