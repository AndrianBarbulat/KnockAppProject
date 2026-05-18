import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationIconButton,
  NotificationFeedPopover,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL;

function useServerHealth() {
  const [status, setStatus] = useState("loading");
  const [stage, setStage] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    setStatus("loading");
    setStage(0);

    const stage1 = setTimeout(() => {
      if (!cancelled) setStage(1);
    }, 3000);
    const stage2 = setTimeout(() => {
      if (!cancelled) setStage(2);
    }, 15000);
    const errorTimer = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setStatus("error");
    }, 60000);

    const tryHealth = () => {
      fetch(`${API_URL}/health`)
        .then((r) => {
          if (cancelled) return;
          if (!r.ok) throw new Error("health check failed");
          cancelled = true;
          clearTimeout(stage1);
          clearTimeout(stage2);
          clearTimeout(errorTimer);
          setStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          retryTimer = setTimeout(tryHealth, 2000);
        });
    };

    tryHealth();

    return () => {
      cancelled = true;
      clearTimeout(stage1);
      clearTimeout(stage2);
      clearTimeout(errorTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [attempt]);

  const retry = () => setAttempt((a) => a + 1);

  return { status, stage, retry };
}

function LoadingScreen({ status, stage, onRetry }) {
  let text;
  if (stage >= 2) {
    text = "Almost there, just a few more seconds...";
  } else if (stage >= 1) {
    text =
      "The server is hosted on Render's free tier and goes to sleep after 15 minutes of inactivity. It's waking up now, this usually takes 20-30 seconds...";
  } else {
    text = "Connecting to server...";
  }

  return (
    <div className="app-loading">
      {status === "error" ? (
        <>
          <p className="app-loading-text">
            Could not connect to server. The free tier may be temporarily
            unavailable.
          </p>
          <button className="btn btn-primary" onClick={onRetry}>
            Try Again
          </button>
        </>
      ) : (
        <>
          <div className="app-loading-spinner" />
          <p className="app-loading-text">{text}</p>
        </>
      )}
    </div>
  );
}

