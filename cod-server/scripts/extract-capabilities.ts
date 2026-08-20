#!/usr/bin/env tsx
/**
 * Capability Extraction Tool
 * 
 * Automatically extracts provider capabilities from test scripts,
 * API responses, and test summaries.
 * 
 * Usage: npx tsx scripts/extract-capabilities.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestOperation {
  testNumber: string;
  operation: string;
  endpoint: string;
  method: string;
  description: string;
}

interface TestResult {
  provider: string;
  totalTests: number;
  passed: number;
  failed: number;
  operations: Record<string, 'pass' | 'fail' | 'unknown'>;
  notes: string[];
}

interface ProviderCapabilities {
  // Delivery Types
  canHomeDelivery: boolean;
  canStopDesk: boolean;
  
  // Lifecycle
  autoValidates: boolean;
  canUpdateBeforeValidation: boolean;
  canUpdateAfterValidation: boolean;
  canDeleteBeforeValidation: boolean;
  canDeleteAfterValidation: boolean;
  
  // Package Options
  canOpenPackage: boolean;
  canExchange: boolean;
  canPartialDelivery: boolean;
  supportsFragileFlag: boolean;
  
  // Tracking & Communication
  canTrack: boolean;
  canAddRemarks: boolean;
  canGetRemarks: boolean;
  providesLabelOnCreate: boolean;
  labelUrlExpires: boolean;
  
  // Limits
  maxWeightKg: number | null;
  maxBulkCreate: number;
  maxBulkValidate: number;
  supportedCurrencies: string[];
  
  // Territory
  territorySystem: 'wilaya_id' | 'wilaya_name' | 'uuid';
  requiresCustomerCreation: boolean;
  
  // Webhooks
  supportsWebhooks: boolean;
  webhookRegistrationType: 'api' | 'manual' | null;
}

interface CapabilityExtraction {
  provider: string;
  capabilities: Partial<ProviderCapabilities>;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
  sources: Record<string, string[]>;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function parseTestScript(scriptPath: string): TestOperation[] {
  const script = fs.readFileSync(scriptPath, 'utf-8');
  const operations: TestOperation[] = [];
  
  // Match test function definitions
  const testFunctionRegex = /test_(\d+)_([a-z_]+)\(\)\s*\{[^}]*log_test\s+"(\d+)"\s+"([^"]+)"/g;
  
  let match;
  while ((match = testFunctionRegex.exec(script)) !== null) {
    const [_, testNum, functionName, logNum, description] = match;
    
    // Extract HTTP method and endpoint from description
    const methodMatch = description.match(/\((GET|POST|PATCH|DELETE|PUT)\s+([^)]+)\)/);
    
    if (methodMatch) {
      operations.push({
        testNumber: testNum,
        operation: functionName,
        endpoint: methodMatch[2].trim(),
        method: methodMatch[1],
        description: description.replace(/\([^)]+\)/, '').trim(),
      });
    }
  }
  
  return operations;
}

function parseTestSummary(summaryPath: string): TestResult {
  const summary = fs.readFileSync(summaryPath, 'utf-8');
  
  // Extract totals
  const totalMatch = summary.match(/Total Tests:\s*(\d+)/);
  const passedMatch = summary.match(/Passed:\s*(\d+)/);
  const failedMatch = summary.match(/Failed:\s*(\d+)/);
  
  // Extract per-operation results
  const operationResults: Record<string, 'pass' | 'fail' | 'unknown'> = {};
  const operationRegex = /-\s+([^:]+):\s*(✓|✗|Check)/g;
  
  let match;
  while ((match = operationRegex.exec(summary)) !== null) {
    const [_, operation, status] = match;
    operationResults[operation.trim()] = 
      status === '✓' ? 'pass' : 
      status === '✗' ? 'fail' : 
      'unknown';
  }
  
  // Extract notes
  const notes: string[] = [];
  const notesSection = summary.match(/IMPORTANT NOTES:([\s\S]*?)(?:\n\n|$)/);
  if (notesSection) {
    const noteLines = notesSection[1].split('\n').filter(l => l.trim().startsWith('-'));
    notes.push(...noteLines.map(l => l.trim().substring(1).trim()));
  }
  
  return {
    provider: path.basename(path.dirname(path.dirname(summaryPath))),
    totalTests: parseInt(totalMatch?.[1] ?? '0'),
    passed: parseInt(passedMatch?.[1] ?? '0'),
    failed: parseInt(failedMatch?.[1] ?? '0'),
    operations: operationResults,
    notes,
  };
}

function findTestScript(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    const scriptFile = files.find(f => f.startsWith('test-') && f.endsWith('.sh'));
    return scriptFile ? path.join(dir, scriptFile) : null;
  } catch {
    return null;
  }
}

function findTestSummary(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    const resultsDir = files.find(f => f.includes('test-results'));
    if (!resultsDir) return null;
    
    const summaryPath = path.join(dir, resultsDir, 'test_summary.txt');
    return fs.existsSync(summaryPath) ? summaryPath : null;
  } catch {
    return null;
  }
}

function findResponseFile(dir: string, filename: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    const resultsDir = files.find(f => f.includes('test-results'));
    if (!resultsDir) return null;
    
    const responsePath = path.join(dir, resultsDir, filename);
    return fs.existsSync(responsePath) ? responsePath : null;
  } catch {
    return null;
  }
}

// ─── Capability Extraction ───────────────────────────────────────────────────

async function extractCapabilities(providerDir: string): Promise<CapabilityExtraction> {
  const provider = path.basename(providerDir);
  const capabilities: Partial<ProviderCapabilities> = {};
  const confidence: Record<string, 'high' | 'medium' | 'low'> = {};
  const sources: Record<string, string[]> = {};
  
  console.log(`\nAnalyzing ${provider}...`);
  
  // 1. Parse test script
  const testScript = findTestScript(providerDir);
  if (testScript) {
    console.log(`  ✓ Found test script: ${path.basename(testScript)}`);
    const operations = parseTestScript(testScript);
    console.log(`  ✓ Parsed ${operations.length} test operations`);
    
    // Check for validate operation
    const hasValidateTest = operations.some(op => op.operation.includes('validate'));
    capabilities.autoValidates = !hasValidateTest;
    confidence.autoValidates = 'high';
    sources.autoValidates = [`Test script: ${hasValidateTest ? 'has' : 'no'} validate test`];
    
    // Check for update operations
    const updateOps = operations.filter(op => op.operation.includes('update'));
    if (updateOps.length > 0) {
      capabilities.canUpdateBeforeValidation = true;
      confidence.canUpdateBeforeValidation = 'high';
      sources.canUpdateBeforeValidation = updateOps.map(op => `Test: ${op.description}`);
    }
    
    // Check for delete operations
    const deleteOps = operations.filter(op => op.operation.includes('delete'));
    if (deleteOps.length > 0) {
      capabilities.canDeleteBeforeValidation = true;
      confidence.canDeleteBeforeValidation = 'medium';
      sources.canDeleteBeforeValidation = deleteOps.map(op => `Test: ${op.description}`);
    }
    
    // Check for tracking operations
    const trackingOps = operations.filter(op => 
      op.operation.includes('tracking') || 
      op.operation.includes('history') ||
      op.description.toLowerCase().includes('tracking')
    );
    if (trackingOps.length > 0) {
      capabilities.canTrack = true;
      confidence.canTrack = 'high';
      sources.canTrack = trackingOps.map(op => `Test: ${op.description}`);
    }
    
    // Check for remark operations
    const addRemarkOps = operations.filter(op => op.operation.includes('add_remark'));
    if (addRemarkOps.length > 0) {
      capabilities.canAddRemarks = true;
      confidence.canAddRemarks = 'high';
      sources.canAddRemarks = [`Test: ${addRemarkOps[0].description}`];
    }
    
    const getRemarkOps = operations.filter(op => op.operation.includes('get_remark'));
    if (getRemarkOps.length > 0) {
      capabilities.canGetRemarks = true;
      confidence.canGetRemarks = 'high';
      sources.canGetRemarks = [`Test: ${getRemarkOps[0].description}`];
    }
    
    // Check for customer creation
    const customerOps = operations.filter(op => op.operation.includes('create_customer'));
    if (customerOps.length > 0) {
      capabilities.requiresCustomerCreation = true;
      confidence.requiresCustomerCreation = 'high';
      sources.requiresCustomerCreation = [`Test: ${customerOps[0].description}`];
    } else {
      capabilities.requiresCustomerCreation = false;
      confidence.requiresCustomerCreation = 'high';
      sources.requiresCustomerCreation = ['Test script: no customer creation test'];
    }
  }
  
  // 2. Parse test summary
  const testSummary = findTestSummary(providerDir);
  if (testSummary) {
    console.log(`  ✓ Found test summary: ${path.basename(testSummary)}`);
    const results = parseTestSummary(testSummary);
    console.log(`  ✓ Tests: ${results.passed}/${results.totalTests} passed`);
    
    // Adjust confidence based on test results
    for (const [operation, status] of Object.entries(results.operations)) {
      if (operation.toLowerCase().includes('delete') && status === 'fail') {
        capabilities.canDeleteBeforeValidation = false;
        confidence.canDeleteBeforeValidation = 'high';
        if (!sources.canDeleteBeforeValidation) sources.canDeleteBeforeValidation = [];
        sources.canDeleteBeforeValidation.push('Test result: FAILED');
      }
      
      if (operation.toLowerCase().includes('update') && operation.toLowerCase().includes('after') && status === 'pass') {
        capabilities.canUpdateAfterValidation = true;
        confidence.canUpdateAfterValidation = 'high';
        if (!sources.canUpdateAfterValidation) sources.canUpdateAfterValidation = [];
        sources.canUpdateAfterValidation.push(`Test result: ${operation} PASSED`);
      }
    }
    
    // Parse notes for additional info
    for (const note of results.notes) {
      if (note.toLowerCase().includes('auto-validate')) {
        capabilities.autoValidates = true;
        confidence.autoValidates = 'high';
        if (!sources.autoValidates) sources.autoValidates = [];
        sources.autoValidates.push(`Note: "${note}"`);
      }
      
      if (note.toLowerCase().includes('uuid')) {
        capabilities.territorySystem = 'uuid';
        confidence.territorySystem = 'high';
        if (!sources.territorySystem) sources.territorySystem = [];
        sources.territorySystem.push(`Note: "${note}"`);
      }
      
      if (note.toLowerCase().includes('label') && note.toLowerCase().includes('expire')) {
        capabilities.labelUrlExpires = true;
        confidence.labelUrlExpires = 'high';
        if (!sources.labelUrlExpires) sources.labelUrlExpires = [];
        sources.labelUrlExpires.push(`Note: "${note}"`);
      }
    }
  }
  
  // 3. Parse API responses
  const createResponse = findResponseFile(providerDir, '02_create_parcel_response.json');
  if (createResponse) {
    console.log(`  ✓ Found create response`);
    try {
      const response = JSON.parse(fs.readFileSync(createResponse, 'utf-8'));
      
      // Check for label in create response
      if (response.label || response.labelUrl) {
        capabilities.providesLabelOnCreate = true;
        confidence.providesLabelOnCreate = 'high';
        sources.providesLabelOnCreate = ['API response: label field present in create'];
      } else {
        capabilities.providesLabelOnCreate = false;
        confidence.providesLabelOnCreate = 'high';
        sources.providesLabelOnCreate = ['API response: no label field in create'];
      }
      
      // Check for UUID-based IDs
      if (response.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.id)) {
        capabilities.territorySystem = 'uuid';
        confidence.territorySystem = 'high';
        if (!sources.territorySystem) sources.territorySystem = [];
        sources.territorySystem.push('API response: UUID format ID');
      }
    } catch (e) {
      console.log(`  ⚠ Could not parse create response: ${e}`);
    }
  }
  
  const labelResponse = findResponseFile(providerDir, '08_get_label_response.json');
  if (labelResponse) {
    console.log(`  ✓ Found label response`);
    try {
      const response = JSON.parse(fs.readFileSync(labelResponse, 'utf-8'));
      
      // Check for SAS token (temporary URL)
      const fileUrl = response.fileUrl || response.parcelLabelFiles?.[0]?.fileUrl;
      if (fileUrl && typeof fileUrl === 'string' && fileUrl.includes('sig=')) {
        capabilities.labelUrlExpires = true;
        confidence.labelUrlExpires = 'high';
        if (!sources.labelUrlExpires) sources.labelUrlExpires = [];
        sources.labelUrlExpires.push('API response: SAS token in label URL');
      } else if (fileUrl) {
        capabilities.labelUrlExpires = false;
        confidence.labelUrlExpires = 'high';
        if (!sources.labelUrlExpires) sources.labelUrlExpires = [];
        sources.labelUrlExpires.push('API response: permanent label URL');
      }
    } catch (e) {
      console.log(`  ⚠ Could not parse label response: ${e}`);
    }
  }
  
  // 4. Set defaults for common capabilities
  if (capabilities.canHomeDelivery === undefined) {
    capabilities.canHomeDelivery = true;
    confidence.canHomeDelivery = 'medium';
    sources.canHomeDelivery = ['Default: assumed supported'];
  }
  
  if (capabilities.canStopDesk === undefined) {
    capabilities.canStopDesk = true;
    confidence.canStopDesk = 'medium';
    sources.canStopDesk = ['Default: assumed supported'];
  }
  
  if (capabilities.maxBulkCreate === undefined) {
    capabilities.maxBulkCreate = 100;
    confidence.maxBulkCreate = 'low';
    sources.maxBulkCreate = ['Default: common limit'];
  }
  
  if (capabilities.supportedCurrencies === undefined) {
    capabilities.supportedCurrencies = ['DZD'];
    confidence.supportedCurrencies = 'high';
    sources.supportedCurrencies = ['Default: Algerian market'];
  }
  
  return {
    provider,
    capabilities,
    confidence,
    sources,
  };
}

// ─── Output Generation ────────────────────────────────────────────────────────

function generateReport(extraction: CapabilityExtraction): void {
  const { provider, capabilities, confidence, sources } = extraction;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`CAPABILITY EXTRACTION REPORT: ${provider.toUpperCase()}`);
  console.log('='.repeat(70));
  
  console.log('\n📊 EXTRACTED CAPABILITIES:\n');
  
  const categories = {
    'Lifecycle': ['autoValidates', 'canUpdateBeforeValidation', 'canUpdateAfterValidation', 'canDeleteBeforeValidation', 'canDeleteAfterValidation'],
    'Tracking & Communication': ['canTrack', 'canAddRemarks', 'canGetRemarks', 'providesLabelOnCreate', 'labelUrlExpires'],
    'Territory & Customer': ['territorySystem', 'requiresCustomerCreation'],
    'Delivery Types': ['canHomeDelivery', 'canStopDesk'],
    'Limits': ['maxWeightKg', 'maxBulkCreate', 'maxBulkValidate', 'supportedCurrencies'],
  };
  
  for (const [category, caps] of Object.entries(categories)) {
    console.log(`\n  ${category}:`);
    console.log(`  ${'-'.repeat(category.length + 2)}`);
    
    for (const cap of caps) {
      const value = capabilities[cap as keyof ProviderCapabilities];
      if (value !== undefined) {
        const conf = confidence[cap] || 'unknown';
        const confIcon = conf === 'high' ? '🟢' : conf === 'medium' ? '🟡' : '🔴';
        const valueStr = JSON.stringify(value);
        console.log(`  ${confIcon} ${cap}: ${valueStr}`);
        
        const capSources = sources[cap] || [];
        if (capSources.length > 0) {
          capSources.forEach(s => console.log(`     └─ ${s}`));
        }
      }
    }
  }
}

// ─── Main Execution ───────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 CAPABILITY EXTRACTION TOOL');
  console.log('=' .repeat(70));
  console.log('\nExtracting capabilities from test data...\n');
  
  const providersDir = path.join(process.cwd(), 'cod-server/src/endpoints/delivery-companies/providers');
  const providers = ['zr_express', 'yalidine', 'noest', 'ecotrack'];
  
  const extractions: CapabilityExtraction[] = [];
  
  for (const provider of providers) {
    const providerDir = path.join(providersDir, provider);
    
    if (!fs.existsSync(providerDir)) {
      console.log(`⚠️  Provider directory not found: ${provider}`);
      continue;
    }
    
    const extraction = await extractCapabilities(providerDir);
    extractions.push(extraction);
    generateReport(extraction);
  }
  
  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('EXTRACTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal providers analyzed: ${extractions.length}`);
  
  for (const extraction of extractions) {
    const highConf = Object.values(extraction.confidence).filter(c => c === 'high').length;
    const medConf = Object.values(extraction.confidence).filter(c => c === 'medium').length;
    const lowConf = Object.values(extraction.confidence).filter(c => c === 'low').length;
    const total = Object.keys(extraction.capabilities).length;
    
    console.log(`\n${extraction.provider}:`);
    console.log(`  Total capabilities: ${total}`);
    console.log(`  🟢 High confidence: ${highConf}`);
    console.log(`  🟡 Medium confidence: ${medConf}`);
    console.log(`  🔴 Low confidence: ${lowConf}`);
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Extraction complete!');
  console.log('\nNext steps:');
  console.log('  1. Review the extracted capabilities above');
  console.log('  2. Verify high-confidence capabilities');
  console.log('  3. Investigate medium/low-confidence capabilities');
  console.log('  4. Add capability exports to adapter files');
  console.log('='.repeat(70));
}

main().catch(console.error);
