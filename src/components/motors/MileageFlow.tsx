import React from "react";
import { motion } from "framer-motion";

type Props = {
  history: { date: string; mileage: number }[];
  theme: any;
};

export default function MileageFlow({ history, theme }: Props) {
  return (
    <div className="w-full overflow-x-auto mb-6 py-3">
      <div className="flex items-center gap-6 px-2">
        {history.map((entry, idx) => {
          const isLast = idx === history.length - 1;

          return (
            <div key={idx} className="flex items-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                className="flex flex-col items-center"
              >
                {/* GOLD DOT */}
                <div
                  className="rounded-full shadow-lg"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: theme.goldDeep,
                    boxShadow: `0 0 12px ${theme.goldSoftGlow}`,
                  }}
                />

                {/* DATE */}
                <span
                  className="mt-2 text-xs text-center"
                  style={{ color: theme.text }}
                >
                  {entry.date}
                </span>

                {/* MILEAGE */}
                <span
                  className="text-sm font-bold mt-1"
                  style={{ color: theme.text }}
                >
                  {entry.mileage} mi
                </span>
              </motion.div>

              {/* CONNECTOR LINE */}
              {!isLast && (
                <div
                  className="ml-3"
                  style={{
                    width: 40,
                    height: 2,
                    backgroundColor: theme.goldDeep,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

