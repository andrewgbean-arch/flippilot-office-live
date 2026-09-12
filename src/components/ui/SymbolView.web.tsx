import React from "react";

interface SymbolViewProps {
  name: { ios: string; web: string };
  tintColor?: string;
  size?: number;
}

export function SymbolView({ name, tintColor, size = 14 }: SymbolViewProps) {
  return (
    <span
      style={{
        color: tintColor,
        fontSize: size,
        lineHeight: 1,
      }}
    >
      {name.web}
    </span>
  );
}
