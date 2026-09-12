import React, { useState } from "react";

type AddTransactionModalProps = {
  vehicleId: string | null;
  onClose: () => void;
};

export default function AddTransactionModal({
  vehicleId,
  onClose,
}: AddTransactionModalProps) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50">
      <div className="bg-black/80 p-8 rounded-xl border border-yellow-400/20 w-[450px] shadow-[0_0_25px_rgba(255,215,0,0.4)]">
        
        {/* HEADER */}
        <h2 className="text-xl font-bold text-yellow-300 mb-4">
          Add Transaction
        </h2>

        {/* VEHICLE INFO */}
        <p className="text-white/60 text-sm mb-4">
          Vehicle: {vehicleId ?? "None selected"}
        </p>

        {/* FORM */}
        <form className="flex flex-col gap-4">
          <input
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="Cost Type (Transport, Parts, Labour, etc)"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />

          <input
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="Amount (£)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <input
            className="bg-black/40 border border-white/20 p-3 rounded-lg text-white"
            placeholder="Supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />

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
          >
            Save Transaction
          </button>
        </form>

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
