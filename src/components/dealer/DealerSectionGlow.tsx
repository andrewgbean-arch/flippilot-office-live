import React from "react";

type Props = {
  title: string;
  children?: React.ReactNode;
};

const DealerSectionGlow = ({ title, children }: Props) => {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ color: "white" }}>{title}</h2>
      <div>{children}</div>
    </div>
  );
};

export default DealerSectionGlow;

