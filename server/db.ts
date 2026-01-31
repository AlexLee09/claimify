import { eq, and, inArray, sql, desc, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  departments, InsertDepartment, Department,
  staff, InsertStaff, Staff,
  receipts, InsertReceipt, Receipt,
  batches, InsertBatch, Batch,
  ReceiptStatus
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER HELPERS ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ DEPARTMENT HELPERS ============
export async function getAllDepartments(): Promise<Department[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departments).orderBy(departments.name);
}

export async function getDepartmentById(id: number): Promise<Department | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
  return result[0];
}

export async function createDepartment(data: InsertDepartment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(departments).values(data);
  return Number(result[0].insertId);
}

export async function getOrCreateDepartment(name: string): Promise<Department> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(departments).where(eq(departments.name, name)).limit(1);
  if (existing[0]) return existing[0];
  
  await db.insert(departments).values({ name });
  const created = await db.select().from(departments).where(eq(departments.name, name)).limit(1);
  return created[0]!;
}

// ============ STAFF HELPERS ============
export async function getStaffByDepartment(departmentId: number): Promise<Staff[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(staff).where(eq(staff.departmentId, departmentId)).orderBy(staff.name);
}

export async function getOrCreateStaff(name: string, departmentId: number): Promise<Staff> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(staff)
    .where(and(eq(staff.name, name), eq(staff.departmentId, departmentId)))
    .limit(1);
  if (existing[0]) return existing[0];
  
  await db.insert(staff).values({ name, departmentId });
  const created = await db.select().from(staff)
    .where(and(eq(staff.name, name), eq(staff.departmentId, departmentId)))
    .limit(1);
  return created[0]!;
}

// ============ RECEIPT HELPERS ============
export async function createReceipt(data: InsertReceipt): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(receipts).values(data);
  return Number(result[0].insertId);
}

export async function getReceiptById(id: number): Promise<Receipt | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(receipts).where(eq(receipts.id, id)).limit(1);
  return result[0];
}

export async function getReceiptsByDepartment(departmentId: number, status?: ReceiptStatus): Promise<Receipt[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (status) {
    return db.select().from(receipts)
      .where(and(eq(receipts.departmentId, departmentId), eq(receipts.status, status)))
      .orderBy(desc(receipts.createdAt));
  }
  
  return db.select().from(receipts)
    .where(eq(receipts.departmentId, departmentId))
    .orderBy(desc(receipts.createdAt));
}

export async function getReceiptsByStaff(staffId: number): Promise<Receipt[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(receipts)
    .where(eq(receipts.staffId, staffId))
    .orderBy(desc(receipts.createdAt));
}

export async function getSubmittedReceipts(departmentId: number): Promise<Receipt[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(receipts)
    .where(and(
      eq(receipts.departmentId, departmentId),
      eq(receipts.status, "submitted")
    ))
    .orderBy(desc(receipts.createdAt));
}

export async function getAdminApprovedReceipts(departmentId: number): Promise<Receipt[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(receipts)
    .where(and(
      eq(receipts.departmentId, departmentId),
      eq(receipts.status, "admin_approved"),
      isNull(receipts.batchId)
    ))
    .orderBy(desc(receipts.createdAt));
}

export async function updateReceiptStatus(
  id: number, 
  status: ReceiptStatus, 
  additionalData?: Partial<Receipt>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { status, ...additionalData };
  
  if (status === "admin_approved") {
    updateData.adminApprovedAt = new Date();
  } else if (status === "hod_approved") {
    updateData.hodApprovedAt = new Date();
  } else if (status === "paid") {
    updateData.paidAt = new Date();
  }
  
  await db.update(receipts).set(updateData).where(eq(receipts.id, id));
}

export async function rejectReceipt(
  id: number, 
  rejectedBy: string, 
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(receipts).set({
    status: "rejected",
    rejectedBy,
    rejectionReason: reason,
    batchId: null
  }).where(eq(receipts.id, id));
}

export async function assignReceiptsToBatch(receiptIds: number[], batchId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(receipts)
    .set({ batchId, status: "admin_approved" })
    .where(inArray(receipts.id, receiptIds));
}

// ============ BATCH HELPERS ============
export async function createBatch(departmentId: number, receiptIds: number[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get receipts to calculate totals
  const receiptList = await db.select().from(receipts).where(inArray(receipts.id, receiptIds));
  
  let totalAmount = 0;
  let totalGst = 0;
  
  for (const r of receiptList) {
    totalAmount += parseFloat(r.amountTotal?.toString() || "0");
    totalGst += parseFloat(r.amountGst?.toString() || "0");
  }
  
  const result = await db.insert(batches).values({
    departmentId,
    totalAmount: totalAmount.toFixed(2),
    totalGst: totalGst.toFixed(2),
    status: "pending_hod"
  });
  
  const batchId = Number(result[0].insertId);
  
  // Assign receipts to batch
  await db.update(receipts)
    .set({ batchId })
    .where(inArray(receipts.id, receiptIds));
  
  return batchId;
}

export async function getBatchById(id: number): Promise<Batch | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
  return result[0];
}

