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
