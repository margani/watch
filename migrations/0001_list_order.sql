ALTER TABLE `watchlist` ADD `position` real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `watchlist_position_idx` ON `watchlist` (`user_id`,`status`,`position`);--> statement-breakpoint
-- The order lists had until now, newest change first, becomes the starting order (#21).
UPDATE `watchlist` SET `position` = -`updated_at`;