export async function getBatchesByDepartment(departmentId: number): Promise<Batch[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batches)
    .where(eq(batches.departmentId, departmentId))
    .orderBy(desc(batches.createdAt));
}

export async function getPendingHodBatches(departmentId: number): Promise<Batch[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batches)
    .where(and(
      eq(batches.departmentId, departmentId),
      eq(batches.status, "pending_hod")
    ))
    .orderBy(desc(batches.createdAt));
}

export async function getPendingFinanceBatches(): Promise<(Batch & { departmentName: string })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: batches.id,
    departmentId: batches.departmentId,
    totalAmount: batches.totalAmount,
    totalGst: batches.totalGst,
    status: batches.status,
    createdAt: batches.createdAt,
    updatedAt: batches.updatedAt,
    hodApprovedAt: batches.hodApprovedAt,
    financeApprovedAt: batches.financeApprovedAt,
    paidAt: batches.paidAt,
    departmentName: departments.name
  })
    .from(batches)
    .innerJoin(departments, eq(batches.departmentId, departments.id))
    .where(eq(batches.status, "pending_finance"))
    .orderBy(desc(batches.createdAt));
  
  return result;
}

export async function getReceiptsByBatch(batchId: number): Promise<Receipt[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(receipts)
    .where(eq(receipts.batchId, batchId))
    .orderBy(receipts.category, receipts.createdAt);
}

export async function updateBatchStatus(
  id: number, 
  status: Batch["status"],
  additionalData?: Partial<Batch>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { status, ...additionalData };
  
  if (status === "pending_finance") {
    updateData.hodApprovedAt = new Date();
  } else if (status === "approved") {
    updateData.financeApprovedAt = new Date();
  } else if (status === "paid") {
    updateData.paidAt = new Date();
  }
  
  await db.update(batches).set(updateData).where(eq(batches.id, id));
}

export async function recalculateBatchTotals(batchId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const receiptList = await db.select().from(receipts)
    .where(and(
      eq(receipts.batchId, batchId),
      eq(receipts.status, "admin_approved")
    ));
  
  let totalAmount = 0;
  let totalGst = 0;
  
  for (const r of receiptList) {
    totalAmount += parseFloat(r.amountTotal?.toString() || "0");
    totalGst += parseFloat(r.amountGst?.toString() || "0");
  }
  
  await db.update(batches).set({
    totalAmount: totalAmount.toFixed(2),
    totalGst: totalGst.toFixed(2)
  }).where(eq(batches.id, batchId));
}

// ============ FLOAT CALCULATION ============
export async function calculateDepartmentFloat(departmentId: number): Promise<{
  totalFloat: number;
  usedFloat: number;
  remainingFloat: number;
}> {
  const db = await getDb();
  if (!db) return { totalFloat: 3500, usedFloat: 0, remainingFloat: 3500 };
  
  const dept = await getDepartmentById(departmentId);
  const totalFloat = parseFloat(dept?.floatAmount?.toString() || "3500");
  
  // Calculate used float: sum of admin_approved receipts not yet paid
  const approvedReceipts = await db.select().from(receipts)
    .where(and(
      eq(receipts.departmentId, departmentId),
      inArray(receipts.status, ["admin_approved", "hod_approved"])
    ));
  
  let usedFloat = 0;
  for (const r of approvedReceipts) {
    usedFloat += parseFloat(r.amountTotal?.toString() || "0");
  }
  
  return {
    totalFloat,
    usedFloat,
    remainingFloat: totalFloat - usedFloat
  };
}

// ============ SEED DATA ============
export async function seedInitialData(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Check if departments exist
  const existingDepts = await db.select().from(departments);
  if (existingDepts.length > 0) return;
  
  // Create default departments
  const defaultDepartments = [
    "Logistics",
    "Warehousing",
    "Transport",
    "Operations",
    "Administration"
  ];
  
  for (const name of defaultDepartments) {
    await db.insert(departments).values({ name, floatAmount: "3500.00" });
  }
  
  console.log("[Database] Seeded initial departments");
}


// ============ ACTIVITY LOG HELPERS ============
import { activityLogs, InsertActivityLog, ActivityLog } from "../drizzle/schema";

export async function createActivityLog(data: InsertActivityLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(activityLogs).values(data);
  return Number(result[0].insertId);
}

