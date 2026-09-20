import { Link } from "react-router-dom";

// Generic SaaS terms template — reasonable for a real product to launch
// with, but not a substitute for actual legal review before this app
// ever handles a real paying customer's data.
export default function TermsScreen() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-yellow-300 hover:underline text-sm">
          ← Back to FlipPilot Dealer OS
        </Link>

        <h1 className="text-3xl font-bold text-yellow-300 mt-6 mb-2">Terms of Service</h1>
        <p className="text-white/60 text-sm mb-8">Last updated: 2026</p>

        <div className="space-y-6 text-white/70 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-base mb-2">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using FlipPilot Dealer OS ("the Service"), you agree to be
              bound by these Terms of Service. If you don't agree, don't use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">2. Your Account</h2>
            <p>
              You're responsible for keeping your login credentials secure and for all activity
              that happens under your account. Each account is tied to a single dealership
              workspace, and your data is isolated from every other dealership using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">3. Your Data</h2>
            <p>
              Vehicle, lead, staff, and bookkeeping records you enter belong to you. We store them
              to provide the Service and don't sell them to third parties. See the{" "}
              <Link to="/privacy" className="text-yellow-300 hover:underline">Privacy Policy</Link>{" "}
              for details on what's collected and how it's used.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">4. Subscription & Billing</h2>
            <p>
              New accounts start with a free trial period. After the trial, continued access
              requires an active paid subscription. Prices and billing are handled through our
              payment processor; failed or cancelled payments may result in restricted access to
              paid features.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">5. Acceptable Use</h2>
            <p>
              Don't use the Service to store or process data you don't have the right to hold,
              attempt to access another dealership's data, or disrupt the Service for other users.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">6. No Warranty</h2>
            <p>
              The Service, including any AI-generated valuations, pricing suggestions, or market
              intelligence, is provided "as is" for informational purposes. It is not financial or
              legal advice, and you're responsible for verifying any figures before relying on
              them in a real transaction.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">7. Termination</h2>
            <p>
              You can stop using the Service and close your account at any time. We may suspend or
              terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">8. Changes</h2>
            <p>
              We may update these terms from time to time. Continued use of the Service after a
              change means you accept the updated terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
