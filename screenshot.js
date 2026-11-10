const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const outDir = path.join(process.cwd(), "docs", "screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);

  const tabs = [
    ["overview", "Command & Lifecycle"],
    ["simulations", "Simulations, 3D & Replay"],
    ["counterfactuals", "Causal & Counterfactuals"],
    ["discovery", "QD Search & Phase Space"],
    ["redteam", "Red-Team, Swarm & Lit"],
    ["calibration", "Calibration & Power"],
    ["provenance", "Provenance & Release"],
    ["methods", "Methods & Acceptance"],
  ];

  for (let i = 0; i < tabs.length; i++) {
    const [id, label] = tabs[i];
    const btn = page.getByRole("button", { name: label }).first();
    await btn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, `${String(i + 1).padStart(2, "0")}-${id}.png`) });
    console.log("captured", id);
  }

  await browser.close();
})();
