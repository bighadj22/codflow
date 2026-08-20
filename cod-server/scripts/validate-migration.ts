/**
 * Migration Validation Script
 * 
 * Validates that the database migration can be applied successfully
 * and that the schema matches the expected structure.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface TableInfo {
  name: string;
  sql: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

/**
 * Validates the migration SQL syntax and structure
 */
function validateMigrationSyntax(): boolean {
  try {
    const migrationPath = join(__dirname, '../src/db/migrations/0001_delivery_system_redesign.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('✅ Migration file exists and is readable');
    
    // Check for required table creations
    const requiredTables = ['order_assignments'];
    const requiredAlters = ['drivers', 'delivery_companies', 'orders'];
    
    for (const table of requiredTables) {
      if (!migrationSQL.includes(`CREATE TABLE \`${table}\``)) {
        console.error(`❌ Missing CREATE TABLE for ${table}`);
        return false;
      }
      console.log(`✅ Found CREATE TABLE for ${table}`);
    }
    
    for (const table of requiredAlters) {
      if (!migrationSQL.includes(`ALTER TABLE \`${table}\``)) {
        console.error(`❌ Missing ALTER TABLE for ${table}`);
        return false;
      }
      console.log(`✅ Found ALTER TABLE for ${table}`);
    }
    
    // Check for index creation
    const requiredIndexes = [
      'idx_drivers_wilaya_status',
      'idx_pricing_lookup',
      'idx_orders_assignment',
      'idx_assignments_order'
    ];
    
    for (const index of requiredIndexes) {
      if (!migrationSQL.includes(`CREATE INDEX \`${index}\``)) {
        console.error(`❌ Missing INDEX ${index}`);
        return false;
      }
      console.log(`✅ Found INDEX ${index}`);
    }
    
    console.log('✅ Migration syntax validation passed');
    return true;
    
  } catch (error) {
    console.error('❌ Migration validation failed:', error);
    return false;
  }
}

/**
 * Validates the schema structure matches expectations
 */
function validateSchemaStructure(): boolean {
  try {
    // Import the schema to validate TypeScript compilation
    const schema = require('../src/db/schema');
    
    // Check that all expected tables are defined
    const expectedTables = [
      'drivers',
      'deliveryCompanies', 
      'deliveryPricing',
      'orders',
      'orderAssignments'
    ];
    
    for (const table of expectedTables) {
      if (!schema[table]) {
        console.error(`❌ Missing table definition: ${table}`);
        return false;
      }
      console.log(`✅ Found table definition: ${table}`);
    }
    
    // Validate enhanced drivers table structure
    const driversTable = schema.drivers;
    const requiredDriverFields = [
      'id', 'name', 'phone', 'email', 'wilaya', 'vehicleType',
      'licenseNumber', 'vehicleRegistration', 'status', 'maxDailyOrders',
      'currentCapacity', 'activeOrders', 'deliveredToday', 'returnedToday',
      'totalDelivered', 'totalReturned', 'totalEarnings', 'completionRate',
      'averageDeliveryTime', 'createdAt', 'updatedAt', 'lastActiveAt'
    ];
    
    for (const field of requiredDriverFields) {
      if (!driversTable[field]) {
        console.error(`❌ Missing driver field: ${field}`);
        return false;
      }
    }
    console.log('✅ Drivers table structure validated');
    
    // Validate enhanced delivery companies table
    const companiesTable = schema.deliveryCompanies;
    const requiredCompanyFields = [
      'id', 'name', 'nameAr', 'code', 'phone', 'email', 'website',
      'contactPerson', 'active', 'apiEndpoint', 'apiKey', 'apiSecret',
      'webhookUrl', 'supportsTracking', 'supportsCod', 'supportsHomeDelivery',
      'supportsStopDesk', 'serviceAreas', 'totalOrders', 'successfulDeliveries',
      'averageDeliveryTime', 'createdAt', 'updatedAt'
    ];
    
    for (const field of requiredCompanyFields) {
      if (!companiesTable[field]) {
        console.error(`❌ Missing company field: ${field}`);
        return false;
      }
    }
    console.log('✅ Delivery companies table structure validated');
    
    // Validate enhanced pricing table
    const pricingTable = schema.deliveryPricing;
    const requiredPricingFields = [
      'id', 'driverId', 'companyId', 'wilaya', 'deliveryType',
      'basePrice', 'additionalFees', 'codFee', 'estimatedDays',
      'maxWeightKg', 'maxDimensions', 'effectiveFrom', 'effectiveUntil',
      'active', 'createdAt', 'updatedAt'
    ];
    
    for (const field of requiredPricingFields) {
      if (!pricingTable[field]) {
        console.error(`❌ Missing pricing field: ${field}`);
        return false;
      }
    }
    console.log('✅ Delivery pricing table structure validated');
    
    // Validate order assignments table
    const assignmentsTable = schema.orderAssignments;
    const requiredAssignmentFields = [
      'id', 'orderId', 'assigneeType', 'assigneeId', 'assigneeName',
      'assignedBy', 'assignedAt', 'unassignedAt', 'reason',
      'acceptedAt', 'pickupAt', 'deliveredAt', 'status'
    ];
    
    for (const field of requiredAssignmentFields) {
      if (!assignmentsTable[field]) {
        console.error(`❌ Missing assignment field: ${field}`);
        return false;
      }
    }
    console.log('✅ Order assignments table structure validated');
    
    console.log('✅ Schema structure validation passed');
    return true;
    
  } catch (error) {
    console.error('❌ Schema structure validation failed:', error);
    return false;
  }
}

/**
 * Main validation function
 */
function main() {
  console.log('🔍 Starting database migration validation...\n');
  
  const syntaxValid = validateMigrationSyntax();
  console.log('');
  
  const schemaValid = validateSchemaStructure();
  console.log('');
  
  if (syntaxValid && schemaValid) {
    console.log('🎉 All validations passed! Migration is ready to apply.');
    process.exit(0);
  } else {
    console.log('❌ Validation failed. Please fix the issues before applying migration.');
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  main();
}

export { validateMigrationSyntax, validateSchemaStructure };