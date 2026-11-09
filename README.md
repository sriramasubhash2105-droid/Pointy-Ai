# 🎯 Pointy AI — Screen-Aware Voice Guide

> **Ask your screen in your own language, and it shows you the answer.**
>
> 📄 **[Read the 1-Page Solution Pitch](SOLUTION_PITCH.md)** | 📐 **[Technical Architecture & Feature Specification](DEMO_WALKTHROUGH_AND_ARCHITECTURE.md)**

Pointy is an AI cursor buddy that lives on your screen. Summon it with a hotkey, ask a question about what you see — in Hindi, Tamil, Telugu, Hinglish, or English — and it physically **points** at the right button, link, or field with a glowing ring and animated cursor, while speaking the answer aloud.

---

## ✨ Features

- 🔴 **Spatial Red AI Cursor** — Pops out directly from your mouse cursor when summoned
- 🎙️ **Voice-first interaction (<kbd>Alt+C</kbd> / <kbd>F8</kbd>)** — Tap to talk, tap again or pause to ask
- ✍️ **Universal Voice Dictation (<kbd>Alt+D</kbd>)** — Speak naturally and Pointy types directly into your active window
- 🎯 **Laser-precise spatial guidance** — Red cursor glides along a smooth trajectory to the target UI element
- 👁️ **Vision-powered** — Gemini Flash 2.5 analyzes screenshots and calculates pixel bounding boxes
- 🔊 **Speaks with you** — Real-time low-latency neural TTS streaming in Indian languages and English (Gnani Timbre v2.5)
- ⚡ **Desktop Automation & Deep Research** — Controls apps, browsers, system volume/settings, and compiles dossiers
- 💬 **Adjacent answer card & Companion Chat App** — Instant answers beside the cursor + full search & history window
- 🖱️ **Non-intrusive click-through** — Transparent canvas overlay that never steals focus

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Windows 10/11 (macOS/Linux supported via Electron)

### Install & Run

```bash
# Clone the repo
cd "Pointy Ai"

# Install dependencies
npm install

# Optional: Set your Gemini API key (free at https://aistudio.google.com/apikey)
$env:GEMINI_API_KEY="your_gemini_key"

# Optional: Set Gnani API key for Indian-language voice
$env:GNANI_API_KEY="your_gnani_key"

# Run!
npm start
```

### Controls

