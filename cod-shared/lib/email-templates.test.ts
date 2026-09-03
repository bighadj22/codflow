/**
 * Email templates — unit tests
 *
 * Pins the contract every consumer (invite send, password reset) relies on:
 * localized subject + direction, URL/secret presence in both html and text,
 * and HTML escaping of caller-supplied strings (store and person names).
 */

import { describe, it, expect } from "vitest";
import {
  renderInviteEmail,
  renderPasswordResetEmail,
} from "./email-templates";

const inviteEn = {
  storeName: "Acme Store",
  inviteeName: "Amina",
  signInUrl: "https://dashboard.acme.com/sign-in",
  tempPassword: "a1b2c3d4e5f6g7h8i9j0",
  language: "en" as const,
};

describe("renderInviteEmail", () => {
  it("renders an LTR English document with subject, URL, and temp password", () => {
    const email = renderInviteEmail(inviteEn);

    expect(email.subject).toBe("You're invited to join Acme Store");
    expect(email.html).toContain('dir="ltr"');
    expect(email.html).toContain('lang="en"');
    expect(email.html).toContain(inviteEn.signInUrl);
    expect(email.html).toContain(inviteEn.tempPassword);
    expect(email.text).toContain(inviteEn.signInUrl);
    expect(email.text).toContain(inviteEn.tempPassword);
  });

  it("renders an RTL Arabic document with a localized subject", () => {
    const email = renderInviteEmail({ ...inviteEn, language: "ar" });

    expect(email.subject).toBe("دعوة للانضمام إلى فريق Acme Store");
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain('lang="ar"');
    expect(email.html).toContain(inviteEn.signInUrl);
    expect(email.text).toContain(inviteEn.tempPassword);
  });

  it("escapes HTML in the store name and invitee name", () => {
    const email = renderInviteEmail({
      ...inviteEn,
      storeName: 'Acme <script>alert("x")</script>',
      inviteeName: "Bob <b>&</b>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>&</b>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
  });
});

describe("renderPasswordResetEmail", () => {
  const resetEn = {
    storeName: "Acme Store",
    resetUrl:
      "https://dashboard.acme.com/api/auth/reset-password/abc123?callbackURL=%2Freset-password",
    language: "en" as const,
  };

  it("renders subject, reset URL, and the one-hour expiry in both bodies", () => {
    const email = renderPasswordResetEmail(resetEn);

    expect(email.subject).toBe("Reset your Acme Store password");
    expect(email.html).toContain('dir="ltr"');
    expect(email.html).toContain(resetEn.resetUrl);
    expect(email.html).toContain("1 hour");
    expect(email.text).toContain(resetEn.resetUrl);
    expect(email.text).toContain("1 hour");
  });

  it("greets by name when provided and renders RTL Arabic otherwise", () => {
    const withName = renderPasswordResetEmail({
      ...resetEn,
      userName: "Amina",
    });
    expect(withName.html).toContain("Hi Amina,");

    const ar = renderPasswordResetEmail({
      ...resetEn,
      language: "ar",
      userName: "أمينة",
    });
    expect(ar.subject).toBe("إعادة تعيين كلمة مرور Acme Store");
    expect(ar.html).toContain('dir="rtl"');
    expect(ar.html).toContain("أمينة");
    expect(ar.html).toContain(resetEn.resetUrl);
    expect(ar.html).toContain("ساعة");
  });

  it("escapes HTML in the store name", () => {
    const email = renderPasswordResetEmail({
      ...resetEn,
      storeName: 'Evil <img src=x onerror="alert(1)">',
    });

    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });
});
