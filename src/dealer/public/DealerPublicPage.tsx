import { useEffect, useState } from "react";
import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";
import { useDealer } from "@/context/DealerContext";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";
import { loadBookingSettings, type BookingSettings, type WeekDay } from "@/appointments/bookingSettingsStorage.web";

const WEEK_DAYS: { key: WeekDay; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

// Name/location/phone come from the real dealership (settable in
// Settings -> Edit Dealer Profile); opening hours now come from the
// real availability settings (the same ones that drive the public
// booking page); "Featured Vehicles" is your actual top-priced real
// stock, not fictional listings. Reviews are still genuinely mock
// content — there's no real review-collection system in this app yet,
// so there's nothing honest to show there. This screen itself (/marketplace)
// is a preview shown to the logged-in dealer, not a publicly reachable
// page — it previews what a real customer-facing page would look like.
export default function DealerPublicPage() {
  const { dealer: realDealer } = useDealer();
  const { user } = useAuth();
  const { vehicles } = useInventory();

  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);

  useEffect(() => {
    loadBookingSettings().then(setBookingSettings);
  }, []);

  const dealer = {
    name: realDealer?.name ?? "Your Dealership",
    tagline: "Premium vehicles. Trusted service. Local expertise.",
    location: realDealer?.address || "Address not set — add one in Settings",
    phone: realDealer?.phone || "Phone not set — add one in Settings",
    email: user?.email ?? "Email not set",
    reviews: [
      { name: "James T.", rating: 5, text: "Fantastic service, smooth purchase!" },
      { name: "Emily R.", rating: 4, text: "Friendly staff and great prices." },
      { name: "Michael L.", rating: 5, text: "Highly recommend, will be back!" },
    ],
  };

  const featuredStock = [...vehicles]
    .filter(v => (v.priceRetail ?? 0) > 0)
    .sort((a, b) => (b.priceRetail ?? 0) - (a.priceRetail ?? 0))
    .slice(0, 3);

  return (
    <div className="animate-fadeIn relative z-10 px-6 py-10 max-w-6xl mx-auto">

      {/* HERO HEADER */}
      <SupernovaHeroHeader
        title={dealer.name}
        subtitle={dealer.tagline}
      />

      {/* CONTACT INFO */}
      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Contact Information</h2>
        <p className="text-white/60">Reach out to {dealer.name}</p>
      </SupernovaSectionDivider>

      <SupernovaGlowCard>
        <div className="text-white/70 space-y-3">
          <p><span className="text-gold font-semibold">Location:</span> {dealer.location}</p>
          <p><span className="text-gold font-semibold">Phone:</span> {dealer.phone}</p>
          <p><span className="text-gold font-semibold">Email:</span> {dealer.email}</p>
        </div>
      </SupernovaGlowCard>

      {/* OPENING HOURS */}
      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Opening Hours</h2>
        <p className="text-white/60">Visit us throughout the week</p>
      </SupernovaSectionDivider>

      <SupernovaGlowCard>
        {!bookingSettings ? (
          <p className="text-white/50">Loading…</p>
        ) : (
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
        )}
      </SupernovaGlowCard>

      {/* FEATURED STOCK */}
      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Featured Vehicles</h2>
        <p className="text-white/60">Popular choices available now</p>
      </SupernovaSectionDivider>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {featuredStock.length === 0 ? (
          <p className="text-white/60">No priced vehicles in stock yet.</p>
        ) : (
          featuredStock.map((v) => (
            <SupernovaGlowCard key={v.id}>
              <h3 className="text-yellow-400 font-bold text-xl mb-2">
                {v.make} {v.model}
              </h3>
              <p className="text-white/70">
                Price: <span className="text-gold font-semibold">£{(v.priceRetail ?? 0).toLocaleString()}</span>
              </p>
            </SupernovaGlowCard>
          ))
        )}
      </section>

      {/* REVIEWS */}
      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Customer Reviews</h2>
        <p className="text-white/60">Example reviews — real review collection isn't built yet</p>
      </SupernovaSectionDivider>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {dealer.reviews.map((rev, i) => (
          <SupernovaGlowCard key={i}>
            <h3 className="text-red-400 font-bold text-xl mb-2">{rev.name}</h3>
            <p className="text-white/70 mb-2">
              Rating: <span className="text-gold font-semibold">{rev.rating}/5</span>
            </p>
            <p className="text-white/60">{rev.text}</p>
          </SupernovaGlowCard>
        ))}
      </section>

      {/* MAP */}
      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Find Us</h2>
        <p className="text-white/60">Map and directions coming soon</p>
      </SupernovaSectionDivider>

      <SupernovaGlowCard>
        <div className="w-full h-48 bg-black/40 border border-gold rounded-lg flex items-center justify-center text-white/50">
          Map Placeholder
        </div>
      </SupernovaGlowCard>

    </div>
  );
}
