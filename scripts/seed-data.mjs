import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "dotenv";

config();

// Create connection
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Sample data for realistic receipts
const merchants = {
  "Port and Terminal Operations": [
    "PSA Corporation Limited",
    "Jurong Port Pte Ltd",
    "Singapore Container Terminal",
    "Keppel Logistics",
    "APL Logistics",
    "PIL Terminal Services"
  ],
  "Transport and Vehicle": [
    "Shell Singapore",
    "Esso Singapore",
    "SPC Petrol Station",
    "Caltex Singapore",
    "HDB Car Park",
    "URA Car Park",
    "LTA ERP Top-up"
  ],
  "Business Meals": [
    "Ya Kun Kaya Toast",
    "Toast Box",
    "Kopitiam",
    "Food Republic",
    "Subway Singapore",
    "McDonald's",
    "KFC Singapore",
    "Swensen's",
    "Crystal Jade",
    "Din Tai Fung"
  ],
  "Hardware and Operational Supplies": [
    "SHEN YEE HARDWARE TRADING",
    "Home-Fix DIY",
    "Mr DIY",
    "Ace Hardware",
    "Popular Bookstore",
    "Office Warehouse"
  ],
  "Contractor and Pass Fees": [
    "PSA Security Services",
    "Certis Cisco",
    "AETOS Security",
    "MPA Port Pass Office"
  ],
  "Fees": [
    "Singapore Post",
    "DHL Express",
    "FedEx Singapore",
    "Ninja Van"
  ],
  "Business Travel and Petty Cash": [
    "Grab Singapore",
    "ComfortDelGro Taxi",
    "SMRT Taxi",
    "TransitLink"
  ],
  "Other": [
    "7-Eleven",
    "Cheers",
    "Guardian Pharmacy",
    "Watsons"
  ]
};

const staffMembers = [
  { name: "John Tan", departmentId: 1 },
  { name: "Mary Lim", departmentId: 1 },
  { name: "David Wong", departmentId: 1 },
  { name: "Sarah Chen", departmentId: 2 },
  { name: "Michael Lee", departmentId: 2 },
  { name: "Jennifer Ng", departmentId: 2 },
  { name: "Robert Goh", departmentId: 3 },
  { name: "Emily Teo", departmentId: 3 }
];

const departments = [
  { id: 1, name: "Administration" },
  { id: 2, name: "Operations" },
  { id: 3, name: "Logistics" }
];

const categories = [
  "Port and Terminal Operations",
  "Transport and Vehicle",
  "Business Meals",
  "Hardware and Operational Supplies",
  "Contractor and Pass Fees",
  "Fees",
  "Business Travel and Petty Cash",
  "Other"
];

const projectCodes = [
  "Jurong Port Container Ops",
  "PSA Terminal Maintenance",
  "Fleet Vehicle Service",
  "Office Supplies Restock",
  "Client Meeting - ABC Corp",
  "Team Lunch - Q4 Celebration",
  "Security Pass Renewal",
  "Warehouse Equipment",
  "Delivery Run - Changi",
  "Port Access Fees"
];

const aiReasonings = [
  "Receipt clearly shows business expense for operational purposes. Amount is within policy limits.",
  "Standard operational expense. GST extracted correctly. No policy violations detected.",
  "Business meal receipt with itemized details. Per-person limit appears to be within S$40 threshold.",
  "Port-related operational expense. Transaction date and amount clearly visible.",
  "Vehicle-related expense for company operations. Receipt is recent and within policy.",
  "Hardware purchase for operational needs. Amount requires standard approval workflow.",
  "Contractor fee for port access. Standard recurring expense for logistics operations."
];

const flagOptions = [
  [],
  [],
  [],
  ["Receipt too old"],
  ["Excessive amount"],
  ["Hardware over S$200 needs approval"],
  ["Low quality image"],
  []
];

// Generate random date within last 14 days
function randomDate(daysBack = 14) {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * daysBack);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Generate random amount based on category
function randomAmount(category) {
  const ranges = {
    "Port and Terminal Operations": { min: 50, max: 500 },
    "Transport and Vehicle": { min: 20, max: 150 },
    "Business Meals": { min: 15, max: 80 },
    "Hardware and Operational Supplies": { min: 30, max: 300 },
    "Contractor and Pass Fees": { min: 50, max: 200 },
    "Fees": { min: 10, max: 50 },
    "Business Travel and Petty Cash": { min: 10, max: 100 },
    "Other": { min: 5, max: 50 }
  };
  const range = ranges[category] || { min: 10, max: 100 };
  return (Math.random() * (range.max - range.min) + range.min).toFixed(2);
}

// Generate GST (9% of amount)
function calculateGst(amount) {
  return (parseFloat(amount) * 0.09).toFixed(2);
}

