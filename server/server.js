require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Knock } = require("@knocklabs/node");

const app = express();
const knock = new Knock({ apiKey: process.env.KNOCK_API_KEY });
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory storage
const products = [
  { id: "prod-1", name: "Wireless Headphones", price: 49.99, image: "https://placehold.co/300x300/1a1a2e/eee?text=Headphones", description: "Premium noise-cancelling wireless headphones" },
  { id: "prod-2", name: "Mechanical Keyboard", price: 89.99, image: "https://placehold.co/300x300/16213e/eee?text=Keyboard", description: "RGB mechanical keyboard with cherry switches" },
  { id: "prod-3", name: "USB-C Hub", price: 34.99, image: "https://placehold.co/300x300/0f3460/eee?text=USB-C+Hub", description: "7-in-1 USB-C hub with HDMI and ethernet" },
  { id: "prod-4", name: "Webcam HD", price: 59.99, image: "https://placehold.co/300x300/533483/eee?text=Webcam", description: "1080p HD webcam with built-in microphone" },
  { id: "prod-5", name: "Monitor Stand", price: 29.99, image: "https://placehold.co/300x300/e94560/eee?text=Stand", description: "Adjustable aluminium monitor stand" },
  { id: "prod-6", name: "Mouse Pad XL", price: 19.99, image: "https://placehold.co/300x300/0a1931/eee?text=Mouse+Pad", description: "Extended desk mouse pad with stitched edges" }
];

const orders = [];
let orderCounter = 1000;

function emailToUserId(email) {
  return String(email).toLowerCase().trim().replace(/@/g, "_at_").replace(/\./g, "_");
}

function resolveUserId(req) {
  return (
    (req.body && req.body.userId) ||
    (req.query && req.query.userId) ||
    "demo-user"
  );
}

// Routes
app.get("/api/products", (req, res) => {
  res.json(products);
});

app.post("/api/identify", async (req, res) => {
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    const userId = emailToUserId(email);
    await knock.users.identify(userId, {
      name,
      email,
      phone_number: phone || undefined,
    });
    res.json({ userId, name, email, phone: phone || null });
  } catch (err) {
    console.error("Identify failed:", err);
    res.status(500).json({ error: "Failed to identify user" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    const userId = resolveUserId(req);

    const order = {
      id: `ORD-${++orderCounter}`,
      userId,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
      status: "confirmed",
      createdAt: new Date().toISOString()
    };
    orders.push(order);

    // Trigger Knock notification
    await knock.workflows.trigger("order-confirmed", {
      recipients: [userId],
      data: {
        orderNumber: order.id,
        itemNames: order.items.map(i => i.name).join(", "),
        itemCount: order.items.length,
        total: order.total
      }
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.get("/api/orders", (req, res) => {
  const userId = resolveUserId(req);
  res.json(orders.filter(o => o.userId === userId));
});

app.put("/api/orders/:id/ship", async (req, res) => {
  try {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const userId = resolveUserId(req);
    order.status = "shipped";
    order.updatedAt = new Date().toISOString();

    await knock.workflows.trigger("order-shipped", {
      recipients: [userId],
      data: {
        orderNumber: order.id,
        itemNames: order.items.map(i => i.name).join(", "),
        total: order.total
      }
    });

    res.json(order);
  } catch (err) {
    console.error("Ship order failed:", err);
    res.status(500).json({ error: "Failed to ship order" });
  }
});

app.put("/api/orders/:id/deliver", async (req, res) => {
  try {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const userId = resolveUserId(req);
    order.status = "delivered";
    order.updatedAt = new Date().toISOString();

    await knock.workflows.trigger("order-delivered", {
      recipients: [userId],
      data: {
        orderNumber: order.id
      }
    });

    res.json(order);
  } catch (err) {
    console.error("Deliver order failed:", err);
    res.status(500).json({ error: "Failed to deliver order" });
  }
});

app.get("/api/preferences", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const preferences = await knock.users.getPreferences(userId, "default");
    res.json(preferences);
  } catch (err) {
    console.error("Get preferences failed:", err);
    res.status(500).json({ error: "Failed to get preferences" });
  }
});

app.put("/api/preferences", async (req, res) => {
  try {
    const { channel_types } = req.body;
    const userId = resolveUserId(req);
    const preferences = await knock.users.setPreferences(userId, "default", { channel_types });
    res.json(preferences);
  } catch (err) {
    console.error("Set preferences failed:", err);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  try {
    await knock.users.update("demo-user", {
      name: "Andrian",
      email: "andrian.barbulat@gmail.com",
      phone_number: "+353852502957"
    });
    console.log("Demo user identified in Knock");
  } catch (err) {
    console.error("Failed to identify user:", err.message);
  }
});
