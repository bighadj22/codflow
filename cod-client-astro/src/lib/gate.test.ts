import { describe, it, expect } from "vitest";
import { resolveGate, signInRedirect, postSignInTarget } from "./gate";

describe("resolveGate", () => {
  it("undefined identity = still pending", () => {
    expect(resolveGate(undefined)).toBe("pending");
  });
  it("null identity = anonymous", () => {
    expect(resolveGate(null)).toBe("anonymous");
  });
  it("identity object = authenticated", () => {
    const id = { user: { id: "u", email: "e@x.y" }, role: "staff" as const, scopes: [] };
    expect(resolveGate(id)).toBe("authenticated");
  });
});

describe("redirects", () => {
  it("sign-in redirect preserves the attempted path", () => {
    expect(signInRedirect("/orders")).toBe("/sign-in?next=%2Forders");
  });
  it("post-sign-in honours safe same-origin next paths", () => {
    expect(postSignInTarget("/orders")).toBe("/orders");
  });
  it("post-sign-in blocks protocol-relative and foreign targets", () => {
    expect(postSignInTarget("//evil.example.com")).toBe("/dashboard");
    expect(postSignInTarget("https://evil.example.com")).toBe("/dashboard");
    expect(postSignInTarget(null)).toBe("/dashboard");
  });
});
