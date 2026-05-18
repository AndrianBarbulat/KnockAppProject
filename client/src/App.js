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

function App() {
  const { status, stage, retry } = useServerHealth();
  const [cart, setCart] = useState([]);

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

  return (
    <KnockProvider
      apiKey={process.env.REACT_APP_KNOCK_PUBLIC_KEY}
      userId="demo-user"
    >
      <KnockFeedProvider feedId={process.env.REACT_APP_KNOCK_FEED_CHANNEL_ID}>
        <BrowserRouter>
          <Navbar cart={cart} />
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
                  />
                }
              />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/preferences" element={<PreferencesPage />} />
            </Routes>
          </main>
        </BrowserRouter>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function Navbar({ cart }) {
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef(null);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-accent">Knock</span> Order Demo
        </Link>
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
        </div>
      </div>
    </nav>
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

function CartPage({ cart, updateQuantity, clearCart }) {
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
          body: JSON.stringify({ items: cart }),
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

function OrdersPage() {
  const [orders, setOrders] = useState([]);

  const loadOrders = () => {
    fetch(`${API_URL}/orders`)
      .then((r) => r.json())
      .then(setOrders)
      .catch((err) => console.error("Failed to load orders:", err));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updateStatus = async (id, action) => {
    try {
      await fetch(`${API_URL}/orders/${id}/${action}`, { method: "PUT" });
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

function PreferencesPage() {
  const [channelTypes, setChannelTypes] = useState({
    email: true,
    in_app_feed: true,
    sms: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/preferences`)
      .then((r) => r.json())
      .then((prefs) => {
        if (prefs && prefs.channel_types) {
          setChannelTypes((current) => ({ ...current, ...prefs.channel_types }));
        }
      })
      .catch((err) => console.error("Failed to load preferences:", err));
  }, []);

  const toggle = async (key) => {
    const updated = { ...channelTypes, [key]: !channelTypes[key] };
    setChannelTypes(updated);
    setSaving(true);
    try {
      await fetch(`${API_URL}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_types: updated }),
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
