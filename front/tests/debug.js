async function debug() {
  const { chromium } = await import("playwright");
  const email = process.env.E2E_RECEPTIONIST_EMAIL;
  const password = process.env.E2E_RECEPTIONIST_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_RECEPTIONIST_EMAIL and E2E_RECEPTIONIST_PASSWORD");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login as receptionist
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
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

debug().catch((error) => {
  console.error("Debug browser run failed:", error);
  process.exitCode = 1;
});
