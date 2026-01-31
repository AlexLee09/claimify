import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { extractReceiptData } from "./gemini";
import { expenseCategories, receiptStatuses } from "../drizzle/schema";
import * as db from "./db";

// ============ DEPARTMENT ROUTER ============
const departmentRouter = router({
  list: publicProcedure.query(async () => {
    return db.getAllDepartments();
  }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getDepartmentById(input.id);
    }),
  
  getOrCreate: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      return db.getOrCreateDepartment(input.name);
    }),
  
  getFloat: publicProcedure
    .input(z.object({ departmentId: z.number() }))
    .query(async ({ input }) => {
      return db.calculateDepartmentFloat(input.departmentId);
    }),
});

// ============ STAFF ROUTER ============
const staffRouter = router({
  listByDepartment: publicProcedure
    .input(z.object({ departmentId: z.number() }))
    .query(async ({ input }) => {
      return db.getStaffByDepartment(input.departmentId);
    }),
  
  getOrCreate: publicProcedure
    .input(z.object({ name: z.string(), departmentId: z.number() }))
    .mutation(async ({ input }) => {
      return db.getOrCreateStaff(input.name, input.departmentId);
    }),
});

// ============ RECEIPT ROUTER ============
const receiptRouter = router({
  // Upload image and extract data with AI
  uploadAndExtract: publicProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.string(),
      staffId: z.number(),
      staffName: z.string(),
      departmentId: z.number(),
      departmentName: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Generate unique file key
      const extension = input.mimeType.split("/")[1] || "jpg";
      const fileKey = `receipts/${input.departmentId}/${nanoid()}.${extension}`;
      
      // Convert base64 to buffer and upload to S3
      const buffer = Buffer.from(input.imageBase64, "base64");
      const { url: imageUrl } = await storagePut(fileKey, buffer, input.mimeType);
      
      // Extract data using Gemini AI
      const extraction = await extractReceiptData(imageUrl);
      
      return {
        imageUrl,
        imageKey: fileKey,
        extraction,
      };
    }),
  
  // Create receipt after user verification
  create: publicProcedure
    .input(z.object({
      imageUrl: z.string(),
      imageKey: z.string(),
      staffId: z.number(),
      staffName: z.string(),
      departmentId: z.number(),
      departmentName: z.string(),
      merchantName: z.string().nullable(),
      transactionDate: z.string().nullable(),
      amountTotal: z.number().nullable(),
      amountGst: z.number().nullable(),
      category: z.enum(expenseCategories),
      projectCode: z.string().nullable(),
      aiConfidence: z.number(),
      aiReasoning: z.string(),
      aiFlags: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const receiptId = await db.createReceipt({
        imageUrl: input.imageUrl,
        imageKey: input.imageKey,
        staffId: input.staffId,
        staffName: input.staffName,
        departmentId: input.departmentId,
        departmentName: input.departmentName,
        merchantName: input.merchantName,
        transactionDate: input.transactionDate ? new Date(input.transactionDate) : null,
        amountTotal: input.amountTotal?.toFixed(2) ?? null,
        amountGst: input.amountGst?.toFixed(2) ?? null,
        category: input.category,
        projectCode: input.projectCode,
        aiConfidence: input.aiConfidence,
        aiReasoning: input.aiReasoning,
        aiFlags: input.aiFlags,
        status: "submitted",
      });
      
      return { id: receiptId };
    }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getReceiptById(input.id);
    }),
  
  listByDepartment: publicProcedure
    .input(z.object({ 
      departmentId: z.number(),
      status: z.enum(receiptStatuses).optional()
    }))
    .query(async ({ input }) => {
      return db.getReceiptsByDepartment(input.departmentId, input.status);
    }),
  
  listByStaff: publicProcedure
    .input(z.object({ staffId: z.number() }))
    .query(async ({ input }) => {
      return db.getReceiptsByStaff(input.staffId);
    }),
  
  // Get submitted receipts for admin review
  getSubmitted: publicProcedure
    .input(z.object({ departmentId: z.number() }))
    .query(async ({ input }) => {
      return db.getSubmittedReceipts(input.departmentId);
    }),
  
  // Get admin approved receipts ready for batching
  getAdminApproved: publicProcedure
    .input(z.object({ departmentId: z.number() }))
    .query(async ({ input }) => {
      return db.getAdminApprovedReceipts(input.departmentId);
    }),
  
  // Admin approve receipt
  adminApprove: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateReceiptStatus(input.id, "admin_approved");
      return { success: true };
    }),
  
  // Reject receipt
  reject: publicProcedure
    .input(z.object({
      id: z.number(),
      rejectedBy: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ input }) => {
      await db.rejectReceipt(input.id, input.rejectedBy, input.reason);
      return { success: true };
    }),
});

