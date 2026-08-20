#!/usr/bin/env node

import express from 'express';
import expressStaticGzip from 'express-static-gzip';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4321;

// Serve the built Astro site with gzip support
const distPath = path.join(__dirname, '../dist');

app.use('/', expressStaticGzip(distPath, {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
  setHeaders: (res, path) => {
    // Set proper headers for performance testing
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Handle client-side routing (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Local server running at http://localhost:${PORT}`);
  console.log(`📁 Serving from: ${distPath}`);
  console.log('');
  console.log('Ready for Lighthouse testing! 🔍');
  console.log('');
  console.log('Available pages:');
  console.log('  • http://localhost:4321/ (Home)');
  console.log('  • http://localhost:4321/products (Products)');
  console.log('  • http://localhost:4321/products/test-product-1 (Product Detail)');
  console.log('  • http://localhost:4321/category/electronics (Category)');
  console.log('  • http://localhost:4321/thank-you (Thank You)');
  console.log('');
  console.log('Run tests with:');
  console.log('  npm run test        # Test all pages (mobile + desktop)');
  console.log('  npm run test:mobile # Test mobile only');
  console.log('  npm run test:desktop # Test desktop only');
});