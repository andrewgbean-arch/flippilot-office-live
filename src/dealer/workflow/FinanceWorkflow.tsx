import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import FinanceCalculator from "@/dealer/finance/FinanceCalculator";

export default function FinanceWorkflow() {
  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Finance Workflow"
        subtitle="Structure deals and calculate finance options."
      />

      <SupernovaSectionDivider label="Finance Tools" />

      <SupernovaGlowCard>
        <FinanceCalculator />
      </SupernovaGlowCard>
    </div>
  );
}
