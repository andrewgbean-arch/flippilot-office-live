import React from "react";
import { Link } from "react-router-dom";
import SupernovaCard from "@/components/SupernovaCard";
import PageHeader from "@/components/PageHeader";

import { FiAlertTriangle, FiClock, FiHelpCircle, FiList, FiCalendar } from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import { computeRiskModel, MANY_ADVISORIES } from "./riskModel";
import { plural } from "./stockFacts";

// How many flagged cars to list before saying "and N more".
const ROWS_SHOWN = 25;

// Every figure here is a number of cars, worked out from the MOT dates,
// advisories and dates added the dealer's records hold. It used to show
// percentages ("Overall Risk", "MOT Risk", "Market Volatility", "Stock
// Stability"): Market Volatility was 50% for every dealer because it read a
// demand figure no car carries, and Stock Stability was just 100 minus
// Overall Risk.
export default function DealerRiskHub() {
  const { vehicles, loading } = useInventory();

  const m = computeRiskModel(vehicles, new Date());

  // "Loading" is only for the first fetch. A dealer with no cars used to be
  // stuck on it for ever, because the risk figures waited on a flag that
  // never cleared when there was nothing to score.
  const firstLoad = loading && vehicles.length === 0;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto animate-fadeIn">
      <PageHeader
        title="Risk hub"
        subtitle={`What could hold your stock back, counted from your ${plural(m.inStock, "unsold vehicle")}: MOT dates, MOT advisories and how long each car has been here. Each figure is a number of cars, not a score.`}
      />

      {firstLoad ? (
        <p role="status" className="text-white/60">Loading your stock…</p>
      ) : m.inStock === 0 ? (
        <SupernovaCard title="Nothing to check yet" accent="red">
          <p className="text-white/60">
            You have no unsold vehicles. Add one and its MOT position, advisories and time in stock will be counted here.
          </p>
        </SupernovaCard>
      ) : (
        <>
          <SupernovaCard title="MOT position" subtitle="From the expiry date recorded on each unsold car." accent="red">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white/70">
              <div>
                <div className="flex items-center gap-2 text-red-400 font-semibold">
                  <FiAlertTriangle aria-hidden="true" /> MOT expired
                </div>
                <p className="mt-1 text-2xl text-white">{m.mot.expired}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <FiClock aria-hidden="true" /> Due within 30 days
                </div>
                <p className="mt-1 text-2xl text-white">{m.mot.dueSoon}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-blue-300 font-semibold">
                  <FiHelpCircle aria-hidden="true" /> No MOT date recorded
                </div>
                <p className="mt-1 text-2xl text-white">{m.mot.noDate}</p>
                <p className="text-white/50 text-xs mt-1">Their MOT position is unknown.</p>
              </div>
            </div>
          </SupernovaCard>

          <SupernovaCard title="Other things to watch" accent="gold">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white/70">
              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiList aria-hidden="true" /> {MANY_ADVISORIES} or more MOT advisories
                </div>
                <p className="mt-1 text-2xl text-white">{m.manyAdvisories}</p>
                <p className="text-white/50 text-xs mt-1">Advisories on each car&apos;s current MOT.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiCalendar aria-hidden="true" /> In stock 90 days or more
                </div>
                <p className="mt-1 text-2xl text-white">{m.ageing}</p>
                <p className="text-white/50 text-xs mt-1">
                  {m.ageUnknown === 0
                    ? "From the date each car was added."
                    : `From the date each car was added. ${plural(m.ageUnknown, "car")} with no date added ${m.ageUnknown === 1 ? "is" : "are"} not counted.`}
                </p>
              </div>
            </div>
          </SupernovaCard>

          <SupernovaCard
            title="Cars to look at"
            subtitle="Every unsold car with at least one of the flags above, most urgent first."
            accent="blue"
          >
            {m.rows.length === 0 ? (
              <p className="text-white/60">No car is flagged right now.</p>
            ) : (
              <ul className="space-y-3">
                {m.rows.slice(0, ROWS_SHOWN).map((row) => (
                  <li
                    key={row.id}
                    className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
                  >
                    <div className="text-yellow-400 font-semibold text-lg">
                      <Link to={`/dealer/inventory/${row.id}`} className="hover:underline">
                        {row.title}
                      </Link>
                      {row.reg && <span className="text-white/60 font-normal text-sm"> · {row.reg}</span>}
                    </div>
                    <p className="text-white/70 text-sm mt-1">{row.flags.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
            {m.rows.length > ROWS_SHOWN && (
              <p className="text-white/60 text-sm">and {m.rows.length - ROWS_SHOWN} more</p>
            )}
          </SupernovaCard>
        </>
      )}
    </div>
  );
}
