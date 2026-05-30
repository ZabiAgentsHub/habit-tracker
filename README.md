# Habit Tracker

A fully-featured habit tracking app available as both a **progressive web app** and a **React Native mobile app**.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Habit Types** | Once-per-day or multiple times per day with a custom target |
| **Emoji Icons** | Pick from 4 categories (Fitness, Health, Mind, Lifestyle) |
| **Colour Coding** | 7 accent colours with a coloured left bar on every card |
| **Streaks** | Consecutive-day streaks with grace period (streak survives mid-day) |
| **Streak Milestones** | Toast notifications at 3 / 7 / 14 / 30-day streaks |
| **Per-habit Reminders** | Set a custom time per habit — bell icon on every card for quick access |
| **Single-habit Challenges** | Attach a 3 / 5 / 7 / custom-day challenge to any individual habit |
| **Multi-habit Challenges** | Create named challenges that group multiple habits — a day counts only when ALL habits in the challenge are done |
| **Challenge Detail View** | Slide-in sub-page showing progress pills + live today check-in list |
| **Completion Celebrations** | Confetti burst + fanfare sound on completing all habits or finishing a challenge |
| **Progress Heatmap** | 13-week GitHub-style activity grid |
| **Weekly Bar Chart** | 8-week completion rate chart |
| **Per-habit Stats** | Streak, 7-day %, 30-day % for every habit |
| **Quotes Page** | 28 curated quotes across 5 categories with category filter and "Next" cycling |
| **4-screen Onboarding** | Welcome → How It Works → Streaks & Motivation → Reminders & Setup |
| **Swipe-to-close** | All bottom sheets close by swiping down (≥100px) or tapping ✕ |

---

## 🗂 Project Structure

```
habit-tracker/
├── index.html        ← Web app (full-featured, single file, no build step)
├── mobile.html       ← Mobile-optimised web app (PWA, 44px targets, iOS safe areas)
├── CLAUDE.md         ← Architecture reference for AI coding tools
└── mobile/           ← React Native / Expo app
    ├── App.js        ← All app logic (single file)
    ├── app.json
    └── package.json
```

---

## 🌐 Running the Web App

No build step required. Serve with any static file server:

```bash
# Python (built-in)
python -m http.server 5500 --bind 0.0.0.0

# Then open:
# Desktop → http://localhost:5500/index.html
# Phone   → http://<your-local-ip>:5500/mobile.html
```

Or simply open `index.html` directly in a browser.

### Add to Home Screen (PWA)

`mobile.html` includes full PWA meta tags:
- **iPhone**: Safari → Share → "Add to Home Screen"
- **Android**: Chrome menu → "Add to Home Screen"

---

## 📱 Running the Mobile App (Expo)

```bash
cd mobile
npm install
npm start          # scan QR code with Expo Go
npm run android    # connected Android device / emulator
npm run ios        # macOS + Xcode only
npm run web        # browser
```

**Tunnel mode** (no shared WiFi needed):
```bash
npm install -g @expo/ngrok@^4.1.0
npx expo start --tunnel
```

> Requires **Expo SDK 56**, React Native 0.85, React 19.

---

## 🏗 Architecture

### Web app (`index.html` / `mobile.html`)

Everything lives in a single HTML file — no framework, no bundler.

**Storage**
| Key | Contents |
|---|---|
| `ht_v4` | Habits array |
| `ht_chals_v1` | Standalone multi-habit challenges |
| `ht_ob` | Onboarding completed flag |

**Habit data model**
```js
{
  id: string,
  name: string,
  type: 'once' | 'multi',
  target: number,
  color: string,
  ci: number,            // colour index → CSS data-c attribute
  emoji: string,
  reminderTime: string | null,   // "HH:MM"
  challenge: null | { days, startDate, completedAt },
  log: { [YYYY-MM-DD]: number }, // 1 = once done; N = multi count
  createdAt: string,
}
```

**Multi-habit challenge model**
```js
{
  id, name, emoji, desc,
  habitIds: string[],    // ALL must be done for a day to count
  days, startDate, completedAt,
}
```

**Streak logic** — walks back from *yesterday* if today isn't done yet, so a streak never breaks mid-day.

**Reminders** — `setInterval` every 60 s checks `HH:MM` against each habit's `reminderTime`. Fires a browser `Notification` if the habit isn't done. Deduplicated with a Set keyed `habitId-date-time`.

### Mobile app (`mobile/App.js`)

Single React Native component. No navigation library — tabs are conditional renders driven by `activeTab` state.

| Concern | Approach |
|---|---|
| Persistence | `@react-native-async-storage/async-storage` (key `ht_v3`) |
| Notifications | `expo-notifications` — scheduled daily 8 PM reminder |
| Haptics | `Vibration` (react-native built-in) |
| Confetti | 28 `Animated.View` particles |

---

## 🖥 Screenshots

| Today | Challenges | History | Quotes |
|---|---|---|---|
| Habit list with streaks, dots, bell reminders | Multi-habit challenge cards + detail view | 13-week heatmap + bar chart | 28 quotes with category filter |

---

## 📄 License

MIT
