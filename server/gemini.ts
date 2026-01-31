import { invokeLLM } from "./_core/llm";
import { ExpenseCategory, expenseCategories } from "../drizzle/schema";

export interface ReceiptExtractionResult {
  merchantName: string | null;
  transactionDate: string | null; // ISO date string
  amountTotal: number | null;
  amountGst: number | null;
  category: ExpenseCategory;
  confidence: number; // 0-100
  reasoning: string;
  flags: string[];
  lineItems: Array<{
    description: string;
    amount: number;
  }>;
}

const EXPENSE_POLICY = `
# Bok Seng Logistics Expense Policy Summary

## Reimbursable Categories:
1. Port & Terminal Operations - PSA/Jurong Port invoices, gate charges, container handling fees
2. Transportation & Vehicle - ERP charges, car park fees, fuel for company vehicles
3. Business Meals - Meals with clients, overtime meals, team meals (S$40 per person limit)
4. Hardware & Operational Supplies - Tools, safety gear, packing materials (>S$200 needs approval)
5. Contractor & Pass Fees - Access passes for restricted areas
6. Fees - Various operational fees
7. Business Travel - Pre-approved travel expenses
8. Other - Miscellaneous operational expenses

## Non-Reimbursable Items (FLAG THESE):
- Alcohol (unless pre-approved client entertainment)
- Traffic/parking fines
- Personal items (clothing, toiletries, souvenirs)
- Personal entertainment (movies, gym, sports)
- Lavish/extravagant meals exceeding limits
- Personal medical expenses
- Donations

## Policy Rules to Check:
1. Receipt must be within 30 days of submission
2. Business meals: S$40 per person limit
3. Petty cash: S$50 per transaction limit
4. Hardware purchases over S$200 need prior approval
5. Must have clear business purpose
`;

export async function extractReceiptData(imageUrl: string): Promise<ReceiptExtractionResult> {
  const systemPrompt = `You are an expert receipt analyzer for Bok Seng Logistics, a Singapore-based logistics company. 
Your task is to extract information from receipt images and validate them against company expense policy.

${EXPENSE_POLICY}

IMPORTANT INSTRUCTIONS:
1. Extract ALL visible information from the receipt accurately
2. Handle handwritten receipts including Chinese characters
3. Calculate GST (9% in Singapore) if not explicitly shown
4. Classify into the most appropriate expense category
5. Flag ANY policy violations or suspicious items
6. Provide confidence score based on image quality and extraction certainty
7. For dates, use ISO format (YYYY-MM-DD)
8. For amounts, extract the TOTAL amount paid

CRITICAL FLAGS TO DETECT:
- "Alcohol detected" - if any alcoholic beverages found
- "Receipt too old" - if date is more than 30 days ago
- "Excessive amount" - if meal exceeds S$40/person or petty cash exceeds S$50
- "Missing date" - if date cannot be determined
- "Missing merchant" - if vendor name unclear
- "Low quality image" - if image is blurry or hard to read
- "Suspicious item" - any non-reimbursable items detected`;

  const userPrompt = `Analyze this receipt image and extract the following information:
1. Merchant/Vendor name
2. Transaction date
3. Total amount (in SGD)
4. GST amount (calculate if not shown - 9% of subtotal)
5. Most appropriate expense category
6. Any policy violations or flags
7. Your confidence level (0-100)
8. Brief reasoning for your classification

Be thorough in checking for policy violations. If you detect alcohol, tobacco, or any prohibited items, flag them immediately.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: [
          { type: "text", text: userPrompt },
          { 
            type: "image_url", 
            image_url: { 
              url: imageUrl,
              detail: "high"
            } 
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "receipt_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            merchantName: { 
              type: ["string", "null"],
              description: "Name of the merchant/vendor"
            },
            transactionDate: { 
              type: ["string", "null"],
              description: "Transaction date in YYYY-MM-DD format"
            },
            amountTotal: { 
              type: ["number", "null"],
              description: "Total amount in SGD"
            },
            amountGst: { 
              type: ["number", "null"],
              description: "GST amount in SGD (9% if not shown)"
            },
            category: { 
              type: "string",
              enum: [...expenseCategories],
              description: "Expense category"
            },
            confidence: { 
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "Confidence score 0-100"
            },
            reasoning: { 
              type: "string",
              description: "Explanation of classification and any concerns"
            },
            flags: { 
              type: "array",
              items: { type: "string" },
              description: "List of policy flags/warnings"
            },
            lineItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" }
                },
                required: ["description", "amount"],
                additionalProperties: false
              },
              description: "Individual line items if visible"
            }
          },
          required: ["merchantName", "transactionDate", "amountTotal", "amountGst", "category", "confidence", "reasoning", "flags", "lineItems"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Failed to get response from AI");
  }

  const result = JSON.parse(content) as ReceiptExtractionResult;
  
  // Additional date validation
  if (result.transactionDate) {
    const receiptDate = new Date(result.transactionDate);
    const daysSinceReceipt = Math.floor((Date.now() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceReceipt > 30 && !result.flags.includes("Receipt too old")) {
      result.flags.push("Receipt too old");
      result.reasoning += ` Note: Receipt is ${daysSinceReceipt} days old, exceeding the 30-day policy limit.`;
    }
  }
  
  return result;
}

export async function validateReceiptPolicy(
  merchantName: string,
  amount: number,
  category: ExpenseCategory,
  lineItems: Array<{ description: string; amount: number }>
): Promise<{ isValid: boolean; flags: string[]; reasoning: string }> {
  const systemPrompt = `You are a policy compliance checker for Bok Seng Logistics.
Review the expense details and check for any policy violations.

${EXPENSE_POLICY}

Return your assessment with any flags and reasoning.`;

  const userPrompt = `Review this expense for policy compliance:
- Merchant: ${merchantName}
- Total Amount: S$${amount.toFixed(2)}
- Category: ${category}
- Line Items: ${JSON.stringify(lineItems)}

Check for:
1. Prohibited items (alcohol, tobacco, personal items)
2. Amount limits (S$40 for meals, S$50 for petty cash)
3. Any suspicious patterns`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "policy_validation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            isValid: { type: "boolean" },
            flags: { 
              type: "array",
              items: { type: "string" }
            },
            reasoning: { type: "string" }
          },
          required: ["isValid", "flags", "reasoning"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Failed to get policy validation response");
  }

  return JSON.parse(content);
}
