import { useState } from "react";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { formatMoney } from "@/lib/formatMoney";
import type { PublicVehicle } from "./publicBookingApi";

// One car on the public store page.
//
// The picture, when there is one, comes from the store's own list (the server
// only ever sends a picture it is happy to show a stranger: see
// backend engines/storePhoto.ts). A car with no picture just has no picture
// here: no grey box saying "no photo". If a picture's address turns out not to
// load, it is taken away rather than left as a broken-image icon.
export default function StoreVehicleCard({ v, dealershipId }: { v: PublicVehicle; dealershipId: string }) {
  const [photoFailed, setPhotoFailed] = useState(false);

  const reg = v.reg?.trim().toUpperCase() || null;
  const priced = (v.priceRetail ?? 0) > 0;
  const facts = [v.year, v.mileage != null ? `${v.mileage.toLocaleString("en-GB")} miles` : null, v.colour].filter(Boolean).join(" · ");
  const title = [v.year, v.make, v.model].filter(Boolean).join(" ");
  const historyHref = `/car/${encodeURIComponent(dealershipId)}/${encodeURIComponent(v.id)}`;

  const picture =
    v.photo && !photoFailed ? (
      <img
        src={v.photo}
        alt={`Photo of the ${title}`}
        width={640}
        height={480}
        loading="lazy"
        decoding="async"
        // The picture's host is told nothing about which page asked for it.
        referrerPolicy="no-referrer"
        onError={() => setPhotoFailed(true)}
        className="aspect-[4/3] w-full rounded-lg bg-white/5 object-cover"
      />
    ) : null;

  return (
    <SupernovaGlowCard>
      {picture && <div className="mb-3">{v.hasPassport ? <a href={historyHref}>{picture}</a> : picture}</div>}
      <h3 className="text-xl font-bold text-yellow-400">
        {v.make} {v.model}
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
        {reg && <span className="rounded bg-yellow-300 px-1.5 py-px font-mono text-xs font-bold tracking-wide text-black">{reg}</span>}
        {facts && <span>{facts}</span>}
      </p>
      <p className={`mt-3 text-2xl font-bold ${priced ? "text-white" : "text-white/70"}`}>{priced ? formatMoney(v.priceRetail) : "Price on request"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {v.hasPassport && (
          <a href={historyHref} className="inline-flex items-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">
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
}
