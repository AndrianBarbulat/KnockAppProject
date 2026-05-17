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

// Routes
app.get("/api/products", (req, res) => {
  res.json(products);
});

app.post("/api/orders", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const order = {
      id: `ORD-${++orderCounter}`,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
      status: "confirmed",
      createdAt: new Date().toISOString()
    };
    orders.push(order);

    // Trigger Knock notification
    await knock.workflows.trigger("order-confirmed", {
      recipients: ["demo-user"],
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
  res.json(orders);
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
