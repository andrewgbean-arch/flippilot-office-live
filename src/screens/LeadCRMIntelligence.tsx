import React from "react";
import { useDealershipAI } from "../context/DealershipAIProvider";

export default function LeadCRMIntelligence({ route }: { route: any }) {

  const { lead } = route.params;
  const ai = useDealershipAI();
  const info = ai.getLeadInsights(lead);

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: "bold" }}>
        Lead CRM Intelligence
      </h1>

      <h2 style={{ marginTop: 20 }}>
        Conversion Likelihood: {info.conversion.band}
      </h2>
      <p>Next Action: {info.conversion.nextAction}</p>

      <h2 style={{ marginTop: 20 }}>
        Buyer Type: {info.negotiation.buyerType}
      </h2>
      <p>Offer: £{info.negotiation.finalOffer}</p>
      <p>Strategy: {info.negotiation.negotiationStrategy}</p>

      <h2 style={{ marginTop: 20 }}>
        Best Match Score: {info.match.bestMatch.score}
      </h2>
      <p>
        Recommended Vehicle: {info.match.recommendedVehicle?.make}{" "}
        {info.match.recommendedVehicle?.model}
      </p>
      <p>Next Action: {info.match.nextAction}</p>
    </div>
  );
}
