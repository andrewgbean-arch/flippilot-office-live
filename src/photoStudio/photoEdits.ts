// Photo Studio's editing engine. Everything runs in the browser on a canvas:
// no picture leaves the dealer's device until they choose to save it, and
// nothing here costs anything to run.
//
// The maths (crop box, straighten zoom, brightness/contrast, the quality
// checks) is kept in plain functions so it can be tested without a browser.

export type AspectPreset = "original" | "4:3" | "16:9" | "1:1";

export type BannerKind = "none" | "just-arrived" | "reduced" | "low-miles" | "reserved" | "sold" | "price-strip";

export type PlateMode = "blur" | "name";

/** A rectangle in fractions of the finished picture (0..1), so it survives any output size. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PhotoEdits {
  rotate: 0 | 90 | 180 | 270; // quarter turns, clockwise
  straighten: number; // degrees, -8..8
  aspect: AspectPreset;
  zoom: number; // 1..2.5
  panX: number; // -1..1, where the crop sits within the space it can move in
  panY: number;
  brightness: number; // -60..60
  contrast: number; // -60..60
  banner: BannerKind;
  nameBadge: boolean;
  plate: NormRect | null;
  plateMode: PlateMode;
}

export const NO_EDITS: PhotoEdits = {
  rotate: 0,
  straighten: 0,
  aspect: "original",
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 0,
  contrast: 0,
  banner: "none",
  nameBadge: false,
  plate: null,
  plateMode: "name",
};

export function hasEdits(e: PhotoEdits): boolean {
  return JSON.stringify(e) !== JSON.stringify(NO_EDITS);
}

/** What goes on a banner, where the details come from the car's own record. */
export interface BannerFacts {
  price: number | null;
  year: number | null;
  mileage: number | null;
  dealerName: string;
}

export const BANNERS: { kind: BannerKind; label: string }[] = [
  { kind: "none", label: "No banner" },
  { kind: "just-arrived", label: "Just Arrived" },
  { kind: "reduced", label: "Reduced" },
  { kind: "low-miles", label: "Low Miles" },
  { kind: "reserved", label: "Reserved" },
  { kind: "sold", label: "Sold" },
  { kind: "price-strip", label: "Price strip" },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Size of the picture after quarter turns. */
export function turnedSize(w: number, h: number, rotate: PhotoEdits["rotate"]): { w: number; h: number } {
  return rotate === 90 || rotate === 270 ? { w: h, h: w } : { w, h };
}

/**
 * How much to enlarge a picture turned by `deg` degrees so its corners never
 * show inside the original frame (the usual "straighten" zoom).
 */
export function straightenScale(w: number, h: number, deg: number): number {
  const a = (Math.abs(deg) * Math.PI) / 180;
  if (a === 0) return 1;
  const ratio = Math.max(w, h) / Math.min(w, h);
  return Math.cos(a) + ratio * Math.sin(a);
}

/**
 * The crop box, in pixels of the turned picture: the largest box of the
 * chosen shape, shrunk by the zoom and moved by the pan.
 */
export function cropBox(w: number, h: number, e: Pick<PhotoEdits, "aspect" | "zoom" | "panX" | "panY">): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const target =
    e.aspect === "4:3" ? 4 / 3 : e.aspect === "16:9" ? 16 / 9 : e.aspect === "1:1" ? 1 : w / h;
  let cw = w;
  let ch = w / target;
  if (ch > h) {
    ch = h;
    cw = h * target;
  }
  const z = clamp(e.zoom, 1, 2.5);
  cw /= z;
  ch /= z;
  const x = ((w - cw) / 2) * (1 + clamp(e.panX, -1, 1));
  const y = ((h - ch) / 2) * (1 + clamp(e.panY, -1, 1));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(cw), h: Math.round(ch) };
}

/** Brightness and contrast on raw RGBA pixels, in place. Both run -60..60. */
export function adjustPixels(data: Uint8ClampedArray, brightness: number, contrast: number): void {
  if (brightness === 0 && contrast === 0) return;
  const b = clamp(brightness, -60, 60) * 2.2; // up to about +/-130 levels
  const c = clamp(contrast, -60, 60) * 2.2;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = f * (data[i]! + b - 128) + 128;
    data[i + 1] = f * (data[i + 1]! + b - 128) + 128;
    data[i + 2] = f * (data[i + 2]! + b - 128) + 128;
  }
}

// ---------------- quality checks ----------------

export interface PhotoQuality {
  width: number;
  height: number;
  brightness: number; // average 0..255
  sharpness: number; // variance of the Laplacian on a small grey copy
  issues: string[];
}

