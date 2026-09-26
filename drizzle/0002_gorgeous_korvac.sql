CREATE TABLE `daily_starters` (
	`user_id` text NOT NULL,
	`meal_date` text NOT NULL,
	`meal_id` text,
	PRIMARY KEY(`user_id`, `meal_date`)
);
