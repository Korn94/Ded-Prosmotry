CREATE TABLE `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`ok_group_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `communities_ok_group_id_unique` ON `communities` (`ok_group_id`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`pass_id` text NOT NULL,
	`video_id` text NOT NULL,
	`views` integer NOT NULL,
	`subscribers` integer,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`pass_id`) REFERENCES `passes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `passes` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`video_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscribers_history` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`pass_id` text,
	`date` text NOT NULL,
	`subscribers` integer NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pass_id`) REFERENCES `passes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`community_id` text,
	`content_id` text,
	`added_at` text NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `views_history` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`pass_id` text,
	`date` text NOT NULL,
	`views` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pass_id`) REFERENCES `passes`(`id`) ON UPDATE no action ON DELETE set null
);
