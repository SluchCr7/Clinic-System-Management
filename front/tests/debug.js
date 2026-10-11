const { chromium } = require('playwright');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login as receptionist
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'ahmed@gmail.com');
  await page.fill('input[type="password"]', 'Ahmed1020304050');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('Receptionist on dashboard:', page.url());

  // Navigate to /visits
  await page.goto('http://localhost:3000/visits', { waitUntil: 'networkidle' });
  console.log('After /visits, URL:', page.url());
  const h1 = await page.$eval('h1', el => el.innerText).catch(() => 'no h1');
  console.log('h1 text:', h1);
  const body = await page.innerText('body');
  console.log('body excerpt:', body.slice(0, 300));
  await browser.close();
}
debug();
