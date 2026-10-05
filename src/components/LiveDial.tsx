import { useEffect, useState } from "react";

// The Dealer OS logo's gold rev-counter, with live clock hands drawn over it.
// flippilot-dial-clock.webp is the logo's dial with its needle taken out; the
// hands are positioned in that picture's own pixels (390 x 336), pivoting on
// the hub at its centre, so they stay on the hub at any display size.
const IMAGE_WIDTH = 390;
const IMAGE_HEIGHT = 336;
const HUB_X = 194.5;
const HUB_Y = 179.5;

export function handAngles(now: Date): { hour: number; minute: number; second: number } {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  return {
    hour: (hours + minutes / 60) * 30,
    minute: (minutes + seconds / 60) * 6,
    second: seconds * 6,
  };
}

export function clockText(now: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(now.getHours())}:${two(now.getMinutes())}`;
}

export function startTicking(onTick: () => void): () => void {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => startTicking(() => setNow(new Date())), []);
  return now;
}

function Hand({ angle, length, tail = 0, width, colour }: { angle: number; length: number; tail?: number; width: number; colour: string }) {
  return (
    <line
      x1={HUB_X}
      y1={HUB_Y + tail}
      x2={HUB_X}
      y2={HUB_Y - length}
      stroke={colour}
      strokeWidth={width}
      strokeLinecap="round"
      transform={`rotate(${Math.round(angle * 10) / 10} ${HUB_X} ${HUB_Y})`}
    />
  );
}

export function LiveDial() {
  const { hour, minute, second } = handAngles(useNow());
  return (
    <div className="relative w-[130px]">
      <img src="/brand/flippilot-dial-clock.webp" alt="" width={130} height={112} className="w-[130px] h-auto" />
      <svg
        viewBox={`0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        style={{ filter: "drop-shadow(0 0 3px rgba(255, 205, 60, 0.8))" }}
        aria-hidden="true"
      >
        <Hand angle={hour} length={78} width={13} colour="#f3d77a" />
        <Hand angle={minute} length={112} width={8.5} colour="#f3d77a" />
        <Hand angle={second} length={124} tail={26} width={3.5} colour="#fff3b8" />
        <circle cx={HUB_X} cy={HUB_Y} r={18} fill="#d4a017" />
        <circle cx={HUB_X} cy={HUB_Y} r={6.5} fill="#111026" />
      </svg>
    </div>
  );
}

export function LiveClockText({ className }: { className?: string }) {
  return <p className={className}>{clockText(useNow())}</p>;
}
