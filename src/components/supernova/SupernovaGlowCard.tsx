import { ReactNode } from "react";

interface SupernovaGlowCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function SupernovaGlowCard({ children, className = "", onClick }: SupernovaGlowCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative p-6 rounded-xl bg-black/50 border border-yellow-500/40 backdrop-blur-xl 
      shadow-[0_0_20px_rgba(255,215,0,0.25)] hover:shadow-[0_0_35px_rgba(255,215,0,0.45)] 
      transition-all cursor-pointer ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-blue-500/10 opacity-40 animate-pulse" />
      <div className="relative">{children}</div>
    </div>
  );
}
