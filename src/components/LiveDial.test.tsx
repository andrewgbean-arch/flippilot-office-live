import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { clockText, handAngles, LiveClockText, LiveDial, startTicking } from "./LiveDial";

// The sidebar logo's live clock: the gold dial with hour, minute and second
// hands, and the time in digits under it.

const at = (h: number, m: number, s = 0) => new Date(2030, 0, 1, h, m, s);

describe("where the hands point", () => {
  it("points everything at 12 on the hour at midnight and noon", () => {
    expect(handAngles(at(0, 0, 0))).toEqual({ hour: 0, minute: 0, second: 0 });
    expect(handAngles(at(12, 0, 0))).toEqual({ hour: 0, minute: 0, second: 0 });
  });

  it("puts the hour hand at 3 o'clock at 3:00 and 3 pm alike", () => {
    expect(handAngles(at(3, 0)).hour).toBe(90);
    expect(handAngles(at(15, 0)).hour).toBe(90);
  });

  it("moves the hour hand on as the minutes pass, so 9:15 is a quarter past the 9", () => {
    expect(handAngles(at(9, 15)).hour).toBe(277.5);
    expect(handAngles(at(12, 30)).hour).toBe(15);
  });

  it("moves the minute hand on with the seconds", () => {
    expect(handAngles(at(1, 30, 0)).minute).toBe(180);
    expect(handAngles(at(1, 30, 30)).minute).toBe(183);
  });

  it("gives the second hand six degrees a second", () => {
    expect(handAngles(at(1, 0, 15)).second).toBe(90);
    expect(handAngles(at(1, 0, 59)).second).toBe(354);
  });
});

describe("the time in digits", () => {
  it("is the 24-hour time with leading zeros", () => {
    expect(clockText(at(9, 5))).toBe("09:05");
    expect(clockText(at(13, 47))).toBe("13:47");
    expect(clockText(at(0, 0))).toBe("00:00");
    expect(clockText(at(23, 59))).toBe("23:59");
  });
});

describe("keeping time", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ticks once a second", () => {
    const tick = vi.fn();
    startTicking(tick);
    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("stops when the logo goes off the screen, so nothing keeps running behind it", () => {
    const tick = vi.fn();
    const stop = startTicking(tick);
    vi.advanceTimersByTime(2000);
    stop();
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});

describe("what is drawn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at(3, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("draws the needle-less dial, not the old one with its needle fixed in place", () => {
    const html = renderToStaticMarkup(<LiveDial />);
    expect(html).toContain("/brand/flippilot-dial-clock.webp");
    expect(html).not.toContain("/brand/flippilot-dial.webp");
  });

  it("turns each hand on the hub to the current time", () => {
    const html = renderToStaticMarkup(<LiveDial />);
    expect(html).toContain('transform="rotate(90 194.5 179.5)"'); // hour, 3:00:00
    expect(html).toContain('transform="rotate(0 194.5 179.5)"'); // minute and second
  });

  it("is decoration only: hidden from screen readers", () => {
    expect(renderToStaticMarkup(<LiveDial />)).toContain('aria-hidden="true"');
  });

  it("writes the time under the logo", () => {
    expect(renderToStaticMarkup(<LiveClockText className="x" />)).toBe('<p class="x">03:00</p>');
  });
});
