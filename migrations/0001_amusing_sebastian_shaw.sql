CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first_at` integer NOT NULL,
	`last_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sales` ADD `cash_received` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `change_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `sales` SET `cash_received` = `paid_amount` WHERE `method` <> 'CREDIT';