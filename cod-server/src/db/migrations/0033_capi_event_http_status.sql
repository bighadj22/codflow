-- Meta's HTTP status for the attempt.
--
-- The message alone cannot tell an auth rejection (400/401/403) from a rate
-- limit (429) or a transient outage (5xx), and Meta localises it. Storing the
-- status keeps that distinction queryable. NULL for rows written before this
-- migration and for attempts that never reached Meta (network failure, or a
-- claim that was skipped before sending).
ALTER TABLE `capi_event_log` ADD `http_status` integer;--> statement-breakpoint