const USER_STORAGE_KEY = "knockDemoUser";

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function App() {
  const { status, stage, retry } = useServerHealth();
  const [user, setUser] = useState(loadStoredUser);
  const [cart, setCart] = useState([]);

  const handleIdentified = (identified) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(identified));
    setUser(identified);
  };

  const handleSignOut = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setCart([]);
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  if (status !== "ready") {
    return <LoadingScreen status={status} stage={stage} onRetry={retry} />;
  }

  if (!user) {
    return <WelcomeScreen onIdentified={handleIdentified} />;
  }

  return (
    <KnockProvider
      apiKey={process.env.REACT_APP_KNOCK_PUBLIC_KEY}
      userId={user.userId}
    >
      <KnockFeedProvider feedId={process.env.REACT_APP_KNOCK_FEED_CHANNEL_ID}>
        <BrowserRouter>
          <Navbar cart={cart} onSignOut={handleSignOut} />
          <main className="container">
            <Routes>
              <Route path="/" element={<ShopPage addToCart={addToCart} />} />
              <Route
                path="/cart"
                element={
                  <CartPage
                    cart={cart}
                    updateQuantity={updateQuantity}
                    clearCart={clearCart}
                    userId={user.userId}
                  />
                }
              />
              <Route
                path="/orders"
                element={<OrdersPage userId={user.userId} />}
              />
              <Route
                path="/preferences"
                element={<PreferencesPage userId={user.userId} />}
              />
            </Routes>
          </main>
        </BrowserRouter>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function WelcomeScreen({ onIdentified }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("identify failed");
      const data = await res.json();
      onIdentified(data);
    } catch (err) {
      console.error(err);
      setError("Could not start the demo. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <h1 className="welcome-title">Welcome to the Knock Order Demo</h1>
        <p className="welcome-subtitle">
          Enter your details below to receive real notifications as you test
          the app.
        </p>
        <div className="welcome-form">
          <label className="welcome-field">
            <span className="welcome-label">Name</span>
            <input
              className="welcome-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              disabled={submitting}
            />
          </label>
          <label className="welcome-field">
            <span className="welcome-label">Email</span>
            <input
              className="welcome-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
            />
          </label>
          <label className="welcome-field">
            <span className="welcome-label">Phone (optional)</span>
            <input
              className="welcome-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 555 5555"
              disabled={submitting}
            />
          </label>
        </div>
        {error && <p className="welcome-error">{error}</p>}
        <button
          className="btn btn-primary btn-full"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Starting..." : "Start Demo"}
        </button>
        <p className="welcome-note">
          Your email is used to demonstrate Knock's email notification
          channel. No marketing emails will be sent.
        </p>
      </div>
    </div>
  );
}

function Navbar({ cart, onSignOut }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef(null);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-left">
            <button
              className="hamburger"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Open info menu"
            >
              ☰
            </button>
            <Link to="/" className="brand">
              <span className="brand-accent">Knock</span> Order Demo
            </Link>
          </div>
          <div className="nav-links">
            <Link to="/" className="nav-link">
              Shop
            </Link>
            <Link to="/orders" className="nav-link">
              Orders
            </Link>
            <Link to="/preferences" className="nav-link">
              Preferences
            </Link>
            <Link to="/cart" className="nav-link cart-link">
              Cart
              {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
            </Link>
            <div className="bell-wrapper">
              <NotificationIconButton
                ref={bellRef}
                onClick={() => setIsOpen((prev) => !prev)}
              />
              <NotificationFeedPopover
                buttonRef={bellRef}
                isVisible={isOpen}
                onClose={() => setIsOpen(false)}
              />
            </div>
            <button
              type="button"
              className="nav-link nav-link-button"
              onClick={onSignOut}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      <InfoPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function InfoPanel({ open, onClose }) {
  const features = [
    {
      name: "Sending to More Than One Channel",
      desc: "When you place an order, Knock sends both an email and an in-app notification at the same time.",
    },
    {
      name: "Smart Fallback (Delay + Check)",
      desc: "When an order ships, you get an in-app notification right away. Knock then waits 5 minutes and checks if you saw it. If you didn't, it sends an email as a backup. If you did, it skips the email so you aren't bothered twice.",
    },
    {
      name: "User Preferences",
      desc: "The Preferences page lets you turn email, in-app, and SMS on or off. Knock checks these settings every time it tries to send something and skips any channel you've turned off.",
    },
    {
      name: "Live Notification Feed",
      desc: "The bell icon in the top bar uses Knock's React library to show a live feed. New notifications appear right when they're sent, no refresh needed.",
    },
    {
      name: "Dashboard Logs",
      desc: "Every notification Knock sends shows up in the Knock dashboard under Logs, so you can see exactly what was sent, when, and whether it was delivered.",
    },
  ];

  const workflows = [
    {
      name: "Order Confirmed",
      key: "order-confirmed",
      steps: "Trigger → In-app → Email",
      note: "Both notifications go out right after you check out.",
    },
    {
      name: "Order Shipped",
      key: "order-shipped",
      steps: "Trigger → In-app → Wait 5 min → Email (only if not seen)",
      note: "The email only sends if you didn't see the in-app notification within 5 minutes.",
    },
    {
      name: "Order Delivered",
      key: "order-delivered",
      steps: "Trigger → In-app",
      note: "Just a simple in-app notification.",
    },
  ];

  const endpoints = [
    {
      method: "GET",
      path: "/api/products",
      desc: "Gets the list of 6 products in the shop.",
    },
    {
      method: "POST",
      path: "/api/identify",
      desc: "Creates a user in Knock from the welcome form. Takes name, email, and phone, and builds a user ID from the email.",
    },
    {
      method: "POST",
      path: "/api/orders",
      desc: "Creates an order from your cart and sends the order-confirmed notification.",
    },
    {
      method: "GET",
      path: "/api/orders",
      desc: "Gets the order list for one user.",
    },
    {
      method: "PUT",
      path: "/api/orders/:id/ship",
      desc: "Marks an order as shipped and sends the order-shipped notification. This is the one with the 5-minute wait and email backup.",
    },
    {
      method: "PUT",
      path: "/api/orders/:id/deliver",
      desc: "Marks an order as delivered and sends the order-delivered notification.",
    },
    {
      method: "GET",
      path: "/api/preferences",
      desc: "Gets the user's current notification settings from Knock.",
    },
    {
      method: "PUT",
      path: "/api/preferences",
      desc: "Saves the user's notification settings (email, in-app, SMS on or off) to Knock.",
    },
    {
      method: "GET",
      path: "/api/health",
      desc: "A quick check to see if the server is awake. Used at startup because the free Render server goes to sleep after 15 minutes.",
    },
  ];

  const stack = [
    { label: "Backend", value: "Node.js, Express, @knocklabs/node" },
    { label: "Frontend", value: "React, react-router-dom, @knocklabs/react" },
    {
      label: "Hosting",
      value: "Render (backend web service + frontend static site)",
    },
    { label: "Notifications", value: "Knock" },
  ];

  return (
    <>
      <div
        className={`info-overlay ${open ? "info-overlay-open" : ""}`}
        onClick={onClose}
      />
      <aside
        className={`info-panel ${open ? "info-panel-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="info-header">
          <h2 className="info-title">About This Demo</h2>
          <p className="info-subtitle">
            Built by Andrian Barbulat to learn how Knock's notification
            system works.
          </p>
          <button
            className="info-close"
            onClick={onClose}
            aria-label="Close info menu"
          >
            ×
          </button>
        </div>

        <div className="info-section">
          <h3 className="info-heading">What This App Does</h3>
          <p className="info-text">
            This is a small shop demo that sends real notifications through
            Knock when you place and manage orders. Add things to your cart,
            check out, and you'll see notifications appear in the bell icon.
            You can also mark orders as shipped or delivered, and turn email,
            in-app, or SMS notifications on and off from the Preferences page.
          </p>
        </div>

        <div className="info-section">
          <h3 className="info-heading">Knock Features Demonstrated</h3>
          <div className="info-features">
            {features.map((f) => (
              <div key={f.name} className="info-feature">
                <div className="info-feature-name">{f.name}</div>
                <p className="info-text">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h3 className="info-heading">Knock Workflows</h3>
          <div className="info-workflows">
            {workflows.map((w) => (
              <div key={w.key} className="info-workflow">
                <div className="info-workflow-name">{w.name}</div>
                <div className="info-workflow-key">{w.key}</div>
                <div className="info-workflow-steps">{w.steps}</div>
                <p className="info-workflow-note">{w.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h3 className="info-heading">API Endpoints</h3>
          <div className="info-endpoints">
            {endpoints.map((e, i) => (
              <div key={i} className="info-endpoint">
                <div className="info-endpoint-row">
                  <span
                    className={`info-method info-method-${e.method.toLowerCase()}`}
                  >
                    {e.method}
                  </span>
                  <span className="info-path">{e.path}</span>
                </div>
                <p className="info-text">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h3 className="info-heading">Tech Stack</h3>
          <div className="info-stack">
            {stack.map((s) => (
              <div key={s.label} className="info-stack-row">
                <span className="info-stack-label">{s.label}</span>
                <span className="info-stack-value">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h3 className="info-heading">Source Code</h3>
          <p className="info-text">Full source code available on GitHub</p>
          <a
            className="info-link"
            href="https://github.com/AndrianBarbulat/KnockAppProject"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/AndrianBarbulat/KnockAppProject
          </a>
        </div>
      </aside>
    </>
  );
}

function ShopPage({ addToCart }) {
  const [products, setProducts] = useState([]);
  const [addedId, setAddedId] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then((r) => r.json())
      .then(setProducts)
      .catch((err) => console.error("Failed to load products:", err));
  }, []);

  const handleAdd = (product) => {
    addToCart(product);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1000);
  };

  return (
    <div>
      <h1 className="page-title">Shop</h1>
      <div className="product-grid">
        {products.map((p) => (
          <div key={p.id} className="product-card">
            <img src={p.image} alt={p.name} className="product-image" />
            <div className="product-info">
              <h3 className="product-name">{p.name}</h3>
              <p className="product-description">{p.description}</p>
              <div className="product-footer">
                <span className="product-price">${p.price.toFixed(2)}</span>
                <button
                  className={`btn ${addedId === p.id ? "btn-success" : "btn-primary"}`}
                  onClick={() => handleAdd(p)}
                >
                  {addedId === p.id ? "Added!" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartPage({ cart, updateQuantity, clearCart, userId }) {
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const checkout = async () => {
    setPlacing(true);
    setMessage("");
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      try {
        const res = await fetch(`${API_URL}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart, userId }),
        });
        if (!res.ok) throw new Error("Checkout failed");
        clearCart();
        setMessage("Order placed! Check your notifications.");
        setTimeout(() => navigate("/orders"), 1500);
        setPlacing(false);
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    console.error(lastErr);
    setMessage("Checkout failed. Please try again.");
    setPlacing(false);
  };

  if (cart.length === 0 && !message) {
    return (
      <div className="empty-state">
        <h1 className="page-title">Your cart is empty</h1>
        <Link to="/" className="btn btn-primary">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Cart</h1>
      {message && <div className="banner banner-success">{message}</div>}
      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.id} className="cart-item">
            <img src={item.image} alt={item.name} className="cart-item-image" />
            <div className="cart-item-info">
              <h3>{item.name}</h3>
              <p className="product-price">${item.price.toFixed(2)}</p>
            </div>
            <div className="quantity-controls">
              <button
                className="qty-btn"
                onClick={() => updateQuantity(item.id, -1)}
              >
                −
              </button>
              <span className="qty-value">{item.quantity}</span>
              <button
                className="qty-btn"
                onClick={() => updateQuantity(item.id, 1)}
              >
                +
              </button>
            </div>
            <div className="cart-item-total">
              ${(item.price * item.quantity).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      {cart.length > 0 && (
        <div className="cart-summary">
          <div className="cart-total">
            <span>Total</span>
            <span className="cart-total-value">${total.toFixed(2)}</span>
          </div>
          <button
            className="btn btn-primary btn-full"
            onClick={checkout}
            disabled={placing}
          >
            {placing ? "Processing..." : "Checkout"}
          </button>
        </div>
      )}
    </div>
  );
}

function OrdersPage({ userId }) {
  const [orders, setOrders] = useState([]);

  const loadOrders = () => {
    fetch(`${API_URL}/orders?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then(setOrders)
      .catch((err) => console.error("Failed to load orders:", err));
  };

  useEffect(() => {
    loadOrders();
  }, [userId]);

  const updateStatus = async (id, action) => {
    try {
      await fetch(`${API_URL}/orders/${id}/${action}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      loadOrders();
    } catch (err) {
      console.error(`Failed to ${action} order:`, err);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <h1 className="page-title">No orders yet</h1>
        <Link to="/" className="btn btn-primary">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Orders</h1>
      <div className="orders-list">
        {orders.map((o) => (
          <div key={o.id} className="order-card">
            <div className="order-header">
              <h3 className="order-id">{o.id}</h3>
              <span className={`status-badge status-${o.status}`}>
                {o.status}
              </span>
            </div>
            <p className="order-items">
              {o.items.map((i) => i.name).join(", ")}
            </p>
            <div className="order-footer">
              <span className="order-total">${o.total}</span>
              <div className="order-actions">
                {o.status === "confirmed" && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => updateStatus(o.id, "ship")}
                  >
                    Mark Shipped
                  </button>
                )}
                {o.status === "shipped" && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => updateStatus(o.id, "deliver")}
                  >
                    Mark Delivered
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreferencesPage({ userId }) {
  const [channelTypes, setChannelTypes] = useState({
    email: true,
    in_app_feed: true,
    sms: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/preferences?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((prefs) => {
        if (prefs && prefs.channel_types) {
          setChannelTypes((current) => ({ ...current, ...prefs.channel_types }));
        }
      })
      .catch((err) => console.error("Failed to load preferences:", err));
  }, [userId]);

  const toggle = async (key) => {
    const updated = { ...channelTypes, [key]: !channelTypes[key] };
    setChannelTypes(updated);
    setSaving(true);
    try {
      await fetch(`${API_URL}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_types: updated, userId }),
      });
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    {
      key: "email",
      label: "Email",
      description: "Receive notifications by email.",
    },
    {
      key: "in_app_feed",
      label: "In-App",
      description: "Show notifications in the in-app feed.",
    },
    {
      key: "sms",
      label: "SMS",
      description: "Receive notifications by text message.",
    },
  ];

  return (
    <div>
      <div className="page-title-row">
        <h1 className="page-title">Preferences</h1>
        {saving && <span className="saving-text">Saving...</span>}
      </div>
      <div className="prefs-list">
        {rows.map((row) => (
          <div key={row.key} className="pref-row">
            <div>
              <h3 className="pref-label">{row.label}</h3>
              <p className="pref-description">{row.description}</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={!!channelTypes[row.key]}
                onChange={() => toggle(row.key)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
