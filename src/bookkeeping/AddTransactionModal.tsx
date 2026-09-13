import React, { useState } from "react";
import { TransactionEntry } from "./types";
import { useBookkeeping } from "./BookkeepingProvider";

type AddTransactionModalProps = {
  vehicleId: string | null;
  onClose: () => void;
};

export default function AddTransactionModal({
  vehicleId,
  onClose,
}: AddTransactionModalProps) {
  const { addTransaction } = useBookkeeping();

  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  function handleSave() {
    const entry: TransactionEntry = {
      id: crypto.randomUUID(),
      type,
      category,
      amount: Number(amount) || 0,
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

        {/* VEHICLE INFO */}
        <p className="text-white/60 text-sm mb-4">
          Vehicle: {vehicleId ?? "None selected"}
        </p>

        {/* FORM */}
        <div className="flex flex-col gap-4">
          <label className="text-white/60 text-sm -mb-2">Type</label>
          <select
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense")}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <label className="text-white/60 text-sm -mb-2">Category</label>
          <input
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="e.g. Transport, Parts, Rent, Other Income"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <label className="text-white/60 text-sm -mb-2">Amount (£)</label>
          <input
            type="number"
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label className="text-white/60 text-sm -mb-2">Notes</label>
          <textarea
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

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