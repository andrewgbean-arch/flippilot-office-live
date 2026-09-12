import React, { useState } from "react";
import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";

export default function FinanceCalculator() {
  const [price, setPrice] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [term, setTerm] = useState(36);
  const [rate, setRate] = useState(9.9);

  const monthlyPayment = () => {
    const amount = price - deposit;
    const monthlyRate = rate / 100 / 12;
    const payment =
      (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term));

    return isNaN(payment) ? 0 : payment.toFixed(2);
  };

  return (
    <div className="animate-fadeIn relative z-10 px-6 py-10 max-w-4xl mx-auto">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Finance Calculator"
        subtitle="Instant monthly payment calculations powered by FlipPilot’s finance engine."
      />

      {/* INPUTS SECTION */}
      <SupernovaSectionDivider label="Finance Inputs" />

      <SupernovaGlowCard>
        <div className="flex flex-col gap-6">

          {/* Vehicle Price */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">Vehicle Price (£)</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="
                mt-2 px-4 py-3 rounded-lg bg-black/40 border border-yellow-500/40
                text-white focus:outline-none focus:border-yellow-400 transition-all
              "
            />
          </label>

          {/* Deposit */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">Deposit (£)</span>
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value))}
              className="
                mt-2 px-4 py-3 rounded-lg bg-black/40 border border-yellow-500/40
                text-white focus:outline-none focus:border-yellow-400 transition-all
              "
            />
          </label>

          {/* Term */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">Term (months)</span>
            <input
              type="number"
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
              className="
                mt-2 px-4 py-3 rounded-lg bg-black/40 border border-yellow-500/40
                text-white focus:outline-none focus:border-yellow-400 transition-all
              "
            />
          </label>

          {/* APR */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">APR (%)</span>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="
                mt-2 px-4 py-3 rounded-lg bg-black/40 border border-yellow-500/40
                text-white focus:outline-none focus:border-yellow-400 transition-all
              "
            />
          </label>
        </div>
      </SupernovaGlowCard>

      {/* RESULT SECTION */}
      <SupernovaSectionDivider label="Monthly Payment" />

      <SupernovaGlowCard>
        <div className="text-4xl font-bold text-yellow-400">
          £{monthlyPayment()}
        </div>
        <p className="text-white/60 mt-2">
          Based on your price, deposit, APR, and term.
        </p>
      </SupernovaGlowCard>

    </div>
  );
}
