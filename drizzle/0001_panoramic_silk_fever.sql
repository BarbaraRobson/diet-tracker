CREATE TABLE `meal_details` (
	`meal_id` text PRIMARY KEY NOT NULL,
	`components` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade
);
