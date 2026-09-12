import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

export default function Settings() {
  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-5xl mx-auto">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Dealer Settings & Preferences"
        subtitle="Configure your FlipPilot Dealer OS experience, preferences, and system behaviour."
      />

      {/* Badge */}
      <div className="mb-10">
        <span className="inline-block px-4 py-2 bg-black/40 border border-yellow-400 rounded-lg text-yellow-300 text-sm">
          FlipPilot OS • Supernova V12
        </span>
      </div>

      {/* Settings Grid */}
      <SupernovaSectionDivider label="Settings" />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

        {/* Theme Settings */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Theme Settings</h2>
          <p className="text-white/70 mb-4">
            Adjust your display theme, glow intensity, and UI preferences.
          </p>

          <SupernovaGlowButton label="Toggle Dark Mode" onClick={() => {}} />
        </SupernovaGlowCard>

        {/* Dealer Profile */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Dealer Profile</h2>
          <p className="text-white/70 mb-4">
            Manage dealership information, branding, and contact details.
          </p>

          <SupernovaGlowButton label="Edit Dealer Profile" onClick={() => {}} />
        </SupernovaGlowCard>

        {/* System Preferences */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">System Preferences</h2>
          <p className="text-white/70 mb-4">
            Configure notifications, data refresh intervals, and system behaviour.
          </p>

          <SupernovaGlowButton label="Open System Preferences" onClick={() => {}} />
        </SupernovaGlowCard>

        {/* Account & Security */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Account & Security</h2>
          <p className="text-white/70 mb-4">
            Manage login credentials, security settings, and access control.
          </p>

          <SupernovaGlowButton label="Security Options" onClick={() => {}} />
        </SupernovaGlowCard>

      </section>

      {/* Coming Soon */}
      <SupernovaSectionDivider label="Upcoming Features" />

      <SupernovaGlowCard>
        <h2 className="text-yellow-300 font-bold text-xl mb-4">Coming Soon</h2>

        <ul className="space-y-3 text-white/70">
          <li>• Custom dealer themes</li>
          <li>• Advanced AI tuning options</li>
          <li>• Multi‑dealer account switching</li>
          <li>• Exportable configuration profiles</li>
          <li>• Dealer OS automation rules</li>
        </ul>
      </SupernovaGlowCard>

    </div>
  );
}
