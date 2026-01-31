CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('receipt','batch','department') NOT NULL,
	`entityId` int NOT NULL,
	`actorRole` enum('staff','admin','hod','finance') NOT NULL,
	`actorName` varchar(100),
	`action` enum('submitted','admin_approved','admin_rejected','batch_created','hod_approved','hod_partial_approved','hod_rejected','finance_approved','finance_rejected','paid') NOT NULL,
	`description` text NOT NULL,
	`metadata` json,
	`departmentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
