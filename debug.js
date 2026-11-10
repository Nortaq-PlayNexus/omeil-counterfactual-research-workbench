const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  const btns = await page.locator('button').allTextContents();
  console.log(JSON.stringify(btns.slice(0,30)));
  await browser.close();
})();
