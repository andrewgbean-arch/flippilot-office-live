import React from "react";
import { Link } from "react-router-dom";
import SupernovaCard from "@/components/SupernovaCard";
import PageHeader from "@/components/PageHeader";

import {
  FiTruck,
  FiClock,
  FiAlertTriangle,
  FiDollarSign,
  FiList,
  FiPercent,
} from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import { computeMotorsModel } from "./motorsModel";
import { formatMoney, plural } from "./stockFacts";
import { useAuth } from "@/context/AuthContext";
import { canSeeMoney } from "@/lib/permissions";

// How many "no MOT date" cars to name before saying "and N more".
const NO_DATE_NAMES = 12;

// Every figure here is counted from the cars and prices the dealer has
// entered, for cars that have not been sold. This screen used to average a
// "FlipScore" (capped at 50 because most of its inputs were never supplied),
// add sold cars into "Total Valuation", and print "vehicles with MOT under 30
// days show 2x higher risk of price suppression" on every card, a statistic
// with no source.
export default function DealerMotorsDashboard() {
  // Trade prices only reach the owner, managers and finance.
  const money = canSeeMoney(useAuth().user);
  const { vehicles, loading } = useInventory();

  const m = computeMotorsModel(vehicles, new Date());
  const motToSort = m.mot.expired + m.mot.dueSoon;

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto animate-fadeIn">
      <PageHeader
        title="Motors dashboard"
        subtitle="Your unsold stock: asking prices, MOT dates and makes. Every figure is counted from the cars and prices you have entered."
      />

      {loading && vehicles.length === 0 ? (
        <p role="status" className="text-white/60">Loading your stock…</p>
      ) : m.inStock === 0 ? (
        <SupernovaCard title="No vehicles in stock" accent="gold">
          <p className="text-white/60 text-sm">
            Add a vehicle and its asking price, MOT date and make will be counted here.
          </p>
        </SupernovaCard>
      ) : (
        <>
          <SupernovaCard title="Stock overview" accent="gold">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white/70">
              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiTruck aria-hidden="true" /> Cars in stock
                </div>
                <p className="mt-1">{m.inStock}</p>
                <p className="text-white/50 text-xs mt-1">Sold cars are not counted.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiDollarSign aria-hidden="true" /> Stock at asking price
                </div>
                <p className="mt-1">{formatMoney(m.askingTotal)}</p>
                <p className="text-white/50 text-xs mt-1">
                  {m.noAsking === 0
                    ? "What your unsold cars would bring in at the prices you are asking."
                    : `${plural(m.noAsking, "car")} with no asking price entered ${m.noAsking === 1 ? "is" : "are"} left out.`}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiPercent aria-hidden="true" /> Average margin at asking price
                </div>
                <p className="mt-1">
                  {!money ? "Owner, managers and finance only" : m.marginAverage === null ? "Not enough prices entered" : `${formatMoney(m.marginAverage)} a car`}
                </p>
                <p className="text-white/50 text-xs mt-1">
                  {!money
                    ? "Worked out from trade prices, which only they are sent."
                    : m.marginAverage === null
                    ? "Needs a trade price and an asking price on at least one car."
                    : `Asking price minus trade price, over the ${plural(m.marginCounted, "car")} with both entered.`}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiAlertTriangle aria-hidden="true" /> MOT expired or due soon
                </div>
                <p className="mt-1">{motToSort}</p>
                <p className="text-white/50 text-xs mt-1">
                  {m.mot.expired} expired, {m.mot.dueSoon} due within 30 days
                  {m.mot.noDate > 0 ? `, and ${m.mot.noDate} with no MOT date` : ""}.
                </p>
              </div>
            </div>
          </SupernovaCard>

          <SupernovaCard
            title="Make breakdown"
            subtitle="How your unsold cars split by make."
            accent="blue"
          >
            {m.makes.length === 0 ? (
              <p className="text-white/50 text-sm">None of your cars has a make entered.</p>
            ) : (
              <div className="space-y-4">
                {m.makes.map(({ make, count }) => (
                  <div
                    key={make}
                    className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
                  >
                    <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                      <FiList aria-hidden="true" /> {make}
                    </div>
                    <p className="text-white/70 mt-1">{plural(count, "vehicle")}</p>
                  </div>
                ))}
              </div>
            )}
          </SupernovaCard>

          <SupernovaCard
            title="MOTs to sort"
            subtitle="Unsold cars whose MOT has expired or runs out within 30 days, soonest first."
            accent="red"
          >
            {m.motAttention.length === 0 ? (
              <p className="text-white/50 text-sm">
                {m.mot.noDate === 0
                  ? "Every unsold car has an MOT with more than 30 days left."
                  : "No car with a recorded MOT date is expired or due within 30 days."}
              </p>
            ) : (
              <div className="space-y-4">
                {m.motAttention.map((row) => (
                  <div
                    key={row.id}
                    className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
                  >
                    <div className="text-yellow-400 font-semibold text-lg">
                      <Link to={`/dealer/inventory/${row.id}`} className="hover:underline">
                        {row.title}
                      </Link>
                      {row.reg && <span className="text-white/60 font-normal text-sm"> · {row.reg}</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-white/70">
                      <div>
                        <FiClock aria-hidden="true" className="inline mr-1 text-red-400" />
                        MOT{" "}
                        <span className={`font-bold ${row.kind === "expired" ? "text-red-400" : "text-amber-300"}`}>
                          {row.timing}
                        </span>
                        {row.date && <span className="text-white/50"> ({row.date})</span>}
                      </div>

                      <div>
                        <FiDollarSign aria-hidden="true" className="inline mr-1 text-yellow-400" />
                        Asking price:{" "}
                        <span className="text-yellow-400 font-bold">
                          {row.asking === null ? "not entered" : formatMoney(row.asking)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {m.noMotDate.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <h3 className="text-white font-semibold">
                  {plural(m.noMotDate.length, "car")} with no MOT date recorded
                </h3>
                <p className="text-white/60 text-sm mt-1">
                  Their MOT position is unknown, so they are not in the list above. Open the car to add the date.
                </p>
                <p className="text-white/70 text-sm mt-2">
                  {m.noMotDate.slice(0, NO_DATE_NAMES).map((row, i) => (
                    <React.Fragment key={row.id}>
                      {i > 0 && ", "}
                      <Link to={`/dealer/inventory/${row.id}`} className="text-yellow-300 hover:underline">
                        {row.title}
                        {row.reg ? ` (${row.reg})` : ""}
                      </Link>
                    </React.Fragment>
                  ))}
                  {m.noMotDate.length > NO_DATE_NAMES && ` and ${m.noMotDate.length - NO_DATE_NAMES} more`}
                </p>
              </div>
            )}
          </SupernovaCard>

          <SupernovaCard
            title="Stock notes"
            subtitle="Counted from your own stock and MOT dates."
            accent="gold"
          >
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              {motToSort > 0 && (
                <li>
                  {plural(motToSort, "vehicle")} {motToSort === 1 ? "has" : "have"} an MOT that has expired or is due within 30 days.
                </li>
              )}
              {m.mot.noDate > 0 && (
                <li>
                  {plural(m.mot.noDate, "vehicle")} {m.mot.noDate === 1 ? "has" : "have"} no MOT date recorded.
                </li>
              )}
              {m.makes[0] && (
                <li>
                  {m.makes[0].make} is your best-stocked make, with {plural(m.makes[0].count, "vehicle")}.
                </li>
              )}
              {motToSort === 0 && m.mot.noDate === 0 && !m.makes[0] && (
                <li>Nothing stands out right now.</li>
              )}
            </ul>
          </SupernovaCard>
        </>
      )}
    </div>
  );
}
