const { chromium } = require('playwright');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3001/api';

const USERS = {
  admin: {
    email: 'ahmedking10710@gmail.com',
    password: 'Ahmed1020304050',
    role: 'admin',
  },
  doctor: {
    email: 'ahmedabobakr2972004@gmail.com',
    password: 'Ahmed1020304050',
    role: 'doctor',
  },
  receptionist: {
    email: 'ahmed@gmail.com',
    password: 'Ahmed1020304050',
    role: 'receptionist',
  },
};

const results = [];

function record(name, status, details = '') {
  results.push({ name, status, details });
  console.log(`[${status}] ${name} ${details ? '- ' + details : ''}`);
}

async function testAuthAndSession(browser) {
  console.log('\n--- PHASE 3: AUTHENTICATION AND SESSION TESTING ---');
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Visit Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    assert(page.url().includes('/login'), 'Should be on login page');

    // Fill credentials
    await page.fill('input[type="email"]', USERS.admin.email);
    await page.fill('input[type="password"]', USERS.admin.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard navigation
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    record('Admin Login & Redirection', 'PASS', `Landed on ${page.url()}`);

    // Verify session persistence upon reload
    await page.reload({ waitUntil: 'networkidle' });
    assert(page.url().includes('/dashboard'), 'Should stay on /dashboard after reload');
    record('Session Persistence on Reload', 'PASS', 'Remained authenticated');

    // Verify cookies are present and HttpOnly
    const cookies = await context.cookies();
    const accessCookie = cookies.find((c) => c.name === 'accessToken');
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    assert(accessCookie && accessCookie.httpOnly, 'AccessToken must be HttpOnly');
    assert(refreshCookie && refreshCookie.httpOnly, 'RefreshToken must be HttpOnly');
    record('HttpOnly Cookies Verified', 'PASS', 'accessToken and refreshToken are HttpOnly');

    // Test Logout via API /auth/logout
    await page.evaluate(async () => {
      await fetch('http://localhost:3001/api/auth/logout', { method: 'POST', credentials: 'include' });
    });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 10000 });
    record('Session Revocation & Protected Route Interception', 'PASS', 'Unauthenticated user redirected to /login');
  } catch (err) {
    record('Auth & Session Testing', 'FAIL', err.message);
  } finally {
    await context.close();
  }
}

