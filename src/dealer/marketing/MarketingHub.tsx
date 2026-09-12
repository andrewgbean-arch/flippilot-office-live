import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import DealerPublicPage from "@/dealer/marketplace/DealerPublicPage";
import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerSectionGlow from "@/components/dealer/DealerSectionGlow";
import DealerGridButton from "@/components/dealer/DealerGridButton";

import DealerFab from "@/components/dealer/DealerFab";

export default function MarketingHub() {
  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Marketing Hub"
        subtitle="Branding, listings, visibility and customer engagement."
      />

      <SupernovaSectionDivider label="Dealer Public Page" />

      <SupernovaGlowCard>
        <DealerPublicPage />
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="Brand Tools" />

      <SupernovaGlowCard>
        <DealerNeonHeader title="Branding Tools" />
      </SupernovaGlowCard>

      <SupernovaGlowCard>
        <DealerSectionGlow title="Marketing Effects" />
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="Quick Actions" />

      <SupernovaGlowCard>
<DealerGridButton
  label="Boost Listing"
  href="/dealer/marketing/boost"
/>


      </SupernovaGlowCard>

      <SupernovaGlowCard>
        <DealerFab />
      </SupernovaGlowCard>
    </div>
  );
}
