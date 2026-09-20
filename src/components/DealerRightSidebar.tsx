import { useLocation, useNavigate } from "react-router-dom";
import {
  FiPlusCircle,
  FiUserPlus,
  FiGrid,
  FiCheckSquare,
  FiCalendar,
  FiClipboard,
  FiSearch,
  FiAlertTriangle,
} from "react-icons/fi";
import { useInventory } from "@/context/InventoryProvider";
import { useJobs } from "@/context/JobsContext";
import { useAppointments } from "@/context/AppointmentsContext";

const QUICK_LINKS = [
  { to: "/new-flip", label: "Add Vehicle", icon: FiPlusCircle },
  { to: "/dealer/sales/add", label: "Add Lead", icon: FiUserPlus },
  { to: "/dealer/inventory/list", label: "Vehicle List", icon: FiGrid },
  { to: "/jobs", label: "Jobs Board", icon: FiCheckSquare },
  { to: "/my-rota", label: "My Rota", icon: FiCalendar },
  { to: "/consumables", label: "Consumables", icon: FiClipboard },
  { to: "/search", label: "Search", icon: FiSearch },
];

// This used to be a "System Status" panel showing "AI Engine: Online",
// "Sync Status: Syncing" etc — every line hardcoded, never changing no
// matter what was actually happening in the app. It occupied prime,
// always-visible screen space on every page with zero real content.
// Replaced with real quick links plus a small, genuinely computed "at
// a glance" block — same real per-vehicle/job/appointment data other
// real dashboard widgets in this app already use.
export default function DealerRightSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isHome =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/home" ||
    pathname === "/index";

  const { vehicles } = useInventory();
  const { jobs } = useJobs();
  const { appointments } = useAppointments();

  const motAlerts = vehicles.filter((v) => {
    const expiry = v.mot?.expiry;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

  const openJobs = jobs.filter((j) => j.status !== "done").length;
  const pendingAppointments = appointments.filter((a) => a.status === "pending").length;

  return (
    <aside
      className="
        w-60 h-screen fixed right-0 top-0
        bg-black/40 backdrop-blur-xl
        border-l border-yellow-400/20
        shadow-[0_0_40px_rgba(255,215,0,0.25)]
        p-6 flex flex-col relative overflow-hidden overflow-y-auto
        animate-fadeIn
      "
    >

      {/* GOLD COSMIC EDGE */}
      <div
        className="
          absolute left-0 top-0 h-full w-[3px]
          bg-yellow-400 opacity-90
          shadow-[0_0_25px_rgba(255,215,0,0.9)]
        "
      />

      {/* PARTICLE FIELD */}
      <div
        className="
          absolute inset-0 pointer-events-none opacity-20
          bg-[radial-gradient(circle_at_30%_20%,rgba(255,215,0,0.25),transparent_45%)]
          animate-pulse
        "
      />

      {!isHome && (
        <>
          <h2 className="text-yellow-300 font-bold text-xl mb-4 tracking-wider drop-shadow-[0_0_6px_rgba(255,215,0,0.6)] relative z-10">
            Quick Links
          </h2>

          <div className="space-y-1 relative z-10">
            {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="w-full flex items-center gap-3 text-left text-white/80 hover:text-yellow-300 hover:bg-white/5 transition px-2 py-2 rounded-lg text-sm"
              >
                <Icon className="shrink-0" />
                {label}
              </button>
            ))}
          </div>

          <h3 className="text-yellow-300/80 font-semibold text-xs uppercase tracking-wider mt-8 mb-3 relative z-10">
            At a Glance
          </h3>

          <div className="space-y-2 relative z-10 text-sm">
            <button
              onClick={() => navigate("/jobs")}
              className="w-full flex items-center justify-between text-left text-white/70 hover:text-yellow-300 transition px-2 py-1.5 rounded-lg hover:bg-white/5"
            >
              <span className="flex items-center gap-2"><FiCheckSquare /> Open Jobs</span>
              <span className="font-semibold text-white/90">{openJobs}</span>
            </button>

            <button
              onClick={() => navigate("/appointments")}
              className="w-full flex items-center justify-between text-left text-white/70 hover:text-yellow-300 transition px-2 py-1.5 rounded-lg hover:bg-white/5"
            >
              <span className="flex items-center gap-2"><FiCalendar /> Pending Bookings</span>
              <span className="font-semibold text-white/90">{pendingAppointments}</span>
            </button>

            <button
              onClick={() => navigate("/dealer/inventory/list")}
              className="w-full flex items-center justify-between text-left text-white/70 hover:text-yellow-300 transition px-2 py-1.5 rounded-lg hover:bg-white/5"
            >
              <span className="flex items-center gap-2"><FiAlertTriangle className={motAlerts > 0 ? "text-red-400" : ""} /> MOT Attention</span>
              <span className={`font-semibold ${motAlerts > 0 ? "text-red-400" : "text-white/90"}`}>{motAlerts}</span>
            </button>
          </div>
        </>
      )}

      {/* FOOTER */}
      <div className="mt-auto pt-10 text-white/60 text-xs relative z-10">
        FlipPilot © 2026
      </div>

      {/* ANIMATIONS */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
