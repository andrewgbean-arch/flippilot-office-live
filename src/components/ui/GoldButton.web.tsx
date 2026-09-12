import React from "react";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
};

export default function GoldButton({ children, onPress }: Props) {
  return (
    <button
      onClick={onPress}
      className="
        w-full
        h-14
        flex
        items-center
        justify-center
        text-center
        font-semibold
        rounded-xl
        bg-yellow-500
        text-black
        hover:bg-yellow-400
        transition-all
        duration-300
        shadow-[0_0_6px_rgba(255,215,0,0.4)]
        animate-slowGlow
      "
    >
      {children}
    </button>
  );
}

/* ⭐ Slow luxury glow — dealership-grade */
const style = `
@keyframes slowGlow {
  0% { box-shadow: 0 0 6px rgba(255,215,0,0.35); }
  50% { box-shadow: 0 0 14px rgba(255,215,0,0.65); }
  100% { box-shadow: 0 0 6px rgba(255,215,0,0.35); }
}
.animate-slowGlow {
  animation: slowGlow 3.5s ease-in-out infinite;
}
`;

export const GoldButtonStyles = <style>{style}</style>;
