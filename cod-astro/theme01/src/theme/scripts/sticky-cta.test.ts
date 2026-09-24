/**
 * Sticky CTA script tests.
 *
 * Pins the contract:
 * - Inert when elements are missing.
 * - Shows on mobile when above form.
 * - Hides smoothly when form enters viewport or is scrolled past.
 * - Teardown disconnects observer cleanly.
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initStickyCta } from "./sticky-cta";

describe("initStickyCta", () => {
  let observerCallback: (entries: IntersectionObserverEntry[]) => void;
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    observeMock = vi.fn();
    disconnectMock = vi.fn();

    class MockIntersectionObserver {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        observerCallback = callback;
      }
      observe = observeMock;
      disconnect = disconnectMock;
      unobserve = vi.fn();
      takeRecords = vi.fn().mockReturnValue([]);
    }

    global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("is inert when neither CTA nor form exists", () => {
    const teardown = initStickyCta();
    expect(teardown).toBeUndefined();
    expect(observeMock).not.toHaveBeenCalled();
  });

  it("is inert when CTA exists but form does not", () => {
    document.body.innerHTML = '<a id="product-sticky-cta" class="product-sticky-cta"></a>';
    const teardown = initStickyCta();
    expect(teardown).toBeUndefined();
    expect(observeMock).not.toHaveBeenCalled();
  });

  it("is inert when form exists but CTA does not", () => {
    document.body.innerHTML = '<div id="order-section"></div>';
    const teardown = initStickyCta();
    expect(teardown).toBeUndefined();
    expect(observeMock).not.toHaveBeenCalled();
  });

  it("observes #order-section when #product-sticky-cta and #order-section exist", () => {
    document.body.innerHTML = `
      <a id="product-sticky-cta" class="product-sticky-cta">Order Now</a>
      <div id="order-section"></div>
    `;

    const teardown = initStickyCta();
    expect(teardown).toBeTypeOf("function");
    expect(observeMock).toHaveBeenCalledTimes(1);

    const form = document.getElementById("order-section")!;
    expect(observeMock).toHaveBeenCalledWith(form);
  });

  it("toggles .is-hidden when order form enters viewport and when it leaves", () => {
    document.body.innerHTML = `
      <a id="product-sticky-cta" class="product-sticky-cta">Order Now</a>
      <div id="order-section"></div>
    `;

    const cta = document.getElementById("product-sticky-cta")!;
    initStickyCta();

    // Form enters viewport (scrolling down to form)
    observerCallback([
      {
        isIntersecting: true,
        boundingClientRect: { top: 100 } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
    ]);
    expect(cta.classList.contains("is-hidden")).toBe(true);

    // Form leaves viewport towards bottom (scrolling back up)
    observerCallback([
      {
        isIntersecting: false,
        boundingClientRect: { top: 500 } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
    ]);
    expect(cta.classList.contains("is-hidden")).toBe(false);

    // Form scrolled past completely (user in reviews below form)
    observerCallback([
      {
        isIntersecting: false,
        boundingClientRect: { top: -200 } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
    ]);
    expect(cta.classList.contains("is-hidden")).toBe(true);
  });

  it("supports landing page IDs (#lp-sticky-cta and #order-section-wrapper)", () => {
    document.body.innerHTML = `
      <a id="lp-sticky-cta" class="lp-sticky-cta">Order Now</a>
      <div id="order-section-wrapper"></div>
    `;

    const cta = document.getElementById("lp-sticky-cta")!;
    const form = document.getElementById("order-section-wrapper")!;

    const teardown = initStickyCta();
    expect(observeMock).toHaveBeenCalledWith(form);

    observerCallback([
      {
        isIntersecting: true,
        boundingClientRect: { top: 50 } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
    ]);
    expect(cta.classList.contains("is-hidden")).toBe(true);

    teardown?.();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