export async function getActivityLogsByDepartment(departmentId: number, limit = 50): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs)
    .where(eq(activityLogs.departmentId, departmentId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

export async function getActivityLogsByEntity(entityType: "receipt" | "batch" | "department", entityId: number): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs)
    .where(and(
      eq(activityLogs.entityType, entityType),
      eq(activityLogs.entityId, entityId)
    ))
    .orderBy(desc(activityLogs.createdAt));
}

export async function logReceiptAction(
  receiptId: number,
  departmentId: number,
  action: InsertActivityLog["action"],
  actorRole: InsertActivityLog["actorRole"],
  description: string,
  actorName?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createActivityLog({
    entityType: "receipt",
    entityId: receiptId,
    departmentId,
    action,
    actorRole,
    actorName,
    description,
    metadata
  });
}

export async function logBatchAction(
  batchId: number,
  departmentId: number,
  action: InsertActivityLog["action"],
  actorRole: InsertActivityLog["actorRole"],
  description: string,
  actorName?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createActivityLog({
    entityType: "batch",
    entityId: batchId,
    departmentId,
    action,
    actorRole,
    actorName,
    description,
    metadata
  });
}


// ============ ANALYTICS HELPERS ============
export interface AnalyticsData {
  summary: {
    totalReceipts: number;
    totalAmount: number;
    totalGst: number;
    averageAmount: number;
    approvalRate: number;
    rejectionRate: number;
  };
  byCategory: Array<{
    category: string;
    count: number;
    totalAmount: number;
    averageAmount: number;
    percentage: number;
  }>;
  byDepartment: Array<{
    department: string;
    count: number;
    totalAmount: number;
    averageAmount: number;
  }>;
  byStaff: Array<{
    staffName: string;
    department: string;
    count: number;
    totalAmount: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    totalAmount: number;
  }>;
  topMerchants: Array<{
    merchant: string;
    count: number;
    totalAmount: number;
  }>;
  anomalies: Array<{
    type: string;
    description: string;
    severity: "low" | "medium" | "high";
    details: Record<string, any>;
  }>;
  trends: {
    dailySpending: Array<{
      date: string;
      amount: number;
      count: number;
    }>;
    categoryTrend: Array<{
      category: string;
      trend: "increasing" | "stable" | "decreasing";
      changePercent: number;
    }>;
  };
  flaggedReceipts: Array<{
    id: number;
    merchant: string;
    amount: number;
    flags: string[];
    staffName: string;
  }>;
}

