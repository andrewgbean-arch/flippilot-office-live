import React from "react";

interface HintRowProps {
  title?: string;
  hint?: React.ReactNode;
}

export function HintRow({
  title = "Try editing",
  hint = "app/index.tsx",
}: HintRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] opacity-75">{title}</span>

      <div className="rounded-md px-2 py-1 bg-white/5">
        <span className="text-[13px] opacity-75">{hint}</span>
      </div>
    </div>
  );
}
