import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCamera, FiSearch } from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import PageHeader from "@/components/PageHeader";
import { getUlezStatus } from "@/features/vehicles/utils/ulezUtils";
import type { Vehicle } from "@/types/Vehicle";

import {
  SORT_LABELS,
  ageBand,
  daysInStock,
  filterAndSort,
  formatMileage,
  formatPrice,
  isSold,
  motState,
  prettyStatus,
  registrationOf,
  shownPrice,
  statusCounts,
  vehicleTitle,
  type MotState,
  type SortKey,
  type StatusFilter,
} from "./vehicleListModel";

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: "in-stock", label: "In stock" },
  { key: "sold", label: "Sold" },
  { key: "all", label: "All" },
];

const pill = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";

function statusPillClass(v: Vehicle): string {
  const s = String(v.status ?? "").trim().toLowerCase();
  if (s === "sold") return "bg-blue-500/15 text-blue-200 border-blue-400/40";
  if (s === "new") return "bg-purple-500/15 text-purple-200 border-purple-400/40";
  if (s === "in stock") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/40";
  return "bg-slate-500/20 text-slate-200 border-slate-400/40";
}

const MOT_PILL: Record<MotState["kind"], string> = {
  expired: "bg-red-500/15 text-red-200 border-red-400/50",
  soon: "bg-amber-500/15 text-amber-200 border-amber-400/50",
  valid: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
  unknown: "bg-slate-500/20 text-slate-200 border-slate-400/40",
};

const AGE_TEXT = {
  fresh: "text-white/70",
  ageing: "text-amber-300",
  old: "text-red-300 font-semibold",
} as const;

function Thumb({ v }: { v: Vehicle }) {
  const src = v.images?.[0];
  const count = v.images?.length ?? 0;
  const box = "shrink-0 h-[66px] w-[88px] sm:h-[78px] sm:w-[104px] rounded-lg";

  if (!src) {
    return (
      <div aria-hidden="true" className={`${box} grid place-items-center border border-white/10 bg-black/40 text-white/60`}>
        <div className="flex flex-col items-center gap-0.5">
          <FiCamera size={18} />
          <span className="text-[10px]">No photo</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`${box} relative overflow-hidden bg-black/40`}>
      {/* Decorative: the car's name sits right beside it as a link. */}
      <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      {count > 1 && (
        <span className="absolute bottom-1 right-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {count} photos
        </span>
      )}
    </div>
  );
}

