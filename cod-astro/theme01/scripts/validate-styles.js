#!/usr/bin/env node

/**
 * Theme01 Style Validation Script
 * 
 * Scans all theme components and pages for hardcoded colors, radius, fonts, and spacing
 * that violate THEME_GUIDE.md Rule 2: "Never hardcode a color, radius, font, or spacing value"
 * 
 * Usage: node scripts/validate-styles.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns that indicate hardcoded style values
const STYLE_VIOLATION_PATTERNS = [
  // Hex colors
  {
    pattern: /#[0-9a-fA-F]{3,8}/g,
    type: 'HEX_COLOR',
    description: 'Hardcoded hex color'
  },
  // RGB/RGBA colors
  {
    pattern: /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g,
    type: 'RGB_COLOR',
    description: 'Hardcoded RGB/RGBA color'
  },
  // HSL colors
  {
    pattern: /hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%/g,
    type: 'HSL_COLOR',
    description: 'Hardcoded HSL/HSLA color'
  },
  // Hardcoded border-radius values (not using CSS variables)
  {
    pattern: /border-radius\s*:\s*[0-9]/g,
    type: 'BORDER_RADIUS',
    description: 'Hardcoded border-radius'
  },
  // Hardcoded font-family (not using CSS variables)
  {
    pattern: /font-family\s*:\s*[^v]/g,
    type: 'FONT_FAMILY',
    description: 'Hardcoded font-family'
  },
  // Hardcoded font-size in CSS (px/rem/em values)
  {
    pattern: /font-size\s*:\s*\d+(\.\d+)?(px|rem|em)/g,
    type: 'FONT_SIZE',
    description: 'Hardcoded font-size'
  },
  // Hardcoded background colors (not using CSS variables)
  {
    pattern: /background(-color)?\s*:\s*[^v][^a][^r]/g,
    type: 'BACKGROUND_COLOR',
    description: 'Hardcoded background color'
  },
  // Hardcoded text colors (not using CSS variables)
  {
    pattern: /color\s*:\s*[^v][^a][^r]/g,
    type: 'TEXT_COLOR',
    description: 'Hardcoded text color'
  },
  // Hardcoded border colors (not using CSS variables)
  {
    pattern: /border(-color)?\s*:\s*[^v][^a][^r]/g,
    type: 'BORDER_COLOR',
    description: 'Hardcoded border color'
  },
];

// Patterns to IGNORE (acceptable cases)
const IGNORE_PATTERNS = [
  // CSS variable definitions (these are the design system)
  /--[a-zA-Z-]+\s*:/,
  // CSS variable usage (this is correct)
  /var\(--/,
  // Comments
  /\/\*[\s\S]*?\*\/|\/\/.*$/,
  // Import statements
  /import\s+|export\s+/,
  // Astro directives
  /data-astro|astro:/,
  // HTML attributes that aren't styles
  /type\s*=|name\s*=|id\s*=|class\s*=/,
  // URLs and paths
  /https?:\/\/|url\(/,
  // SVG path data
  /^[MmLlHhVvCcSsQqTtAaZz0-9\s\.\-,]+$/,
];

// Exceptions - values that are allowed to be hardcoded
const ALLOWED_VALUES = [
  // Transparent and none
  'transparent', 'none', 'inherit', 'initial', 'unset', 'auto',
  
  // Common CSS keywords
  'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset',
  'block', 'inline', 'flex', 'grid', 'absolute', 'relative', 'fixed', 'sticky',
  
  // Zero values (always acceptable)
  '0', '0px', '0rem', '0em', '0%',
  
  // System fonts (acceptable fallbacks)
  'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'sans-serif', 'serif', 'monospace',
  
  // CSS functions that are acceptable
  'calc(', 'min(', 'max(', 'clamp(', 'color-mix(',
  
  // Specific acceptable values in our design system
  'white', 'black', // Only when used with color-mix() or as fallbacks
];

// Files to scan
const SCAN_DIRECTORIES = [
  'src/theme/components',
  'src/theme/styles',
  'src/pages',
];

// Files to exclude
const EXCLUDE_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /node_modules/,
  /\.git/,
  /dist/,
  /\.md$/,
];

class StyleValidator {
  constructor() {
    this.violations = [];
    this.scannedFiles = 0;
    this.totalLines = 0;
  }

  /**
   * Check if a value should be ignored
   */
  shouldIgnoreValue(value, context, line) {
    // Remove extra whitespace
    value = value.trim();
    
    // Skip if it's in allowed list
    if (ALLOWED_VALUES.some(allowed => value.includes(allowed))) return true;
    
    // Skip if context matches ignore patterns
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.test(context) || pattern.test(line)) return true;
    }
    
    // Skip if it's a CSS variable usage
    if (value.includes('var(--')) return true;
    
    // Skip if it's in a comment
    if (line.includes('/*') || line.includes('//')) return true;
    
    // Skip if it's in global.css :root (design system definitions)
    if (context.includes(':root') && line.includes('--')) return true;
    
    // Skip if it's a fallback value in var()
    if (context.includes('var(') && value.includes(',')) return true;
    
    // Skip dynamic color values from product data
    if (line.includes('hexColor') || line.includes('val.hexColor')) return true;
    
    // Skip acceptable CSS keywords
    if (['white', 'black', 'none', 'inherit', 'initial', 'unset'].includes(value)) return true;
    
    return false;
  }

  /**
   * Extract style violations from a line
   */
  extractViolations(line, lineNumber, filePath) {
    const violations = [];
    
    // Skip comment lines
    if (/^\s*\/\/|^\s*\/\*|^\s*\*/.test(line)) return violations;
    
    // Check each violation pattern
    for (const { pattern, type, description } of STYLE_VIOLATION_PATTERNS) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const value = match[0];
        
        if (!this.shouldIgnoreValue(value, match.input, line)) {
          // Special handling for different types
          let severity = 'HIGH';
          let shouldReport = true;
          
          // Additional context-specific checks
          if (type === 'HEX_COLOR') {
            // Allow hex colors in comments (documentation)
            if (line.includes('*') || line.includes('//')) shouldReport = false;
            // Allow hex colors in config files (default values)
            if (filePath.includes('config') || filePath.includes('store.ts')) shouldReport = false;
            // Allow hex colors in layout files (fallback values)
            if (filePath.includes('StoreLayout.astro') && line.includes('HEX.test')) shouldReport = false;
            // Allow hex colors in :root definitions (design system)
            if (line.includes('--clr-') || line.includes(':root')) shouldReport = false;
          }
          
          if (type === 'RGB_COLOR' || type === 'HSL_COLOR') {
            // Allow in shadow definitions in global.css
            if (filePath.includes('global.css') && line.includes('shadow')) shouldReport = false;
            // Allow in overlay definitions
            if (line.includes('overlay') || line.includes('--overlay')) shouldReport = false;
            // Allow in :root definitions
            if (line.includes('--clr-') || line.includes(':root')) shouldReport = false;
          }
          
          if (type === 'BACKGROUND_COLOR' || type === 'TEXT_COLOR' || type === 'BORDER_COLOR') {
            // Allow if using color-mix() function
            if (line.includes('color-mix(')) shouldReport = false;
            // Allow if it's a CSS variable
            if (value.includes('var(--')) shouldReport = false;
            // Allow dynamic values from data
            if (line.includes('hexColor') || line.includes('${')) shouldReport = false;
            // Allow in utility classes in global.css
            if (filePath.includes('global.css') && (line.includes('.') || line.includes(':'))) shouldReport = false;
          }
          
          if (type === 'FONT_SIZE' || type === 'BORDER_RADIUS') {
            // Allow in utility classes in global.css
            if (filePath.includes('global.css')) shouldReport = false;
          }
          
          if (shouldReport) {
            violations.push({
              type,
              description,
              value,
              line: lineNumber,
              file: filePath,
              context: line.trim(),
              severity
            });
          }
        }
      }
    }
    
    return violations;
  }

  /**
   * Scan a single file for style violations
   */
  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      this.totalLines += lines.length;
      
      lines.forEach((line, index) => {
        const violations = this.extractViolations(line, index + 1, filePath);
        this.violations.push(...violations);
      });
      
      this.scannedFiles++;
    } catch (error) {
      console.error(`Error scanning ${filePath}:`, error.message);
    }
  }

  /**
   * Recursively scan directory
   */
  scanDirectory(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        // Skip excluded patterns
        if (EXCLUDE_PATTERNS.some(pattern => pattern.test(fullPath))) {
          continue;
        }
        
        if (stat.isDirectory()) {
          this.scanDirectory(fullPath);
        } else if (stat.isFile() && /\.(astro|css|ts|js|tsx|jsx)$/.test(item)) {
          this.scanFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Run the validation
   */
  validate() {
    console.log('🎨 Scanning theme01 for hardcoded style values...\n');
    
    const startTime = Date.now();
    
    // Scan each directory
    for (const dir of SCAN_DIRECTORIES) {
      const fullPath = path.resolve(__dirname, '..', dir);
      if (fs.existsSync(fullPath)) {
        console.log(`📁 Scanning ${dir}...`);
        this.scanDirectory(fullPath);
      } else {
        console.log(`⚠️  Directory not found: ${dir}`);
      }
    }
    
    const endTime = Date.now();
    
    // Report results
    console.log(`\n📊 Scan completed in ${endTime - startTime}ms`);
    console.log(`📄 Files scanned: ${this.scannedFiles}`);
    console.log(`📝 Lines scanned: ${this.totalLines.toLocaleString()}`);
    console.log(`🚨 Violations found: ${this.violations.length}\n`);
    
    if (this.violations.length === 0) {
      console.log('✅ SUCCESS: No hardcoded style values found!');
      console.log('🎉 Theme01 is fully compliant with THEME_GUIDE.md Rule 2\n');
      return true;
    } else {
      console.log('❌ VIOLATIONS FOUND:\n');
      
      // Group by type
      const byType = {};
      this.violations.forEach(v => {
        if (!byType[v.type]) byType[v.type] = [];
        byType[v.type].push(v);
      });
      
      Object.entries(byType).forEach(([type, violations]) => {
        console.log(`🔴 ${type} (${violations.length} violations):`);
        violations.forEach(v => this.printViolation(v));
        console.log();
      });
      
      console.log('💡 To fix these violations:');
      console.log('1. Replace hardcoded values with CSS variables from global.css');
      console.log('2. Use var(--clr-primary), var(--radius-btn), etc.');
      console.log('3. Add new tokens to :root in global.css if needed');
      console.log('4. Re-run this script to verify fixes\n');
      
      return false;
    }
  }

  /**
   * Print a violation in a readable format
   */
  printViolation(violation) {
    const relativePath = path.relative(process.cwd(), violation.file);
    console.log(`  📍 ${relativePath}:${violation.line}`);
    console.log(`     ${violation.description}: ${violation.value}`);
    console.log(`     Context: ${violation.context}`);
    console.log();
  }
}

// Run the validator
const validator = new StyleValidator();
const isValid = validator.validate();

// Exit with appropriate code
process.exit(isValid ? 0 : 1);