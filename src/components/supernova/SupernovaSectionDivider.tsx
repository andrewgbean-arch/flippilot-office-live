import { ReactNode } from "react";

interface Props {
  label?: string;
  children?: ReactNode;
}

export function SupernovaSectionDivider({ label, children }: Props) {
  return (
    <div className="my-10">
      {/* Glow line */}
      <div className="h-1 w-full bg-gradient-to-r from-yellow-500/40 via-blue-500/40 to-purple-500/40 rounded-full mb-4" />

      {/* Label OR children */}
      {label && (
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">
          {label}
        </h2>
      )}

      {children && (
        <div className="text-white/70">{children}</div>
      )}
    </div>
  );
}
