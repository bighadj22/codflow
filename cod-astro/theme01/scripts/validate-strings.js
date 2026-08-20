#!/usr/bin/env node

/**
 * Theme01 String Validation Script
 * 
 * Scans all theme components and pages for hardcoded user-facing strings
 * that violate THEME_GUIDE.md Rule 1: "Never hardcode a visible string"
 * 
 * Usage: node scripts/validate-strings.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns that indicate user-facing strings (things users can see)
const USER_FACING_PATTERNS = [
  // Text content in HTML/JSX
  />\s*([A-Za-z][^<>{]*[A-Za-z])\s*</g,
  // Placeholder attributes
  /placeholder\s*=\s*["']([^"']+)["']/g,
  // Alt text
  /alt\s*=\s*["']([^"']+)["']/g,
  // Title attributes
  /title\s*=\s*["']([^"']+)["']/g,
  // Aria labels
  /aria-label\s*=\s*["']([^"']+)["']/g,
  // Button/link text in template literals
  /`([^`]*[A-Za-z][^`]*)`/g,
  // String literals that look like user text
  /"([A-Za-z][^"]*[A-Za-z])"/g,
  /'([A-Za-z][^']*[A-Za-z])'/g,
];

// Patterns to IGNORE (not user-facing)
const IGNORE_PATTERNS = [
  // CSS classes and IDs
  /class\s*=|className\s*=|id\s*=/,
  // HTML attributes (non-user-facing)
  /type\s*=|name\s*=|value\s*=|href\s*=|src\s*=|d\s*=/,
  // Import/export statements
  /import\s+|export\s+|from\s+/,
  // Variable names and object keys
  /const\s+|let\s+|var\s+|\w+:/,
  // CSS properties
  /:\s*[^;]+;/,
  // URLs and paths
  /https?:\/\/|\/[a-zA-Z]/,
  // File extensions
  /\.(js|ts|css|svg|png|jpg|jpeg|gif|webp|ico)["']/,
  // HTML tags
  /<\/?[a-zA-Z][^>]*>/,
  // Content prop usage (this is correct)
  /content\./,
  // Astro directives
  /data-astro|astro:/,
  // CSS variables
  /var\(--/,
  // Numbers and technical strings
  /^\d+$|^[a-f0-9-]+$/i,
  // Single characters or very short technical strings
  /^[a-zA-Z]$|^[a-zA-Z]{1,2}$/,
  // SVG path data
  /^[MmLlHhVvCcSsQqTtAaZz0-9\s\.\-,]+$/,
  // CSS class strings (common patterns)
  /^[a-z-]+(\s+[a-z-]+)*$/,
  // HTML rel attributes
  /noopener|noreferrer/,
];

// Exceptions - strings that are allowed to be hardcoded
const ALLOWED_STRINGS = [
  // Technical/system strings
  'UTF-8', 'viewport', 'width=device-width', 'initial-scale=1',
  'noindex', 'nofollow', 'summary_large_image', 'website',
  'ar_DZ', 'en_US', 'fr_FR',
  
  // Single characters and symbols
  '×', '−', '+', '🎉', '🚚', '💳', '⚡', '📞', '📦', '🎁',
  
  // CSS/HTML technical values
  'transparent', 'none', 'auto', 'inherit', 'initial',
  'block', 'inline', 'flex', 'grid', 'absolute', 'relative',
  
  // Astro/framework specific
  'astro:page-load', 'DOMContentLoaded',
  
  // Short technical identifiers
  'ar', 'en', 'fr', 'rtl', 'ltr',
  
  // Common single words that might be technical
  'loading', 'error', 'success', 'active', 'disabled',
];

// Files to scan
const SCAN_DIRECTORIES = [
  'src/theme/components',
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

class StringValidator {
  constructor() {
    this.violations = [];
    this.scannedFiles = 0;
    this.totalLines = 0;
  }

  /**
   * Check if a string should be ignored
   */
  shouldIgnoreString(str, context) {
    // Remove extra whitespace
    str = str.trim();
    
    // Skip empty or very short strings
    if (!str || str.length < 2) return true;
    
    // Skip if it's in allowed list
    if (ALLOWED_STRINGS.includes(str)) return true;
    
    // Skip technical patterns
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.test(context)) return true;
    }
    
    // Skip CSS class strings (these are not user-facing)
    if (/^[a-z-!]+(\s+[a-z-!\[\]\/\.\:0-9]+)*$/i.test(str)) return true;
    
    // Skip if it looks like a CSS class or technical identifier
    if (/^[a-z-]+(\s+[a-z-]+)*$/.test(str) && str.length < 50) return true;
    if (/^[a-z-!]+(\s+[a-z-!]+)*$/.test(str) && str.length < 50) return true;
    
    // Skip if it's all numbers or hex
    if (/^[\d\s\-\.]+$/.test(str)) return true;
    if (/^#?[0-9a-fA-F]+$/.test(str)) return true;
    
    // Skip single words that are likely technical
    if (!/\s/.test(str) && str.length < 8) {
      const technicalWords = [
        'button', 'input', 'form', 'div', 'span', 'img', 'svg', 'path',
        'header', 'footer', 'main', 'section', 'article', 'nav', 'aside',
        'true', 'false', 'null', 'undefined', 'void', 'return',
        'click', 'hover', 'focus', 'blur', 'submit', 'reset',
      ];
      if (technicalWords.includes(str.toLowerCase())) return true;
    }
    
    return false;
  }

  /**
   * Check if a line contains content prop usage (which is correct)
   */
  isUsingContentProp(line) {
    return /content\.\w+/.test(line);
  }

  /**
   * Extract potential user-facing strings from a line
   */
  extractStrings(line, lineNumber, filePath) {
    const violations = [];
    
    // Skip lines that use content props (these are correct)
    if (this.isUsingContentProp(line)) return violations;
    
    // Skip comment lines
    if (/^\s*\/\/|^\s*\/\*|^\s*\*/.test(line)) return violations;
    
    // Check for text content between tags
    const textMatches = line.matchAll(/>\s*([^<>{]+)\s*</g);
    for (const match of textMatches) {
      const text = match[1].trim();
      if (text && !this.shouldIgnoreString(text, line)) {
        // Check if it contains letters (likely user-facing)
        if (/[A-Za-z]/.test(text) && text.length > 1) {
          violations.push({
            type: 'HTML_TEXT',
            string: text,
            line: lineNumber,
            file: filePath,
            context: line.trim(),
            severity: 'HIGH'
          });
        }
      }
    }
    
    // Check for attribute values that are user-facing
    const attrPatterns = [
      { pattern: /placeholder\s*=\s*["']([^"']+)["']/g, type: 'PLACEHOLDER' },
      { pattern: /alt\s*=\s*["']([^"']+)["']/g, type: 'ALT_TEXT' },
      { pattern: /title\s*=\s*["']([^"']+)["']/g, type: 'TITLE' },
      { pattern: /aria-label\s*=\s*["']([^"']+)["']/g, type: 'ARIA_LABEL' },
    ];
    
    for (const { pattern, type } of attrPatterns) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const text = match[1];
        if (!this.shouldIgnoreString(text, line)) {
          violations.push({
            type,
            string: text,
            line: lineNumber,
            file: filePath,
            context: line.trim(),
            severity: 'HIGH'
          });
        }
      }
    }
    
    // Check for string literals that might be user-facing
    const stringPatterns = [
      /"([^"]+)"/g,
      /'([^']+)'/g,
      /`([^`]+)`/g,
    ];
    
    for (const pattern of stringPatterns) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const text = match[1];
        
        // Skip if it's clearly technical
        if (this.shouldIgnoreString(text, line)) continue;
        
        // Skip CSS class strings specifically
        if (/class\s*[:=]|className\s*[:=]/.test(line) && /^[a-z-!\[\]\/\.\:0-9\s]+$/i.test(text)) continue;
        
        // Check if it looks like user-facing text
        if (/[A-Za-z].*[A-Za-z]/.test(text) && text.length > 3) {
          // Additional checks for likely user text
          const hasSpaces = /\s/.test(text);
          const hasMultipleWords = text.split(/\s+/).length > 1;
          const looksLikeMessage = /^[A-Z]/.test(text) || hasMultipleWords;
          const isCssClass = /^[a-z-!\[\]\/\.\:0-9\s]+$/i.test(text);
          
          if ((looksLikeMessage || hasSpaces) && !isCssClass) {
            violations.push({
              type: 'STRING_LITERAL',
              string: text,
              line: lineNumber,
              file: filePath,
              context: line.trim(),
              severity: hasMultipleWords ? 'HIGH' : 'MEDIUM'
            });
          }
        }
      }
    }
    
    return violations;
  }

  /**
   * Scan a single file for string violations
   */
  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      this.totalLines += lines.length;
      
      lines.forEach((line, index) => {
        const violations = this.extractStrings(line, index + 1, filePath);
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
        } else if (stat.isFile() && /\.(astro|ts|js|tsx|jsx)$/.test(item)) {
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
    console.log('🔍 Scanning theme01 for hardcoded user-facing strings...\n');
    
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
      console.log('✅ SUCCESS: No hardcoded user-facing strings found!');
      console.log('🎉 Theme01 is fully compliant with THEME_GUIDE.md Rule 1\n');
      return true;
    } else {
      console.log('❌ VIOLATIONS FOUND:\n');
      
      // Group by severity
      const high = this.violations.filter(v => v.severity === 'HIGH');
      const medium = this.violations.filter(v => v.severity === 'MEDIUM');
      
      if (high.length > 0) {
        console.log(`🔴 HIGH PRIORITY (${high.length} violations):`);
        high.forEach(v => this.printViolation(v));
        console.log();
      }
      
      if (medium.length > 0) {
        console.log(`🟡 MEDIUM PRIORITY (${medium.length} violations):`);
        medium.forEach(v => this.printViolation(v));
        console.log();
      }
      
      console.log('💡 To fix these violations:');
      console.log('1. Add the string to src/theme/content/types.ts');
      console.log('2. Add translations to ar.ts, en.ts, and fr.ts');
      console.log('3. Replace hardcoded string with {content.keyName}');
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
    console.log(`     Type: ${violation.type}`);
    console.log(`     String: "${violation.string}"`);
    console.log(`     Context: ${violation.context}`);
    console.log();
  }
}

// Run the validator
const validator = new StringValidator();
const isValid = validator.validate();

// Exit with appropriate code
process.exit(isValid ? 0 : 1);