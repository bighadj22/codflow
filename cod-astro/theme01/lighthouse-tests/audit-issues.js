#!/usr/bin/env node

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const BASE_URL = 'http://localhost:4321';

async function auditIssues() {
  console.log('🔍 DETAILED LIGHTHOUSE AUDIT');
  console.log('============================');
  console.log('Finding specific issues to fix for 100% scores');
  console.log('');

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
          cpuSlowdownMultiplier: 2
        }
      }
    };

    const url = `${BASE_URL}/`;
    console.log(`🔍 Auditing: ${url}`);
    
    const runnerResult = await lighthouse(url, options, config);
    const lhr = runnerResult.lhr;

    // Analyze each category
    const categories = ['accessibility', 'best-practices', 'seo'];
    
    for (const categoryId of categories) {
      const category = lhr.categories[categoryId];
      const score = Math.round(category.score * 100);
      
      console.log(`\n📊 ${category.title.toUpperCase()}: ${score}%`);
      console.log('='.repeat(50));
      
      if (score < 100) {
        console.log('❌ FAILED AUDITS:');
        
        // Find failed audits
        for (const auditRef of category.auditRefs) {
          const audit = lhr.audits[auditRef.id];
          
          if (audit.score !== null && audit.score < 1) {
            console.log(`\n🔴 ${audit.title}`);
            console.log(`   Score: ${Math.round(audit.score * 100)}%`);
            
            if (audit.description) {
              console.log(`   Issue: ${audit.description}`);
            }
            
            if (audit.details && audit.details.items) {
              console.log('   Details:');
              audit.details.items.slice(0, 3).forEach((item, i) => {
                if (item.node && item.node.snippet) {
                  console.log(`     ${i + 1}. ${item.node.snippet}`);
                } else if (typeof item === 'string') {
                  console.log(`     ${i + 1}. ${item}`);
                } else if (item.url) {
                  console.log(`     ${i + 1}. ${item.url}`);
                }
              });
            }
          }
        }
      } else {
        console.log('✅ All audits passed!');
      }
    }

    console.log('\n🎯 SUMMARY OF FIXES NEEDED:');
    console.log('='.repeat(50));
    
    let fixesNeeded = [];
    
    // Check specific common issues
    const accessibilityAudits = [
      'color-contrast',
      'heading-order',
      'html-has-lang',
      'image-alt',
      'label',
      'link-name',
      'meta-viewport'
    ];
    
    const bestPracticesAudits = [
      'is-on-https',
      'uses-http2',
      'no-vulnerable-libraries',
      'doctype',
      'charset'
    ];
    
    const seoAudits = [
      'document-title',
      'meta-description',
      'http-status-code',
      'link-text',
      'crawlable-anchors',
      'is-crawlable',
      'robots-txt',
      'tap-targets',
      'hreflang',
      'plugins',
      'canonical'
    ];

    // Check each audit
    [...accessibilityAudits, ...bestPracticesAudits, ...seoAudits].forEach(auditId => {
      const audit = lhr.audits[auditId];
      if (audit && audit.score !== null && audit.score < 1) {
        fixesNeeded.push({
          category: accessibilityAudits.includes(auditId) ? 'Accessibility' : 
                   bestPracticesAudits.includes(auditId) ? 'Best Practices' : 'SEO',
          audit: audit.title,
          description: audit.description
        });
      }
    });

    if (fixesNeeded.length === 0) {
      console.log('🎉 No issues found! All scores should be 100%');
    } else {
      fixesNeeded.forEach((fix, i) => {
        console.log(`${i + 1}. [${fix.category}] ${fix.audit}`);
        console.log(`   ${fix.description}`);
        console.log('');
      });
    }

  } finally {
    await chrome.kill();
  }
}

auditIssues().catch(console.error);