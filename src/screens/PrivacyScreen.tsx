import { Link } from "react-router-dom";

// Generic SaaS privacy template, written to accurately describe what
// this specific app actually does today (JWT auth in localStorage,
// file-based per-tenant storage, Stripe for billing) rather than
// generic boilerplate that doesn't match the real implementation.
export default function PrivacyScreen() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-yellow-300 hover:underline text-sm">
          ← Back to FlipPilot Dealer OS
        </Link>

        <h1 className="text-3xl font-bold text-yellow-300 mt-6 mb-2">Privacy Policy</h1>
        <p className="text-white/60 text-sm mb-8">Last updated: 2026</p>

        <div className="space-y-6 text-white/70 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-base mb-2">1. What We Collect</h2>
            <p>
              Account details you provide at signup (name, email, dealership name), and the
              business data you enter while using the Service — vehicle inventory, leads,
              staff records, and bookkeeping entries.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">2. If You're Booking or Enquiring Without an Account</h2>
            <p>
              You don't need an account to book a viewing, test drive or MOT, or to ask a dealer
              to watch for a car. The name and contact details you give go to that one dealership
              only, so they can get back to you — not to any other dealer on FlipPilot, and not
              to any of the outside providers listed in section 5.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">3. How Data Is Stored</h2>
            <p>
              Each dealership's data is stored separately from every other dealership's — nothing
              you enter is visible to other accounts. Authentication uses a signed session token
              stored in your browser; passwords are never stored in plain text.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">4. Payment Information</h2>
            <p>
              If you subscribe to a paid plan, billing is handled entirely by Stripe. We don't
              see or store your full card details — only a subscription status and customer
              reference are kept on our side.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">5. What We Don't Do</h2>
            <p>
              We don't sell your data, and we don't share it with other dealerships. We do send
              specific data to outside providers where it's needed to do the thing you asked for
              — never anything more than that task requires:
            </p>
            <ul className="list-disc list-outside ml-5 mt-2 space-y-1">
              <li>Stripe, to process a paid subscription.</li>
              <li>
                Anthropic, to generate Pilot Brain's answers, briefings and decision reviews —
                whatever you ask it, and the account data it's allowed to see, is sent to
                Anthropic to produce the reply.
              </li>
              <li>
                ElevenLabs or OpenAI, to turn a Pilot Brain reply into speech, but only if you use
                a spoken voice.
              </li>
              <li>
                The DVLA and DVSA, to look up a vehicle's details and MOT history, but only when
                you check a registration.
              </li>
              <li>Resend, to send password-reset and other account emails.</li>
              <li>Google, for market price estimates on vehicles you're pricing.</li>
            </ul>
            <p className="mt-2">
              Each provider is bound by its own data-processing terms and only receives what its
              task needs.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">6. Your Choices</h2>
            <p>
              You can update your account and dealership details at any time from Settings. To
              delete your account and data entirely, contact support.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">7. Changes</h2>
            <p>
              We may update this policy as the Service changes. Material changes will be reflected
              by updating the date at the top of this page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
