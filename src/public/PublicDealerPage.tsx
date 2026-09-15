import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import {
  loadPublicDealerInfo,
  loadPublicVehicles,
  loadPublicBookingSettings,
  type PublicDealerInfo,
  type PublicVehicle,
} from "./publicBookingApi";

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

  const featuredStock = [...vehicles]
    .filter((v) => (v.priceRetail ?? 0) > 0)
    .sort((a, b) => (b.priceRetail ?? 0) - (a.priceRetail ?? 0))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-black animate-fadeIn relative z-10 px-6 py-10 max-w-6xl mx-auto">
      <SupernovaHeroHeader
        title={info.name}
        subtitle="Vehicles for sale — get in touch to book a viewing or test drive."
      />

      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Contact</h2>
      </SupernovaSectionDivider>

      <SupernovaGlowCard>
        <div className="text-white/70 space-y-3">
          <p><span className="text-gold font-semibold">Location:</span> {info.address ?? "Contact us for details"}</p>
          <p><span className="text-gold font-semibold">Phone:</span> {info.phone ?? "Contact us for details"}</p>
          <a
            href={`/book/${dealershipId}`}
            className="inline-block mt-2 px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400"
          >
            Book a Viewing or Test Drive
          </a>
        </div>
      </SupernovaGlowCard>

      {bookingSettings && (
        <>
          <SupernovaSectionDivider>
            <h2 className="text-2xl font-bold text-yellow-400">Opening Hours</h2>
          </SupernovaSectionDivider>

          <SupernovaGlowCard>
            <ul className="text-white/70 space-y-2">
              {WEEK_DAYS.map(({ key, label }) => (
                <li key={key} className="flex justify-between">
                  <span>{label}</span>
                  <span className="text-gold">
                    {bookingSettings.openDays.includes(key)
                      ? `${bookingSettings.openTime} – ${bookingSettings.closeTime}`
                      : "Closed"}
                  </span>
                </li>
              ))}
            </ul>
          </SupernovaGlowCard>
        </>
      )}

      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Vehicles For Sale</h2>
        <p className="text-white/60">{vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} in stock</p>
      </SupernovaSectionDivider>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {featuredStock.length === 0 ? (
          <p className="text-white/60">No vehicles listed yet — check back soon.</p>
        ) : (
          featuredStock.map((v) => (
            <SupernovaGlowCard key={v.id}>
              <h3 className="text-yellow-400 font-bold text-xl mb-2">
                {v.make} {v.model}
              </h3>
              <p className="text-white/60 text-sm mb-1">
                {[v.year, v.mileage != null ? `${v.mileage.toLocaleString()} miles` : null, v.colour]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-white/70">
                <span className="text-gold font-semibold">£{(v.priceRetail ?? 0).toLocaleString()}</span>
              </p>
            </SupernovaGlowCard>
          ))
        )}
      </section>
    </div>
  );
}
