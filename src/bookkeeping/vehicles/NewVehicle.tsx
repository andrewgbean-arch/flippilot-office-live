import { formatMoney } from "@/lib/formatMoney";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

import { useInventory } from "@/context/InventoryProvider";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { autoFormatReg } from "@/features/vehicles/ui/SupernovaUI.web";
import { compressImageFile } from "@/lib/imageCompress";
import PhotoEditorModal from "@/lib/PhotoEditorModal";

import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { calculateVat } from "@/bookkeeping/vatUtils";
import { purchaseVatSettings } from "@/bookkeeping/purchaseVat";
import { readMoney, readOptionalMoney } from "@/lib/parseMoney";
import { useAuth } from "@/context/AuthContext";
import { canSeeMoney } from "@/lib/permissions";

export default function NewVehicle() {
  const navigate = useNavigate();
  const { addManualVehicle } = useInventory();
  const { addPurchase } = useBookkeeping();

  const [title, setTitle] = useState("");
  const [reg, setReg] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [colour, setColour] = useState("");
  const [mileage, setMileage] = useState("");
  const [engineSize, setEngineSize] = useState("");

  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [notes, setNotes] = useState("");

  const [images, setImages] = useState<string[]>([]);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [motData, setMotData] = useState<any>(null);

  const [source, setSource] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [vatScheme, setVatScheme] = useState<"margin" | "standard">("margin");
  const [vatRate, setVatRate] = useState("20");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // The Buy Price becomes the car's purchase in the books, so it is REQUIRED and
  // must be an amount above £0 (a blank used to be saved as £0, and "4,500" was
  // lost, so a later sale showed the whole price as profit). The Sell Price is
  // optional: blank (or 0) is stored as unset, never as £0, but if something IS
  // typed it must be readable.
  const [submitted, setSubmitted] = useState(false);
  // Only the owner, managers and finance keep what a car cost (the server
  // drops it from anyone else, and they can't write the books), so for
  // everyone else there is no Buy Price box and nothing is sent to the books.
  const { user } = useAuth();
  const money = canSeeMoney(user);
  const buyRead = readMoney(buyPrice, { positive: true, blankMessage: "Enter a Buy Price before saving." });
  const sellRead = readOptionalMoney(sellPrice);
  const buyError = buyRead.ok ? null : buyRead.message;
  const sellError = sellRead.ok ? null : sellRead.message;
  const showBuyError = buyError !== null && (submitted || buyPrice.trim() !== "");

  // Live profit needs BOTH prices to be readable. Blank or unreadable is unknown,
  // never "£0 profit".
  const profit = buyRead.ok && sellRead.ok && sellRead.value !== null ? sellRead.value - buyRead.value : null;

  const profitColor =
    profit == null
      ? "text-gray-400"
      : profit < 0
      ? "text-red-500"
      : profit < 500
      ? "text-yellow-400"
      : "text-yellow-300";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      setImages((prev) => [...prev, compressed]);
    } catch (err) {
      console.error("Could not process that image", err);
    }
  };

  const deleteImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const lookupMOT = async () => {
    if (!reg.trim()) return;

    const formatted = autoFormatReg(reg);
    setReg(formatted);

    const data = await fetchMOT(formatted);

    if (data) {
      setMotData(data);

      setMake(data.make ?? "");
      setModel(data.model ?? "");
      setYear(data.year?.toString() ?? "");
      setColour(data.colour ?? "");
      setMileage(data.mileage?.toString() ?? "");

      if (!title.trim()) {
        setTitle(
          `${data.make ?? ""} ${data.model ?? ""} ${data.year ?? ""}`.trim()
        );
      }
    }
  };

  const saveVehicle = () => {
    setSaveError(null);

    // Inventory's Vehicle type has no free-text "title" field — fall back
    // to splitting it into make/model so nothing typed is lost if the
    // dedicated Make/Model fields were left blank (or vice versa: a
    // dealer who only fills Make/Model and never touches the Title
    // field shouldn't be silently blocked from saving — this used to
    // hard-require a non-empty Title with no error shown, so clicking
    // Save with Make/Model filled but Title blank did visibly nothing).
    const [titleMake, ...titleRest] = title.trim().split(" ");
    const resolvedMake = make.trim() || titleMake || "";
    const resolvedModel = model.trim() || titleRest.join(" ") || "";

    if (!resolvedMake || !resolvedModel) {
      setSaveError("Enter at least a Make and Model (or a Vehicle Title) before saving.");
      return;
    }
    if (money && !buyRead.ok) {
      setSubmitted(true);
      setSaveError(buyRead.reason === "blank" ? buyRead.message : `Buy Price: ${buyRead.message}`);
      return;
    }
    if (!sellRead.ok) {
      setSaveError(`Sell Price: ${sellRead.message}`);
      return;
    }

    const buy = money && buyRead.ok ? buyRead.value : null;
    // Blank stays unset (null), never £0.
    const sell = sellRead.value;

    // Under the Margin Scheme there is no VAT invoice on the purchase, so the rate
    // is 0 and the price is not "VAT included", whatever the boxes still say.
    const { vatRate: purchaseVatRate, vatIncluded: purchaseVatIncluded } = purchaseVatSettings(
      vatScheme,
      Number(vatRate) / 100,
      vatIncluded
    );

    const breakdown = calculateVat(buy ?? 0, {
      vatRate: purchaseVatRate,
      vatIncluded: purchaseVatIncluded,
      vatReclaimable: true,
    });

    const newVehicle = addManualVehicle({
      reg: reg || motData?.reg || null,
      make: resolvedMake,
      model: resolvedModel,
      year: year ? Number(year) : motData?.year ?? null,
      colour: colour || motData?.colour || null,
      mileage: mileage ? Number(mileage) : motData?.mileage ?? null,
      buyPrice: buy,
      sellPrice: sell,
      notes: notes || null,
      images: images.length > 0 ? images : null,
      mot: motData || undefined,
      vatScheme,
    });

    if (buy !== null) addPurchase({
      id: crypto.randomUUID(),
      vehicleId: newVehicle.id,
      purchasePrice: buy,
      source: source || "Unknown",
      date: purchaseDate,
      vatScheme,
      // vatRate is a decimal fraction everywhere else in this module
      // (calculateVat, AddPurchaseModal, BookkeepingProvider) — this UI
      // uses a whole-number % dropdown ("20" for 20%), so it has to be
      // divided down (purchaseVatSettings gets it already divided, and
      // forces 0 for the Margin Scheme). Passing the raw 20 here made
      // addPurchase's internal VAT recalculation produce nonsense (a £1000
      // purchase came out as £952 VAT / £47 net instead of ~£167 VAT / £833 net).
      vatRate: purchaseVatRate,
      vatIncluded: purchaseVatIncluded,
      vatAmount: breakdown.vat,
      netAmount: breakdown.net,
    });

    navigate(`/dealer/inventory/${newVehicle.id}`);
  };

  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      <SupernovaHeroHeader
        title="New Vehicle"
        subtitle="Manual Entry • Motors Module"
      />

      <div className="max-w-4xl mx-auto space-y-10">
        <SupernovaSectionDivider label="Vehicle Details" />

        <SupernovaGlowCard>
          <SupernovaInput
            label="Vehicle Title"
            value={title}
            onChange={setTitle}
            placeholder="Ford Fiesta 2014..."
          />

          <SupernovaInput
            label="Registration"
            value={reg}
            onChange={(t) => setReg(autoFormatReg(t))}
            placeholder="AB12 CDE"
          />

          <SupernovaGlowButton label="Lookup MOT" onClick={lookupMOT} />

          <div className="grid grid-cols-2 gap-4 mt-6">
            <SupernovaInput label="Make" value={make} onChange={setMake} />
            <SupernovaInput label="Model" value={model} onChange={setModel} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <SupernovaInput label="Year" value={year} onChange={setYear} />
            <SupernovaInput label="Colour" value={colour} onChange={setColour} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <SupernovaInput
              label="Mileage"
              value={mileage}
              onChange={setMileage}
            />
            <SupernovaInput
              label="Engine Size"
              value={engineSize}
              onChange={setEngineSize}
            />
          </div>
        </SupernovaGlowCard>

        <SupernovaSectionDivider label="Pricing & Source" />

        <SupernovaGlowCard>
          <div className={`grid gap-4 ${money ? "grid-cols-2" : "grid-cols-1"}`}>
            {money && (
            <SupernovaInput
              label="Buy Price (£)"
              value={buyPrice}
              onChange={setBuyPrice}
              inputMode="decimal"
              placeholder="e.g. 4500 or £4,500.00"
            />
            )}
            <SupernovaInput
              label="Sell Price (£)"
              value={sellPrice}
              onChange={setSellPrice}
              inputMode="decimal"
              placeholder="Leave blank if not priced yet"
            />
          </div>
          {money && showBuyError && (
            <p role="alert" className="text-red-400 text-sm mt-2">
              Buy Price: {buyError}
            </p>
          )}
          {sellError && (
            <p role="alert" className="text-red-400 text-sm mt-2">
              Sell Price: {sellError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mt-4">
            <SupernovaInput
              label="Purchased From"
              value={source}
              onChange={setSource}
              placeholder="Facebook Marketplace, Auction, Trade Seller..."
            />
            <SupernovaInput
              label="Purchase Date"
              type="date"
              value={purchaseDate}
              onChange={setPurchaseDate}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="newvehicle-vat-scheme-for-when-this-vehicle-is-sold" className="text-white/70 text-sm mb-1 block">VAT Scheme (for when this vehicle is sold)</label>
            <select id="newvehicle-vat-scheme-for-when-this-vehicle-is-sold"
              value={vatScheme}
              onChange={(e) => setVatScheme(e.target.value as "margin" | "standard")}
              className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
            >
              <option value="margin">Margin Scheme — no VAT invoice on purchase (private seller, trade-in, most used cars)</option>
              <option value="standard">Standard VAT — VAT invoice received on purchase</option>
            </select>
          </div>

          {vatScheme === "margin" ? (
            <p
              role="note"
              className="mt-4 px-3 py-2 rounded-xl bg-black/30 border border-yellow-400/20 text-sm text-yellow-300/90"
            >
              Margin Scheme purchases carry no VAT, so no VAT rate applies and none is recorded.
            </p>
          ) : (
            <>
              <div className="mt-4">
                <label htmlFor="newvehicle-vat-rate-on-this-purchase" className="text-white/70 text-sm mb-1 block">VAT Rate on this Purchase</label>
                <select id="newvehicle-vat-rate-on-this-purchase"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
                >
                  <option value="20">20% (Standard)</option>
                  <option value="5">5% (Reduced)</option>
                  <option value="0">0% (Zero-rated / no VAT invoice)</option>
                </select>
              </div>

              <div className="mt-4">
                <label className="text-white/70 text-sm mb-1 block">
                  VAT Included?
                </label>

                <button
                  onClick={() => setVatIncluded(!vatIncluded)}
                  className={`px-4 py-2 rounded-xl font-bold border ${
                    vatIncluded
                      ? "bg-green-600 border-green-700"
                      : "bg-white/10 border-white/20"
                  }`}
                >
                  {vatIncluded ? "Yes" : "No"}
                </button>
              </div>

            </>
          )}

          {money && (
          <div className="mt-6">
            <p className="text-white/80 text-sm mb-1">Live Profit</p>

            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400"
                style={{
                  width:
                    profit == null
                      ? "0%"
                      : `${Math.max(
                          0,
                          Math.min(100, (profit / 2000) * 100)
                        )}%`,
                }}
              />
            </div>

            <p className={`${profitColor} font-bold mt-2`}>
              {profit == null
                ? "Enter buy & sell to see profit"
                : `${formatMoney(profit)} profit`}
            </p>
          </div>
          )}
        </SupernovaGlowCard>

        <SupernovaSectionDivider label="Notes" />

        <SupernovaGlowCard>
          <SupernovaInput
            label="Notes"
            value={notes}
            onChange={setNotes}
            multiline
          />
        </SupernovaGlowCard>

        <SupernovaSectionDivider label="Images" />

        <SupernovaGlowCard>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="mb-4 text-white"
          />

          {images.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto">
              {images.map((uri, idx) => (
                <div
                  key={idx}
                  className="relative border-2 border-yellow-400 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => deleteImage(idx)}
                    className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-md text-xs font-bold"
                  >
                    X
                  </button>
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

        {motData && (
          <>
            <SupernovaSectionDivider label="MOT Summary" />

            <SupernovaGlowCard>
              <p className="text-white/80 text-sm">
                Expiry:{" "}
                <span className="font-bold">{motData.expiry ?? "—"}</span>
              </p>
              <p className="text-white/80 text-sm">
                Mileage:{" "}
                <span className="font-bold">{motData.mileage ?? "—"}</span>
              </p>
              <p className="text-white/80 text-sm">
                Colour:{" "}
                <span className="font-bold">{motData.colour ?? "—"}</span>
              </p>
              <p className="text-white/80 text-sm">
                Year:{" "}
                <span className="font-bold">{motData.year ?? "—"}</span>
              </p>
              <p className="text-white/80 text-sm">
                Make/Model:{" "}
                <span className="font-bold">
                  {motData.make} {motData.model}
                </span>
              </p>
            </SupernovaGlowCard>
          </>
        )}

        <div className="sticky bottom-10">
          {saveError && <p className="text-red-400 text-sm mb-2">{saveError}</p>}
          <SupernovaGlowButton label="Save Vehicle" onClick={saveVehicle} />
        </div>
      </div>

      {editingImageIndex !== null && images[editingImageIndex] && (
        <PhotoEditorModal
          imageSrc={images[editingImageIndex]}
          onClose={() => setEditingImageIndex(null)}
          onSave={(edited) => {
            setImages((prev) => prev.map((img, i) => (i === editingImageIndex ? edited : img)));
            setEditingImageIndex(null);
          }}
        />
      )}
    </div>
  );
}
