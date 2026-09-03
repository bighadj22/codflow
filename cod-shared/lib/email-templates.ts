/**
 * Transactional email templates — shared by both workers.
 *
 * cod-server renders the team-invite email; the dashboard worker renders the
 * password-reset email. Both flow through the same base layout so every
 * CodFlow email looks like one product.
 *
 * Contract:
 *   - Every string that originates outside this module (store name, person
 *     name, URLs) is HTML-escaped before it touches the html body.
 *   - Inline CSS only — email clients strip <style> blocks.
 *   - Arabic renders RTL (`dir="rtl"`, right-aligned); URLs and passwords
 *     stay LTR inside RTL mail via direction/unicode-bidi.
 *   - Each renderer returns { subject, html, text } ready for the Sendili
 *     client: subject is plain text, secrets appear only in html/text.
 *   - The reset email states the 1-hour link expiry — keep in sync with
 *     better-auth's resetPasswordTokenExpiresIn default (3600s), which
 *     cod-client-astro does not override.
 */

export type EmailLanguage = "ar" | "en";

export interface InviteEmailInput {
  storeName: string;
  inviteeName: string;
  signInUrl: string;
  tempPassword: string;
  language: EmailLanguage;
}

export interface PasswordResetEmailInput {
  storeName: string;
  userName?: string;
  resetUrl: string;
  language: EmailLanguage;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT = "Arial,Helvetica,sans-serif";

function baseLayout(options: {
  language: EmailLanguage;
  subject: string;
  storeName: string;
  bodyHtml: string;
  footerText: string;
}): string {
  const rtl = options.language === "ar";
  const align = rtl ? "right" : "left";
  return `<!doctype html>
<html lang="${options.language}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:22px 28px;background-color:#6d28d9;">
<span style="color:#ffffff;font-size:17px;font-weight:700;font-family:${FONT};">${escapeHtml(options.storeName)}</span>
</td></tr>
<tr><td style="padding:30px 28px;font-family:${FONT};font-size:14px;line-height:1.7;color:#27272a;text-align:${align};">
${options.bodyHtml}
</td></tr>
<tr><td style="padding:14px 28px 24px;font-family:${FONT};font-size:11px;line-height:1.6;color:#a1a1aa;text-align:${align};">
${escapeHtml(options.footerText)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;">${html}</p>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:22px 0 10px;">
<a href="${escapeHtml(url)}" style="display:inline-block;background-color:#6d28d9;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(label)}</a>
</p>
<p style="margin:0 0 14px;word-break:break-all;">
<a href="${escapeHtml(url)}" style="color:#6d28d9;text-decoration:none;direction:ltr;unicode-bidi:embed;">${escapeHtml(url)}</a>
</p>`;
}

function secretBox(value: string): string {
  return `<code style="display:inline-block;background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:8px 14px;font-family:Courier,monospace;font-size:14px;letter-spacing:0.5px;direction:ltr;unicode-bidi:embed;">${escapeHtml(value)}</code>`;
}

// ─── Invite ───────────────────────────────────────────────────────────────────

const INVITE_COPY = {
  en: {
    subject: (store: string) => `You're invited to join ${store}`,
    greeting: (name: string) => `Hi ${name},`,
    intro: (store: string) =>
      `You've been invited to join the ${store} team on CodFlow. Use the link and temporary password below to sign in.`,
    button: "Sign in",
    passwordLabel: "Temporary password",
    note: "Please change your password right after signing in.",
    footer: (store: string) => `This is an automated message from ${store}.`,
  },
  ar: {
    subject: (store: string) => `دعوة للانضمام إلى فريق ${store}`,
    greeting: (name: string) => `مرحباً ${name}،`,
    intro: (store: string) =>
      `لقد تمت دعوتك للانضمام إلى فريق ${store} على CodFlow. استخدم الرابط وكلمة المرور المؤقتة أدناه لتسجيل الدخول.`,
    button: "تسجيل الدخول",
    passwordLabel: "كلمة المرور المؤقتة",
    note: "يُرجى تغيير كلمة المرور بعد تسجيل الدخول مباشرة.",
    footer: (store: string) => `هذه رسالة تلقائية من ${store}.`,
  },
} as const;

export function renderInviteEmail(input: InviteEmailInput): RenderedEmail {
  const copy = INVITE_COPY[input.language];

  const bodyHtml = [
    paragraph(escapeHtml(copy.greeting(input.inviteeName))),
    paragraph(escapeHtml(copy.intro(input.storeName))),
    button(input.signInUrl, copy.button),
    paragraph(escapeHtml(copy.passwordLabel)),
    secretBox(input.tempPassword),
    paragraph(escapeHtml(copy.note)),
  ].join("\n");

  const text = [
    copy.greeting(input.inviteeName),
    "",
    copy.intro(input.storeName),
    "",
    `${copy.button}: ${input.signInUrl}`,
    "",
    `${copy.passwordLabel}: ${input.tempPassword}`,
    "",
    copy.note,
    "",
    copy.footer(input.storeName),
  ].join("\n");

  return {
    subject: copy.subject(input.storeName),
    html: baseLayout({
      language: input.language,
      subject: copy.subject(input.storeName),
      storeName: input.storeName,
      bodyHtml,
      footerText: copy.footer(input.storeName),
    }),
    text,
  };
}

// ─── Password reset ───────────────────────────────────────────────────────────

const RESET_COPY = {
  en: {
    subject: (store: string) => `Reset your ${store} password`,
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    intro: (store: string) =>
      `We received a request to reset your ${store} password. Click the button below to choose a new one.`,
    expiry: "This link expires in 1 hour.",
    ignore: "If you didn't request this, you can safely ignore this email.",
    button: "Reset password",
    footer: (store: string) => `This is an automated message from ${store}.`,
  },
  ar: {
    subject: (store: string) => `إعادة تعيين كلمة مرور ${store}`,
    greeting: (name?: string) => (name ? `مرحباً ${name}،` : "مرحباً،"),
    intro: (store: string) =>
      `تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في ${store}. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.`,
    expiry: "تنتهي صلاحية هذا الرابط خلال ساعة واحدة.",
    ignore: "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.",
    button: "إعادة تعيين كلمة المرور",
    footer: (store: string) => `هذه رسالة تلقائية من ${store}.`,
  },
} as const;

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const copy = RESET_COPY[input.language];

  const bodyHtml = [
    paragraph(escapeHtml(copy.greeting(input.userName))),
    paragraph(escapeHtml(copy.intro(input.storeName))),
    button(input.resetUrl, copy.button),
    paragraph(escapeHtml(copy.expiry)),
    paragraph(escapeHtml(copy.ignore)),
  ].join("\n");

  const text = [
    copy.greeting(input.userName),
    "",
    copy.intro(input.storeName),
    "",
    `${copy.button}: ${input.resetUrl}`,
    "",
    copy.expiry,
    copy.ignore,
    "",
    copy.footer(input.storeName),
  ].join("\n");

  return {
    subject: copy.subject(input.storeName),
    html: baseLayout({
      language: input.language,
      subject: copy.subject(input.storeName),
      storeName: input.storeName,
      bodyHtml,
      footerText: copy.footer(input.storeName),
    }),
    text,
  };
}
