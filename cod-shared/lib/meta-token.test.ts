import { describe, it, expect } from "vitest";
import { isMetaAccessToken } from "./meta-token";

/**
 * The token guard exists because a placeholder saved in Settings → Tracking
 * is accepted by the API and only fails later, inside the event log. These
 * cases pin the two legitimate Meta shapes and the values that must never be
 * stored as one.
 */

const USER_TOKEN = `EAA${"Ab3dEf6hIj9k".repeat(8)}`;
const APP_TOKEN = `123456789012345|${"a1b2c3d4".repeat(4)}`;

describe("isMetaAccessToken", () => {
  it("accepts a long EAA user/system token", () => {
    expect(isMetaAccessToken(USER_TOKEN)).toBe(true);
  });

  it("accepts the characters a real token can contain", () => {
    expect(isMetaAccessToken(`EAA${"aA0+/=_-".repeat(8)}`)).toBe(true);
  });

  it("accepts an appId|appSecret app token", () => {
    expect(isMetaAccessToken(APP_TOKEN)).toBe(true);
  });

  it("rejects an all-A placeholder", () => {
    expect(isMetaAccessToken("AAAAAAAAAAAAAAAA")).toBe(false);
  });

  it.each([
    "",
    "   ",
    "EAAG-real-token",
    "EAA short",
    "EAA_with space_but_long_enough_to_reach_the_length_check",
    "Bearer EAA1234567890123456789012345678901234567890",
    "••••a9f2",
    `${USER_TOKEN}\n`,
    "123456789012345",
  ])("rejects %j", (value) => {
    expect(isMetaAccessToken(value)).toBe(false);
  });
});
