import React from "react";

type Props = {
  title: string;
  children?: React.ReactNode;
};

const DealerNeonHeader = ({ title, children }: Props) => {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-yellow-400 tracking-wide drop-shadow-[0_0_6px_rgba(255,215,0,0.4)]">
        {title}
      </h2>

      {children && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
};

export default DealerNeonHeader;

