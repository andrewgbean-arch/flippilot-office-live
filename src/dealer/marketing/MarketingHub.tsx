import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import DealerPublicPage from "@/dealer/public/DealerPublicPage";
import DealerGridButton from "@/components/dealer/DealerGridButton";

export default function MarketingHub() {
  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Marketing Hub"
        subtitle="Your public store page, and your stock on the portals."
      />

      <SupernovaSectionDivider label="Dealer Public Page" />

      <SupernovaGlowCard>
        <DealerPublicPage />
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="Quick Actions" />

      <SupernovaGlowCard>
        <DealerGridButton
          label="Marketplace Sync"
          href="/dealer/marketing/sync"
        />
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="Not Available Yet" />

      <SupernovaGlowCard>
        <h2 className="text-yellow-300 font-bold text-xl mb-3">Coming Soon</h2>
        <ul className="space-y-3 text-white/70">
          <li>• Listing boost / promotion</li>
          <li>• Branding tools (logo, colour scheme, templates)</li>
          <li>• Marketing effects and campaign scheduling</li>
        </ul>
      </SupernovaGlowCard>
    </div>
  );
}
