import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { fetchEbayCarComps, type EbayCarComps } from "@/lib/ebayCarComps";
import { fetchGooglePriceGuide, type GoogleCarPriceGuide } from "@/lib/googlePriceGuide";

import CostsTab from "@/bookkeeping/vehicles/CostsTab";
import ProfitTab from "@/bookkeeping/vehicles/ProfitTab";
import EditVehicle from "@/bookkeeping/vehicles/EditVehicle";
import MOTWorkflow from "@/dealer/workflow/MOTWorkflow";

import PageHeader from "@/components/PageHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import { getUlezStatus } from "@/features/vehicles/utils/ulezUtils";

import type { Vehicle } from "@/types/Vehicle";

import { hasMotRecord } from "./stockFacts";
import {
  ageBand,
  daysInStock,
  formatDate,
  formatMileage,
  formatPrice,
  isSold,
  motState,
  prettyStatus,
  registrationOf,
  shownPrice,
  vehicleTitle,
} from "./vehicleListModel";

const TAB_LABELS = {
  overview: "Overview",
  mot: "MOT",
  market: "Market pricing",
  costs: "Costs",
  profit: "Profit",
  edit: "Edit",
} as const;

// This tab used to be "AI insights": a buy-or-walk verdict, a negotiation plan,
// a "valuation", a predictive-maintenance cost grid and a market-intelligence
// panel. All of them were fixed percentages of the dealer's own asking price
// (the "recommended buy price" was 65% of it, the "walk-away price" 90% of
// it), so they told a dealer nothing they didn't already know and could not be
// trusted at the moment of buying or haggling. They are gone; what remains is
// the one thing here that is real: what similar cars are listed for elsewhere.

const MOT_WORD = {
  expired: "Expired",
  soon: "Expiring soon",
  valid: "Valid",
  unknown: "No MOT date",
} as const;

const MOT_CLASS = {
  expired: "text-red-400",
  soon: "text-orange-300",
  valid: "text-green-300",
  unknown: "text-white/60",
} as const;

const FACT_TONE = {
  good: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-red-300",
  plain: "text-white",
} as const;

function Fact({ label, value, tone = "plain" }: { label: string; value: string; tone?: keyof typeof FACT_TONE }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-white/70">{label}</dt>
      <dd className={`mt-0.5 text-lg font-bold ${FACT_TONE[tone]}`}>{value}</dd>
    </div>
  );
}

