import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
}

export default function ShareModal({ open, onClose, message }: ShareModalProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    alert("Copied to clipboard!");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: message,
          title: "FlipPilot Flip",
        });
        return;
      } catch (err) {
        console.warn("Share failed:", err);
      }
    }
    handleCopy();
  };

  const handleDownload = () => {
    const blob = new Blob([message], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "flip-summary.txt";
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Modal box */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-[#0A1128] border border-[#FFD700]/40 rounded-xl p-6 w-[420px] shadow-[0_0_25px_rgba(255,215,0,0.35)]"
          >
            <h2 className="text-xl font-bold text-[#FFD700] mb-3">
              Share Flip Summary
            </h2>

            <div className="bg-black/30 border border-white/10 rounded-md p-3 h-[160px] overflow-auto text-sm text-white/90 whitespace-pre-wrap">
              {message}
            </div>

            {/* Buttons */}
            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={handleShare}
                className="w-full py-2 rounded-md bg-[#FFD700] text-[#0A1128] font-bold hover:bg-yellow-400 transition"
              >
                Share
              </button>

              <button
                onClick={handleCopy}
                className="w-full py-2 rounded-md bg-white/10 text-white hover:bg-white/20 transition"
              >
                Copy to Clipboard
              </button>

              <button
                onClick={handleDownload}
                className="w-full py-2 rounded-md bg-white/10 text-white hover:bg-white/20 transition"
              >
                Download as Text File
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 rounded-md bg-black/40 text-white hover:bg-black/60 transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
