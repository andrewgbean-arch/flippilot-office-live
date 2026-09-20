import { useEffect, useState, type FormEvent } from "react";
import { formatMoney } from "@/lib/formatMoney";
import type { PublicVehicle } from "./publicBookingApi";
import { loadWantedFormInfo, submitWanted, type WantedFormInfo } from "./publicWantedApi";
import { emptyDraft, firstName, problemWith, toPayload, type WantedDraft } from "./wantedFormModel";

// "Can't see the one you want? Tell us and we'll let you know."
//
// On the dealer's public store page. It only appears once the words the person
// is agreeing to have loaded, and what they agree to is exactly what the server
// sends (and later stores with their request).

const INPUT =
  "w-full rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-white placeholder-white/40 focus:border-yellow-400 focus:outline-none disabled:opacity-60";
const LABEL = "mb-1 block text-sm font-semibold text-white/85";

export default function WantedSection({
  dealershipId,
  dealerName,
  dealerPhone,
  preview = false,
}: {
  dealershipId: string;
  dealerName: string;
  dealerPhone?: string | undefined;
  // True on the dealer's own preview of their page: the form is shown but can't
  // send, so testing it never creates a real customer's request.
  preview?: boolean;
}) {
  const [info, setInfo] = useState<WantedFormInfo | null>(null);
  const [draft, setDraft] = useState<WantedDraft>(emptyDraft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; inStockNow: PublicVehicle[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWantedFormInfo(dealershipId).then(loaded => {
      if (!cancelled) setInfo(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [dealershipId]);

  // No wording, no form: nobody is asked to agree to words they were not shown.
  if (!info) return null;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (preview || sending) return;
    const problem = problemWith(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSending(true);
    const result = await submitWanted(dealershipId, toPayload(draft));
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone({ name: firstName(draft.name), inStockNow: result.inStockNow });
    setDraft(emptyDraft);
  }

  return (
    <section aria-labelledby="wanted-heading" className="mb-10">
      <h2 id="wanted-heading" className="text-xl font-bold text-yellow-400">
        Can&apos;t see the one you want?
      </h2>
      {done ? (
        <WantedThanks
          dealerName={dealerName}
          dealershipId={dealershipId}
          name={done.name}
          inStockNow={done.inStockNow}
          onAgain={() => setDone(null)}
        />
      ) : (
        <WantedFormView
          info={info}
          draft={draft}
          onChange={patch => {
            setError(null); // a message about what was missing is out of date once they change anything
            setDraft(d => ({ ...d, ...patch }));
          }}
          onSubmit={send}
          sending={sending}
          error={error}
          preview={preview}
          dealerName={dealerName}
          dealerPhone={dealerPhone}
        />
      )}
    </section>
  );
}

export function WantedFormView({
  info,
  draft,
  onChange,
  onSubmit,
  sending = false,
  error = null,
  preview = false,
  dealerName,
  dealerPhone,
}: {
  info: WantedFormInfo;
  draft: WantedDraft;
  onChange: (patch: Partial<WantedDraft>) => void;
  onSubmit: (e: FormEvent) => void;
  sending?: boolean;
  error?: string | null;
  preview?: boolean;
  dealerName: string;
  dealerPhone?: string | undefined;
}) {
  if (!info.accepting) {
    return (
      <p className="mt-2 max-w-xl text-white/75">
        {dealerName} can&apos;t take any more requests through this page just now.
        {dealerPhone ? " Please give them a call instead." : " Please get in touch with them directly."}
      </p>
    );
  }

  const text = (field: keyof WantedDraft) => ({
    value: String(draft[field]),
    onChange: (e: { target: { value: string } }) => onChange({ [field]: e.target.value } as Partial<WantedDraft>),
  });

  return (
    <>
      <p className="mb-4 mt-1 max-w-xl text-sm text-white/70">
        Tell {dealerName} what you&apos;re after. If one comes in, they&apos;ll get in touch. It costs nothing, and only they will see your details.
      </p>
      {preview && (
        <p className="mb-3 max-w-xl rounded-lg border border-yellow-500/40 bg-yellow-400/10 p-3 text-sm text-yellow-100">
          This is a preview, so the form is switched off here. Customers see it working on your real page.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="max-w-xl rounded-xl border border-yellow-500/30 bg-black/50 p-4">
        <fieldset disabled={preview || sending} className="grid gap-4 border-0 p-0">
          <legend className="sr-only">Tell us what you&apos;re looking for</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wanted-make" className={LABEL}>
                Make
              </label>
              <input id="wanted-make" type="text" autoComplete="off" placeholder="e.g. Ford" maxLength={40} className={INPUT} {...text("make")} />
            </div>
            <div>
              <label htmlFor="wanted-model" className={LABEL}>
                Model <span className="font-normal text-white/50">(if you know)</span>
              </label>
              <input id="wanted-model" type="text" autoComplete="off" placeholder="e.g. Fiesta" maxLength={40} className={INPUT} {...text("model")} />
            </div>
          </div>

          <div>
            <label htmlFor="wanted-budget" className={LABEL}>
              Most you&apos;d like to spend <span className="font-normal text-white/50">(optional)</span>
            </label>
            <input id="wanted-budget" type="text" inputMode="numeric" autoComplete="off" placeholder="e.g. £8,000" className={INPUT} {...text("budget")} />
          </div>

          <div>
            <label htmlFor="wanted-note" className={LABEL}>
              Anything else <span className="font-normal text-white/50">(optional)</span>
            </label>
            <input id="wanted-note" type="text" autoComplete="off" placeholder="e.g. automatic, low mileage" maxLength={300} className={INPUT} {...text("note")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wanted-name" className={LABEL}>
                Your name
              </label>
              <input id="wanted-name" type="text" autoComplete="name" maxLength={80} required className={INPUT} {...text("name")} />
            </div>
            <div>
              <label htmlFor="wanted-phone" className={LABEL}>
                Phone
              </label>
              <input id="wanted-phone" type="tel" autoComplete="tel" maxLength={40} className={INPUT} {...text("phone")} />
            </div>
          </div>
          <div>
            <label htmlFor="wanted-email" className={LABEL}>
              Email <span className="font-normal text-white/50">(a phone number or an email is enough)</span>
            </label>
            <input id="wanted-email" type="email" autoComplete="email" maxLength={254} className={INPUT} {...text("email")} />
          </div>

          {/* Real people never see or reach this; a script that fills it in is ignored. */}
          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="wanted-website">Leave this empty</label>
            <input id="wanted-website" name="website" type="text" tabIndex={-1} autoComplete="off" {...text("website")} />
          </div>

          <label className="flex items-start gap-3 text-sm text-white/85">
            <input
              type="checkbox"
              checked={draft.consent}
              onChange={e => onChange({ consent: e.target.checked })}
              className="mt-1 h-5 w-5 shrink-0 accent-yellow-400"
            />
            <span>{info.consentWording}</span>
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button type="submit" className="w-full rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-60 sm:w-auto">
            {sending ? "Sending…" : "Tell me when you get one"}
          </button>
        </fieldset>
      </form>
    </>
  );
}

// Shown once the request has gone. If there is already a car that fits, that
// comes first: the point of asking is to find one.
export function WantedThanks({
  dealerName,
  dealershipId,
  name,
  inStockNow,
  onAgain,
}: {
  dealerName: string;
  dealershipId: string;
  name: string;
  inStockNow: PublicVehicle[];
  onAgain: () => void;
}) {
  return (
    <div role="status" className="mt-3 max-w-xl rounded-xl border border-yellow-500/30 bg-black/50 p-4">
      <p className="text-lg font-bold text-white">{name ? `Thank you, ${name}.` : "Thank you."}</p>
      <p className="mt-1 text-white/80">{dealerName} has your request. If one comes in, they&apos;ll get in touch.</p>

      {inStockNow.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold text-yellow-300">{inStockNow.length === 1 ? "There's one in stock right now:" : "There are some in stock right now:"}</p>
          <ul className="mt-2 space-y-2">
            {inStockNow.map(v => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 p-3">
                <span>
                  <span className="font-semibold text-white">
                    {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  </span>
                  <span className="ml-2 text-white/70">{(v.priceRetail ?? 0) > 0 ? formatMoney(v.priceRetail) : "Price on request"}</span>
                </span>
                <a
                  href={v.hasPassport ? `/car/${encodeURIComponent(dealershipId)}/${encodeURIComponent(v.id)}` : `/book/${encodeURIComponent(dealershipId)}?vehicle=${encodeURIComponent(v.id)}`}
                  className="rounded-lg bg-yellow-400 px-3 py-1.5 text-sm font-bold text-black hover:bg-yellow-300"
                >
                  {v.hasPassport ? "See full history" : "Book a viewing"}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={onAgain} className="mt-4 text-sm font-semibold text-yellow-300 underline hover:text-yellow-200">
        Ask for something else
      </button>
    </div>
  );
}