// ============ BATCH ROUTER ============
const batchRouter = router({
  // Create batch from approved receipts
  create: publicProcedure
    .input(z.object({
      departmentId: z.number(),
      receiptIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const batchId = await db.createBatch(input.departmentId, input.receiptIds);
      return { id: batchId };
    }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const batch = await db.getBatchById(input.id);
      if (!batch) return null;
      
      const receipts = await db.getReceiptsByBatch(input.id);
      return { ...batch, receipts };
    }),
  
  listByDepartment: publicProcedure
    .input(z.object({ departmentId: z.number() }))
    .query(async ({ input }) => {
      return db.getBatchesByDepartment(input.departmentId);
    }),
  
  // Get pending HOD approval batches
  getPendingHod: publicProcedure
    .input(z.object({ departmentId: z.number() }))
    .query(async ({ input }) => {
      const batches = await db.getPendingHodBatches(input.departmentId);
      const result = [];
      
      for (const batch of batches) {
        const receipts = await db.getReceiptsByBatch(batch.id);
        result.push({ ...batch, receipts });
      }
      
      return result;
    }),
  
  // Get pending finance approval batches (all departments)
  getPendingFinance: publicProcedure.query(async () => {
    const batches = await db.getPendingFinanceBatches();
    const result = [];
    
    for (const batch of batches) {
      const receipts = await db.getReceiptsByBatch(batch.id);
      result.push({ ...batch, receipts });
    }
    
    return result;
  }),
  
  // HOD approve batch (with optional line-item rejections)
  hodApprove: publicProcedure
    .input(z.object({
      batchId: z.number(),
      rejectedReceiptIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      // Reject specified receipts
      if (input.rejectedReceiptIds && input.rejectedReceiptIds.length > 0) {
        for (const receiptId of input.rejectedReceiptIds) {
          await db.rejectReceipt(receiptId, "HOD", "Rejected during batch approval");
        }
      }
      
      // Recalculate batch totals after rejections
      await db.recalculateBatchTotals(input.batchId);
      
      // Update remaining receipts to hod_approved
      const receipts = await db.getReceiptsByBatch(input.batchId);
      for (const receipt of receipts) {
        if (receipt.status === "admin_approved") {
          await db.updateReceiptStatus(receipt.id, "hod_approved");
        }
      }
      
      // Update batch status
      await db.updateBatchStatus(input.batchId, "pending_finance");
      
      return { success: true };
    }),
  
  // Finance approve and disburse
  financeApprove: publicProcedure
    .input(z.object({ batchId: z.number() }))
    .mutation(async ({ input }) => {
      // Update all receipts to paid
      const receipts = await db.getReceiptsByBatch(input.batchId);
      for (const receipt of receipts) {
        if (receipt.status === "hod_approved") {
          await db.updateReceiptStatus(receipt.id, "paid");
        }
      }
      
      // Update batch status to paid
      await db.updateBatchStatus(input.batchId, "paid");
      
      return { success: true };
    }),
});

// ============ SEED ROUTER ============
const seedRouter = router({
  init: publicProcedure.mutation(async () => {
    await db.seedInitialData();
    return { success: true };
  }),
});

// ============ MAIN APP ROUTER ============
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  
  department: departmentRouter,
  staff: staffRouter,
  receipt: receiptRouter,
  batch: batchRouter,
  seed: seedRouter,
});

export type AppRouter = typeof appRouter;
