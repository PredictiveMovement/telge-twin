# Simulator and Visualization Integration

This document explains how the simulator and visualization packages communicate with each other, what data is exchanged, and how the data is processed.

## Overview

The simulator and visualization packages use a real-time communication mechanism via Socket.IO. The simulator acts as a Socket.IO server that emits events with simulation data, while the visualization acts as a client that listens for these events and updates its UI accordingly.

## Communication Flow

```
┌─────────────┐                        ┌──────────────┐
│             │        Socket.IO        │              │
│  Simulator  │ ◄──────────────────────┤ Visualization │
│             │ ──────────────────────► │              │
└─────────────┘                        └──────────────┘
    (Server)                               (Client)
```

1. The simulator runs an HTTP server with Socket.IO enabled.
2. The visualization connects to this server via WebSockets.
3. The simulator emits events containing simulation data.
4. The visualization listens for these events and updates the UI accordingly.
5. The visualization can also emit events to control the simulator (e.g., reset, change parameters).

## Server-Side (Simulator)

The simulator package sets up a Socket.IO server in `packages/simulator/web/index.js`:

```javascript
const server = require("http").createServer(ok)
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
  },
})

server.listen(port)
routes.register(io)
```

When a client connects, the server sets up event listeners and starts emitting data in `packages/simulator/web/routes.js`:

```javascript
io.on("connection", function (socket) {
  start(socket, io)
  // ...
  socket.emit("parameters", socket.data.experiment.parameters)
  socket.emit("init")
  // ...
})
```

## Data Types and Emitters

The simulator includes various data emitters that send different types of simulation data:

### Cars Data

```javascript
// From packages/simulator/web/routes/cars.js
experiment.cars.pipe(map(cleanCars)).subscribe((car) => {
  socket.emit("cars", [car])
})

experiment.carUpdates.pipe(/* ... */).subscribe((cars) => {
  if (!cars.length) return
  socket.volatile.emit("cars", cars)
})
```

Car data includes:

- Position (longitude, latitude)
- ID
- Destination
- Speed
- Bearing
- Status
- Fleet information
- Cargo information
- CO2 emissions
- Distance traveled
- Vehicle type
- And more

### Bookings Data

Booking data represents pickup and delivery tasks:

```javascript
// From packages/simulator/web/routes/bookings.js
experiment.bookingUpdates.pipe(/* ... */).subscribe((bookings) => {
  if (!bookings.length) return
  socket.volatile.emit("bookings", bookings)
})
```

Booking data includes:

- Pickup location
- Destination location
- Status
- ID
- Fleet assignment
- Timestamps

### Municipalities Data

Geographic data for municipalities:

```javascript
// From packages/simulator/web/routes/municipalities.js
experiment.municipalities.subscribe((municipality) => {
  socket.emit("municipalities", municipality)
})
```

### Other Data Types

- **Time data**: Virtual simulation time
- **Log messages**: Important events and notifications
- **Parameters**: Simulation configuration parameters

## Client-Side (Visualization)

The visualization connects to the simulator's Socket.IO server in `packages/visualisation/src/index.jsx`:

```javascript
<SocketIOProvider
  url={import.meta.env.VITE_SIMULATOR_URL || "http://localhost:4000"}
  opts={{ withCredentials: true }}
>
  <App />
</SocketIOProvider>
```

The visualization sets up event listeners using a custom `useSocket` hook:

```javascript
// From packages/visualisation/src/App.jsx
const [cars, setCars] = React.useState([])
useSocket("cars", (newCars) => {
  setReset(false)
  setCars((cars) => [
    ...cars.filter((car) => !newCars.some((nc) => nc.id === car.id)),
    ...newCars,
  ])
})

const [bookings, setBookings] = React.useState([])
useSocket("bookings", (newBookings) => {
  // Process and store bookings data
})
```

## Data Processing and Transformation

Both packages perform data transformations:

1. **Simulator to Socket.IO**: The simulator transforms internal data models into a serializable format suitable for Socket.IO transmission.

2. **Socket.IO to Visualization**: The visualization processes the received data to match the format required by the UI components.

For example, car data is transformed using the `cleanCars` function:

```javascript
// From packages/simulator/web/routes/cars.js
const cleanCars = ({
  position: { lon, lat },
  id,
  altitude,
  destination,
  speed,
  /* ... */
}) => ({
  id,
  destination: (destination && [destination.lon, destination.lat]) || null,
  position: [lon, lat, altitude || 0],
  /* ... */
})
```

## Control Flow (Visualization to Simulator)

The visualization can control the simulator by emitting events:

```javascript
// From packages/visualisation/src/App.jsx
const restartSimulation = () => {
  setShowEditExperimentModal(false)
  socket.emit("experimentParameters", experimentParameters)
}

const resetSimulation = () => {
  socket.emit("reset")
}
```

Control events include:

- `reset`: Restart the simulation
- `experimentParameters`: Update simulation parameters
- `speed`: Control the simulation speed
- `pause` / `play`: Control simulation playback

## Buffering and Performance Optimizations

To handle high-frequency data updates efficiently, the simulator implements buffering and filtering:

```javascript
// From packages/simulator/web/routes/cars.js
experiment.carUpdates
  .pipe(
    windowTime(100), // Group updates in 100ms windows
    mergeMap((win) =>
      win.pipe(
        groupBy((car) => car.id), // Group by car ID
        mergeMap((cars) => cars.pipe(last())) // Take only the latest update
      )
    ),
    /* Additional filtering */
    bufferTime(100, null, 100) // Buffer updates for 100ms
  )
  .subscribe((cars) => {
    if (!cars.length) return
    socket.volatile.emit("cars", cars) // Use volatile for better performance
  })
```

Key optimizations:

- `windowTime` and `bufferTime` to reduce update frequency
- `volatile` emit for non-critical updates (allows dropping packets)
- Filtering to send only necessary data
- Client-side state merging to handle updates efficiently

## Reactive Programming with RxJS

The simulator uses RxJS to handle asynchronous data streams:

1. Observable streams are created for simulation entities (cars, bookings, etc.)
2. Operators like `map`, `filter`, and `bufferTime` process and transform the data
3. Subscribers emit the processed data via Socket.IO

This reactive approach allows for efficient handling of complex, real-time data flows.

## Configuration

The server URL is configurable via environment variables:

- **Simulator**: Uses `process.env.PORT` (defaults to 4000)
- **Visualization**: Uses `import.meta.env.VITE_SIMULATOR_URL` (defaults to 'http://localhost:4000')

## Summary

The integration between the simulator and visualization packages is built on:

1. **Socket.IO**: For real-time, bidirectional communication
2. **RxJS**: For processing reactive data streams on the server
3. **React Hooks**: For handling WebSocket events on the client
4. **Data Transformation**: For converting between internal and transmission formats

This architecture allows for efficient, real-time visualization of the simulation data with optimized network usage and responsive UI updates.
