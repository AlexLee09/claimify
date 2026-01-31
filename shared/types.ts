/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Expense categories
export const EXPENSE_CATEGORIES = [
  "Port and Terminal Operations",
  "Transport and Vehicle",
  "Business Meals",
  "Hardware and Operational Supplies",
  "Contractor and Pass Fees",
  "Fees",
  "Business Travel and Petty Cash",
  "Other"
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// Receipt statuses
export const RECEIPT_STATUSES = [
  "submitted",
  "admin_approved",
  "hod_approved",
  "paid",
  "rejected"
] as const;

export type ReceiptStatus = typeof RECEIPT_STATUSES[number];

// Batch statuses
export const BATCH_STATUSES = [
  "pending_hod",
  "pending_finance",
  "approved",
  "paid",
  "rejected"
] as const;

export type BatchStatus = typeof BATCH_STATUSES[number];

// Persona types
export const PERSONAS = [
  "staff",
  "admin",
  "hod",
  "finance"
] as const;

export type Persona = typeof PERSONAS[number];

// Default departments
export const DEFAULT_DEPARTMENTS = [
  "Logistics",
  "Warehousing",
  "Transport",
  "Operations",
  "Administration"
] as const;

// Float amount
export const FLOAT_AMOUNT = 3500;

// Status display helpers
export const STATUS_LABELS: Record<ReceiptStatus, string> = {
  submitted: "Pending Review",
  admin_approved: "Admin Approved",
  hod_approved: "HOD Approved",
  paid: "Paid",
  rejected: "Rejected"
};

export const STATUS_COLORS: Record<ReceiptStatus, string> = {
  submitted: "bg-yellow-100 text-yellow-800",
  admin_approved: "bg-blue-100 text-blue-800",
  hod_approved: "bg-purple-100 text-purple-800",
  paid: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800"
};

// Category colors for visualization
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  "Port and Terminal Operations": "#3B82F6",
  "Transport and Vehicle": "#10B981",
  "Business Meals": "#F59E0B",
  "Hardware and Operational Supplies": "#8B5CF6",
  "Contractor and Pass Fees": "#EC4899",
  "Fees": "#6366F1",
  "Business Travel and Petty Cash": "#14B8A6",
  "Other": "#6B7280"
};