// Random element from array
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate receipts
async function seedData() {
  console.log("Starting seed data generation...");
  
  // First, ensure departments exist
  for (const dept of departments) {
    await connection.execute(
      `INSERT IGNORE INTO departments (id, name, floatAmount) VALUES (?, ?, ?)`,
      [dept.id, dept.name, "3500.00"]
    );
    console.log(`Department: ${dept.name}`);
  }
  
  // Insert staff members
  for (const s of staffMembers) {
    await connection.execute(
      `INSERT IGNORE INTO staff (name, departmentId) VALUES (?, ?)`,
      [s.name, s.departmentId]
    );
    console.log(`Staff: ${s.name}`);
  }
  
  // Get staff IDs
  const [staffRows] = await connection.execute("SELECT id, name, departmentId FROM staff");
  
  // Generate 40-60 receipts for 2 weeks (realistic volume)
  const numReceipts = 45 + Math.floor(Math.random() * 15);
  console.log(`\nGenerating ${numReceipts} receipts...`);
  
  const statuses = ["submitted", "admin_approved", "hod_approved", "paid"];
  const statusWeights = [0.15, 0.25, 0.30, 0.30]; // More completed receipts
  
  for (let i = 0; i < numReceipts; i++) {
    const staff = randomFrom(staffRows);
    const deptId = typeof staff.departmentId === 'number' ? staff.departmentId : parseInt(staff.departmentId);
    const dept = departments.find(d => d.id === deptId) || departments[0];
    if (!dept) continue;
    const category = randomFrom(categories);
    const merchant = randomFrom(merchants[category] || merchants["Other"]);
    const amount = randomAmount(category);
    const gst = calculateGst(amount);
    const transactionDate = randomDate(14);
    const confidence = 75 + Math.floor(Math.random() * 25);
    const reasoning = randomFrom(aiReasonings);
    const flags = randomFrom(flagOptions);
    
    // Weighted random status
    const rand = Math.random();
    let status;
    let cumulative = 0;
    for (let j = 0; j < statuses.length; j++) {
      cumulative += statusWeights[j];
      if (rand <= cumulative) {
        status = statuses[j];
        break;
      }
    }
    status = status || "submitted";
    
    // Add some anomalies for interesting data
    let finalAmount = amount;
    let finalFlags = [...flags];
    
    // 5% chance of anomaly - very high amount
    if (Math.random() < 0.05) {
      finalAmount = (parseFloat(amount) * 3).toFixed(2);
      finalFlags.push("Excessive amount");
    }
    
    // 3% chance of alcohol flag (for demo purposes)
    if (Math.random() < 0.03 && category === "Business Meals") {
      finalFlags.push("Alcohol detected");
    }
    
    const projectCode = randomFrom(projectCodes);
    
    await connection.execute(
      `INSERT INTO receipts (
        imageUrl, imageKey, staffId, staffName, departmentId, departmentName,
        merchantName, transactionDate, amountTotal, amountGst,
        category, projectCode, aiConfidence, aiReasoning, aiFlags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `https://placeholder-receipt.com/receipt-${i + 1}.jpg`,
        `receipts/receipt-${i + 1}.jpg`,
        staff.id,
        staff.name,
        staff.departmentId,
        dept.name,
        merchant,
        transactionDate,
        finalAmount,
        gst,
        category,
        projectCode,
        confidence,
        reasoning,
        JSON.stringify(finalFlags),
        status
      ]
    );
    
    console.log(`Receipt ${i + 1}: ${merchant} - $${finalAmount} (${category}) [${status}]`);
  }
  
  // Create some batches with approved receipts
  console.log("\nCreating batches...");
  
  for (const dept of departments) {
    // Get admin_approved receipts for this department
    const [approvedReceipts] = await connection.execute(
      `SELECT id, amountTotal, amountGst FROM receipts 
       WHERE departmentId = ? AND status IN ('admin_approved', 'hod_approved', 'paid')
       AND batchId IS NULL
       LIMIT 5`,
      [dept.id]
    );
    
    if (approvedReceipts.length > 0) {
      const totalAmount = approvedReceipts.reduce((sum, r) => sum + parseFloat(r.amountTotal || 0), 0);
      const totalGst = approvedReceipts.reduce((sum, r) => sum + parseFloat(r.amountGst || 0), 0);
      
      const batchStatus = Math.random() > 0.5 ? "approved" : "pending_hod";
      
      const [batchResult] = await connection.execute(
        `INSERT INTO batches (departmentId, totalAmount, totalGst, status) VALUES (?, ?, ?, ?)`,
        [dept.id, totalAmount.toFixed(2), totalGst.toFixed(2), batchStatus]
      );
      
      const batchId = batchResult.insertId;
      
      // Link receipts to batch
      for (const receipt of approvedReceipts) {
        await connection.execute(
          `UPDATE receipts SET batchId = ? WHERE id = ?`,
          [batchId, receipt.id]
        );
      }
      
      console.log(`Batch ${batchId} for ${dept.name}: $${totalAmount.toFixed(2)} (${approvedReceipts.length} receipts) [${batchStatus}]`);
    }
  }
  
  // Create activity logs for some actions
  console.log("\nCreating activity logs...");
  
  const [allReceipts] = await connection.execute(
    `SELECT id, staffName, departmentId, status, merchantName, amountTotal FROM receipts LIMIT 20`
  );
  
  for (const receipt of allReceipts) {
    // Log submission
    await connection.execute(
      `INSERT INTO activity_logs (entityType, entityId, actorRole, actorName, action, description, departmentId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "receipt",
        receipt.id,
        "staff",
        receipt.staffName,
        "submitted",
        `Submitted receipt from ${receipt.merchantName} for $${receipt.amountTotal}`,
        receipt.departmentId
      ]
    );
    
    if (receipt.status !== "submitted") {
      await connection.execute(
        `INSERT INTO activity_logs (entityType, entityId, actorRole, actorName, action, description, departmentId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "receipt",
          receipt.id,
          "admin",
          "Dept Admin",
          "admin_approved",
          `Approved receipt from ${receipt.merchantName}`,
          receipt.departmentId
        ]
      );
    }
  }
  
  console.log("\n✅ Seed data generation complete!");
  console.log(`Generated ${numReceipts} receipts across ${departments.length} departments`);
  
  await connection.end();
}

seedData().catch(console.error);
