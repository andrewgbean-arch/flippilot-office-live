import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import FinanceCalculator from "@/dealer/finance/FinanceCalculator";
import DealerQuickTools from "@/components/dealer/DealerQuickTools";

import { colors } from "@/styles/theme/colors";

const dealerTheme = {
  accent: colors.accent,
  background: colors.background,
  card: colors.card,
  text: colors.text,
  secondary: colors.muted,
};

export default function FinanceHub() {
  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Finance Hub"
        subtitle="Deal structuring and quick finance tools."
      />

      <SupernovaSectionDivider label="Finance Tools" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SupernovaGlowCard>
          <FinanceCalculator />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <DealerQuickTools />
        </SupernovaGlowCard>
      </div>
    </div>
  );
}
