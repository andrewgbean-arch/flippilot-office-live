import { useLocation } from "react-router-dom";
import {
  FiSearch,
  FiCpu,
  FiBell,
  FiMessageSquare,
} from "react-icons/fi";
import { FaCarSide } from "react-icons/fa";
import { FiTrendingUp } from "react-icons/fi";

export default function DashboardFooter() {
  const { pathname } = useLocation();

  const isHome =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/home" ||
    pathname === "/index";

  // ⭐ Hide footer on HomeScreen
  if (isHome) return null;

  const mainActions = [
    {
      label: "Add Vehicle",
      icon: <FaCarSide className="text-blue-300" />,
      to: "/vehicles/new",
    },
    {
      label: "New Flip",
      icon: <FiTrendingUp className="text-green-300" />,
      to: "/flip/new",
    },
    {
      label: "AI Scan",
      icon: <FiCpu className="text-purple-300" />,
      to: "/ai-insights",
    },
    {
      label: "Search",
      icon: <FiSearch className="text-pink-300" />,
      to: "/search",
    },
  ];

  const comms = [
    {
      label: "Messages",
      icon: <FiMessageSquare className="text-yellow-300" />,
      to: "/messages",
    },
    {
      label: "Chat",
      icon: <FiMessageSquare className="text-teal-300" />,
      to: "/chat",
    },
  ];

  return (
    <div
      className="
        fixed bottom-0 left-0 w-full z-50
        pl-60 pr-60
        bg-black/40 backdrop-blur-xl
        border-t border-yellow-400/20
        shadow-[0_0_25px_rgba(255,215,0,0.25)]
        py-2 px-6 flex justify-between items-center
        animate-fadeIn
      "
    >

      {/* LEFT — MAIN ACTIONS */}
      <div className="flex gap-12">
        {mainActions.map((a, i) => (
          <a
            key={i}
            href={a.to}
            className="
              flex flex-col items-center gap-1
              text-white/80 hover:text-yellow-300 transition
              group
            "
          >
            <div className="text-xl group-hover:scale-125 transition drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
              {a.icon}
            </div>
            <span className="text-[10px] font-medium tracking-wide">
              {a.label}
            </span>
          </a>
        ))}
      </div>

      {/* CENTER — COMMS */}
      <div className="flex gap-12">
        {comms.map((c, i) => (
          <a
            key={i}
            href={c.to}
            className="
              flex flex-col items-center gap-1
              text-white/80 hover:text-yellow-300 transition
              group
            "
          >
            <div className="text-xl group-hover:scale-125 transition drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
              {c.icon}
            </div>
            <span className="text-[10px] font-medium tracking-wide">
              {c.label}
            </span>
          </a>
        ))}
      </div>

      {/* RIGHT — ALERTS */}
      <div className="flex items-center gap-3">
        <div className="relative cursor-pointer group">
          <FiBell className="text-white/70 text-2xl group-hover:text-yellow-300 transition" />
          <span
            className="
              absolute -top-1 -right-1 w-3 h-3 bg-red-500
              rounded-full animate-pulse shadow-[0_0_6px_rgba(255,0,0,0.6)]
            "
          />
        </div>
        <p className="text-xs text-white/60">3 Alerts</p>
      </div>
    </div>
  );
}