async function testRBACAndPrivacy(browser) {
  console.log('\n--- PHASE 4: ROLE-BASED ACCESS & CLINICAL PRIVACY ---');

  // Helper login
  async function loginAs(user) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    return { context, page };
  }

  // 1. Receptionist RBAC
  const { context: recContext, page: recPage } = await loginAs(USERS.receptionist);
  try {
    // Check navigation items (Visits & Lab orders should NOT be present)
    const visitsNav = await recPage.$('a[href="/visits"]');
    const labNav = await recPage.$('a[href="/lab-orders"]');
    assert(!visitsNav, 'Receptionist must not see Visits navigation in sidebar');
    assert(!labNav, 'Receptionist must not see Lab Orders navigation in sidebar');
    record('Receptionist Sidebar Privacy Filtering', 'PASS', 'Visits and Lab Orders links are hidden');

    // Direct URL Navigation to /visits
    await recPage.goto(`${BASE_URL}/visits`, { waitUntil: 'networkidle' });
    const h1Visit = await recPage.$eval('h1', el => el.innerText).catch(() => '');
    assert(
      h1Visit.includes('رفض') || h1Visit.includes('Denied') || h1Visit.includes('denied'),
      `Direct navigation to /visits should be denied for receptionist (got: ${h1Visit})`
    );
    record('Receptionist Direct Route Guard (/visits)', 'PASS', `Rendered: "${h1Visit}"`);

    // Direct URL Navigation to /lab-orders
    await recPage.goto(`${BASE_URL}/lab-orders`, { waitUntil: 'networkidle' });
    const h1Lab = await recPage.$eval('h1', el => el.innerText).catch(() => '');
    assert(
      h1Lab.includes('رفض') || h1Lab.includes('Denied') || h1Lab.includes('denied'),
      `Direct navigation to /lab-orders should be denied for receptionist (got: ${h1Lab})`
    );
    record('Receptionist Direct Route Guard (/lab-orders)', 'PASS', `Rendered: "${h1Lab}"`);

    // API-Level verification (HTTP 403 Forbidden)
    const apiVisitRes = await recPage.evaluate(async () => {
      const res = await fetch('http://localhost:3001/api/visits', { credentials: 'include' });
      return { status: res.status, json: await res.json() };
    });
    assert.strictEqual(apiVisitRes.status, 403, 'GET /api/visits must return 403 for receptionist');
    record('API RBAC Enforcement: GET /api/visits', 'PASS', `Returned status 403 (${apiVisitRes.json.code || 'FORBIDDEN'})`);

    const apiLabRes = await recPage.evaluate(async () => {
      const res = await fetch('http://localhost:3001/api/lab-orders', { credentials: 'include' });
      return { status: res.status, json: await res.json() };
    });
    assert.strictEqual(apiLabRes.status, 403, 'GET /api/lab-orders must return 403 for receptionist');
    record('API RBAC Enforcement: GET /api/lab-orders', 'PASS', `Returned status 403 (${apiLabRes.json.code || 'FORBIDDEN'})`);
  } catch (err) {
    record('Receptionist RBAC Verification', 'FAIL', err.message);
  } finally {
    await recContext.close();
  }

  // 2. Doctor RBAC
  const { context: docContext, page: docPage } = await loginAs(USERS.doctor);
  try {
    // Doctor should have access to /visits
    await docPage.goto(`${BASE_URL}/visits`, { waitUntil: 'networkidle' });
    assert(docPage.url().includes('/visits'), 'Doctor should access /visits');
    record('Doctor Clinical Access (/visits)', 'PASS', 'Successfully opened /visits');

    // Doctor should NOT have access to /users
    await docPage.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle' });
    const h1Users = await docPage.$eval('h1', el => el.innerText).catch(() => '');
    assert(
      h1Users.includes('رفض') || h1Users.includes('Denied') || h1Users.includes('denied'),
      `Doctor should not access /users (got: ${h1Users})`
    );
    record('Doctor Admin Route Guard (/users)', 'PASS', `Rendered: "${h1Users}"`);

    // API-Level verification: Doctor denied from /api/users
    const apiUsersRes = await docPage.evaluate(async () => {
      const res = await fetch('http://localhost:3001/api/users', { credentials: 'include' });
      return { status: res.status, json: await res.json() };
    });
    assert.strictEqual(apiUsersRes.status, 403, 'GET /api/users must return 403 for doctor');
    record('API RBAC Enforcement: GET /api/users', 'PASS', `Doctor denied with status 403 (${apiUsersRes.json.code || 'FORBIDDEN'})`);
  } catch (err) {
    record('Doctor RBAC Verification', 'FAIL', err.message);
  } finally {
    await docContext.close();
  }
}

async function testResponsiveLayouts(browser) {
  console.log('\n--- PHASE 7: RESPONSIVE UI AND VIEWPORT INTEGRITY ---');
  const context = await browser.newContext();
  const page = await context.newPage();

  const viewports = [
    { name: 'Mobile (375x667)', width: 375, height: 667 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    { name: 'Wide (1920x1080)', width: 1920, height: 1080 },
  ];

  try {
    // Login as admin first
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', USERS.admin.email);
    await page.fill('input[type="password"]', USERS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const routesToCheck = ['/dashboard', '/patients', '/appointments', '/invoices'];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of routesToCheck) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
        // Check for horizontal overflow
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        assert(!hasHorizontalScroll, `Horizontal overflow detected on ${route} at ${vp.name}`);
      }
      record(`Responsive Layout: ${vp.name}`, 'PASS', `All ${routesToCheck.length} routes checked with 0 horizontal overflow`);
    }
  } catch (err) {
    record('Responsive UI Testing', 'FAIL', err.message);
  } finally {
    await context.close();
  }
}

async function runE2E() {
  console.log('Starting End-to-End Browser Automation Suite...');
  const browser = await chromium.launch({ headless: true });
  try {
    await testAuthAndSession(browser);
    await testRBACAndPrivacy(browser);
    await testResponsiveLayouts(browser);
  } finally {
    await browser.close();
  }

  console.log('\n========================================');
  console.log('           TEST RESULTS SUMMARY         ');
  console.log('========================================');
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'PASS') passed++;
    else failed++;
  }
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runE2E().catch((err) => {
  console.error('E2E Suite Crashed:', err);
  process.exit(1);
});
