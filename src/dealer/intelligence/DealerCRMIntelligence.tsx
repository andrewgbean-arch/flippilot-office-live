import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import SupernovaCard from "@/components/SupernovaCard";
import PageHeader from "@/components/PageHeader";
import { useLeads } from "@/context/LeadsContext";

import { FiMail, FiUsers, FiCheckCircle, FiXCircle, FiInbox } from "react-icons/fi";

import { summariseLeads } from "./leadSummary";
import { plural } from "./stockFacts";

// The lead summary (this file keeps its old name because the router imports
// it). Every figure is counted from the leads the dealership has recorded.
// It used to show an "Engagement", "Conversion Chance" and "Risk" percentage
// per lead, read from a table of guesses per pipeline stage, and told staff
// that leads like this "convert 3x more often within 48 hours". Nothing in
// the app measures any of that, so the percentages and the sentence are gone.
export default function DealerCRMIntelligence() {
  const { leads, loading } = useLeads();

  // Whole-day ages depend on the clock, so this is worked out when the leads
  // change, not on every render.
  const summary = useMemo(() => summariseLeads(leads, new Date()), [leads]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto animate-fadeIn">
      <PageHeader
        title="Lead summary"
        subtitle="Where your leads stand: by stage, by source and by how long ago they were added. Every figure is counted from the leads you have recorded."
      />

      {loading && leads.length === 0 ? (
        <p role="status" className="text-white/60">Loading your leads…</p>
      ) : summary.total === 0 ? (
        <SupernovaCard title="No leads yet" accent="gold">
          <p className="text-white/60 text-sm">
            Once you have recorded some leads they are counted here.{" "}
            <Link to="/dealer/sales/add" className="text-yellow-300 underline underline-offset-2">
              Add a lead
            </Link>
            .
          </p>
        </SupernovaCard>
      ) : (
        <>
          <SupernovaCard title="Leads at a glance" accent="gold">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-white/70">
              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiUsers aria-hidden="true" /> All leads
                </div>
                <p className="mt-1 text-2xl text-white">{summary.total}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-blue-300 font-semibold">
                  <FiInbox aria-hidden="true" /> Still open
                </div>
                <p className="mt-1 text-2xl text-white">{summary.open}</p>
                <p className="text-white/50 text-xs mt-1">Not yet won or lost.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-green-400 font-semibold">
                  <FiCheckCircle aria-hidden="true" /> Won
                </div>
                <p className="mt-1 text-2xl text-white">{summary.won}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-red-400 font-semibold">
                  <FiXCircle aria-hidden="true" /> Lost
                </div>
                <p className="mt-1 text-2xl text-white">{summary.lost}</p>
              </div>
            </div>
          </SupernovaCard>

          <SupernovaCard title="Leads by stage" subtitle="How many leads are at each stage of your pipeline." accent="blue">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white/70">
              {summary.byStatus.map((s) => (
                <div key={s.status} className="p-3 rounded-lg bg-black/40 border border-white/10">
                  <p className="text-sm">{s.label}</p>
                  <p className="text-xl text-white font-semibold">{s.count}</p>
                </div>
              ))}
            </div>
          </SupernovaCard>

          <SupernovaCard
            title="Lead sources"
            subtitle="Where your leads came from, by number of leads. 'Won' is how many of that source's leads ended in a sale."
            accent="blue"
          >
            <div className="space-y-4">
              {summary.bySource.map((s) => (
                <div
                  key={s.source}
                  className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
                >
                  <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                    <FiMail aria-hidden="true" /> {s.source}
                  </div>
                  <p className="text-white/70 mt-1">
                    {plural(s.total, "lead")}, {s.won} won
                  </p>
                </div>
              ))}
            </div>
          </SupernovaCard>

          <SupernovaCard
            title="Open leads by age"
            subtitle="How long ago each open lead was added. This counts from the day it was added, not from your last contact."
            accent="red"
          >
            {summary.open === 0 ? (
              <p className="text-white/60 text-sm">No open leads: every lead is won or lost.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white/70">
                  {summary.openByAge
                    .filter((b) => b.key !== "unknown" || b.count > 0)
                    .map((b) => (
                      <div key={b.key} className="p-3 rounded-lg bg-black/40 border border-white/10">
                        <p className="text-sm">{b.label}</p>
                        <p className="text-xl text-white font-semibold">{b.count}</p>
                      </div>
                    ))}
                </div>

                <h3 className="text-white font-semibold mt-6">Waiting longest</h3>
                <ul className="space-y-3 mt-2">
                  {summary.oldestOpen.map((row) => (
                    <li
                      key={row.id}
                      className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
                    >
                      <div className="text-yellow-400 font-semibold text-lg">
                        <Link to={`/dealer/sales/leads/${row.id}`} className="hover:underline">
                          {row.name}
                        </Link>
                      </div>
                      <p className="text-white/70 text-sm mt-1">
                        {row.statusLabel}
                        {" · "}
                        {row.days === null ? "no date recorded" : `added ${plural(row.days, "day")} ago`}
                      </p>
                    </li>
                  ))}
                </ul>
                {summary.open > summary.oldestOpen.length && (
                  <p className="text-white/60 text-sm">
                    and {summary.open - summary.oldestOpen.length} more open leads. The Leads dashboard lists every one.
                  </p>
                )}
              </>
            )}
          </SupernovaCard>
        </>
      )}
    </div>
  );
}
