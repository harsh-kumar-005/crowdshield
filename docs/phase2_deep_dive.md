# Phase 2 Deep Dive — Core Dashboard, Real-Time Systems & Architecture

> This document explains every concept we built in Phase 2 — what it is, how it works, why we made each decision, and what interview questions you need to be ready to answer. Read it like a story, not a textbook.

---

## The Big Picture — What We Built

Phase 2 transformed a basic skeleton app into a real, living command center. Here is what the system looks like now:

```
FRONTEND (React, port 5173)
        │
        ├── Dashboard Page  → Connected to SocketContext, reads live crowd data
        ├── Map View        → Connected to SocketContext, draws Leaflet map with live circles
        ├── Events Page     → Fetches from REST API, POSTs new events to the backend
        │
        └── SocketProvider  → ONE WebSocket connection shared to all pages
                │
                └── WebSocket (ws://localhost:5000)
                        │
BACKEND (Express + Socket.io, port 5000)
        │
        ├── /api/auth/...       → Phase 1 login/register routes (JWT)
        ├── /api/venues         → GET + POST venues
        ├── /api/events         → GET + POST events
        ├── /api/health         → Health check endpoint
        │
        └── Socket.io Server    → Emits crowd_update every 3 seconds
                │
DATABASE (PostgreSQL, port 5432)
        ├── users (Phase 1)
        ├── venues
        └── events
```

---

## Concept 1 — WebSockets vs HTTP (The Most Important Interview Topic)

Before Phase 2, every piece of data on our app used HTTP. HTTP works like a phone call you make, get a response, and hang up. Every time React needed data, it had to ask the server, wait, and get a response. This works fine for loading a page, but it is terrible for a live crowd dashboard where something changes every second.

WebSockets solve this by keeping the line open permanently:

```
HTTP (what we used in Phase 1):
  Browser asks → Server answers → Connection closed
  Browser asks → Server answers → Connection closed
  (To get live updates, you would have to ask every second — this is called POLLING, and it is wasteful)

WebSocket (what we added in Phase 2):
  Browser opens connection → Connection stays open forever
  Server pushes data whenever it wants → Browser receives instantly
  (No asking needed. The server just shouts when there is news)
```

In our code, the backend emits a crowd update every 3 seconds using `socket.emit('crowd_update', data)`. The frontend receives it using `socket.on('crowd_update', callback)`. This is exactly how stock market dashboards, real-time sports scoreboards, and live chat applications work.

**Interview Q: "What is the difference between HTTP and WebSockets?"**
Your Answer: "HTTP is a request-response protocol — the client always initiates. WebSockets establish a persistent, bidirectional connection where either side can send data at any time. We use WebSockets for real-time features like live crowd updates because polling (repeatedly asking the server) would be wasteful and slow."

---

## Concept 2 — React Context API (Solving the Duplicate Connection Problem)

When we first built Phase 2, both the Dashboard and the Map page each created their own WebSocket connection. This meant we had two connections open to the same server, receiving the same data twice. This is like having two identical newspaper subscriptions delivered to the same house — wasteful and confusing.

React Context solves this. It lets you store data at the top of the component tree and make it available anywhere below, without passing it down through props.

Here is how the flow works:

```
App.tsx
  └── SocketProvider  ← Creates ONE connection here, stores data in a shared box
        └── BrowserRouter
              └── Layout
                    ├── Dashboard  ← "reads from the shared box"
                    └── MapView    ← "reads from the same shared box"
```

The `SocketProvider` we built:
1. Creates one Socket.io connection when the app first loads
2. Listens to `crowd_update` and `critical_alert` events
3. Stores the crowd data, historical chart data, and alerts in state
4. Provides all of that to every single component in the app through `useSocketData()`

Now when the Dashboard reads `crowdData` and the Map reads `crowdData`, they are both reading from the same single source of truth — the same WebSocket connection.

**Interview Q: "What is React Context and when do you use it?"**
Your Answer: "React Context provides a way to pass data through the component tree without manually passing props at every level. We use it for global state — things that many components need, like the currently logged-in user, a theme, or in our case, a shared WebSocket connection. It prevents prop drilling, which is when you pass the same prop down through 5 nested components just to reach the one that needs it."

