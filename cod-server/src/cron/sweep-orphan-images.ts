import { getDb } from "@/db";
import {
  MANAGED_IMAGE_PREFIX,
  isManagedImageKey,
  selectOrphanImageKeys,
  type OrphanCandidate,
} from "../../../cod-shared/lib/orphan-images";
import { collectReferencedImageKeys } from "../../../cod-shared/queries/image-references";
import type { Env } from "@/types";

/** R2 accepts at most 1000 keys per delete call. */
const DELETE_BATCH = 1000;

export interface OrphanImage {
  key: string;
  size: number;
  /** ISO timestamp of the R2 upload. */
  uploaded: string;
}

export interface OrphanSweepReport {
  dryRun: boolean;
  prefix: string;
  olderThanDays: number;
  /** Managed objects found in the bucket. */
  scanned: number;
  /** Distinct referenced keys found in the database. */
  referenced: number;
  orphans: OrphanImage[];
  orphanBytes: number;
  deleted: number;
}

export interface OrphanSweepOptions {
  /** Grace period: objects younger than this are never considered. */
  olderThanDays?: number;
  /** Defaults to true — deletion is opt-in per call. */
  dryRun?: boolean;
  /** Injectable clock so a report is reproducible. */
  now?: Date;
}

/**
 * Compares the objects in R2's `products/` namespace against every key stored
 * data still references, and deletes the difference beyond a grace period.
 *
 * Defaults to a dry run: the report is the product of this job, and enabling
 * deletion is a deliberate, separate act.
 */
export async function sweepOrphanImages(
  env: Env,
  { olderThanDays = 30, dryRun = true, now = new Date() }: OrphanSweepOptions = {}
): Promise<OrphanSweepReport> {
  const bucket = env.IMAGES;

  const candidates: OrphanCandidate[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: MANAGED_IMAGE_PREFIX, cursor });
    for (const object of page.objects) {
      if (!isManagedImageKey(object.key)) continue;
      candidates.push({
        key: object.key,
        uploaded: object.uploaded ?? null,
        size: object.size ?? 0,
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const referenced = await collectReferencedImageKeys(getDb(env.DB));

  const orphans = selectOrphanImageKeys({
    candidates,
    referenced,
    olderThanDays,
    now,
  });

  let deleted = 0;
  if (!dryRun && orphans.length > 0) {
    for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
      const batch = orphans.slice(i, i + DELETE_BATCH).map((orphan) => orphan.key);
      await bucket.delete(batch);
      deleted += batch.length;
    }
  }

  return {
    dryRun,
    prefix: MANAGED_IMAGE_PREFIX,
    olderThanDays,
    scanned: candidates.length,
    referenced: referenced.size,
    orphans: orphans.map((orphan) => ({
      key: orphan.key,
      size: orphan.size ?? 0,
      uploaded: orphan.uploaded.toISOString(),
    })),
    orphanBytes: orphans.reduce((total, orphan) => total + (orphan.size ?? 0), 0),
    deleted,
  };
}

/**
 * Scheduled entry point.
 *
 * Runs the sweep in dry-run and logs the report: the debt is visible daily, and
 * enabling deletion stays a deliberate one-line change (plan §8 — the sweep's
 * scheduling is a separate decision from its design).
 */
export async function runOrphanImageSweep(env: Env): Promise<void> {
  const report = await sweepOrphanImages(env, { dryRun: true });
  console.log(
    `[cron:sweep-orphan-images] ${report.dryRun ? "dry-run" : "swept"}: ${report.scanned} managed, ${report.referenced} referenced, ${report.orphans.length} orphan(s), ${report.orphanBytes} bytes`
  );
}
