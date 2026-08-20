#!/usr/bin/env node

/**
 * Theme01 Comprehensive Validation Script
 * 
 * Runs all validation checks for THEME_GUIDE.md compliance:
 * - Rule 1: No hardcoded user-facing strings
 * - Rule 2: No hardcoded colors, radius, fonts, or spacing
 * 
 * Usage: node scripts/validate-all.js
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Running comprehensive theme01 validation...\n');

let allPassed = true;

// Run string validation
console.log('📝 Checking Rule 1: No hardcoded user-facing strings');
console.log('═'.repeat(60));
try {
  execSync('node scripts/validate-strings.js', { 
    stdio: 'inherit',
    cwd: path.dirname(__dirname)
  });
  console.log('✅ Rule 1: PASSED\n');
} catch (error) {
  console.log('❌ Rule 1: FAILED\n');
  allPassed = false;
}

// Run style validation
console.log('🎨 Checking Rule 2: No hardcoded colors, radius, fonts, or spacing');
console.log('═'.repeat(60));
try {
  execSync('node scripts/validate-styles.js', { 
    stdio: 'inherit',
    cwd: path.dirname(__dirname)
  });
  console.log('✅ Rule 2: PASSED\n');
} catch (error) {
  console.log('❌ Rule 2: FAILED\n');
  allPassed = false;
}

// Final result
console.log('📊 FINAL VALIDATION RESULTS');
console.log('═'.repeat(60));

if (allPassed) {
  console.log('🎉 SUCCESS: Theme01 is 100% compliant with THEME_GUIDE.md!');
  console.log('✅ Rule 1: No hardcoded user-facing strings');
  console.log('✅ Rule 2: No hardcoded colors, radius, fonts, or spacing');
  console.log('\n🚀 Theme01 is ready for production!');
  process.exit(0);
} else {
  console.log('❌ FAILURE: Theme01 has compliance violations');
  console.log('💡 Please fix the violations above and re-run this script');
  process.exit(1);
}