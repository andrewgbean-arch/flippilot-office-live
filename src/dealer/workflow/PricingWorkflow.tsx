import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { registrationOf, vehicleTitle } from "@/dealer/inventory/vehicleListModel";
import { formatMoney, plural } from "@/dealer/intelligence/stockFacts";

import PageHeader from "@/components/PageHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";
import { computePricingFacts } from "./pricingFacts";
import { useAuth } from "@/context/AuthContext";
import { canSeeMoney } from "@/lib/permissions";

// One row of "label ... value".
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-white/10 py-3 last:border-b-0">
      <dt className="text-white/70">{label}</dt>
      <dd className="text-right text-white font-semibold">{children}</dd>
    </div>
  );
}

// What this car cost and what it is priced at, from the dealer's own records.
// The screen used to be an "AI Valuation Engine": a retail value of purchase
// price x 1.35, a trade value of x 1.15, made-up "market heat", "demand" and
// "days to sell" bars, and a profit projection built on those values. None of
// it came from a market, so all of it is gone. It also used to say "Vehicle
// Not Found" for any car with no Bookkeeping purchase; now it shows what
// exists and says what is missing.
export default function PricingWorkflow() {
  // Recon is a money page (its costs go in the books): owner, managers, finance.
  const canRecon = canSeeMoney(useAuth().user);
  const { id } = useParams();
  const vehicleId = id as string;
  const navigate = useNavigate();

  const { vehicles, loading } = useInventory();
  const { costs, purchases, sales } = useBookkeeping();

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!vehicle) {
    return (
      <div className="px-6 py-10 text-white">
        {loading ? (
          <p role="status" className="text-white/60">Loading your stock…</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-red-400">Vehicle not found</h1>
            <p className="text-white/60 mt-2">
              This vehicle is not in your stock.{" "}
              <Link to="/dealer/inventory/list" className="text-yellow-300 underline underline-offset-2">
                Back to the vehicle list
              </Link>
              .
            </p>
          </>
        )}
      </div>
    );
  }

  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);
  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicleId);

  const f = computePricingFacts(vehicle, purchase, vehicleCosts, sale, new Date());
  const reg = registrationOf(vehicle);

  return (
    <div className="px-6 py-10 space-y-10 text-white animate-fadeIn">
      <PageHeader
        title="Pricing workflow"
        subtitle={`${vehicleTitle(vehicle)}${reg ? ` · ${reg}` : ""}`}
        actions={
          <Link to={`/dealer/inventory/${vehicleId}`} className="text-yellow-300 underline underline-offset-2 text-sm">
            Open the vehicle
          </Link>
        }
      />

      <SupernovaSectionDivider label="Your price and your costs" />

      <SupernovaGlowCard>
        <dl>
          <Row label="Your asking price">{f.asking === null ? <span className="text-white/60">Not entered</span> : formatMoney(f.asking)}</Row>

          {/* What it cost, the costs and the margin come from the books: the
              owner, managers and finance. Everyone else is told who has them,
              not shown "Not recorded" and "£0" for figures that do exist. */}
          {!canRecon ? (
            <Row label="Costs and margin">
              <span className="text-white/60">For the owner, managers and finance.</span>
            </Row>
          ) : (
          <>
          <Row label="What it cost">
            {f.cost === null ? (
              <span className="text-white/60">
                Not recorded.{" "}
                <Link to="/bookkeeping/add-purchase" className="text-yellow-300 underline underline-offset-2">
                  Add the purchase
                </Link>
              </span>
            ) : (
              <>
                {formatMoney(f.cost.amount)}
                <span className="block text-xs font-normal text-white/50">
                  {f.cost.source === "purchase" ? "From your Bookkeeping purchase" : "The trade price on the vehicle record (no purchase in Bookkeeping)"}
                </span>
              </>
            )}
          </Row>

          <Row label="Costs logged against it">
            {formatMoney(f.costsLogged)}
            <span className="block text-xs font-normal text-white/50">
              {f.costsCount === 0 ? "Nothing logged yet" : `${plural(f.costsCount, "item")} in Bookkeeping`}
            </span>
          </Row>

          <Row label="Total cost so far">
            {f.totalCost === null ? <span className="text-white/60">Needs the buying price</span> : formatMoney(f.totalCost)}
          </Row>

          <Row label="Margin at your asking price">
            {f.margin === null ? (
              <span className="text-white/60">Needs an asking price and a buying price</span>
            ) : (
              <>
                <span className={f.margin < 0 ? "text-red-400" : "text-green-400"}>{formatMoney(f.margin)}</span>
                {f.marginPercent !== null && (
                  <span className="block text-xs font-normal text-white/50">{f.marginPercent}% of the asking price</span>
                )}
              </>
            )}
          </Row>

          </>
          )}

          {f.daysInStock !== null && (
            <Row label="In stock for">{plural(f.daysInStock, "day")}</Row>
          )}

          {f.sale && canRecon && (
            <Row label="Sold for">
              {formatMoney(f.sale.price)}
              {f.saleProfit !== null && (
                <span className={`block text-xs font-normal ${f.saleProfit < 0 ? "text-red-400" : "text-green-400"}`}>
                  Profit {formatMoney(f.saleProfit)} after costs
                </span>
              )}
            </Row>
          )}
        </dl>

        <p className="mt-4 text-sm text-white/50">
          This is arithmetic on the prices and costs you have entered, before VAT and before any cost you have not
          logged. It is not a valuation: for what similar cars are listed at, see the Market pricing tab on the car's page.
        </p>
      </SupernovaGlowCard>

      {/* WORKFLOW BUTTONS */}
      <SupernovaSectionDivider label="Next Steps" />

      <div className="flex flex-wrap gap-4">
        {canRecon && (
          <SupernovaGlowButton
            label="Recon Workflow"
            onClick={() => navigate(`/dealer/workflow/recon/${vehicleId}`)}
          />
        )}

        <SupernovaGlowButton
          label="Photos Workflow"
          onClick={() => navigate(`/dealer/workflow/photos/${vehicleId}`)}
        />

        <SupernovaGlowButton
          label="MOT Workflow"
          onClick={() => navigate(`/dealer/workflow/mot/${vehicleId}`)}
        />
      </div>
    </div>
  );
}