| Action | Shortcut / Trigger | Description |
| :--- | :--- | :--- |
| **Ask with Voice** | <kbd>Alt + C</kbd> or <kbd>F8</kbd> | Tap to start talking, tap again or pause to ask |
| **Voice Dictation** | <kbd>Alt + D</kbd> | Live dictation typed directly into your active window |
| **Ask with Text** | <kbd>Alt + T</kbd> | Opens floating text prompt bar beside cursor |
| **Pop-out Origin** | Click red cursor dock | Cursor pops out from mouse position |
| **Dismiss / Reset** | <kbd>Escape</kbd> or click `✕` | Immediately stops speech and returns to standby |
| **Next Step** | Click "Next Step →" | Progresses through multi-step walkthroughs |
| **Companion Chat App**| Tray icon click | Opens full chat history, search & settings window |

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        POINTY AI DESKTOP UNIVERSE                      │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Transparent Spatial Overlay     │  Standalone Desktop App (Electron)  │
│  - Red AI Companion Cursor (26px)│  - Chat History & Full-Text Search  │
│  - Spatial Pointing & Particles  │  - Pinned & Recent Conversations    │
│  - Adjacent Floating Answer Card │  - Two-Way Real-time Sync           │
│  - Universal Dictation Capsule   │  - API Keys & Model Configuration   │
│  - Deep Research Dossier         │  - Voice Synthesis & Speech Monitor │
└──────────────────────────────────┴─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED ENGINE PIPELINE                         │
├─────────────────┬───────────────────┬───────────────────┬──────────────┤
│ 1. AUDIO & STT  │ 2. VISION & OCR   │ 3. REASONING      │ 4. TTS & ACT │
│ Gnani Prisma    │ screenshot-desktop│ Fast-path matcher │ Gnani Timbre │
│ WebSocket stream│ ScreenGrounder    │ Gemini 2.5 Flash  │ ActionService│
│ 128ms PCM buffer│ Normalization     │ Multi-turn memory │ Paste & exec │
└─────────────────┴───────────────────┴───────────────────┴──────────────┘
```

### How It Works

1. **User triggers interaction** → Press <kbd>Alt+C</kbd> to talk, <kbd>Alt+D</kbd> to dictate, or <kbd>Alt+T</kbd> to type.
2. **Audio streamed in real time** → 16kHz PCM chunks stream via WebSocket to **Gnani Prisma STT** with zero pre-recording delay.
3. **Screen captured & grounded** → Screen snapshot captured and processed via **Gemini 2.5 Flash** to identify precise UI bounding boxes on a normalized 0–1000 coordinate grid.
4. **Instant local actions checked** → System commands (volume, brightness, launching apps, browser tabs) execute instantly (<1ms) via **ActionService**.
5. **Cursor animates spatially** → Glowing companion cursor glides smoothly along a natural bezier curve to the target element with a pulsing ring and particle burst.
6. **Streaming voice & visual answer** → **Gnani Timbre v2.5** streams neural speech in Indian regional languages / English while the adjacent card displays markdown, code, and follow-up controls.

---

## 📁 Project Structure

```
pointy-ai/
├── src/
│   ├── main/
│   │   ├── main.js                     # Core orchestration, hotkeys, state machine & window manager
│   │   ├── preload.js                  # Secure IPC bridge exposing window.pointyAPI & window.chatAPI
│   │   ├── scripts/
│   │   │   └── scan-ui.ps1             # Windows UI Automation accessibility scanner
│   │   └── services/
│   │       ├── action-service.js       # Universal desktop automation, app indexer & browser routing
│   │       ├── conversation-manager.js # Multi-turn conversation sessions, SQLite/JSON persistence
│   │       ├── gemini-service.js       # Gemini 2.5 Flash / Flash-Lite vision perception & reasoning
│   │       ├── gnani-service.js        # Persistent WebSocket streaming for Prisma STT & Timbre TTS
│   │       └── screen-grounder.js      # Hybrid UI Automation + OCR spatial coordinate grounding
│   └── renderer/
│       ├── chat-app.html / .js / .css  # Standalone ChatGPT-style desktop application window
│       └── overlay.html / .js / .css   # Transparent spatial canvas, red cursor mascot & cards
├── DEMO_WALKTHROUGH_AND_ARCHITECTURE.md # Complete technical specification & pipeline guide
├── SOLUTION_PITCH.md                   # 1-page executive problem/solution pitch
├── package.json
└── README.md
```

## 🔑 API Keys

| Key | Required | Purpose | Provider |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | Screen vision perception, coordinate grounding & reasoning | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GNANI_API_KEY` | Optional | Sub-second Indian-language streaming STT & Timbre TTS | [Gnani.ai](https://gnani.ai) |

> [!NOTE]
> - Without `GEMINI_API_KEY`, Pointy runs in demo mode with simulated responses.
> - Without `GNANI_API_KEY`, voice input falls back to Gemini STT / Web Speech, and voice output uses browser speech synthesis.

## 🔐 Privacy & Safety

- **User-Initiated Execution** — Pointy only types, points, or interacts when explicitly summoned by you via hotkey (<kbd>Alt+C</kbd>, <kbd>Alt+D</kbd>, <kbd>Alt+T</kbd>) or UI click.
- **On-Demand Vision** — Screenshots are captured strictly at the moment you ask a question; there is no standing or background screen recording.
- **Transparent Click-Through** — When idle, the overlay window is completely click-through and never traps or intercepts your mouse events.
- **Direct Keystroke Injection** — In Dictation mode (<kbd>Alt+D</kbd>), text is typed exclusively into your currently focused window via native clipboard paste without stealing window focus.

## 🏆 Built For

Gnani AI Great Indian AI Internship Challenge 2026

**Core AI Engines:**
- **Gemini 2.5 Flash** — Screen vision perception, grounding & multimodal reasoning
- **Gnani Prisma** — Low-latency WebSocket streaming speech-to-text
- **Gnani Timbre v2.5** — Low-latency neural streaming text-to-speech across Indian languages

## 📄 License

MIT

---

*Inspired by [HeyClicky](https://heyclicky.com). Original code, vision-powered pointing, Indian-language voice.*
