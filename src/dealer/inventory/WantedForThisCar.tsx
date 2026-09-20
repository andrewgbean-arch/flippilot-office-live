import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadWanted } from "@/lib/wantedApi";
import { waitingForCar, waitingSentence } from "@/dealer/sales/wantedBoardModel";

// On a car's page: how many people have asked to be told about a car like this,
// with a way to see who. Shows nothing at all when nobody is waiting, and also
// nothing (rather than an error) for staff who aren't allowed to see the list.
export default function WantedForThisCar({ vehicleId }: { vehicleId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCount(0);
    loadWanted().then(res => {
      if (!cancelled && res.ok && res.data) setCount(waitingForCar(res.data.items, vehicleId).length);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (count === 0) return null;
  return (
    <Link
      to="/dealer/sales/wanted"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-yellow-500/40 bg-yellow-400/10 px-4 py-3 text-yellow-100 hover:bg-yellow-400/15"
    >
      <span className="font-semibold">{waitingSentence(count)}</span>
      <span className="text-sm underline">See who →</span>
    </Link>
  );
}
