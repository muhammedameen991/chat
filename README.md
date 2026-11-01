# MeshChat

> **Production-Ready Real-Time Peer-to-Peer Messaging Application**
> Built with HTML5, CSS3, Vanilla JavaScript (ES modules), WebRTC DataChannels, and Vercel Serverless Signaling. Designed with the signature **Pastel Rose** WhatsApp-inspired UI.

---

## 🌸 Overview

MeshChat is a real-time messaging application designed to provide true peer-to-peer (P2P) communication without relying on third-party chat clouds (Firebase, Supabase, or external chat backends). 

Once a session is established through the lightweight Vercel signaling layer, messages, typing indicators, delivery acknowledgments, and file attachments travel **directly between user browsers via encrypted WebRTC DataChannels**.

---

## 🎨 Pastel Rose Design System ("Pastel Social")

MeshChat implements a calm, modern, WhatsApp-inspired light-first aesthetic:

| Token | Hex | Role |
|---|---|---|
| **Primary Rose** | `#FFCED8` | Active navigation, outgoing chat bubbles, primary action buttons |
| **Soft Blush** | `#FFDDDD` | Conversation sidebar background, subtle hover highlights |
| **Warm Cream** | `#FFF4DE` | Main chat area background, input backgrounds |
| **Peach** | `#FFE8C4` | Unread badges, button hover accent, highlight tags |
| **Dark Text** | `#34272B` | High-contrast readable typography for headers and messages |
| **Secondary Text** | `#857176` | Timestamps, subtitles, placeholder text |
| **White Surface** | `#FFFFFF` | Incoming chat bubbles, cards, modals |
| **Soft Border** | `#F1DCE0` | Dividers, search input borders, modal outlines |
| **Dark Background**| `#2B2227` | Dark mode surface background |

---

## ⚡ Technical Architecture

### 1. Peer-to-Peer Messaging Engine
- **WebRTC DataChannels (`RTCDataChannel`)**: Direct binary and text streaming between peers with sub-millisecond latency.
- **Automated SDP Exchange**: Offers and answers are negotiated seamlessly without requiring manual copy-pasting of connection codes.
- **ICE Candidate Gathering**: Uses Google STUN servers (`stun:stun.l.google.com:19302`) for NAT traversal.
- **Configurable TURN Relay**: Strict symmetric enterprise/cellular NAT networks can configure a custom TURN server directly in Settings.
- **Delivery State Machine**:
  - `sending`: Queued in local queue
  - `sent`: Accepted by local transport
  - `delivered`: Acknowledged by recipient peer (`type: 'ack'`)
  - `read`: Acknowledged by recipient viewing the conversation (`type: 'read'`)

### 2. Signaling Layer (Vercel Serverless Functions)
- **Endpoints**:
  - `POST /api/signaling/send`: Sends WebRTC signals (offer, answer, candidate, ack, typing, fallback relay).
  - `GET /api/signaling/poll`: HTTP polling for incoming signals.
  - `GET /api/signaling/stream`: Server-Sent Events (SSE) stream for real-time signal dispatch.
  - `POST /api/users/register`: Username registration with uniqueness check and sanitization.
  - `POST /api/users/login`: Username authentication and session retrieval.
  - `GET /api/users/search`: Real-time discovery of registered users with online status.
  - `POST /api/users/heartbeat`: Periodic presence keepalive.

### 3. Local Persistence
- **IndexedDB (`meshchat_db`)**:
  - `conversations`: Stores conversation metadata, contact avatars, timestamps, and unread counts.
  - `messages`: Stores local chat history (text, attachments, timestamps, status).
  - `drafts`: Preserves unsent text per conversation across view navigation.
- **localStorage**: Used solely for lightweight UI preferences (theme mode, enter-to-send, read receipts, TURN configuration).

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- npm or pnpm

### Quickstart
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/meshchat.git
   cd meshchat
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in two different browser windows or devices to test peer-to-peer chat!

4. Run unit tests:
   ```bash
   npm test
   ```

---

## ☁️ Deployment

### Deploying to Vercel
MeshChat is preconfigured for zero-config Vercel deployment with `vercel.json` and `/api` serverless functions:

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy MeshChat"
   git push origin main
   ```
2. Import the project in the [Vercel Dashboard](https://vercel.com/new).
3. Set the Framework Preset to **Other** (or Vite).
4. Click **Deploy**. Vercel will host static files and route `/api/*` to the serverless functions in `api/`.

---

## 🔍 Infrastructure & Security Notes

- **Real Messaging**: MeshChat never uses mock users, simulated chat responses, or hardcoded profiles.
- **Data Privacy**: Because messages travel over peer-to-peer WebRTC DataChannels, your message content is never stored on a centralized chat server.
- **Multi-Device Sync**: In a purely client-side P2P architecture without central cloud storage, chat histories exist locally in each peer's IndexedDB. If you log in on a new device, previous messages stay on the originating device unless synchronized peer-to-peer.
- **TURN Relay Necessity**: STUN allows direct P2P connections for ~85% of consumer NAT networks. However, users behind restrictive corporate firewalls or symmetric cellular NAT require a TURN relay server (which can be configured in the Settings modal).