/** Grey values (0..255) from RGBA pixels. */
export function toGrey(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  }
  return out;
}

export function meanOf(values: Float32Array): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i]!;
  return values.length ? s / values.length : 0;
}

/** Variance of the 4-neighbour Laplacian: low means few sharp edges (a blurred picture). */
export function laplacianVariance(grey: Float32Array, w: number, h: number): number {
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = grey[i - w]! + grey[i + w]! + grey[i - 1]! + grey[i + 1]! - 4 * grey[i]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export const QUALITY_LIMITS = { dark: 70, bright: 205, blurry: 60, minWidth: 1000 };

/** Plain-English problems from the measured figures. Measured on a copy about 320px wide. */
export function qualityIssues(q: Omit<PhotoQuality, "issues">): string[] {
  const issues: string[] = [];
  if (q.brightness < QUALITY_LIMITS.dark) issues.push("Too dark");
  if (q.brightness > QUALITY_LIMITS.bright) issues.push("Too bright");
  if (q.sharpness < QUALITY_LIMITS.blurry) issues.push("Looks blurry");
  if (Math.max(q.width, q.height) < QUALITY_LIMITS.minWidth) issues.push("Small picture");
  return issues;
}

// ---------------- drawing ----------------

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Hosted photos come from the API's address; asking for them with CORS
    // is what lets the canvas be read back (the server allows any origin).
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load that photo"));
    img.src = src;
  });
}