export default function VehicleOverview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const vehicleId = id as string;

  const { vehicles: invVehicles, loading: stockLoading } = useInventory();
  const { purchases, sales } = useBookkeeping();

  const vehicle = invVehicles.find((v: Vehicle) => String(v.id) === vehicleId);

  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);

  const [tab, setTab] = useState<
    "overview" | "mot" | "market" | "costs" | "profit" | "edit"
  >("overview");

  // Real dealer-only, same-year, mileage-comparable eBay listings for
  // this exact vehicle (see backend/src/ebayCarMarket.ts) — fetched
  // once per vehicle rather than blocking the tab on it, since it's an
  // external API call. Starts null (not yet fetched / still loading);
  // stays null when eBay isn't configured or no comparable dealer
  // listings exist, in which case the card says there is nothing to
  // compare rather than showing an estimate made up from the dealer's
  // own prices (`ebayChecked` tells "still checking" from "nothing
  // found"). Has to live above the `!vehicle` guard below along with
  // every other hook in this component — a hook called only when
  // `vehicle` exists would violate the Rules of Hooks the instant a
  // vehicle id stops resolving between renders.
  const [ebayComps, setEbayComps] = useState<EbayCarComps | null>(null);
  const [ebayChecked, setEbayChecked] = useState(false);
  useEffect(() => {
    setEbayComps(null);
    setEbayChecked(false);
    if (!vehicle?.make || !vehicle?.model) {
      setEbayChecked(true);
      return;
    }
    let cancelled = false;
    fetchEbayCarComps(
      vehicle.make,
      vehicle.model,
      vehicle.mot?.year ?? null,
      vehicle.mileage ?? vehicle.mot?.mileage ?? null
    )
      .then((res) => {
        if (!cancelled && res.available && res.comps) setEbayComps(res.comps);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEbayChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle?.id, vehicle?.make, vehicle?.model, vehicle?.mot?.year, vehicle?.mileage]);

  // Google dealer-price cross-reference — deliberately NOT auto-fetched
  // like the eBay comps above; only runs when the dealer clicks "Check
  // Google dealer prices" (see handleCheckGooglePrices below). The
  // shared SerpAPI quota behind this (100 searches/month, split with
  // flippilotlatest's own price lookups) can't support fetching this on
  // every vehicle page view the way eBay's much larger free tier can.
  const [googleGuide, setGoogleGuide] = useState<GoogleCarPriceGuide | null>(null);
  const [googleGuideStatus, setGoogleGuideStatus] = useState<"idle" | "loading" | "not-found">("idle");

  useEffect(() => {
    setGoogleGuide(null);
    setGoogleGuideStatus("idle");
  }, [vehicle?.id]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  useEffect(() => {
    setLightboxIndex(null);
  }, [vehicle?.id]);

  if (!vehicle) {
    // On a direct visit or a refresh the stock is still on its way, so the car
    // isn't "missing" yet: say we're loading rather than flashing "not found".
    if (stockLoading) {
      return (
        <div className="text-white" aria-busy="true">
          <p className="text-white/70">Loading vehicle…</p>
        </div>
      );
    }
    return (
      <div className="text-white">
        <h1 className="text-2xl font-bold text-red-300">Vehicle not found</h1>
        <p className="mt-2 text-white/70">
          This vehicle isn't in your stock. It may have been deleted, or the link may be out of date.
        </p>
        <Link
          to="/dealer/inventory/list"
          className="mt-4 inline-flex items-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300"
        >
          Back to your vehicles
        </Link>
      </div>
    );
  }

  const mot = vehicle.mot;
  const ulez = getUlezStatus(mot?.fuelType, mot?.euroStatus);

  async function handleCheckGooglePrices() {
    if (!vehicle || !vehicle.make || !vehicle.model) return;
    setGoogleGuideStatus("loading");
    const res = await fetchGooglePriceGuide(
      vehicle.make,
      vehicle.model,
      mot?.year ?? null,
      vehicle.mileage ?? mot?.mileage ?? null
    );
    if (res.available && res.guide) {
      setGoogleGuide(res.guide);
      setGoogleGuideStatus("idle");
    } else {
      setGoogleGuide(null);
      setGoogleGuideStatus("not-found");
    }
  }

  const failures = mot?.history
    ? mot.history
        .filter((h) => h.result?.toUpperCase() === "FAIL")
        .flatMap((h) => h.failures ?? [])
    : [];

  const advisories = mot?.advisories ?? [];

  // What a dealer wants the moment they open a car: its plate, price, how long
  // it has been here and where its MOT stands. (The header used to read
  // "Record ID: car-1", which means nothing to anyone.)
  const hdrNow = new Date();
  const hdrReg = registrationOf(vehicle);
  const hdrPrice = shownPrice(vehicle);
  const hdrSold = isSold(vehicle);
  const hdrDays = hdrSold ? null : daysInStock(vehicle.createdAt, hdrNow);
  const hdrMot = motState(vehicle.mot?.expiry, hdrNow);
  const hdrMeta = [vehicle.year ? String(vehicle.year) : null, formatMileage(vehicle.mileage)].filter(
    (part): part is string => part !== null
  );
  const hdrAge = ageBand(hdrDays);
  const hdrMotText =
    hdrMot.kind === "unknown"
      ? "No MOT date"
      : `${hdrMot.label.slice(4, 5).toUpperCase()}${hdrMot.label.slice(5)} · ${hdrMot.date}`;

  // Has anyone looked this car's MOT up? Without a record there are no
  // advisories or failures to count, and printing "0" would read as a clean MOT.
  const hasMot = hasMotRecord(vehicle);
  // 0 and missing both mean "not set" (formatPrice and the Profit tab treat them
  // that way), so an unpriced car shows "Not set" rather than £0.
  const purchasePrice = purchase?.purchasePrice ?? vehicle.priceTrade ?? null;
  const salePrice = sale?.salePrice ?? vehicle.priceRetail ?? null;

  return (
    <div className="animate-fadeIn text-white">
      <PageHeader
        title={vehicleTitle(vehicle)}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {hdrReg && (
              <span className="rounded bg-yellow-300 px-1.5 py-px font-mono text-xs font-bold tracking-wide text-black">
                {hdrReg}
              </span>
            )}
            {hdrMeta.length > 0 && <span>{hdrMeta.join(" · ")}</span>}
            <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-xs font-semibold text-white/90">
              {prettyStatus(vehicle.status)}
            </span>
          </span>
        }
        actions={
          <Link
            to="/dealer/inventory/list"
            className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            All vehicles
          </Link>
        }
      />

      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label={hdrPrice.label} value={formatPrice(hdrPrice.amount) ?? "Not set"} />
        {hdrSold ? (
          <Fact label="Sold on" value={formatDate(sale?.date) ?? "Not in your books"} />
        ) : (
          <Fact
            label="Days in stock"
            value={hdrDays === null ? "Unknown" : hdrDays === 0 ? "Added today" : String(hdrDays)}
            tone={hdrAge === "old" ? "bad" : hdrAge === "ageing" ? "warn" : "plain"}
          />
        )}
        <Fact
          label="MOT"
          value={hdrMotText}
          tone={hdrMot.kind === "expired" ? "bad" : hdrMot.kind === "soon" ? "warn" : hdrMot.kind === "valid" ? "good" : "plain"}
        />
        <Fact label="Mileage" value={formatMileage(vehicle.mileage) ?? "Not recorded"} />
      </dl>

      {/* TABS */}
      <div
        data-tour="tour-vehicle-tabs"
        role="tablist"
        aria-label="Vehicle sections"
        className="mb-6 flex flex-wrap gap-2"
      >
        {(Object.keys(TAB_LABELS) as (keyof typeof TAB_LABELS)[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl transition font-bold ${
              tab === t
                ? "bg-yellow-400 text-black"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-10">
          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Photos" />
            {vehicle.images && vehicle.images.length > 0 ? (
              <div>
                <img
                  src={vehicle.images[0]}
                  alt={`${vehicle.make} ${vehicle.model} — cover photo`}
                  onClick={() => setLightboxIndex(0)}
                  className="w-full max-h-96 object-cover rounded-lg cursor-pointer border border-white/10"
                />
                {vehicle.images.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {vehicle.images.map((src, idx) => (
                      <img
                        key={idx}
                        src={src}
                        alt={`${vehicle.make} ${vehicle.model} — photo ${idx + 1}`}
                        onClick={() => setLightboxIndex(idx)}
                        className="w-20 h-20 object-cover rounded-md border border-white/10 cursor-pointer hover:border-yellow-400 transition flex-shrink-0"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-white/50 mb-3">No photos yet.</p>
                <button
                  onClick={() => setTab("edit")}
                  className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition"
                >
                  Add Photos
                </button>
              </div>
            )}
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Vehicle Snapshot" />
            <p><span className="text-white/60">Make:</span> {vehicle.make}</p>
            <p><span className="text-white/60">Model:</span> {vehicle.model}</p>
            <p><span className="text-white/60">Year:</span> {vehicle.year ?? "N/A"}</p>
            <p><span className="text-white/60">Mileage:</span> {vehicle.mileage ?? "N/A"}</p>
            {/* MOT SUMMARY: only what the MOT record says. It used to add a
                "MOT Health Score" percentage, which read 99% for a car with no
                MOT data at all; that score is gone. */}
            {hasMot ? (
              <>
                <p>
                  <span className="text-white/60">MOT Status:</span>{" "}
                  <span className={MOT_CLASS[hdrMot.kind]}>{MOT_WORD[hdrMot.kind]}</span>
                </p>

                <p>
                  <span className="text-white/60">MOT Expiry:</span>{" "}
                  {hdrMot.date ?? "Unknown"}
                </p>

                <p>
                  <span className="text-white/60">Advisories:</span>{" "}
                  {advisories.length}
                </p>

                <p>
                  <span className="text-white/60">Failure items in test history:</span>{" "}
                  {failures.length}
                </p>
              </>
            ) : (
              <p>
                <span className="text-white/60">MOT:</span> No MOT data yet.{" "}
                <Link
                  to="/dealer/inventory/mot-lookup"
                  className="text-yellow-300 underline hover:text-yellow-200"
                >
                  Run an MOT lookup
                </Link>
              </p>
            )}

            <p>
              <span className="text-white/60">ULEZ/CAZ:</span>{" "}
              <span
                className={
                  ulez.status === "compliant"
                    ? "text-green-300"
                    : ulez.status === "non-compliant"
                    ? "text-red-400"
                    : "text-white/60"
                }
              >
                {ulez.label}
              </span>
            </p>
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Purchase / Sale" />
            <p>
              <span className="text-white/60">Purchase Price:</span>{" "}
              {formatPrice(purchasePrice) ?? "Not set"}
            </p>
            <p>
              <span className="text-white/60">{sale ? "Sale Price" : "Asking Price"}:</span>{" "}
              {formatPrice(salePrice) ?? "Not set"}
            </p>
          </SupernovaGlowCard>

          <div className="flex gap-4">
            <button
              onClick={() => setTab("mot")}
              className="px-4 py-2 bg-blue-500 text-black rounded-xl font-bold hover:bg-blue-400"
            >
              Full MOT History
            </button>

            <button
              onClick={() => navigate(`/dealer/workflow/recon/${vehicleId}`)}
              className="px-4 py-2 bg-green-500 text-black rounded-xl font-bold hover:bg-green-400"
            >
              Recon Workflow
            </button>
          </div>
        </div>
      )}

      {/* MOT TAB */}
      {tab === "mot" && <MOTWorkflow />}

      {/* MARKET PRICING TAB (was "AI insights", see TAB_LABELS above) */}
      {tab === "market" && (
        <div className="space-y-10">
          {/* Market Pricing — the eBay guide price and Google
              cross-reference used to sit here as two separate banners;
              combined into one card since they're answering the same
              question ("what's this actually worth?") from two
              different real sources, not two different concerns. */}
          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Market Pricing" />
            <div className="space-y-4">
              <div>
                <p className="text-white/60 text-sm mb-1">eBay Dealer Comps</p>
                <p className="text-white/80 text-sm">
                  {ebayComps
                    ? (() => {
                        const qualifiers = [
                          ebayComps.yearFiltered ? "same year" : null,
                          ebayComps.mileageFiltered ? "mileage-comparable" : null,
                        ].filter((q): q is string => q !== null);
                        // A single real listing has no real "range" — a
                        // literal "£1,895 – £1,895" range with an
                        // identical average was confirmed live on the
                        // Fiat 500 (1 listing survived filtering), which
                        // just looks like a display bug even though the
                        // underlying number is genuinely correct.
                        const priceText =
                          ebayComps.soldCount === 1
                            ? `Guide price £${ebayComps.average.toLocaleString()}`
                            : `Guide price £${ebayComps.lowest.toLocaleString()} – £${ebayComps.highest.toLocaleString()} (avg £${ebayComps.average.toLocaleString()})`;
                        return `${priceText} — from ${ebayComps.soldCount} real eBay dealer listing${ebayComps.soldCount === 1 ? " (a single comp — treat as a rough steer, not a confident range)" : "s"}${qualifiers.length ? ` (${qualifiers.join(", ")})` : " (year/mileage unconfirmed from listing titles)"}. These are asking prices a seller set to sell quickly, not confirmed sale prices — real retail value may run higher.`;
                      })()
                    : ebayChecked
                    ? "No eBay dealer price comparison is available for this car: no comparable dealer listings were found for this year and model."
                    : "Checking eBay dealer listings…"}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                  <p className="text-white/60 text-sm">Google Dealer/Comparison Sites</p>
                  <button
                    onClick={handleCheckGooglePrices}
                    disabled={googleGuideStatus === "loading"}
                    className="px-3 py-1.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50 hover:bg-blue-500/30 text-xs font-semibold disabled:opacity-50"
                  >
                    {googleGuideStatus === "loading" ? "Checking…" : "Check Google Dealer Prices"}
                  </button>
                </div>
                {googleGuide && (
                  <p className="text-white/80 text-sm">
                    {googleGuide.sourceCount === 1
                      ? `Guide price £${googleGuide.average.toLocaleString()}`
                      : `Guide price £${googleGuide.lowest.toLocaleString()} – £${googleGuide.highest.toLocaleString()} (avg £${googleGuide.average.toLocaleString()})`}
                    {" "}— from {googleGuide.sourceCount} real price mention{googleGuide.sourceCount === 1 ? " (a single mention — treat as a rough steer, not a confident range)" : "s"}
                    {googleGuide.sources.length ? ` across ${googleGuide.sources.join(", ")}` : ""}.
                  </p>
                )}
                {googleGuideStatus === "not-found" && (
                  <p className="text-white/50 text-sm">No usable dealer price mentions found for this search.</p>
                )}
                {googleGuideStatus === "idle" && !googleGuide && (
                  <p className="text-white/60 text-sm">AutoTrader, Cazoo, AutoUncle, Parkers and others — click to cross-reference.</p>
                )}
              </div>
            </div>
          </SupernovaGlowCard>
        </div>
      )}

      {/* COSTS TAB */}
      {tab === "costs" && <CostsTab vehicleId={vehicleId} />}

      {/* PROFIT TAB */}
      {tab === "profit" && (
        <ProfitTab
          vehicleId={vehicleId}
          purchasePrice={purchasePrice}
          expectedSale={salePrice}
        />
      )}

      {/* EDIT TAB */}
      {tab === "edit" && <EditVehicle vehicleId={vehicleId} />}

      {/* PHOTO LIGHTBOX */}
      {lightboxIndex !== null && vehicle.images && vehicle.images[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
          >
            &times;
          </button>

          {vehicle.images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => (i === null ? null : (i - 1 + vehicle.images!.length) % vehicle.images!.length));
              }}
              className="absolute left-4 text-white/70 hover:text-white text-4xl leading-none px-2"
            >
              &#8249;
            </button>
          )}

          <img
            src={vehicle.images[lightboxIndex]}
            alt={`${vehicle.make} ${vehicle.model} — photo ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />

          {vehicle.images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => (i === null ? null : (i + 1) % vehicle.images!.length));
              }}
              className="absolute right-4 text-white/70 hover:text-white text-4xl leading-none px-2"
            >
              &#8250;
            </button>
          )}

          <span className="absolute bottom-4 text-white/60 text-sm">
            {lightboxIndex + 1} / {vehicle.images.length}
          </span>
        </div>
      )}
    </div>
  );
}
