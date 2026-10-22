# 🎯 Pointy AI — Screen-Aware Voice Guide

> **Ask your screen in your own language, and it shows you the answer.**

Pointy is an AI cursor buddy that lives on your screen. Summon it with a hotkey, ask a question about what you see — in Hindi, Tamil, Telugu, Hinglish, or English — and it physically **points** at the right button, link, or field with a glowing ring and animated cursor, while speaking the answer aloud.

---

## ✨ Features

- 🎙️ **Voice-first interaction** — Press `Ctrl+Shift+Space` and speak your question
- 🎯 **Animated cursor pointing** — A smooth, glowing cursor flies to the exact UI element
- 👁️ **Vision-powered** — Gemini Flash 2.5 sees your screenshot and reasons about it
- 🌐 **Indian language support** — Hindi, Tamil, Telugu, Hinglish, and more via Gnani
- 👣 **Multi-step guidance** — Walks you through complex tasks one click at a time
- 💬 **On-screen captions** — See the answer even with sound off
- 🖱️ **Non-intrusive** — Click-through overlay that never steals focus
- ⌨️ **Text input fallback** — Double-click the buddy to type your question

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Windows 10/11 (macOS/Linux supported via Electron)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/pointy-ai.git
cd pointy-ai

# Install dependencies
npm install

# Set your Gemini API key (free at https://aistudio.google.com/apikey)
# PowerShell:
$env:GEMINI_API_KEY="your_gemini_key"

# Optional: Set Gnani API key for Indian-language voice
$env:GNANI_API_KEY="your_gnani_key"

# Run!
npm start
```

### Controls

| Action | How |
| --- | --- |
| Ask a question (voice) | `Ctrl + Shift + Space` → speak → press again |
| Ask a question (text) | Double-click the buddy mascot |
| Dismiss | Press `Escape` |
| Next step (multi-step) | Click "Next →" button |
| Move buddy | Drag it anywhere |

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
│   │       ├── gemini-service.js  # 🧠 Gemini Flash 2.5 (vision + reasoning)
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
