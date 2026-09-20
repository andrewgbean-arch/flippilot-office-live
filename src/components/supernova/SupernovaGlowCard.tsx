import { ReactNode } from "react";

interface SupernovaGlowCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

// A glowing panel. Three things changed from the original:
//  - It showed a pointer cursor and a hover glow on EVERY card, clickable or
//    not, so dealers clicked panels that did nothing. Only a card that has an
//    onClick behaves like one now.
//  - A card that IS clickable is a real button to the keyboard (focusable,
//    Enter and Space work) instead of a div only a mouse could use.
//  - The gradient inside it pulsed forever on every card on the page (motion
//    for its own sake, and a steady cost with many cards). It's static now.
export function SupernovaGlowCard({ children, className = "", onClick }: SupernovaGlowCardProps) {
  const interactive = onClick !== undefined;

  return (
    <div
      onClick={onClick}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.target !== event.currentTarget) return; // a key pressed inside a field or button belongs to it
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            },
          }
        : {})}
      className={`relative p-4 sm:p-6 rounded-xl bg-black/50 border border-yellow-500/40 backdrop-blur-xl
      shadow-[0_0_20px_rgba(255,215,0,0.25)] transition-all
      ${interactive ? "cursor-pointer hover:shadow-[0_0_35px_rgba(255,215,0,0.45)]" : ""} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-blue-500/10 opacity-40 pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}
