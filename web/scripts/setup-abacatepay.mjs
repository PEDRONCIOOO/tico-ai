#!/usr/bin/env node
/**
 * AbacatePay API key sanity check.
 *
 * On v1 of the AbacatePay API there's nothing to pre-provision — products are
 * inlined in each /billing/create request, and there's no separate product
 * catalog. So this script just verifies that your API token is valid by hitting
 * an authenticated read-only endpoint.
 *
 * Usage:
 *   ABACATEPAY_API_TOKEN=abc_dev_xxx node web/scripts/setup-abacatepay.mjs
 */

const TOKEN = process.env.ABACATEPAY_API_TOKEN;

if (!TOKEN) {
  console.error("❌ Set ABACATEPAY_API_TOKEN environment variable first.");
  console.error("   Get one from https://app.abacatepay.com (Settings → API)");
  process.exit(1);
}

async function main() {
  console.log("🥑 AbacatePay API key check");

  // /v1/billing/list is a cheap authenticated read.
  const res = await fetch("https://api.abacatepay.com/v1/billing/list", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (res.status === 401 || res.status === 403) {
    console.error(`❌ API key rejected (${res.status}). Check ABACATEPAY_API_TOKEN.`);
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Unexpected response (${res.status}): ${text}`);
    process.exit(1);
  }

  console.log("✅ API key is valid and on v1.");
  console.log("");
  console.log("Products are inlined on /v1/billing/create at checkout time —");
  console.log("no catalog pre-creation needed. You're set.");
}

main().catch((err) => {
  console.error("❌ Fatal:", err.message);
  process.exit(1);
});
