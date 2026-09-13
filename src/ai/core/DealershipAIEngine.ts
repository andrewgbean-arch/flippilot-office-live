import { FlipRecord } from "../../features/vehicles/models/FlipRecord";

/* --------------------------------------------------
   ⭐ DealershipAIEngine — PLACEHOLDER

   This didn't exist yet (DealershipAIProvider.tsx imported it, but the
   file was never created), which broke the build for anything importing
   that provider. LeadCRMIntelligence.tsx (the only current consumer) is
   itself not routed anywhere yet, so this is a minimal stand-in that
   returns safely-shaped neutral data — enough to compile and render
   without crashing — not a real implementation of the actual scoring/
   negotiation logic. Replace the method bodies with real logic when this
   feature gets built out.
-------------------------------------------------- */
export class DealershipAIEngine {
  constructor(
    private vehicles: FlipRecord[],
    private leads: any[],
    private branches?: { name: string; vehicles: FlipRecord[]; leads: any[] }[]
  ) {}

  getLeadInsights(lead: any) {
    return {
      conversion: {
        band: "Unknown",
        nextAction: "Not enough data yet",
      },
      negotiation: {
        buyerType: "Unknown",
        finalOffer: 0,
        negotiationStrategy: "Not enough data yet",
      },
      match: {
        bestMatch: { score: 0 },
        recommendedVehicle: undefined as { make: string; model: string } | undefined,
        nextAction: "Not enough data yet",
      },
    };
  }
}
