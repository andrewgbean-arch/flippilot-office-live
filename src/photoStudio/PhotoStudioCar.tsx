import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiRotateCw,
  FiStar,
  FiArrowLeft,
  FiArrowRight,
  FiDownload,
  FiSave,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheck,
  FiImage,
} from "react-icons/fi";
import { useInventory } from "@/context/InventoryProvider";
import { useDealer } from "@/context/DealerContext";
import { deleteVehiclePhoto, hostedPhotoId, uploadVehiclePhoto } from "@/lib/vehiclePhotosApi";
import {
  BANNERS,
  NO_EDITS,
  SHOT_LIST,
  hasEdits,
  loadImage,
  measureQuality,
  renderEdited,
  renderSocialPost,
  toUploadDataUrl,
  type AspectPreset,
  type BannerFacts,
  type NormRect,
  type PhotoEdits,
  type PhotoQuality,
  type PostFormat,
} from "./photoEdits";

type Tab = "adjust" | "crop" | "banner" | "name" | "plate";

const TABS: { id: Tab; label: string }[] = [
  { id: "adjust", label: "Light & turn" },
  { id: "crop", label: "Crop" },
  { id: "banner", label: "Banner" },
  { id: "name", label: "Your name" },
  { id: "plate", label: "Number plate" },
];

const ASPECTS: { id: AspectPreset; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "4:3", label: "4:3 (listings)" },
  { id: "16:9", label: "16:9 (wide)" },
  { id: "1:1", label: "Square" },
];

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

function download(canvas: HTMLCanvasElement, name: string, type: "image/jpeg" | "image/png" = "image/jpeg") {
  const a = document.createElement("a");
  a.href = canvas.toDataURL(type, 0.92);
  a.download = name;
  a.click();
}

