import React, { useState } from "react";
import { TransactionEntry } from "./types";
import { useBookkeeping } from "./BookkeepingProvider";
import { readMoney } from "@/lib/parseMoney";
import { focusField } from "@/lib/focusField";

type AddTransactionModalProps = {
  onClose: () => void;
};

// TransactionEntry (types.ts) has no vehicleId field at all — these are
// general business transactions (rent, insurance, etc), never tied to
// a specific vehicle. This used to accept a vehicleId prop and display
// it as "Vehicle: X" even though nothing about the transaction was
// ever actually scoped to that vehicle — misleading, since the value
// shown was just whichever vehicle happened to be most recently
// purchased, with no way to change it and no real effect on save.
export default function AddTransactionModal({
  onClose,
}: AddTransactionModalProps) {
  const { addTransaction } = useBookkeeping();

  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // The amount is REQUIRED and must be above £0: a blank used to be saved as a £0
  // transaction, and "£1,200" was read as nothing.
  const [submitted, setSubmitted] = useState(false);
  const amountRead = readMoney(amount, { positive: true, blankMessage: "Enter the amount." });
  const amountError = amountRead.ok ? null : amountRead.message;
  const showAmountError = amountError !== null && (submitted || amount.trim() !== "");

  function handleSave() {
    if (!amountRead.ok) {
      setSubmitted(true);
      focusField("addtransactionmodal-amount");
      return;
    }
    const entry: TransactionEntry = {
      id: crypto.randomUUID(),
      type,
      category,
      amount: amountRead.value,
      date: new Date().toISOString().slice(0, 10),
      notes,
    };

    addTransaction(entry);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 p-8 rounded-xl border border-yellow-400/20 w-[450px] max-h-[90vh] overflow-y-auto shadow-[0_0_25px_rgba(255,215,0,0.4)]">

        {/* HEADER */}
        <h2 className="text-xl font-bold text-yellow-300 mb-4">
          Add Transaction
        </h2>

        {/* FORM */}
        <div className="flex flex-col gap-4">
          <label htmlFor="addtransactionmodal-type" className="text-white/60 text-sm -mb-2">Type</label>
          <select id="addtransactionmodal-type"
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense")}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <label htmlFor="addtransactionmodal-category" className="text-white/60 text-sm -mb-2">Category</label>
          <input id="addtransactionmodal-category"
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="e.g. Transport, Parts, Rent, Other Income"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <label htmlFor="addtransactionmodal-amount" className="text-white/60 text-sm -mb-2">Amount (£)</label>
          <input id="addtransactionmodal-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="e.g. 250 or £250.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={showAmountError}
            aria-describedby={showAmountError ? "addtransactionmodal-amount-error" : undefined}
          />
          {showAmountError && (
            <p id="addtransactionmodal-amount-error" role="alert" className="text-red-400 text-sm -mt-2">
              {amountError}
            </p>
          )}

          <label htmlFor="addtransactionmodal-notes" className="text-white/60 text-sm -mb-2">Notes</label>
          <textarea id="addtransactionmodal-notes"
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* What stopped the last Save, right beside the button: the field's own message
              can be screens above it in this scrolling form. */}
          {submitted && amountError !== null && (
            <p id="addtransactionmodal-save-error" role="status" className="text-red-400 text-sm">
              Can't save yet: {amountError}
            </p>
          )}

          <button
            className="
              bg-yellow-500 hover:bg-yellow-600
              text-black font-semibold
              px-4 py-3 rounded-lg
            "
            type="button"
            onClick={handleSave}
          >
            Save Transaction
          </button>
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="mt-4 text-white/60 hover:text-yellow-300 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}