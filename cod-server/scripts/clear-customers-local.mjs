/**
 * Clear Customer Data from Local Database
 *
 * Removes all customer-related data from the local D1 database:
 *   - Customers
 *   - Customer groups and memberships
 *   - Customer tags and assignments
 *   - Orders and related data (order_products, order_status_history, company_shipments)
 *   - Reviews
 *   - Stock movements
 *   - Activity logs
 *   - Webhook events
 *   - Delivery company API calls
 *
 * Usage:
 *   cd cod-server
 *   node scripts/clear-customers-local.mjs
 *
 * WARNING: This will delete ALL customer and order data from your local database!
 * This is safe for local development testing only.
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

console.log("\n🧹 Clearing customer data from local database...\n");
console.log("⚠️  WARNING: This will delete ALL customer and order data!\n");

// Order matters! Delete in reverse order of foreign key dependencies
// Tables with CASCADE will be auto-deleted, but we're explicit for clarity
const statements = [
  // Activity logs (no FK constraints, but references entities)
  { sql: "DELETE FROM activity_logs", desc: "activity_logs" },
  
  // Webhook events (references orders with nullable FK)
  { sql: "DELETE FROM webhook_events WHERE order_id IS NOT NULL", desc: "webhook_events (order-related)" },
  
  // Stock movements (references orders in reference field)
  { sql: "DELETE FROM stock_movements WHERE reference LIKE 'ord-%'", desc: "stock_movements (order-related)" },
  
  // Reviews (references orders with CASCADE)
  { sql: "DELETE FROM reviews", desc: "reviews" },
  
  // Order status history (references orders with CASCADE - will auto-delete)
  { sql: "DELETE FROM order_status_history", desc: "order_status_history" },
  
  // Company shipments (references orders with CASCADE - will auto-delete)
  { sql: "DELETE FROM company_shipments", desc: "company_shipments" },
  
  // Order products (references orders with CASCADE - will auto-delete)
  { sql: "DELETE FROM order_products", desc: "order_products" },
  
  // Orders (references customers - must delete before customers)
  { sql: "DELETE FROM orders", desc: "orders" },
  
  // Customer group memberships (references customers with CASCADE - will auto-delete)
  { sql: "DELETE FROM customer_group_members", desc: "customer_group_members" },
  
  // Customer tag assignments (references customers with CASCADE - will auto-delete)
  { sql: "DELETE FROM customer_tag_assignments", desc: "customer_tag_assignments" },
  
  // Customer groups (reset member counts)
  { sql: "UPDATE customer_groups SET member_count = 0", desc: "customer_groups (reset counts)" },
  
  // Customer tags (reset assignment counts)
  { sql: "UPDATE customer_tags SET assignment_count = 0", desc: "customer_tags (reset counts)" },
  
  // Customers (main table)
  { sql: "DELETE FROM customers", desc: "customers" },
];

function run(sql) {
  try {
    execSync(
      `npx wrangler d1 execute DB --local --command "${sql}"`,
      { cwd: root, stdio: "pipe" }
    );
    return true;
  } catch (err) {
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    console.error(`✗ Failed`);
    console.error("  Error:", stderr.split("\n").filter(l => l.trim()).pop() || err.message);
    if (stdout) console.error("  Output:", stdout);
    return false;
  }
}

let ok = 0;
let failed = 0;

for (const { sql, desc } of statements) {
  process.stdout.write(`  ${desc.padEnd(45)} ... `);
  if (run(sql)) {
    console.log("✓");
    ok++;
  } else {
    failed++;
  }
}

console.log(`\n${"=".repeat(60)}`);
if (failed === 0) {
  console.log(`✅ Success! Cleared ${ok}/${statements.length} tables/operations\n`);
  console.log("📊 All customer and order data has been removed.");
  console.log("🔄 Restart cod-server to apply changes.\n");
  console.log("💡 You can now test with fresh customer data!\n");
} else {
  console.log(`⚠️  Completed with ${failed} error(s). ${ok}/${statements.length} succeeded.\n`);
  console.log("🔍 Check the errors above and try again if needed.\n");
  process.exit(1);
}

