// @vitest-environment jsdom
/**
 * The coming-soon film: it runs for its length, it can be left early, it plays
 * once per visit, and the launch switch removes it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComingSoon } from "./coming-soon";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

// Exit animations run on frames that fake timers never deliver.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  useReducedMotion: () => true,
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        function Motion({ initial, animate, exit, transition, ...props }: Record<string, unknown>) {
          void [initial, animate, exit, transition];
          return createElement(tag, props);
        },
    },
  ),
}));

const flags = (coming_soon: boolean) =>
  vi.fn(async () => ({ ok: true, json: async () => ({ flags: { coming_soon } }) }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", flags(true));
  sessionStorage.clear();
  delete document.documentElement.dataset.ngSoon;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

const dialog = () => document.querySelector('[role="dialog"]');

describe("ComingSoon", () => {
  it("holds the page, reaches the coming-soon scene, and frees the page at 15 seconds", async () => {
    render(<ComingSoon />);
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_500);
    });
    expect(document.body.style.overflow).toBe("");
    expect(sessionStorage.getItem("ng-soon-seen")).toBe("1");
  });

  it("offers Skip only after a few seconds, and remembers it", async () => {
    render(<ComingSoon />);
    expect(screen.queryByText("Skip")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    fireEvent.click(screen.getByText("Skip"));

    expect(sessionStorage.getItem("ng-soon-seen")).toBe("1");
    expect(document.body.style.overflow).toBe("");
  });

  it("does not hold the page on a repeat view in the same visit", () => {
    document.documentElement.dataset.ngSoon = "seen";
    render(<ComingSoon />);
    expect(document.body.style.overflow).toBe("");
  });

  it("disappears completely once the launch switch is off", async () => {
    vi.stubGlobal("fetch", flags(false));
    render(<ComingSoon />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(dialog()).toBeNull();
    expect(screen.queryByText(/Coming soon/)).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps showing when the switch can't be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<ComingSoon />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("Coming soon. Nutri Greenz opens shortly.")).toBeTruthy();
  });
});