function VehicleRow({ v, first, now }: { v: Vehicle; first: boolean; now: Date }) {
  const title = vehicleTitle(v);
  const reg = registrationOf(v);
  const mileage = formatMileage(v.mileage);
  const price = shownPrice(v);
  const priceText = formatPrice(price.amount);
  const sold = isSold(v);
  const days = sold ? null : daysInStock(v.createdAt, now);
  const mot = motState(v.mot?.expiry, now);
  const ulez = getUlezStatus(v.mot?.fuelType, v.mot?.euroStatus);

  const meta = [v.year ? String(v.year) : null, mileage].filter((part): part is string => part !== null);

  return (
    <li className="relative rounded-xl border border-white/10 bg-black/40 p-3 transition hover:border-yellow-400/50 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <Thumb v={v} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              {/* A stretched link: the whole card opens the vehicle. The
                  buttons below sit above it (z-10) so they still work. */}
              <h2 className="truncate text-base font-bold text-yellow-300 sm:text-lg">
                <Link
                  to={`/dealer/inventory/${v.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {title}
                </Link>
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
                {reg && (
                  <span className="rounded bg-yellow-300 px-1.5 py-px font-mono text-xs font-bold tracking-wide text-black">
                    {reg}
                  </span>
                )}
                {meta.length > 0 && <span>{meta.join(" · ")}</span>}
              </p>
            </div>

            <div className="text-right">
              <p className={`text-lg font-bold ${priceText ? "text-white" : "text-white/60"}`}>
                {priceText ?? "No price set"}
              </p>
              <p className="text-xs text-white/70">
                {priceText ? price.label : ""}
                {days !== null && (
                  <span className={AGE_TEXT[ageBand(days)]}>
                    {priceText ? " · " : ""}
                    {days === 0 ? "added today" : `${days} day${days === 1 ? "" : "s"} in stock`}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`${pill} ${statusPillClass(v)}`}>{prettyStatus(v.status)}</span>
            <span className={`${pill} ${MOT_PILL[mot.kind]}`}>
              {mot.label}
              {mot.date ? ` · ${mot.date}` : ""}
            </span>
            {ulez.status === "compliant" && (
              <span className={`${pill} bg-emerald-500/15 text-emerald-200 border-emerald-400/40`}>ULEZ compliant</span>
            )}
            {ulez.status === "non-compliant" && (
              <span className={`${pill} bg-red-500/15 text-red-200 border-red-400/50`}>Not ULEZ compliant</span>
            )}

            <div
              className="relative z-10 flex gap-2 sm:ml-auto"
              {...(first ? { "data-tour": "tour-vehicle-list-buttons" } : {})}
            >
              <Link
                to={`/dealer/inventory/${v.id}`}
                className="inline-flex items-center rounded-lg bg-yellow-400 px-4 py-1.5 text-sm font-bold text-black transition hover:bg-yellow-300"
              >
                Overview
              </Link>
              <Link
                to={`/dealer/workflow/mot/${v.id}`}
                className="inline-flex items-center rounded-lg border border-yellow-400/70 px-4 py-1.5 text-sm font-semibold text-yellow-200 transition hover:bg-white/10"
              >
                MOT
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function LoadingRows() {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Loading your vehicles">
      {[0, 1, 2].map(n => (
        <li key={n} className="h-[112px] animate-pulse rounded-xl border border-white/10 bg-black/30" />
      ))}
    </ul>
  );
}

export default function VehicleList() {
  const { vehicles, loading } = useInventory();

  const [query, setQuery] = useState("");
  const [chosenStatus, setChosenStatus] = useState<StatusFilter | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");

  // A moment fixed for this visit, so "days in stock" and MOT states don't
  // flicker as the list re-renders.
  const now = useMemo(() => new Date(), []);

  const counts = statusCounts(vehicles);
  // Until they pick a filter, show what needs selling: everything unsold. A
  // dealership whose every car is sold sees them all instead of an empty page.
  const status: StatusFilter = chosenStatus ?? (counts["in-stock"] > 0 ? "in-stock" : "all");

  const shown = useMemo(() => filterAndSort(vehicles, { query, status, sort }), [vehicles, query, status, sort]);

  const hasVehicles = vehicles.length > 0;
  const searching = query.trim() !== "";

  return (
    <div className="animate-fadeIn text-white">
      <PageHeader
        tourId="tour-vehicle-list"
        title="Vehicle list"
        subtitle={
          hasVehicles
            ? `${counts["in-stock"]} in stock · ${counts.sold} sold`
            : "Everything you're selling, in one place."
        }
        actions={
          <>
            <Link
              to="/new-flip"
              className="inline-flex items-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300"
            >
              Add vehicle
            </Link>
            {/* Bulk CSV import is a desk job, so it steps aside on a phone. */}
            <Link
              to="/import"
              className="hidden items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 sm:inline-flex"
            >
              Import from CSV
            </Link>
          </>
        }
      />

      {loading && !hasVehicles ? (
        <LoadingRows />
      ) : !hasVehicles ? (
        <div className="rounded-xl border border-white/10 bg-black/40 p-8 text-center">
          <p className="text-lg font-semibold text-white">No vehicles yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/70">
            Add your first car and it will show up here, with its price, days in stock and MOT at a glance.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/new-flip" className="inline-flex items-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">
              Add a vehicle
            </Link>
            <Link to="/import" className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10">
              Import from CSV
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="relative block min-w-[12rem] flex-1">
              <span className="sr-only">Search vehicles</span>
              <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search make, model or registration"
                className="w-full rounded-lg border border-white/25 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/60"
              />
            </label>

            <div role="group" aria-label="Show" className="flex gap-2">
              {STATUS_CHIPS.map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={status === chip.key}
                  onClick={() => setChosenStatus(chip.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    status === chip.key ? "bg-yellow-400 text-black" : "bg-white/10 text-white/85 hover:bg-white/20"
                  }`}
                >
                  {chip.label} ({counts[chip.key]})
                </button>
              ))}
            </div>

          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-white/70" aria-live="polite">
              {searching || shown.length !== counts[status]
                ? `Showing ${shown.length} of ${counts[status]} vehicle${counts[status] === 1 ? "" : "s"}`
                : `${shown.length} vehicle${shown.length === 1 ? "" : "s"}`}
            </p>

            <label className="flex items-center gap-2 text-sm text-white/75">
              <span>Sort</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-white/25 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-6 text-center">
              <p className="font-semibold text-white">
                {searching ? `No vehicles match "${query.trim()}"` : status === "sold" ? "No sold vehicles yet" : "Nothing here"}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {searching && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
                  >
                    Clear search
                  </button>
                )}
                {status !== "all" && (
                  <button
                    type="button"
                    onClick={() => setChosenStatus("all")}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
                  >
                    Show all vehicles
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {shown.map((v, i) => (
                <VehicleRow key={v.id} v={v} first={i === 0} now={now} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
