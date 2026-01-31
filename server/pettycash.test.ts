import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getAllDepartments: vi.fn().mockResolvedValue([
    { id: 1, name: "Logistics", floatAmount: "3500.00", createdAt: new Date() },
    { id: 2, name: "Warehousing", floatAmount: "3500.00", createdAt: new Date() },
  ]),
  getDepartmentById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Logistics",
    floatAmount: "3500.00",
    createdAt: new Date(),
  }),
  getOrCreateDepartment: vi.fn().mockResolvedValue({
    id: 1,
    name: "Logistics",
    floatAmount: "3500.00",
    createdAt: new Date(),
  }),
  calculateDepartmentFloat: vi.fn().mockResolvedValue({
    totalFloat: 3500,
    usedFloat: 250.50,
    remainingFloat: 3249.50,
    pendingAmount: 0,
  }),
  getStaffByDepartment: vi.fn().mockResolvedValue([
    { id: 1, name: "John Tan", departmentId: 1, createdAt: new Date() },
    { id: 2, name: "Mary Lim", departmentId: 1, createdAt: new Date() },
  ]),
  getOrCreateStaff: vi.fn().mockResolvedValue({
    id: 1,
    name: "John Tan",
    departmentId: 1,
    createdAt: new Date(),
  }),
  getReceiptsByDepartment: vi.fn().mockResolvedValue([
    {
      id: 1,
      staffName: "John Tan",
      merchantName: "Shell Station",
      amountTotal: "45.00",
      amountGst: "3.93",
      category: "Transport and Vehicle",
      status: "submitted",
      aiConfidence: 95,
      aiFlags: [],
      createdAt: new Date(),
    },
  ]),
  getSubmittedReceipts: vi.fn().mockResolvedValue([
    {
      id: 1,
      staffName: "John Tan",
      merchantName: "Shell Station",
      amountTotal: "45.00",
      amountGst: "3.93",
      category: "Transport and Vehicle",
      status: "submitted",
      aiConfidence: 95,
      aiFlags: [],
      createdAt: new Date(),
    },
  ]),
  getAdminApprovedReceipts: vi.fn().mockResolvedValue([]),
  updateReceiptStatus: vi.fn().mockResolvedValue(undefined),
  rejectReceipt: vi.fn().mockResolvedValue(undefined),
  createBatch: vi.fn().mockResolvedValue(1),
  getBatchesByDepartment: vi.fn().mockResolvedValue([]),
  getPendingHodBatches: vi.fn().mockResolvedValue([]),
  getPendingFinanceBatches: vi.fn().mockResolvedValue([]),
  getReceiptsByBatch: vi.fn().mockResolvedValue([]),
  seedInitialData: vi.fn().mockResolvedValue(undefined),
}));

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Department Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all departments", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.department.list();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Logistics");
    expect(result[1].name).toBe("Warehousing");
  });

  it("should get department by id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.department.getById({ id: 1 });

    expect(result).toBeDefined();
    expect(result?.name).toBe("Logistics");
  });

  it("should calculate department float correctly", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.department.getFloat({ departmentId: 1 });

    expect(result.totalFloat).toBe(3500);
    expect(result.usedFloat).toBe(250.50);
    expect(result.remainingFloat).toBe(3249.50);
  });
});

describe("Staff Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list staff by department", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.staff.listByDepartment({ departmentId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("John Tan");
  });

  it("should get or create staff member", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.staff.getOrCreate({
      name: "John Tan",
      departmentId: 1,
    });

    expect(result.name).toBe("John Tan");
    expect(result.departmentId).toBe(1);
  });
});

describe("Receipt Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get submitted receipts for admin review", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.receipt.getSubmitted({ departmentId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("submitted");
    expect(result[0].merchantName).toBe("Shell Station");
  });

  it("should list receipts by department", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.receipt.listByDepartment({ departmentId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Transport and Vehicle");
  });

  it("should approve receipt and update status", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.receipt.adminApprove({ id: 1 });

    expect(result.success).toBe(true);
  });

  it("should reject receipt with reason", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.receipt.reject({
      id: 1,
      rejectedBy: "Admin",
      reason: "Missing business purpose",
    });

    expect(result.success).toBe(true);
  });
});

describe("Batch Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create batch from approved receipts", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.batch.create({
      departmentId: 1,
      receiptIds: [1, 2, 3],
    });

    expect(result.id).toBe(1);
  });

  it("should get pending HOD batches", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.batch.getPendingHod({ departmentId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get pending finance batches", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.batch.getPendingFinance();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Seed Router", () => {
  it("should seed initial data", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.seed.init();

    expect(result.success).toBe(true);
  });
});