export async function getAnalyticsData(departmentId?: number): Promise<AnalyticsData> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  // Get all receipts (optionally filtered by department)
  let allReceipts;
  if (departmentId) {
    allReceipts = await db.select().from(receipts).where(eq(receipts.departmentId, departmentId));
  } else {
    allReceipts = await db.select().from(receipts);
  }
  
  // Calculate summary stats
  const totalReceipts = allReceipts.length;
  const totalAmount = allReceipts.reduce((sum, r) => sum + parseFloat(r.amountTotal || "0"), 0);
  const totalGst = allReceipts.reduce((sum, r) => sum + parseFloat(r.amountGst || "0"), 0);
  const averageAmount = totalReceipts > 0 ? totalAmount / totalReceipts : 0;
  
  const paidReceipts = allReceipts.filter(r => r.status === "paid" || r.status === "hod_approved");
  const rejectedReceipts = allReceipts.filter(r => r.status === "rejected");
  const approvalRate = totalReceipts > 0 ? (paidReceipts.length / totalReceipts) * 100 : 0;
  const rejectionRate = totalReceipts > 0 ? (rejectedReceipts.length / totalReceipts) * 100 : 0;
  
  // Group by category
  const categoryMap = new Map<string, { count: number; total: number }>();
  for (const r of allReceipts) {
    const cat = r.category || "Other";
    const existing = categoryMap.get(cat) || { count: 0, total: 0 };
    categoryMap.set(cat, {
      count: existing.count + 1,
      total: existing.total + parseFloat(r.amountTotal || "0")
    });
  }
  const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    totalAmount: data.total,
    averageAmount: data.count > 0 ? data.total / data.count : 0,
    percentage: totalReceipts > 0 ? (data.count / totalReceipts) * 100 : 0
  })).sort((a, b) => b.totalAmount - a.totalAmount);
  
  // Group by department
  const deptMap = new Map<string, { count: number; total: number }>();
  for (const r of allReceipts) {
    const dept = r.departmentName || "Unknown";
    const existing = deptMap.get(dept) || { count: 0, total: 0 };
    deptMap.set(dept, {
      count: existing.count + 1,
      total: existing.total + parseFloat(r.amountTotal || "0")
    });
  }
  const byDepartment = Array.from(deptMap.entries()).map(([department, data]) => ({
    department,
    count: data.count,
    totalAmount: data.total,
    averageAmount: data.count > 0 ? data.total / data.count : 0
  })).sort((a, b) => b.totalAmount - a.totalAmount);
  
  // Group by staff
  const staffMap = new Map<string, { count: number; total: number; department: string }>();
  for (const r of allReceipts) {
    const name = r.staffName || "Unknown";
    const existing = staffMap.get(name) || { count: 0, total: 0, department: r.departmentName || "Unknown" };
    staffMap.set(name, {
      count: existing.count + 1,
      total: existing.total + parseFloat(r.amountTotal || "0"),
      department: existing.department
    });
  }
  const byStaff = Array.from(staffMap.entries()).map(([staffName, data]) => ({
    staffName,
    department: data.department,
    count: data.count,
    totalAmount: data.total
  })).sort((a, b) => b.totalAmount - a.totalAmount);
  
  // Group by status
  const statusMap = new Map<string, { count: number; total: number }>();
  for (const r of allReceipts) {
    const status = r.status || "unknown";
    const existing = statusMap.get(status) || { count: 0, total: 0 };
    statusMap.set(status, {
      count: existing.count + 1,
      total: existing.total + parseFloat(r.amountTotal || "0")
    });
  }
  const byStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
    status,
    count: data.count,
    totalAmount: data.total
  }));
  
  // Top merchants
  const merchantMap = new Map<string, { count: number; total: number }>();
  for (const r of allReceipts) {
    const merchant = r.merchantName || "Unknown";
    const existing = merchantMap.get(merchant) || { count: 0, total: 0 };
    merchantMap.set(merchant, {
      count: existing.count + 1,
      total: existing.total + parseFloat(r.amountTotal || "0")
    });
  }
  const topMerchants = Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      count: data.count,
      totalAmount: data.total
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);
  
  // Detect anomalies
  const anomalies: AnalyticsData["anomalies"] = [];
  
  // High value receipts (> $200)
  const highValueReceipts = allReceipts.filter(r => parseFloat(r.amountTotal || "0") > 200);
  if (highValueReceipts.length > 0) {
    anomalies.push({
      type: "high_value_transactions",
      description: `${highValueReceipts.length} receipts exceed $200 threshold`,
      severity: highValueReceipts.length > 5 ? "high" : "medium",
      details: { count: highValueReceipts.length, receipts: highValueReceipts.slice(0, 5).map(r => ({ id: r.id, merchant: r.merchantName, amount: r.amountTotal })) }
    });
  }
  
  // Flagged receipts
  const flaggedReceipts = allReceipts.filter(r => {
    const flags = r.aiFlags as string[] | null;
    return flags && flags.length > 0;
  });
  if (flaggedReceipts.length > 0) {
    anomalies.push({
      type: "ai_flagged_receipts",
      description: `${flaggedReceipts.length} receipts have AI-detected policy concerns`,
      severity: flaggedReceipts.length > 10 ? "high" : "medium",
      details: { count: flaggedReceipts.length }
    });
  }
  
  // Staff with unusually high spending
  const avgStaffSpending = byStaff.length > 0 ? byStaff.reduce((sum, s) => sum + s.totalAmount, 0) / byStaff.length : 0;
  const highSpenders = byStaff.filter(s => s.totalAmount > avgStaffSpending * 2);
  if (highSpenders.length > 0) {
    anomalies.push({
      type: "high_spending_staff",
      description: `${highSpenders.length} staff members have spending 2x above average`,
      severity: "medium",
      details: { avgSpending: avgStaffSpending, highSpenders: highSpenders.slice(0, 3) }
    });
  }
  
  // Calculate daily spending trends
  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const r of allReceipts) {
    if (r.transactionDate) {
      const dateStr = new Date(r.transactionDate).toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr) || { amount: 0, count: 0 };
      dailyMap.set(dateStr, {
        amount: existing.amount + parseFloat(r.amountTotal || "0"),
        count: existing.count + 1
      });
    }
  }
  const dailySpending = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, amount: data.amount, count: data.count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Category trends (simplified - just mark as stable for now)
  const categoryTrend = byCategory.map(c => ({
    category: c.category,
    trend: "stable" as const,
    changePercent: 0
  }));
  
  // Get flagged receipt details
  const flaggedReceiptDetails = flaggedReceipts.slice(0, 10).map(r => ({
    id: r.id,
    merchant: r.merchantName || "Unknown",
    amount: parseFloat(r.amountTotal || "0"),
    flags: (r.aiFlags as string[]) || [],
    staffName: r.staffName
  }));
  
  return {
    summary: {
      totalReceipts,
      totalAmount,
      totalGst,
      averageAmount,
      approvalRate,
      rejectionRate
    },
    byCategory,
    byDepartment,
    byStaff,
    byStatus,
    topMerchants,
    anomalies,
    trends: {
      dailySpending,
      categoryTrend
    },
    flaggedReceipts: flaggedReceiptDetails
  };
}
