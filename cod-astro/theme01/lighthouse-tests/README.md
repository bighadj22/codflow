# 🔍 Lighthouse Testing Suite for Theme01

Comprehensive Lighthouse testing setup to monitor performance, accessibility, SEO, and best practices for your Astro e-commerce theme.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd lighthouse-tests
npm install
```

### 2. Option A: Test Astro Dev Server (Quick)
```bash
# In terminal 1: Start Astro dev server
cd ..
npm run dev

# In terminal 2: Test dev server
cd lighthouse-tests
npm run test:dev
```

### 2. Option B: Test Production Build (Accurate)
```bash
# Build your Astro site
cd ..
npm run build

# Start local production server
cd lighthouse-tests
npm run serve

# Run full Lighthouse tests
npm run test
```

## 📊 What Gets Tested

### Pages Tested:
- **Home** (`/`) - Featured products and hero
- **Products** (`/products`) - All products listing
- **Product Detail** (`/products/test-product-1`) - Individual product
- **Category** (`/category/electronics`) - Category filtering
- **Thank You** (`/thank-you`) - Order confirmation

### Metrics Measured:
- **Performance** - Core Web Vitals (LCP, FID, CLS)
- **Accessibility** - WCAG compliance, screen reader support
- **Best Practices** - Security, modern standards
- **SEO** - Meta tags, structured data, crawlability

### Core Web Vitals:
- **FCP** (First Contentful Paint) - Time to first content
- **LCP** (Largest Contentful Paint) - Time to main content
- **CLS** (Cumulative Layout Shift) - Visual stability
- **FID** (First Input Delay) - Interactivity
- **TTFB** (Time to First Byte) - Server response

## 📁 Output Structure

```
lighthouse-tests/
├── reports/
│   ├── home-mobile-2024-04-27T10-30-00.html
│   ├── home-mobile-2024-04-27T10-30-00.json
│   ├── home-desktop-2024-04-27T10-30-00.html
│   ├── home-desktop-2024-04-27T10-30-00.json
│   ├── products-mobile-2024-04-27T10-30-00.html
│   ├── products-desktop-2024-04-27T10-30-00.html
│   └── summary-2024-04-27T10-30-00.json
├── package.json
├── run-lighthouse.js
├── serve-local.js
└── README.md
```

## 📋 Sample Output

```
🚀 Starting Lighthouse tests (all)...
📊 Testing 5 pages

🔍 Testing: http://localhost:4321/
✅ Performance: 98% | Accessibility: 100% | Best Practices: 100% | SEO: 100%
   FCP: 0.8s | LCP: 1.2s | CLS: 0.001

🔍 Testing: http://localhost:4321/products
✅ Performance: 95% | Accessibility: 100% | Best Practices: 100% | SEO: 100%
   FCP: 0.9s | LCP: 1.4s | CLS: 0.002

📋 SUMMARY REPORT
================================================================================
Page                Device    Perf  A11y  BP    SEO   LCP       
--------------------------------------------------------------------------------
home                mobile    98%   100%  100%  100%  1.2s      
home                desktop   99%   100%  100%  100%  0.8s      
products            mobile    95%   100%  100%  100%  1.4s      
products            desktop   97%   100%  100%  100%  1.0s      
```

## 🎯 Performance Targets

### Excellent Scores:
- **Performance**: 90-100%
- **Accessibility**: 95-100%
- **Best Practices**: 90-100%
- **SEO**: 90-100%

### Core Web Vitals Targets:
- **LCP**: < 2.5s (Good), < 4.0s (Needs Improvement)
- **FID**: < 100ms (Good), < 300ms (Needs Improvement)
- **CLS**: < 0.1 (Good), < 0.25 (Needs Improvement)

## 🔧 Configuration

### Adding New Pages
Edit `PAGES` array in `run-lighthouse.js`:

```javascript
const PAGES = [
  { name: 'home', url: '/', description: 'Home page' },
  { name: 'about', url: '/about', description: 'About page' },
  // Add your pages here
];
```

### Custom Lighthouse Config
Modify `CONFIGS` object in `run-lighthouse.js`:

```javascript
const CONFIGS = {
  mobile: {
    extends: 'lighthouse:default',
    settings: {
      // Custom mobile settings
    }
  }
};
```

## 📈 Monitoring & CI/CD

### GitHub Actions Integration
Add to `.github/workflows/lighthouse.yml`:

```yaml
name: Lighthouse Tests
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: cd lighthouse-tests && npm install
      - run: cd lighthouse-tests && npm run test
```

### Automated Monitoring
Set up cron jobs to run tests regularly:

```bash
# Run tests daily at 2 AM
0 2 * * * cd /path/to/project/lighthouse-tests && npm run test
```

## 🐛 Troubleshooting

### Chrome Launch Issues
If Chrome fails to launch:

```bash
# Install Chrome dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# Or use system Chrome
export CHROME_PATH=/usr/bin/google-chrome
```

### Port Already in Use
Change port in `serve-local.js`:

```javascript
const PORT = 4321; // Theme01's dev/prod server port
```

### Memory Issues
Increase Node.js memory:

```bash
node --max-old-space-size=4096 run-lighthouse.js
```

## 📚 Resources

- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Core Web Vitals](https://web.dev/vitals/)
- [Astro Performance Guide](https://docs.astro.build/en/guides/performance/)
- [Web.dev Performance](https://web.dev/performance/)

## 🎯 Next Steps

1. **Baseline Testing** - Run initial tests to establish baseline
2. **Regular Monitoring** - Set up automated testing schedule
3. **Performance Budget** - Define acceptable score thresholds
4. **Optimization** - Use reports to identify improvement areas
5. **CI Integration** - Add to deployment pipeline

---

**Happy Testing! 🚀**