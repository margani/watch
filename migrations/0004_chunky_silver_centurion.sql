CREATE TABLE `imdb_episodes` (
	`imdb_id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `imdb_episodes_series_idx` ON `imdb_episodes` (`series_id`);