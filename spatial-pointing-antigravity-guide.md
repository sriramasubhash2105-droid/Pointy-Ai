# AI Spatial Pointing Architecture & UX Optimization Guide
*A Technical Specification for Integration into Antigravity Agent Systems*

## 1. Executive Summary & Architectural Overview

### 1.1 The Spatial Pointing Paradigm
Traditional multimodal AI assistants rely on standalone chat panels, browser tabs, or heavy autonomous OS control ("computer use" agents). While autonomous OS control simulates full mouse and keyboard interactions, it incurs massive execution latency, high token consumption, fragile UI state management, and safety risks from uncontrolled actions.

**Spatial Pointing** represents an ambient, zero-friction human-computer interaction (HCI) paradigm. Implemented in native desktop AI companions like **Clicky** (`farzaa/clicky` for macOS) and **clicky-windows** (`Bitshank-2338/clicky-windows` for Windows), spatial pointing uses a transparent overlay canvas to project a visual cursor and annotations directly onto the user's active workspace. 

### 1.2 Comparison: Spatial Pointing vs. Autonomous OS Control

| Architectural Dimension | Spatial Pointing Overlay (Clicky) | Autonomous OS Control (Computer Use) |
| :--- | :--- | :--- |
| **User Interaction Model** | Ambient tutor looking over the user's shoulder | Autonomous actor replacing user input |
| **Execution Latency** | **Sub-second to 2s** (Streaming SSE token parsing) | **5–15s per turn** (Action -> Exec -> Verify loop) |
| **Token Overhead** | Minimal (~10–15 tokens for location tags) | Massive (Action schemas, coordinate histories, state logs) |
| **System Permission Scope** | Screen capture & transparent rendering overlay | Full OS accessibility & event synthesis privileges |
| **Failure Mode Impact** | Non-disruptive visual misdirection | Destructive accidental clicks/keypresses |
| **Workspace Focus** | Zero context-switching; preserves active app state | Steals active window focus and input focus |

---

## 2. Step-by-Step Spatial Pointing Pipeline & Coordinate Translation Mechanics

### 2.1 On-Demand Multi-Monitor Screen Capture
In macOS (`farzaa/clicky`), capture is managed by `CompanionScreenCaptureUtility.swift` using Apple's **ScreenCaptureKit** framework (macOS 14.2+). Upon releasing the push-to-talk hotkey (`Control + Option`):
1. ScreenCaptureKit enumerates all connected physical displays (`NSScreen.screens`).
2. Snapshot frames are captured simultaneously across all displays.
3. Snapshots are compressed into JPEG images and tagged with display identifiers: `screen0`, `screen1`, etc.
4. The tagged images are bundled with the audio transcript and sent to the multimodal LLM gateway.

### 2.2 Spatial Location Prompt Engineering
Multimodal LLMs (Claude 3.5 Sonnet, Gemini 2.5/3.8 Flash, GPT-4o) are instructed via system prompts to embed structured spatial tags inline within their streaming text responses whenever referencing a UI element:

```text
[POINT:x,y:label:screenN]
```

- **`x, y`**: Normalized integer coordinates ranging from `0` to `1000` across the target image dimensions.
- **`label`**: A short text description of the target UI element (e.g., `Export Button`, `Timeline Layer`).
- **`screenN`**: Identifies the target physical monitor (`screen0`, `screen1`).

### 2.3 Normalized Coordinate System (0–1000 Scale)
Using a normalized scale ($0$ to $1000$) decouples the vision model from:
- Differing native screen resolutions ($1080\text{p}$, $1440\text{p}$, $4\text{K}$).
- Multi-monitor aspect ratio variances.
- OS-level HiDPI and Apple Retina display scaling factors ($2\times$ pixel density rendering).

### 2.4 Coordinate Translation Mathematics

#### A. macOS AppKit Geometry (`ElementLocationDetector.swift`)
macOS uses a Cartesian coordinate system with the origin $(0,0)$ located at the **bottom-left** of the primary display, whereas image space starts at the **top-left** $(0,0)$.

Given:
- $x_{norm}, y_{norm} \in [0, 1000]$
- Display origin: $(X_{origin}, Y_{origin})$
- Display size: $W_{display} \times H_{display}$

The AppKit screen pixel conversion is:
$$\text{Pixel } X = X_{origin} + \left( \frac{x_{norm}}{1000} \times W_{display} \right)$$
$$\text{Pixel } Y = Y_{origin} + \left( \left(1.0 - \frac{y_{norm}}{1000}\right) \times H_{display} \right)$$

#### B. Windows DPI & Origin Offset Geometry (`element_locator.py`)
Windows uses a top-left origin $(0,0)$ for all displays, but requires explicit DPI scale factor handling (e.g., 125%, 150%, 200%).

Given DPI scaling factor $S_{DPI}$ (e.g., $1.25$ or $1.50$):
$$\text{Logical Pixel } X = \frac{X_{origin} + \left(\frac{x_{norm}}{1000} \times W_{display}\right)}{S_{DPI}}$$
$$\text{Logical Pixel } Y = \frac{Y_{origin} + \left(\frac{y_{norm}}{1000} \times H_{display}\right)}{S_{DPI}}$$

### 2.5 Universal Two-Stage Grid Locator
For non-fine-tuned vision models (e.g., Gemini Flash, local Ollama vision models) that struggle with raw $0$–$1000$ spatial regression:
1. **Coarse Pass (12×8 Grid)**: A $12 \times 8$ numbered grid is overlaid onto the screenshot. The LLM selects the grid cell ID (e.g., `Grid C4`).
2. **Fine Zoom Pass (6×6 Sub-Grid)**: The engine crops the selected cell and overlays a $6 \times 6$ fine sub-grid. The LLM selects the sub-cell ID (e.g., `Sub 2B`).
3. **Resolution**: Yields sub-cell pixel precision across any standard vision LLM without custom coordinate fine-tuning.

