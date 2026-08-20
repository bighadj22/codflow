CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_label` text,
	`metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communes` (
	`id` text PRIMARY KEY NOT NULL,
	`wilaya_id` integer NOT NULL,
	`name` text NOT NULL,
	`name_ar` text NOT NULL,
	`postal_code` text,
	FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_api_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`order_id` text,
	`action` text NOT NULL,
	`method` text NOT NULL,
	`endpoint` text NOT NULL,
	`request_body` text,
	`http_status` integer,
	`response_body` text,
	`success` integer DEFAULT false NOT NULL,
	`error_message` text,
	`duration_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `delivery_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`company_id` text NOT NULL,
	`tracking_number` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`validated` integer DEFAULT false NOT NULL,
	`label_url` text,
	`raw_response` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `delivery_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_stop_desks` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`commune` text,
	`wilaya_id` integer,
	`address` text,
	`phones` text,
	`active` integer DEFAULT true NOT NULL,
	`synced_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `delivery_companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_stop_desks_company_code_unique` ON `company_stop_desks` (`company_id`,`code`);--> statement-breakpoint
CREATE TABLE `customer_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`group_id` text NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `customer_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_group_members_customer_group_unique` ON `customer_group_members` (`customer_id`,`group_id`);--> statement-breakpoint
CREATE TABLE `customer_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`member_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_tag_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `customer_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_tag_assignments_customer_tag_unique` ON `customer_tag_assignments` (`customer_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `customer_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#64748b' NOT NULL,
	`assignment_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_tags_name_unique` ON `customer_tags` (`name`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`phone2` text,
	`wilaya_id` integer,
	`commune_id` text,
	`wilaya` text NOT NULL,
	`commune` text,
	`address` text,
	`total_orders` integer DEFAULT 0 NOT NULL,
	`total_spent` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`last_order_at` text,
	FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commune_id`) REFERENCES `communes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dashboard_brand` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`brand_name` text DEFAULT 'Dashboard' NOT NULL,
	`logo_url` text,
	`primary_color` text DEFAULT '#7c3aed' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delivery_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_ar` text NOT NULL,
	`code` text NOT NULL,
	`website` text,
	`active` integer DEFAULT true NOT NULL,
	`api_endpoint` text,
	`api_token` text,
	`api_user_guid` text,
	`supports_home_delivery` integer DEFAULT true NOT NULL,
	`supports_stop_desk` integer DEFAULT true NOT NULL,
	`supports_tracking` integer DEFAULT false NOT NULL,
	`pricing_json` text,
	`profile_id` text,
	`webhook_secret` text,
	`webhook_endpoint_id` text,
	`webhook_status_mapping` text,
	`auto_validate` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `shipping_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_companies_code_unique` ON `delivery_companies` (`code`);--> statement-breakpoint
CREATE TABLE `driver_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`order_count` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text NOT NULL,
	`phone2` text,
	`vehicle_type` text,
	`status` text DEFAULT 'available' NOT NULL,
	`profile_id` text,
	`total_delivered` integer DEFAULT 0 NOT NULL,
	`total_earnings` real DEFAULT 0 NOT NULL,
	`pending_cash` real DEFAULT 0 NOT NULL,
	`total_paid` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `shipping_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`trigger_product_id` text NOT NULL,
	`trigger_variant_id` text,
	`trigger_quantity` integer DEFAULT 2 NOT NULL,
	`reward_product_id` text,
	`reward_variant_id` text,
	`reward_quantity` integer DEFAULT 1 NOT NULL,
	`discount_type` text DEFAULT 'free' NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trigger_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trigger_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reward_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `order_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`assignee_type` text NOT NULL,
	`assignee_id` text NOT NULL,
	`assignee_name` text NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` text NOT NULL,
	`unassigned_at` text,
	`reason` text,
	`accepted_at` text,
	`pickup_at` text,
	`delivered_at` text,
	`status` text DEFAULT 'assigned' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `order_products` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`variant_id` text,
	`variant_label` text,
	`sku` text,
	`quantity` integer NOT NULL,
	`price_per_unit` real NOT NULL,
	`line_total` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`timestamp` text NOT NULL,
	`by` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`wilaya_id` integer,
	`commune_id` text,
	`city` text,
	`address` text,
	`price` real NOT NULL,
	`notes` text,
	`status` text DEFAULT 'new' NOT NULL,
	`order_type` text DEFAULT 'online' NOT NULL,
	`delivery_method` text DEFAULT 'driver' NOT NULL,
	`driver_id` text,
	`company_id` text,
	`assigned_at` text,
	`assigned_by` text,
	`assignment_notes` text,
	`tracking_number` text,
	`tracking_url` text,
	`external_order_id` text,
	`delivery_type` text DEFAULT 'home' NOT NULL,
	`station_code` text,
	`delivery_fee` real DEFAULT 0 NOT NULL,
	`driver_fee` real DEFAULT 0 NOT NULL,
	`cod_amount` real DEFAULT 0 NOT NULL,
	`weight` real,
	`is_fragile` integer,
	`pickup_time` text,
	`delivery_time` text,
	`delivery_attempts` integer DEFAULT 0,
	`photos` text,
	`cod_payment_id` text,
	`fee_payment_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commune_id`) REFERENCES `communes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `delivery_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`parent_id` text,
	`image_url` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_slug_unique` ON `product_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`src` text NOT NULL,
	`r2_key` text,
	`src_sm` text,
	`src_md` text,
	`src_lg` text,
	`alt_text` text,
	`width` integer,
	`height` integer,
	`type` integer DEFAULT 1 NOT NULL,
	`position` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`variations` text NOT NULL,
	`currency` text DEFAULT 'DZD' NOT NULL,
	`price` integer NOT NULL,
	`compare_at_price` integer,
	`sku` text NOT NULL,
	`barcode` text,
	`inventory` integer DEFAULT 0 NOT NULL,
	`low_stock_threshold` integer DEFAULT 5 NOT NULL,
	`weight_kg` real,
	`image_id` text,
	`is_default` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`handle` text NOT NULL,
	`currency` text DEFAULT 'DZD' NOT NULL,
	`price` integer NOT NULL,
	`compare_at_price` integer,
	`cost_price` integer,
	`type` text DEFAULT 'PHYSICAL' NOT NULL,
	`has_variants` integer DEFAULT false NOT NULL,
	`variant_options` text,
	`sku` text,
	`inventory` integer DEFAULT 0 NOT NULL,
	`track_inventory` integer DEFAULT true NOT NULL,
	`low_stock_threshold` integer DEFAULT 5 NOT NULL,
	`category_id` text,
	`tags` text,
	`visibility` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`show_in_store` integer DEFAULT true NOT NULL,
	`store_featured` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`published_at` text,
	`shipping_profile_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shipping_profile_id`) REFERENCES `shipping_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_handle_unique` ON `products` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`order_id` text NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`helpful_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_unique` ON `reviews` (`order_id`);--> statement-breakpoint
CREATE TABLE `shipping_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`type` text DEFAULT 'customer' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipping_rule_communes` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`commune_id` text NOT NULL,
	`home_enabled` integer,
	`stop_desk_enabled` integer,
	FOREIGN KEY (`rule_id`) REFERENCES `shipping_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`commune_id`) REFERENCES `communes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_rule_communes_unique` ON `shipping_rule_communes` (`rule_id`,`commune_id`);--> statement-breakpoint
CREATE TABLE `shipping_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`wilaya_id` integer NOT NULL,
	`home_price` real DEFAULT 0 NOT NULL,
	`stop_desk_price` real DEFAULT 0 NOT NULL,
	`home_enabled` integer DEFAULT true NOT NULL,
	`stop_desk_enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `shipping_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`type` text NOT NULL,
	`delta` integer NOT NULL,
	`qty_before` integer NOT NULL,
	`qty_after` integer NOT NULL,
	`reason` text,
	`reference` text,
	`created_by` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `store_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`name` text DEFAULT 'default' NOT NULL,
	`last_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_api_keys_key_hash_unique` ON `store_api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`logo_url` text,
	`theme_id` text DEFAULT 'theme01' NOT NULL,
	`primary_color` text DEFAULT '#7c3aed' NOT NULL,
	`accent_color` text DEFAULT '#f59e0b' NOT NULL,
	`bg_color` text DEFAULT '#f8f8f8' NOT NULL,
	`font_family` text DEFAULT 'Cairo, sans-serif' NOT NULL,
	`font_url` text,
	`lang` text DEFAULT 'ar' NOT NULL,
	`currency` text DEFAULT 'DZD' NOT NULL,
	`currency_symbol` text DEFAULT 'دج' NOT NULL,
	`content_json` text,
	`meta_title` text,
	`meta_description` text,
	`og_image` text,
	`announcement_bar` text,
	`reviews_enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`granted_by` text,
	`granted_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'staff' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`api_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`language` text DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_key_unique` ON `users` (`api_key`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`company_id` text NOT NULL,
	`order_id` text,
	`tracking` text,
	`event_type` text NOT NULL,
	`raw_payload` text NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`new_status` text,
	`reason` text,
	`error_msg` text,
	`processed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `delivery_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_provider_event_unique` ON `webhook_events` (`provider`,`event_id`);--> statement-breakpoint
