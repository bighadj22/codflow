/**
 * Product Script — Preservation Tests
 *
 * These tests verify the product page script initializes correctly on
 * initial page load (variant selection, quantity steppers, price updates).
 * Client-side navigation was removed from the storefront (full page loads
 * only — see BaseHead.astro), so navigation re-initialization no longer
 * applies and its bug-exploration tests were deleted.
 */

import * as fc from "fast-check";

describe("Property 2: Preservation - Initial Page Load Behavior", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a fresh DOM for each test
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  /**
   * Helper function to create a complete product page DOM structure
   */
  function createProductPageDOM(config?: {
    variants?: Array<{ id: string; price: number; variations: Record<string, string>; isDefault?: boolean }>;
    basePrice?: number;
    hasOffers?: boolean;
    initialQuantity?: number;
  }) {
    const variants = config?.variants || [
      { id: "v1", price: 1000, compareAtPrice: null, variations: { Color: "Red" }, isDefault: true },
      { id: "v2", price: 1200, compareAtPrice: null, variations: { Color: "Blue" }, isDefault: false },
    ];
    const basePrice = config?.basePrice || 1000;
    const initialQuantity = config?.initialQuantity || 1;
    const offers = config?.hasOffers ? [
      {
        id: "offer1",
        discountType: "free",
        triggerQuantity: 2,
        triggerVariantId: null,
        rewardQuantity: 1,
        rewardProductName: "Free Item",
        rewardVariantLabel: null,
      },
    ] : [];

    const html = `
      <div id="page-data"
        data-variants='${JSON.stringify(variants)}'
        data-base-price="${basePrice}"
        data-cur="DA"
        data-is-rtl="0"
        data-shipping-calc="Calculated at checkout"
        data-shipping-free="Free"
        data-commune-placeholder="Select commune"
        data-commune-loading="Loading..."
        data-commune-disabled="Select wilaya first"
        data-offers='${JSON.stringify(offers)}'
      ></div>
      
      <input type="number" id="qty-input" value="${initialQuantity}" />
      <button id="qty-minus">-</button>
      <button id="qty-plus">+</button>
      
      <button class="variant-opt" data-option="Color" data-value="Red" data-first="1">Red</button>
      <button class="variant-opt" data-option="Color" data-value="Blue">Blue</button>
      
      <div id="gallery"></div>
      <button class="gallery-thumb" data-index="0">Thumb 1</button>
      <button class="gallery-thumb" data-index="1">Thumb 2</button>
      
      <div id="price-display-desktop"></div>
      <div id="price-display-mobile"></div>
      <div id="sticky-price"></div>
      <div id="summary-item-price"></div>
      <div id="summary-total"></div>
      <div id="summary-shipping"></div>
      <div id="summary-qty-label"></div>
      
      <input type="hidden" id="price-input" />
      <input type="hidden" id="variant-id-input" />
      <input type="hidden" id="variant-label-input" />
    `;
    
    container.innerHTML = html;
  }

  /**
   * Simulates initial page load by creating DOM and calling initProductPage directly
   */
  function simulateInitialPageLoad() {
    createProductPageDOM();
    
    // Call initProductPage directly to simulate what happens on initial page load
    // In the real browser, this is called by the auto-execution block
    const { initProductPage } = require("./product.ts");
    initProductPage();
    
    return container;
  }

  /**
   * Checks if interactive elements are functional
   */
  function checkInteractiveElementsFunctional(): {
    variantButtonsWork: boolean;
    quantitySteppersWork: boolean;
    priceDisplayUpdates: boolean;
  } {
    const variantButton = container.querySelector<HTMLButtonElement>(".variant-opt[data-value='Blue']");
    const qtyPlusButton = container.querySelector<HTMLButtonElement>("#qty-plus");
    const qtyInput = container.querySelector<HTMLInputElement>("#qty-input");
    const priceDisplay = container.querySelector<HTMLElement>("#price-display-desktop");
    
    // Test variant button functionality
    let variantButtonsWork = false;
    if (variantButton) {
      const initialClasses = variantButton.className;
      variantButton.click();
      const afterClickClasses = variantButton.className;
      // If event listener is attached, clicking should change classes
      variantButtonsWork = initialClasses !== afterClickClasses;
    }
    
    // Test quantity stepper functionality
    let quantitySteppersWork = false;
    if (qtyPlusButton && qtyInput) {
      const initialValue = parseInt(qtyInput.value);
      qtyPlusButton.click();
      const afterClickValue = parseInt(qtyInput.value);
      // If event listener is attached, clicking + should increment value
      quantitySteppersWork = afterClickValue > initialValue;
    }
    
    // Test price display updates
    let priceDisplayUpdates = false;
    if (priceDisplay) {
      // Price should be populated on initialization
      priceDisplayUpdates = priceDisplay.textContent !== null && priceDisplay.textContent.length > 0;
    }
    
    return {
      variantButtonsWork,
      quantitySteppersWork,
      priceDisplayUpdates,
    };
  }

  /**
   * Concrete test: Initial page load should initialize all interactive elements
   */
  it("should initialize all interactive elements on initial page load", () => {
    // Simulate initial page load
    simulateInitialPageLoad();
    
    // Check if interactive elements are functional
    const result = checkInteractiveElementsFunctional();
    
    // EXPECTED OUTCOME on UNFIXED code: These assertions PASS
    // This confirms the baseline behavior that must be preserved
    expect(result.variantButtonsWork).toBe(true);
    expect(result.quantitySteppersWork).toBe(true);
    expect(result.priceDisplayUpdates).toBe(true);
  });

  /**
   * Property-based test: For ANY initial page load configuration,
   * the script MUST initialize and all interactive elements MUST be functional.
   * 
   * This test uses fast-check to generate multiple product configurations.
   */
  it("property: script initializes correctly for all initial page load configurations", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary product configurations
        fc.record({
          basePrice: fc.integer({ min: 100, max: 10000 }),
          initialQuantity: fc.integer({ min: 1, max: 10 }),
          hasOffers: fc.boolean(),
          variantCount: fc.integer({ min: 1, max: 3 }),
        }),
        (config) => {
          // Setup: Create product page with generated configuration
          const testContainer = document.createElement("div");
          document.body.appendChild(testContainer);
          
          // Generate variants based on config
          const variants = Array.from({ length: config.variantCount }, (_, i) => ({
            id: `v${i + 1}`,
            price: config.basePrice + i * 100,
            variations: { Color: ["Red", "Blue", "Green"][i] || "Red" },
            isDefault: i === 0,
          }));
          
          const html = `
            <div id="page-data"
              data-variants='${JSON.stringify(variants)}'
              data-base-price="${config.basePrice}"
              data-cur="DA"
              data-is-rtl="0"
              data-shipping-calc="Calculated at checkout"
              data-shipping-free="Free"
              data-commune-placeholder="Select commune"
              data-commune-loading="Loading..."
              data-commune-disabled="Select wilaya first"
              data-offers='${config.hasOffers ? '[{"id":"o1","discountType":"free","triggerQuantity":2}]' : '[]'}'
            ></div>
            
            <input type="number" id="qty-input" value="${config.initialQuantity}" />
            <button id="qty-minus">-</button>
            <button id="qty-plus">+</button>
            
            ${variants.map((v, i) => `<button class="variant-opt" data-option="Color" data-value="${v.variations.Color}" ${i === 0 ? 'data-first="1"' : ''}>${v.variations.Color}</button>`).join('\n')}
            
            <div id="price-display-desktop"></div>
            <input type="hidden" id="price-input" />
            <input type="hidden" id="variant-id-input" />
          `;
          
          testContainer.innerHTML = html;
          
          // Simulate initial page load by calling initProductPage
          const { initProductPage } = require("./product.ts");
          initProductPage();
          
          // Verify: Interactive elements should be functional
          const qtyPlusButton = testContainer.querySelector<HTMLButtonElement>("#qty-plus");
          const qtyInput = testContainer.querySelector<HTMLInputElement>("#qty-input");
          const priceDisplay = testContainer.querySelector<HTMLElement>("#price-display-desktop");
          
          let quantitySteppersWork = false;
          if (qtyPlusButton && qtyInput) {
            const initialValue = parseInt(qtyInput.value);
            qtyPlusButton.click();
            const afterClickValue = parseInt(qtyInput.value);
            quantitySteppersWork = afterClickValue > initialValue;
          }
          
          const priceDisplayUpdates = priceDisplay && priceDisplay.textContent !== null && priceDisplay.textContent.length > 0;
          
          // Cleanup
          if (testContainer.parentNode) {
            testContainer.parentNode.removeChild(testContainer);
          }
          
          // EXPECTED OUTCOME on UNFIXED code: This property PASSES
          // Confirms baseline behavior across many configurations
          return quantitySteppersWork && !!priceDisplayUpdates;
        }
      ),
      {
        numRuns: 20, // Run 20 different configurations
        verbose: true,
      }
    );
  });

  /**
   * Edge case: Multiple initial page loads should each initialize correctly
   * 
   * This tests that the script can be loaded multiple times without issues.
   */
  it("edge case: script handles multiple initializations without errors", () => {
    // First initialization
    createProductPageDOM();
    const { initProductPage } = require("./product.ts");
    initProductPage();
    const result1 = checkInteractiveElementsFunctional();
    
    // Clean up and create new DOM
    container.innerHTML = "";
    
    // Second initialization
    createProductPageDOM({ basePrice: 2000, initialQuantity: 2 });
    initProductPage();
    const result2 = checkInteractiveElementsFunctional();
    
    // EXPECTED OUTCOME on UNFIXED code: Both PASS
    // Script should handle re-initialization gracefully
    expect(result1.quantitySteppersWork).toBe(true);
    expect(result2.quantitySteppersWork).toBe(true);
  });

  /**
   * Concrete test: Variant selection should work on initial page load
   */
  it("should allow variant selection on initial page load", () => {
    simulateInitialPageLoad();
    
    const redButton = container.querySelector<HTMLButtonElement>(".variant-opt[data-value='Red']");
    const blueButton = container.querySelector<HTMLButtonElement>(".variant-opt[data-value='Blue']");
    const variantIdInput = container.querySelector<HTMLInputElement>("#variant-id-input");
    
    expect(redButton).not.toBeNull();
    expect(blueButton).not.toBeNull();
    expect(variantIdInput).not.toBeNull();
    
    if (blueButton && variantIdInput) {
      // Click blue variant
      blueButton.click();
      
      // Variant ID should update
      expect(variantIdInput.value).toBe("v2");
    }
  });

  /**
   * Concrete test: Quantity steppers should work on initial page load
   */
  it("should allow quantity changes on initial page load", () => {
    simulateInitialPageLoad();
    
    const qtyInput = container.querySelector<HTMLInputElement>("#qty-input");
    const qtyPlusButton = container.querySelector<HTMLButtonElement>("#qty-plus");
    const qtyMinusButton = container.querySelector<HTMLButtonElement>("#qty-minus");
    
    expect(qtyInput).not.toBeNull();
    expect(qtyPlusButton).not.toBeNull();
    expect(qtyMinusButton).not.toBeNull();
    
    if (qtyInput && qtyPlusButton && qtyMinusButton) {
      // Initial value should be 1
      expect(parseInt(qtyInput.value)).toBe(1);
      
      // Click plus button
      qtyPlusButton.click();
      expect(parseInt(qtyInput.value)).toBe(2);
      
      // Click plus again
      qtyPlusButton.click();
      expect(parseInt(qtyInput.value)).toBe(3);
      
      // Click minus button
      qtyMinusButton.click();
      expect(parseInt(qtyInput.value)).toBe(2);
    }
  });

  /**
   * Concrete test: Price display should update on initial page load
   */
  it("should display and update prices on initial page load", () => {
    simulateInitialPageLoad();
    
    const priceDisplay = container.querySelector<HTMLElement>("#price-display-desktop");
    const qtyInput = container.querySelector<HTMLInputElement>("#qty-input");
    const qtyPlusButton = container.querySelector<HTMLButtonElement>("#qty-plus");
    
    expect(priceDisplay).not.toBeNull();
    
    if (priceDisplay && qtyInput && qtyPlusButton) {
      // Price should be displayed initially
      expect(priceDisplay.textContent).toContain("1");
      
      // Change quantity
      qtyPlusButton.click();
      
      // Summary should update (we're checking that the script is responsive)
      const summaryItemPrice = container.querySelector<HTMLElement>("#summary-item-price");
      if (summaryItemPrice) {
        expect(summaryItemPrice.textContent).toContain("2");
      }
    }
  });
});
