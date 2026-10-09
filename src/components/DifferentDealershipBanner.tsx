import { useEffect, useState } from "react";
import { loginIsForAnotherDealership } from "@/lib/authToken";

// Another tab signed in to a different dealership. Every tab shares one login,
// so this tab's requests are now refused (the server won't save one
// dealership's lists into another's) and what it shows is out of date. Say so,
// and make the next step obvious, rather than leave the tab failing quietly.
export default function DifferentDealershipBanner() {
  const [changed, setChanged] = useState(loginIsForAnotherDealership);

  useEffect(() => {
    const check = () => setChanged(loginIsForAnotherDealership());
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return changed ? <DifferentDealershipCard /> : null;
}

export function DifferentDealershipCard() {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4">
      <div
        role="alertdialog"
        aria-labelledby="different-dealership-title"
        aria-describedby="different-dealership-text"
        className="bg-black/90 border border-yellow-400/40 p-6 rounded-xl w-full max-w-md"
      >
        <h2 id="different-dealership-title" className="text-yellow-300 text-xl font-semibold mb-2">
          You signed in to a different dealership
        </h2>
        <p id="different-dealership-text" className="text-white/70 text-sm mb-4">
          In another tab, you signed in to a different dealership. This page is still showing the one before, so it can't
          save anything safely. Nothing here has been saved to the other dealership. Reload to carry on with the dealership
          you signed in to last.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300"
          >
            Reload this page
          </button>
        </div>
      </div>
    </div>
  );
}