export function measureQuality(img: HTMLImageElement): PhotoQuality {
  const w = 320;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const grey = toGrey(ctx.getImageData(0, 0, w, h).data);
  const base = {
    width: img.naturalWidth,
    height: img.naturalHeight,
    brightness: Math.round(meanOf(grey)),
    sharpness: Math.round(laplacianVariance(grey, w, h)),
  };
  return { ...base, issues: qualityIssues(base) };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = '"Archivo", "Segoe UI", system-ui, sans-serif';

// Each drawing step saves and restores the canvas settings, so one step's
// text alignment or fill can't leak into the next (the plate cover's centred
// text once pushed the price strip's price off the left edge).
function drawBanner(ctx: CanvasRenderingContext2D, W: number, H: number, kind: BannerKind, facts: BannerFacts) {
  if (kind === "none") return;
  ctx.save();
  try {
    drawBannerInner(ctx, W, H, kind, facts);
  } finally {
    ctx.restore();
  }
}

function drawBannerInner(ctx: CanvasRenderingContext2D, W: number, H: number, kind: BannerKind, facts: BannerFacts) {
  const u = Math.min(W, H) / 100; // one "unit" = 1% of the short side
  if (kind === "price-strip") {
    const bh = u * 13;
    const grad = ctx.createLinearGradient(0, H - bh, 0, H);
    grad.addColorStop(0, "rgba(10,17,40,0.82)");
    grad.addColorStop(1, "rgba(10,17,40,0.96)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - bh, W, bh);
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(0, H - bh, W, u * 0.6);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFD700";
    ctx.font = `800 ${u * 6.4}px ${FONT}`;
    const price = facts.price ? `£${facts.price.toLocaleString("en-GB")}` : "Ask for price";
    ctx.fillText(price, u * 3.5, H - bh / 2);
    const bits = [facts.year ? String(facts.year) : null, facts.mileage ? `${facts.mileage.toLocaleString("en-GB")} miles` : null].filter(Boolean);
    if (bits.length) {
      const pw = ctx.measureText(price).width;
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${u * 4}px ${FONT}`;
      ctx.fillText(bits.join("  ·  "), u * 3.5 + pw + u * 4, H - bh / 2);
    }
    return;
  }
  if (kind === "sold") {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 12);
    const bw = Math.hypot(W, H);
    const bh = u * 16;
    ctx.fillStyle = "rgba(200,20,30,0.9)";
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-bw / 2, -bh / 2 + u, bw, u * 0.5);
    ctx.fillRect(-bw / 2, bh / 2 - u * 1.5, bw, u * 0.5);
    ctx.font = `900 ${u * 11}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SOLD", 0, u * 0.6);
    ctx.restore();
    return;
  }
  // corner ribbon, top left
  const look: Record<string, { text: string; bg: string; fg: string }> = {
    "just-arrived": { text: "JUST ARRIVED", bg: "#FFD700", fg: "#0A1128" },
    reduced: { text: "REDUCED", bg: "#E53935", fg: "#ffffff" },
    "low-miles": { text: "LOW MILES", bg: "#2E7D32", fg: "#ffffff" },
    reserved: { text: "RESERVED", bg: "#F57C00", fg: "#ffffff" },
  };
  const l = look[kind]!;
  ctx.save();
  const len = u * 42;
  ctx.translate(0, 0);
  ctx.rotate(-Math.PI / 4);
  const rh = u * 8.5;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-len, len * 0.42 + u * 0.8, len * 2, rh);
  ctx.fillStyle = l.bg;
  ctx.fillRect(-len, len * 0.42, len * 2, rh);
  ctx.fillStyle = l.fg;
  ctx.font = `900 ${u * 4.2}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(l.text, 0, len * 0.42 + rh / 2 + u * 0.2);
  ctx.restore();
}

function drawNameBadge(ctx: CanvasRenderingContext2D, W: number, H: number, name: string, lifted: boolean) {
  if (!name.trim()) return;
  ctx.save();
  const u = Math.min(W, H) / 100;
  ctx.font = `800 ${u * 3.6}px ${FONT}`;
  const tw = ctx.measureText(name).width;
  const bw = tw + u * 6;
  const bh = u * 7;
  const x = W - bw - u * 3;
  const y = H - bh - u * 3 - (lifted ? u * 13 : 0);
  roundRect(ctx, x, y, bw, bh, bh / 2);
  ctx.fillStyle = "rgba(10,17,40,0.82)";
  ctx.fill();
  ctx.lineWidth = u * 0.4;
  ctx.strokeStyle = "#FFD700";
  ctx.stroke();
  ctx.fillStyle = "#FFD700";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(name, x + u * 3, y + bh / 2 + u * 0.1);
  ctx.restore();
}

function drawPlateCover(ctx: CanvasRenderingContext2D, W: number, H: number, r: NormRect, mode: PlateMode, name: string) {
  ctx.save();
  try {
    drawPlateCoverInner(ctx, W, H, r, mode, name);
  } finally {
    ctx.restore();
  }
}

function drawPlateCoverInner(ctx: CanvasRenderingContext2D, W: number, H: number, r: NormRect, mode: PlateMode, name: string) {
  const x = r.x * W;
  const y = r.y * H;
  const w = Math.max(4, r.w * W);
  const h = Math.max(4, r.h * H);
  if (mode === "blur") {
    // pixelate: shrink the area hard, then stretch it back without smoothing
    const small = document.createElement("canvas");
    small.width = Math.max(2, Math.round(w / 14));
    small.height = Math.max(2, Math.round(h / 14));
    const s = small.getContext("2d")!;
    s.drawImage(ctx.canvas, x, y, w, h, 0, 0, small.width, small.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
    ctx.restore();
    return;
  }
  // a plate-shaped panel carrying the dealer's name
  const r2 = Math.min(w, h) * 0.12;
  roundRect(ctx, x, y, w, h, r2);
  ctx.fillStyle = "#0A1128";
  ctx.fill();
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.strokeStyle = "#FFD700";
  ctx.stroke();
  const label = name.trim() || "FOR SALE";
  let size = h * 0.55;
  ctx.font = `900 ${size}px ${FONT}`;
  while (ctx.measureText(label).width > w * 0.9 && size > 6) {
    size -= 1;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h / 2 + size * 0.04);
}

/**
 * Draws the photo with every edit applied. `maxSide` caps the longest edge
 * (the saved copy uses 2048; the preview uses less for speed).
 */
export function renderEdited(img: HTMLImageElement, e: PhotoEdits, facts: BannerFacts, maxSide: number): HTMLCanvasElement {
  const t = turnedSize(img.naturalWidth, img.naturalHeight, e.rotate);

  // 1. turn and straighten onto a canvas the size of the turned picture
  const turned = document.createElement("canvas");
  turned.width = t.w;
  turned.height = t.h;
  const tc = turned.getContext("2d")!;
  tc.fillStyle = "#000";
  tc.fillRect(0, 0, t.w, t.h);
  tc.save();
  tc.translate(t.w / 2, t.h / 2);
  tc.rotate(((e.rotate + e.straighten) * Math.PI) / 180);
  const s = straightenScale(t.w, t.h, e.straighten);
  tc.scale(s, s);
  tc.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  tc.restore();

  // 2. crop, scaled down to the output size
  const box = cropBox(t.w, t.h, e);
  const scale = Math.min(1, maxSide / Math.max(box.w, box.h));
  const W = Math.max(1, Math.round(box.w * scale));
  const H = Math.max(1, Math.round(box.h * scale));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(turned, box.x, box.y, box.w, box.h, 0, 0, W, H);

  // 3. light
  if (e.brightness !== 0 || e.contrast !== 0) {
    const d = ctx.getImageData(0, 0, W, H);
    adjustPixels(d.data, e.brightness, e.contrast);
    ctx.putImageData(d, 0, 0);
  }

  // 4. plate cover, then banner and name on top
  if (e.plate) drawPlateCover(ctx, W, H, e.plate, e.plateMode, facts.dealerName);
  drawBanner(ctx, W, H, e.banner, facts);
  if (e.nameBadge) drawNameBadge(ctx, W, H, facts.dealerName, e.banner === "price-strip");
  return out;
}

/** A JPEG data URL under the server's 1.5 MB limit (steps the quality down if needed). */
export function toUploadDataUrl(canvas: HTMLCanvasElement, limitBytes = 1_400_000): string {
  for (const q of [0.9, 0.82, 0.74, 0.66, 0.58]) {
    const url = canvas.toDataURL("image/jpeg", q);
    const bytes = Math.ceil(((url.length - url.indexOf(",") - 1) * 3) / 4);
    if (bytes <= limitBytes) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.5);
}

// ---------------- social media posts ----------------

export type PostFormat = "square" | "story";

export interface PostFacts {
  title: string; // e.g. "2018 Ford Focus 1.0 EcoBoost ST-Line"
  price: number | null;
  details: string; // e.g. "48,250 miles · Petrol"
  dealerName: string;
  phone: string | null;
}

/** A ready-to-post picture: the car photo, the price and the dealer's name, in the FlipPilot gold style. */
export function renderSocialPost(photo: HTMLCanvasElement | HTMLImageElement, f: PostFacts, format: PostFormat): HTMLCanvasElement {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0A1128";
  ctx.fillRect(0, 0, W, H);

  // photo, covering the top area
  const pw = "naturalWidth" in photo ? photo.naturalWidth : photo.width;
  const ph = "naturalHeight" in photo ? photo.naturalHeight : photo.height;
  // Fixed positions, worked out so nothing overlaps: square 1080x1080,
  // story 1080x1920.
  const L =
    format === "story"
      ? { top: 230, areaH: 1000, title: 1330, price: 1480, priceSize: 150, details: 1560 }
      : { top: 0, areaH: 680, title: 760, price: 872, priceSize: 104, details: 930 };
  const areaH = L.areaH;
  const top = L.top;
  const sc = Math.max(W / pw, areaH / ph);
  const dw = pw * sc;
  const dh = ph * sc;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, W, areaH);
  ctx.clip();
  ctx.drawImage(photo, (W - dw) / 2, top + (areaH - dh) / 2, dw, dh);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, top + areaH - 220, 0, top + areaH);
  fade.addColorStop(0, "rgba(10,17,40,0)");
  fade.addColorStop(1, "rgba(10,17,40,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, top + areaH - 220, W, 220);

  // gold frame
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 10;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (format === "story") {
    ctx.fillStyle = "#FFD700";
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText((f.dealerName || "").toUpperCase(), W / 2, 150);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText("JUST IN", W / 2, 205);
  }

  let size = 58;
  ctx.font = `800 ${size}px ${FONT}`;
  while (ctx.measureText(f.title).width > W - 120 && size > 30) {
    size -= 2;
    ctx.font = `800 ${size}px ${FONT}`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(f.title, W / 2, L.title);

  ctx.fillStyle = "#FFD700";
  ctx.font = `900 ${L.priceSize}px ${FONT}`;
  ctx.fillText(f.price ? `£${f.price.toLocaleString("en-GB")}` : "Ask for price", W / 2, L.price);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 38px ${FONT}`;
  if (f.details) ctx.fillText(f.details, W / 2, L.details);

  if (format === "square") {
    ctx.fillStyle = "#FFD700";
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText([f.dealerName, f.phone].filter(Boolean).join("  ·  "), W / 2, H - 60);
  } else {
    const bw = 620;
    const bh = 110;
    const bx = (W - bw) / 2;
    const by = 1640;
    roundRect(ctx, bx, by, bw, bh, 55);
    ctx.fillStyle = "#FFD700";
    ctx.fill();
    ctx.fillStyle = "#0A1128";
    ctx.font = `900 46px ${FONT}`;
    ctx.fillText("BOOK A VIEWING", W / 2, by + 72);
    if (f.phone) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText(f.phone, W / 2, 1830);
    }
  }
  return c;
}

// ---------------- shot list ----------------

/** The pictures buyers look for, in the order worth taking them. A guide only. */
export const SHOT_LIST = [
  "Front three-quarter",
  "Rear three-quarter",
  "Driver's side",
  "Front seats and dashboard",
  "Dashboard with the mileage showing",
  "Rear seats",
  "Boot",
  "Wheels and tyres",
] as const;
