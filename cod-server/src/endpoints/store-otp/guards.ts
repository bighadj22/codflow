/**
 * Storefront OTP — send/verify guards (cost control)
 *
 * KV-backed cooldowns that stop runaway sends BEFORE they cost the merchant
 * 5 DA each. Best-effort by contract: a KV read/write failure is swallowed
 * and the send proceeds — dzverify's own limits (5/recipient/hour,
 * 200/account/hour) remain the hard bound. KV is eventually consistent,
 * which is acceptable for cost control, not for security (the HMAC token is
 * the security boundary).
 *
 * Interface: one async function returning the first tripped guard or null.
 */

const PHONE_COOLDOWN_SECONDS = 60;
const IP_HOURLY_LIMIT = 20;
const IP_WINDOW_SECONDS = 3600;

export interface OtpSendGuards {
  /** Returns { reason, windowSeconds } when the send should be blocked, else null. */
  check(kv: KVNamespace | undefined, storeId: string, phone: string, ip: string | null): Promise<{ reason: string; windowSeconds: number } | null>;
}

export function createOtpSendGuards(nowSeconds: number = Math.floor(Date.now() / 1000)): OtpSendGuards {
  return {
    async check(kv, storeId, phone, ip) {
      if (!kv) return null;

      try {
        const cooldownKey = `otp:cd:${storeId}:${phone}`;
        const cooldown = await kv.get(cooldownKey);
        if (cooldown != null) {
          const remaining = Number(cooldown) - nowSeconds;
          if (remaining > 0) {
            return { reason: "phone_cooldown", windowSeconds: remaining };
          }
        }

        if (ip) {
          const ipKey = `otp:ip:${storeId}:${ip}`;
          const count = Number((await kv.get(ipKey)) ?? "0");
          if (count >= IP_HOURLY_LIMIT) {
            return { reason: "ip_hourly", windowSeconds: IP_WINDOW_SECONDS };
          }
        }
        return null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Record a completed send: set the phone cooldown and bump the IP counter.
 * Fire-and-forget safe — errors are swallowed by contract.
 */
export async function recordOtpSend(
  kv: KVNamespace | undefined,
  storeId: string,
  phone: string,
  ip: string | null,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(`otp:cd:${storeId}:${phone}`, String(nowSeconds + PHONE_COOLDOWN_SECONDS), {
      expiration: nowSeconds + PHONE_COOLDOWN_SECONDS,
    });
    if (ip) {
      const ipKey = `otp:ip:${storeId}:${ip}`;
      const count = Number((await kv.get(ipKey)) ?? "0");
      await kv.put(ipKey, String(count + 1), {
        expiration: nowSeconds + IP_WINDOW_SECONDS,
      });
    }
  } catch {
    // Cost-control bookkeeping only — never block the send path.
  }
}
