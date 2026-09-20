import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { formatMoney } from "@/lib/formatMoney";
import {
  loadPublicDealerInfo,
  loadPublicVehicles,
  loadPublicBookingSettings,
  type PublicDealerInfo,
  type PublicVehicle,
} from "./publicBookingApi";
import WantedSection from "./WantedForm";

const WEEK_DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

// The genuinely public dealer page — reachable with no account at all,
// same trust tier as PublicBookingPage.tsx. Everything on it comes
// from the /public/:dealershipId/* routes (no auth headers anywhere in
// this file), so what a real customer sees here is exactly what those
// endpoints choose to expose — never anything more. Also rendered by
// the logged-in dealer's own /marketplace preview (via
// dealershipIdOverride), so the preview can never drift from what's
// actually public.
export default function PublicDealerPage({ dealershipIdOverride }: { dealershipIdOverride?: string } = {}) {
  const { dealershipId: paramId } = useParams();
  const dealershipId = dealershipIdOverride ?? paramId;

  const [info, setInfo] = useState<PublicDealerInfo | null>(null);
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [bookingSettings, setBookingSettings] = useState<{ openDays: string[]; openTime: string; closeTime: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [dInfo, vList, settings] = await Promise.all([
        loadPublicDealerInfo(dealershipId),
        loadPublicVehicles(dealershipId),
        loadPublicBookingSettings(dealershipId),
      ]);
      setInfo(dInfo);
      setVehicles(vList);
      setBookingSettings(settings);
      setLoading(false);
    })();
  }, [dealershipId]);

  if (!dealershipId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">No dealership specified.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">Loading…</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">This dealership page isn't available.</p>
      </div>
    );
  }

  // Every car in stock, most recently added first (new cars are appended to the
  // stock list). This used to show only the six most expensive PRICED cars while
  // the heading said "8 vehicles in stock", and silently dropped any car without
  // a price, so a customer never saw part of the forecourt.
  const stock = [...vehicles].reverse();

  const phone = info.phone?.trim() || null;
  const address = info.address?.trim() || null;

  return (
    <div className="min-h-screen bg-black animate-fadeIn relative z-10 px-4 sm:px-6 py-8 sm:py-10 max-w-6xl mx-auto text-white">
      <SupernovaHeroHeader
        title={info.name}
        subtitle="Vehicles for sale. Get in touch to book a viewing or test drive."
      />

      {/* The ways to reach the dealer come first and are short, so the cars are
          on the first screen. Location and phone only appear when the dealer has
          filled them in: the page used to print "Contact us for details" in
          their place, which told a customer nothing. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-yellow-500/30 bg-black/50 p-4">
        {phone && (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="inline-flex items-center text-white hover:text-yellow-300">
            <span className="mr-2 font-semibold text-yellow-400">Call</span>
            {phone}
          </a>
        )}
        {address && (
          <p className="text-white/80">
            <span className="mr-2 font-semibold text-yellow-400">Find us</span>
            {address}
          </p>
        )}
        <a
          href={`/book/${dealershipId}`}
          className="inline-flex items-center rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300 sm:ml-auto"
        >
          Book a viewing or test drive
        </a>
      </div>

      <h2 className="text-xl font-bold text-yellow-400">Vehicles for sale</h2>
      <p className="mb-4 text-sm text-white/70">
        {stock.length === 0 ? "No vehicles listed at the moment." : `${stock.length} vehicle${stock.length === 1 ? "" : "s"} in stock`}
      </p>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stock.length === 0 ? (
          <p className="text-white/70">No vehicles listed yet. Check back soon.</p>
        ) : (
          stock.map((v) => {
            const reg = v.reg?.trim().toUpperCase() || null;
            const priced = (v.priceRetail ?? 0) > 0;
            const facts = [v.year, v.mileage != null ? `${v.mileage.toLocaleString("en-GB")} miles` : null, v.colour]
              .filter(Boolean)
              .join(" · ");
            return (
              <SupernovaGlowCard key={v.id}>
                <h3 className="text-xl font-bold text-yellow-400">
                  {v.make} {v.model}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
                  {reg && (
                    <span className="rounded bg-yellow-300 px-1.5 py-px font-mono text-xs font-bold tracking-wide text-black">
                      {reg}
                    </span>
                  )}
                  {facts && <span>{facts}</span>}
                </p>
                <p className={`mt-3 text-2xl font-bold ${priced ? "text-white" : "text-white/70"}`}>
                  {priced ? formatMoney(v.priceRetail) : "Price on request"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.hasPassport && (
                    <a
                      href={`/car/${encodeURIComponent(dealershipId)}/${encodeURIComponent(v.id)}`}
                      className="inline-flex items-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300"
                    >
                      See full history
                    </a>
                  )}
                  <a
                    href={`/book/${dealershipId}?vehicle=${encodeURIComponent(v.id)}`}
                    className="inline-flex items-center rounded-lg border border-yellow-400/70 px-4 py-2 text-sm font-semibold text-yellow-200 hover:bg-white/10"
                  >
                    Book a viewing
                  </a>
                </div>
              </SupernovaGlowCard>
            );
          })
        )}
      </section>

      {/* On the dealer's own /marketplace preview the form is shown but switched
          off, so testing their page never creates a real customer's request. */}
      <WantedSection dealershipId={dealershipId} dealerName={info.name} dealerPhone={phone ?? undefined} preview={dealershipIdOverride !== undefined} />

      {bookingSettings && (
        <section aria-labelledby="opening-hours">
          <h2 id="opening-hours" className="mb-3 text-xl font-bold text-yellow-400">
            Opening hours
          </h2>
          <ul className="max-w-md space-y-2 rounded-xl border border-yellow-500/30 bg-black/50 p-4 text-white/80">
            {WEEK_DAYS.map(({ key, label }) => (
              <li key={key} className="flex justify-between">
                <span>{label}</span>
                <span className="text-yellow-300">
                  {bookingSettings.openDays.includes(key)
                    ? `${bookingSettings.openTime} – ${bookingSettings.closeTime}`
                    : "Closed"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
