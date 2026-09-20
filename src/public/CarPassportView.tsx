import { useRef, useState, type ReactNode } from "react";
import {
  GOV_MOT_CHECKER_URL,
  RESULT_LABEL,
  RESULT_TONE,
  bookingHref,
  carTitle,
  chartPoints,
  marketSummary,
  mileageSeries,
  mileageText,
  motHeadline,
  phoneHref,
  priceText,
  testLabel,
  titleCase,
  ulezChip,
  type Tone,
} from "./carPassportModel";
import type { AvailablePassport, PassportDealer, PassportMot, PublicPassport, SoldPassport } from "./passportTypes";

const TONE: Record<Tone, string> = {
  good: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  bad: "border-red-400/40 bg-red-400/10 text-red-200",
  plain: "border-white/15 bg-white/5 text-white/85",
};

function Chip({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${TONE[tone]}`}>{children}</span>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-yellow-300">{title}</h2>
      {children}
    </section>
  );
}

function Tick() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

// ---- photos ----

function PhotoStrip({ images, title }: { images: string[]; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/60">
        <div className="text-center">
          <svg aria-hidden="true" viewBox="0 0 64 32" className="mx-auto mb-2 h-10 w-20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 22v-5l6-9h28l10 9h6v5" />
            <circle cx="18" cy="23" r="4" />
            <circle cx="46" cy="23" r="4" />
          </svg>
          <p className="text-sm">Photos coming soon</p>
        </div>
      </div>
    );
  }

  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.min(images.length - 1, Math.max(0, to));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div
        ref={track}
        tabIndex={0}
        aria-label={`Photos of the ${title}`}
        onScroll={e => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${title}, photo ${i + 1} of ${images.length}`}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className="aspect-[4/3] w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            {index + 1} / {images.length}
          </span>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-xl text-white hover:bg-black/80 md:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-xl text-white hover:bg-black/80 md:flex"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}

// ---- MOT ----

function MileageChart({ mot }: { mot: PassportMot }) {
  const series = mileageSeries(mot);
  const W = 320;
  const H = 96;
  const points = chartPoints(series, W, H, 14);
  if (points.length < 2) return null;
  const summary = series.map(p => `${p.label}: ${p.mileage.toLocaleString("en-GB")} miles`).join(", ");
  return (
    <figure className="mt-5">
      <figcaption className="mb-2 text-sm font-semibold text-white/80">Mileage at each MOT</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-24 w-full max-w-md">
        <polyline fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points.map(p => `${p.x},${p.y}`).join(" ")} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#facc15" />
        ))}
      </svg>
      <div className="mt-1 flex max-w-md justify-between text-xs text-white/70">
        <span>
          {series[0]!.label}: {series[0]!.mileage.toLocaleString("en-GB")}
        </span>
        <span>
          {series[series.length - 1]!.label}: {series[series.length - 1]!.mileage.toLocaleString("en-GB")}
        </span>
      </div>
    </figure>
  );
}

