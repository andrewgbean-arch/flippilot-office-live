import { useEffect, useRef, useState } from "react";

type CropAspect = "original" | "square" | "4:3" | "16:9";
type BannerPreset = "none" | "REDUCED" | "JUST IN" | "SOLD" | "RESERVED" | "custom";

const CROP_RATIOS: Record<Exclude<CropAspect, "original">, number> = {
  square: 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
};

const BANNER_COLORS: { label: string; value: string }[] = [
  { label: "Red", value: "#DC2626" },
  { label: "Green", value: "#16A34A" },
  { label: "Gold", value: "#D4AF37" },
  { label: "Blue", value: "#2563EB" },
];

interface PhotoEditorModalProps {
  imageSrc: string;
  onSave: (editedDataUri: string) => void;
  onClose: () => void;
}

// A real, client-side photo editor — rotate, crop to a listing-friendly
// aspect ratio, and stamp a banner ("REDUCED", "SOLD", etc) onto a
// vehicle photo. No AI/API dependency: this is plain canvas drawing,
// same technique as imageCompress.ts, so it works with zero external
// credentials. Real AI enhancement (background removal, auto-touch-up)
// isn't built here — that needs a real image-AI provider this app
// doesn't have a key for yet, and the honest choice was to ship the
// real tools now rather than fake that part.
export default function PhotoEditorModal({ imageSrc, onSave, onClose }: PhotoEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [cropAspect, setCropAspect] = useState<CropAspect>("original");
  const [bannerPreset, setBannerPreset] = useState<BannerPreset>("none");
  const [customBannerText, setCustomBannerText] = useState("");
  const [bannerColor, setBannerColor] = useState(BANNER_COLORS[0]!.value);
  const [bannerPosition, setBannerPosition] = useState<"top" | "bottom">("top");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const bannerText = bannerPreset === "custom" ? customBannerText : bannerPreset === "none" ? "" : bannerPreset;

  useEffect(() => {
    if (!ready || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rotated source dimensions
    const swapped = rotation === 90 || rotation === 270;
    const srcW = swapped ? img.height : img.width;
    const srcH = swapped ? img.width : img.height;

    // Crop rectangle (center-cropped to the target aspect), applied
    // in ROTATED space so what you see previewed is what gets cropped.
    let cropW = srcW;
    let cropH = srcH;
    if (cropAspect !== "original") {
      const targetRatio = CROP_RATIOS[cropAspect];
      const currentRatio = srcW / srcH;
      if (currentRatio > targetRatio) {
        cropH = srcH;
        cropW = srcH * targetRatio;
      } else {
        cropW = srcW;
        cropH = srcW / targetRatio;
      }
    }

    canvas.width = cropW;
    canvas.height = cropH;

    ctx.save();
    // Move to canvas center, rotate, then draw the image centered —
    // this naturally handles both the rotation and the center-crop
    // offset in one transform instead of two separate passes.
    ctx.translate(cropW / 2, cropH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    if (bannerText.trim()) {
      const bandHeight = Math.max(28, cropH * 0.09);
      const y = bannerPosition === "top" ? 0 : cropH - bandHeight;
      ctx.fillStyle = bannerColor;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(0, y, cropW, bandHeight);
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${Math.max(16, bandHeight * 0.55)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bannerText.trim().toUpperCase(), cropW / 2, y + bandHeight / 2);
    }
  }, [ready, rotation, cropAspect, bannerText, bannerColor, bannerPosition]);

  function handleSave() {
    if (!canvasRef.current) return;
    onSave(canvasRef.current.toDataURL("image/jpeg", 0.9));
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 border border-white/10 p-6 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Edit Photo</h2>

        <div className="flex justify-center mb-6 bg-black/40 rounded-lg p-4">
          {ready ? (
            <canvas ref={canvasRef} className="max-w-full max-h-[50vh] rounded" />
          ) : (
            <p className="text-white/50 py-20">Loading image…</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="text-white/60 text-sm block mb-1">Rotate</label>
            <div className="flex gap-2">
              <button
                onClick={() => setRotation(r => (r + 270) % 360)}
                className="flex-1 py-2 rounded bg-white/10 text-white/80 hover:bg-white/20"
              >
                ↺ Left
              </button>
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="flex-1 py-2 rounded bg-white/10 text-white/80 hover:bg-white/20"
              >
                ↻ Right
              </button>
            </div>
          </div>

          <div>
            <label className="text-white/60 text-sm block mb-1">Crop</label>
            <select
              value={cropAspect}
              onChange={e => setCropAspect(e.target.value as CropAspect)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            >
              <option value="original">Original</option>
              <option value="square">Square (1:1)</option>
              <option value="4:3">Standard (4:3)</option>
              <option value="16:9">Wide (16:9)</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-white/60 text-sm block mb-1">Banner</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <select
              value={bannerPreset}
              onChange={e => setBannerPreset(e.target.value as BannerPreset)}
              className="p-2 rounded bg-black/40 border border-white/10 text-white/80 col-span-2 sm:col-span-1"
            >
              <option value="none">No banner</option>
              <option value="REDUCED">Reduced</option>
              <option value="JUST IN">Just In</option>
              <option value="SOLD">Sold</option>
              <option value="RESERVED">Reserved</option>
              <option value="custom">Custom text…</option>
            </select>

            {bannerPreset === "custom" && (
              <input
                type="text"
                value={customBannerText}
                onChange={e => setCustomBannerText(e.target.value)}
                placeholder="Banner text"
                className="p-2 rounded bg-black/40 border border-white/10 text-white/80 col-span-2 sm:col-span-1"
              />
            )}

            <select
              value={bannerColor}
              onChange={e => setBannerColor(e.target.value)}
              className="p-2 rounded bg-black/40 border border-white/10 text-white/80"
            >
              {BANNER_COLORS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <select
              value={bannerPosition}
              onChange={e => setBannerPosition(e.target.value as "top" | "bottom")}
              className="p-2 rounded bg-black/40 border border-white/10 text-white/80"
            >
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>
        </div>

        <p className="text-white/40 text-xs mb-4">
          AI enhancement (background removal, auto-touch-up) isn't available yet — needs an image-AI provider not yet configured for this app.
        </p>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!ready}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-300"
          >
            Save Photo
          </button>
        </div>
      </div>
    </div>
  );
}
