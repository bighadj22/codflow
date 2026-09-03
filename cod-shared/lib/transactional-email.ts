/**
 * The single Sendili send path for transactional email.
 *
 * Every CodFlow transactional email (team invites on cod-server, password
 * resets on the dashboard worker) crosses this seam, so the security
 * contract lives in exactly one place:
 *
 *   - Never throws: an email problem must never break or block the business
 *     operation that triggered it. Every failure returns a stable code.
 *   - Never leaks: `error` carries a fixed vocabulary
 *     (out_of_credits | invalid_key | forbidden | rate_limited | validation
 *     | transient) — provider message text can echo key fragments, so it is
 *     dropped here and only logged by the caller if it chooses.
 *   - Silent skip: no config row or enabled=false means the feature is
 *     inert — { sent: false, error: null }, no provider call.
 *   - Idempotency conflicts mean the original send already happened
 *     (retried request with the same key): reported as sent.
 */

import type { AppDb } from "../db/client";
import { getEmailConfigRaw } from "../queries/email-config";
import { getStore } from "../queries/stores";
import {
  createSendiliClient,
  SendiliError,
  SENDILI_ERRORS,
} from "./sendili";

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Stable retry key — same key + same body replays the original result. */
  idempotencyKey?: string;
}

export interface TransactionalEmailOutcome {
  sent: boolean;
  /** Stable code — branch on it, never display it raw. Null = not configured. */
  error: string | null;
}

const ERROR_CODES_BY_SENDILI: Record<string, string> = {
  [SENDILI_ERRORS.OUT_OF_CREDITS]: "out_of_credits",
  [SENDILI_ERRORS.UNAUTHORIZED]: "invalid_key",
  [SENDILI_ERRORS.FORBIDDEN]: "forbidden",
  [SENDILI_ERRORS.RATE_LIMITED]: "rate_limited",
  [SENDILI_ERRORS.VALIDATION]: "validation",
};

export async function sendTransactionalEmail(
  db: AppDb,
  email: TransactionalEmail
): Promise<TransactionalEmailOutcome> {
  try {
    const store = await getStore(db);
    if (!store) {
      return { sent: false, error: null };
    }

    const config = await getEmailConfigRaw(db, store.id);
    if (!config || !config.enabled) {
      return { sent: false, error: null };
    }

    const client = createSendiliClient(config.apiKey);
    await client.send({
      fromEmail: config.fromEmail,
      fromName: config.fromName ?? undefined,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: email.idempotencyKey,
    });

    return { sent: true, error: null };
  } catch (err) {
    if (err instanceof SendiliError) {
      if (err.code === SENDILI_ERRORS.IDEMPOTENCY_CONFLICT) {
        return { sent: true, error: null };
      }
      return { sent: false, error: ERROR_CODES_BY_SENDILI[err.code] ?? "transient" };
    }
    return { sent: false, error: "transient" };
  }
}
