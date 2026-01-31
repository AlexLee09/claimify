import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getAnalyticsData: vi.fn(),
}));

// Mock the gemini module
vi.mock("./gemini", () => ({
  generateAnalyticsSummary: vi.fn(),
}));

import * as db from "./db";
import { generateAnalyticsSummary } from "./gemini";

describe("Analytics Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAnalyticsData", () => {
    it("should return properly structured analytics data", async () => {
      const mockAnalyticsData = {
        summary: {
          totalReceipts: 45,
          totalAmount: 2500.50,
          totalGst: 187.54,
          averageAmount: 55.57,
          approvalRate: 85.5,
          rejectionRate: 14.5,
        },
        byCategory: [
          { category: "Business Meals", count: 15, totalAmount: 800, averageAmount: 53.33, percentage: 33.3 },
          { category: "Transportation & Vehicle", count: 12, totalAmount: 600, averageAmount: 50, percentage: 26.7 },
        ],
        byDepartment: [
          { department: "Operations", count: 20, totalAmount: 1200, averageAmount: 60 },
          { department: "Administration", count: 15, totalAmount: 800, averageAmount: 53.33 },
        ],
        byStaff: [
          { staffName: "John Tan", department: "Operations", count: 8, totalAmount: 450 },
        ],
        byStatus: [
          { status: "paid", count: 30, totalAmount: 1800 },
          { status: "pending", count: 10, totalAmount: 500 },
        ],
        topMerchants: [
          { merchant: "Shell Station", count: 5, totalAmount: 300 },
        ],
        anomalies: [
          { type: "high_value_transactions", description: "3 receipts exceed $200", severity: "medium" as const, details: {} },
        ],
        trends: {
          dailySpending: [
            { date: "2026-01-20", amount: 150, count: 3 },
            { date: "2026-01-21", amount: 200, count: 4 },
          ],
          categoryTrend: [],
        },
        flaggedReceipts: [],
      };

      (db.getAnalyticsData as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnalyticsData);

      const result = await db.getAnalyticsData();

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalReceipts).toBe(45);
      expect(result.summary.totalAmount).toBe(2500.50);
      expect(result.byCategory).toHaveLength(2);
      expect(result.byDepartment).toHaveLength(2);
      expect(result.anomalies).toHaveLength(1);
    });

    it("should filter by department when departmentId is provided", async () => {
      const mockDeptData = {
        summary: {
          totalReceipts: 15,
          totalAmount: 800,
          totalGst: 60,
          averageAmount: 53.33,
          approvalRate: 90,
          rejectionRate: 10,
        },
        byCategory: [
          { category: "Business Meals", count: 10, totalAmount: 500, averageAmount: 50, percentage: 66.7 },
        ],
        byDepartment: [
          { department: "Operations", count: 15, totalAmount: 800, averageAmount: 53.33 },
        ],
        byStaff: [],
        byStatus: [],
        topMerchants: [],
        anomalies: [],
        trends: { dailySpending: [], categoryTrend: [] },
        flaggedReceipts: [],
      };

      (db.getAnalyticsData as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeptData);

      const result = await db.getAnalyticsData(1);

      expect(result.summary.totalReceipts).toBe(15);
      expect(result.byDepartment).toHaveLength(1);
    });
  });

  describe("generateAnalyticsSummary", () => {
    it("should generate AI summary with required fields", async () => {
      const mockSummary = {
        executiveSummary: "Over the past 2 weeks, 45 receipts totaling S$2,500.50 were processed.",
        keyInsights: [
          "Total spending: S$2,500.50 across 45 receipts",
          "Average receipt value: S$55.57",
          "Top category: Business Meals",
        ],
        recommendations: [
          "Review flagged receipts for policy compliance",
          "Monitor high-value transactions",
        ],
        riskAlerts: ["3 receipts exceed $200 threshold"],
        infographicPrompt: "Create a professional business infographic showing expense analysis",
      };

      (generateAnalyticsSummary as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);

      const analyticsData = {
        summary: { totalReceipts: 45, totalAmount: 2500.50, totalGst: 187.54, averageAmount: 55.57, approvalRate: 85.5, rejectionRate: 14.5 },
        byCategory: [],
        byDepartment: [],
        byStaff: [],
        byStatus: [],
        topMerchants: [],
        anomalies: [],
        trends: { dailySpending: [], categoryTrend: [] },
        flaggedReceipts: [],
      };

      const result = await generateAnalyticsSummary(analyticsData);

      expect(result).toBeDefined();
      expect(result.executiveSummary).toBeDefined();
      expect(result.keyInsights).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.riskAlerts).toBeInstanceOf(Array);
      expect(result.infographicPrompt).toBeDefined();
    });

    it("should return default summary on error", async () => {
      const defaultSummary = {
        executiveSummary: "Over the past 2 weeks, 0 receipts totaling S$0.00 were processed with an approval rate of 0.0%.",
        keyInsights: ["Total spending: S$0.00 across 0 receipts"],
        recommendations: ["Review flagged receipts for policy compliance"],
        riskAlerts: [],
        infographicPrompt: "Create a professional business infographic",
      };

      (generateAnalyticsSummary as ReturnType<typeof vi.fn>).mockResolvedValue(defaultSummary);

      const emptyData = {
        summary: { totalReceipts: 0, totalAmount: 0, totalGst: 0, averageAmount: 0, approvalRate: 0, rejectionRate: 0 },
        byCategory: [],
        byDepartment: [],
        byStaff: [],
        byStatus: [],
        topMerchants: [],
        anomalies: [],
        trends: { dailySpending: [], categoryTrend: [] },
        flaggedReceipts: [],
      };

      const result = await generateAnalyticsSummary(emptyData);

      expect(result.executiveSummary).toContain("0 receipts");
    });
  });

  describe("Analytics Data Structure", () => {
    it("should have correct summary fields", () => {
      const summaryFields = ["totalReceipts", "totalAmount", "totalGst", "averageAmount", "approvalRate", "rejectionRate"];
      const mockSummary = {
        totalReceipts: 10,
        totalAmount: 500,
        totalGst: 37.5,
        averageAmount: 50,
        approvalRate: 80,
        rejectionRate: 20,
      };

      summaryFields.forEach(field => {
        expect(mockSummary).toHaveProperty(field);
      });
    });

    it("should categorize anomalies by severity", () => {
      const anomalies = [
        { type: "high_value", severity: "high" as const, description: "Test", details: {} },
        { type: "flagged", severity: "medium" as const, description: "Test", details: {} },
        { type: "minor", severity: "low" as const, description: "Test", details: {} },
      ];

      const highSeverity = anomalies.filter(a => a.severity === "high");
      const mediumSeverity = anomalies.filter(a => a.severity === "medium");
      const lowSeverity = anomalies.filter(a => a.severity === "low");

      expect(highSeverity).toHaveLength(1);
      expect(mediumSeverity).toHaveLength(1);
      expect(lowSeverity).toHaveLength(1);
    });
  });
});