export default function PhotoStudioCar() {
  const { vehicleId = "" } = useParams();
  const { vehicles, updateVehicle, refreshInventory } = useInventory();
  const { dealer } = useDealer();
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const images = useMemo(() => (vehicle?.images ?? []).filter((u): u is string => typeof u === "string" && u.length > 0), [vehicle?.images]);

  const [selected, setSelected] = useState(0);
  const [edits, setEdits] = useState<PhotoEdits>(NO_EDITS);
  const [tab, setTab] = useState<Tab>("adjust");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quality, setQuality] = useState<Record<string, PhotoQuality | "error">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const facts: BannerFacts = {
    price: vehicle?.priceRetail && vehicle.priceRetail > 0 ? vehicle.priceRetail : null,
    year: vehicle?.year ?? null,
    mileage: vehicle?.mileage ?? null,
    dealerName: dealer?.name ?? "",
  };
  const current = images[selected] ?? null;

  // Keep the selection on a real photo when the list changes.
  useEffect(() => {
    if (selected > 0 && selected >= images.length) setSelected(Math.max(0, images.length - 1));
  }, [images.length, selected]);

  // Load the selected photo; start each photo with no edits.
  useEffect(() => {
    let live = true;
    setImg(null);
    setLoadError(null);
    setEdits(NO_EDITS);
    if (!current) return;
    loadImage(current)
      .then((i) => live && setImg(i))
      .catch(() => live && setLoadError("This photo couldn't be opened for editing."));
    return () => {
      live = false;
    };
  }, [current]);

  // Check every photo for darkness, blur and size, once each.
  useEffect(() => {
    let live = true;
    for (const url of images) {
      if (quality[url]) continue;
      loadImage(url)
        .then((i) => live && setQuality((q) => ({ ...q, [url]: measureQuality(i) })))
        .catch(() => live && setQuality((q) => ({ ...q, [url]: "error" })));
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  // Redraw the preview whenever the photo or an edit changes.
  useEffect(() => {
    const c = preview.current;
    if (!c || !img) return;
    const out = renderEdited(img, edits, facts, 1100);
    c.width = out.width;
    c.height = out.height;
    c.getContext("2d")!.drawImage(out, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, edits, facts.dealerName, facts.price, facts.year, facts.mileage]);

  if (!vehicle) {
    return (
      <div className="px-6 py-10 text-white">
        <h1 className="text-2xl font-bold text-yellow-300">Photo Studio</h1>
        <p className="mt-2 text-white/70">That vehicle isn't in your stock list.</p>
        <Link to="/photo-studio" className="mt-4 inline-block text-yellow-300 underline">Back to Photo Studio</Link>
      </div>
    );
  }

  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const set = <K extends keyof PhotoEdits>(k: K, v: PhotoEdits[K]) => setEdits((e) => ({ ...e, [k]: v }));

  function saveOrder(next: string[], message?: string) {
    updateVehicle(vehicle!.id, { images: next.length ? next : null });
    if (message) setNotice({ kind: "ok", text: message });
  }

  function makeMain(i: number) {
    if (i === 0) return;
    saveOrder(moveItem(images, i, 0), "Main photo changed. It's the one buyers see first.");
    setSelected(0);
  }

  function nudge(i: number, by: -1 | 1) {
    const to = i + by;
    if (to < 0 || to >= images.length) return;
    saveOrder(moveItem(images, i, to), "Order saved.");
    setSelected(to);
  }

  function renderFull(): HTMLCanvasElement | null {
    return img ? renderEdited(img, edits, facts, 2048) : null;
  }

  async function saveEdited(replace: boolean) {
    const canvas = renderFull();
    if (!canvas || !current) return;
    setBusy(replace ? "replace" : "save");
    setNotice(null);
    const up = await uploadVehiclePhoto(vehicle!.id, toUploadDataUrl(canvas));
    if (!up.ok) {
      setBusy(null);
      setNotice({ kind: "error", text: up.error });
      return;
    }
    const without = images.filter((u) => u !== up.url);
    let next: string[];
    if (replace) {
      // Remove the original from the server first, so a save of the list
      // can't bring it back, then put the new copy in its place.
      const oldId = hostedPhotoId(current);
      if (oldId) {
        const del = await deleteVehiclePhoto(vehicle!.id, oldId);
        if (!del.ok) {
          setBusy(null);
          setNotice({ kind: "error", text: `The edited copy was saved, but the original couldn't be removed: ${del.error}` });
          saveOrder([...without.slice(0, selected + 1), up.url, ...without.slice(selected + 1)]);
          refreshInventory();
          return;
        }
      }
      next = without.map((u) => (u === current ? up.url : u));
    } else {
      next = [...without.slice(0, selected + 1), up.url, ...without.slice(selected + 1)];
    }
    saveOrder(next, replace ? "Photo replaced with your edited version." : "Edited copy saved next to the original.");
    setSelected(replace ? selected : selected + 1);
    setBusy(null);
  }

  function makePost(format: PostFormat) {
    const base = renderFull() ?? (img ? renderEdited(img, NO_EDITS, facts, 2048) : null);
    if (!base) return;
    const fuel = vehicle!.mot?.fuelType ?? null;
    const post = renderSocialPost(
      base,
      {
        title: title || "Your next car",
        price: facts.price,
        details: [vehicle!.mileage ? `${vehicle!.mileage.toLocaleString("en-GB")} miles` : null, fuel].filter(Boolean).join("  ·  "),
        dealerName: facts.dealerName,
        phone: dealer?.phone?.trim() || null,
      },
      format
    );
    download(post, `${(vehicle!.reg || title || "car").replace(/\s+/g, "-")}-${format}.png`, "image/png");
    setNotice({ kind: "ok", text: `${format === "square" ? "Square" : "Story"} post downloaded, ready for Facebook or Instagram.` });
  }

  // --- drawing on the preview: pan the crop, or mark the number plate ---
  function pos(ev: React.PointerEvent<HTMLCanvasElement>) {
    const r = ev.currentTarget.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
  }
  function onDown(ev: React.PointerEvent<HTMLCanvasElement>) {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const p = pos(ev);
    if (tab === "plate") drawStart.current = p;
    else if (tab === "crop" && edits.zoom > 1) panStart.current = { ...p, panX: edits.panX, panY: edits.panY };
  }
  function onMove(ev: React.PointerEvent<HTMLCanvasElement>) {
    const p = pos(ev);
    if (drawStart.current) {
      const s = drawStart.current;
      const rect: NormRect = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
      set("plate", rect);
    } else if (panStart.current) {
      const s = panStart.current;
      const k = 2 / (1 - 1 / edits.zoom || 1);
      set("panX", Math.max(-1, Math.min(1, s.panX - (p.x - s.x) * k)));
      set("panY", Math.max(-1, Math.min(1, s.panY - (p.y - s.y) * k)));
    }
  }
  function onUp() {
    drawStart.current = null;
    panStart.current = null;
  }

  const q = current ? quality[current] : undefined;
  const flagged = images.filter((u) => {
    const r = quality[u];
    return r && r !== "error" && r.issues.length > 0;
  }).length;

  return (
    <div className="px-4 sm:px-6 py-8 text-white space-y-6">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <Link to="/photo-studio" className="text-sm text-yellow-300/80 hover:text-yellow-300">← Photo Studio</Link>
          <h1 className="text-3xl font-extrabold text-yellow-300">{title || "Vehicle"}</h1>
          <p className="text-white/60 text-sm">
            {vehicle.reg ? `${vehicle.reg} · ` : ""}
            {images.length} photo{images.length === 1 ? "" : "s"}
            {flagged > 0 ? ` · ${flagged} to check` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/dealer/inventory/${vehicle.id}`} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:border-yellow-300/60">
            Open the car
          </Link>
          <Link to={`/dealer/inventory/${vehicle.id}?tab=edit`} className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">
            Add photos
          </Link>
        </div>
      </div>

      {notice && (
        <p role="status" className={`rounded-lg px-4 py-2 text-sm ${notice.kind === "ok" ? "bg-green-500/15 text-green-200 border border-green-400/40" : "bg-red-500/15 text-red-200 border border-red-400/40"}`}>
          {notice.text}
        </p>
      )}

      {images.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center">
          <FiImage className="mx-auto text-4xl text-yellow-300/70" />
          <p className="mt-3 text-white/80">This car has no photos yet.</p>
          <p className="text-white/50 text-sm">Add them from the car's Edit tab here, or from the FlipPilot Dealer phone app on the forecourt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4 min-w-0">
            {/* PHOTO STRIP */}
            <section aria-label="Photos">
              <p className="brand-caps text-xs mb-2">YOUR PHOTOS · DRAG TO REORDER</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((url, i) => {
                  const r = quality[url];
                  const issues = r && r !== "error" ? r.issues : [];
                  return (
                    <div
                      key={url}
                      draggable
                      onDragStart={() => setDragFrom(i)}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={() => {
                        if (dragFrom !== null && dragFrom !== i) {
                          saveOrder(moveItem(images, dragFrom, i), "Order saved.");
                          setSelected(i);
                        }
                        setDragFrom(null);
                      }}
                      className={`relative shrink-0 w-36 rounded-xl overflow-hidden border-2 cursor-grab ${i === selected ? "border-yellow-400 shadow-[0_0_14px_rgba(255,215,0,0.45)]" : "border-white/10"}`}
                    >
                      <button type="button" onClick={() => setSelected(i)} className="block w-full" aria-label={`Edit photo ${i + 1}`}>
                        <img src={url} alt="" className="h-24 w-full object-cover" crossOrigin={url.startsWith("data:") ? undefined : "anonymous"} />
                      </button>
                      {i === 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-yellow-400 px-1.5 py-0.5 text-[10px] font-extrabold text-black">MAIN</span>
                      )}
                      {issues.length > 0 && (
                        <span title={issues.join(", ")} className="absolute right-1.5 top-1.5 rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {issues[0]}
                        </span>
                      )}
                      <div className="flex items-center justify-between bg-black/60 px-1.5 py-1">
                        <button type="button" onClick={() => nudge(i, -1)} disabled={i === 0} aria-label="Move left" className="p-1 disabled:opacity-30"><FiArrowLeft /></button>
                        <button type="button" onClick={() => makeMain(i)} disabled={i === 0} aria-label="Make main photo" title="Make this the main photo" className="p-1 text-yellow-300 disabled:opacity-30"><FiStar /></button>
                        <button type="button" onClick={() => nudge(i, 1)} disabled={i === images.length - 1} aria-label="Move right" className="p-1 disabled:opacity-30"><FiArrowRight /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* EDITOR */}
            <section aria-label="Editor" className="rounded-2xl border border-yellow-400/30 bg-black/30 p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={tab === t.id}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${tab === t.id ? "bg-yellow-400 text-black border-yellow-400" : "border-white/15 text-white/80 hover:text-yellow-300"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative rounded-xl bg-black/50 grid place-items-center min-h-[240px]">
                {loadError ? (
                  <p className="p-8 text-sm text-red-200">{loadError}</p>
                ) : !img ? (
                  <p className="p-8 text-sm text-white/60">Opening photo…</p>
                ) : (
                  <canvas
                    ref={preview}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    className={`max-w-full max-h-[60vh] h-auto rounded-lg ${tab === "plate" ? "cursor-crosshair" : tab === "crop" && edits.zoom > 1 ? "cursor-move" : ""}`}
                    style={{ touchAction: "none" }}
                  />
                )}
              </div>

              {q && q !== "error" && (
                <p className={`text-xs ${q.issues.length ? "text-orange-200" : "text-green-200"}`}>
                  {q.issues.length ? <FiAlertTriangle className="inline mr-1" /> : <FiCheck className="inline mr-1" />}
                  {q.issues.length ? `${q.issues.join(" · ")}. Light & turn can help with dark photos; a blurry one is best retaken.` : "This photo looks fine: bright, sharp and big enough."}
                  <span className="text-white/40"> ({q.width}×{q.height})</span>
                </p>
              )}

              {/* CONTROLS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {tab === "adjust" && (
                  <>
                    <Slider label="Brightness" value={edits.brightness} min={-60} max={60} onChange={(v) => set("brightness", v)} />
                    <Slider label="Contrast" value={edits.contrast} min={-60} max={60} onChange={(v) => set("contrast", v)} />
                    <Slider label="Straighten" value={edits.straighten} min={-8} max={8} step={0.5} suffix="°" onChange={(v) => set("straighten", v)} />
                    <div className="flex items-end">
                      <button type="button" onClick={() => set("rotate", (((edits.rotate + 90) % 360) as PhotoEdits["rotate"]))} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 hover:border-yellow-300/60">
                        <FiRotateCw /> Turn a quarter
                      </button>
                    </div>
                  </>
                )}
                {tab === "crop" && (
                  <>
                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      {ASPECTS.map((a) => (
                        <button key={a.id} type="button" onClick={() => set("aspect", a.id)} aria-pressed={edits.aspect === a.id} className={`rounded-lg px-3 py-1.5 border ${edits.aspect === a.id ? "border-yellow-400 text-yellow-300" : "border-white/15 text-white/80"}`}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                    <Slider label="Zoom in" value={edits.zoom} min={1} max={2.5} step={0.05} suffix="×" onChange={(v) => set("zoom", v)} />
                    <p className="text-white/50 self-end">Zoomed in? Drag the photo to move the crop.</p>
                  </>
                )}
                {tab === "banner" && (
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    {BANNERS.map((b) => (
                      <button key={b.kind} type="button" onClick={() => set("banner", b.kind)} aria-pressed={edits.banner === b.kind} className={`rounded-lg px-3 py-1.5 border ${edits.banner === b.kind ? "border-yellow-400 text-yellow-300" : "border-white/15 text-white/80"}`}>
                        {b.label}
                      </button>
                    ))}
                    {edits.banner === "price-strip" && !facts.price && (
                      <p className="w-full text-orange-200 text-xs">This car has no asking price yet, so the strip says "Ask for price".</p>
                    )}
                  </div>
                )}
                {tab === "name" && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={edits.nameBadge} onChange={(ev) => set("nameBadge", ev.target.checked)} />
                      Put <strong className="text-yellow-300">{facts.dealerName || "your dealership's name"}</strong> in the corner
                    </label>
                    {!facts.dealerName && <p className="text-orange-200 text-xs">Add your dealership's name in Settings → Dealer Profile first.</p>}
                  </div>
                )}
                {tab === "plate" && (
                  <div className="md:col-span-2 space-y-2">
                    <p className="text-white/70">Drag a box over the number plate on the photo.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => set("plateMode", "name")} aria-pressed={edits.plateMode === "name"} className={`rounded-lg px-3 py-1.5 border ${edits.plateMode === "name" ? "border-yellow-400 text-yellow-300" : "border-white/15"}`}>Your name on it</button>
                      <button type="button" onClick={() => set("plateMode", "blur")} aria-pressed={edits.plateMode === "blur"} className={`rounded-lg px-3 py-1.5 border ${edits.plateMode === "blur" ? "border-yellow-400 text-yellow-300" : "border-white/15"}`}>Blur it</button>
                      {edits.plate && <button type="button" onClick={() => set("plate", null)} className="rounded-lg px-3 py-1.5 border border-white/15">Remove cover</button>}
                    </div>
                  </div>
                )}
              </div>

              {/* ACTIONS */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                <button type="button" disabled={!img || !hasEdits(edits) || !!busy} onClick={() => void saveEdited(false)} className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black disabled:opacity-40">
                  <FiSave /> {busy === "save" ? "Saving…" : "Save as a new photo"}
                </button>
                <button
                  type="button"
                  disabled={!img || !hasEdits(edits) || !!busy}
                  onClick={() => {
                    if (window.confirm("Replace the original photo with this edited version? The original is removed.")) void saveEdited(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-yellow-400/60 px-4 py-2 font-semibold text-yellow-300 disabled:opacity-40"
                >
                  <FiRefreshCw /> {busy === "replace" ? "Replacing…" : "Replace the original"}
                </button>
                <button type="button" disabled={!img} onClick={() => { const c = renderFull(); if (c) download(c, `${(vehicle.reg || "photo").replace(/\s+/g, "-")}-${selected + 1}.jpg`); }} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40">
                  <FiDownload /> Download
                </button>
                <button type="button" disabled={!hasEdits(edits)} onClick={() => setEdits(NO_EDITS)} className="rounded-lg px-4 py-2 text-white/60 hover:text-white disabled:opacity-30">
                  Undo all
                </button>
              </div>
            </section>
          </div>

          {/* SIDE PANEL */}
          <aside className="space-y-4">
            <section data-tour="tour-social-posts" className="rounded-2xl border border-yellow-400/30 bg-black/30 p-4">
              <p className="brand-caps text-xs mb-2">SOCIAL MEDIA POST</p>
              <p className="text-sm text-white/70 mb-3">This photo with the price and your name, sized for Facebook and Instagram. Downloads to your device.</p>
              <div className="flex gap-2">
                <button type="button" disabled={!img} onClick={() => makePost("square")} className="flex-1 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-40">Square post</button>
                <button type="button" disabled={!img} onClick={() => makePost("story")} className="flex-1 rounded-lg border border-yellow-400/60 px-3 py-2 text-sm font-semibold text-yellow-300 disabled:opacity-40">Story</button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="brand-caps text-xs mb-2">SHOT LIST</p>
              <p className="text-sm text-white/70 mb-2">
                The pictures buyers look for. This car has {images.length} of the {SHOT_LIST.length} recommended.
              </p>
              <ol className="space-y-1 text-sm text-white/80 list-decimal list-inside">
                {SHOT_LIST.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-4 opacity-80">
              <p className="brand-caps text-xs mb-2">SHOWROOM BACKDROP</p>
              <p className="text-sm text-white/70">Coming soon: swap a busy forecourt for a clean showroom background. It will use your usage credit, and it will always ask before spending any.</p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-white/80">
        <span>{props.label}</span>
        <span className="text-yellow-300">{props.value > 0 && !props.suffix ? "+" : ""}{props.value}{props.suffix ?? ""}</span>
      </span>
      <input type="range" className="w-full accent-yellow-400" min={props.min} max={props.max} step={props.step ?? 1} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}
