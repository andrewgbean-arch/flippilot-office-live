import { ReactNode } from "react";

interface Props {
  label?: string;
  children?: ReactNode;
}

// A section heading with a thin glow line above it. It used to leave 40px above
// and below plus a 4px line and a 24px heading; on a page with several sections
// that stacked up to a screenful of empty space.
export function SupernovaSectionDivider({ label, children }: Props) {
  return (
    <div className="my-6">
      {/* Glow line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-yellow-500/40 via-blue-500/40 to-purple-500/40 rounded-full mb-3" />

      {/* Label OR children */}
      {label && (
        <h2 className="text-xl font-bold text-yellow-400 mb-2">
          {label}
        </h2>
      )}

      {children && (
        <div className="text-white/70">{children}</div>
      )}
    </div>
  );
}
