# 🎯 Pointy AI — Screen-Aware Voice Guide

> **Ask your screen in your own language, and it shows you the answer.**
>
> 📄 **[Read the 1-Page Solution Pitch](SOLUTION_PITCH.md)** | 🎬 **[Demo Video & Architecture Walkthrough](DEMO_WALKTHROUGH_AND_ARCHITECTURE.md)**

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
┌─────────────────────────────────────────────┐
│              Electron Main Process           │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Tray &   │  │Screenshot│  │  Gnani    │  │
│  │ Hotkeys  │  │ Capture  │  │Prisma+    │  │
│  │          │  │          │  │Timbre     │  │
│  └──────────┘  └──────────┘  └───────────┘  │
│                      │                       │
│                      ▼                       │
│         ┌────────────────────────┐           │
│         │  Gemini Flash 2.5 ☁️  │           │
│         │  (Vision + Reasoning)  │           │
│         │  Sees screenshot →     │           │
│         │  Returns coordinates   │           │
│         └────────────────────────┘           │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
            ┌──────────────────┐
            │  Overlay Window   │
            │  - Buddy mascot   │
            │  - Pointer anim   │
            │  - Target ring    │
            │  - Captions       │
            └──────────────────┘
```

### How It Works

1. **User presses hotkey** → Overlay starts recording audio
2. **Screenshot captured** → Sent directly to Gemini Flash 2.5
3. **Gnani Prisma** transcribes the spoken question (or user types it)
4. **Gemini Flash 2.5** sees the screenshot + reads the question → returns:
   - Exact bounding box coordinates of the target element(s)
   - A spoken reply in the user's language
5. **Cursor animates** — glowing pointer flies to the target with a pulsing ring
6. **Gnani Timbre** (or browser TTS) speaks the answer aloud

### Why Gemini Flash 2.5?

- **Free tier** with generous limits — no cost for development and demos
- **Vision-capable** — directly processes screenshots, no OCR or UI Automation needed
- **Fast** — Flash model optimized for low latency
- **Multilingual** — understands Hindi, Tamil, Telugu, and other Indian languages
- **Accurate** — better at identifying UI elements than text-only approaches

## 📁 Project Structure

```
pointy-ai/
├── src/
│   ├── main/
│   │   ├── main.js               # Electron main process & orchestration
│   │   ├── preload.js            # IPC bridge
│   │   └── services/
│   │       ├── gemini-service.js  # 🧠 Gemini 3.5 Flash-Lite (vision + reasoning)
│   │       └── gnani-service.js   # 🔊 Prisma (STT) + Timbre (TTS)
│   └── renderer/
│       ├── overlay.html          # Overlay UI
│       ├── overlay.css           # Premium glassmorphic styles
│       └── overlay.js            # Animations & interactions
├── package.json
└── README.md
```

## 🔑 API Keys

| Key | Required | Purpose | Get it at |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | **Yes** | Screen vision + reasoning | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GNANI_API_KEY` | Optional | Indian-language voice in/out | [gnani.ai](https://gnani.ai) |

Without `GEMINI_API_KEY`, the app runs in demo mode with simulated responses.
Without `GNANI_API_KEY`, voice uses browser's built-in speech synthesis.

## 🔐 Privacy & Safety

- **Point only** — Pointy never clicks, types, or submits anything
- **Screenshots processed in cloud** — Sent to Gemini API (Google's privacy policy applies)
- **No data stored** — Screenshots are not saved locally or on servers
- **Password fields** — Gemini may see them in screenshots; avoid using Pointy on login pages
- **Transparent** — All data flow is logged in the console

## 🏆 Built For

Gnani AI Great Indian AI Internship Challenge 2026

**Models used:**
- **Gemini Flash 2.5** — Screen vision + reasoning (core brain)
- **Gnani Prisma** — Speech-to-text (voice input)
- **Gnani Timbre** — Text-to-speech (voice output)

## 📄 License

MIT

---

*Inspired by [HeyClicky](https://heyclicky.com). Original code, vision-powered pointing, Indian-language voice.*