function MotSection({ mot }: { mot: PassportMot }) {
  const headline = motHeadline(mot);
  return (
    <Section title="MOT history">
      {headline && (
        <p className="mb-4">
          <Chip tone={headline.tone}>{headline.text}</Chip>
        </p>
      )}
      {mot.tests.length > 0 && (
        <ol className="space-y-4">
          {mot.tests.map((t, i) => (
            <li key={`${t.date ?? t.year ?? "x"}-${i}`} className="border-l-2 border-white/15 pl-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-white">{testLabel(t)}</span>
                <Chip tone={RESULT_TONE[t.result]}>{RESULT_LABEL[t.result]}</Chip>
                {t.mileage !== undefined && <span className="text-sm text-white/75">{mileageText(t.mileage)}</span>}
              </div>
              {t.failures.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-red-200">
                  {t.failures.map((f, k) => (
                    <li key={k}>{f}</li>
                  ))}
                </ul>
              )}
              {t.advisories.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-200">
                  {t.advisories.map((a, k) => (
                    <li key={k}>{a}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
      <MileageChart mot={mot} />
      <p className="mt-5 text-sm text-white/70">
        This is the DVSA record on file for the car. You can check the latest yourself, any time, on{" "}
        <a href={GOV_MOT_CHECKER_URL} target="_blank" rel="noopener noreferrer" className="text-yellow-300 underline underline-offset-2">
          GOV.UK
        </a>
        .
      </p>
    </Section>
  );
}

// ---- price against the market ----

function MarketSection({ p }: { p: AvailablePassport }) {
  if (!p.market) return null;
  const s = marketSummary(p.market, p.car.make, p.car.model, p.car.askingPrice);
  return (
    <Section title="How the price compares">
      <p className="mb-3">
        <Chip tone={s.tone}>{s.headline}</Chip>
      </p>
      {s.bar && (
        <div className="mb-4" role="img" aria-label={`Asking prices seen ran from ${s.bar.lowest} to ${s.bar.highest} pounds. The average was ${p.market.averageAsking} pounds.`}>
          <div className="relative h-2 rounded-full bg-white/15">
            <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white/70" style={{ left: `${s.bar.avgPct}%` }} />
            <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-yellow-400" style={{ left: `${s.bar.askingPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-white/70">
            <span>Lowest £{s.bar.lowest.toLocaleString("en-GB")}</span>
            <span>Average £{p.market.averageAsking.toLocaleString("en-GB")}</span>
            <span>Highest £{s.bar.highest.toLocaleString("en-GB")}</span>
          </div>
          <p className="mt-2 text-xs text-white/70">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-yellow-400 align-middle" /> This car
            {s.bar.outside ? " (outside the range seen)" : ""}
          </p>
        </div>
      )}
      <p className="text-sm text-white/70">{s.detail}</p>
    </Section>
  );
}

// ---- the page ----

// `compact` is the phone's bottom bar: short labels so it stays one line high
// (the number is still what the Call button dials, and it's in the page footer).
function Actions({
  dealer,
  dealershipId,
  carId,
  className = "",
  compact = false,
}: {
  dealer: PassportDealer;
  dealershipId: string;
  carId: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={`gap-3 ${className}`}>
      <a
        href={bookingHref(dealershipId, carId)}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-yellow-400 px-5 py-3 text-center font-bold text-black hover:bg-yellow-300 ${compact ? "flex-[2]" : "flex-1"}`}
      >
        Book a viewing
      </a>
      {dealer.phone && (
        <a
          href={phoneHref(dealer.phone)}
          aria-label={`Call ${dealer.name} on ${dealer.phone}`}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-yellow-400/70 px-5 py-3 text-center font-semibold text-yellow-200 hover:bg-white/10"
        >
          {compact ? "Call" : `Call ${dealer.phone}`}
        </a>
      )}
    </div>
  );
}

function DealerFooter({ dealer, dealershipId }: { dealer: PassportDealer; dealershipId: string }) {
  return (
    <footer className="mx-auto max-w-3xl px-4 pb-6 pt-8 text-center text-sm text-white/70 sm:px-6">
      <p className="font-semibold text-white/90">{dealer.name}</p>
      {dealer.address && <p>{dealer.address}</p>}
      {dealer.phone && (
        <p>
          <a href={phoneHref(dealer.phone)} className="text-white/90 hover:text-yellow-300">
            {dealer.phone}
          </a>
        </p>
      )}
      <p className="mt-3">
        <a href={`/store/${encodeURIComponent(dealershipId)}`} className="text-yellow-300 underline underline-offset-2">
          See all cars from {dealer.name}
        </a>
      </p>
    </footer>
  );
}

function SoldView({ passport, dealershipId }: { passport: SoldPassport; dealershipId: string }) {
  return (
    <div className="min-h-screen bg-black px-4 py-16 text-center text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8">
        <Chip tone="plain">Sold</Chip>
        <h1 className="mt-4 text-2xl font-bold text-yellow-300">{carTitle(passport.car)}</h1>
        <p className="mt-3 text-white/80">This car has been sold, so its page is closed.</p>
        <a href={`/store/${encodeURIComponent(dealershipId)}`} className="mt-6 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300">
          See what {passport.dealer.name} has now
        </a>
      </div>
    </div>
  );
}

export default function CarPassportView({ passport, dealershipId }: { passport: PublicPassport; dealershipId: string }) {
  if (passport.sold) return <SoldView passport={passport} dealershipId={dealershipId} />;

  const { car, dealer } = passport;
  const title = carTitle(car);
  const ulez = ulezChip(passport.emissions);
  const mot = passport.mot ? motHeadline(passport.mot) : null;
  const facts = [mileageText(car.mileage), car.colour, car.fuelType ? titleCase(car.fuelType) : null].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-black pb-28 text-white md:pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <a href={`/store/${encodeURIComponent(dealershipId)}`} className="text-sm text-white/70 hover:text-yellow-300">
          ← All cars from {dealer.name}
        </a>
      </div>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-4 sm:px-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <PhotoStrip images={car.images} title={title} />

        <div>
          <p className="mb-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              Available now
            </span>
          </p>
          <h1 className="text-3xl font-bold leading-tight text-white">{title}</h1>
          <p className="mt-2 text-4xl font-bold text-yellow-300">{priceText(car.askingPrice)}</p>

          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/85">
            {car.reg && <span className="rounded bg-yellow-300 px-2 py-0.5 font-mono text-sm font-bold tracking-wide text-black">{car.reg}</span>}
            {facts.map(f => (
              <span key={f}>{f}</span>
            ))}
          </p>

          {(mot || ulez) && (
            <p className="mt-4 flex flex-wrap gap-2">
              {mot && <Chip tone={mot.tone}>{mot.text}</Chip>}
              {ulez && (
                <Chip tone={ulez.tone}>
                  {ulez.text} <span className="font-normal opacity-80">({ulez.detail})</span>
                </Chip>
              )}
            </p>
          )}

          {passport.note && (
            <blockquote className="mt-5 border-l-4 border-yellow-400/70 pl-4 text-lg italic text-white/90">
              {passport.note}
              <footer className="mt-1 text-sm not-italic text-white/70">{dealer.name}</footer>
            </blockquote>
          )}

          <Actions dealer={dealer} dealershipId={dealershipId} carId={car.id} className="mt-6 hidden md:flex" />
        </div>
      </main>

      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6">
        {passport.mot && <MotSection mot={passport.mot} />}

        {passport.workDone.length > 0 && (
          <Section title="What we've done to it">
            <ul className="space-y-2">
              {passport.workDone.map(line => (
                <li key={line} className="flex gap-3">
                  <Tick />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <MarketSection p={passport} />
      </div>

      <DealerFooter dealer={dealer} dealershipId={dealershipId} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-yellow-400/30 bg-black/95 p-3 backdrop-blur md:hidden">
        <Actions dealer={dealer} dealershipId={dealershipId} carId={car.id} className="flex" compact />
      </div>
    </div>
  );
}

// Used to give the tab a real title once the page has loaded.
export function passportPageTitle(passport: PublicPassport): string {
  const t = carTitle(passport.car);
  return passport.sold ? `${t} (sold) | ${passport.dealer.name}` : `${t} | ${passport.dealer.name}`;
}
