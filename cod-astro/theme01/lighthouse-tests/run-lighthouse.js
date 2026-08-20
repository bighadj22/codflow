#!/usr/bin/env node

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';

// Test configuration
const BASE_URL = 'http://localhost:4321';
const OUTPUT_DIR = './reports';

// Pages to test
const PAGES = [
  { name: 'home', url: '/', description: 'Home page with featured products' },
  { name: 'products', url: '/products', description: 'All products listing' },
  { name: 'product-detail', url: '/products/test-product-1', description: 'Product detail page' },
  { name: 'category', url: '/category/electronics', description: 'Category page' },
  { name: 'thank-you', url: '/thank-you', description: 'Thank you page' }
];

// Lighthouse configurations
const CONFIGS = {
  mobile: {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'mobile',
      throttling: {
        rttMs: 150,
        throughputKbps: 1638.4,
        cpuSlowdownMultiplier: 4
      },
      screenEmulation: {
        mobile: true,
        width: 375,
        height: 667,
        deviceScaleFactor: 2
      }
    }
  },
  desktop: {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'desktop',
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1
      },
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1
      }
    }
  }
};

// Chrome launch options
const CHROME_FLAGS = [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding'
];

async function runLighthouse(url, config, outputPath) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: CHROME_FLAGS
  });

  try {
    const options = {
      logLevel: 'info',
      output: ['html', 'json'],
      port: chrome.port
    };

    console.log(`🔍 Testing: ${url}`);
    const runnerResult = await lighthouse(url, options, config);

    // Save HTML report
    const htmlPath = `${outputPath}.html`;
    fs.writeFileSync(htmlPath, runnerResult.report[0]);

    // Save JSON report
    const jsonPath = `${outputPath}.json`;
    fs.writeFileSync(jsonPath, runnerResult.report[1]);

    // Extract key metrics
    const lhr = runnerResult.lhr;
    const metrics = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
      fcp: lhr.audits['first-contentful-paint'].displayValue,
      lcp: lhr.audits['largest-contentful-paint'].displayValue,
      cls: lhr.audits['cumulative-layout-shift'].displayValue,
      fid: lhr.audits['max-potential-fid']?.displayValue || 'N/A',
      ttfb: lhr.audits['server-response-time']?.displayValue || 'N/A'
    };

    console.log(`✅ Performance: ${metrics.performance}% | Accessibility: ${metrics.accessibility}% | Best Practices: ${metrics.bestPractices}% | SEO: ${metrics.seo}%`);
    console.log(`   FCP: ${metrics.fcp} | LCP: ${metrics.lcp} | CLS: ${metrics.cls}`);

    return metrics;
  } finally {
    await chrome.kill();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => ['--mobile', '--desktop', '--all'].includes(arg)) || '--all';

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const results = [];

  console.log(`🚀 Starting Lighthouse tests (${mode.replace('--', '')})...`);
  console.log(`📊 Testing ${PAGES.length} pages`);
  console.log(`📁 Reports will be saved to: ${OUTPUT_DIR}`);
  console.log('');

  for (const page of PAGES) {
    const url = `${BASE_URL}${page.url}`;
    
    try {
      if (mode === '--mobile' || mode === '--all') {
        const outputPath = path.join(OUTPUT_DIR, `${page.name}-mobile-${timestamp}`);
        const metrics = await runLighthouse(url, CONFIGS.mobile, outputPath);
        results.push({ ...page, device: 'mobile', ...metrics, timestamp });
      }

      if (mode === '--desktop' || mode === '--all') {
        const outputPath = path.join(OUTPUT_DIR, `${page.name}-desktop-${timestamp}`);
        const metrics = await runLighthouse(url, CONFIGS.desktop, outputPath);
        results.push({ ...page, device: 'desktop', ...metrics, timestamp });
      }
    } catch (error) {
      console.error(`❌ Error testing ${page.name}: ${error.message}`);
    }

    console.log('');
  }

  // Save summary report
  const summaryPath = path.join(OUTPUT_DIR, `summary-${timestamp}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

  // Generate summary table
  console.log('📋 SUMMARY REPORT');
  console.log('='.repeat(80));
  console.log('Page'.padEnd(20) + 'Device'.padEnd(10) + 'Perf'.padEnd(6) + 'A11y'.padEnd(6) + 'BP'.padEnd(6) + 'SEO'.padEnd(6) + 'LCP'.padEnd(10));
  console.log('-'.repeat(80));

  results.forEach(result => {
    const row = [
      result.name.padEnd(20),
      result.device.padEnd(10),
      `${result.performance}%`.padEnd(6),
      `${result.accessibility}%`.padEnd(6),
      `${result.bestPractices}%`.padEnd(6),
      `${result.seo}%`.padEnd(6),
      result.lcp.padEnd(10)
    ].join('');
    console.log(row);
  });

  console.log('');
  console.log(`✅ Tests completed! Reports saved to: ${OUTPUT_DIR}`);
  console.log(`📊 Summary: ${summaryPath}`);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

main().catch(console.error);