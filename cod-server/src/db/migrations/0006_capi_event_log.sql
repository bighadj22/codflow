-- Audit log for every CAPI event attempt (sent, failed, or skipped).
-- Written by CodCapiWorkflow after each attempt. Indexed by order_id for dashboard queries.
CREATE TABLE IF NOT EXISTS `capi_event_log` (
  `id`            text PRIMARY KEY NOT NULL,
  `order_id`      text NOT NULL REFERENCES `orders`(`id`),
  `event_name`    text NOT NULL,
  `status`        text NOT NULL,
  `meta_event_id` text,
  `error`         text,
  `sent_at`       text NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_capi_event_log_order` ON `capi_event_log`(`order_id`);
