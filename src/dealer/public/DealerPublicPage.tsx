import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";
import { useDealer } from "@/context/DealerContext";

// Name/location/phone below now come from the real dealership (settable
// in Settings -> Edit Dealer Profile); hours/reviews/featured-stock are
// still mock content — a real reviews/hours/stock system would be a
// separate, larger feature.
export default function DealerPublicPage() {
  const { dealer: realDealer } = useDealer();

  const dealer = {
    name: realDealer?.name ?? "Your Dealership",
    tagline: "Premium vehicles. Trusted service. Local expertise.",
    location: realDealer?.address || "Address not set — add one in Settings",
    phone: realDealer?.phone || "Phone not set — add one in Settings",
    email: "sales@flippilotmotors.co.uk",
    hours: [
      { day: "Monday", time: "09:00 – 18:00" },
      { day: "Tuesday", time: "09:00 – 18:00" },
      { day: "Wednesday", time: "09:00 – 18:00" },
      { day: "Thursday", time: "09:00 – 18:00" },
      { day: "Friday", time: "09:00 – 18:00" },
      { day: "Saturday", time: "10:00 – 16:00" },
      { day: "Sunday", time: "Closed" },
    ],
    reviews: [
      { name: "James T.", rating: 5, text: "Fantastic service, smooth purchase!" },
      { name: "Emily R.", rating: 4, text: "Friendly staff and great prices." },
      { name: "Michael L.", rating: 5, text: "Highly recommend FlipPilot Motors!" },
    ],
    featuredStock: [
      { model: "Ford Fiesta 1.0 EcoBoost", price: "£6,995" },
      { model: "Vauxhall Corsa 1.4 SE", price: "£5,450" },
      { model: "BMW 118d Sport", price: "£9,995" },
    ],
  };

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
        <p className="text-white/60">Reach out to FlipPilot Motors</p>
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
        <ul className="text-white/70 space-y-2">
          {dealer.hours.map((h) => (
            <li key={h.day} className="flex justify-between">
              <span>{h.day}</span>
              <span className="text-gold">{h.time}</span>
            </li>
          ))}
        </ul>
      </SupernovaGlowCard>

      {/* FEATURED STOCK */}
      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Featured Vehicles</h2>
        <p className="text-white/60">Popular choices available now</p>
      </SupernovaSectionDivider>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {dealer.featuredStock.map((car, i) => (
          <SupernovaGlowCard key={i}>
            <h3 className="text-yellow-400 font-bold text-xl mb-2">{car.model}</h3>
            <p className="text-white/70">
              Price: <span className="text-gold font-semibold">{car.price}</span>
            </p>
          </SupernovaGlowCard>
        ))}
      </section>

      {/* REVIEWS */}
      <SupernovaSectionDivider>
        <h2 className="text-2xl font-bold text-yellow-400">Customer Reviews</h2>
        <p className="text-white/60">What our customers say</p>
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
