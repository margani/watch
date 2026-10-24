CREATE TABLE `imdb_ratings` (
	`imdb_id` text PRIMARY KEY NOT NULL,
	`rating` real NOT NULL,
	`votes` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watch_episodes` (
	`user_id` text NOT NULL,
	`title_id` integer NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL,
	`watched_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `title_id`, `season`, `episode`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `watch_titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watch_news` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title_id` integer NOT NULL,
	`kind` text NOT NULL,
	`season` integer NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`air_date` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`seen_at` integer,
	`emailed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `watch_titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_news_item_idx` ON `watch_news` (`user_id`,`title_id`,`kind`,`season`,`number`);--> statement-breakpoint
CREATE INDEX `watch_news_unseen_idx` ON `watch_news` (`user_id`,`seen_at`);--> statement-breakpoint
CREATE TABLE `watch_seasons` (
	`title_id` integer NOT NULL,
	`season` integer NOT NULL,
	`episodes` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`title_id`, `season`),
	FOREIGN KEY (`title_id`) REFERENCES `watch_titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watch_services` (
	`user_id` text NOT NULL,
	`provider_id` integer NOT NULL,
	`name` text NOT NULL,
	`logo_path` text,
	PRIMARY KEY(`user_id`, `provider_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watch_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email_news` integer DEFAULT true NOT NULL,
	`country` text,
	`links` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watch_titles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`poster_path` text,
	`details` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_titles_tmdb_idx` ON `watch_titles` (`media`,`tmdb_id`);--> statement-breakpoint
CREATE TABLE `watchlist` (
	`user_id` text NOT NULL,
	`title_id` integer NOT NULL,
	`status` text NOT NULL,
	`rating` integer,
	`watched_at` integer,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `title_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `watch_titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watchlist_status_idx` ON `watchlist` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);