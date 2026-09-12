import React from "react";
import clsx from "clsx";

/* ============================================================
   ⭐ AUTO FORMAT REG (AB12 CDE)
============================================================ */
export function autoFormatReg(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length <= 4) return cleaned;
  return cleaned.slice(0, 4) + " " + cleaned.slice(4, 7);
}

/* ============================================================
   ⭐ MOT STATUS COLOR
============================================================ */
export function getMotStatusColor(expiry: string | null) {
  if (!expiry) return "text-gray-400 bg-gray-700";

  const today = new Date();
  const exp = new Date(expiry);

  if (exp < today) return "text-black bg-red-500"; // expired
  if ((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 30)
    return "text-black bg-yellow-400"; // due soon

  return "text-black bg-green-400"; // pass
}
/* ============================================================
   ⭐ SUPERNOVA BADGE
============================================================ */
export function SuperBadge({ label }: { label: string }) {
  return (
    <span
      className={clsx(
        "px-3 py-1 rounded-md font-bold text-xs",
        "bg-gold text-black shadow-goldGlow"
      )}
    >
      {label}
    </span>
  );
}

/* ============================================================
   ⭐ SUPERNOVA GLOW BUTTON (Upgraded)
============================================================ */
type SuperGlowButtonProps = {
  label: string;
  onClick: () => void;
  glowColor?: "gold" | "red" | "blue";
  className?: string;
  disabled?: boolean;
};

export function SuperGlowButton({
  label,
  onClick,
  glowColor = "gold",
  className = "",
  disabled = false,
}: SuperGlowButtonProps) {
  const glow =
    glowColor === "red"
      ? "border-red-500 shadow-red-500/40 hover:shadow-red-500/60"
      : glowColor === "blue"
      ? "border-blue-400 shadow-blue-400/40 hover:shadow-blue-400/60"
      : "border-gold shadow-gold/40 hover:shadow-gold/60";

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={clsx(
        "px-4 py-3 rounded-xl font-bold transition-all duration-200",
        "bg-black/40 text-white hover:bg-black/60",
        "active:scale-[0.97] select-none",
        glow,
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      {label}
    </button>
  );
}

/* ============================================================
   ⭐ SUPERNOVA DIVIDER
============================================================ */
export function SuperDivider() {
  return <div className="h-px w-full bg-gold/40 my-4" />;
}

/* ============================================================
   ⭐ SUPERNOVA CARD
============================================================ */
export function SuperCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "bg-flipDark/80 border border-gold rounded-xl p-6 mb-6",
        "shadow-blueGlow backdrop-blur-md"
      )}
    >
      <h2 className="text-white/90 text-lg font-bold mb-4">{title}</h2>
      {children}
    </div>
  );
}

/* ============================================================
   ⭐ SUPERNOVA INPUT
============================================================ */
export function SuperInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <div className="mb-4">
      <label className="text-white/80 text-sm mb-1 block">{label}</label>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            "w-full bg-flipGlass text-white/90 border border-gold",
            "rounded-lg p-3 min-h-[100px] outline-none",
            "focus:ring-2 focus:ring-gold"
          )}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            "w-full bg-flipGlass text-white/90 border border-gold",
            "rounded-lg p-3 outline-none",
            "focus:ring-2 focus:ring-gold"
          )}
        />
      )}
    </div>
  );
}

/* ============================================================
   ⭐ SUPERNOVA BUTTON (Basic)
============================================================ */
type SuperButtonProps = {
  label: string;
  onClick: () => void;
  className?: string;
};

export function SuperButton({
  label,
  onClick,
  className,
}: SuperButtonProps) {
  return (
    <button
      onClick={onClick}
      className={
        className ??
        "px-4 py-2 bg-gold text-black rounded-xl font-bold hover:bg-yellow-300 transition"
      }
    >
      {label}
    </button>
  );
}
