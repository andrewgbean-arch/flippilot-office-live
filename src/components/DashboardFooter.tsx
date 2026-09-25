import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  FiSearch,
  FiCheckCircle,
  FiBell,
} from "react-icons/fi";
import { FaCarSide } from "react-icons/fa";
import { FiMessageCircle } from "react-icons/fi";
import { useDealerNotifications } from "@/features/dealer-notifications/DealerNotificationsContext";
// The notification dropdown's actual styling (.sn-alerts-dropdown etc.)
// only ever lived in the Staff module's stylesheet, even though this
// footer — rendered on nearly every page — is what actually uses it.
// Without this import, the dropdown rendered with zero styling (no
// position, no background, no size) on any page reached without first
// visiting a staff screen in the same session, making the bell look
// completely broken — it was toggling real state the whole time, just
// invisibly.
import "@/staff/StaffDashboard.css";

export default function DashboardFooter() {
  const { pathname } = useLocation();
  const { notifications, clearNotification, clearAll } = useDealerNotifications();
  const [showAlerts, setShowAlerts] = useState(false);

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
      to: "/new-flip",
    },
    // Was "New Flip", a second button to the same Add Vehicle page. Wendy
    // (Pilot Brain) gets the slot: one tap to ask her something.
    {
      label: "Ask Wendy",
      icon: <FiMessageCircle className="text-yellow-300" />,
      to: "/pilot-brain",
    },
    // Was "AI Scan", which opened the AI Insights screen (removed: its
    // scores were constants). The MOT lookup is the real "scan": type a
    // registration and it returns the DVSA record.
    {
      label: "MOT Check",
      icon: <FiCheckCircle className="text-purple-300" />,
      to: "/dealer/inventory/mot-lookup",
    },
    {
      label: "Search",
      icon: <FiSearch className="text-pink-300" />,
      to: "/search",
    },
  ];

  return (
    <div
      data-tour="tour-bottom-bar"
      className="
        fixed bottom-0 left-0 w-full z-50
        lg:pl-60 lg:pr-60
        bg-black/40 backdrop-blur-xl
        border-t border-yellow-400/20
        shadow-[0_0_25px_rgba(255,215,0,0.25)]
        py-2 px-3 lg:px-6 flex justify-between items-center
        animate-fadeIn
      "
    >

      {/* LEFT — MAIN ACTIONS
          overflow-x-auto lives here now, not on the footer's outer
          wrapper — CSS forces overflow-y to also become "auto" (never
          fully "visible") whenever overflow-x isn't "visible", which
          was silently clipping the alerts dropdown below: it's
          absolutely positioned to pop UP above the footer bar, and the
          outer wrapper's implicit vertical clip was cutting it off
          entirely, even though it computed a perfectly correct
          position/size/z-index. Only the icon row actually needs to
          scroll horizontally on narrow screens. */}
      <div className="flex gap-4 lg:gap-12 overflow-x-auto">
        {mainActions.map((a, i) => {
          // Light up the button for the page you're on.
          const current = pathname === a.to;
          return (
          <Link
            key={i}
            to={a.to}
            aria-current={current ? "page" : undefined}
            className={`
              flex flex-col items-center gap-1 transition group
              rounded-lg px-2 pt-1 border-b-2
              ${current ? "text-yellow-300 border-yellow-400 bg-yellow-400/10" : "text-white/80 hover:text-yellow-300 border-transparent"}
            `}
          >
            <div className="text-xl group-hover:scale-125 transition drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
              {a.icon}
            </div>
            <span className="text-[10px] font-medium tracking-wide">
              {a.label}
            </span>
          </Link>
          );
        })}
      </div>

      {/* RIGHT — ALERTS */}
      <div data-tour="tour-bell" className="relative">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setShowAlerts(prev => !prev)}
        >
          <div className="relative group">
            <FiBell className="text-white/70 text-2xl group-hover:text-yellow-300 transition" />
            {notifications.length > 0 && (
              <span
                className="
                  absolute -top-1 -right-1 w-3 h-3 bg-red-500
                  rounded-full animate-pulse shadow-[0_0_6px_rgba(255,0,0,0.6)]
                "
              />
            )}
          </div>
          <p className="text-xs text-white/60">{notifications.length} Alerts</p>
        </div>

        {showAlerts && (
          <div className="sn-alerts-dropdown">
            {notifications.length === 0 ? (
              <p className="sn-empty">No alerts yet.</p>
            ) : (
              <>
                {notifications
                  .slice()
                  .reverse()
                  .map(n => (
                    <div
                      key={n.id}
                      className="sn-alert-item"
                      onClick={() => clearNotification(n.id)}
                    >
                      <span className="sn-alert-item__type">{n.type}</span>
                      <span className="sn-alert-item__message">{n.message}</span>
                    </div>
                  ))}
                <button className="sn-alerts-clear" onClick={clearAll}>
                  Clear all
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* STARFIELD/ANIMATIONS */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}