**Interview Q: "What is prop drilling and how do you fix it?"**
Your Answer: "Prop drilling is when you pass a value through multiple intermediate components that do not actually need it, just to get it to a deeply nested child. The fix is either React Context for simple global state, or a state management library like Zustand or Redux for complex state."

---

## Concept 3 — Socket.io Architecture

Socket.io is a library that sits on top of the WebSocket protocol and adds useful features like automatic reconnection, rooms (broadcasting to a subset of users), and fallback to HTTP polling if WebSockets are not available.

Our backend Socket.io server does the following:

1. When a client connects, it stores that socket and starts an interval
2. Every 3 seconds, it generates mock crowd data and emits it to that specific client
3. With a 5% chance, it fires a critical alert event
4. When the client disconnects (browser tab closed), it clears the interval

```typescript
io.on('connection', (socket) => {
  const interval = setInterval(() => {
    socket.emit('crowd_update', mockData);  // Push to ONE client
  }, 3000);

  socket.on('disconnect', () => {
    clearInterval(interval);  // Stop when they leave
  });
});
```

The key concept here: `socket.emit()` sends to one specific client, while `io.emit()` would broadcast to ALL connected clients. In a real system, you would use `io.emit()` or rooms to push updates to all venue managers watching the same event simultaneously.

**Interview Q: "How does real-time data work in your application?"**
Your Answer: "We use Socket.io which wraps the WebSocket protocol. When a client connects, the server starts emitting crowd data every 3 seconds. On the frontend, a Context Provider manages a single WebSocket connection for the whole app. Components subscribe to data updates through the `useSocketData` hook, which reads from the shared context. When new data arrives, React re-renders only the components that care about it."

---

## Concept 4 — Leaflet.js and Interactive Maps

Leaflet is an open-source JavaScript library for interactive maps. React Leaflet is the React wrapper around it. Unlike Google Maps, it requires no API key and is completely free.

Key components we used:

`MapContainer` — The main wrapper that initializes the map, sets the starting center coordinates and zoom level, and controls the map's height and behavior.

`TileLayer` — The actual visual tiles of the map (the streets, buildings, satellite imagery). The URL template `{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` tells Leaflet where to fetch each square tile image. The `{z}`, `{x}`, `{y}` are the zoom level and tile position coordinates.

`CircleMarker` — A circle drawn on the map at specific latitude/longitude coordinates. We scale the radius based on crowd count and change the color based on whether the count exceeds 400 people. This is how we create the "heatmap" effect visually.

`Tooltip` — A popup label that appears on the circle permanently, showing the gate name and count.

An important fix we made from the first version: in the initial build, the gate positions used random offsets, which caused the circles to jump around the map every 3 seconds as new data came in. We fixed this by defining fixed latitude/longitude coordinates for each of the 4 gates around the stadium. Now the circles stay in their right positions and only change size and color as density changes.

**Interview Q: "How does a map library know where to put things?"**
Your Answer: "Maps use a coordinate system based on latitude and longitude. Leaflet converts real-world coordinates to pixel positions based on the current zoom level using a projection algorithm. When we place a CircleMarker at [12.9788, 77.5996], those are the actual GPS coordinates of M Chinnaswamy Stadium in Bengaluru."

---

## Concept 5 — Recharts and Data Visualization

Recharts is a React component library for charts, built on top of D3.js. We used two chart types:

`AreaChart` — Shows the crowd density rolling over time. We keep a rolling window of the last 15 data points using `.slice(-15)`. Each time a new point arrives from the WebSocket, it gets appended and the oldest point drops off, creating the scrolling live graph effect.

`BarChart` — Shows the per-gate traffic at any given moment. The data is always the 4 gates from the most recent `crowd_update` event.

The `ResponsiveContainer` wrapper makes both charts automatically fill 100% of their parent element's width and height, making them responsive without any extra CSS.

`LinearGradient` with `defs` is an SVG technique for creating the blue fade effect below the area chart line. The `stopOpacity` goes from 0.3 at the top to 0 at the bottom, creating the beautiful transparency gradient.

**Interview Q: "How do you display real-time chart updates in React without lag?"**
Your Answer: "We store the data in React state as an array of data points. When a new WebSocket event arrives, we append the new point and trim the oldest one using `.slice(-15)`. Because the array reference changes, React knows to re-render the chart component. Recharts handles the smooth animation between old and new bar heights automatically."

---

## Concept 6 — CRUD API Design and Form Handling

