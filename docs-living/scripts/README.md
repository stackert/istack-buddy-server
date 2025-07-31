# Chat Test Scripts

## Simple Chat Test

**File:** `simple-chat-test.ts`

**Purpose:** Minimal example of sending/receiving messages via Socket.IO WebSocket

**Usage:**

```bash
npx ts-node docs-living/scripts/simple-chat-test.ts
```

**What it does:**

1. Connects to server on localhost:3000
2. Joins a test room
3. Sends a test message
4. Waits for echo response
5. Exits when done

**Expected output:**

```
✅ Connected to server
📤 Sending test message...
📤 Message sent, waiting for response...
📥 Received message: Hello from test script! Please echo this back.
🏁 Test complete - exiting
👋 Disconnected from server
```

**Requirements:**

- Server must be running on localhost:3000
- socket.io-client package installed (included in dev dependencies)
