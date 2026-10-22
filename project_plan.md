# Pointy: Screen-Aware Voice Guide

Project plan for the Gnani AI Great Indian AI Internship Challenge · Updated October 21, 2026 · Submission deadline November 10, 2026 · “Pointy" is a working name; check availability before using it publicly.

## 1. The idea in one paragraph

Dikhao is an AI buddy that lives next to your cursor, in the style of Clicky (see section 1a). You summon it by voice or hotkey and ask a question in your own language (“Refund ka option kahan hai?”, “How do I turn on dark mode?”). It reads what is on the page, answers out loud in the same language, and physically points at the right button, link, or field with a glowing ring and a gliding cursor. For multi-step tasks it walks you through one click at a time. It only points and never clicks for you, so the user stays in control.

The pitch for LinkedIn and X: **“Ask your screen in your own language, and it shows you the answer.”**

## 1a. Update: build it like Clicky, as a desktop cursor buddy

Dikhao now follows the Clicky model: a small buddy beside your cursor that you wake with a hotkey, that hears your question, sees your screen, and flies to what you need, in your language.

**What Clicky is.** [Clicky](https://github.com/iFurySt/clicky) is an open-source macOS menu bar app (this link is a fork of Farza Majeed’s original repo, MIT licensed). Push-to-talk audio goes to AssemblyAI, then the transcript and a screenshot go to Claude, which replies with point tags that make a blue cursor overlay fly to the target. ElevenLabs speaks the answer, and a Cloudflare Worker proxy keeps the API keys off the device. Search results mention a community Windows port, which I have not opened.

**The key difference.** Clicky points because Claude can see the screenshot and return coordinates. Evon can’t see images, so Dikhao needs another way to know what is where.

### How Pointy finds things without a vision model

1. Read the screen’s elements with Windows UI Automation, which gives names and bounding boxes for most buttons, menus, and fields in native apps and browsers.
2. Fill the gaps with OCR on a screenshot, which returns text with bounding boxes for anything the accessibility tree misses (images, canvas, remote desktops).
3. In Chrome, optionally use the extension from sections 6 and 7 to read the page DOM, which is more precise than the first two.
4. Merge everything into one numbered list: id, label, role, screen rectangle.
5. Evon picks ids from that list, as in section 8, and the overlay flies the cursor to the centre of that rectangle.

I have not verified how complete Chrome’s tree is under UI Automation, so test that in the first days.

### Desktop architecture

| Piece | Job |
| --- | --- |
| Tray app and global hotkey | Starts and stops listening (push-to-talk). |
| Transparent overlay window | Click-through and always on top; draws the buddy, ring, arrows, and captions across monitors. |
| Grounding module | UI Automation, OCR, and the optional Chrome extension feed one numbered element list. |
| Backend proxy | Holds the Gnani key, calls Prisma, Evon, and Timbre, and enforces rate limits. |
| Gnani models | Prisma hears, Evon decides, Timbre speaks. |

Sections 6 and 7 below now describe the browser version of the grounding module, not the whole app.

### Ways to build it

| Option | Upside | Downside |
| --- | --- | --- |
| Fork Clicky (macOS, Swift) | Overlay, hotkey, push-to-talk, and proxy already work. | Mac only; its pointing relies on a vision model, so the grounding layer must be rewritten; reviewers may see it as derivative. |
| Build your own on Windows (Electron, Tauri, or Python) | Original code, and Windows is common among students. | More to build in three weeks, including the overlay and display scaling. |
| Browser extension only (sections 6 and 7) | Fastest and most reliable pointing. | Works inside the browser only. |

**Recommendation:** borrow Clicky’s architecture, write your own code and grounding layer, and credit Clicky openly in the README and the post. The rules ban plagiarism and require genuine use of Gnani technology, so ask the organizers before building directly on open-source code.

### What stays original

- Indian-language and Hinglish voice, using Prisma and Timbre.
- Pointing without a vision model, using Evon over a text element list.
- Explaining English interface labels in the user’s own language.

### Desktop gotchas

- Display scaling (125% or 150% on many laptops) and multi-monitor offsets shift coordinates unless handled.
- Admin-level windows can block UI Automation and overlays.
- OCR accuracy on small text and on Indic scripts is unverified; most on-screen labels are English, so start there.
- Screen capture is a privacy risk: skip password fields and sensitive windows, and say what is sent.

### New open questions

1. Which OS do you have, Windows or macOS? It decides the stack.
2. Do the rules allow building on open-source code such as Clicky?

## 1b. Build guide: Pointy from scratch on Windows

The fastest original build is one Python app: a PySide6 overlay and tray, Windows UI Automation plus OCR for grounding, and a small proxy for the Gnani calls. You write every line yourself and use Clicky only as inspiration. I assumed Windows; if you use a Mac, the shell and grounding layer change, so tell me and I’ll redo this.

### Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App shell and overlay | Python 3.11 with PySide6 (Qt) | Transparent click-through windows, tray icon, and animation in one library. |
| Global hotkey | `pynput` or `keyboard` | Push-to-talk from any app. |
| Mic and speaker | `sounddevice` | Records the question and plays Timbre’s audio. |
| Screenshots | `mss` | Fast capture per monitor, for OCR. |
| UI elements | `uiautomation` (wraps Windows UI Automation) | Names and screen rectangles of buttons, menus, and fields. |
| OCR | RapidOCR or Tesseract | Text boxes where UI Automation returns nothing. |
| Proxy | FastAPI, or a Cloudflare Worker | Keeps the Gnani key off the device and enforces rate limits. |
| Packaging | PyInstaller | One exe to share. |

These are the standard choices as far as I know, and I haven’t tested them together. Check each library’s Windows support before committing.

### Build order

Each step ends with something you can test.

1. **Overlay and buddy.** Create a frameless, transparent, always-on-top window per monitor that lets mouse clicks pass through. Draw a small buddy that follows the real cursor at an offset. Test: you can click things underneath it.
2. **Push-to-talk.** Hold a hotkey such as Ctrl+Alt to record and release to send. Pulse the buddy while listening. Test: a clean WAV file is saved.
3. **Proxy and Gnani calls.** Build three proxy routes (transcribe, ask, speak) and test each by itself before wiring them together. Take request formats and audio requirements from docs.gnani.ai.
4. **Grounding v1: UI Automation.** Take the foreground window, walk its controls, and keep visible ones with a name and rectangle (buttons, links, menu items, tabs, edit boxes, checkboxes, dropdowns). Skip password fields. Cap depth and time, around 300 to 500 ms, because big trees are slow. Test: print the list for five different apps.
5. **Calibrate coordinates.** Draw a rectangle on the overlay at each UI Automation rectangle and compare it with the real control at 100%, 125%, and 150% display scaling and on a second monitor. UI Automation reports physical pixels while Qt works in logical pixels, so divide by the screen’s device pixel ratio. Do this before anything depends on it.
6. **Evon decision.** Send the transcript, language, app name, window title, and numbered element list, using the prompt and schema from section 8. Validate the JSON, check that every id exists in your list, and retry once if not.
7. **Pointing.** Move the buddy along a curved, eased path to the centre of the chosen rectangle, pulse a ring around it, and show a caption. Return to the cursor on a timeout or click.
8. **Speak.** Send the reply to Timbre and play it. Start the pointing animation as soon as Evon’s JSON arrives, without waiting for the audio.
9. **Grounding v2: OCR fallback.** If UI Automation returns few elements or nothing matches, screenshot the foreground window, run OCR, and add each text line as an element with its box. Drop OCR boxes that overlap a UI Automation element.
10. **Multi-step flow.** Run a small state machine: idle, listening, thinking, pointing, waiting for next, idle. Advance when the user clicks (global mouse hook) or says “next”, and rescan the screen after each click.
11. **Language handling.** Use the language Prisma detects to choose Timbre’s voice, and add a language lock in the tray menu.
12. **Safety and polish.** Add a per-app off list, skip password fields and sensitive windows, rate limits, spoken error messages, on-screen captions, and a settings panel.
13. **Package and test on a second laptop.** Build with PyInstaller, expect a SmartScreen warning, and publish a GitHub release plus run-from-source instructions.

The first seven steps are the first week’s target in section 13.

### Keeping it independent of Clicky’s code

- Start a fresh repository and write from this plan, not from Clicky’s files.
- Use your own JSON schema instead of Clicky’s point tags, and your own grounding layer and overlay.
- Credit Clicky as inspiration in the README and say what is different: Indian-language voice, and pointing without a vision model.
- The rules ban plagiarism, and I’m not a lawyer, so ask the organizers if anything feels borderline.

### What is most likely to go wrong

- **Empty or huge trees in Chrome and Electron apps.** Chrome may need accessibility forced on, and the optional Chrome extension is the more reliable fallback there.
- **Offsets on scaled or multi-monitor setups.** Step 5 catches this early.
- **Overlay stealing focus or blocking clicks.** Test click-through on every app you demo.
- **Admin-level windows.** UI Automation can’t read them unless your app also runs as admin.
- **Slow responses.** Cap the scan time, send a compact list, and keep replies short.
- **Antivirus flagging the exe.** Offer run-from-source as a backup.

### Accuracy test before filming

Write 20 questions across five apps, for example Chrome, File Explorer, Windows Settings, VS Code, and a PDF reader. Count how often the ring lands on the right element, and fix the weakest app before you record. Aim for a clear majority of hits, and pick demo apps where it works well.

## 2. Why this idea fits the challenge

- **Built on Gnani’s three models.** Prisma (speech-to-text) hears the question, Evon (reasoning) works out which element on the page answers it, and Timbre (text-to-speech) speaks the reply.
- **Strong demo moment.** A cursor flying to the exact button is visual, instant, and easy to understand with the sound off.
- **Engagement hook built in.** The post can end with “Which website confuses you the most? Drop it below,” which gives people a reason to comment.
- **Targets several awards.** Regional languages, Hinglish and code-mixed voice, real-world impact, Tier 2 and Tier 3 users, creativity, best 60-second demo, and best solo or duo project.
- **Honest caveat on novelty.** Screen-aware assistants already exist in English. The difference here is the Indian-language, voice-first, point-at-it experience built entirely on Gnani’s stack.

## 3. Challenge rules recap (from the programme page screenshots)

| Topic | What the rules say |
| --- | --- |
| Who can enter | Eligible college and university students, solo or a team of up to two. Each member registers with accurate personal and college details. |
| Credits | Registered participants get 5,000 programme credits on Gnani AI’s APIs. |
| Models | Prisma (speech to text), Timbre (text to speech, beta), Evon (30B reasoning model, on Hugging Face). |
| Build | A working application using Gnani’s models or APIs that solves a practical need for enterprises, developers, or creators. |
| Submission | By November 10, 2026 (final, no extensions): demo or video, written project explanation, the Gnani models or APIs used, and your LinkedIn or X post links. |
| The post | Public video on LinkedIn and/or X showing the app working, explaining what you built, naming the Gnani technology, tagging Gnani AI’s official account, and including #GnaniAI and #GreatIndianAIInternshipChallenge. One nominated post per platform. Tagging alone does not complete the entry. |
| Shortlisting | Gnani verifies engagement (reactions, comments, reshares) on your nominated posts, reviews submissions, and shortlists for interviews. Only engagement recorded by the published closing cutoff counts. |
| Awards | Ten awards of ₹50,000 each, independent of internship selection: regional languages, Hinglish and code-mixed voice, noisy telephonic audio, real-world impact, best solo or duo project, creativity, Tier 2 and Tier 3 town entries, best 60-second demo, and a public-vote Crowd Favourite. No one can win more than one award. |
| Internships | Up to 100 paid internships, stipends up to ₹1 lakh per month (a maximum, not a guarantee), paid to each intern individually. Only a written offer confirms an internship. |
| Authenticity | Purchased engagement, bots, paid promotion, engagement exchanges, plagiarism, and misleading demos are not allowed and can lead to disqualification. |

**Important consequence:** only engagement before the closing cutoff counts, so the demo post should go live as early as possible, not on the last day. Look up the exact cutoff and scoring method on the programme page, because they were not in the screenshots.

## 4. Target users and problems

1. **People who struggle with English-only interfaces.** Government portals, banking sites, insurance forms, and e-commerce checkouts where the button labels are in English and the flow is confusing.
2. **Older users and first-time internet users** who would rather ask “where do I tap?” than read a help page.
3. **Employees learning new software** (HR portals, CRMs, dashboards) who get stuck on where things are.
4. **Beyond the challenge:** companies that want an in-app “guide me” widget for their own product, in regional languages. This is the natural path from demo to product.

## 5. User experience

**Summon.** Press a hotkey, hold the mic button, or click the small floating mascot. (A spoken wake word is more fragile and harder to demo, so start with push-to-talk.)

**Ask.** The user speaks in Hindi, Tamil, Telugu, Hinglish, or another supported language.

**Answer.** The mascot pops up, speaks a short answer in the same language, and a glowing ring appears around the target element while a cursor glides to it.

**Follow along.** For multi-step tasks, the guide highlights step one. When the user clicks, or says “next” or “agla”, it moves on to step two.

**Dismiss.** Say “thanks” or press Escape, and the mascot shrinks to the corner.

### Example interactions

| User says | Guide does |
| --- | --- |
| “Yahan se refund ka option kahan hai?” | Rings the Refund link and says where it is in Hindi. |
| “Dark mode kaise on karun?” | Walks through Settings, then Appearance, then the toggle, one highlight at a time. |
| “Ye form me ‘PAN’ kahan daalna hai?” | Rings the correct input field and explains what goes there. |
| “இந்த பக்கத்தில் ஸ்டேட்மென்ட் எங்கே?” (Tamil) | Points at the statements link and replies in Tamil. |

## 6. System architecture

Update: this section and the next describe the browser-based grounding module. The full desktop design is in section 1a.

### Components

| Component | Job |
| --- | --- |
| Chrome extension, content script | Scans the visible page for interactive elements, assigns IDs, draws the overlay, animates the pointer. |
| Chrome extension, background service worker | Captures audio, talks to the backend, relays results to the content script. |
| Small backend proxy | Holds the Gnani API key, calls Prisma, Evon, and Timbre, and enforces rate limits. Deploy on something like Cloudflare Workers or Vercel. |
| Gnani Prisma | Speech to text for the user’s question. |
| Gnani Evon | Reads the question plus the element list and returns which element(s) to point at and what to say. |
| Gnani Timbre | Speaks the reply. |

**Never put the Gnani API key inside the extension.** Anyone can unzip an extension and read it. All API calls go through your backend.

### Request flow

1. User presses the hotkey and speaks.
2. Audio goes to the backend, which calls Prisma and returns a transcript and detected language.
3. In parallel, the content script collects the element list for the current viewport.
4. The backend sends the transcript, language, page title and host, and the element list to Evon.
5. Evon returns JSON: a short reply, the language, and one or more element IDs with a short instruction for each.
6. The backend sends the reply text to Timbre and streams audio back.
7. The content script maps the element ID to the real DOM element, scrolls it into view, draws the ring, and moves the cursor while the audio plays.

### Why no vision model is needed

Evon is a text reasoning model, so it can’t look at a screenshot. In a browser you don’t need it to. The page already exposes every button, link, and field with its label and position, so you hand Evon a numbered list and let it choose. Picking an ID from a list is also far more reliable than guessing pixel coordinates. Before adding any other model, check the rules, because entries must show genuine use of Gnani’s technology and the rules did not say whether extra models are allowed.

## 7. Page understanding

**What to collect, per element:** an ID you assign, its role (button, link, input, menu item, tab), its label (visible text, aria-label, placeholder, title, or alt text), and optionally a short “near” hint such as the section heading above it.

**What to include:** only elements that are visible in the current viewport, larger than a few pixels, not hidden by CSS, and with a non-empty label. Cap the list at roughly 200 to 300 items to protect your credit budget and Evon’s context.

**What to skip:** password fields, payment card fields, and the values of any input. Send the label of an input, never what the user typed.

**Hard cases to plan for:**

- Pages that re-render constantly (use a MutationObserver or re-scan on each question).
- Content inside iframes and shadow DOM (handle the common cases, skip the rest).
- Canvas-based or heavily custom UIs that expose no useful elements. Choose demo sites that work and avoid claiming “every website.”
- Icon-only buttons with no label. Use aria-label or title if present, otherwise let Evon infer from position and nearby text, and accept some misses.

### Starter code: element collector

```js
const registry = new Map(); // id -> element

function collectElements(limit = 250) {
  registry.clear();
  const selector =
    'a,button,input,select,textarea,summary,[role=button],[role=link],[role=menuitem],[role=tab]';
  const out = [];
  let id = 0;
  for (const el of document.querySelectorAll(selector)) {
    if (el.type === 'password') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const label = (
      el.getAttribute('aria-label') || el.innerText || el.placeholder ||
      el.title || el.alt || ''
    ).trim().slice(0, 80);
    if (!label) continue;
    id += 1;
    registry.set(id, el);
    out.push({ id, role: el.getAttribute('role') || el.tagName.toLowerCase(), label });
    if (out.length >= limit) break;
  }
  return out;
}
```

### Suggested project structure

```
dikhao/
  extension/
    manifest.json        (Manifest V3, permissions: activeTab, scripting, storage)
    background.js        (hotkey, audio capture, calls backend)
    content.js           (collectElements, overlay, pointer animation)
    overlay.css          (ring, cursor, mascot; use a shadow DOM host)
  backend/
    index.js             (routes: /ask, with rate limiting)
    gnani.js             (Prisma, Evon, Timbre wrappers)
  README.md
```

## 8. Evon prompt and output format

Test this early, because I have not verified how reliably Evon holds a strict JSON format. Have the backend validate the output, check that every element ID exists in the list you sent, and retry once on failure.

### System prompt (draft)

```
You are the reasoning engine of a screen guide for Indian-language users.
You receive: the user's spoken question (transcribed), its language code,
the page title and host, and a numbered list of visible interactive
elements. Decide which element(s) answer the question.

Rules:
- Only use element ids from the list. Never invent ids.
- If nothing on screen matches, say so and suggest where to look. Do not guess.
- Reply in the user's language. Maximum two short sentences, spoken style.
- For multi-step tasks, return up to 5 steps in order.
- You can only point. Never claim to click, type, or submit.
- Output JSON only, no extra text.
```

### Output schema

```json
{
  "found": true,
  "reply": "Refund yahan hai, upar right me.",
  "reply_lang": "hi-IN",
  "steps": [
    { "element_id": 14, "instruction": "Yahan dabaiye." }
  ],
  "needs_clarification": false,
  "clarifying_question": ""
}
```

### Handling follow-ups

Keep the last turn or two in the request (question, reply, which step the user is on) so “agla step” or “aur kahan?” works. Re-scan the page after each click, because the screen has changed.

## 9. Voice pipeline

- **Speech to text (Prisma v2.5).** Gnani’s docs describe a REST endpoint for short audio (up to 60 seconds), a realtime WebSocket for streaming, and a batch API. For push-to-talk questions, REST is simplest to start with; move to streaming if latency feels slow. Coverage is 10 Indian languages plus Hinglish code-switching.
- **Text to speech (Timbre).** Timbre v2.5 lists 42 voices across 10 Indian languages plus English and Hinglish, while v2.0 has a few default voices. Confirm which version your challenge credits give you. Pick one warm, clear voice for the mascot, and keep replies short so audio starts fast.
- **Language handling.** Use the language from the transcript to choose the Timbre voice and language. Keep a user setting to lock a language when detection is wrong.
- **Latency target.** The perceived delay between finishing the question and the cursor moving should feel under about two seconds. Start pointing as soon as Evon’s JSON arrives, without waiting for audio to finish.
- **Exact request formats.** Use docs.gnani.ai for endpoints, headers, and parameters. Don’t rely on guesses.

## 10. Overlay and pointing design

- Render everything inside a **shadow DOM host** so the page’s CSS can’t break your UI and your CSS can’t break the page.
- Scroll the target into view first, wait for the scroll to settle, then read its position and draw the ring.
- Animate the cursor along a smooth curve to the target, then pulse the ring. Motion is what makes the demo video work.
- Keep the mascot small and draggable, and make it easy to dismiss.
- For multi-step guidance, show a tiny step counter (“2 of 4”) and a “skip” option.
- Add captions of the spoken reply on screen. Many viewers watch with the sound off, and captions help accessibility.

## 11. Privacy and safety

- **Point only.** The guide never clicks, types, or submits, which removes most risk.
- **Never send** password fields, card fields, or the values the user typed into any input.
- **Say plainly** in the post and README what leaves the browser (the question audio, page host and title, and element labels) and that nothing is stored.
- **No screenshots stored.** Don’t log raw page content on the backend. If you keep logs for debugging, strip labels.
- **Let users pause it** on sensitive sites, for example with a per-site off switch.
- **Show consent clearly** the first time the extension asks for microphone access.

## 12. Credit budget (5,000 credits)

I don’t know the per-call cost of each model, so measure it in the first days.

- Log the credit use of one full question (Prisma + Evon + Timbre) and multiply to see how many questions your balance allows.
- Keep the element list compact (visible, labeled, capped), and avoid sending the full page text.
- Keep spoken replies short, since TTS cost usually grows with length.
- Add a per-session and per-day cap in the backend.
- Keep a **recorded demo mode** so your launch video never depends on live credits.
- Don’t publish a public live link until you know what happens when many people try it. If it goes viral, you don’t want the credits gone before judging.

## 13. Build timeline (about three weeks)

Because only engagement before the cutoff counts, the plan aims to post early and use the remaining days to respond to comments and refine.

| Dates | Goal |
| --- | --- |
| Oct 21 to 24 | Tray app, hotkey, transparent overlay, UI Automation and OCR element list, and a typed question that flies the cursor to the right element through Evon. |
| Oct 25 to 28 | Voice in and out with Prisma and Timbre, Hindi and Hinglish end to end, multi-step guidance. |
| Oct 29 to 31 | Second language, display scaling and multi-monitor fixes, rate limits, credit measurement, and tests on five to eight apps and sites. |
| Nov 1 to 3 | Film, edit, and post the demo on X and LinkedIn. |
| Nov 4 to 8 | Reply to comments, write the project explanation and README, fix bugs, and prepare the submission. |
| Nov 9 | Submit with a buffer. Nov 10 is final, with no extensions. |

## 14. Demo and launch plan

### 60-second demo script

1. **0 to 5 seconds, the hook.** Start on a dense, confusing website. Caption: “What if your screen could just show you?”
2. **5 to 20 seconds.** Ask in Hindi where a specific option is. The mascot pops up, the cursor glides, the ring lights up the button, the voice answers.
3. **20 to 35 seconds.** A second language (Tamil or Telugu) on a different site.
4. **35 to 50 seconds.** A multi-step task, such as turning on a setting, with the cursor walking through each click.
5. **50 to 60 seconds.** Say what it was built with (Gnani Prisma, Timbre, and Evon) and ask the comment question.

### Video tips

- Open with the most striking moment, not an intro.
- Burn in captions and keep the screen recording crisp.
- Show the cursor motion at full speed and slow it only if needed.
- Use real, everyday websites, not fake mock pages.
- Use a clean recording of the mascot voice so Timbre sounds good.

### Draft post copy (adapt for each platform)

> I built an AI that lives on your screen. Ask in Hindi, Tamil, or Hinglish, and it points at the button and talks you through it. Built with Gnani AI’s Prisma, Timbre, and Evon. Which website confuses you the most? Drop it below. \[tag Gnani AI’s official account\] #GnaniAI #GreatIndianAIInternshipChallenge

### Engagement, the honest way

- Reply to every comment, and where it’s practical, answer a “try this site” request with a short clip.
- Post at times your audience is active, and share the post from your own accounts.
- Do **not** use engagement pods, bots, paid promotion, or exchanges. They are explicitly banned and risk disqualification.
- Nominate exactly one post per platform in your submission, and check whether replies or threads under that post count toward it.

## 15. Submission checklist

- [ ] Eligibility confirmed (student status, team of up to two, accurate registration details).
- [ ] Participant workspace project description filled in: the problem, models used, who will use it, and each member’s contribution.
- [ ] Public demo video on LinkedIn and/or X, with the Gnani AI account tagged and both required hashtags.
- [ ] Demo or video link, written project explanation, the list of Gnani models used, and the post links, all submitted through the programme page.
- [ ] README with setup steps, architecture diagram, and privacy notes.
- [ ] Submitted before the final deadline of November 10, 2026.

## 16. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Evon returns malformed JSON or invents IDs | Validate output, check IDs against the list, retry once, fall back to a clarifying question. |
| Pages with unlabeled or canvas UIs | Pick demo sites that work, and describe limits honestly. |
| Credits run out | Measure cost early, cap usage, keep a recorded demo mode. |
| Latency feels slow | Short replies, start the animation before audio finishes, consider streaming STT. |
| Hinglish or dialect misrecognition | Test with real speakers, add a language lock, show the transcript on screen. |
| Rules don’t allow extra models | Stay fully on Prisma, Timbre, and Evon (the design already does). |
| Late post means less engagement time | Post by about November 2 and confirm the engagement cutoff. |
| Extension distribution is slow | Use a GitHub repo with install-unpacked instructions and a recorded demo. |

## 17. Open questions to check before building

1. Are you eligible under the student rule, and are you entering solo or as a pair?
2. What is the exact engagement cutoff date and the scoring method on the programme page?
3. Are non-Gnani models allowed alongside Gnani’s? (The current design doesn’t need any.)
4. Which Timbre version and voices do your credits include, and is voice cloning available?
5. Which Indian languages does the programme page list for each model?
6. How many credits does one full question cost?
7. Does a Chrome extension count as a “working application” for submission, or is a hosted demo link needed too?
8. Can you add updates or replies under your nominated post without affecting its engagement count?

## 18. Stretch goals and what comes after

- **More languages and dialect testing** to strengthen the regional-language award angle.
- **Desktop version** using OCR with bounding boxes to guide users through non-browser apps. This is hard, so treat it as a stretch goal only.
- **Onboarding widget for companies:** let a bank, insurer, or SaaS product embed the guide in its own site with its own knowledge, in regional languages. This is the clearest route from a challenge demo to a real product.
- **Accessibility mode** for low-vision users, with longer spoken descriptions of the page.
- **Offline or private deployment**, which fits Gnani’s positioning around running models inside a customer’s own infrastructure.
