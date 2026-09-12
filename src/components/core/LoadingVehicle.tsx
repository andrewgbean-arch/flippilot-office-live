import React from "react";

export default function LoadingVehicle() {
  return (
    <div className="p-4 flex flex-col items-center justify-center">
      <div className="loader mb-3" />
      <span className="text-gray-700 text-sm">Loading vehicle…</span>
    </div>
  );
}
