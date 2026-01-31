CREATE TABLE `batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`totalAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalGst` decimal(10,2) NOT NULL DEFAULT '0.00',
	`status` enum('pending_hod','pending_finance','approved','paid','rejected') NOT NULL DEFAULT 'pending_hod',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`hodApprovedAt` timestamp,
	`financeApprovedAt` timestamp,
	`paidAt` timestamp,
	CONSTRAINT `batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`floatAmount` decimal(10,2) NOT NULL DEFAULT '3500.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`staffId` int NOT NULL,
	`staffName` varchar(100) NOT NULL,
	`departmentId` int NOT NULL,
	`departmentName` varchar(100) NOT NULL,
	`merchantName` varchar(255),
	`transactionDate` timestamp,
	`amountTotal` decimal(10,2),
	`amountGst` decimal(10,2),
	`category` enum('Port and Terminal Operations','Transport and Vehicle','Business Meals','Hardware and Operational Supplies','Contractor and Pass Fees','Fees','Business Travel and Petty Cash','Other'),
	`projectCode` varchar(255),
	`aiConfidence` int,
	`aiReasoning` text,
	`aiFlags` json,
	`status` enum('submitted','admin_approved','hod_approved','paid','rejected') NOT NULL DEFAULT 'submitted',
	`batchId` int,
	`rejectedBy` varchar(50),
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`adminApprovedAt` timestamp,
	`hodApprovedAt` timestamp,
	`paidAt` timestamp,
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`departmentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_id` PRIMARY KEY(`id`)
);
