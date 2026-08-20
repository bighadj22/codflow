#!/usr/bin/env node

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

// Test against Astro dev server
const BASE_URL = 'http://localhost:4321';

// Pages to test (using real product data from your local dev)
const PAGES = [
  { name: 'home', url: '/', description: 'Home page with featured products' },
  { name: 'products', url: '/products', description: 'All products listing' },
  // Note: We'll test with actual product slugs from your dev data
];

async function testDevServer() {
  console.log('🔍 Testing Astro Dev Server');
  console.log('============================');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log('');

  // Check if dev server is running
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    console.log('✅ Dev server is running!');
  } catch (error) {
    console.error('❌ Dev server is not running!');
    console.log('');
    console.log('💡 Start your Astro dev server first:');
    console.log('   cd ..');
    console.log('   npm run dev');
    console.log('');
    process.exit(1);
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const options = {
      logLevel: 'info',
      output: 'json',
      port: chrome.port
    };

    const config = {
      extends: 'lighthouse:default',
      settings: {
        formFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 2 // Less aggressive for dev testing
        }
      }
    };

    console.log('🚀 Running Lighthouse tests...');
    console.log('');

    for (const page of PAGES) {
      const url = `${BASE_URL}${page.url}`;
      
      try {
        console.log(`🔍 Testing: ${page.name} (${url})`);
        
        const runnerResult = await lighthouse(url, options, config);
        const lhr = runnerResult.lhr;

        const scores = {
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100)
        };

        const fcp = lhr.audits['first-contentful-paint'].displayValue;
        const lcp = lhr.audits['largest-contentful-paint'].displayValue;
        const cls = lhr.audits['cumulative-layout-shift'].displayValue;

        console.log(`   📊 Performance: ${scores.performance}% | Accessibility: ${scores.accessibility}% | Best Practices: ${scores.bestPractices}% | SEO: ${scores.seo}%`);
        console.log(`   ⚡ FCP: ${fcp} | LCP: ${lcp} | CLS: ${cls}`);
        
        // Performance feedback
        if (scores.performance >= 90) {
          console.log('   🎉 Excellent performance!');
        } else if (scores.performance >= 70) {
          console.log('   👍 Good performance!');
        } else {
          console.log('   ⚠️  Performance could be improved');
        }

        console.log('');
        
      } catch (error) {
        console.error(`   ❌ Error testing ${page.name}: ${error.message}`);
        console.log('');
      }
    }

    console.log('✅ Dev server testing complete!');
    console.log('');
    console.log('💡 Tips:');
    console.log('   • Dev server scores are typically lower than production');
    console.log('   • Run production build tests for accurate results');
    console.log('   • Use npm run test for full production testing');

  } finally {
    await chrome.kill();
  }
}

testDevServer().catch(console.error);