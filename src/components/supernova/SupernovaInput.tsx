import React from "react";

interface SupernovaInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}

export function SupernovaInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
}: SupernovaInputProps) {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-yellow-400 font-semibold text-sm">
        {label}
      </label>

      {multiline ? (
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="
            bg-black/40 border border-white/10 rounded-lg p-3 text-white
            focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_10px_rgba(255,215,0,0.4)]
            transition w-full min-h-[100px]
          "
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="
            bg-black/40 border border-white/10 rounded-lg p-3 text-white
            focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_10px_rgba(255,215,0,0.4)]
            transition w-full
          "
        />
      )}
    </div>
  );
}
