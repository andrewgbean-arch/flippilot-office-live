import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useInventory } from "@/context/InventoryProvider";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

import { autoFormatReg } from "@/features/vehicles/ui/SupernovaUI.web";
import { compressImageFile } from "@/lib/imageCompress";
import { generateVehicleDescription } from "@/lib/aiDescription";
import PhotoEditorModal from "@/lib/PhotoEditorModal";
import { deleteVehiclePhoto, hostedPhotoId } from "@/lib/vehiclePhotosApi";
import { createUndoableAction, type UndoableAction } from "@/lib/undoableAction";

interface EditVehicleProps {
  vehicleId: string;
}

export default function EditVehicle({ vehicleId }: EditVehicleProps) {
  const navigate = useNavigate();
  const { vehicles, updateVehicle, deleteVehicle } = useInventory();

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  // ⭐ All hooks below run unconditionally, every render, regardless of
  // whether `vehicle` has been found yet — the "not found" early return
  // sits AFTER every hook (right before the handler functions), not
  // before them. It used to sit right here, before ~15 useState calls
  // and a useEffect: on a fresh page load, before InventoryProvider has
  // finished loading vehicles, the first render hits that early return
  // with none of those hooks called; once vehicles load and a re-render
  // finds the real vehicle, all of them run for the first time — React
  // throws "Rendered more hooks than during the previous render" and
  // the whole screen crashes. Exact same bug class already fixed this
  // session in ReconWorkflow.tsx and (in an earlier session)
  // MOTLookup.tsx — this file just hadn't been touched since.
  /* ============================================================
     ⭐ Local editable state
  ============================================================ */
  const [make, setMake] = useState(vehicle?.make || "");
  const [model, setModel] = useState(vehicle?.model || "");
  const [year, setYear] = useState(vehicle?.year?.toString() || "");
  const [mileage, setMileage] = useState(vehicle?.mileage?.toString() || "");

  const [priceTrade, setPriceTrade] = useState(vehicle?.priceTrade?.toString() || "");
  const [priceRetail, setPriceRetail] = useState(vehicle?.priceRetail?.toString() || "");
  // Vehicle.vatScheme's type still allows a legacy "trade" value that
  // nothing in the app ever actually sets or reads — treat it the same
  // as unset (defaulting to the more common Margin Scheme).
  const [vatScheme, setVatScheme] = useState<"margin" | "standard">(
    vehicle?.vatScheme === "standard" ? "standard" : "margin"
  );

  const [notes, setNotes] = useState(vehicle?.notes || "");
  const [listingDescription, setListingDescription] = useState(vehicle?.listingDescription || "");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(vehicle?.images || []);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  // Photos taken on a phone live on the server, and a plain save can't
  // remove them (the server keeps them so a stale screen can't wipe
  // one) — so ones removed or replaced here are deleted for real, on Save.
  const [removedHostedIds, setRemovedHostedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [reg, setReg] = useState(vehicle?.mot?.reg || "");
  const [colour, setColour] = useState(vehicle?.mot?.colour || "");

  const [profit, setProfit] = useState<number | null>(null);

  // delete flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoTimer, setUndoTimer] = useState<number>(0);

  // The countdown behind "Delete Forever" is its own object (see
  // undoableAction.ts). It used to be a setInterval in softDeleteVehicle that
  // read a `pendingDelete` state variable — the value from the render where
  // the button was clicked, which never changes — so the delete never ran.
  // The object needs the latest deleteVehicle/navigate when it fires, and
  // these hooks stay above the "not found" return below, like the rest.
  const latest = useRef({ deleteVehicle, navigate });
  useEffect(() => {
    latest.current = { deleteVehicle, navigate };
  });
  const deleteAction = useRef<UndoableAction<string> | null>(null);
  if (deleteAction.current === null) {
    deleteAction.current = createUndoableAction<string>({
      seconds: 10,
      onTick: setUndoTimer,
      onCommit: (id, reason) => {
        latest.current.deleteVehicle(id);
        // If they have already left this screen, don't pull them back to the list.
        if (reason === "expired") latest.current.navigate("/dealer/inventory/list");
      },
    });
  }
  // Leaving the screen with a delete still counting down finishes it: they
  // confirmed it, and it must not quietly not happen.
  useEffect(() => () => deleteAction.current?.flush(), [vehicleId]);

  /* ============================================================
     ⭐ Profit Calculation
  ============================================================ */
  useEffect(() => {
    const buy = Number(priceTrade);
    const sell = Number(priceRetail);
    setProfit(!isNaN(buy) && !isNaN(sell) ? sell - buy : null);
  }, [priceTrade, priceRetail]);

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-[#0A1128] p-10 text-white">
        <h1 className="text-3xl font-bold text-red-500">Vehicle Not Found</h1>
        <p className="text-white/60">This flip does not exist.</p>
      </div>
    );
  }

  const profitColor =
    profit == null
      ? "text-gray-400"
      : profit < 0
      ? "text-red-500"
      : profit < 500
      ? "text-yellow-400"
      : "text-yellow-300";

  /* ============================================================
     ⭐ Image Upload
  ============================================================ */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // lets picking the exact same file(s) again re-fire onChange
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const compressed = await compressImageFile(file);
        setImages((prev) => [...prev, compressed]);
      } catch (err) {
        console.error("Could not process that image", err);
      }
    }
  };

  const deleteImage = (index: number) => {
    const hostedId = hostedPhotoId(images[index] ?? "");
    if (hostedId) setRemovedHostedIds((prev) => [...prev, hostedId]);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // images[0] is the cover photo everywhere it's shown (vehicle list
  // thumbnails, the overview gallery) — moving an image to the front is
  // the only "set cover" action needed, no separate flag on the data.
  const setCoverImage = (index: number) => {
    setImages((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      if (chosen === undefined) return prev;
      next.unshift(chosen);
      return next;
    });
  };

  /* ============================================================
     ⭐ AI Listing Description — real API call (Anthropic), built
     only from this vehicle's own real data. Needs ANTHROPIC_API_KEY
     configured server-side; shows the real "not configured" error
     rather than faking a description when it isn't.
  ============================================================ */
  const handleGenerateDescription = async () => {
    if (generatingDescription) return; // guards against a double-click firing two billed API calls
    setGeneratingDescription(true);
    setDescriptionError(null);

    const res = await generateVehicleDescription({
      make,
      model,
      year: year ? Number(year) : null,
      mileage: mileage ? Number(mileage) : null,
      colour: colour || null,
      condition: vehicle.condition,
      motStatus: vehicle.mot?.motStatus ?? null,
      motExpiry: vehicle.mot?.expiry ?? null,
      priceRetail: priceRetail ? Number(priceRetail) : null,
      notes: notes || null,
    });

    setGeneratingDescription(false);
    if (!res.ok || !res.description) {
      setDescriptionError(res.error ?? "Could not generate a description.");
      return;
    }
    setListingDescription(res.description);
  };

  /* ============================================================
     ⭐ Save Vehicle
  ============================================================ */
  const saveVehicle = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    // Server-hosted photos removed above go first. If one can't be
    // removed, stop here rather than save a list that quietly disagrees
    // with what the user just did — retrying is safe (already-gone counts
    // as done).
    for (const photoId of removedHostedIds) {
      const result = await deleteVehiclePhoto(vehicleId, photoId);
      if (!result.ok) {
        setSaveError(result.error ?? "Couldn't remove a photo — check your connection and try again.");
        setSaving(false);
        return;
      }
    }

    updateVehicle(vehicleId, {
      make,
      model,
      year: year ? Number(year) : null,
      mileage: mileage ? Number(mileage) : null,

      priceTrade: priceTrade ? Number(priceTrade) : null,
      priceRetail: priceRetail ? Number(priceRetail) : null,
      vatScheme,

      notes: notes || null,
      listingDescription: listingDescription || null,
      images: images.length > 0 ? images : null,

      mot: {
        ...(vehicle.mot || {}),
        reg: reg || null,
        colour: colour || null,
      },
    });

    // This screen is a tab inside the vehicle overview, so it can stay
    // mounted after the navigate below — leave it ready for another save,
    // and don't re-send deletes that already happened.
    setRemovedHostedIds([]);
    setSaving(false);
    navigate(`/dealer/inventory/${vehicleId}`);
  };

  /* ============================================================
     ⭐ Delete Vehicle (soft delete + undo)
  ============================================================ */
  // "Delete Forever" starts a 10-second countdown; unless they press Undo, the
  // vehicle is then really deleted (an explicit deletion is sent to the
  // server, which also removes its photos).
  const softDeleteVehicle = () => {
    setShowDeleteConfirm(false);
    setShowUndoToast(true);
    deleteAction.current?.start(vehicleId);
  };

  return (
    <div className="min-h-screen bg-[#0A1128] p-10 text-white animate-fadeIn">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Edit Vehicle"
        subtitle="Modify flip details"
      />

      <div className="max-w-4xl mx-auto space-y-10">

        {/* ⭐ Vehicle Details */}
        <SupernovaSectionDivider label="Vehicle Details" />

        <SupernovaGlowCard>
          <SupernovaInput label="Make" value={make} onChange={setMake} />
          <SupernovaInput label="Model" value={model} onChange={setModel} />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <SupernovaInput label="Year" value={year} onChange={setYear} type="number" />
            <SupernovaInput label="Mileage" value={mileage} onChange={setMileage} type="number" />
          </div>

          <SupernovaInput
            label="Registration"
            value={reg}
            onChange={(t) => setReg(autoFormatReg(t))}
            placeholder="AB12 CDE"
          />

          <SupernovaInput label="Colour" value={colour} onChange={setColour} />
        </SupernovaGlowCard>

        {/* ⭐ Pricing */}
        <SupernovaSectionDivider label="Pricing" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 gap-4">
            <SupernovaInput label="Trade Price (£)" value={priceTrade} onChange={setPriceTrade} type="number" />
            <SupernovaInput label="Retail Price (£)" value={priceRetail} onChange={setPriceRetail} type="number" />
          </div>

          <div className="mt-4">
            <label className="text-white/70 text-sm mb-1 block">VAT Scheme (for when this vehicle is sold)</label>
            <select
              value={vatScheme}
              onChange={(e) => setVatScheme(e.target.value as "margin" | "standard")}
              className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
            >
              <option value="margin">Margin Scheme — no VAT invoice on purchase</option>
              <option value="standard">Standard VAT — VAT invoice received on purchase</option>
            </select>
          </div>

          <div className="mt-6">
            <p className="text-white/80 text-sm mb-1">Live Profit</p>

            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400"
                style={{
                  width:
                    profit == null
                      ? "0%"
                      : `${Math.max(0, Math.min(100, (profit / 2000) * 100))}%`,
                }}
              />
            </div>

            <p className={`${profitColor} font-bold mt-2`}>
              {profit == null ? "Enter buy & sell to see profit" : `£${profit.toFixed(0)} profit`}
            </p>
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Notes */}
        <SupernovaSectionDivider label="Notes" />

        <SupernovaGlowCard>
          <SupernovaInput
            label="Notes"
            value={notes}
            onChange={setNotes}
            multiline
          />
        </SupernovaGlowCard>

        {/* ⭐ Listing Description */}
        <SupernovaSectionDivider label="Listing Description" />

        <SupernovaGlowCard>
          <p className="text-white/50 text-sm mb-3">
            Public-facing sales copy — separate from Notes above. Write your own, or generate a draft from this vehicle's real details.
          </p>
          <SupernovaInput
            label="Listing Description"
            value={listingDescription}
            onChange={setListingDescription}
            multiline
          />
          <div className="mt-3">
            <SupernovaGlowButton
              label={generatingDescription ? "Generating…" : "Generate with AI"}
              onClick={handleGenerateDescription}
              disabled={generatingDescription}
            />
          </div>
          {descriptionError && (
            <p className="text-red-400 text-sm mt-3">{descriptionError}</p>
          )}
        </SupernovaGlowCard>

        {/* ⭐ Images */}
        <SupernovaSectionDivider label="Images" />

        <SupernovaGlowCard>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="mb-4 text-white"
          />
          <p className="text-white/40 text-xs -mt-2 mb-4">
            Select multiple photos at once. The first photo is used as the cover everywhere this vehicle is shown.
          </p>

          {images.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto">
              {images.map((uri, idx) => (
                <div
                  key={idx}
                  className={`relative border-2 rounded-xl overflow-hidden ${
                    idx === 0 ? "border-yellow-400" : "border-white/20"
                  }`}
                >
                  {idx === 0 && (
                    <span className="absolute top-2 left-2 bg-yellow-400 text-black px-2 py-1 rounded-md text-xs font-bold">
                      Cover
                    </span>
                  )}
                  <button
                    onClick={() => deleteImage(idx)}
                    className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-md text-xs font-bold"
                  >
                    X
                  </button>
                  {idx !== 0 && (
                    <button
                      onClick={() => setCoverImage(idx)}
                      className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-bold hover:bg-black/90"
                    >
                      Set Cover
                    </button>
                  )}
                  <button
                    onClick={() => setEditingImageIndex(idx)}
                    className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-bold hover:bg-black/90"
                  >
                    Edit
                  </button>
                  <img src={uri} className="w-64 h-40 object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60 text-sm">No images yet.</p>
          )}
        </SupernovaGlowCard>

        {/* ⭐ Save + Delete */}
        <div className="space-y-4 pb-20">
          {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
          <SupernovaGlowButton label={saving ? "Saving…" : "Save Vehicle"} onClick={saveVehicle} />

          <SupernovaGlowButton
            label="Delete Vehicle"
            onClick={() => setShowDeleteConfirm(true)}
          />
        </div>
      </div>

      {/* ⭐ Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-black/40 border border-red-500 rounded-2xl p-8 w-[90%] max-w-md text-white shadow-xl">
            <h2 className="text-2xl font-bold text-red-400 mb-4">
              Confirm Delete
            </h2>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete this vehicle? This action cannot be undone.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl py-3 font-bold hover:bg-white/20 transition"
              >
                Cancel
              </button>

              <button
                onClick={softDeleteVehicle}
                className="flex-1 bg-red-600 border border-red-700 rounded-xl py-3 font-bold hover:bg-red-700 transition"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Undo Toast */}
      {showUndoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 border border-yellow-400 px-6 py-4 rounded-2xl text-white shadow-xl animate-fadeIn z-50">
          <p className="font-bold text-yellow-300 mb-1">Vehicle Deleted</p>
          <p className="text-white/70 text-sm mb-3">
            Undo available for {undoTimer}s
          </p>

          <button
            onClick={() => {
              deleteAction.current?.undo();
              setShowUndoToast(false);
            }}
            className="bg-yellow-400 text-black font-bold px-4 py-2 rounded-xl hover:bg-yellow-300 transition"
          >
            Undo Delete
          </button>
        </div>
      )}

      {editingImageIndex !== null && images[editingImageIndex] && (
        <PhotoEditorModal
          imageSrc={images[editingImageIndex]}
          onClose={() => setEditingImageIndex(null)}
          onSave={(edited) => {
            // The edited picture is saved inline like any other web edit, so
            // a hosted original it replaces is deleted on Save (else both
            // would show).
            const replacedId = hostedPhotoId(images[editingImageIndex] ?? "");
            if (replacedId) setRemovedHostedIds((prev) => [...prev, replacedId]);
            setImages((prev) => prev.map((img, i) => (i === editingImageIndex ? edited : img)));
            setEditingImageIndex(null);
          }}
        />
      )}
    </div>
  );
}