For the Events page, we built a complete Create-Read flow:

Read: When the Events page loads, `useEffect` fires once (because of the empty `[]` dependency array) and calls `fetch('http://localhost:5000/api/events')`. The response is stored in the `events` state array and displayed in the table.

Create: When the user fills the form and submits, `handleSubmit` fires. It calls `fetch('/api/events', { method: 'POST', body: JSON.stringify(form) })`. If the response is successful (status 201), it closes the modal and calls `fetchEvents()` again to refresh the table with the new entry.

Error handling: If the network is down, the `catch` block captures the error and displays a user-friendly error message in the modal. The button is disabled during submission to prevent double-clicks.

**Interview Q: "Explain the flow when a user submits a form in React."**
Your Answer: "The form has an `onSubmit` handler that prevents the default browser navigation, reads the current state of each controlled input, sends a POST request to the backend API with the form data as JSON in the request body, waits for the response, and then either shows a success state or an error message. Controlled inputs are inputs whose value is stored in React state and updated via onChange handlers, giving React full control over what the input shows."

---

## Concept 7 — SQL: Joins, Foreign Keys, and Relationships

Our `events` table has a `venue_id` column that is a Foreign Key — it references the `id` column of the `venues` table. This creates a one-to-many relationship: one venue can host many events.

When we fetch events, we use a JOIN query to pull in the venue name alongside the event data:

```sql
SELECT e.*, v.name as venue_name 
FROM events e 
LEFT JOIN venues v ON e.venue_id = v.id 
ORDER BY e.start_time ASC
```

`LEFT JOIN` means: give me all events, and if there is a matching venue, include its name. If the event has no venue (venue_id is null), still include the event but with a null venue_name. An `INNER JOIN` would have excluded events without a venue entirely.

**Interview Q: "What is the difference between INNER JOIN and LEFT JOIN?"**
Your Answer: "INNER JOIN returns only rows where there is a match in BOTH tables. LEFT JOIN returns all rows from the left table and matched rows from the right table. If there is no match on the right side, the columns from the right table are null. We used LEFT JOIN for events because a manager might create an event before assigning it to a venue."

---

## Quick Reference — All New Files Added in Phase 2

| File | What It Does |
|------|-------------|
| `backend/src/websocket/index.ts` | Socket.io server that emits mock crowd data every 3 seconds |
| `backend/src/controllers/venueController.ts` | API logic for GET and POST /api/venues |
| `backend/src/controllers/eventController.ts` | API logic for GET and POST /api/events with JOIN query |
| `backend/src/routes/apiRoutes.ts` | Maps /api/venues and /api/events URLs to their controllers |
| `frontend/src/context/SocketContext.tsx` | One WebSocket connection shared across the whole app |
| `frontend/src/hooks/useSocket.ts` | Legacy single-component hook (replaced by SocketContext) |
| `frontend/src/components/Sidebar.tsx` | Left nav with active link highlighting via NavLink |
| `frontend/src/components/Layout.tsx` | Shell component using Outlet for nested routes |
| `frontend/src/pages/Dashboard.tsx` | Live stat cards, area chart, bar chart, alert feed |
| `frontend/src/pages/MapView.tsx` | Leaflet map with fixed gate positions and crowd circle markers |
| `frontend/src/pages/Events.tsx` | Event table with a functional create event modal form |

---

## Interview Talking Points for Phase 2

When someone asks you about real-time systems in your project, say this:

"The dashboard uses WebSockets via Socket.io so updates are pushed from the server instantly without polling. I implemented a React Context provider at the app root that manages one persistent WebSocket connection shared by all pages. When the connection receives an event, it updates shared state, and only the components reading that specific piece of state re-render. On the map, I used react-leaflet with CircleMarkers scaled by crowd count per gate, with a fixed position set per gate so the circles don't jump around. The live charts use Recharts with a rolling 15-point window maintained in state. Essentially each WebSocket message triggers a state update, which triggers a React re-render, which Recharts uses to animate the new bar heights smoothly."

---

## What Comes Next — Phase 3 Preview

Now that the dashboard is live and functional, Phase 3 will add the real intelligence:
- Set up a Python FastAPI server for the ML models
- Implement YOLOv8 person detection from uploaded images or video
- Build a stampede risk prediction model
- Feed real ML results into the dashboard instead of our mock random numbers
