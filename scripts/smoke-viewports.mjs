/**
 * Smoke-check home layout on common phone viewports.
 * Usage: node scripts/smoke-viewports.mjs [baseUrl]
 */
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:8765/?v=smoke";

const viewports = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 13/14", width: 390, height: 844 },
  { name: "iPhone 14 Pro Max", width: 430, height: 932 },
  { name: "Pixel 7", width: 412, height: 915 },
  { name: "small landscape", width: 667, height: 375 },
  { name: "short height", width: 390, height: 600 },
];

const criticalIds = [
  "speech",
  "speechTitle",
  "treeStage",
  "balanceCard",
  "openDeeds",
  "homePage",
  "openMenu",
];

function overlaps(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

const browser = await chromium.launch({ headless: true });
let failed = 0;

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  try {
    const res = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 20000 });
    if (!res || !res.ok()) errors.push(`HTTP ${res ? res.status() : "no response"}`);

    await page.waitForSelector("#speechTitle", { timeout: 10000 });
    await page.waitForTimeout(400);

    const report = await page.evaluate((ids) => {
      const out = { missing: [], zero: [], overflow: false, boxes: {} };
      const shell = document.querySelector(".app-shell");
      const shellRect = shell?.getBoundingClientRect();
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) {
          out.missing.push(id);
          continue;
        }
        const r = el.getBoundingClientRect();
        out.boxes[id] = {
          width: Math.round(r.width),
          height: Math.round(r.height),
          top: Math.round(r.top),
          left: Math.round(r.left),
          bottom: Math.round(r.bottom),
          right: Math.round(r.right),
        };
        if (r.width < 2 || r.height < 2) out.zero.push(id);
      }
      if (shellRect) {
        // Only flag overflow of content inside the phone shell (desktop
        // page may be wider than the centered shell without being a bug).
        const home = document.getElementById("homePage");
        const contentW = Math.max(
          home?.scrollWidth || 0,
          ...[...document.querySelectorAll("#homePage > *")].map((el) => el.scrollWidth)
        );
        out.overflow = contentW > Math.ceil(shellRect.width) + 2;
      }
      const title = document.getElementById("speechTitle")?.textContent?.trim() || "";
      out.hasSpeech = title.length > 0;
      out.ornamentCount = document.querySelectorAll(".ornament-script span").length;
      out.actions = [...document.querySelectorAll(".action")].map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      return out;
    }, criticalIds);

    if (report.missing.length) errors.push(`missing: ${report.missing.join(", ")}`);
    if (report.zero.length) errors.push(`zero-size: ${report.zero.join(", ")}`);
    if (report.overflow) errors.push("horizontal overflow");
    if (!report.hasSpeech) errors.push("empty speech title");
    if (report.ornamentCount < 24) errors.push(`ornament too sparse (${report.ornamentCount})`);

    const speech = report.boxes.speech;
    const tree = report.boxes.treeStage;
    const balance = report.boxes.balanceCard;
    if (speech && tree && overlaps(speech, tree)) errors.push("speech overlaps tree");
    if (tree && balance && overlaps(tree, balance)) errors.push("tree overlaps balance");
    const deeds = report.boxes.openDeeds;
    if (balance && deeds && overlaps(balance, deeds)) errors.push("balance overlaps deeds");

    const minActionH = vp.height <= 480 ? 64 : 70;
    for (const a of report.actions || []) {
      if (a.h < minActionH) errors.push(`action too short (${a.h}px)`);
      if (a.w < 100) errors.push(`action too narrow (${a.w}px)`);
    }

    // Mark buttons should remain usable on short screens
    if (vp.height <= 600 && report.actions?.some((a) => a.h < minActionH)) {
      errors.push("short-screen action height regression");
    }
    if (report.boxes.speechTitle && report.boxes.speechTitle.height < 16) {
      errors.push("speech title collapsed");
    }

    if (errors.length) {
      failed += 1;
      console.log(`FAIL  ${vp.name} (${vp.width}x${vp.height})`);
      for (const e of errors) console.log(`      - ${e}`);
    } else {
      console.log(
        `OK    ${vp.name} (${vp.width}x${vp.height}) speech=${speech?.height}px tree=${tree?.height}px actions=${report.actions?.map((a) => a.h).join("/")}px`
      );
    }
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${vp.name}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
if (failed) {
  console.log(`\n${failed} viewport(s) failed`);
  process.exit(1);
}
console.log("\nAll viewports OK");
