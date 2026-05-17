# Knock Order Notification System

A demo e-commerce app showcasing Knock's notification infrastructure API.

## Knock Features Demonstrated

- Multi-channel delivery (email + in-app)
- Three workflows: order confirmed, shipped, delivered
- Intelligent message routing (in-app first, email fallback after 5-minute delay if not seen)
- User notification preferences (toggle channels on/off)
- React notification feed with real-time updates
- Workflow observability via Knock dashboard

## Tech Stack

- **Backend:** Node.js, Express, `@knocklabs/node`
- **Frontend:** React, `react-router-dom`, `@knocklabs/react`
- **Notifications:** Knock

## Knock Dashboard Setup

Create the following three workflows in your Knock dashboard. **All workflows must be committed before they can be triggered via API.**

### `order-confirmed`

Trigger → In-app + Email (both immediate).

### `order-shipped`

Trigger → In-app → Delay 5 min → Email (condition: in-app message has not been seen).

This is the intelligent routing pattern — the email only sends if the user didn't see the in-app notification within 5 minutes.

### `order-delivered`

Trigger → In-app only.

Template variables used by the workflows: `{{orderNumber}}`, `{{itemNames}}`, `{{itemCount}}`, `{{total}}`.

## Local Setup

### Backend

```bash
cd server
npm install
```

Create `server/.env`:

```
KNOCK_API_KEY=sk_test_your_secret_key
PORT=4000
```

Run:

```bash
node server.js
```

### Frontend

```bash
cd client
npm install
```

Create `client/.env`:

```
REACT_APP_KNOCK_PUBLIC_KEY=pk_test_your_public_key
REACT_APP_KNOCK_FEED_CHANNEL_ID=your_in_app_feed_channel_id
REACT_APP_API_URL=http://localhost:4000/api
```

Run:

```bash
npm start
```

The app will be available at http://localhost:3000.

### Manual end-to-end test

With the server running, trigger every workflow at once:

```bash
cd server
node test-knock.js
```

Then check **Knock dashboard → Observability → Logs**.

## Project Structure

```
knock-order-app/
├── server/
│   ├── server.js        # Express API + Knock triggers
│   ├── test-knock.js    # Manual notification test script
│   ├── render.yaml      # Render deployment config
│   ├── package.json
│   └── .env             # KNOCK_API_KEY, PORT
├── client/
│   ├── src/
│   │   ├── App.js       # Routes, Knock providers, pages
│   │   └── App.css      # Dark theme
│   ├── public/
│   │   └── index.html
│   ├── vercel.json      # SPA rewrite for react-router
│   ├── package.json
│   └── .env             # REACT_APP_KNOCK_PUBLIC_KEY, etc.
├── .gitignore
└── README.md
```

## Live Demo

- **Frontend:** https://your-app.vercel.app
- **Backend:** https://your-app.onrender.com
