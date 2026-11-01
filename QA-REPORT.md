# Pallanguzhi Heritage 3.9.1 — functional QA

Test date: 1 November 2026

**Verdict: browser regression suites pass after fixes. Full release certification is pending cross-phone WebRTC and a built Android APK tested on physical devices.** No live repository or website was changed.

## Passed checks

| Area | Evidence and scope |
|---|---|
| Rules and state transitions | 26 automated regression tests passed, including captures, Pasu, illegal moves, Kasie settlement, turn ownership, rematch, retry limits, translations and repeated-position handling. |
| Engine stress | 800 deterministic simulations; 50,131 moves and 2,652 rounds. No seed loss, move exceptions or unfinished simulations. These are engine tests, not browser/network matches. |
| Complete browser matches | 40 configurations completed, 1,967 moves in the final run. Includes pass-and-play and all four AI levels, 4/5 seeds, Pasu on/off, Single Match/Kasie. Seed totals and results were checked. |
| Local multiplayer transport | Eight complete matches, 422 moves, with PeerJS explicitly unavailable so the browser BroadcastChannel fallback was isolated. Both boards agreed on seeds, scores, turn, round and result. |
| Multiplayer control flow | Guest-requested undo, host undo, wrong-match packet rejection, remote pause including hints/undo, local fallback recovery for host/guest, completed-result recovery without duplicate statistics and two-party rematch passed. |
| Hints and undo | Hint selects a legal cup without changing the position. Undo cancels AI thinking, restores the human move plus AI reply and reverses a recorded result. |
| Saves | Pause → Home → Continue, reload recovery, corrupt-save startup and operation with storage blocked passed. Storage-blocked mode cannot persist progress. |
| Pausing/interruption | Active sowing settles safely; AI waits for Resume. Coin toss interruption, abandoned-toss state reset, background tutorial cancellation and native lifecycle hook dispatch passed. Native hooks were mocked in a browser, not exercised on Android. |
| Tutorials | All six lessons completed in English and Tamil: 12 lesson runs. Seed conservation, next/replay/close and cancellation checked. |
| Settings | All five themes, three counter styles, player names, volume and persisted preferences passed. |
| Language | Repeated English/Tamil switching, restoration to English, Tamil rules, dynamic names/numbers and persisted selection passed. Rare technical diagnostics may remain English. |
| Sound | Actual browser AudioContext source creation for pickup/capture passed. Mute and zero volume prevented new sound sources. Sound quality was not auditioned through phone speakers. |
| Results and sharing | Winner/tie styling, scores, safe rendering of names, result rollback, rematch reset, room-code copy, invite-link copy and WhatsApp composition passed. No message was sent. |
| Layout | Board/header/guide/footer containment checked at 320×568, 360×640, 393×851, 412×915, 740×360 and 1024×768. Emulated mobile touch, coarse-pointer animation, pause/resume and rotation also passed. |
| Native source | Capacitor Android generation/synchronization, resource XML and packaged web assets checked. |

## Fixed defects

1. **Endless Kasie tournaments:** full browser play found a seed allocation that repeated through thousands of rounds. The app now declares a draw when the same allocation repeats three times. This is an explicit app draw-protection rule, documented in both languages; it is not claimed as a universal traditional rule. The repetition history survives save/resume and host synchronization.
2. **Premature reconnect attempts:** connection retries could destroy a still-negotiating channel. The connection now receives a 20-second handshake grace period before a retry.
3. **Local transport recovery:** after a Peer connection closed, the fallback could remain active while one player's connection flag stayed false. Valid local heartbeat traffic now restores that status.
4. **Background/toss state:** an abandoned interrupted toss could carry its pause flag into a fresh Quick Play. New matches clear it; backgrounding cancels tutorial playback.
5. **Remote pause:** hints and undo could remain available while the opponent paused. They are now blocked, and pending undo processing waits for resume.
6. **Result sharing:** a repetition-draw with unequal seed totals is now shared as a draw, not as a win for the player with more seeds.

## Blocked or unverified

### Standalone WebRTC / two actual phones

Signaling connections could be created locally, but the isolated WebRTC data channel could not be established here. A separate loopback RTCPeerConnection probe also produced zero ICE candidates and did not open after 25 seconds, including a multiprocess browser run. This prevents verification of the real cross-phone transport in this environment.

**Correction to earlier reports:** previous browser-session runs allowed the BroadcastChannel fallback, so they did not prove standalone WebRTC. Those stronger claims are superseded by this report. Local fallback and controller/state logic pass; real cross-phone play and reconnect remain unverified. This is not a finding that the game cannot work on normal phone networks.

Required release check: two physical phones on different networks must complete a match, disconnect/reconnect each side, pause/resume, undo and rematch. Public signaling availability, TURN/blocked-network behaviour and browser background eviction remain unverified.

### Android APK / devices

Android source generation and synchronization pass. APK compilation remains blocked by unavailable Gradle downloads and absent Android SDK/JDK 21 build prerequisites. No installable APK is included. The supplied build workflow has not been run remotely. Actual Android installation, back button, real calls, screen locks, vibration, audio quality and OEM process killing need device checks.

## Reproduction and deployment

The nested `android-project.zip` includes source, 26 regression tests and portable browser QA scripts. Its README explains `npm test`, `npm run test:ui`, `npm run probe:webrtc` and `npm run test:webrtc`. Browser tests require Playwright Chromium; standalone WebRTC requires working network/ICE support.

To deploy the website, upload these seven files together to the repository root: `index.html`, `game.css`, `app.js`, `rules.js`, `guidance.js`, `locale.js`, `native-bridge.js`. Both players should reload the updated page. Do not upload the nested Android source ZIP as a website asset.
