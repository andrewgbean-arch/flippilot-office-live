import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiCircle, FiFlag } from "react-icons/fi";
import SupernovaCard from "@/components/SupernovaCard";
import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useAppointments } from "@/context/AppointmentsContext";
import { useAuth } from "@/context/AuthContext";
import { fetchDecisions } from "@/lib/decisionsApi";
import { canUseDecisions } from "@/pilotbrain/decisions/decisionFormat";
import { dismissGettingStarted, gettingStartedComplete, gettingStartedItems, isGettingStartedDismissed } from "./gettingStarted";
import { canSeeMoney } from "@/lib/permissions";

// "Getting started": the four things a new dealership does so Pilot Brain
// has something real to work with. Each line ticks itself off from the real
// records and links to where it is done. Gone by itself once all four are
// done, or hidden by hand for this person on this browser.
export default function GettingStartedCard() {
  const { vehicles } = useInventory();
  const { sales } = useBookkeeping();
  const { appointments } = useAppointments();
  const { user } = useAuth();

  const allowed = canUseDecisions(user);
  const [decisionsTotal, setDecisionsTotal] = useState<number | null>(null);
  useEffect(() => {
    // Owners and managers only: the journal answers 403 to everyone else,
    // so nobody else pays for a request that can only fail.
    if (!allowed) return;
    let live = true;
    fetchDecisions().then(result => {
      if (live && result.ok) setDecisionsTotal(result.stats.total);
    });
    return () => {
      live = false;
    };
  }, [allowed]);

  const [dismissed, setDismissed] = useState(() => isGettingStartedDismissed(user?.id));

  const items = gettingStartedItems({
    vehicles: vehicles ?? [],
    sales,
    appointments,
    decisionsTotal,
    canUseDecisions: allowed,
    canSeeMoney: canSeeMoney(user),
    now: new Date(),
  });
  if (dismissed || gettingStartedComplete(items)) return null;

  const doneCount = items.filter(i => i.done).length;

  return (
    <div data-tour="tour-getting-started">
    <SupernovaCard
      title="Getting started"
      icon={<FiFlag />}
      accent="gold"
      subtitle={`${doneCount} of ${items.length} done. Each one makes Pilot Brain more useful.`}
      footer={
        <button
          type="button"
          onClick={() => {
            dismissGettingStarted(user?.id);
            setDismissed(true);
          }}
          className="text-xs text-white/50 hover:text-white/80 underline"
        >
          Hide this
        </button>
      }
    >
      <ul className="space-y-2" data-testid="getting-started-list">
        {items.map(item => (
          <li key={item.key}>
            <Link
              to={item.to}
              className={`flex items-start gap-3 rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-white/5 ${item.done ? "opacity-70" : ""}`}
            >
              <span className={`mt-0.5 text-lg ${item.done ? "text-green-300" : "text-gold"}`} aria-hidden="true">
                {item.done ? <FiCheckCircle /> : <FiCircle />}
              </span>
              <span>
                <span className={`block font-semibold ${item.done ? "text-white/70 line-through" : "text-white"}`}>{item.title}</span>
                <span className="block text-xs text-white/55">{item.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SupernovaCard>
    </div>
  );
}
