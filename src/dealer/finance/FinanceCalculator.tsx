import React, { useState } from "react";
import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";
import { FINANCE_DISCLAIMER, FINANCE_METHOD_NOTE, amountToFinance, calculateLoan } from "./financeMath";
import { formatMoney } from "./money";

const INPUT_CLASS = `
  mt-2 px-4 py-3 rounded-lg bg-black/40 border border-yellow-500/40
  text-white focus:outline-none focus:border-yellow-400 transition-all
`;

// Illustrative monthly payments from figures the dealer types. It used to
// pre-fill a 9.9% APR, show £0.00 at 0% APR, and treat APR as a nominal rate;
// see financeMath.ts.
export default function FinanceCalculator() {
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [term, setTerm] = useState("36");
  // Empty on purpose: a rate nobody has quoted must not appear on screen.
  const [rate, setRate] = useState("");

  const amount = amountToFinance(price, deposit);
  const loan = calculateLoan(amount, term, rate);

  return (
    <div className="animate-fadeIn relative z-10 px-6 py-10 max-w-4xl mx-auto">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Finance Calculator"
        subtitle="Illustrative monthly payments from the figures you enter."
      />

      <p className="text-white/70 mb-6">{FINANCE_DISCLAIMER}</p>

      {/* INPUTS SECTION */}
      <SupernovaSectionDivider label="Finance Inputs" />

      <SupernovaGlowCard>
        <div className="flex flex-col gap-6">

          {/* Vehicle Price */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">Vehicle Price (£)</span>
            <input
              type="number"
              min={0}
              value={price}
              placeholder="0.00"
              onChange={(e) => setPrice(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          {/* Deposit */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">Deposit (£)</span>
            <input
              type="number"
              min={0}
              value={deposit}
              placeholder="0.00"
              onChange={(e) => setDeposit(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          {/* Term */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">Term (months)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          {/* APR */}
          <label className="flex flex-col text-white/80">
            <span className="text-yellow-400 font-semibold">APR (%)</span>
            <input
              type="number"
              min={0}
              step="any"
              value={rate}
              placeholder="Enter the rate you have been quoted"
              onChange={(e) => setRate(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>
      </SupernovaGlowCard>

      {/* RESULT SECTION */}
      <SupernovaSectionDivider label="Monthly Payment (illustrative)" />

      <SupernovaGlowCard>
        {loan.status === "ok" ? (
          <>
            <div className="text-4xl font-bold text-yellow-400">
              {formatMoney(loan.monthlyPayment as number)}
              <span className="text-lg text-white/60"> a month</span>
            </div>
            <p className="text-white/60 mt-2">
              To finance {formatMoney(amount as number)} over {term} months. Total repayable{" "}
              {formatMoney(loan.totalRepayable as number)}, of which interest{" "}
              {formatMoney(loan.totalInterest as number)}.
            </p>
            <p className="text-white/50 text-sm mt-2">{FINANCE_METHOD_NOTE}</p>
          </>
        ) : (
          <p className="text-white/70">{loan.message}</p>
        )}
        <p className="text-white/50 text-sm mt-3">{FINANCE_DISCLAIMER}</p>
      </SupernovaGlowCard>

    </div>
  );
}
