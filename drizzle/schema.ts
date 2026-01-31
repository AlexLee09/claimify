import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Departments with their petty cash float
 */
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  floatAmount: decimal("floatAmount", { precision: 10, scale: 2 }).notNull().default("3500.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

/**
 * Staff members who can submit claims
 */
export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  departmentId: int("departmentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;

/**
 * Expense categories as defined in the specification
 */
export const expenseCategories = [
  "Port and Terminal Operations",
  "Transport and Vehicle",
  "Business Meals",
  "Hardware and Operational Supplies",
  "Contractor and Pass Fees",
  "Fees",
  "Business Travel and Petty Cash",
  "Other"
] as const;

export type ExpenseCategory = typeof expenseCategories[number];

/**
 * Receipt status lifecycle
 */
export const receiptStatuses = [
  "submitted",
  "admin_approved",
  "hod_approved",
  "paid",
  "rejected"
] as const;

export type ReceiptStatus = typeof receiptStatuses[number];

/**
 * Batches for grouping receipts for top-up requests
 */
export const batches = mysqlTable("batches", {
  id: int("id").autoincrement().primaryKey(),
  departmentId: int("departmentId").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalGst: decimal("totalGst", { precision: 10, scale: 2 }).notNull().default("0.00"),
  status: mysqlEnum("status", ["pending_hod", "pending_finance", "approved", "paid", "rejected"]).notNull().default("pending_hod"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  hodApprovedAt: timestamp("hodApprovedAt"),
  financeApprovedAt: timestamp("financeApprovedAt"),
  paidAt: timestamp("paidAt"),
});

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = typeof batches.$inferInsert;

/**
 * Receipts - the core data model
 */
export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Image storage
  imageUrl: text("imageUrl").notNull(),
  imageKey: varchar("imageKey", { length: 255 }).notNull(),
  
  // Staff and department info
  staffId: int("staffId").notNull(),
  staffName: varchar("staffName", { length: 100 }).notNull(),
  departmentId: int("departmentId").notNull(),
  departmentName: varchar("departmentName", { length: 100 }).notNull(),
  
  // AI extracted fields
  merchantName: varchar("merchantName", { length: 255 }),
  transactionDate: timestamp("transactionDate"),
  amountTotal: decimal("amountTotal", { precision: 10, scale: 2 }),
  amountGst: decimal("amountGst", { precision: 10, scale: 2 }),
  
  // Classification
  category: mysqlEnum("category", [
    "Port and Terminal Operations",
    "Transport and Vehicle",
    "Business Meals",
    "Hardware and Operational Supplies",
    "Contractor and Pass Fees",
    "Fees",
    "Business Travel and Petty Cash",
    "Other"
  ]),
  
  // User input
  projectCode: varchar("projectCode", { length: 255 }),
  
  // AI metadata
  aiConfidence: int("aiConfidence"),
  aiReasoning: text("aiReasoning"),
  aiFlags: json("aiFlags").$type<string[]>(),
  
  // Status and workflow
  status: mysqlEnum("status", ["submitted", "admin_approved", "hod_approved", "paid", "rejected"]).notNull().default("submitted"),
  batchId: int("batchId"),
  
  // Rejection info
  rejectedBy: varchar("rejectedBy", { length: 50 }),
  rejectionReason: text("rejectionReason"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  adminApprovedAt: timestamp("adminApprovedAt"),
  hodApprovedAt: timestamp("hodApprovedAt"),
  paidAt: timestamp("paidAt"),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;
