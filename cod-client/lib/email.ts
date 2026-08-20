import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email using Cloudflare Email Service with retry logic
 * @param options Email options including recipient, subject, HTML and text content
 * @throws Error if email sending fails after all retries
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  
  // Extract domain from NEXT_PUBLIC_APP_URL (e.g., "https://app.example.com" → "example.com")
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const domain = extractDomain(appUrl);
  const fromEmail = `no-reply@${domain}`;
  
  const maxRetries = 2;
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      // Send email using Cloudflare Email Service binding
      await env.SEND_EMAIL.send({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      
      // Log successful send
      console.log("Email sent successfully", {
        timestamp: new Date().toISOString(),
        recipient: hashEmail(options.to),
        subject: options.subject,
        attempt: attempt + 1,
      });
      
      return;
    } catch (error) {
      attempt++;
      
      // Log failure
      console.error("Email send failed", {
        timestamp: new Date().toISOString(),
        recipient: hashEmail(options.to),
        subject: options.subject,
        attempt: attempt,
        maxRetries: maxRetries + 1,
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (attempt > maxRetries) {
        throw new Error("Failed to send email after retries");
      }
      
      // Exponential backoff: 1s, 2s
      const backoffMs = 1000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Hash email address for logging (privacy protection)
 * @param email Email address to hash
 * @returns Hashed email address
 */
function hashEmail(email: string): string {
  // Simple hash for logging - in production, use a proper hashing function
  const parts = email.split("@");
  if (parts.length !== 2) return "invalid-email";
  
  const localPart = parts[0];
  const domain = parts[1];
  
  // Show first 2 chars and last char of local part, hash the rest
  if (localPart.length <= 3) {
    return `${localPart[0]}***@${domain}`;
  }
  
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

/**
 * Extract root domain from app URL
 * @param appUrl Full app URL (e.g., "https://app.example.com")
 * @returns Root domain (e.g., "example.com")
 * @throws Error if domain cannot be extracted
 */
function extractDomain(appUrl: string): string {
  try {
    const url = new URL(appUrl);
    const hostname = url.hostname;
    
    // Localhost is not a valid email domain
    if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.")) {
      throw new Error("Cannot send emails from localhost. NEXT_PUBLIC_APP_URL must be a valid domain.");
    }
    
    // Remove "app." subdomain if present (e.g., "app.example.com" → "example.com")
    if (hostname.startsWith("app.")) {
      return hostname.substring(4);
    }
    
    // Return hostname as-is for other cases
    return hostname;
  } catch (error) {
    // If URL parsing fails or domain is invalid, throw a clear error
    const errorMsg = error instanceof Error ? error.message : "Invalid URL";
    throw new Error(
      `Failed to extract email domain from NEXT_PUBLIC_APP_URL: ${errorMsg}. ` +
      `Current value: "${appUrl}". Email sending requires a valid domain.`
    );
  }
}
