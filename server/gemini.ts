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
9. If you cannot read a field, use empty string "" for text fields and 0 for numeric fields

CRITICAL FLAGS TO DETECT:
- "Alcohol detected" - if any alcoholic beverages found
- "Receipt too old" - if date is more than 30 days ago
- "Excessive amount" - if meal exceeds S$40/person or petty cash exceeds S$50
- "Missing date" - if date cannot be determined
- "Missing merchant" - if vendor name unclear
- "Low quality image" - if image is blurry or hard to read
- "Suspicious item" - any non-reimbursable items detected`;

  const userPrompt = `Analyze this receipt image and extract the following information:
1. Merchant/Vendor name (use empty string if not visible)
2. Transaction date (use empty string if not visible)
3. Total amount in SGD (use 0 if not visible)
4. GST amount in SGD (calculate as 9% of subtotal if not shown, use 0 if cannot determine)
5. Most appropriate expense category
6. Any policy violations or flags
7. Your confidence level (0-100)
8. Brief reasoning for your classification

Be thorough in checking for policy violations. If you detect alcohol, tobacco, or any prohibited items, flag them immediately.`;

  try {
    console.log("[Gemini] Starting receipt extraction for:", imageUrl.substring(0, 100) + "...");
    
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
                type: "string",
                description: "Name of the merchant/vendor, empty string if not visible"
              },
              transactionDate: { 
                type: "string",
                description: "Transaction date in YYYY-MM-DD format, empty string if not visible"
              },
              amountTotal: { 
                type: "number",
                description: "Total amount in SGD, 0 if not visible"
              },
              amountGst: { 
                type: "number",
                description: "GST amount in SGD (9% if not shown), 0 if cannot determine"
              },
              category: { 
                type: "string",
                enum: [...expenseCategories],
                description: "Expense category"
              },
              confidence: { 
                type: "integer",
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

    console.log("[Gemini] LLM Response received:", JSON.stringify(response).substring(0, 500));

    // Check if response has an error
    if ((response as any).error) {
      console.error("[Gemini] API Error:", JSON.stringify((response as any).error));
      throw new Error(`API Error: ${(response as any).error.message || "Unknown error"}`);
    }

    // Check if response has the expected structure
    if (!response) {
      console.error("[Gemini] Empty response from LLM");
      throw new Error("Empty response from AI service");
    }

    if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      console.error("[Gemini] Invalid response structure - no choices:", JSON.stringify(response));
      throw new Error("Invalid response from AI service - no choices returned");
    }

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      console.error("[Gemini] Invalid choice structure:", JSON.stringify(choice));
      throw new Error("Invalid response from AI service - no message in choice");
    }

    const content = choice.message.content;
    if (!content) {
      console.error("[Gemini] Empty content in message:", JSON.stringify(choice.message));
      throw new Error("Empty content from AI service");
    }

    // Handle case where content might be an array (multimodal response)
    let textContent: string;
    if (typeof content === "string") {
      textContent = content;
    } else if (Array.isArray(content)) {
      // Find the text content in the array
      const textPart = content.find((part: any) => part.type === "text");
      if (textPart && "text" in textPart) {
        textContent = textPart.text;
      } else {
        console.error("[Gemini] No text content found in array:", JSON.stringify(content));
        throw new Error("No text content in AI response");
      }
    } else {
      console.error("[Gemini] Unexpected content type:", typeof content);
      throw new Error("Unexpected content type from AI service");
    }

    console.log("[Gemini] Parsing JSON content:", textContent.substring(0, 200));

    const parsed = JSON.parse(textContent);
    
    // Convert empty strings to null for optional fields
    const result: ReceiptExtractionResult = {
      merchantName: parsed.merchantName || null,
      transactionDate: parsed.transactionDate || null,
      amountTotal: parsed.amountTotal || null,
      amountGst: parsed.amountGst || null,
      category: parsed.category,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      flags: parsed.flags || [],
      lineItems: parsed.lineItems || []
    };
    
    // Additional date validation
    if (result.transactionDate) {
      const receiptDate = new Date(result.transactionDate);
      const daysSinceReceipt = Math.floor((Date.now() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceReceipt > 30 && !result.flags.includes("Receipt too old")) {
        result.flags.push("Receipt too old");
        result.reasoning += ` Note: Receipt is ${daysSinceReceipt} days old, exceeding the 30-day policy limit.`;
      }
    }
    
    console.log("[Gemini] Extraction successful:", result.merchantName, result.amountTotal);
    return result;
  } catch (error) {
    console.error("[Gemini] Error during extraction:", error);
    
    // Return a default result with error flag instead of throwing
    // This allows the user to still manually enter the data
    return {
      merchantName: null,
      transactionDate: null,
      amountTotal: null,
      amountGst: null,
      category: "Other" as ExpenseCategory,
      confidence: 0,
      reasoning: `AI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}. Please enter the receipt details manually.`,
      flags: ["AI extraction failed"],
      lineItems: []
    };
  }
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

  try {
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

    // Check for API error
    if ((response as any).error) {
      throw new Error(`API Error: ${(response as any).error.message || "Unknown error"}`);
    }

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from AI service");
    }

    const content = response.choices[0].message.content;
    const textContent = typeof content === "string" 
      ? content 
      : Array.isArray(content) 
        ? (content.find((p: any) => p.type === "text") as any)?.text || ""
        : "";

    return JSON.parse(textContent);
  } catch (error) {
    console.error("[Gemini] Policy validation error:", error);
    return {
      isValid: true,
      flags: ["Policy validation unavailable"],
      reasoning: "Could not validate against policy. Manual review recommended."
    };
  }
}