CREATE TABLE `wilayas` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_ar` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_token_idx` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);
--> statement-breakpoint
-- ─── Seed: Algeria wilayas (58) ──────────────────────────────────────────────
INSERT INTO wilayas VALUES(1,'Adrar','أدرار');
INSERT INTO wilayas VALUES(2,'Chlef','الشلف');
INSERT INTO wilayas VALUES(3,'Laghouat','الأغواط');
INSERT INTO wilayas VALUES(4,'Oum El Bouaghi','أم البواقي');
INSERT INTO wilayas VALUES(5,'Batna','باتنة');
INSERT INTO wilayas VALUES(6,'Béjaïa','بجاية');
INSERT INTO wilayas VALUES(7,'Biskra','بسكرة');
INSERT INTO wilayas VALUES(8,'Béchar','بشار');
INSERT INTO wilayas VALUES(9,'Blida','البليدة');
INSERT INTO wilayas VALUES(10,'Bouira','البويرة');
INSERT INTO wilayas VALUES(11,'Tamanrasset','تمنراست');
INSERT INTO wilayas VALUES(12,'Tébessa','تبسة');
INSERT INTO wilayas VALUES(13,'Tlemcen','تلمسان');
INSERT INTO wilayas VALUES(14,'Tiaret','تيارت');
INSERT INTO wilayas VALUES(15,'Tizi Ouzou','تيزي وزو');
INSERT INTO wilayas VALUES(16,'Alger','الجزائر');
INSERT INTO wilayas VALUES(17,'Djelfa','الجلفة');
INSERT INTO wilayas VALUES(18,'Jijel','جيجل');
INSERT INTO wilayas VALUES(19,'Sétif','سطيف');
INSERT INTO wilayas VALUES(20,'Saïda','سعيدة');
INSERT INTO wilayas VALUES(21,'Skikda','سكيكدة');
INSERT INTO wilayas VALUES(22,'Sidi Bel Abbès','سيدي بلعباس');
INSERT INTO wilayas VALUES(23,'Annaba','عنابة');
INSERT INTO wilayas VALUES(24,'Guelma','قالمة');
INSERT INTO wilayas VALUES(25,'Constantine','قسنطينة');
INSERT INTO wilayas VALUES(26,'Médéa','المدية');
INSERT INTO wilayas VALUES(27,'Mostaganem','مستغانم');
INSERT INTO wilayas VALUES(28,'M''Sila','المسيلة');
INSERT INTO wilayas VALUES(29,'Mascara','معسكر');
INSERT INTO wilayas VALUES(30,'Ouargla','ورقلة');
INSERT INTO wilayas VALUES(31,'Oran','وهران');
INSERT INTO wilayas VALUES(32,'El Bayadh','البيض');
INSERT INTO wilayas VALUES(33,'Illizi','إليزي');
INSERT INTO wilayas VALUES(34,'Bordj Bou Arréridj','برج بوعريريج');
INSERT INTO wilayas VALUES(35,'Boumerdès','بومرداس');
INSERT INTO wilayas VALUES(36,'El Tarf','الطارف');
INSERT INTO wilayas VALUES(37,'Tindouf','تندوف');
INSERT INTO wilayas VALUES(38,'Tissemsilt','تيسمسيلت');
INSERT INTO wilayas VALUES(39,'El Oued','الوادي');
INSERT INTO wilayas VALUES(40,'Khenchela','خنشلة');
INSERT INTO wilayas VALUES(41,'Souk Ahras','سوق أهراس');
INSERT INTO wilayas VALUES(42,'Tipaza','تيبازة');
INSERT INTO wilayas VALUES(43,'Mila','ميلة');
INSERT INTO wilayas VALUES(44,'Aïn Defla','عين الدفلى');
INSERT INTO wilayas VALUES(45,'Naâma','النعامة');
INSERT INTO wilayas VALUES(46,'Aïn Témouchent','عين تموشنت');
INSERT INTO wilayas VALUES(47,'Ghardaïa','غرداية');
INSERT INTO wilayas VALUES(48,'Relizane','غليزان');
INSERT INTO wilayas VALUES(49,'Timimoun','تيميمون');
INSERT INTO wilayas VALUES(50,'Bordj Badji Mokhtar','برج باجي مختار');
INSERT INTO wilayas VALUES(51,'Ouled Djellal','أولاد جلال');
INSERT INTO wilayas VALUES(52,'Béni Abbès','بني عباس');
INSERT INTO wilayas VALUES(53,'In Salah','عين صالح');
INSERT INTO wilayas VALUES(54,'In Guezzam','عين قزام');
INSERT INTO wilayas VALUES(55,'Touggourt','تقرت');
INSERT INTO wilayas VALUES(56,'Djanet','جانت');
INSERT INTO wilayas VALUES(57,'El M''Ghair','المغير');
INSERT INTO wilayas VALUES(58,'El Meniaa','المنيعة');
-- ─── Seed: Algeria communes (1551) ──────────────────────────────────────────
INSERT INTO communes VALUES('c-01-001',1,'Adrar','أدرار','01001');
INSERT INTO communes VALUES('c-01-002',1,'Tamest','تأماست','01002');
INSERT INTO communes VALUES('c-01-003',1,'Charouine','شروين','01003');
INSERT INTO communes VALUES('c-01-004',1,'Reggane','رڨان','01004');
INSERT INTO communes VALUES('c-01-005',1,'In Zghmir','ان زغمير','01005');
INSERT INTO communes VALUES('c-01-006',1,'Tit','تــيـــت','01006');
INSERT INTO communes VALUES('c-01-007',1,'Ksar Kaddour','قصر قدور','01007');
INSERT INTO communes VALUES('c-01-008',1,'Tsabit','تسابيت','01008');
INSERT INTO communes VALUES('c-01-009',1,'Timimoun','تيميمون','01009');
INSERT INTO communes VALUES('c-01-010',1,'Ouled Said','أولاد سعيد','01010');
INSERT INTO communes VALUES('c-01-011',1,'Zaouiet Kounta','زاوية كنتة','01011');
INSERT INTO communes VALUES('c-01-012',1,'Aoulef','أولف','01012');
INSERT INTO communes VALUES('c-01-013',1,'Timokten','تيمقتن','01013');
INSERT INTO communes VALUES('c-01-014',1,'Tamentit','تامنطيت','01014');
INSERT INTO communes VALUES('c-01-015',1,'Fenoughil','فنوغيل','01015');
INSERT INTO communes VALUES('c-01-016',1,'Tinerkouk','زاوية دباغ','01016');
INSERT INTO communes VALUES('c-01-017',1,'Deldoul','دﻟﺪول','01017');
INSERT INTO communes VALUES('c-01-018',1,'Sali','سالى','01018');
INSERT INTO communes VALUES('c-01-019',1,'Akabli','أقبلي','01019');
INSERT INTO communes VALUES('c-01-020',1,'Metarfa','المطارفة','01020');
INSERT INTO communes VALUES('c-01-021',1,'Ouled Ahmed Tammi','أولاد أحمد تيمى','01021');
INSERT INTO communes VALUES('c-01-022',1,'Bouda','بودة','01022');
INSERT INTO communes VALUES('c-01-023',1,'Aougrout','أوقروت','01023');
INSERT INTO communes VALUES('c-01-024',1,'Talmine','','01024');
INSERT INTO communes VALUES('c-01-025',1,'Bordj Badji Mokhtar','برج باجي مختار','01025');
INSERT INTO communes VALUES('c-01-026',1,'Sbaa','السبع','01026');
INSERT INTO communes VALUES('c-01-027',1,'Ouled Aissa','أولاد عيسى','01027');
INSERT INTO communes VALUES('c-01-028',1,'Timiaouine','تيمياوين','01028');
INSERT INTO communes VALUES('c-02-001',2,'Chlef','الشلف','02001');
INSERT INTO communes VALUES('c-02-002',2,'Tenes','تنس','02002');
INSERT INTO communes VALUES('c-02-003',2,'Benairia','بنايرية','02003');
INSERT INTO communes VALUES('c-02-004',2,'El Karimia','الكريمية','02004');
INSERT INTO communes VALUES('c-02-005',2,'Tadjna','تاجنة','02005');
INSERT INTO communes VALUES('c-02-006',2,'Taougrite','تاوقريت','02006');
INSERT INTO communes VALUES('c-02-007',2,'Beni Haoua','بني حواء','02007');
INSERT INTO communes VALUES('c-02-008',2,'Sobha','صبحة','02008');
INSERT INTO communes VALUES('c-02-009',2,'Harchoun','حرشون','02009');
INSERT INTO communes VALUES('c-02-010',2,'Ouled Fares','أولاد فارس','02010');
INSERT INTO communes VALUES('c-02-011',2,'Sidi Akacha','سيدي عكاشة','02011');
INSERT INTO communes VALUES('c-02-012',2,'Boukadir','بوقدير','02012');
INSERT INTO communes VALUES('c-02-013',2,'Beni Rached','بني راشد','02013');
INSERT INTO communes VALUES('c-02-014',2,'Talassa','تلعصة','02014');
INSERT INTO communes VALUES('c-02-015',2,'Herenfa','الهرنفة','02015');
INSERT INTO communes VALUES('c-02-016',2,'Oued Goussine','واد ڨوسين','02016');
INSERT INTO communes VALUES('c-02-017',2,'Dahra','الظهرة','02017');
INSERT INTO communes VALUES('c-02-018',2,'Ouled Abbes','أولاد عباس','02018');
INSERT INTO communes VALUES('c-02-019',2,'Sendjas','سنجاس','02019');
INSERT INTO communes VALUES('c-02-020',2,'Zeboudja','الزبوجة','02020');
INSERT INTO communes VALUES('c-02-021',2,'Oued Sly','واد سلي','02021');
INSERT INTO communes VALUES('c-02-022',2,'Abou El Hassen','أبو الحسن','02022');
INSERT INTO communes VALUES('c-02-023',2,'El Marsa','المرصى','02023');
INSERT INTO communes VALUES('c-02-024',2,'Chettia','الشطية','02024');
INSERT INTO communes VALUES('c-02-025',2,'Sidi Abderrahmane','سيدي عبد الرحمان','02025');
INSERT INTO communes VALUES('c-02-026',2,'Moussadek','مصدق','02026');
INSERT INTO communes VALUES('c-02-027',2,'El Hadjadj','الحجاج','02027');
INSERT INTO communes VALUES('c-02-028',2,'Labiod Medjadja','الأبيض مجاجة','02028');
INSERT INTO communes VALUES('c-02-029',2,'Oued Fodda','واد الفضة','02029');
INSERT INTO communes VALUES('c-02-030',2,'Ouled Ben Abdelkader','أولاد بن عبد القادر','02030');
INSERT INTO communes VALUES('c-02-031',2,'Bouzghaia','بوزغاية','02031');
INSERT INTO communes VALUES('c-02-032',2,'Ain Merane','عين مران','02032');
INSERT INTO communes VALUES('c-02-033',2,'Oum Drou','أم الذروع','02033');
INSERT INTO communes VALUES('c-02-034',2,'Breira','بريرة','02034');
INSERT INTO communes VALUES('c-02-035',2,'Beni Bouateb','بني بوعتاب','02035');
INSERT INTO communes VALUES('c-03-001',3,'Laghouat','الأغواط','03001');
INSERT INTO communes VALUES('c-03-002',3,'Ksar El Hirane','قصر الحيران','03002');
INSERT INTO communes VALUES('c-03-003',3,'Benacer Ben Chohra','بن ناصر بن شهرة','03003');
INSERT INTO communes VALUES('c-03-004',3,'Sidi Makhlouf','سيدي مخلوف','03004');
INSERT INTO communes VALUES('c-03-005',3,'Hassi Delaa','حاسي دلاعة','03005');
INSERT INTO communes VALUES('c-03-006',3,'Hassi R''Mel','حاسي الرمل','03006');
INSERT INTO communes VALUES('c-03-007',3,'Ain Mahdi','عــيــن مـــاضــي','03007');
INSERT INTO communes VALUES('c-03-008',3,'Tadjmout','تاجموت','03008');
INSERT INTO communes VALUES('c-03-009',3,'El Kheneg','الخنق','03009');
INSERT INTO communes VALUES('c-03-010',3,'Gueltat Sidi Saad','قلتة سيدي سعد','03010');
INSERT INTO communes VALUES('c-03-011',3,'Ain Sidi Ali','عين سيدي علي','03011');
INSERT INTO communes VALUES('c-03-012',3,'Beidha','بيضاء','03012');
INSERT INTO communes VALUES('c-03-013',3,'Brida','بريدة','03013');
INSERT INTO communes VALUES('c-03-014',3,'El Ghicha','الغيشة','03014');
INSERT INTO communes VALUES('c-03-015',3,'Hadj Mechri','الحاج المشري','03015');
INSERT INTO communes VALUES('c-03-016',3,'Sebgag','سبقاق','03016');
INSERT INTO communes VALUES('c-03-017',3,'Taouiala','تاويالة','03017');
INSERT INTO communes VALUES('c-03-018',3,'Tadjrouna','تاجرونة','03018');
INSERT INTO communes VALUES('c-03-019',3,'Aflou','أفلو','03019');
INSERT INTO communes VALUES('c-03-020',3,'El Assafia','العسافية','03020');
INSERT INTO communes VALUES('c-03-021',3,'Oued Morra','وادي مرة','03021');
INSERT INTO communes VALUES('c-03-022',3,'Oued M''Zi','وادي مزي','03022');
INSERT INTO communes VALUES('c-03-023',3,'El Haouaita','الهوارية','03023');
INSERT INTO communes VALUES('c-03-024',3,'Sidi Bouzid','سيدي بوزيد','03024');
INSERT INTO communes VALUES('c-04-001',4,'Oum El Bouaghi','أم البواقي','04001');
INSERT INTO communes VALUES('c-04-002',4,'Ain Beida','عين البيضاء','04002');
INSERT INTO communes VALUES('c-04-003',4,'Ain M''lila','عين مليلة','04003');
INSERT INTO communes VALUES('c-04-004',4,'Behir Chergui','بحير الشرڨي','04004');
INSERT INTO communes VALUES('c-04-005',4,'El Amiria','العامرية','04005');
INSERT INTO communes VALUES('c-04-006',4,'Sigus','سيقوس','04006');
INSERT INTO communes VALUES('c-04-007',4,'El Belala','البلالة','04007');
INSERT INTO communes VALUES('c-04-008',4,'Ain Babouche','عين بابوش','04008');
INSERT INTO communes VALUES('c-04-009',4,'Berriche','بريش','04009');
INSERT INTO communes VALUES('c-04-010',4,'Ouled Hamla','أولاد حملة','04010');
INSERT INTO communes VALUES('c-04-011',4,'Dhala','الضلعة','04011');
INSERT INTO communes VALUES('c-04-012',4,'Ain Kercha','عين كرشة','04012');
INSERT INTO communes VALUES('c-04-013',4,'Hanchir Toumghani','هنشير تومغني','04013');
INSERT INTO communes VALUES('c-04-014',4,'El Djazia','الجازيـــــــة','04014');
INSERT INTO communes VALUES('c-04-015',4,'Ain Diss','عين الديس','04015');
INSERT INTO communes VALUES('c-04-016',4,'Fkirina','فكرينة','04016');
INSERT INTO communes VALUES('c-04-017',4,'Souk Naamane','سوق نعمان','04017');
INSERT INTO communes VALUES('c-04-018',4,'Zorg','الزرڨ','04018');
INSERT INTO communes VALUES('c-04-019',4,'El Fedjoudj Boughrara Saoudi','الفجوج بوغرارة سعودى','04019');
INSERT INTO communes VALUES('c-04-020',4,'Ouled Zouai','أولاد زواي','04020');
INSERT INTO communes VALUES('c-04-021',4,'Bir Chouhada','بئر الشهداء','04021');
INSERT INTO communes VALUES('c-04-022',4,'Ksar Sbahi','قصر صباحي','04022');
INSERT INTO communes VALUES('c-04-023',4,'Oued Nini','وادي نيني','04023');
INSERT INTO communes VALUES('c-04-024',4,'Meskiana','مسكيانة','04024');
INSERT INTO communes VALUES('c-04-025',4,'Ain Fekroune','عين فكرون','04025');
INSERT INTO communes VALUES('c-04-026',4,'Rahia','الراحية','04026');
INSERT INTO communes VALUES('c-04-027',4,'Ain Zitoun','عين الزيتون','04027');
INSERT INTO communes VALUES('c-04-028',4,'Ouled Gacem','أولاد ڨاسم','04028');
INSERT INTO communes VALUES('c-04-029',4,'El Harmilia','الحرملية','04029');
INSERT INTO communes VALUES('c-05-001',5,'Batna','باتنة','05001');
INSERT INTO communes VALUES('c-05-002',5,'Ghassira','غسيرة','05002');
INSERT INTO communes VALUES('c-05-003',5,'Maafa','معافة','05003');
INSERT INTO communes VALUES('c-05-004',5,'Merouana','مروانة','05004');
INSERT INTO communes VALUES('c-05-005',5,'Seriana','سريانة','05005');
INSERT INTO communes VALUES('c-05-006',5,'Menaa','منعة','05006');
INSERT INTO communes VALUES('c-05-007',5,'El Madher','المعذر','05007');
INSERT INTO communes VALUES('c-05-008',5,'Tazoult','تازولت','05008');
INSERT INTO communes VALUES('c-05-009',5,'Ngaous','نڨاوس','05009');
INSERT INTO communes VALUES('c-05-010',5,'Guigba','قيقبة','05010');
INSERT INTO communes VALUES('c-05-011',5,'Inoughissen','إينوغيسن','05011');
INSERT INTO communes VALUES('c-05-012',5,'Ouyoun El Assafir','عيون العصافير','05012');
INSERT INTO communes VALUES('c-05-013',5,'Djerma','جرمة','05013');
INSERT INTO communes VALUES('c-05-014',5,'Bitam','بيطام','05014');
INSERT INTO communes VALUES('c-05-015',5,'Metkaouak','عزيل عبد القادر','05015');
INSERT INTO communes VALUES('c-05-016',5,'Arris','اريس','05016');
INSERT INTO communes VALUES('c-05-017',5,'Kimmel','كيمل','05017');
INSERT INTO communes VALUES('c-05-018',5,'Tilatou','تيلاطو','05018');
INSERT INTO communes VALUES('c-05-019',5,'Ain Djasser','عين جاسر','05019');
INSERT INTO communes VALUES('c-05-020',5,'Ouled Selam','أولاد سلام','05020');
INSERT INTO communes VALUES('c-05-021',5,'Tigherghar','تيغرغار','05021');
INSERT INTO communes VALUES('c-05-022',5,'Ain Yagout','عين ياقوت','05022');
INSERT INTO communes VALUES('c-05-023',5,'Fesdis','فسديس','05023');
INSERT INTO communes VALUES('c-05-024',5,'Sefiane','سفيان','05024');
INSERT INTO communes VALUES('c-05-025',5,'Rahbat','الرحبات','05025');
INSERT INTO communes VALUES('c-05-026',5,'Tighanimine','تيغانمين','05026');
INSERT INTO communes VALUES('c-05-027',5,'Lemsane','لمسان','05027');
INSERT INTO communes VALUES('c-05-028',5,'Ksar Belezma','قصر بلازمة','05028');
INSERT INTO communes VALUES('c-05-029',5,'Seggana','سقانة','05029');
INSERT INTO communes VALUES('c-05-030',5,'Ichmoul','ايشمول','05030');
INSERT INTO communes VALUES('c-05-031',5,'Foum Toub','فم الطوب','05031');
INSERT INTO communes VALUES('c-05-032',5,'Beni Foudhala El Hakania','بنى فضالة الحقانية','05032');
INSERT INTO communes VALUES('c-05-033',5,'Oued El Ma','واد الماء','05033');
INSERT INTO communes VALUES('c-05-034',5,'Talkhamt','تالخمت','05034');
INSERT INTO communes VALUES('c-05-035',5,'Bouzina','بوزينة','05035');
INSERT INTO communes VALUES('c-05-036',5,'Chemora','الشمرة','05036');
INSERT INTO communes VALUES('c-05-037',5,'Oued Chaaba','واد الشعبة','05037');
INSERT INTO communes VALUES('c-05-038',5,'Taxlent','تاكسلانت','05038');
INSERT INTO communes VALUES('c-05-039',5,'Gosbat','القصبات','05039');
INSERT INTO communes VALUES('c-05-040',5,'Ouled Aouf','أولاد عوف','05040');
INSERT INTO communes VALUES('c-05-041',5,'Boumagueur','بــومقر','05041');
INSERT INTO communes VALUES('c-05-042',5,'Barika','بريكة','05042');
INSERT INTO communes VALUES('c-05-043',5,'Djezzar','الجزار','05043');
INSERT INTO communes VALUES('c-05-044',5,'Tkout','تكوت','05044');
INSERT INTO communes VALUES('c-05-045',5,'Ain Touta','عين التوتة','05045');
INSERT INTO communes VALUES('c-05-046',5,'Hidoussa','حيدوسة','05046');
INSERT INTO communes VALUES('c-05-047',5,'Teniet El Abed','نية العابد','05047');
INSERT INTO communes VALUES('c-05-048',5,'Oued Taga','وادي الطاقة','05048');
INSERT INTO communes VALUES('c-05-049',5,'Ouled Fadel','أولاد فاضل','05049');
INSERT INTO communes VALUES('c-05-050',5,'Timgad','تيمقاد','05050');
INSERT INTO communes VALUES('c-05-051',5,'Ras El Aioun','رأس العيون','05051');
INSERT INTO communes VALUES('c-05-052',5,'Chir','شير','05052');
INSERT INTO communes VALUES('c-05-053',5,'Ouled Si Slimane','أولاد سي سليمان','05053');
INSERT INTO communes VALUES('c-05-054',5,'Zanat El Beida','زانة البيضاء','05054');
INSERT INTO communes VALUES('c-05-055',5,'M''doukel','أمدوكال','05055');
INSERT INTO communes VALUES('c-05-056',5,'Ouled Ammar','أولاد عمار','05056');
INSERT INTO communes VALUES('c-05-057',5,'El Hassi','الحاسي','05057');
INSERT INTO communes VALUES('c-05-058',5,'Lazrou','لازرو','05058');
INSERT INTO communes VALUES('c-05-059',5,'Boumia','بومية','05059');
INSERT INTO communes VALUES('c-05-060',5,'Boulhilat','بولهيلات','05060');
INSERT INTO communes VALUES('c-05-061',5,'Larbaa','الاربعاء','05061');
INSERT INTO communes VALUES('c-06-001',6,'Bejaia','بجاية','06001');
INSERT INTO communes VALUES('c-06-002',6,'Amizour','اميزور','06002');
INSERT INTO communes VALUES('c-06-003',6,'Ferraoun','فرعون','06003');
INSERT INTO communes VALUES('c-06-004',6,'Taourirt Ighil','تاوريرت اغيل','06004');
INSERT INTO communes VALUES('c-06-005',6,'Chelata','شلاطة','06005');
INSERT INTO communes VALUES('c-06-006',6,'Tamokra','تامقرة','06006');
INSERT INTO communes VALUES('c-06-007',6,'Timzrit','تيمزريت','06007');
INSERT INTO communes VALUES('c-06-008',6,'Souk El Thenine','ﺳﻮق اﻻﺛﻨﻴﻦ','06008');
INSERT INTO communes VALUES('c-06-009',6,'M''cisna','مسيسنة','06009');
INSERT INTO communes VALUES('c-06-010',6,'Thinabdher','تينبذار','06010');
INSERT INTO communes VALUES('c-06-011',6,'Tichi','تيشي','06011');
INSERT INTO communes VALUES('c-06-012',6,'Semaoun','سمعون','06012');
INSERT INTO communes VALUES('c-06-013',6,'Kendira','كنديرة','06013');
INSERT INTO communes VALUES('c-06-014',6,'Tifra','تيفرة','06014');
INSERT INTO communes VALUES('c-06-015',6,'Ighram','إغرم','06015');
INSERT INTO communes VALUES('c-06-016',6,'Amalou','امالو','06016');
INSERT INTO communes VALUES('c-06-017',6,'Ighil Ali','إغيل على','06017');
INSERT INTO communes VALUES('c-06-018',6,'Ifelain Ilmathen','افناين الماثن','06018');
INSERT INTO communes VALUES('c-06-019',6,'Toudja','توجة','06019');
INSERT INTO communes VALUES('c-06-020',6,'Darguina','درقينة','06020');
INSERT INTO communes VALUES('c-06-021',6,'Sidi Ayad','سيدي عياد','06021');
INSERT INTO communes VALUES('c-06-022',6,'Aokas','أوقاس','06022');
INSERT INTO communes VALUES('c-06-023',6,'Ait Djellil','آيث جليل','06023');
INSERT INTO communes VALUES('c-06-024',6,'Adekar','آدكار','06024');
INSERT INTO communes VALUES('c-06-025',6,'Akbou','أقبو','06025');
INSERT INTO communes VALUES('c-06-026',6,'Seddouk','صدوق','06026');
INSERT INTO communes VALUES('c-06-027',6,'Tazmalt','تازمالت','06027');
INSERT INTO communes VALUES('c-06-028',6,'Ait R''zine','آيت أرزين','06028');
INSERT INTO communes VALUES('c-06-029',6,'Chemini','شميني','06029');
INSERT INTO communes VALUES('c-06-030',6,'Souk Oufella','سوق أوفلة','06030');
INSERT INTO communes VALUES('c-06-031',6,'Taskriout','تاسقريوت','06031');
INSERT INTO communes VALUES('c-06-032',6,'Tibane','طيبان','06032');
INSERT INTO communes VALUES('c-06-033',6,'Tala Hamza','ثالة حمزة','06033');
INSERT INTO communes VALUES('c-06-034',6,'Barbacha','برباشة','06034');
INSERT INTO communes VALUES('c-06-035',6,'Beni Ksila','بنى كسيلة','06035');
INSERT INTO communes VALUES('c-06-036',6,'Ouzallaguen','أوزلاقن','06036');
INSERT INTO communes VALUES('c-06-037',6,'Bouhamza','بوحمزة','06037');
INSERT INTO communes VALUES('c-06-038',6,'Beni Melikeche','بنى مليكش','06038');
INSERT INTO communes VALUES('c-06-039',6,'Sidi Aich','سيدي عيش','06039');
INSERT INTO communes VALUES('c-06-040',6,'El Kseur','القصر','06040');
INSERT INTO communes VALUES('c-06-041',6,'Melbou','ملبو','06041');
INSERT INTO communes VALUES('c-06-042',6,'Akfadou','اكفادو','06042');
INSERT INTO communes VALUES('c-06-043',6,'Leflaye','لفلاى','06043');
INSERT INTO communes VALUES('c-06-044',6,'Kherrata','خراطة','06044');
INSERT INTO communes VALUES('c-06-045',6,'Draa Kaid','ذراع القايد','06045');
INSERT INTO communes VALUES('c-06-046',6,'Tamridjet','تامريجت','06046');
INSERT INTO communes VALUES('c-06-047',6,'Ait Smail','آيت سماعيل','06047');
INSERT INTO communes VALUES('c-06-048',6,'Boukhelifa','بوخليفة','06048');
INSERT INTO communes VALUES('c-06-049',6,'Tizi N''berber','تيزى نبربر','06049');
INSERT INTO communes VALUES('c-06-050',6,'Beni Maouch','بني معوش','06050');
INSERT INTO communes VALUES('c-06-051',6,'Oued Ghir','وادي غير','06051');
INSERT INTO communes VALUES('c-06-052',6,'Boudjellil','بوجليل','06052');
INSERT INTO communes VALUES('c-07-001',7,'Biskra','بسكرة','07001');
INSERT INTO communes VALUES('c-07-002',7,'Oumache','أوماش','07002');
INSERT INTO communes VALUES('c-07-003',7,'Branis','البرانس','07003');
INSERT INTO communes VALUES('c-07-004',7,'Chetma','شتمة','07004');
INSERT INTO communes VALUES('c-07-005',7,'Ouled Djellal','أولاد جلال','07005');
INSERT INTO communes VALUES('c-07-006',7,'Ras El Miaad','راس الميعاد','07006');
INSERT INTO communes VALUES('c-07-007',7,'Besbes','البسباس','07007');
INSERT INTO communes VALUES('c-07-008',7,'Sidi Khaled','سيدي خالد','07008');
INSERT INTO communes VALUES('c-07-009',7,'Doucen','الدوسن','07009');
INSERT INTO communes VALUES('c-07-010',7,'Ech Chaiba','أولاد رحمة','07010');
INSERT INTO communes VALUES('c-07-011',7,'Sidi Okba','سيدي عقبة','07011');
INSERT INTO communes VALUES('c-07-012',7,'Mchouneche','مشونش','07012');
INSERT INTO communes VALUES('c-07-013',7,'El Haouch','الحوش','07013');
INSERT INTO communes VALUES('c-07-014',7,'Ain Naga','عين الناقة','07014');
INSERT INTO communes VALUES('c-07-015',7,'Zeribet El Oued','زريبة الوادي','07015');
INSERT INTO communes VALUES('c-07-016',7,'El Feidh','الفيض','07016');
INSERT INTO communes VALUES('c-07-017',7,'El Kantara','القنطرة','07017');
INSERT INTO communes VALUES('c-07-018',7,'Ain Zaatout','عين زعطوط','07018');
INSERT INTO communes VALUES('c-07-019',7,'El Outaya','لوطاية','07019');
INSERT INTO communes VALUES('c-07-020',7,'Djemorah','جمورة','07020');
INSERT INTO communes VALUES('c-07-021',7,'Tolga','طولقة','07021');
INSERT INTO communes VALUES('c-07-022',7,'Lioua','لواء','07022');
INSERT INTO communes VALUES('c-07-023',7,'Lichana','لشانة','07023');
INSERT INTO communes VALUES('c-07-024',7,'Ourlal','أورلال','07024');
INSERT INTO communes VALUES('c-07-025',7,'M''lili','مليلي','07025');
INSERT INTO communes VALUES('c-07-026',7,'Foughala','فوغالة','07026');
INSERT INTO communes VALUES('c-07-027',7,'Bordj Ben Azzouz','برج بن عزوز','07027');
INSERT INTO communes VALUES('c-07-028',7,'M''ziraa','مزيرعة','07028');
INSERT INTO communes VALUES('c-07-029',7,'Bouchagroun','بوشقرون','07029');
INSERT INTO communes VALUES('c-07-030',7,'Mekhadma','مخادمة','07030');
INSERT INTO communes VALUES('c-07-031',7,'El Ghrous','الغروس','07031');
INSERT INTO communes VALUES('c-07-032',7,'El Hadjab','الحاجب','07032');
INSERT INTO communes VALUES('c-07-033',7,'Khanguet Sidinadji','خنڨة سيدي ناجي','07033');
INSERT INTO communes VALUES('c-08-001',8,'Bechar','بشار','08001');
INSERT INTO communes VALUES('c-08-002',8,'Erg Ferradj','عرق فراج','08002');
INSERT INTO communes VALUES('c-08-003',8,'Ouled Khoudir','أولاد خدير','08003');
INSERT INTO communes VALUES('c-08-004',8,'Meridja','مريجة','08004');
INSERT INTO communes VALUES('c-08-005',8,'Timoudi','تيمودى','08005');
INSERT INTO communes VALUES('c-08-006',8,'Lahmar','لحمر','08006');
INSERT INTO communes VALUES('c-08-007',8,'Beni Abbes','بني عباس','08007');
INSERT INTO communes VALUES('c-08-008',8,'Beni Ikhlef','بني يخلف','08008');
INSERT INTO communes VALUES('c-08-009',8,'Mechraa Houari Boumedienne','مشرع ھوارى بومدين','08009');
INSERT INTO communes VALUES('c-08-010',8,'Kenedsa','القنادسة','08010');
INSERT INTO communes VALUES('c-08-011',8,'Igli','إقلي','08011');
INSERT INTO communes VALUES('c-08-012',8,'Tabalbala','تبلبالة','08012');
INSERT INTO communes VALUES('c-08-013',8,'Taghit','تــــاغـيــث','08013');
INSERT INTO communes VALUES('c-08-014',8,'El Ouata','الوطى','08014');
INSERT INTO communes VALUES('c-08-015',8,'Boukais','بوكايس','08015');
INSERT INTO communes VALUES('c-08-016',8,'Mogheul','موغل','08016');
INSERT INTO communes VALUES('c-08-017',8,'Abadla','العبادلة','08017');
INSERT INTO communes VALUES('c-08-018',8,'Kerzaz','كرزاز','08018');
INSERT INTO communes VALUES('c-08-019',8,'Ksabi','قصابى','08019');
INSERT INTO communes VALUES('c-08-020',8,'Tamtert','تامترت','08020');
INSERT INTO communes VALUES('c-08-021',8,'Beni Ounif','بني ونيف','08021');
INSERT INTO communes VALUES('c-09-001',9,'Blida','البليدة‎','09001');
INSERT INTO communes VALUES('c-09-002',9,'Chebli','الشبلي','09002');
INSERT INTO communes VALUES('c-09-003',9,'Bouinan','بوعينان','09003');
INSERT INTO communes VALUES('c-09-004',9,'Oued El Alleug','واد العلايڨ','09004');
INSERT INTO communes VALUES('c-09-005',9,'Ouled Yaich','اولاد يعيش','09007');
INSERT INTO communes VALUES('c-09-006',9,'Chrea','الشريعة','09008');
INSERT INTO communes VALUES('c-09-007',9,'El Affroun','العفرون','09010');
INSERT INTO communes VALUES('c-09-008',9,'Chiffa','الشفة','09011');
INSERT INTO communes VALUES('c-09-009',9,'Hammam Melouane','حمام ملوان','09012');
INSERT INTO communes VALUES('c-09-010',9,'Ben Khlil','بني خليل','09013');
INSERT INTO communes VALUES('c-09-011',9,'Soumaa','صومعة','09014');
INSERT INTO communes VALUES('c-09-012',9,'Mouzaia','موزاية','09016');
INSERT INTO communes VALUES('c-09-013',9,'Souhane','صوحان','09017');
INSERT INTO communes VALUES('c-09-014',9,'Meftah','مفتاح','09018');
INSERT INTO communes VALUES('c-09-015',9,'Ouled Selama','أولاد سلامة','09019');
INSERT INTO communes VALUES('c-09-016',9,'Boufarik','بوفاريك','09020');
INSERT INTO communes VALUES('c-09-017',9,'Larbaa','الاربعاء','09021');
INSERT INTO communes VALUES('c-09-018',9,'Oued Djer','واد جر','09022');
INSERT INTO communes VALUES('c-09-019',9,'Beni Tamou','بني تامو','09023');
INSERT INTO communes VALUES('c-09-020',9,'Bouarfa','بوعرفة','09024');
INSERT INTO communes VALUES('c-09-021',9,'Beni Mered','بني مراد','09025');
INSERT INTO communes VALUES('c-09-022',9,'Bougara','بوڨرة','09026');
INSERT INTO communes VALUES('c-09-023',9,'Guerrouaou','ڨرواو','09027');
INSERT INTO communes VALUES('c-09-024',9,'Ain Romana','عين الرمانة','09028');
INSERT INTO communes VALUES('c-09-025',9,'Djebabra','جبابرة','09029');
INSERT INTO communes VALUES('c-10-001',10,'Bouira','البويرة','10001');
INSERT INTO communes VALUES('c-10-002',10,'El Asnam','الأصنام','10002');
INSERT INTO communes VALUES('c-10-003',10,'Guerrouma','قرومة','10003');
INSERT INTO communes VALUES('c-10-004',10,'Souk El Khemis','سوق الخميس','10004');
INSERT INTO communes VALUES('c-10-005',10,'Kadiria','قادرية','10005');
INSERT INTO communes VALUES('c-10-006',10,'Hanif','احنيف','10006');
INSERT INTO communes VALUES('c-10-007',10,'Dirah','ديــرة','10007');
INSERT INTO communes VALUES('c-10-008',10,'Ait Laaziz','آيت لعزيز','10008');
INSERT INTO communes VALUES('c-10-009',10,'Taghzout','تاغزوت','10009');
INSERT INTO communes VALUES('c-10-010',10,'Raouraoua','الروراوة','10010');
INSERT INTO communes VALUES('c-10-011',10,'Mezdour','مسدور','10011');
INSERT INTO communes VALUES('c-10-012',10,'Haizer','حيزر','10012');
INSERT INTO communes VALUES('c-10-013',10,'Lakhdaria','الأخضرية','10013');
INSERT INTO communes VALUES('c-10-014',10,'Maala','معالة','10014');
INSERT INTO communes VALUES('c-10-015',10,'El Hachimia','الھاشمية','10015');
INSERT INTO communes VALUES('c-10-016',10,'Aomar','أعمر','10016');
INSERT INTO communes VALUES('c-10-017',10,'Chorfa','الشرفاء','10017');
INSERT INTO communes VALUES('c-10-018',10,'Bordj Oukhriss','برج أوخريص','10018');
INSERT INTO communes VALUES('c-10-019',10,'El Adjiba','العجيبة','10019');
INSERT INTO communes VALUES('c-10-020',10,'El Hakimia','الحاكمية','10020');
INSERT INTO communes VALUES('c-10-021',10,'El Khebouzia','الخبوزية','10021');
INSERT INTO communes VALUES('c-10-022',10,'Ahl El Ksar','أھل القصر','10022');
INSERT INTO communes VALUES('c-10-023',10,'Bouderbala','بودربالة','10023');
INSERT INTO communes VALUES('c-10-024',10,'Zbarbar','زبربر','10024');
INSERT INTO communes VALUES('c-10-025',10,'Ain El Hadjar','عين الحجر','10025');
INSERT INTO communes VALUES('c-10-026',10,'Djebahia','الجباحية','10026');
INSERT INTO communes VALUES('c-10-027',10,'Aghbalou','أغبالو','10027');
INSERT INTO communes VALUES('c-10-028',10,'Taguedit','تاڨديت','10028');
INSERT INTO communes VALUES('c-10-029',10,'Ain Turk','عين الترك','10029');
INSERT INTO communes VALUES('c-10-030',10,'Saharidj','الصهاريج','10030');
INSERT INTO communes VALUES('c-10-031',10,'Dechmia','الدشمية','10031');
INSERT INTO communes VALUES('c-10-032',10,'Ridane','ريدان','10032');
INSERT INTO communes VALUES('c-10-033',10,'Bechloul','بشلول','10033');
INSERT INTO communes VALUES('c-10-034',10,'Boukram','بوكرام','10034');
INSERT INTO communes VALUES('c-10-035',10,'Ain Bessam','عين بسام','10035');
INSERT INTO communes VALUES('c-10-036',10,'Bir Ghbalou','بئر غبالو','10036');
INSERT INTO communes VALUES('c-10-037',10,'Mchedallah','مشدا الله','10037');
INSERT INTO communes VALUES('c-10-038',10,'Sour El Ghozlane','سور الغزلان','10038');
INSERT INTO communes VALUES('c-10-039',10,'Maamora','المعمورة','10039');
INSERT INTO communes VALUES('c-10-040',10,'Ouled Rached','أولاد راشد','10040');
INSERT INTO communes VALUES('c-10-041',10,'Ain Laloui','عين العلوي','10041');
INSERT INTO communes VALUES('c-10-042',10,'Hadjera Zerga','الحجرة الزرقاء','10042');
INSERT INTO communes VALUES('c-10-043',10,'Ath Mansour','آث منصور','10043');
INSERT INTO communes VALUES('c-10-044',10,'El Mokrani','المقراني','10044');
INSERT INTO communes VALUES('c-10-045',10,'Oued El Berdi','وادى البردي','10045');
INSERT INTO communes VALUES('c-11-001',11,'Tamanghasset','تمنراست','11001');
INSERT INTO communes VALUES('c-11-002',11,'Abalessa','أبلسة','11002');
INSERT INTO communes VALUES('c-11-003',11,'In Ghar','عـيـن غــار','11003');
INSERT INTO communes VALUES('c-11-004',11,'In Guezzam','عين قزام','11004');
INSERT INTO communes VALUES('c-11-005',11,'Idles','إدلس','11005');
INSERT INTO communes VALUES('c-11-006',11,'Tazouk','تاظروك','11006');
INSERT INTO communes VALUES('c-11-007',11,'Tinzaouatine','تين زاوتين','11007');
INSERT INTO communes VALUES('c-11-008',11,'In Salah','عين صالح','11008');
INSERT INTO communes VALUES('c-11-009',11,'In Amguel','ان أمقل','11009');
INSERT INTO communes VALUES('c-11-010',11,'Foggaret Ezzaouia','فقارة الزوى','11010');
INSERT INTO communes VALUES('c-12-001',12,'Tebessa','تبسة','12001');
INSERT INTO communes VALUES('c-12-002',12,'Bir El Ater','بئر العاتر','12002');
INSERT INTO communes VALUES('c-12-003',12,'Cheria','الــشــريــعـة','12003');
INSERT INTO communes VALUES('c-12-004',12,'Stah Guentis','سطح قنطيس','12004');
INSERT INTO communes VALUES('c-12-005',12,'El Aouinet','العوينات','12005');
INSERT INTO communes VALUES('c-12-006',12,'Lahouidjbet','الحويجبات','12006');
INSERT INTO communes VALUES('c-12-007',12,'Safsaf El Ouesra','صفصاف الوسرة','12007');
INSERT INTO communes VALUES('c-12-008',12,'Hammamet','الحمامات','12008');
INSERT INTO communes VALUES('c-12-009',12,'Negrine','نقرين','12009');
INSERT INTO communes VALUES('c-12-010',12,'Bir El Mokadem','بــئــر مــقـدم','12010');
INSERT INTO communes VALUES('c-12-011',12,'El Kouif','الكويف','12011');
INSERT INTO communes VALUES('c-12-012',12,'Morsott','مرسط','12012');
INSERT INTO communes VALUES('c-12-013',12,'El Ogla','العقلة','12013');
INSERT INTO communes VALUES('c-12-014',12,'Bir Dheb','بٔير الذھب','12014');
INSERT INTO communes VALUES('c-12-015',12,'El Ogla','العقلة','12015');
INSERT INTO communes VALUES('c-12-016',12,'Gorriguer','قوريقر','12016');
INSERT INTO communes VALUES('c-12-017',12,'Bekkaria','بكارية','12017');
INSERT INTO communes VALUES('c-12-018',12,'Boukhadra','بوخضرة','12018');
INSERT INTO communes VALUES('c-12-019',12,'Ouenza','الونزة','12019');
INSERT INTO communes VALUES('c-12-020',12,'El Ma El Biodh','الماء الأبيض','12020');
INSERT INTO communes VALUES('c-12-021',12,'Oum Ali','أم على','12021');
INSERT INTO communes VALUES('c-12-022',12,'Tlidjene','ثليجان','12022');
INSERT INTO communes VALUES('c-12-023',12,'Ain Zerga','عين الزرقاء','12023');
INSERT INTO communes VALUES('c-12-024',12,'El Meridj','المريج','12024');
INSERT INTO communes VALUES('c-12-025',12,'Boulhaf Dyr','بولحاف الدير','12025');
INSERT INTO communes VALUES('c-12-026',12,'Bedjene','بجن','12026');
INSERT INTO communes VALUES('c-12-027',12,'El Mazeraa','المزرعة','12027');
INSERT INTO communes VALUES('c-12-028',12,'Ferkane','فـــــــركـــــان','12028');
INSERT INTO communes VALUES('c-13-001',13,'Tlemcen','تلمسان','13001');
INSERT INTO communes VALUES('c-13-002',13,'Beni Mester','بني مستار','13002');
INSERT INTO communes VALUES('c-13-003',13,'Ain Tallout','عين تالوت','13003');
INSERT INTO communes VALUES('c-13-004',13,'Remchi','الرمشي','13004');
INSERT INTO communes VALUES('c-13-005',13,'El Fehoul','الفحول','13005');
INSERT INTO communes VALUES('c-13-006',13,'Sabra','صبرة','13006');
INSERT INTO communes VALUES('c-13-007',13,'Ghazaouet','الغزوات','13007');
INSERT INTO communes VALUES('c-13-008',13,'Souani','السواني','13008');
INSERT INTO communes VALUES('c-13-009',13,'Djebala','جبالة','13009');
INSERT INTO communes VALUES('c-13-010',13,'El Gor','الغور','13010');
INSERT INTO communes VALUES('c-13-011',13,'Oued Chouly','وادى الشولى','13011');
INSERT INTO communes VALUES('c-13-012',13,'Ain Fezza','عين فزّة','13012');
INSERT INTO communes VALUES('c-13-013',13,'Ouled Mimoun','أولاد ميمون','13013');
INSERT INTO communes VALUES('c-13-014',13,'Amieur','عمير','13014');
INSERT INTO communes VALUES('c-13-015',13,'Ain Youcef','عين يوسف','13015');
INSERT INTO communes VALUES('c-13-016',13,'Zenata','زناتة','13016');
INSERT INTO communes VALUES('c-13-017',13,'Beni Snous','بنى سنوس','13017');
INSERT INTO communes VALUES('c-13-018',13,'Bab El Assa','باب العسة','13018');
INSERT INTO communes VALUES('c-13-019',13,'Dar Yaghmouracene','دار يغمراسن','13019');
INSERT INTO communes VALUES('c-13-020',13,'Fellaoucene','فلاوسن','13020');
INSERT INTO communes VALUES('c-13-021',13,'Azails','العزايل','13021');
INSERT INTO communes VALUES('c-13-022',13,'Sebbaa Chioukh','سبعة شيوخ','13022');
INSERT INTO communes VALUES('c-13-023',13,'Terni Beni Hediel','تيرني بني هديل','13023');
INSERT INTO communes VALUES('c-13-024',13,'Bensekrane','بن سكران','13024');
INSERT INTO communes VALUES('c-13-025',13,'Ain Nehala','عين نحالة','13025');
INSERT INTO communes VALUES('c-13-026',13,'Hennaya','الحناية','13026');
INSERT INTO communes VALUES('c-13-027',13,'Maghnia','مغنية','13027');
INSERT INTO communes VALUES('c-13-028',13,'Hammam Boughrara','حمام بوغرارة','13028');
INSERT INTO communes VALUES('c-13-029',13,'Souahlia','تونان','13029');
INSERT INTO communes VALUES('c-13-030',13,'Msirda Fouaga','مسيردة الفواقة','13030');
INSERT INTO communes VALUES('c-13-031',13,'Ain Fetah','عين فتاح','13031');
INSERT INTO communes VALUES('c-13-032',13,'El Aricha','العريشة','13032');
INSERT INTO communes VALUES('c-13-033',13,'Souk Thlata','سوق الثلاثاء','13033');
INSERT INTO communes VALUES('c-13-034',13,'Sidi Abdelli','سيدي العبدلي','13034');
INSERT INTO communes VALUES('c-13-035',13,'Sebdou','سبدو','13035');
INSERT INTO communes VALUES('c-13-036',13,'Beni Ouarsous','برج عريمة','13036');
INSERT INTO communes VALUES('c-13-037',13,'Sidi Medjahed','سيدي مجاهد','13037');
INSERT INTO communes VALUES('c-13-038',13,'Beni Boussaid','بني بوسعيد','13038');
INSERT INTO communes VALUES('c-13-039',13,'Marsa Ben Mhidi','مرسى بن مھيدي','13039');
INSERT INTO communes VALUES('c-13-040',13,'Nedroma','ندرومة','13040');
INSERT INTO communes VALUES('c-13-041',13,'Sidi Djillali','سيدي الجيلالي','13041');
INSERT INTO communes VALUES('c-13-042',13,'Beni Bahdel','بني بهدل','13042');
INSERT INTO communes VALUES('c-13-043',13,'El Bouihi','البويھي','13043');
INSERT INTO communes VALUES('c-13-044',13,'Honaine','هنين','13044');
INSERT INTO communes VALUES('c-13-045',13,'Tianet','تيانت','13045');
INSERT INTO communes VALUES('c-13-046',13,'Ouled Riyah','أولاد رياح','13046');
INSERT INTO communes VALUES('c-13-047',13,'Bouhlou','بوحلو','13047');
INSERT INTO communes VALUES('c-13-048',13,'Souk El Khemis','سوق الخميس','13048');
INSERT INTO communes VALUES('c-13-049',13,'Ain Ghoraba','عين غرابة','13049');
INSERT INTO communes VALUES('c-13-050',13,'Chetouane','شتوان','13050');
INSERT INTO communes VALUES('c-13-051',13,'Mansourah','المنصورة','13051');
INSERT INTO communes VALUES('c-13-052',13,'Beni Semiel','بني مستار','13052');
INSERT INTO communes VALUES('c-13-053',13,'Ain Kebira','عين الكبيرة','13053');
INSERT INTO communes VALUES('c-14-001',14,'Tiaret','تيارت‎','14001');
INSERT INTO communes VALUES('c-14-002',14,'Medroussa','مدروسة','14002');
INSERT INTO communes VALUES('c-14-003',14,'Ain Bouchekif','بوشقيف','14003');
INSERT INTO communes VALUES('c-14-004',14,'Sidi Ali Mellal','سيدي علي ملال','14004');
INSERT INTO communes VALUES('c-14-005',14,'Ain Zarit','عين زاريت','14005');
INSERT INTO communes VALUES('c-14-006',14,'Ain Deheb','عين الذهب','14006');
INSERT INTO communes VALUES('c-14-007',14,'Sidi Bakhti','سيدي بختي','14007');
INSERT INTO communes VALUES('c-14-008',14,'Medrissa','مدريسة','14008');
INSERT INTO communes VALUES('c-14-009',14,'Zmalet El Emir Aek','زمالة الأمير عبد القادر','14009');
INSERT INTO communes VALUES('c-14-010',14,'Madna','مادنة','14010');
INSERT INTO communes VALUES('c-14-011',14,'Sebt','السبت','14011');
INSERT INTO communes VALUES('c-14-012',14,'Mellakou','ملاكو','14012');
INSERT INTO communes VALUES('c-14-013',14,'Dahmouni','دحموني','14013');
INSERT INTO communes VALUES('c-14-014',14,'Rahouia','رحوية','14014');
INSERT INTO communes VALUES('c-14-015',14,'Mahdia','المھدية','14015');
INSERT INTO communes VALUES('c-14-016',14,'Sougueur','سوقر','14016');
INSERT INTO communes VALUES('c-14-017',14,'Sidi Abdelghani','سيدي عبد الغنى','14017');
INSERT INTO communes VALUES('c-14-018',14,'Ain El Hadid','عين الحديد','14018');
INSERT INTO communes VALUES('c-14-019',14,'Ouled Djerad','اولاد جراد','14019');
INSERT INTO communes VALUES('c-14-020',14,'Naima','نعيمة','14020');
INSERT INTO communes VALUES('c-14-021',14,'Meghila','مغيلة','14021');
INSERT INTO communes VALUES('c-14-022',14,'Guertoufa','قرطوفة','14022');
INSERT INTO communes VALUES('c-14-023',14,'Sidi Hosni','سيدي حسني','14023');
INSERT INTO communes VALUES('c-14-024',14,'Djillali Ben Amar','جيلالي بن عمار','14024');
INSERT INTO communes VALUES('c-14-025',14,'Sebaine','سبعين','14025');
INSERT INTO communes VALUES('c-14-026',14,'Tousnina','توسنينة','14026');
INSERT INTO communes VALUES('c-14-027',14,'Frenda','فرندة','14027');
INSERT INTO communes VALUES('c-14-028',14,'Ain Kermes','عين كرمس','14028');
INSERT INTO communes VALUES('c-14-029',14,'Ksar Chellala','قصر الشلالة','14029');
INSERT INTO communes VALUES('c-14-030',14,'Rechaiga','الرشايقة','14030');
INSERT INTO communes VALUES('c-14-031',14,'Nadorah','ملاكو','14031');
INSERT INTO communes VALUES('c-14-032',14,'Tagdemt','تاقدمت','14032');
INSERT INTO communes VALUES('c-14-033',14,'Oued Lilli','وادى ليلى','14033');
INSERT INTO communes VALUES('c-14-034',14,'Mechraa Safa','مشرع الصفاء','14034');
INSERT INTO communes VALUES('c-14-035',14,'Hamadia','الحمادية','14035');
INSERT INTO communes VALUES('c-14-036',14,'Chehaima','شحيمة','14036');
INSERT INTO communes VALUES('c-14-037',14,'Takhemaret','تاخمرت','14037');
INSERT INTO communes VALUES('c-14-038',14,'Sidi Abderrahmane','سيدي عبدالرحمان','14038');
INSERT INTO communes VALUES('c-14-039',14,'Serghine','سرغين','14039');
INSERT INTO communes VALUES('c-14-040',14,'Bougara','بوقرة','14040');
INSERT INTO communes VALUES('c-14-041',14,'Faidja','الفايجة','14041');
INSERT INTO communes VALUES('c-14-042',14,'Tidda','تيدة','14042');
INSERT INTO communes VALUES('c-15-001',15,'Tizi Ouzou','تيزي وزو','15001');
INSERT INTO communes VALUES('c-15-002',15,'Ain El Hammam','عين الحمام','15002');
INSERT INTO communes VALUES('c-15-003',15,'Akbil','أقبيل','15003');
INSERT INTO communes VALUES('c-15-004',15,'Freha','فريحة','15004');
INSERT INTO communes VALUES('c-15-005',15,'Souamaa','صوامع','15005');
INSERT INTO communes VALUES('c-15-006',15,'Mechtrass','مشطراس','15006');
INSERT INTO communes VALUES('c-15-007',15,'Irdjen','إرجن','15007');
INSERT INTO communes VALUES('c-15-008',15,'Timizart','تيميزارت','15008');
INSERT INTO communes VALUES('c-15-009',15,'Makouda','ماكودة','15009');
INSERT INTO communes VALUES('c-15-010',15,'Draa El Mizan','ذراع الميزان','15010');
INSERT INTO communes VALUES('c-15-011',15,'Tizi Ghenif','تيزي غنيف','15011');
INSERT INTO communes VALUES('c-15-012',15,'Bounouh','بونوح','15012');
INSERT INTO communes VALUES('c-15-013',15,'Ait Chaffaa','آيت شفعة','15013');
INSERT INTO communes VALUES('c-15-014',15,'Frikat','فريقات','15014');
INSERT INTO communes VALUES('c-15-015',15,'Beni Aissi','بني عيسي','15015');
INSERT INTO communes VALUES('c-15-016',15,'Beni Zmenzer','أيت زمنزر','15016');
INSERT INTO communes VALUES('c-15-017',15,'Iferhounene','إيفرحونن','15017');
INSERT INTO communes VALUES('c-15-018',15,'Azazga','عزازقة','15018');
INSERT INTO communes VALUES('c-15-019',15,'Iloula Oumalou','إيلولة أمالو','15019');
INSERT INTO communes VALUES('c-15-020',15,'Yakouren','اعكورن','15020');
INSERT INTO communes VALUES('c-15-021',15,'Larba Nait Irathen','الأربعاء نايت إيراثن','15021');
INSERT INTO communes VALUES('c-15-022',15,'Tizi Rached','تيزي راشد','15022');
INSERT INTO communes VALUES('c-15-023',15,'Zekri','زكري','15023');
INSERT INTO communes VALUES('c-15-024',15,'Ouaguenoun','واقنون','15024');
INSERT INTO communes VALUES('c-15-025',15,'Ain Zaouia','عين الزاوية','15025');
INSERT INTO communes VALUES('c-15-026',15,'Mkira','مكيرة','15026');
INSERT INTO communes VALUES('c-15-027',15,'Ait Yahia','أيت يحي','15027');
INSERT INTO communes VALUES('c-15-028',15,'Ait Mahmoud','أيت محمود','15028');
INSERT INTO communes VALUES('c-15-029',15,'Maatka','المعاتقة','15029');
INSERT INTO communes VALUES('c-15-030',15,'Ait Boumehdi','آيت بومھدى','15030');
INSERT INTO communes VALUES('c-15-031',15,'Abi Youcef','أبي يوسف','15031');
INSERT INTO communes VALUES('c-15-032',15,'Beni Douala','بني دوالة','15032');
INSERT INTO communes VALUES('c-15-033',15,'Illilten','إليلتن','15033');
INSERT INTO communes VALUES('c-15-034',15,'Bouzguen','بوزقن','15034');
INSERT INTO communes VALUES('c-15-035',15,'Ait Aggouacha','أيت أقواشة','15035');
INSERT INTO communes VALUES('c-15-036',15,'Ouadhia','واضية','15036');
INSERT INTO communes VALUES('c-15-037',15,'Azzefoun','أزفون','15037');
INSERT INTO communes VALUES('c-15-038',15,'Tigzirt','تقزيرت','15038');
INSERT INTO communes VALUES('c-15-039',15,'Ait Aissa Mimoun','آيت عيسى ميمون','15039');
INSERT INTO communes VALUES('c-15-040',15,'Boghni','بوغني','15040');
INSERT INTO communes VALUES('c-15-041',15,'Ifigha','ايفيغاء','15041');
INSERT INTO communes VALUES('c-15-042',15,'Ait Oumalou','آيت أومالو','15042');
INSERT INTO communes VALUES('c-15-043',15,'Tirmitine','ترمتين','15043');
INSERT INTO communes VALUES('c-15-044',15,'Akerrou','أقرو','15044');
INSERT INTO communes VALUES('c-15-045',15,'Yatafen','يطافن','15045');
INSERT INTO communes VALUES('c-15-046',15,'Beni Ziki','بنى زيكى','15046');
INSERT INTO communes VALUES('c-15-047',15,'Draa Ben Khedda','ذراع بن خدة','15047');
INSERT INTO communes VALUES('c-15-048',15,'Ouacif','واسيف','15048');
INSERT INTO communes VALUES('c-15-049',15,'Idjeur','آجر','15049');
INSERT INTO communes VALUES('c-15-050',15,'Mekla','مقلع','15050');
INSERT INTO communes VALUES('c-15-051',15,'Tizi Nthlata','تيزي نثلاثة','15051');
INSERT INTO communes VALUES('c-15-052',15,'Beni Yenni','بني يني','15052');
INSERT INTO communes VALUES('c-15-053',15,'Aghrib','أغريب','15053');
INSERT INTO communes VALUES('c-15-054',15,'Iflissen','إفليسن','15054');
INSERT INTO communes VALUES('c-15-055',15,'Boudjima','بوجيمة','15055');
INSERT INTO communes VALUES('c-15-056',15,'Ait Yahia Moussa','أيت يحي موسى','15056');
INSERT INTO communes VALUES('c-15-057',15,'Souk El Thenine','سوق الإثنين','15057');
INSERT INTO communes VALUES('c-15-058',15,'Ait Khelil','أيت خليلي','15058');
INSERT INTO communes VALUES('c-15-059',15,'Sidi Naamane','سيدي نعمان','15059');
INSERT INTO communes VALUES('c-15-060',15,'Iboudraren','أبودرارن','15060');
INSERT INTO communes VALUES('c-15-061',15,'Agouni Gueghrane','آقنى قغران','15061');
INSERT INTO communes VALUES('c-15-062',15,'Mizrana','مزرانة','15062');
INSERT INTO communes VALUES('c-15-063',15,'Imsouhal','إمسوحال','15063');
INSERT INTO communes VALUES('c-15-064',15,'Tadmait','تادمايت','15064');
INSERT INTO communes VALUES('c-15-065',15,'Ait Bouadou','أيت بوعدو','15065');
INSERT INTO communes VALUES('c-15-066',15,'Assi Youcef','أسي يوسف','15066');
INSERT INTO communes VALUES('c-15-067',15,'Ait Toudert','أيت تودرت','15067');
INSERT INTO communes VALUES('c-16-001',16,'Alger Centre','الجزائر الوسطى','16001');
INSERT INTO communes VALUES('c-16-002',16,'Sidi Mhamed','سيدي امحمد','16002');
INSERT INTO communes VALUES('c-16-003',16,'El Madania','المدنية','16003');
INSERT INTO communes VALUES('c-16-004',16,'Belouizdad','بلوزداد','16004');
INSERT INTO communes VALUES('c-16-005',16,'Bab El Oued','باب الواد','16005');
INSERT INTO communes VALUES('c-16-006',16,'Bologhine','بولوغين','16006');
INSERT INTO communes VALUES('c-16-007',16,'Casbah','القصبة','16007');
INSERT INTO communes VALUES('c-16-008',16,'Oued Koriche','وادي قريش','16008');
INSERT INTO communes VALUES('c-16-009',16,'Bir Mourad Rais','بير مراد رايس','16009');
INSERT INTO communes VALUES('c-16-010',16,'El Biar','الآبيار','16010');
INSERT INTO communes VALUES('c-16-011',16,'Bouzareah','بوزريعة','16011');
INSERT INTO communes VALUES('c-16-012',16,'Birkhadem','بئر خادم','16012');
INSERT INTO communes VALUES('c-16-013',16,'El Harrach','الحراش','16013');
INSERT INTO communes VALUES('c-16-014',16,'Baraki','براقي','16014');
INSERT INTO communes VALUES('c-16-015',16,'Oued Smar','وادي سمار','16015');
INSERT INTO communes VALUES('c-16-016',16,'Bourouba','بوروبة','16016');
INSERT INTO communes VALUES('c-16-017',16,'Hussein Dey','حسين داي','16017');
INSERT INTO communes VALUES('c-16-018',16,'Kouba','القبة','16018');
INSERT INTO communes VALUES('c-16-019',16,'Bachedjerah','باش جراح','16019');
INSERT INTO communes VALUES('c-16-020',16,'Dar El Beida','الدار البيضاء','16020');
INSERT INTO communes VALUES('c-16-021',16,'Bab Azzouar','باب الزوار','16021');
INSERT INTO communes VALUES('c-16-022',16,'Ben Aknoun','بن عكنون','16022');
INSERT INTO communes VALUES('c-16-023',16,'Dely Ibrahim','دالي ابراهيم','16023');
INSERT INTO communes VALUES('c-16-024',16,'El Hammamet','الحمامات','16024');
INSERT INTO communes VALUES('c-16-025',16,'Rais Hamidou','الرايس حميدو','16025');
INSERT INTO communes VALUES('c-16-026',16,'Djasr Kasentina','جسر قسنطينة','16026');
INSERT INTO communes VALUES('c-16-027',16,'El Mouradia','المرادية','16027');
INSERT INTO communes VALUES('c-16-028',16,'Hydra','حيدرة','16028');
INSERT INTO communes VALUES('c-16-029',16,'Mohammadia','المحمدية','16029');
INSERT INTO communes VALUES('c-16-030',16,'Bordj El Kiffan','برج الكيفان','16030');
INSERT INTO communes VALUES('c-16-031',16,'El Magharia','المقرية','16031');
INSERT INTO communes VALUES('c-16-032',16,'Beni Messous','بني مسوس','16032');
INSERT INTO communes VALUES('c-16-033',16,'Les Eucalyptus','الكليتوس','16033');
INSERT INTO communes VALUES('c-16-034',16,'Birtouta','بئر توتة','16034');
INSERT INTO communes VALUES('c-16-035',16,'Tassala El Merdja','تسالة المرجة','16035');
INSERT INTO communes VALUES('c-16-036',16,'Ouled Chebel','أولاد الشبل','16036');
INSERT INTO communes VALUES('c-16-037',16,'Sidi Moussa','سيدي موسى','16037');
INSERT INTO communes VALUES('c-16-038',16,'Ain Taya','عين طاية','16038');
INSERT INTO communes VALUES('c-16-039',16,'Bordj El Bahri','برج البحري','16039');
INSERT INTO communes VALUES('c-16-040',16,'Marsa','المرسى','16040');
INSERT INTO communes VALUES('c-16-041',16,'Haraoua','هراوة','16041');
INSERT INTO communes VALUES('c-16-042',16,'Rouiba','رويبة','16042');
INSERT INTO communes VALUES('c-16-043',16,'Reghaia','الرغاية','16043');
INSERT INTO communes VALUES('c-16-044',16,'Ain Benian','عين بنيان','16044');
INSERT INTO communes VALUES('c-16-045',16,'Staoueli','سطاوالي','16045');
INSERT INTO communes VALUES('c-16-046',16,'Zeralda','زرالدة','16046');
INSERT INTO communes VALUES('c-16-047',16,'Mahelma','محالمة','16047');
INSERT INTO communes VALUES('c-16-048',16,'Rahmania','رحمانية','16048');
INSERT INTO communes VALUES('c-16-049',16,'Souidania','سويدانية','16049');
INSERT INTO communes VALUES('c-16-050',16,'Cheraga','شراقة','16050');
INSERT INTO communes VALUES('c-16-051',16,'Ouled Fayet','أولاد فايت','16051');
INSERT INTO communes VALUES('c-16-052',16,'El Achour','العاشور','16052');
INSERT INTO communes VALUES('c-16-053',16,'Draria','درارية','16053');
INSERT INTO communes VALUES('c-16-054',16,'Douera','دويرة','16054');
INSERT INTO communes VALUES('c-16-055',16,'Baba Hassen','بابا حسن','16055');
INSERT INTO communes VALUES('c-16-056',16,'Khracia','خرايسية','16056');
INSERT INTO communes VALUES('c-16-057',16,'Saoula','السحاولة','16057');
INSERT INTO communes VALUES('c-17-001',17,'Djelfa','الجلفة','17001');
INSERT INTO communes VALUES('c-17-002',17,'Moudjebara','مجبرة','17002');
INSERT INTO communes VALUES('c-17-003',17,'El Guedid','القديد','17003');
INSERT INTO communes VALUES('c-17-004',17,'Hassi Bahbah','حاسي بحبح','17004');
INSERT INTO communes VALUES('c-17-005',17,'Ain Maabed','عين معبد','17005');
INSERT INTO communes VALUES('c-17-006',17,'Sed Rahal','سد رحال','17006');
INSERT INTO communes VALUES('c-17-007',17,'Feidh El Botma','فيض البطمة','17007');
INSERT INTO communes VALUES('c-17-008',17,'Birine','البيرين','17008');
INSERT INTO communes VALUES('c-17-009',17,'Bouira Lahdeb','بويرة الأحداب','17009');
INSERT INTO communes VALUES('c-17-010',17,'Zaccar','زكار','17010');
INSERT INTO communes VALUES('c-17-011',17,'El Khemis','الخميس','17011');
INSERT INTO communes VALUES('c-17-012',17,'Sidi Baizid','سيدي بايزيد','17012');
INSERT INTO communes VALUES('c-17-013',17,'M''Liliha','المليليحة','17013');
INSERT INTO communes VALUES('c-17-014',17,'El Idrissia','الإدريسية','17014');
INSERT INTO communes VALUES('c-17-015',17,'Douis','الدويس','17015');
INSERT INTO communes VALUES('c-17-016',17,'Hassi El Euch','حاسي العش','17016');
INSERT INTO communes VALUES('c-17-017',17,'Messaad','مسعد','17017');
INSERT INTO communes VALUES('c-17-018',17,'Guettara','قتارة','17018');
INSERT INTO communes VALUES('c-17-019',17,'Sidi Ladjel','سيدي لعجال','17019');
INSERT INTO communes VALUES('c-17-020',17,'Had Sahary','حد الصحاري','17020');
INSERT INTO communes VALUES('c-17-021',17,'Guernini','القرنيني','17021');
INSERT INTO communes VALUES('c-17-022',17,'Selmana','سلمانة','17022');
INSERT INTO communes VALUES('c-17-023',17,'Ain Chouhada','عين الشهداء','17023');
INSERT INTO communes VALUES('c-17-024',17,'Oum Laadham','ام العظام','17024');
INSERT INTO communes VALUES('c-17-025',17,'Dar Chouikh','دار الشيوخ','17025');
INSERT INTO communes VALUES('c-17-026',17,'Charef','الشارف','17026');
INSERT INTO communes VALUES('c-17-027',17,'Beni Yacoub','بن يعقوب','17027');
INSERT INTO communes VALUES('c-17-028',17,'Zaafrane','الزعفران','17028');
INSERT INTO communes VALUES('c-17-029',17,'Deldoul','دلدول','17029');
INSERT INTO communes VALUES('c-17-030',17,'Ain El Ibel','عين الابل','17030');
INSERT INTO communes VALUES('c-17-031',17,'Ain Oussera','عين وسارة','17031');
INSERT INTO communes VALUES('c-17-032',17,'Benhar','بنهار','17032');
INSERT INTO communes VALUES('c-17-033',17,'Hassi Fedoul','حاسي فدول','17033');
INSERT INTO communes VALUES('c-17-034',17,'Amourah','عمورة','17034');
INSERT INTO communes VALUES('c-17-035',17,'Ain Fekka','عين افقة','17035');
INSERT INTO communes VALUES('c-17-036',17,'Tadmit','تعضميت','17036');
INSERT INTO communes VALUES('c-18-001',18,'Jijel','جيجل','18001');
INSERT INTO communes VALUES('c-18-002',18,'Erraguene','إراڨن','18002');
INSERT INTO communes VALUES('c-18-003',18,'El Aouana','العوانة','18003');
INSERT INTO communes VALUES('c-18-004',18,'Ziamma Mansouriah','زيامة منصورية','18004');
INSERT INTO communes VALUES('c-18-005',18,'Taher','الطاهير','18005');
INSERT INTO communes VALUES('c-18-006',18,'Emir Abdelkader','الامير عبد القادر','18006');
INSERT INTO communes VALUES('c-18-007',18,'Chekfa','الشقفة','18007');
INSERT INTO communes VALUES('c-18-008',18,'Chahna','الشحنة','18008');
INSERT INTO communes VALUES('c-18-009',18,'El Milia','الميلية','18009');
INSERT INTO communes VALUES('c-18-010',18,'Sidi Maarouf','سيدي معروف','18010');
INSERT INTO communes VALUES('c-18-011',18,'Settara','السطارة','18011');
INSERT INTO communes VALUES('c-18-012',18,'El Ancer','العنصر','18012');
INSERT INTO communes VALUES('c-18-013',18,'Sidi Abdelaziz','سيدي عبد العزيز','18013');
INSERT INTO communes VALUES('c-18-014',18,'Kaous','قاوس','18014');
INSERT INTO communes VALUES('c-18-015',18,'Ghebala','غبالة','18015');
INSERT INTO communes VALUES('c-18-016',18,'Bouraoui Belhadef','بوراوي بلهادف','18016');
INSERT INTO communes VALUES('c-18-017',18,'Djmila','جيملة','18017');
INSERT INTO communes VALUES('c-18-018',18,'Selma Benziada','سلمى بن زيادة','18018');
INSERT INTO communes VALUES('c-18-019',18,'Boussif Ouled Askeur','أولاد عسكر','18019');
INSERT INTO communes VALUES('c-18-020',18,'El Kennar Nouchfi','القنار','18020');
INSERT INTO communes VALUES('c-18-021',18,'Ouled Yahia Khadrouch','اولاد يحيى','18021');
INSERT INTO communes VALUES('c-18-022',18,'Boudria Beni Yadjis','بودريعة بن ياجيس','18022');
INSERT INTO communes VALUES('c-18-023',18,'Kemir Oued Adjoul','بني بلعيد','18023');
INSERT INTO communes VALUES('c-18-024',18,'Texena','تاكسنة','18024');
INSERT INTO communes VALUES('c-18-025',18,'Djemaa Beni Habibi','الجمعة بني حبيبي','18025');
INSERT INTO communes VALUES('c-18-026',18,'Bordj T''her','برج الطهر','18026');
INSERT INTO communes VALUES('c-18-027',18,'Ouled Rabah','ولاد رابح','18027');
INSERT INTO communes VALUES('c-18-028',18,'Ouadjana','وجانة','18028');
INSERT INTO communes VALUES('c-19-001',19,'Setif','سطيف‎','19001');
INSERT INTO communes VALUES('c-19-002',19,'Ain El Kebira','عين الكبيرة','19002');
INSERT INTO communes VALUES('c-19-003',19,'Beni Aziz','بني عزيز','19003');
INSERT INTO communes VALUES('c-19-004',19,'Ouled Sidi Ahmed','أولاد سي أحمد','19004');
INSERT INTO communes VALUES('c-19-005',19,'Boutaleb','بوطالب','19005');
INSERT INTO communes VALUES('c-19-006',19,'Ain Roua','عين الروى','19006');
INSERT INTO communes VALUES('c-19-007',19,'Draa Kebila','ذراع قبيلة','19007');
INSERT INTO communes VALUES('c-19-008',19,'Bir El Arch','بئر العرش','19008');
INSERT INTO communes VALUES('c-19-009',19,'Beni Chebana','بني شبانة','19009');
INSERT INTO communes VALUES('c-19-010',19,'Ouled Tebben','أولاد تبــان','19010');
INSERT INTO communes VALUES('c-19-011',19,'Hamma','حــامة','19011');
INSERT INTO communes VALUES('c-19-012',19,'Maaouia','معـاويـة','19012');
INSERT INTO communes VALUES('c-19-013',19,'Ain Legraj','عين لڨراج','19013');
INSERT INTO communes VALUES('c-19-014',19,'Ain Abessa','عين عباسـة','19014');
INSERT INTO communes VALUES('c-19-015',19,'Dehamcha','الدهامشة','19015');
INSERT INTO communes VALUES('c-19-016',19,'Babor','بابور','19016');
INSERT INTO communes VALUES('c-19-017',19,'Guidjel','قجــال','19017');
INSERT INTO communes VALUES('c-19-018',19,'Ain Lahdjar','عين لحجـر','19018');
INSERT INTO communes VALUES('c-19-019',19,'Bousselam','بوسلام','19019');
INSERT INTO communes VALUES('c-19-020',19,'El Eulma','العلمة','19020');
INSERT INTO communes VALUES('c-19-021',19,'Djemila','جميلـة','19021');
INSERT INTO communes VALUES('c-19-022',19,'Beni Ouartilane','بني ورتيلان','19022');
INSERT INTO communes VALUES('c-19-023',19,'Rosfa','الرصفة','19023');
INSERT INTO communes VALUES('c-19-024',19,'Ouled Addouane','أولاد عدوان','19024');
INSERT INTO communes VALUES('c-19-025',19,'Belaa','البلاعة','19025');
INSERT INTO communes VALUES('c-19-026',19,'Ain Arnat','عين أرنـات','19026');
INSERT INTO communes VALUES('c-19-027',19,'Amoucha','عموشة','19027');
INSERT INTO communes VALUES('c-19-028',19,'Ain Oulmane','عين ولمان','19028');
INSERT INTO communes VALUES('c-19-029',19,'Beidha Bordj','بيضاء برج','19029');
INSERT INTO communes VALUES('c-19-030',19,'Bouandas','بوعنداس','19030');
INSERT INTO communes VALUES('c-19-031',19,'Bazer Sakhra','بازر الصخرة','19031');
INSERT INTO communes VALUES('c-19-032',19,'Hammam Essokhna','حمــام السخنة','19032');
INSERT INTO communes VALUES('c-19-033',19,'Mezloug','مزلوق','19033');
INSERT INTO communes VALUES('c-19-034',19,'Bir Haddada','بئر حدادة','19034');
INSERT INTO communes VALUES('c-19-035',19,'Serdj El Ghoul','سرج الغول','19035');
INSERT INTO communes VALUES('c-19-036',19,'Harbil','حربيل','19036');
INSERT INTO communes VALUES('c-19-037',19,'El Ouricia','الأورسية','19037');
INSERT INTO communes VALUES('c-19-038',19,'Tizi Nbechar','تيزي نبشار','19038');
INSERT INTO communes VALUES('c-19-039',19,'Salah Bey','صـالح باي','19039');
INSERT INTO communes VALUES('c-19-040',19,'Ain Azal','عين أزال','19040');
INSERT INTO communes VALUES('c-19-041',19,'Guenzet','ڨنزات','19041');
INSERT INTO communes VALUES('c-19-042',19,'Talaifacene','تالة إيفاسن','19042');
INSERT INTO communes VALUES('c-19-043',19,'Bougaa','بوقاعـة','19043');
INSERT INTO communes VALUES('c-19-044',19,'Beni Fouda','بني فودة','19044');
INSERT INTO communes VALUES('c-19-045',19,'Tachouda','تاشودة','19045');
INSERT INTO communes VALUES('c-19-046',19,'Beni Mouhli','إيث موحلي','19046');
INSERT INTO communes VALUES('c-19-047',19,'Ouled Sabor','أولاد صـابر','19047');
INSERT INTO communes VALUES('c-19-048',19,'Guellal','قلال','19048');
INSERT INTO communes VALUES('c-19-049',19,'Ain Sebt','عين السبت','19049');
INSERT INTO communes VALUES('c-19-050',19,'Hammam Guergour','حمام قرقور','19050');
INSERT INTO communes VALUES('c-19-051',19,'Ait Naoual Mezada','آيت نوال مزادة','19051');
INSERT INTO communes VALUES('c-19-052',19,'Ksar El Abtal','قصرالأبطال','19052');
INSERT INTO communes VALUES('c-19-053',19,'Beni Hocine','بني حسين','19053');
INSERT INTO communes VALUES('c-19-054',19,'Ait Tizi','آيت تيزي','19054');
INSERT INTO communes VALUES('c-19-055',19,'Maouklane','موكلان','19055');
INSERT INTO communes VALUES('c-19-056',19,'Guelta Zerka','القلتة الزرقاء','19056');
INSERT INTO communes VALUES('c-19-057',19,'Oued El Barad','واد البارد','19057');
INSERT INTO communes VALUES('c-19-058',19,'Taya','طاية','19058');
INSERT INTO communes VALUES('c-19-059',19,'El Ouldja','الولجـة','19059');
INSERT INTO communes VALUES('c-19-060',19,'Tella','التلة','19060');
INSERT INTO communes VALUES('c-20-001',20,'Saida','سعيدة','20001');
INSERT INTO communes VALUES('c-20-002',20,'Doui Thabet','دوى ثابت','20002');
INSERT INTO communes VALUES('c-20-003',20,'Ain El Hadjar','عين الحجر','20003');
INSERT INTO communes VALUES('c-20-004',20,'Ouled Khaled','أولاد خالد','20004');
INSERT INTO communes VALUES('c-20-005',20,'Moulay Larbi','موالي العربي','20005');
INSERT INTO communes VALUES('c-20-006',20,'Youb','يوب','20006');
INSERT INTO communes VALUES('c-20-007',20,'Hounet','هونت','20007');
INSERT INTO communes VALUES('c-20-008',20,'Sidi Amar','يدي عمر','20008');
INSERT INTO communes VALUES('c-20-009',20,'Sidi Boubekeur','سيدي بوبكر','20009');
INSERT INTO communes VALUES('c-20-010',20,'El Hassasna','حساسنة','20010');
INSERT INTO communes VALUES('c-20-011',20,'Maamora','معمورة','20011');
INSERT INTO communes VALUES('c-20-012',20,'Sidi Ahmed','سيدي أحمد','20012');
INSERT INTO communes VALUES('c-20-013',20,'Ain Sekhouna','العين السخونة','20013');
INSERT INTO communes VALUES('c-20-014',20,'Ouled Brahim','أولاد ابراھيم','20014');
INSERT INTO communes VALUES('c-20-015',20,'Tircine','تيرسين','20015');
INSERT INTO communes VALUES('c-20-016',20,'Ain Soltane','عين السلطان','20016');
INSERT INTO communes VALUES('c-21-001',21,'Skikda','سكيكدة','21001');
INSERT INTO communes VALUES('c-21-002',21,'Ain Zouit','عين زويت','21002');
INSERT INTO communes VALUES('c-21-003',21,'El Hadaik','الحدايق','21003');
INSERT INTO communes VALUES('c-21-004',21,'Azzaba','عزابة','21004');
INSERT INTO communes VALUES('c-21-005',21,'Djendel','جندل','21005');
INSERT INTO communes VALUES('c-21-006',21,'Ain Cherchar','عين شرشار','21006');
INSERT INTO communes VALUES('c-21-007',21,'Bekkouche Lakhdar','بكوش لخضر','21007');
INSERT INTO communes VALUES('c-21-008',21,'Ben Azzouz','بن عزوز','21008');
INSERT INTO communes VALUES('c-21-009',21,'Es Sebt','السبت','21009');
INSERT INTO communes VALUES('c-21-010',21,'Collo','القل','21010');
INSERT INTO communes VALUES('c-21-011',21,'Beni Zid','بنى زيد','21011');
INSERT INTO communes VALUES('c-21-012',21,'Kerkera','كركرة','21012');
INSERT INTO communes VALUES('c-21-013',21,'Ouled Attia','أولاد عطية','21013');
INSERT INTO communes VALUES('c-21-014',21,'Oued Zehour','وادي الزهور','21014');
INSERT INTO communes VALUES('c-21-015',21,'Zitouna','الزيتونة','21015');
INSERT INTO communes VALUES('c-21-016',21,'El Harrouch','الحروش','21016');
INSERT INTO communes VALUES('c-21-017',21,'Zerdazas','زردازة','21017');
INSERT INTO communes VALUES('c-21-018',21,'Ouled Hebaba','أولاد حبابة','21018');
INSERT INTO communes VALUES('c-21-019',21,'Sidi Mezghiche','سيدي مزغيش','21019');
INSERT INTO communes VALUES('c-21-020',21,'Emdjez Edchich','مجاز الدشيش','21020');
INSERT INTO communes VALUES('c-21-021',21,'Beni Oulbane','بني والبان','21021');
INSERT INTO communes VALUES('c-21-022',21,'Ain Bouziane','عين بوزيان','21022');
INSERT INTO communes VALUES('c-21-023',21,'Ramdane Djamel','رمضان جمال','21023');
INSERT INTO communes VALUES('c-21-024',21,'Beni Bachir','بني بشير','21024');
INSERT INTO communes VALUES('c-21-025',21,'Salah Bouchaour','صالح بوالشعور','21025');
INSERT INTO communes VALUES('c-21-026',21,'Tamalous','تمالوس','21026');
INSERT INTO communes VALUES('c-21-027',21,'Ain Kechra','عين قشرة','21027');
INSERT INTO communes VALUES('c-21-028',21,'Oum Toub','أم الطوب','21028');
INSERT INTO communes VALUES('c-21-029',21,'Bein El Ouiden','بين الويدان','21029');
INSERT INTO communes VALUES('c-21-030',21,'Filfila','فلفلة','21030');
INSERT INTO communes VALUES('c-21-031',21,'Cheraia','الشرايع','21031');
INSERT INTO communes VALUES('c-21-032',21,'Kanoua','قنواع','21032');
INSERT INTO communes VALUES('c-21-033',21,'El Ghedir','الغدير','21033');
INSERT INTO communes VALUES('c-21-034',21,'Bouchtata','بوشطاطة','21034');
INSERT INTO communes VALUES('c-21-035',21,'Ouldja Boulbalout','الولجة بو البلوط','21035');
INSERT INTO communes VALUES('c-21-036',21,'Kheneg Mayoum','خنق مايوم','21036');
INSERT INTO communes VALUES('c-21-037',21,'Hamadi Krouma','حمادي كرومة','21037');
INSERT INTO communes VALUES('c-21-038',21,'El Marsa','المرسى','21038');
INSERT INTO communes VALUES('c-22-001',22,'Sidi Bel Abbes','سيدي بلعباس','22001');
INSERT INTO communes VALUES('c-22-002',22,'Tessala','تسالة','22002');
INSERT INTO communes VALUES('c-22-003',22,'Sidi Brahim','سيدي ابراهيم','22003');
INSERT INTO communes VALUES('c-22-004',22,'Mostefa Ben Brahim','مصطفى بن ابراهيم','22004');
INSERT INTO communes VALUES('c-22-005',22,'Telagh','تلاغ','22005');
INSERT INTO communes VALUES('c-22-006',22,'Mezaourou','مزاورو','22006');
INSERT INTO communes VALUES('c-22-007',22,'Boukhanafis','بوخنفيس','22007');
INSERT INTO communes VALUES('c-22-008',22,'Sidi Ali Boussidi','سيدي علي بوسيدي','22008');
INSERT INTO communes VALUES('c-22-009',22,'Badredine El Mokrani','بدر الدين المقراني','22009');
INSERT INTO communes VALUES('c-22-010',22,'Marhoum','مرحوم','22010');
INSERT INTO communes VALUES('c-22-011',22,'Tafissour','تفسور','22011');
INSERT INTO communes VALUES('c-22-012',22,'Amarnas','العمارنة','22012');
INSERT INTO communes VALUES('c-22-013',22,'Tilmouni','تلموني','22013');
INSERT INTO communes VALUES('c-22-014',22,'Sidi Lahcene','سيدي لحسن','22014');
INSERT INTO communes VALUES('c-22-015',22,'Ain Thrid','عين التريد','22015');
INSERT INTO communes VALUES('c-22-016',22,'Makedra','مكدرة','22016');
INSERT INTO communes VALUES('c-22-017',22,'Tenira','تنيرة','22017');
INSERT INTO communes VALUES('c-22-018',22,'Moulay Slissen','مولاي سليسن','22018');
INSERT INTO communes VALUES('c-22-019',22,'El Hacaiba','الحصيبة','22019');
INSERT INTO communes VALUES('c-22-020',22,'Hassi Zehana','حاسي زهانة','22020');
INSERT INTO communes VALUES('c-22-021',22,'Tabia','طابية','22021');
INSERT INTO communes VALUES('c-22-022',22,'Merine','مرين','22022');
INSERT INTO communes VALUES('c-22-023',22,'Ras El Ma','رأس الماء','22023');
INSERT INTO communes VALUES('c-22-024',22,'Ain Tindamine','عين تندامين','22024');
INSERT INTO communes VALUES('c-22-025',22,'Ain Kada','عين قادة','22025');
INSERT INTO communes VALUES('c-22-026',22,'Mcid','مسيد','22026');
INSERT INTO communes VALUES('c-22-027',22,'Sidi Khaled','سيدي خالد','22027');
INSERT INTO communes VALUES('c-22-028',22,'Ain El Berd','عين البرد','22028');
INSERT INTO communes VALUES('c-22-029',22,'Sfissef','سفيزف','22029');
INSERT INTO communes VALUES('c-22-030',22,'Ain Adden','عين عدان','22030');
INSERT INTO communes VALUES('c-22-031',22,'Oued Taourira','واد تاوريرة','22031');
INSERT INTO communes VALUES('c-22-032',22,'Dhaya','الظاية','22032');
INSERT INTO communes VALUES('c-22-033',22,'Zerouala','زروالة','22033');
INSERT INTO communes VALUES('c-22-034',22,'Lamtar','لمطار','22034');
INSERT INTO communes VALUES('c-22-035',22,'Sidi Chaib','سيدي شعيب','22035');
INSERT INTO communes VALUES('c-22-036',22,'Sidi Dahou','سيدي دحو','22036');
INSERT INTO communes VALUES('c-22-037',22,'Oued Sbaa','واد السبع','22037');
INSERT INTO communes VALUES('c-22-038',22,'Boudjebaa El Bordj','بوجبهة البرج','22038');
INSERT INTO communes VALUES('c-22-039',22,'Sehala Thaoura','سهالة الثورة','22039');
INSERT INTO communes VALUES('c-22-040',22,'Sidi Yacoub','سيدي يعقوب','22040');
INSERT INTO communes VALUES('c-22-041',22,'Sidi Hamadouche','سيدي حمادوش','22041');
INSERT INTO communes VALUES('c-22-042',22,'Belarbi','بلعربي','22042');
INSERT INTO communes VALUES('c-22-043',22,'Oued Sefioun','واد سفيون','22043');
INSERT INTO communes VALUES('c-22-044',22,'Teghalimet','تغاليمت','22044');
INSERT INTO communes VALUES('c-22-045',22,'Ben Badis','ابن باديس','22045');
INSERT INTO communes VALUES('c-22-046',22,'Sidi Ali Benyoub','سيدي علي بن يوب','22046');
INSERT INTO communes VALUES('c-22-047',22,'Chetouane Belaila','شطوان بلايلة','22047');
INSERT INTO communes VALUES('c-22-048',22,'Bir El Hammam','بئر الحمام','22048');
INSERT INTO communes VALUES('c-22-049',22,'Taoudmout','تاودموت','22049');
INSERT INTO communes VALUES('c-22-050',22,'Redjem Demouche','رجم دموش','22050');
INSERT INTO communes VALUES('c-22-051',22,'Benachiba Chelia','بن عشيبة شلية','22051');
INSERT INTO communes VALUES('c-22-052',22,'Hassi Dahou','حاسي دحو','22052');
INSERT INTO communes VALUES('c-23-001',23,'Annaba','عنابة','23001');
INSERT INTO communes VALUES('c-23-002',23,'Berrahel','برحال','23002');
INSERT INTO communes VALUES('c-23-003',23,'El Hadjar','الحجار','23003');
INSERT INTO communes VALUES('c-23-004',23,'Eulma','العلمة','23004');
INSERT INTO communes VALUES('c-23-005',23,'El Bouni','البوني','23005');
INSERT INTO communes VALUES('c-23-006',23,'Oued El Aneb','وادي العنب','23006');
INSERT INTO communes VALUES('c-23-007',23,'Cheurfa','الشرفة','23007');
INSERT INTO communes VALUES('c-23-008',23,'Seraidi','سرايدي','23008');
INSERT INTO communes VALUES('c-23-009',23,'Ain Berda','عين الباردة','23009');
INSERT INTO communes VALUES('c-23-010',23,'Chetaibi','شطايبي','23010');
INSERT INTO communes VALUES('c-23-011',23,'Sidi Amer','سيدي عمار','23011');
INSERT INTO communes VALUES('c-23-012',23,'Treat','التريعات','23012');
INSERT INTO communes VALUES('c-24-001',24,'Guelma','قالمة','24001');
INSERT INTO communes VALUES('c-24-002',24,'Nechmaya','نشماية','24002');
INSERT INTO communes VALUES('c-24-003',24,'Bouati Mahmoud','بوعاتي محمود','24003');
INSERT INTO communes VALUES('c-24-004',24,'Oued Zenati','وادي الزناتي','24004');
INSERT INTO communes VALUES('c-24-005',24,'Tamlouka','تاملوكة','24005');
INSERT INTO communes VALUES('c-24-006',24,'Oued Fragha','وادي فراغة','24006');
INSERT INTO communes VALUES('c-24-007',24,'Ain Sandel','عين صندل','24007');
INSERT INTO communes VALUES('c-24-008',24,'Ras El Agba','راس العقبة','24008');
INSERT INTO communes VALUES('c-24-009',24,'Dahouara','الدهوارة','24009');
INSERT INTO communes VALUES('c-24-010',24,'Belkhir','بلخير','24010');
INSERT INTO communes VALUES('c-24-011',24,'Ben Djarah','بن جراح','24011');
INSERT INTO communes VALUES('c-24-012',24,'Bou Hamdane','بوحمدان','24012');
INSERT INTO communes VALUES('c-24-013',24,'Ain Makhlouf','عين مخلوف','24013');
INSERT INTO communes VALUES('c-24-014',24,'Ain Ben Beida','عين بن بيضاء','24014');
INSERT INTO communes VALUES('c-24-015',24,'Khezara','خزارة','24015');
INSERT INTO communes VALUES('c-24-016',24,'Beni Mezline','بني مزلين','24016');
INSERT INTO communes VALUES('c-24-017',24,'Bou Hachana','بوحشانة','24017');
INSERT INTO communes VALUES('c-24-018',24,'Guelaat Bou Sbaa','قلعة بوصبع','24018');
INSERT INTO communes VALUES('c-24-019',24,'Hammam Maskhoutine','حمام مسخوطين','24019');
INSERT INTO communes VALUES('c-24-020',24,'El Fedjoudj','الفجوج','24020');
INSERT INTO communes VALUES('c-24-021',24,'Bordj Sabat','برج صباط','24021');
INSERT INTO communes VALUES('c-24-022',24,'Hamman Nbail','حمام النبايل','24022');
INSERT INTO communes VALUES('c-24-023',24,'Ain Larbi','عين العربى','24023');
INSERT INTO communes VALUES('c-24-024',24,'Medjez Amar','مجاز عمار','24024');
INSERT INTO communes VALUES('c-24-025',24,'Bouchegouf','بوشقوف','24025');
INSERT INTO communes VALUES('c-24-026',24,'Heliopolis','ھيليوبوليس','24026');
INSERT INTO communes VALUES('c-24-027',24,'Houari Boumediene','هواري بومدين','24027');
INSERT INTO communes VALUES('c-24-028',24,'Roknia','الركنية','24028');
INSERT INTO communes VALUES('c-24-029',24,'Salaoua Announa','سلاوة عنونة','24029');
INSERT INTO communes VALUES('c-24-030',24,'Medjez Sfa','مجاز الصفاء','24030');
INSERT INTO communes VALUES('c-24-031',24,'Boumahra Ahmed','بومهرة أحمد','24031');
INSERT INTO communes VALUES('c-24-032',24,'Ain Reggada','عين رقادة','24032');
INSERT INTO communes VALUES('c-24-033',24,'Oued Cheham','وادي الشحم','24033');
INSERT INTO communes VALUES('c-24-034',24,'Djeballah Khemissi','جبالة لخميسي','24034');
INSERT INTO communes VALUES('c-25-001',25,'Constantine','قسنطينة','25001');
INSERT INTO communes VALUES('c-25-002',25,'Hamma Bouziane','حامة بوزيان','25002');
INSERT INTO communes VALUES('c-25-003',25,'Ibn Badis','إبن باديس','25003');
INSERT INTO communes VALUES('c-25-004',25,'Zighoud Youcef','زيغود يوسف','25004');
INSERT INTO communes VALUES('c-25-005',25,'Didouche Mourad','ديدوش مراد','25005');
INSERT INTO communes VALUES('c-25-006',25,'El Khroub','الخروب','25006');
INSERT INTO communes VALUES('c-25-007',25,'Ain Abid','عين عبيد','25007');
INSERT INTO communes VALUES('c-25-008',25,'Beni Hamiden','بني حميدان','25008');
INSERT INTO communes VALUES('c-25-009',25,'Ouled Rahmoune','أولاد رحمون','25009');
INSERT INTO communes VALUES('c-25-010',25,'Ain Smara','عين سمارة','25010');
INSERT INTO communes VALUES('c-25-011',25,'Mesaoud Boudjeriou','مسعود بوجريو','25011');
INSERT INTO communes VALUES('c-25-012',25,'Ibn Ziad','ابن زياد','25012');
INSERT INTO communes VALUES('c-26-001',26,'Medea','المدية','26001');
INSERT INTO communes VALUES('c-26-002',26,'Ouzera','وزرة','26002');
INSERT INTO communes VALUES('c-26-003',26,'Ouled Maaref','أولاد معرف','26003');
INSERT INTO communes VALUES('c-26-004',26,'Ain Boucif','عين بوسيف','26004');
INSERT INTO communes VALUES('c-26-005',26,'Aissaouia','العيساوية','26005');
INSERT INTO communes VALUES('c-26-006',26,'Ouled Deide','أولاد دايد','26006');
INSERT INTO communes VALUES('c-26-007',26,'El Omaria','العمارية','26007');
INSERT INTO communes VALUES('c-26-008',26,'Derrag','دراڨ','26008');
INSERT INTO communes VALUES('c-26-009',26,'El Guelbelkebir','القلب الكبير','26009');
INSERT INTO communes VALUES('c-26-010',26,'Bouaiche','بوعيش','26010');
INSERT INTO communes VALUES('c-26-011',26,'Mezerena','مزغنة','26011');
INSERT INTO communes VALUES('c-26-012',26,'Ouled Brahim','أولاد إبراهيم','26012');
INSERT INTO communes VALUES('c-26-013',26,'Tizi Mahdi','تيزي المهدي','26013');
INSERT INTO communes VALUES('c-26-014',26,'Sidi Ziane','سيدي زيان','26014');
INSERT INTO communes VALUES('c-26-015',26,'Tamesguida','تمزڨيدة','26015');
INSERT INTO communes VALUES('c-26-016',26,'El Hamdania','الحمدانية','26016');
INSERT INTO communes VALUES('c-26-017',26,'Kef Lakhdar','الكاف الأخضر','26017');
INSERT INTO communes VALUES('c-26-018',26,'Chelalet El Adhaoura','شلالة العذاورة','26018');
INSERT INTO communes VALUES('c-26-019',26,'Bouskene','بوسكن','26019');
INSERT INTO communes VALUES('c-26-020',26,'Rebaia','الربعية','26020');
INSERT INTO communes VALUES('c-26-021',26,'Bouchrahil','بوشراحيل','26021');
INSERT INTO communes VALUES('c-26-022',26,'Ouled Hellal','أولاد هلال','26022');
INSERT INTO communes VALUES('c-26-023',26,'Tafraout','تافراوت','26023');
INSERT INTO communes VALUES('c-26-024',26,'Baata','بعطة','26024');
INSERT INTO communes VALUES('c-26-025',26,'Boghar','بوغار','26025');
INSERT INTO communes VALUES('c-26-026',26,'Sidi Naamane','سيدي نعمان','26026');
INSERT INTO communes VALUES('c-26-027',26,'Ouled Bouachra','أولاد بوعشرة','26027');
INSERT INTO communes VALUES('c-26-028',26,'Sidi Zahar','سيدي زهار','26028');
INSERT INTO communes VALUES('c-26-029',26,'Oued Harbil','وادي حربيل','26029');
INSERT INTO communes VALUES('c-26-030',26,'Benchicao','بن شكاو','26030');
INSERT INTO communes VALUES('c-26-031',26,'Sidi Damed','سيدي دامد','26031');
INSERT INTO communes VALUES('c-26-032',26,'Aziz','عزيز','26032');
INSERT INTO communes VALUES('c-26-033',26,'Souagui','السواڨي','26033');
INSERT INTO communes VALUES('c-26-034',26,'Zoubiria','الزبيرية','26034');
INSERT INTO communes VALUES('c-26-035',26,'Ksar El Boukhari','قصر البخاري','26035');
INSERT INTO communes VALUES('c-26-036',26,'El Azizia','العزيزية','26036');
INSERT INTO communes VALUES('c-26-037',26,'Djouab','جواب','26037');
INSERT INTO communes VALUES('c-26-038',26,'Chahbounia','الشهبونية','26038');
INSERT INTO communes VALUES('c-26-039',26,'Meghraoua','مغراوة','26039');
INSERT INTO communes VALUES('c-26-040',26,'Cheniguel','شنيڨل','26040');
INSERT INTO communes VALUES('c-26-041',26,'Ain Ouksir','عين القصير','26041');
INSERT INTO communes VALUES('c-26-042',26,'Oum El Djalil','أم الجليل','26042');
INSERT INTO communes VALUES('c-26-043',26,'Ouamri','عوامري','26043');
INSERT INTO communes VALUES('c-26-044',26,'Si Mahdjoub','سى المحجوب','26044');
INSERT INTO communes VALUES('c-26-045',26,'Tlatet Eddouair','ثلاثة الدوائر','26045');
INSERT INTO communes VALUES('c-26-046',26,'Beni Slimane','بني سليمان','26046');
INSERT INTO communes VALUES('c-26-047',26,'Berrouaghia','البرواڨية','26047');
INSERT INTO communes VALUES('c-26-048',26,'Seghouane','سغوان','26048');
INSERT INTO communes VALUES('c-26-049',26,'Meftaha','المفاتحة','26049');
INSERT INTO communes VALUES('c-26-050',26,'Mihoub','ميهوب','26050');
INSERT INTO communes VALUES('c-26-051',26,'Boughezoul','بوغزول','26051');
INSERT INTO communes VALUES('c-26-052',26,'Tablat','تابلاط','26052');
INSERT INTO communes VALUES('c-26-053',26,'Deux Bassins','فج الحوضين','26053');
INSERT INTO communes VALUES('c-26-054',26,'Draa Essamar','ذراع السمار','26054');
INSERT INTO communes VALUES('c-26-055',26,'Sidi Errabia','سيدي الربيع','26055');
INSERT INTO communes VALUES('c-26-056',26,'Bir Ben Laabed','بئر بن العابد','26056');
INSERT INTO communes VALUES('c-26-057',26,'El Ouinet','العوينات','26057');
INSERT INTO communes VALUES('c-26-058',26,'Ouled Antar','أولاد عنتر','26058');
INSERT INTO communes VALUES('c-26-059',26,'Bouaichoune','بوعيشون','26059');
INSERT INTO communes VALUES('c-26-060',26,'Hannacha','حناشة','26060');
INSERT INTO communes VALUES('c-26-061',26,'Sedraia','سدراية','26061');
INSERT INTO communes VALUES('c-26-062',26,'Medjebar','مجبر','26062');
INSERT INTO communes VALUES('c-26-063',26,'Khams Djouamaa','خمس جوامع','26063');
INSERT INTO communes VALUES('c-26-064',26,'Saneg','سانڨ','26064');
INSERT INTO communes VALUES('c-27-001',27,'Mostaganem','مستغانم','27001');
INSERT INTO communes VALUES('c-27-002',27,'Sayada','صيادة','27002');
INSERT INTO communes VALUES('c-27-003',27,'Fornaka','فرناكة','27003');
INSERT INTO communes VALUES('c-27-004',27,'Stidia','ستيدية','27004');
INSERT INTO communes VALUES('c-27-005',27,'Ain Nouissy','عين نويسي','27005');
INSERT INTO communes VALUES('c-27-006',27,'Hassi Maameche','حاسي مماش','27006');
INSERT INTO communes VALUES('c-27-007',27,'Ain Tadles','عين تادلس','27007');
INSERT INTO communes VALUES('c-27-008',27,'Sour','صور','27008');
INSERT INTO communes VALUES('c-27-009',27,'Oued El Kheir','واد الخير','27009');
INSERT INTO communes VALUES('c-27-010',27,'Sidi Bellater','سيدي بلعاتر','27010');
INSERT INTO communes VALUES('c-27-011',27,'Kheiredine','خير الدين','27011');
INSERT INTO communes VALUES('c-27-012',27,'Sidi Ali','سيدي علي','27012');
INSERT INTO communes VALUES('c-27-013',27,'Abdelmalek Ramdane','عبد المالك رمضان','27013');
INSERT INTO communes VALUES('c-27-014',27,'Hadjadj','حجاج','27014');
INSERT INTO communes VALUES('c-27-015',27,'Nekmaria','نقمارية','27015');
INSERT INTO communes VALUES('c-27-016',27,'Sidi Lakhdar','سيدي لخضر','27016');
INSERT INTO communes VALUES('c-27-017',27,'Achaacha','عشعاشة','27017');
INSERT INTO communes VALUES('c-27-018',27,'Khadra','خضراء','27018');
INSERT INTO communes VALUES('c-27-019',27,'Bouguirat','بوقيراط','27019');
INSERT INTO communes VALUES('c-27-020',27,'Sirat','سيرات','27020');
INSERT INTO communes VALUES('c-27-021',27,'Ain Sidi Cherif','عين سيدي شريف','27021');
INSERT INTO communes VALUES('c-27-022',27,'Mesra','ماسرة','27022');
INSERT INTO communes VALUES('c-27-023',27,'Mansourah','منصورة','27023');
INSERT INTO communes VALUES('c-27-024',27,'Souaflia','سوافلية','27024');
INSERT INTO communes VALUES('c-27-025',27,'Ouled Boughalem','أوالد بوغالم','27025');
INSERT INTO communes VALUES('c-27-026',27,'Ouled Maallah','أولاد مع اللّه','27026');
INSERT INTO communes VALUES('c-27-027',27,'Mezghrane','مزغران','27027');
INSERT INTO communes VALUES('c-27-028',27,'Ain Boudinar','عين بودينار','27028');
INSERT INTO communes VALUES('c-27-029',27,'Tazgait','تزقايت','27029');
INSERT INTO communes VALUES('c-27-030',27,'Safsaf','صفصاف','27030');
INSERT INTO communes VALUES('c-27-031',27,'Touahria','طواھيرية','27031');
INSERT INTO communes VALUES('c-27-032',27,'El Hassiane','الحسيان','27032');
INSERT INTO communes VALUES('c-28-001',28,'Msila','المسيلة','28001');
INSERT INTO communes VALUES('c-28-002',28,'Maadid','المعاضيد','28002');
INSERT INTO communes VALUES('c-28-003',28,'Hammam Dhalaa','حمـام الضلعة','28003');
INSERT INTO communes VALUES('c-28-004',28,'Ouled Derradj','أولاد دراج','28004');
INSERT INTO communes VALUES('c-28-005',28,'Tarmount','تارمونت','28005');
INSERT INTO communes VALUES('c-28-006',28,'Mtarfa','مطارفة','28006');
INSERT INTO communes VALUES('c-28-007',28,'Khoubana','خبانة','28007');
INSERT INTO communes VALUES('c-28-008',28,'M''cif','مسيف','28008');
INSERT INTO communes VALUES('c-28-009',28,'Chellal','شلال','28009');
INSERT INTO communes VALUES('c-28-010',28,'Ouled Madhi','أولاد مـاضي','28010');
INSERT INTO communes VALUES('c-28-011',28,'Magra','مقرة','28011');
INSERT INTO communes VALUES('c-28-012',28,'Berhoum','برهوم','28012');
INSERT INTO communes VALUES('c-28-013',28,'Ain Khadra','عين الخضراء','28013');
INSERT INTO communes VALUES('c-28-014',28,'Ouled Addi Guebala','اولاد عدي لقبالة','28014');
INSERT INTO communes VALUES('c-28-015',28,'Belaiba','بلعايبة','28015');
INSERT INTO communes VALUES('c-28-016',28,'Sidi Aissa','سيدي عيسى','28016');
INSERT INTO communes VALUES('c-28-017',28,'Ain El Hadjel','عين الحجل','28017');
INSERT INTO communes VALUES('c-28-018',28,'Sidi Hadjeres','سيدي ھجرس','28018');
INSERT INTO communes VALUES('c-28-019',28,'Ouanougha','ونوغة','28019');
INSERT INTO communes VALUES('c-28-020',28,'Bou Saada','بوسعادة','28020');
INSERT INTO communes VALUES('c-28-021',28,'Ouled Sidi Brahim','أولاد سيدي ابراهيم','28021');
INSERT INTO communes VALUES('c-28-022',28,'Sidi Ameur','سيدي عامر','28022');
INSERT INTO communes VALUES('c-28-023',28,'Tamsa','تامسة','28023');
INSERT INTO communes VALUES('c-28-024',28,'Ben Srour','بن سرور','28024');
INSERT INTO communes VALUES('c-28-025',28,'Ouled Slimane','أولاد سليمان','28025');
INSERT INTO communes VALUES('c-28-026',28,'El Houamed','الحوامد','28026');
INSERT INTO communes VALUES('c-28-027',28,'El Hamel','الهامل','28027');
INSERT INTO communes VALUES('c-28-028',28,'Ouled Mansour','أولاد منصور','28028');
INSERT INTO communes VALUES('c-28-029',28,'Maarif','المعاريف','28029');
INSERT INTO communes VALUES('c-28-030',28,'Dehahna','الدهاهنة','28030');
INSERT INTO communes VALUES('c-28-031',28,'Bouti Sayah','بوطي السايح','28031');
INSERT INTO communes VALUES('c-28-032',28,'Khettouti Sed Djir','خطوطي سد الجير','28032');
INSERT INTO communes VALUES('c-28-033',28,'Zarzour','الزرزور','28033');
INSERT INTO communes VALUES('c-28-034',28,'Oued Chair','محمد بوضياف','28034');
INSERT INTO communes VALUES('c-28-035',28,'Benzouh','بن الزوه','28035');
INSERT INTO communes VALUES('c-28-036',28,'Bir Foda','بير الفضة','28036');
INSERT INTO communes VALUES('c-28-037',28,'Ain Fares','عين فارس','28037');
INSERT INTO communes VALUES('c-28-038',28,'Sidi Mhamed','سيدي محمد','28038');
INSERT INTO communes VALUES('c-28-039',28,'Ouled Atia','منعة','28039');
INSERT INTO communes VALUES('c-28-040',28,'Souamaa','الصوامع','28040');
INSERT INTO communes VALUES('c-28-041',28,'Ain El Melh','عين الملح','28041');
INSERT INTO communes VALUES('c-28-042',28,'Medjedel','مجدل','28042');
INSERT INTO communes VALUES('c-28-043',28,'Slim','سليم','28043');
INSERT INTO communes VALUES('c-28-044',28,'Ain Errich','عين الريش','28044');
INSERT INTO communes VALUES('c-28-045',28,'Beni Ilmane','بنى يلمان','28045');
INSERT INTO communes VALUES('c-28-046',28,'Oultene','ولتام','28046');
INSERT INTO communes VALUES('c-28-047',28,'Djebel Messaad','جبل مساعد','28047');
INSERT INTO communes VALUES('c-29-001',29,'Mascara','مـعـسـكـر','29001');
INSERT INTO communes VALUES('c-29-002',29,'Bou Hanifia','بوحنيفية','29002');
INSERT INTO communes VALUES('c-29-003',29,'Tizi','تيزي','29003');
INSERT INTO communes VALUES('c-29-004',29,'Hacine','حسين','29004');
INSERT INTO communes VALUES('c-29-005',29,'Maoussa','ماوسة','29005');
INSERT INTO communes VALUES('c-29-006',29,'Teghennif','تيغنيف','29006');
INSERT INTO communes VALUES('c-29-007',29,'El Hachem','الهاشم','29007');
INSERT INTO communes VALUES('c-29-008',29,'Sidi Kada','سيدي قادة','29008');
INSERT INTO communes VALUES('c-29-009',29,'Zelmata','زلماطة','29009');
INSERT INTO communes VALUES('c-29-010',29,'Oued El Abtal','واد الأبطال','29010');
INSERT INTO communes VALUES('c-29-011',29,'Ain Ferah','عين فراح','29011');
INSERT INTO communes VALUES('c-29-012',29,'Ghriss','غريس','29012');
INSERT INTO communes VALUES('c-29-013',29,'Froha','فروحة','29013');
INSERT INTO communes VALUES('c-29-014',29,'Matemore','مطمور','29014');
INSERT INTO communes VALUES('c-29-015',29,'Makdha','ماقضة','29015');
INSERT INTO communes VALUES('c-29-016',29,'Sidi Boussaid','سيدي بوسعيد','29016');
INSERT INTO communes VALUES('c-29-017',29,'El Bordj','البرج','29017');
INSERT INTO communes VALUES('c-29-018',29,'Ain Fekan','عين فكان','29018');
INSERT INTO communes VALUES('c-29-019',29,'Benian','بنيان','29019');
INSERT INTO communes VALUES('c-29-020',29,'Khalouia','خلوية','29020');
INSERT INTO communes VALUES('c-29-021',29,'El Menaouer','المناور','29021');
INSERT INTO communes VALUES('c-29-022',29,'Oued Taria','واد التاغية','29022');
INSERT INTO communes VALUES('c-29-023',29,'Aouf','عوف','29023');
INSERT INTO communes VALUES('c-29-024',29,'Ain Fares','عين فارس','29024');
INSERT INTO communes VALUES('c-29-025',29,'Ain Frass','عين فراس','29025');
INSERT INTO communes VALUES('c-29-026',29,'Sig','سيڨ','29026');
INSERT INTO communes VALUES('c-29-027',29,'Oggaz','عقاز','29027');
INSERT INTO communes VALUES('c-29-028',29,'Alaimia','العلايمية','29028');
INSERT INTO communes VALUES('c-29-029',29,'El Gaada','القعدة','29029');
INSERT INTO communes VALUES('c-29-030',29,'Zahana','زھانة','29030');
INSERT INTO communes VALUES('c-29-031',29,'Mohammadia','المحمدية','29031');
INSERT INTO communes VALUES('c-29-032',29,'Sidi Abdelmoumene','سيدي عبد المومن','29032');
INSERT INTO communes VALUES('c-29-033',29,'Ferraguig','فرقيق','29033');
INSERT INTO communes VALUES('c-29-034',29,'El Ghomri','الغمري','29034');
INSERT INTO communes VALUES('c-29-035',29,'Sedjerara','سجرارة','29035');
INSERT INTO communes VALUES('c-29-036',29,'Moctadouz','مقطع الدوز','29036');
INSERT INTO communes VALUES('c-29-037',29,'Bou Henni','بوهني','29037');
INSERT INTO communes VALUES('c-29-038',29,'Guettena','القيطنة','29038');
INSERT INTO communes VALUES('c-29-039',29,'El Mamounia','المامونية','29039');
INSERT INTO communes VALUES('c-29-040',29,'El Keurt','الكرط','29040');
INSERT INTO communes VALUES('c-29-041',29,'Gharrous','غروس','29041');
INSERT INTO communes VALUES('c-29-042',29,'Gherdjoum','ڤرجوم','29042');
INSERT INTO communes VALUES('c-29-043',29,'Chorfa','الشرفة','29043');
INSERT INTO communes VALUES('c-29-044',29,'Ras Ain Amirouche','رأس العين عميروش','29044');
INSERT INTO communes VALUES('c-29-045',29,'Nesmot','نسموط','29045');
INSERT INTO communes VALUES('c-29-046',29,'Sidi Abdeldjebar','سيدي عبد الجبار','29046');
INSERT INTO communes VALUES('c-29-047',29,'Sehailia','سحايلية','29047');
INSERT INTO communes VALUES('c-30-001',30,'Ouargla','ورڨلة','30001');
INSERT INTO communes VALUES('c-30-002',30,'Ain Beida','عين البيضاء','30002');
INSERT INTO communes VALUES('c-30-003',30,'Ngoussa','نقوسة','30003');
INSERT INTO communes VALUES('c-30-004',30,'Hassi Messaoud','حاسي مسعود','30004');
INSERT INTO communes VALUES('c-30-005',30,'Rouissat','الرويسات','30005');
INSERT INTO communes VALUES('c-30-006',30,'Balidat Ameur','بليدة عامر','30006');
INSERT INTO communes VALUES('c-30-007',30,'Tebesbest','تبسبست','30007');
INSERT INTO communes VALUES('c-30-008',30,'Nezla','نزلة','30008');
INSERT INTO communes VALUES('c-30-009',30,'Zaouia El Abidia','الزاوية العابدية','30009');
INSERT INTO communes VALUES('c-30-010',30,'Sidi Slimane','سيدي سليمان','30010');
INSERT INTO communes VALUES('c-30-011',30,'Sidi Khouiled','سيدي خويلد','30011');
INSERT INTO communes VALUES('c-30-012',30,'Hassi Ben Abdellah','حاسي بن عبد ﷲ','30012');
INSERT INTO communes VALUES('c-30-013',30,'Touggourt','توقرت','30013');
INSERT INTO communes VALUES('c-30-014',30,'El Hadjira','الحجيرة','30014');
INSERT INTO communes VALUES('c-30-015',30,'Taibet','الطيبات','30015');
INSERT INTO communes VALUES('c-30-016',30,'Tamacine','تماسين','30016');
INSERT INTO communes VALUES('c-30-017',30,'Benaceur','بن ناصر','30017');
INSERT INTO communes VALUES('c-30-018',30,'Mnaguer','المنقر','30018');
INSERT INTO communes VALUES('c-30-019',30,'Megarine','المقارين','30019');
INSERT INTO communes VALUES('c-30-020',30,'El Allia','العالية','30020');
INSERT INTO communes VALUES('c-30-021',30,'El Borma','البرمة','30021');
INSERT INTO communes VALUES('c-31-001',31,'Oran','وهران','31001');
INSERT INTO communes VALUES('c-31-002',31,'Gdyel','ڨديل','31002');
INSERT INTO communes VALUES('c-31-003',31,'Bir El Djir','بئر الجير','31003');
INSERT INTO communes VALUES('c-31-004',31,'Hassi Bounif','حاسيْ بُونِيف','31004');
INSERT INTO communes VALUES('c-31-005',31,'Es Senia','السانية','31005');
INSERT INTO communes VALUES('c-31-006',31,'Arzew','أرزيو','31006');
INSERT INTO communes VALUES('c-31-007',31,'Bethioua','ﺑﻃﻴﻭة','31007');
INSERT INTO communes VALUES('c-31-008',31,'Marsat El Hadjadj','مَرس ألحَجَاج','31008');
INSERT INTO communes VALUES('c-31-009',31,'Ain Turk','عيْن التُرْكْ','31009');
INSERT INTO communes VALUES('c-31-010',31,'El Ancar','العنصر','31010');
INSERT INTO communes VALUES('c-31-011',31,'Oued Tlelat','وادى تليلات','31011');
INSERT INTO communes VALUES('c-31-012',31,'Tafraoui','طفراوي','31012');
INSERT INTO communes VALUES('c-31-013',31,'Sidi Chami','سيدي الشحمي','31013');
INSERT INTO communes VALUES('c-31-014',31,'Boufatis','بوفاطيس','31014');
INSERT INTO communes VALUES('c-31-015',31,'Mers El Kebir','المرسى الكبير','31015');
INSERT INTO communes VALUES('c-31-016',31,'Bousfer','بوسفر','31016');
INSERT INTO communes VALUES('c-31-017',31,'El Karma','الكرمة','31017');
INSERT INTO communes VALUES('c-31-018',31,'El Braya','ألبْرَيَ','31018');
INSERT INTO communes VALUES('c-31-019',31,'Hassi Ben Okba','حاسي بن عقبة','31019');
INSERT INTO communes VALUES('c-31-020',31,'Ben Freha','بن فريحة','31020');
INSERT INTO communes VALUES('c-31-021',31,'Hassi Mefsoukh','حاسي مفسوخ','31021');
INSERT INTO communes VALUES('c-31-022',31,'Sidi Ben Yabka','سيدي بن يبقى','31022');
INSERT INTO communes VALUES('c-31-023',31,'Messerghin','مسرغين','31023');
INSERT INTO communes VALUES('c-31-024',31,'Boutlelis','بوتليليس','31024');
INSERT INTO communes VALUES('c-31-025',31,'Ain Kerma','عين الكرمة','31025');
INSERT INTO communes VALUES('c-31-026',31,'Ain Biya','عين البية','31026');
INSERT INTO communes VALUES('c-32-001',32,'El Bayadh','الـبـيـض','32001');
INSERT INTO communes VALUES('c-32-002',32,'Rogassa','روقاصة','32002');
INSERT INTO communes VALUES('c-32-003',32,'Stitten','ستيتين','32003');
INSERT INTO communes VALUES('c-32-004',32,'Brezina','بريزينة','32004');
INSERT INTO communes VALUES('c-32-005',32,'Ghassoul','غسول','32005');
INSERT INTO communes VALUES('c-32-006',32,'Boualem','بوعلام','32006');
INSERT INTO communes VALUES('c-32-007',32,'El Abiodh Sidi Cheikh','الابيض سيدي الشيخ','32007');
INSERT INTO communes VALUES('c-32-008',32,'Ain El Orak','عين العراك','32008');
INSERT INTO communes VALUES('c-32-009',32,'Arbaouat','أربوات','32009');
INSERT INTO communes VALUES('c-32-010',32,'Bougtoub','بوقطب','32010');
INSERT INTO communes VALUES('c-32-011',32,'El Kheither','الخيثر','32011');
INSERT INTO communes VALUES('c-32-012',32,'Kef El Ahmar','الكاف الاحمر','32012');
INSERT INTO communes VALUES('c-32-013',32,'Boussemghoun','بوسمغون','32013');
INSERT INTO communes VALUES('c-32-014',32,'Chellala','شلالة','32014');
INSERT INTO communes VALUES('c-32-015',32,'Krakda','كراكدة','32015');
INSERT INTO communes VALUES('c-32-016',32,'El Bnoud','البنود','32016');
INSERT INTO communes VALUES('c-32-017',32,'Cheguig','الشقيق','32017');
INSERT INTO communes VALUES('c-32-018',32,'Sidi Ameur','سيدي عامر','32018');
INSERT INTO communes VALUES('c-32-019',32,'El Mehara','المھارة','32019');
INSERT INTO communes VALUES('c-32-020',32,'Tousmouline','توسمولين','32020');
INSERT INTO communes VALUES('c-32-021',32,'Sidi Slimane','سيدي سليمان','32021');
INSERT INTO communes VALUES('c-32-022',32,'Sidi Tifour','سيدي طيفور','32022');
INSERT INTO communes VALUES('c-33-001',33,'Illizi','إلـيـزي','33001');
INSERT INTO communes VALUES('c-33-002',33,'Djanet','جانت','33002');
INSERT INTO communes VALUES('c-33-003',33,'Debdeb','دبداب','33003');
INSERT INTO communes VALUES('c-33-004',33,'Bordj Omar Driss','برج عمر ادريس','33004');
INSERT INTO communes VALUES('c-33-005',33,'Bordj El Haouasse','برج الحواس','33005');
INSERT INTO communes VALUES('c-33-006',33,'In Amenas','إن أميناس','33006');
INSERT INTO communes VALUES('c-34-001',34,'Bordj Bou Arreridj','برج بوعريريج','34001');
INSERT INTO communes VALUES('c-34-002',34,'Ras El Oued','رأس الوادي','34002');
INSERT INTO communes VALUES('c-34-003',34,'Bordj Zemoura','برج زمورة','34003');
INSERT INTO communes VALUES('c-34-004',34,'Mansoura','منصورة','34004');
INSERT INTO communes VALUES('c-34-005',34,'El Mhir','المھير','34005');
INSERT INTO communes VALUES('c-34-006',34,'Ben Daoud','بن داود','34006');
INSERT INTO communes VALUES('c-34-007',34,'El Achir','العشير','34007');
INSERT INTO communes VALUES('c-34-008',34,'Ain Taghrout','عين تاغروت','34008');
INSERT INTO communes VALUES('c-34-009',34,'Bordj Ghdir','برج غدير','34009');
INSERT INTO communes VALUES('c-34-010',34,'Sidi Embarek','سيدي مبارك','34010');
INSERT INTO communes VALUES('c-34-011',34,'El Hamadia','الحمادية','34011');
INSERT INTO communes VALUES('c-34-012',34,'Belimour','بليمور','34012');
INSERT INTO communes VALUES('c-34-013',34,'Medjana','مجانة','34013');
INSERT INTO communes VALUES('c-34-014',34,'Teniet En Nasr','ثنية النصر','34014');
INSERT INTO communes VALUES('c-34-015',34,'Djaafra','جعافرة','34015');
INSERT INTO communes VALUES('c-34-016',34,'El Main','إلماين','34016');
INSERT INTO communes VALUES('c-34-017',34,'Ouled Brahem','أولاد ابراھم','34017');
INSERT INTO communes VALUES('c-34-018',34,'Ouled Dahmane','أولاد دحمان','34018');
INSERT INTO communes VALUES('c-34-019',34,'Hasnaoua','حسناوة','34019');
INSERT INTO communes VALUES('c-34-020',34,'Khelil','خليل','34020');
INSERT INTO communes VALUES('c-34-021',34,'Taglait','تاقلعيت','34021');
INSERT INTO communes VALUES('c-34-022',34,'Ksour','القصور','34022');
INSERT INTO communes VALUES('c-34-023',34,'Ouled Sidi Brahim','آث سيذى پراهم.','34023');
INSERT INTO communes VALUES('c-34-024',34,'Tafreg','تفرڨ','34024');
INSERT INTO communes VALUES('c-34-025',34,'Colla','القلة','34025');
INSERT INTO communes VALUES('c-34-026',34,'Tixter','تقصطر','34026');
INSERT INTO communes VALUES('c-34-027',34,'El Ach','العش','34027');
INSERT INTO communes VALUES('c-34-028',34,'El Anseur','العناصر','34028');
INSERT INTO communes VALUES('c-34-029',34,'Tesmart','تسمارت','34029');
INSERT INTO communes VALUES('c-34-030',34,'Ain Tesra','عين تسرة','34030');
INSERT INTO communes VALUES('c-34-031',34,'Bir Kasdali','بئر قصد علي','34031');
INSERT INTO communes VALUES('c-34-032',34,'Ghilassa','غيلاسة','34032');
INSERT INTO communes VALUES('c-34-033',34,'Rabta','الرابطة','34033');
INSERT INTO communes VALUES('c-34-034',34,'Haraza','الحرازة','34034');
INSERT INTO communes VALUES('c-35-001',35,'Boumerdes','بومرداس','35001');
INSERT INTO communes VALUES('c-35-002',35,'Boudouaou','بودواو','35002');
INSERT INTO communes VALUES('c-35-003',35,'Afir','أفير','35004');
INSERT INTO communes VALUES('c-35-004',35,'Bordj Menaiel','برج منايل','35005');
INSERT INTO communes VALUES('c-35-005',35,'Baghlia','بغلية','35006');
INSERT INTO communes VALUES('c-35-006',35,'Sidi Daoud','سيدي داود','35007');
INSERT INTO communes VALUES('c-35-007',35,'Naciria','الناصرية','35008');
INSERT INTO communes VALUES('c-35-008',35,'Djinet','جنات','35009');
INSERT INTO communes VALUES('c-35-009',35,'Isser','يسر','35010');
INSERT INTO communes VALUES('c-35-010',35,'Zemmouri','زموري','35011');
INSERT INTO communes VALUES('c-35-011',35,'Si Mustapha','سي مصطفى','35012');
INSERT INTO communes VALUES('c-35-012',35,'Tidjelabine','تيجلابين','35013');
INSERT INTO communes VALUES('c-35-013',35,'Chabet El Ameur','شعبة العامر','35014');
INSERT INTO communes VALUES('c-35-014',35,'Thenia','الثنية','35015');
INSERT INTO communes VALUES('c-35-015',35,'Timezrit','تمزريت','35018');
INSERT INTO communes VALUES('c-35-016',35,'Corso','قورصو','35019');
INSERT INTO communes VALUES('c-35-017',35,'Ouled Moussa','أولاد موسى','35020');
INSERT INTO communes VALUES('c-35-018',35,'Larbatache','الأربعطاش','35021');
INSERT INTO communes VALUES('c-35-019',35,'Bouzegza Keddara','بوزقزة قدارة','35022');
INSERT INTO communes VALUES('c-35-020',35,'Taourga','تورقة','35025');
INSERT INTO communes VALUES('c-35-021',35,'Ouled Aissa','أولاد عيسى','35026');
INSERT INTO communes VALUES('c-35-022',35,'Ben Choud','بن شود','35027');
INSERT INTO communes VALUES('c-35-023',35,'Dellys','دلس','35028');
INSERT INTO communes VALUES('c-35-024',35,'Ammal','عمال','35029');
INSERT INTO communes VALUES('c-35-025',35,'Beni Amrane','بنى عمران','35030');
INSERT INTO communes VALUES('c-35-026',35,'Souk El Had','سوق الحد','35031');
INSERT INTO communes VALUES('c-35-027',35,'Boudouaou El Bahri','بودواو البحرى','35032');
INSERT INTO communes VALUES('c-35-028',35,'Ouled Hedadj','أولاد ھداج','35033');
INSERT INTO communes VALUES('c-35-029',35,'Laghata','لقاطة','35035');
INSERT INTO communes VALUES('c-35-030',35,'Hammedi','حمادى','35036');
INSERT INTO communes VALUES('c-35-031',35,'Khemis El Khechna','خميس الخشنة','35037');
INSERT INTO communes VALUES('c-35-032',35,'El Kharrouba','الخروبة','35038');
INSERT INTO communes VALUES('c-36-001',36,'El Tarf','الطارف','36001');
INSERT INTO communes VALUES('c-36-002',36,'Bouhadjar','بوحجار','36002');
INSERT INTO communes VALUES('c-36-003',36,'Ben Mhidi','بن مهيدى','36003');
INSERT INTO communes VALUES('c-36-004',36,'Bougous','بوقوس','36004');
INSERT INTO communes VALUES('c-36-005',36,'El Kala','القالة','36005');
INSERT INTO communes VALUES('c-36-006',36,'Ain El Assel','عين العسل','36006');
INSERT INTO communes VALUES('c-36-007',36,'El Aioun','العيون','36007');
INSERT INTO communes VALUES('c-36-008',36,'Bouteldja','بوثلجة','36008');
INSERT INTO communes VALUES('c-36-009',36,'Souarekh','السوارخ','36009');
INSERT INTO communes VALUES('c-36-010',36,'Berrihane','برحان','36010');
INSERT INTO communes VALUES('c-36-011',36,'Lac Des Oiseaux','بحيرة الطيور','36011');
INSERT INTO communes VALUES('c-36-012',36,'Chefia','الشافية','36012');
INSERT INTO communes VALUES('c-36-013',36,'Drean','الذرعان','36013');
INSERT INTO communes VALUES('c-36-014',36,'Chihani','شهانى','36014');
INSERT INTO communes VALUES('c-36-015',36,'Chebaita Mokhtar','شبيطة مختار','36015');
INSERT INTO communes VALUES('c-36-016',36,'Besbes','البسباس','36016');
INSERT INTO communes VALUES('c-36-017',36,'Asfour','عصفور','36017');
INSERT INTO communes VALUES('c-36-018',36,'Echatt','الشط','36018');
INSERT INTO communes VALUES('c-36-019',36,'Zerizer','زريزر','36019');
INSERT INTO communes VALUES('c-36-020',36,'Zitouna','الزيتونة','36020');
INSERT INTO communes VALUES('c-36-021',36,'Ain Kerma','عين الكرمة','36021');
INSERT INTO communes VALUES('c-36-022',36,'Oued Zitoun','وادى الزيتون','36022');
INSERT INTO communes VALUES('c-36-023',36,'Hammam Beni Salah','حمام بنى صالح','36023');
INSERT INTO communes VALUES('c-36-024',36,'Raml Souk','رمل سوق','36024');
INSERT INTO communes VALUES('c-37-001',37,'Tindouf','تندوف','37001');
INSERT INTO communes VALUES('c-37-002',37,'Oum El Assel','أم العسل','37002');
INSERT INTO communes VALUES('c-38-001',38,'Tissemsilt','تـيـسـمـسـيـلـت','38001');
INSERT INTO communes VALUES('c-38-002',38,'Bordj Bou Naama','برج بونعامة','38002');
INSERT INTO communes VALUES('c-38-003',38,'Theniet El Had','ثنية الاحد','38003');
INSERT INTO communes VALUES('c-38-004',38,'Lazharia','الازھرية','38004');
INSERT INTO communes VALUES('c-38-005',38,'Beni Chaib','بنى شعيب','38005');
INSERT INTO communes VALUES('c-38-006',38,'Lardjem','لارجم','38006');
INSERT INTO communes VALUES('c-38-007',38,'Melaab','ملعب','38007');
INSERT INTO communes VALUES('c-38-008',38,'Sidi Lantri','سيدي العنترى','38008');
INSERT INTO communes VALUES('c-38-009',38,'Bordj El Emir Abdelkader','برج الامير عبد القادر','38009');
INSERT INTO communes VALUES('c-38-010',38,'Layoune','العيون','38010');
INSERT INTO communes VALUES('c-38-011',38,'Khemisti','خميستى','38011');
INSERT INTO communes VALUES('c-38-012',38,'Ouled Bessem','أولاد بسام','38012');
INSERT INTO communes VALUES('c-38-013',38,'Ammari','عمارى','38013');
INSERT INTO communes VALUES('c-38-014',38,'Youssoufia','اليوسفية','38014');
INSERT INTO communes VALUES('c-38-015',38,'Sidi Boutouchent','سيدي بوتوشنت','38015');
INSERT INTO communes VALUES('c-38-016',38,'Larbaa','الاربعاء','38016');
INSERT INTO communes VALUES('c-38-017',38,'Maasem','المعاصم','38017');
INSERT INTO communes VALUES('c-38-018',38,'Sidi Abed','سيدي عابد','38018');
INSERT INTO communes VALUES('c-38-019',38,'Tamalaht','تاملاحت','38019');
INSERT INTO communes VALUES('c-38-020',38,'Sidi Slimane','سيدي سليمان','38020');
INSERT INTO communes VALUES('c-38-021',38,'Boucaid','بوقايد','38021');
INSERT INTO communes VALUES('c-38-022',38,'Beni Lahcene','بنى لحسن','38022');
INSERT INTO communes VALUES('c-39-001',39,'El Oued','الوادي','39001');
INSERT INTO communes VALUES('c-39-002',39,'Robbah','رباح','39002');
INSERT INTO communes VALUES('c-39-003',39,'Oued El Alenda','وادى العلندة','39003');
INSERT INTO communes VALUES('c-39-004',39,'Bayadha','البياضة','39004');
INSERT INTO communes VALUES('c-39-005',39,'Nakhla','النخلة','39005');
INSERT INTO communes VALUES('c-39-006',39,'Guemar','ڨمار','39006');
INSERT INTO communes VALUES('c-39-007',39,'Kouinine','كوينين','39007');
INSERT INTO communes VALUES('c-39-008',39,'Reguiba','الرڨيبة','39008');
INSERT INTO communes VALUES('c-39-009',39,'Hamraia','الحمراية','39009');
INSERT INTO communes VALUES('c-39-010',39,'Taghzout','تغزوت','39010');
INSERT INTO communes VALUES('c-39-011',39,'Debila','الدبيلة','39011');
INSERT INTO communes VALUES('c-39-012',39,'Hassani Abdelkrim','بلدية حساني عبد الكريم','39012');
INSERT INTO communes VALUES('c-39-013',39,'Hassi Khelifa','حاسى خليفة','39013');
INSERT INTO communes VALUES('c-39-014',39,'Taleb Larbi','طالب العربي','39014');
INSERT INTO communes VALUES('c-39-015',39,'Douar El Ma','دوار الماء','39015');
INSERT INTO communes VALUES('c-39-016',39,'Sidi Aoun','سيدي عون','39016');
INSERT INTO communes VALUES('c-39-017',39,'Trifaoui','تريفاوى','39017');
INSERT INTO communes VALUES('c-39-018',39,'Magrane','المڨرن','39018');
INSERT INTO communes VALUES('c-39-019',39,'Beni Guecha','بن ڨشة','39019');
INSERT INTO communes VALUES('c-39-020',39,'Ourmas','أورماس','39020');
INSERT INTO communes VALUES('c-39-021',39,'Still','سطيل','39021');
INSERT INTO communes VALUES('c-39-022',39,'Mrara','مرارة','39022');
INSERT INTO communes VALUES('c-39-023',39,'Sidi Khellil','سيدي خليل','39023');
INSERT INTO communes VALUES('c-39-024',39,'Tendla','تندلة','39024');
INSERT INTO communes VALUES('c-39-025',39,'El Ogla','العقلة','39025');
INSERT INTO communes VALUES('c-39-026',39,'Mih Ouansa','مية ونسة','39026');
INSERT INTO communes VALUES('c-39-027',39,'El Mghair','المغير','39027');
INSERT INTO communes VALUES('c-39-028',39,'Djamaa','جامعة','39028');
INSERT INTO communes VALUES('c-39-029',39,'Oum Touyour','أم الطيور','39029');
INSERT INTO communes VALUES('c-39-030',39,'Sidi Amrane','سيدي عمران','39030');
INSERT INTO communes VALUES('c-40-001',40,'Khenchela','خنشلة','40001');
INSERT INTO communes VALUES('c-40-002',40,'Mtoussa','متوسة','40002');
INSERT INTO communes VALUES('c-40-003',40,'Kais','قايس','40003');
INSERT INTO communes VALUES('c-40-004',40,'Baghai','بغاي','40004');
INSERT INTO communes VALUES('c-40-005',40,'El Hamma','الحامة','40005');
INSERT INTO communes VALUES('c-40-006',40,'Ain Touila','عين الطويلة','40006');
INSERT INTO communes VALUES('c-40-007',40,'Taouzianat','تاوزيانت','40007');
INSERT INTO communes VALUES('c-40-008',40,'Bouhmama','بوحمامة','40008');
INSERT INTO communes VALUES('c-40-009',40,'El Oueldja','الولجة','40009');
INSERT INTO communes VALUES('c-40-010',40,'Remila','الرميلة','40010');
INSERT INTO communes VALUES('c-40-011',40,'Cherchar','ششار','40011');
INSERT INTO communes VALUES('c-40-012',40,'Djellal','جلال','40012');
INSERT INTO communes VALUES('c-40-013',40,'Babar','بابار','40013');
INSERT INTO communes VALUES('c-40-014',40,'Tamza','تامزة','40014');
INSERT INTO communes VALUES('c-40-015',40,'Ensigha','انسيغة','40015');
INSERT INTO communes VALUES('c-40-016',40,'Ouled Rechache','أولاد رشاش','40016');
INSERT INTO communes VALUES('c-40-017',40,'El Mahmal','المحمل','40017');
INSERT INTO communes VALUES('c-40-018',40,'Msara','أمصارة','40018');
INSERT INTO communes VALUES('c-40-019',40,'Yabous','يابوس','40019');
INSERT INTO communes VALUES('c-40-020',40,'Khirane','خيران','40020');
INSERT INTO communes VALUES('c-40-021',40,'Chelia','شلية','40021');
INSERT INTO communes VALUES('c-41-001',41,'Souk Ahras','سوق أهراس','41001');
INSERT INTO communes VALUES('c-41-002',41,'Sedrata','سدراتة','41002');
INSERT INTO communes VALUES('c-41-003',41,'Hanancha','الحنانشة','41003');
INSERT INTO communes VALUES('c-41-004',41,'Mechroha','المشروحة','41004');
INSERT INTO communes VALUES('c-41-005',41,'Ouled Driss','أولاد ادريس','41005');
INSERT INTO communes VALUES('c-41-006',41,'Tiffech','تيفاش','41006');
INSERT INTO communes VALUES('c-41-007',41,'Zaarouria','الزعرورية','41007');
INSERT INTO communes VALUES('c-41-008',41,'Taoura','تاورة','41008');
INSERT INTO communes VALUES('c-41-009',41,'Drea','الدريعة','41009');
INSERT INTO communes VALUES('c-41-010',41,'Haddada','الحدادة','41010');
INSERT INTO communes VALUES('c-41-011',41,'Khedara','لخضارة','41011');
INSERT INTO communes VALUES('c-41-012',41,'Merahna','المراهنة','41012');
INSERT INTO communes VALUES('c-41-013',41,'Ouled Moumen','أولاد مؤمن','41013');
INSERT INTO communes VALUES('c-41-014',41,'Bir Bouhouche','بئر بوحوش','41014');
INSERT INTO communes VALUES('c-41-015',41,'Mdaourouche','مداوروش','41015');
INSERT INTO communes VALUES('c-41-016',41,'Oum El Adhaim','أم العظائم','41016');
INSERT INTO communes VALUES('c-41-017',41,'Ain Zana','عين الزانة','41017');
INSERT INTO communes VALUES('c-41-018',41,'Ain Soltane','عين السلطان','41018');
INSERT INTO communes VALUES('c-41-019',41,'Quillen','ويلان','41019');
INSERT INTO communes VALUES('c-41-020',41,'Sidi Fredj','سيدي فرج','41020');
INSERT INTO communes VALUES('c-41-021',41,'Safel El Ouiden','سافل الويدان','41021');
INSERT INTO communes VALUES('c-41-022',41,'Ragouba','الرقوبة','41022');
INSERT INTO communes VALUES('c-41-023',41,'Khemissa','خميسة','41023');
INSERT INTO communes VALUES('c-41-024',41,'Oued Keberit','وادى الكبريت','41024');
INSERT INTO communes VALUES('c-41-025',41,'Terraguelt','ترقالت','41025');
INSERT INTO communes VALUES('c-41-026',41,'Zouabi','الزوابى','41026');
INSERT INTO communes VALUES('c-42-001',42,'Tipaza','تيبازة','42001');
INSERT INTO communes VALUES('c-42-002',42,'Menaceur','مناصر','42002');
INSERT INTO communes VALUES('c-42-003',42,'Larhat','الأرهاط','42003');
INSERT INTO communes VALUES('c-42-004',42,'Douaouda','دواودة','42004');
INSERT INTO communes VALUES('c-42-005',42,'Bourkika','بورقيقة','42005');
INSERT INTO communes VALUES('c-42-006',42,'Khemisti','خميستي','42006');
INSERT INTO communes VALUES('c-42-007',42,'Aghabal','أغابال','42010');
INSERT INTO communes VALUES('c-42-008',42,'Hadjout','حجوط','42012');
INSERT INTO communes VALUES('c-42-009',42,'Sidi Amar','سيدي عمر','42013');
INSERT INTO communes VALUES('c-42-010',42,'Gouraya','ڨورايا','42014');
INSERT INTO communes VALUES('c-42-011',42,'Nodor','الناظور','42015');
INSERT INTO communes VALUES('c-42-012',42,'Chaiba','الشعيبة','42016');
INSERT INTO communes VALUES('c-42-013',42,'Ain Tagourait','عين تڨورايت','42017');
INSERT INTO communes VALUES('c-42-014',42,'Cherchel','شرشال','42022');
INSERT INTO communes VALUES('c-42-015',42,'Damous','الداموس','42023');
INSERT INTO communes VALUES('c-42-016',42,'Meurad','مراد','42024');
INSERT INTO communes VALUES('c-42-017',42,'Fouka','فوكة','42025');
INSERT INTO communes VALUES('c-42-018',42,'Bou Ismail','بو اسماعيل','42026');
INSERT INTO communes VALUES('c-42-019',42,'Ahmer El Ain','أحمر العين','42027');
INSERT INTO communes VALUES('c-42-020',42,'Bou Haroun','بوهارون','42030');
INSERT INTO communes VALUES('c-42-021',42,'Sidi Ghiles','سيدي غيلاس','42032');
INSERT INTO communes VALUES('c-42-022',42,'Messelmoun','مسلمون','42033');
INSERT INTO communes VALUES('c-42-023',42,'Sidi Rached','سيدي راشد','42034');
INSERT INTO communes VALUES('c-42-024',42,'Kolea','القليعة','42035');
INSERT INTO communes VALUES('c-42-025',42,'Attatba','الحطاطبة','42036');
INSERT INTO communes VALUES('c-42-026',42,'Sidi Semiane','سيدي سميان','42040');
INSERT INTO communes VALUES('c-42-027',42,'Beni Milleuk','بني ميلك','42041');
INSERT INTO communes VALUES('c-42-028',42,'Hadjerat Ennous','حجرة النص','42042');
INSERT INTO communes VALUES('c-43-001',43,'Mila','ميلة','43001');
INSERT INTO communes VALUES('c-43-002',43,'Ferdjioua','فرجيوة','43002');
INSERT INTO communes VALUES('c-43-003',43,'Chelghoum Laid','شلغوم العيد','43003');
INSERT INTO communes VALUES('c-43-004',43,'Oued Athmenia','وادي العثمانية','43004');
INSERT INTO communes VALUES('c-43-005',43,'Ain Mellouk','عين ملوك','43005');
INSERT INTO communes VALUES('c-43-006',43,'Telerghma','تلاغمة','43006');
INSERT INTO communes VALUES('c-43-007',43,'Oued Seguen','وادى سقان','43007');
INSERT INTO communes VALUES('c-43-008',43,'Tadjenanet','تاجنانت','43008');
INSERT INTO communes VALUES('c-43-009',43,'Benyahia Abderrahmane','بن يحيى عبد الرحمان','43009');
INSERT INTO communes VALUES('c-43-010',43,'Oued Endja','وادى النجاء','43010');
INSERT INTO communes VALUES('c-43-011',43,'Ahmed Rachedi','أحمد راشدي','43011');
INSERT INTO communes VALUES('c-43-012',43,'Ouled Khalouf','أولاد خلوف','43012');
INSERT INTO communes VALUES('c-43-013',43,'Tiberguent','تيبرقنت','43013');
INSERT INTO communes VALUES('c-43-014',43,'Bouhatem','بوحاتم','43014');
INSERT INTO communes VALUES('c-43-015',43,'Rouached','رواشد','43015');
INSERT INTO communes VALUES('c-43-016',43,'Tessala Lamatai','تسالة لمطاي','43016');
INSERT INTO communes VALUES('c-43-017',43,'Grarem Gouga','القرارم قوقة','43017');
INSERT INTO communes VALUES('c-43-018',43,'Sidi Merouane','سيدي مروان','43018');
INSERT INTO communes VALUES('c-43-019',43,'Tassadane Haddada','تسدان حدادة','43019');
INSERT INTO communes VALUES('c-43-020',43,'Derradji Bousselah','دراحي بوصلاح','43020');
INSERT INTO communes VALUES('c-43-021',43,'Minar Zarza','مينار زرزة','43021');
INSERT INTO communes VALUES('c-43-022',43,'Amira Arras','عميرة أراس','43022');
INSERT INTO communes VALUES('c-43-023',43,'Terrai Bainen','ترعى بينان','43023');
INSERT INTO communes VALUES('c-43-024',43,'Hamala','حمالة','43024');
INSERT INTO communes VALUES('c-43-025',43,'Ain Tine','عين التين','43025');
INSERT INTO communes VALUES('c-43-026',43,'El Mechira','المشيرة','43026');
INSERT INTO communes VALUES('c-43-027',43,'Sidi Khelifa','سيدي خليفة','43027');
INSERT INTO communes VALUES('c-43-028',43,'Zeghaia','زغاية','43028');
INSERT INTO communes VALUES('c-43-029',43,'Elayadi Barbes','العياضى برباس','43029');
INSERT INTO communes VALUES('c-43-030',43,'Ain Beida Harriche','عين البيضاء حريش','43030');
INSERT INTO communes VALUES('c-43-031',43,'Yahia Beniguecha','يحيى بنى قشة','43031');
INSERT INTO communes VALUES('c-43-032',43,'Chigara','الشيقارة','43032');
INSERT INTO communes VALUES('c-44-001',44,'Ain Defla','عين دفلة - عين الدفلى','44001');
INSERT INTO communes VALUES('c-44-002',44,'Miliana','مليانة','44002');
INSERT INTO communes VALUES('c-44-003',44,'Boumedfaa','بومدفع','44003');
INSERT INTO communes VALUES('c-44-004',44,'Khemis Miliana','خميس مليانة','44004');
INSERT INTO communes VALUES('c-44-005',44,'Hammam Righa','حمام ريغة','44005');
INSERT INTO communes VALUES('c-44-006',44,'Arib','عريب','44006');
INSERT INTO communes VALUES('c-44-007',44,'Djelida','جليدة','44007');
INSERT INTO communes VALUES('c-44-008',44,'El Amra','العامرة','44008');
INSERT INTO communes VALUES('c-44-009',44,'Bourached','بوراشد','44009');
INSERT INTO communes VALUES('c-44-010',44,'El Attaf','العطاف','44010');
INSERT INTO communes VALUES('c-44-011',44,'El Abadia','العبادية','44011');
INSERT INTO communes VALUES('c-44-012',44,'Djendel','جندل','44012');
INSERT INTO communes VALUES('c-44-013',44,'Oued Chorfa','وادى الشرفاء','44013');
INSERT INTO communes VALUES('c-44-014',44,'Ain Lechiakh','عين االشياخ','44014');
INSERT INTO communes VALUES('c-44-015',44,'Oued Djemaa','وادى جمعة','44015');
INSERT INTO communes VALUES('c-44-016',44,'Rouina','روينة','44016');
INSERT INTO communes VALUES('c-44-017',44,'Zeddine','زدين','44017');
INSERT INTO communes VALUES('c-44-018',44,'El Hassania','الحسنية','44018');
INSERT INTO communes VALUES('c-44-019',44,'Bir Ouled Khelifa','بئر ولد خليفة','44019');
INSERT INTO communes VALUES('c-44-020',44,'Ain Soltane','عين السلطان','44020');
INSERT INTO communes VALUES('c-44-021',44,'Tarik Ibn Ziad','طارق بن زياد','44021');
INSERT INTO communes VALUES('c-44-022',44,'Bordj Emir Khaled','برج الأمير خالد','44022');
INSERT INTO communes VALUES('c-44-023',44,'Ain Torki','عين التركى','44023');
INSERT INTO communes VALUES('c-44-024',44,'Sidi Lakhdar','سيدي لخضر','44024');
INSERT INTO communes VALUES('c-44-025',44,'Ben Allal','بن علال','44025');
INSERT INTO communes VALUES('c-44-026',44,'Ain Benian','عين البنيان','44026');
INSERT INTO communes VALUES('c-44-027',44,'Hoceinia','حسينية','44027');
INSERT INTO communes VALUES('c-44-028',44,'Barbouche','بربوش','44028');
INSERT INTO communes VALUES('c-44-029',44,'Djemaa Ouled Chikh','جمعة أولاد الشيخ','44029');
INSERT INTO communes VALUES('c-44-030',44,'Mekhatria','المخاطرية','44030');
INSERT INTO communes VALUES('c-44-031',44,'Bathia','بطحية','44031');
INSERT INTO communes VALUES('c-44-032',44,'Tachta Zegagha','تاشتة زقاغة','44032');
INSERT INTO communes VALUES('c-44-033',44,'Ain Bouyahia','عين بويحى','44033');
INSERT INTO communes VALUES('c-44-034',44,'El Maine','الماين','44034');
INSERT INTO communes VALUES('c-44-035',44,'Tiberkanine','تبركانين','44035');
INSERT INTO communes VALUES('c-44-036',44,'Belaas','بالعاص','44036');
INSERT INTO communes VALUES('c-45-001',45,'Naama','النــعـامـة','45001');
INSERT INTO communes VALUES('c-45-002',45,'Mechria','مشرية','45002');
INSERT INTO communes VALUES('c-45-003',45,'Ain Sefra','عين الصفراء','45003');
INSERT INTO communes VALUES('c-45-004',45,'Tiout','تيوت','45004');
INSERT INTO communes VALUES('c-45-005',45,'Sfissifa','صفيصيفة','45005');
INSERT INTO communes VALUES('c-45-006',45,'Moghrar','مغرار','45006');
INSERT INTO communes VALUES('c-45-007',45,'Assela','عسلة','45007');
INSERT INTO communes VALUES('c-45-008',45,'Djeniane Bourzeg','جنين بورزق','45008');
INSERT INTO communes VALUES('c-45-009',45,'Ain Ben Khelil','عين بن خليل','45009');
INSERT INTO communes VALUES('c-45-010',45,'Makman Ben Amer','مكمن بن عمر','45010');
INSERT INTO communes VALUES('c-45-011',45,'Kasdir','قصدير','45011');
INSERT INTO communes VALUES('c-45-012',45,'El Biod','البيوض','45012');
INSERT INTO communes VALUES('c-46-001',46,'Ain Temouchent','عـيـن تـمـوشـنـت','46001');
INSERT INTO communes VALUES('c-46-002',46,'Chaabet El Ham','شعبة اللحم','46002');
INSERT INTO communes VALUES('c-46-003',46,'Ain Kihal','عين الكيحل','46003');
INSERT INTO communes VALUES('c-46-004',46,'Hammam Bouhadjar','حمام بو حجر','46004');
INSERT INTO communes VALUES('c-46-005',46,'Bou Zedjar','بوزجار','46005');
INSERT INTO communes VALUES('c-46-006',46,'Oued Berkeche','وادى برقش','46006');
INSERT INTO communes VALUES('c-46-007',46,'Aghlal','أغلال','46007');
INSERT INTO communes VALUES('c-46-008',46,'Terga','تارقة','46008');
INSERT INTO communes VALUES('c-46-009',46,'Ain El Arbaa','عين الاربعاء','46009');
INSERT INTO communes VALUES('c-46-010',46,'Tamzoura','تامزوغة','46010');
INSERT INTO communes VALUES('c-46-011',46,'Chentouf','شنتوف','46011');
INSERT INTO communes VALUES('c-46-012',46,'Sidi Ben Adda','سيدي بن عدة','46012');
INSERT INTO communes VALUES('c-46-013',46,'Aoubellil','عقب الليل','46013');
INSERT INTO communes VALUES('c-46-014',46,'El Malah','المالح','46014');
INSERT INTO communes VALUES('c-46-015',46,'Sidi Boumediene','سيدي بومدين','46015');
INSERT INTO communes VALUES('c-46-016',46,'Oued Sabah','وادى الصباح','46016');
INSERT INTO communes VALUES('c-46-017',46,'Ouled Boudjemaa','أولاد بوجمعة','46017');
INSERT INTO communes VALUES('c-46-018',46,'Ain Tolba','عين الطلبة','46018');
INSERT INTO communes VALUES('c-46-019',46,'El Amria','العامرية','46019');
INSERT INTO communes VALUES('c-46-020',46,'Hassi El Ghella','حاسى الغلة','46020');
INSERT INTO communes VALUES('c-46-021',46,'Hassasna','الحساسنة','46021');
INSERT INTO communes VALUES('c-46-022',46,'Ouled Kihal','أولاد الكيحل','46022');
INSERT INTO communes VALUES('c-46-023',46,'Beni Saf','بني صاف','46023');
INSERT INTO communes VALUES('c-46-024',46,'Sidi Safi','سيدي الصافي','46024');
INSERT INTO communes VALUES('c-46-025',46,'Oulhaca El Gheraba','ولهاصة الغرابة','46025');
INSERT INTO communes VALUES('c-46-026',46,'Sidi Ouriache','سيدي وريلش','46026');
INSERT INTO communes VALUES('c-46-027',46,'El Emir Abdelkader','الأمير عبد القادر','46027');
INSERT INTO communes VALUES('c-46-028',46,'El Messaid','المساعيد','46028');
INSERT INTO communes VALUES('c-47-001',47,'Ghardaia','غرداية','47001');
INSERT INTO communes VALUES('c-47-002',47,'El Meniaa','المنيعة','47002');
INSERT INTO communes VALUES('c-47-003',47,'Dhayet Bendhahoua','ضاية بن ضحوة','47003');
INSERT INTO communes VALUES('c-47-004',47,'Berriane','بريان','47004');
INSERT INTO communes VALUES('c-47-005',47,'Metlili','متليلي الشعانبة','47005');
INSERT INTO communes VALUES('c-47-006',47,'El Guerrara','الڨرارة','47006');
INSERT INTO communes VALUES('c-47-007',47,'El Atteuf','العطف','47007');
INSERT INTO communes VALUES('c-47-008',47,'Zelfana','زلفانة','47008');
INSERT INTO communes VALUES('c-47-009',47,'Sebseb','سبسب','47009');
INSERT INTO communes VALUES('c-47-010',47,'Bounoura','بونورة','47010');
INSERT INTO communes VALUES('c-47-011',47,'Hassi Fehal','حاسي الفحل','47011');
INSERT INTO communes VALUES('c-47-012',47,'Hassi Gara','حاسي قارة','47012');
INSERT INTO communes VALUES('c-47-013',47,'Mansoura','منصورة','47013');
INSERT INTO communes VALUES('c-48-001',48,'Relizane','غيليزان','48001');
INSERT INTO communes VALUES('c-48-002',48,'Oued Rhiou','وادي رهيو','48002');
INSERT INTO communes VALUES('c-48-003',48,'Belaassel Bouzegza','بلعسل بوزقزة','48003');
INSERT INTO communes VALUES('c-48-004',48,'Sidi Saada','سيدي سعادة','48004');
INSERT INTO communes VALUES('c-48-005',48,'Ouled Aiche','أولاد يعيش','48005');
INSERT INTO communes VALUES('c-48-006',48,'Sidi Lazreg','سيدي لزرق','48006');
INSERT INTO communes VALUES('c-48-007',48,'El Hamadna','الحمادنة','48007');
INSERT INTO communes VALUES('c-48-008',48,'Sidi Mhamed Ben Ali','سيدي امحمد بن علي','48008');
INSERT INTO communes VALUES('c-48-009',48,'Mediouna','مديونة','48009');
INSERT INTO communes VALUES('c-48-010',48,'Sidi Khettab','سيدي خطاب','48010');
INSERT INTO communes VALUES('c-48-011',48,'Ammi Moussa','عمي موسى','48011');
INSERT INTO communes VALUES('c-48-012',48,'Zemmoura','زمورة','48012');
INSERT INTO communes VALUES('c-48-013',48,'Beni Dergoun','بني درقن','48013');
INSERT INTO communes VALUES('c-48-014',48,'Djidiouia','جيديوة','48014');
INSERT INTO communes VALUES('c-48-015',48,'El Guettar','القطارة','48015');
INSERT INTO communes VALUES('c-48-016',48,'Hamri','الحمري','48016');
INSERT INTO communes VALUES('c-48-017',48,'El Matmar','المطمار','48017');
INSERT INTO communes VALUES('c-48-018',48,'Sidi Mhamed Ben Aouda','سيدي بن عودة','48018');
INSERT INTO communes VALUES('c-48-019',48,'Ain Tarek','عين طارق','48019');
INSERT INTO communes VALUES('c-48-020',48,'Oued Essalem','وادي السلام','48020');
INSERT INTO communes VALUES('c-48-021',48,'Ouarizane','ﻭﺍﺭﻳﺯﺍﻥ','48021');
INSERT INTO communes VALUES('c-48-022',48,'Mazouna','مازونة','48022');
INSERT INTO communes VALUES('c-48-023',48,'Kalaa','قلعة','48023');
INSERT INTO communes VALUES('c-48-024',48,'Ain Rahma','عين الرحمة','48024');
INSERT INTO communes VALUES('c-48-025',48,'Yellel','يلل','48025');
INSERT INTO communes VALUES('c-48-026',48,'Oued El Djemaa','وادى الجمعة','48026');
INSERT INTO communes VALUES('c-48-027',48,'Ramka','رمكة','48027');
INSERT INTO communes VALUES('c-48-028',48,'Mendes','مندس','48028');
INSERT INTO communes VALUES('c-48-029',48,'Lahlef','لحلاف','48029');
INSERT INTO communes VALUES('c-48-030',48,'Beni Zentis','بني زنتيس','48030');
INSERT INTO communes VALUES('c-48-031',48,'Souk El Haad','سوق الحد','48031');
INSERT INTO communes VALUES('c-48-032',48,'Dar Ben Abdellah','دار بن عبد الله','48032');
INSERT INTO communes VALUES('c-48-033',48,'El Hassi','الحاسى','48033');
INSERT INTO communes VALUES('c-48-034',48,'Had Echkalla','حد الشقالة','48034');
INSERT INTO communes VALUES('c-48-035',48,'Bendaoud','بن داود','48035');
INSERT INTO communes VALUES('c-48-036',48,'El Ouldja','العلجة','48036');
INSERT INTO communes VALUES('c-48-037',48,'Merdja Sidi Abed','مرجة سيدي عابد','48037');
INSERT INTO communes VALUES('c-48-038',48,'Ouled Sidi Mihoub','أولاد سيدي ميهوب','48038');
INSERT INTO communes VALUES('c-49-001',49,'Timimoun','تيميمون','49000');
INSERT INTO communes VALUES('c-50-001',50,'Bordj Badji Mokhtar','برج باجي مختار','50000');
INSERT INTO communes VALUES('c-51-001',51,'Ouled Djellal','أولاد جلال','51000');
INSERT INTO communes VALUES('c-52-001',52,'Beni Abbes','بني عباس','52000');
INSERT INTO communes VALUES('c-53-001',53,'In Salah','عين صالح','53000');
INSERT INTO communes VALUES('c-54-001',54,'In Guezzam','عين قزام','54000');
INSERT INTO communes VALUES('c-55-001',55,'Touggourt','تقرت','55000');
INSERT INTO communes VALUES('c-56-001',56,'Djanet','جانت','56000');
INSERT INTO communes VALUES('c-57-001',57,'El M''Ghair','المغير','57000');
INSERT INTO communes VALUES('c-58-001',58,'El Meniaa','المنيعة','58000');
