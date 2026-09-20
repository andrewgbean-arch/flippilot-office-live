import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CarPassportView, { passportPageTitle } from "./CarPassportView";
import { loadPublicPassport, type PassportLoad } from "./publicPassportApi";

// The page a buyer opens from a QR code or a shared link: /car/:dealershipId/:vehicleId.
// Reachable with no account (see publicPassportApi.ts). It shows only what the
// backend chose to send for a car the dealer published.
function Notice({ title, children }: { title: string; children?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-center text-white">
      <div className="max-w-sm">
        <h1 className="text-xl font-bold text-yellow-300">{title}</h1>
        {children && <p className="mt-2 text-white/75">{children}</p>}
      </div>
    </div>
  );
}

export default function PublicCarPassportPage() {
  const { dealershipId, vehicleId } = useParams();
  const [load, setLoad] = useState<PassportLoad | null>(null);

  useEffect(() => {
    if (!dealershipId || !vehicleId) {
      setLoad({ status: "unavailable" });
      return;
    }
    let cancelled = false;
    setLoad(null);
    loadPublicPassport(dealershipId, vehicleId).then(result => {
      if (!cancelled) setLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dealershipId, vehicleId]);

  useEffect(() => {
    if (load?.status !== "ok") return;
    const before = document.title;
    document.title = passportPageTitle(load.passport);
    return () => {
      document.title = before;
    };
  }, [load]);

  if (!load) return <Notice title="Loading…" />;
  if (load.status === "unavailable") {
    return <Notice title="This car page isn't available">It may have been taken down, or the link may be wrong. Ask the dealer for the current link.</Notice>;
  }
  if (load.status === "error") return <Notice title="Couldn't load this page">Check your connection and try again.</Notice>;

  return <CarPassportView passport={load.passport} dealershipId={dealershipId as string} />;
}
