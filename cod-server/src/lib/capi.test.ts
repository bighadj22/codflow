import { describe, it, expect, afterEach, vi } from "vitest";
import { sendCapiEvent, type CapiEventPayload } from "./capi";

/**
 * Meta CAPI client — payload shape, hashing/normalisation, and error
 * classification. Fixed SHA-256 vectors (lowercase, whitespace-stripped
 * inputs) were precomputed with Node crypto.
 */

const PH_213555123456 = "57bc2227c5cf190ba5390a9a06771e92b4863d7054546c3856e44ec12e56a5e3";
const CT_AINOUSSERA = "bff099d55f6e1eaf21a4308943012fc0357d961032e632ee0759398ccc02d2b8";
const CT_SIDIMHAMED = "e91c59e06a0de2500bbf97ffea89ff0e8800bdaf36075c92b587fad41c916096";
const FN_MOHAMED = "575e500ddb529cc2e5b14dd6e7feb389a8b6e0d7c2b162b6bf31831c64d23592";
const LN_BENALI = "cbf639d625d373b0cb767a553cd1a5e6c72a0224080f8187913d3067370db914";
const FN_ARABIC = "0cb4c9b21062de4d2c0edd48efc9fa86b97fdc8a6a4e7fa7092544f84e121f61";
const EXT_CUST123 = "fc3ce5a6986e1e0556c777fcaa0dfb75642361b8f7332c672a3799aa0e709127";
const ZP_16000 = "2570901c76653e578fecf066b5fc3fa1619f1a051e928e39797bab1b1342bf40";
const COUNTRY_DZ = "2a92270185a50d8020949f2cfb2125d1af1c2bd3dd92eada9210fcdb5c4310bf";

const PIXEL = "1234567890";
const TOKEN = "EAAG-test-token";

function basePayload(overrides: Partial<CapiEventPayload> = {}): CapiEventPayload {
  return {
    eventName: "Purchase",
    eventId: "order-1",
    eventTime: 1700000000,
    userData: { phone: "0555123456" },
    value: 5000,
    currency: "DZD",
    contentIds: ["prod-1"],
    ...overrides,
  };
}

function metaOk() {
  return new Response(JSON.stringify({ events_received: 1, fbtrace_id: "TRACE1" }), { status: 200 });
}

interface Captured {
  url: string;
  body: any;
}

function stubFetch(response: () => Response): Captured {
  const captured: Captured = { url: "", body: null };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.body = JSON.parse(init.body as string);
      return response();
    })
  );
  return captured;
}

afterEach(() => vi.unstubAllGlobals());

describe("sendCapiEvent — request shape", () => {
  it("posts to the current Graph API version with the token in the query string", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, basePayload());
    expect(captured.url).toBe(
      `https://graph.facebook.com/v26.0/${PIXEL}/events?access_token=${TOKEN}`
    );
  });

  it("sends the canonical event envelope", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, basePayload({ eventSourceUrl: "https://store.example/prod" }));
    const [event] = captured.body.data;
    expect(event.event_name).toBe("Purchase");
    expect(event.event_id).toBe("order-1");
    expect(event.event_time).toBe(1700000000);
    expect(event.action_source).toBe("website");
    expect(event.event_source_url).toBe("https://store.example/prod");
    expect(event.custom_data).toEqual({
      value: 5000,
      currency: "DZD",
      content_ids: ["prod-1"],
      content_type: "product",
    });
  });

  it("omits custom_data and event_source_url when not provided", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(
      PIXEL,
      TOKEN,
      basePayload({ value: undefined, contentIds: undefined, eventSourceUrl: undefined })
    );
    const [event] = captured.body.data;
    expect(event.custom_data).toBeUndefined();
    expect(event.event_source_url).toBeUndefined();
  });

  it("includes test_event_code only when provided", async () => {
    const without = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, basePayload());
    expect(without.body.test_event_code).toBeUndefined();

    const withCode = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, basePayload({ testEventCode: "TEST123" }));
    expect(withCode.body.test_event_code).toBe("TEST123");
  });
});

