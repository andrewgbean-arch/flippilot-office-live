import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

import { useInventory } from "@/context/InventoryProvider";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { autoFormatReg } from "@/features/vehicles/ui/SupernovaUI.web";

import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { calculateVat } from "@/bookkeeping/vatUtils";

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
  const [motData, setMotData] = useState<any>(null);

  const [profit, setProfit] = useState<number | null>(null);

  const [supplier, setSupplier] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    const buy = Number(buyPrice);
    const sell = Number(sellPrice);
    setProfit(!isNaN(buy) && !isNaN(sell) ? sell - buy : null);
  }, [buyPrice, sellPrice]);

  const profitColor =
    profit == null
      ? "text-gray-400"
      : profit < 0
      ? "text-red-500"
      : profit < 500
      ? "text-yellow-400"
      : "text-yellow-300";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImages((prev) => [...prev, reader.result as string]);
    };
    reader.readAsDataURL(file);
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
    if (!title.trim()) return;
    if (!buyPrice.trim()) return;

    const buy = Number(buyPrice);
    const sell = sellPrice ? Number(sellPrice) : null;

    const breakdown = calculateVat(buy, {
      vatRate: Number(vatRate) / 100,
      vatIncluded,
      vatReclaimable: true,
    });

    // Inventory's Vehicle type has no free-text "title" field — fall back
    // to splitting it into make/model so nothing typed is lost if the
    // dedicated Make/Model fields were left blank.
    const [titleMake, ...titleRest] = title.trim().split(" ");
    const resolvedMake = make || titleMake || "Unknown";
    const resolvedModel = model || titleRest.join(" ") || "Unknown";

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
    });

    addPurchase({
      id: crypto.randomUUID(),
      vehicleId: newVehicle.id,
      purchasePrice: buy,
      supplier: supplier || "Unknown",
      date: purchaseDate,
      // vatRate is a decimal fraction everywhere else in this module
      // (calculateVat, AddPurchaseModal, BookkeepingProvider) — this UI
      // uses a whole-number % dropdown ("20" for 20%), so it has to be
      // divided down. Passing the raw 20 here made addPurchase's
      // internal VAT recalculation produce nonsense (a £1000 purchase
      // came out as £952 VAT / £47 net instead of ~£167 VAT / £833 net).
      vatRate: Number(vatRate) / 100,
      vatIncluded,
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

        <SupernovaSectionDivider label="Pricing & Supplier" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 gap-4">
            <SupernovaInput
              label="Buy Price (£)"
              value={buyPrice}
              onChange={setBuyPrice}
            />
            <SupernovaInput
              label="Sell Price (£)"
              value={sellPrice}
              onChange={setSellPrice}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <SupernovaInput
              label="Supplier"
              value={supplier}
              onChange={setSupplier}
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
            <label className="text-white/70 text-sm mb-1 block">VAT Rate</label>
            <select
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
            >
              <option value="20">20% (Standard)</option>
              <option value="0">0% (Margin Scheme)</option>
              <option value="5">5% (Reduced)</option>
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
                : `£${profit.toFixed(0)} profit`}
            </p>
          </div>
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
          <SupernovaGlowButton label="Save Vehicle" onClick={saveVehicle} />
        </div>
      </div>
    </div>
  );
}
