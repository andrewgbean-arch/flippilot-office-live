import { describe, it, expect, vi, afterEach } from "vitest";
import {
  reportLoadFailure,
  clearLoadFailure,
  subscribeToLoadFailures,
  getLoadFailures,
  listLabels,
} from "./loadFailures";

// The registry behind the shared "couldn't load your X" banner.

const retry = async () => {};

afterEach(() => {
  ["jobs", "leads", "rota"].forEach(clearLoadFailure);
});

describe("load failure registry", () => {
  it("starts empty", () => {
    expect(getLoadFailures()).toEqual([]);
  });

  it("lists every reported failure until it is cleared", () => {
    reportLoadFailure({ id: "jobs", label: "jobs", retry });
    reportLoadFailure({ id: "leads", label: "leads", retry });
    expect(getLoadFailures().map(f => f.label)).toEqual(["jobs", "leads"]);
    clearLoadFailure("jobs");
    expect(getLoadFailures().map(f => f.label)).toEqual(["leads"]);
  });

  it("reporting the same id again replaces it instead of listing it twice", () => {
    reportLoadFailure({ id: "jobs", label: "jobs", retry });
    reportLoadFailure({ id: "jobs", label: "jobs", retry });
    expect(getLoadFailures()).toHaveLength(1);
  });

  it("notifies subscribers on change, and not once they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLoadFailures(listener);
    reportLoadFailure({ id: "jobs", label: "jobs", retry });
    clearLoadFailure("jobs");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    reportLoadFailure({ id: "jobs", label: "jobs", retry });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("clearing something that was never reported changes nothing and notifies nobody", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLoadFailures(listener);
    const before = getLoadFailures();
    clearLoadFailure("rota");
    expect(listener).not.toHaveBeenCalled();
    expect(getLoadFailures()).toBe(before); // same array, so React doesn't re-render
    unsubscribe();
  });

  it("hands back the same array until something actually changes", () => {
    reportLoadFailure({ id: "jobs", label: "jobs", retry });
    expect(getLoadFailures()).toBe(getLoadFailures());
  });
});

describe("listLabels", () => {
  it("reads naturally for one, two and many", () => {
    expect(listLabels([])).toBe("");
    expect(listLabels(["jobs"])).toBe("jobs");
    expect(listLabels(["jobs", "leads"])).toBe("jobs and leads");
    expect(listLabels(["jobs", "leads", "rota"])).toBe("jobs, leads and rota");
  });
});