describe("sendCapiEvent — user_data hashing and normalisation", () => {
  it("hashes phone and country, passes fbc/fbp/ip/ua through unhashed", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, {
      ...basePayload(),
      userData: {
        phone: "0555123456",
        fbc: "fb.1.1700000000.abc",
        fbp: "fb.1.1700000001.123",
        clientIpAddress: "41.100.1.1",
        clientUserAgent: "Mozilla/5.0",
      },
    });
    const ud = captured.body.data[0].user_data;
    expect(ud.ph).toBe(PH_213555123456);
    expect(ud.country).toBe(COUNTRY_DZ);
    expect(ud.fbc).toBe("fb.1.1700000000.abc");
    expect(ud.fbp).toBe("fb.1.1700000001.123");
    expect(ud.client_ip_address).toBe("41.100.1.1");
    expect(ud.client_user_agent).toBe("Mozilla/5.0");
  });

  it.each(["0555123456", "00213555123456", "+213 555 12 34 56", "213555123456"])(
    "normalises every DZ phone form to 213… (%s)",
    async (phone) => {
      const captured = stubFetch(metaOk);
      await sendCapiEvent(PIXEL, TOKEN, basePayload({ userData: { phone } }));
      expect(captured.body.data[0].user_data.ph).toBe(PH_213555123456);
    }
  );

  it("folds diacritics and strips punctuation/spaces from city", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, {
      ...basePayload(),
      userData: { phone: "0555123456", city: "Aïn Oussera" },
    });
    expect(captured.body.data[0].user_data.ct).toBe(CT_AINOUSSERA);

    const captured2 = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, {
      ...basePayload(),
      userData: { phone: "0555123456", city: "Sidi M'hamed" },
    });
    expect(captured2.body.data[0].user_data.ct).toBe(CT_SIDIMHAMED);
  });

  it("hashes first/last names, keeping Unicode letters (Arabic survives)", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, {
      ...basePayload(),
      userData: { phone: "0555123456", firstName: "Mohamed", lastName: "Ben-Ali" },
    });
    const ud = captured.body.data[0].user_data;
    expect(ud.fn).toBe(FN_MOHAMED);
    expect(ud.ln).toBe(LN_BENALI);

    const capturedAr = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, {
      ...basePayload(),
      userData: { phone: "0555123456", firstName: "محمد" },
    });
    expect(capturedAr.body.data[0].user_data.fn).toBe(FN_ARABIC);
  });

  it("hashes external_id and postal code", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, {
      ...basePayload(),
      userData: { phone: "0555123456", externalId: "cust-123", postalCode: "16000" },
    });
    const ud = captured.body.data[0].user_data;
    expect(ud.external_id).toBe(EXT_CUST123);
    expect(ud.zp).toBe(ZP_16000);
  });

  it("omits optional user_data keys entirely when absent", async () => {
    const captured = stubFetch(metaOk);
    await sendCapiEvent(PIXEL, TOKEN, basePayload());
    const ud = captured.body.data[0].user_data;
    expect(Object.keys(ud).sort()).toEqual(["country", "ph"]);
  });
});

describe("sendCapiEvent — error classification", () => {
  it("throws on network failure (retryable)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      })
    );
    await expect(sendCapiEvent(PIXEL, TOKEN, basePayload())).rejects.toThrow("Meta CAPI network error");
  });

  it("throws on Meta 5xx (retryable)", async () => {
    const captured = stubFetch(
      () => new Response(JSON.stringify({ error: { message: "Transient failure" } }), { status: 502 })
    );
    await expect(sendCapiEvent(PIXEL, TOKEN, basePayload())).rejects.toThrow(
      "Meta CAPI server error 502: Transient failure"
    );
    expect(captured.body.data).toBeDefined();
  });

  it("returns success:false on Meta 4xx (not retryable — batch rejected)", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ error: { message: "(#100) Param event_time is invalid" } }),
          { status: 400 }
        )
    );
    const result = await sendCapiEvent(PIXEL, TOKEN, basePayload());
    expect(result).toEqual({
      success: false,
      error: "(#100) Param event_time is invalid",
    });
  });

  it("returns success with fbtrace_id on a 2xx events_received=1", async () => {
    stubFetch(metaOk);
    const result = await sendCapiEvent(PIXEL, TOKEN, basePayload());
    expect(result).toEqual({ success: true, fbtrace_id: "TRACE1" });
  });
});
