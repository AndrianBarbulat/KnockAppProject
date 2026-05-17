const BASE_URL = "http://localhost:4000/api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function header(title) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

async function postOrder(items) {
  const res = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`POST /orders failed: ${res.status}`);
  return res.json();
}

async function shipOrder(id) {
  const res = await fetch(`${BASE_URL}/orders/${id}/ship`, { method: "PUT" });
  if (!res.ok) throw new Error(`PUT /orders/${id}/ship failed: ${res.status}`);
  return res.json();
}

async function deliverOrder(id) {
  const res = await fetch(`${BASE_URL}/orders/${id}/deliver`, { method: "PUT" });
  if (!res.ok) throw new Error(`PUT /orders/${id}/deliver failed: ${res.status}`);
  return res.json();
}

async function setPreferences(channelTypes) {
  const res = await fetch(`${BASE_URL}/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel_types: channelTypes }),
  });
  if (!res.ok) throw new Error(`PUT /preferences failed: ${res.status}`);
  return res.json();
}

async function testOrderLifecycle() {
  header("TEST 1: Full order lifecycle");
  const order = await postOrder([
    { name: "Wireless Headphones", price: 49.99, quantity: 1 },
    { name: "Mechanical Keyboard", price: 89.99, quantity: 1 },
  ]);
  console.log(`Order created: ${order.id}`);

  await sleep(2000);
  await shipOrder(order.id);
  console.log(`Order ${order.id} shipped`);

  await sleep(2000);
  await deliverOrder(order.id);
  console.log(`Order ${order.id} delivered`);

  console.log("Check Knock dashboard > Observability > Logs for 3 workflow runs");
}

async function testPreferencesBlockingEmail() {
  header("TEST 2: Preferences blocking email");

  await setPreferences({ email: false, in_app_feed: true });
  console.log("Email disabled");

  const order = await postOrder([
    { name: "USB-C Hub", price: 34.99, quantity: 1 },
  ]);
  console.log(`Order created: ${order.id}`);
  console.log(
    "Check Knock logs - email step should be skipped due to preferences"
  );

  await sleep(2000);

  await setPreferences({ email: true, in_app_feed: true });
  console.log("Email re-enabled");
}

async function testBatchNotifications() {
  header("TEST 3: Batch notifications");

  const items = [{ name: "Mouse Pad XL", price: 19.99, quantity: 1 }];
  const results = await Promise.all([
    postOrder(items),
    postOrder(items),
    postOrder(items),
  ]);
  results.forEach((o) => console.log(`Order created: ${o.id}`));

  console.log(
    "3 orders created rapidly - if batching is enabled in your workflow, check logs for a single batched notification"
  );
}

async function testIntelligentRouting() {
  header("TEST 4: Intelligent routing");

  const order = await postOrder([
    { name: "Monitor Stand", price: 29.99, quantity: 1 },
  ]);
  console.log(`Order created: ${order.id}`);

  await shipOrder(order.id);
  console.log("Order shipped. In-app notification sent immediately.");
  console.log("The delay step is now waiting 5 minutes.");
  console.log(
    "If you DO NOT open the notification bell, email will send after 5 minutes."
  );
  console.log(
    "If you DO open the notification bell (marking it as seen), email will be skipped."
  );
}

async function main() {
  console.log(
    "Make sure your server is running on port 4000 before running this script."
  );

  try {
    await testOrderLifecycle();
    await testPreferencesBlockingEmail();
    await testBatchNotifications();
    await testIntelligentRouting();

    console.log(
      "\nAll tests triggered. Go to Knock dashboard > Observability > Logs to verify each workflow run."
    );
  } catch (err) {
    console.error("\nTest run failed:", err.message);
    process.exit(1);
  }
}

main();
