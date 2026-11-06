CREATE TABLE `watch_list_items` (
	`list_id` integer NOT NULL,
	`title_id` integer NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`list_id`, `title_id`),
	FOREIGN KEY (`list_id`) REFERENCES `watch_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `watch_titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watch_list_items_order_idx` ON `watch_list_items` (`list_id`,`position`);--> statement-breakpoint
CREATE TABLE `watch_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watch_lists_user_idx` ON `watch_lists` (`user_id`,`created_at`);