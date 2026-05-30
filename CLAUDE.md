# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project structure

Three independent habit tracker implementations in this repo:

| File / Folder | Description |
|---|---|
| `index.html` | Full-featured web app — single file, no build step. Serve with any static file server or open directly. |
| `mobile.html` | Mobile-optimised copy of `index.html` — adds PWA meta tags, 44px tap targets, swipe-to-close gestures, iOS zoom prevention. Served from the same static server. |
| `mobile/` | Expo + React Native app (iOS/Android). All logic in `mobile/App.js`. |

## Serving the web apps locally

```bash
cd "Habbit tracker"
python -m http.server 5500 --bind 0.0.0.0
# index.html  → http://localhost:5500/index.html
# mobile.html → http://localhost:5500/mobile.html
# On-device   → http://<local-ip>:5500/mobile.html
```

The `--bind 0.0.0.0` flag is required to reach the app from a phone on the same network.

## Running the Expo app

```bash
cd mobile
npm start          # Metro bundler + QR code for Expo Go
npm run android    # connected Android device/emulator
npm run web        # browser via Expo web
```

Tunnel mode (no shared WiFi required):
```bash
npx expo start --tunnel   # requires: npm install -g @expo/ngrok@^4.1.0
```

## Web app architecture (`index.html` / `mobile.html`)

Everything is in one `<style>` + HTML + `<script>` block — no bundler, no imports.

**Storage keys**
- `ht_v4` — habits array (`localStorage`)
- `ht_chals_v1` — standalone challenges array (`localStorage`)
- `ht_ob` — onboarding-completed flag

**Habit object shape**
```js
{
  id: string,           // Date.now().toString()
  name: string,
  type: 'once' | 'multi',
  target: number,       // 1 for once, N for multi
  color: string,        // hex, one of COLORS[7]
  ci: number,           // COLORS index (used for CSS data-c attribute)
  emoji: string,        // optional, shown as prefix on card
  reminderTime: string | null,  // "HH:MM" — per-habit browser notification
  challenge: null | { days, startDate, completedAt },  // single-habit challenge
  log: { [dateKey: string]: number },  // 1 = done (once), N = count (multi)
  createdAt: string,
}
```

**Standalone challenge object shape** (stored in `ht_chals_v1`)
```js
{
  id: string,
  name: string,
  emoji: string,
  desc: string,
  habitIds: string[],   // multiple habits — ALL must be done for a day to count
  days: number,
  startDate: string,
  completedAt: null | string,
}
```

**Key logic**
- `isDone(h, dateKey)` — true when `h.log[key] >= target`
- `calcStreak(h)` — walks back from yesterday if today isn't done yet (grace period), so the streak doesn't break mid-day
- `chalDayDone(chal, key)` — true when every habit in `chal.habitIds` is done for that day
- Per-habit reminders fire via `setInterval(checkReminders, 60000)` — checks current `HH:MM` against each habit's `reminderTime`; deduplicates with a `firedReminders` Set keyed `habitId-dateKey-timeStr`

**Tab / view state**
- 4 bottom tabs: Today · Challenges · History · Quotes
- `switchTab(tab)` swaps `.on` class on panes and tab buttons
- Challenges tab has an internal slide-in detail view (`ch-detail-view.open`) — not a modal, rendered as an absolutely-positioned overlay inside the pane

**Sheet (bottom modal) pattern**
- Each modal is a `.backdrop` div with a `.sheet` child
- `closeSheet(event)` — closes when the backdrop itself is clicked
- `closeById(id)` — closes by backdrop element id (used by ✕ buttons)
- `initSwipeToClose(backdropId)` — attaches touchstart/move/end listeners; closes when dragged >100px while sheet scroll is at top; called for all 4 sheets during `init()`

**Onboarding**
- 4 screens shown on first visit (`!localStorage.getItem('ht_ob')`)
- `obNext(n)` / `obFinish()` / `obAllowNotifs()` advance or dismiss
- Re-shown if the user clears all data via Settings

## Mobile app architecture (`mobile/App.js`)

Single-file React Native component using hooks only (no navigation library, no Redux).

- **State**: `habits`, `selDate`, `activeTab`, celebration/modal booleans, form fields
- **Tabs**: `'today' | 'challenges' | 'history'` — conditional rendering, no React Navigation
- **Persistence**: `AsyncStorage` key `ht_v3` (note: different from web's `ht_v4`)
- **Notifications**: `expo-notifications` — schedules a single daily 8 PM reminder; cancelled and rescheduled whenever habits change
- **Haptics**: `Vibration` from react-native (no expo-haptics)
- **Confetti**: 28 `Animated.View` particles driven by `Animated.timing`

## Expo version note

**Expo SDK 56**, React Native 0.85, React 19. Consult https://docs.expo.dev/versions/v56.0.0/ before changing any Expo API usage — APIs shift between SDK versions.

## Verifying JS syntax in the web files

```bash
node -e "
const fs=require('fs'), html=fs.readFileSync('index.html','utf8');
const s=html.indexOf('<script>'), e=html.indexOf('</script>',s);
try{new Function(html.slice(s+8,e));console.log('OK');}
catch(err){console.log('ERROR:',err.message);}
"
```

Run this after any edit to `index.html` or `mobile.html` before opening in a browser — a JS syntax error silently prevents the entire app from starting.
