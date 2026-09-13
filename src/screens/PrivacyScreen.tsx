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
        <p className="text-white/40 text-sm mb-8">Last updated: 2026</p>

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
            <h2 className="text-white font-semibold text-base mb-2">2. How Data Is Stored</h2>
            <p>
              Each dealership's data is stored separately from every other dealership's — nothing
              you enter is visible to other accounts. Authentication uses a signed session token
              stored in your browser; passwords are never stored in plain text.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">3. Payment Information</h2>
            <p>
              If you subscribe to a paid plan, billing is handled entirely by Stripe. We don't
              see or store your full card details — only a subscription status and customer
              reference are kept on our side.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">4. What We Don't Do</h2>
            <p>
              We don't sell your data, and we don't share it with other dealerships or third
              parties beyond what's required to run the Service (e.g. our payment processor).
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">5. Your Choices</h2>
            <p>
              You can update your account and dealership details at any time from Settings. To
              delete your account and data entirely, contact support.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">6. Changes</h2>
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