### 2.6 Transparent Overlay Canvas Implementation
- **macOS (`OverlayWindow.swift`)**: Borderless `NSPanel` covering all Spaces. Set as non-activating (`.nonactivatingPanel`), level `.floating` / `.mainMenu`, with `ignoresMouseEvents = true` so clicks pass straight through to active software.
- **Windows (`ui/overlay.py`)**: Transparent `PyQt6` window with `Qt.WindowType.FramelessWindowHint`, `Qt.WindowType.WindowStaysOnTopHint`, and `WS_EX_TRANSPARENT` / `WS_EX_LAYERED` Win32 extended window styles.

### 2.7 Animation Physics
When a point tag is parsed:
1. **Bezier Trajectory**: The blue cursor graphic calculates a smooth 3D Bezier curve trajectory from its current position to the target pixel coordinates over a $300\text{ms}$ ease-in-out duration.
2. **Target Dwell & Pulsing Ring**: Upon arrival, a pulsing highlight ring expands around the target UI element.
3. **Speech Bubble**: A floating speech bubble presents the textual explanation directly adjacent to the visual target.

---

## 3. Latency Reduction & Architectural Efficiency Analysis

### 3.1 Token Footprint Efficiency
- **Textual Direction Cost**: Standard text instructions ("Look at the top right menu, click Window, navigate down 5 items to Tracker") require $100$–$250$ generated output tokens.
- **Spatial Tag Cost**: A tag `[POINT:450,120:Tracker:screen0]` requires only **10–12 output tokens**.
- **Latency Impact**: Reduces LLM output generation time by **80%–90%**.

### 3.2 Streaming SSE Tag Parsing
Rather than waiting for the entire LLM completion:
1. As Server-Sent Events (SSE) tokens stream in real time, the client runs a lightweight regex matcher over the buffer.
2. The moment `[POINT:x,y...]` is matched, cursor movement begins immediately—while the rest of the text response and Text-to-Speech (TTS) audio are still being generated and streamed.

### 3.3 Parallel Execution Pipeline

```text
[ Incoming SSE Stream ]
       │
       ├──► Regex Matcher ──► Extract [POINT] ──► Immediate Bezier Cursor Flight
       │
       ├──► Text Buffer   ──► UI Overlay       ──► Render Speech Bubble
       │
       └──► Chunked TTS   ──► ElevenLabs       ──► Live Audio Playback (AVAudioPlayer)
```

### 3.4 Bypassing Execution Feedback Loops
Autonomous OS control requires a continuous multi-step loop: `Observe -> Plan -> Execute Click -> Capture Screen -> Verify -> Retry`. This loop incurs heavy cumulative latency ($15\text{s}$–$45\text{s}$). Spatial pointing provides direct visual feedback in a single turn ($1.5\text{s}$–$2.5\text{s}$).

---

## 4. User Experience (UX) & Ergonomic Advantages

1. **Zero Context Switching**: Users remain focused inside complex creative, engineering, or IDE environments (Adobe After Effects, Figma, Xcode, VS Code) without switching to a chat window.
2. **Non-Disruptive Guidance**: Because the transparent layer is click-through, the user can continue typing, dragging, or navigating uninterrupted while the visual companion points out elements.
3. **Human-in-the-Loop Synergy**: Positions AI as an ambient mentor rather than an unpredictable auto-pilot, retaining complete user agency and safety.

---

## 5. Integration Specifications for Antigravity Agent Systems

### 5.1 System Prompt Insert for Antigravity

```text
You are an ambient visual assistant. When directing the user to any UI element on their screen, you MUST include a spatial location tag in your response using the following format:

[POINT:x,y:label:screenN]

Where:
- x, y: Normalized integer coordinates from 0 to 1000 representing the horizontal and vertical center of the target element.
- label: A short 1-3 word description of the target UI element.
- screenN: The display identifier (e.g., screen0, screen1) containing the element.

Keep your verbal explanations concise (1-2 sentences). Emit the [POINT] tag as early as possible in your response.
```

### 5.2 Regular Expression Tag Matcher (Python / Antigravity Agent)

```python
import re

POINT_TAG_REGEX = re.compile(
    r'\[POINT:\s*(\d{1,4})\s*,\s*(\d{1,4})\s*:\s*([^:]+)\s*:\s*(screen\d+)\s*\]'
)

def parse_spatial_tags(stream_chunk: str):
    matches = POINT_TAG_REGEX.findall(stream_chunk)
    results = []
    for match in matches:
        x_norm, y_norm, label, screen_id = match
        results.append({
            "x_norm": int(x_norm),
            "y_norm": int(y_norm),
            "label": label.strip(),
            "screen_id": screen_id.strip()
        })
    return results
```

### 5.3 Swift Coordinate Translation Function (macOS AppKit)

```swift
import AppKit

func convertNormalizedPointToScreenPixels(
    xNorm: Int, 
    yNorm: Int, 
    screenIndex: Int
) -> CGPoint? {
    let screens = NSScreen.screens
    guard screenIndex < screens.count else { return nil }
    let targetScreen = screens[screenIndex]
    let frame = targetScreen.frame
    
    let pixelX = frame.origin.x + (CGFloat(xNorm) / 1000.0 * frame.width)
    let pixelY = frame.origin.y + ((1.0 - CGFloat(yNorm) / 1000.0) * frame.height)
    
    return CGPoint(x: pixelX, y: pixelY)
}
```

---
*Generated for Antigravity Agent Integration | Open Source Spatial Pointing Specification*
