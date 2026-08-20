import { getDashboardBrand } from "@/lib/brand";

export interface EmailTemplateContext {
  user: { name: string; email: string };
  url: string;
}

/**
 * Render password reset email in English (LTR)
 */
export async function renderPasswordResetEmail(
  context: EmailTemplateContext
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${brand.primaryColor};">
              ${brand.logoUrl 
                ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">` 
                : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${brand.brandName}</h1>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a; font-weight: 700;">Reset Your Password</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Hi ${context.user.name},
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>15 minutes</strong>.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${context.url}" style="display: inline-block; padding: 16px 40px; background-color: ${brand.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #6a6a6a;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              
              <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #999999;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${context.url}" style="color: ${brand.primaryColor}; word-break: break-all;">${context.url}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} ${brand.brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Render password reset email plain text version
 */
export async function renderPasswordResetEmailText(
  context: EmailTemplateContext
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
${brand.brandName}

Reset Your Password

Hi ${context.user.name},

We received a request to reset your password. Click the link below to create a new password. This link will expire in 15 minutes.

${context.url}

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} ${brand.brandName}. All rights reserved.
  `.trim();
}

/**
 * Render password reset email in Arabic (RTL)
 */
export async function renderPasswordResetEmailAr(
  context: EmailTemplateContext
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إعادة تعيين كلمة المرور</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${brand.primaryColor};">
              ${brand.logoUrl 
                ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">` 
                : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${brand.brandName}</h1>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a; font-weight: 700;">إعادة تعيين كلمة المرور</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                مرحباً ${context.user.name}،
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بك. انقر على الزر أدناه لإنشاء كلمة مرور جديدة. ستنتهي صلاحية هذا الرابط خلال <strong>15 دقيقة</strong>.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${context.url}" style="display: inline-block; padding: 16px 40px; background-color: ${brand.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      إعادة تعيين كلمة المرور
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #6a6a6a;">
                إذا لم تطلب إعادة تعيين كلمة المرور هذه، يمكنك تجاهل هذا البريد الإلكتروني بأمان. ستبقى كلمة المرور الخاصة بك دون تغيير.
              </p>
              
              <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #999999;">
                إذا لم يعمل الزر، انسخ والصق هذا الرابط في متصفحك:<br>
                <a href="${context.url}" style="color: ${brand.primaryColor}; word-break: break-all;">${context.url}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} ${brand.brandName}. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Render magic link email in English (LTR)
 */
export async function renderMagicLinkEmail(
  context: EmailTemplateContext
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In to Your Account</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${brand.primaryColor};">
              ${brand.logoUrl 
                ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">` 
                : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${brand.brandName}</h1>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a; font-weight: 700;">Sign In to Your Account</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Hi ${context.user.name},
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Click the button below to sign in to your account. This link will expire in <strong>10 minutes</strong>.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${context.url}" style="display: inline-block; padding: 16px 40px; background-color: ${brand.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Sign In
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #6a6a6a;">
                If you didn't request this sign-in link, you can safely ignore this email.
              </p>
              
              <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #999999;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${context.url}" style="color: ${brand.primaryColor}; word-break: break-all;">${context.url}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} ${brand.brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Render magic link email plain text version
 */
export async function renderMagicLinkEmailText(
  context: EmailTemplateContext
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
${brand.brandName}

Sign In to Your Account

Hi ${context.user.name},

Click the link below to sign in to your account. This link will expire in 10 minutes.

${context.url}

If you didn't request this sign-in link, you can safely ignore this email.

© ${new Date().getFullYear()} ${brand.brandName}. All rights reserved.
  `.trim();
}

/**
 * Render magic link email in Arabic (RTL)
 */
export async function renderMagicLinkEmailAr(
  context: EmailTemplateContext
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تسجيل الدخول إلى حسابك</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${brand.primaryColor};">
              ${brand.logoUrl 
                ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">` 
                : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${brand.brandName}</h1>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a; font-weight: 700;">تسجيل الدخول إلى حسابك</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                مرحباً ${context.user.name}،
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                انقر على الزر أدناه لتسجيل الدخول إلى حسابك. ستنتهي صلاحية هذا الرابط خلال <strong>10 دقائق</strong>.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${context.url}" style="display: inline-block; padding: 16px 40px; background-color: ${brand.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      تسجيل الدخول
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #6a6a6a;">
                إذا لم تطلب رابط تسجيل الدخول هذا، يمكنك تجاهل هذا البريد الإلكتروني بأمان.
              </p>
              
              <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #999999;">
                إذا لم يعمل الزر، انسخ والصق هذا الرابط في متصفحك:<br>
                <a href="${context.url}" style="color: ${brand.primaryColor}; word-break: break-all;">${context.url}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} ${brand.brandName}. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Render password changed confirmation email in English
 */
export async function renderPasswordChangedEmail(
  context: { user: { name: string; email: string } }
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${brand.primaryColor};">
              ${brand.logoUrl 
                ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">` 
                : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${brand.brandName}</h1>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a; font-weight: 700;">Password Changed Successfully</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Hi ${context.user.name},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Your password has been changed successfully. All active sessions have been logged out for security.
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                If you did not make this change, please contact support immediately.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} ${brand.brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Render password changed confirmation email in Arabic
 */
export async function renderPasswordChangedEmailAr(
  context: { user: { name: string; email: string } }
): Promise<string> {
  const brand = await getDashboardBrand();
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تم تغيير كلمة المرور</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${brand.primaryColor};">
              ${brand.logoUrl 
                ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">` 
                : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${brand.brandName}</h1>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a; font-weight: 700;">تم تغيير كلمة المرور بنجاح</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                مرحباً ${context.user.name}،
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                تم تغيير كلمة المرور الخاصة بك بنجاح. تم تسجيل الخروج من جميع الجلسات النشطة لأسباب أمنية.
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                إذا لم تقم بهذا التغيير، يرجى الاتصال بالدعم على الفور.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} ${brand.brandName}. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
