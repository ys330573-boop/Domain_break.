# DOMAIN BREAK — 2.5D Anime Arena Fighter (three.js)

> गेम चलाने के लिए `start.bat` पर डबल-क्लिक करें (Python चाहिए)। ब्राउज़र अपने-आप खुलेगा।
> `index.html` को सीधे डबल-क्लिक करके न खोलें — लोकल सर्वर ज़रूरी है।

## Run
1. Double-click **`start.bat`** → opens `http://localhost:8765/index.html`.
   (Or run `python -m http.server 8765` in this folder and open that URL.)
2. Works offline. three.js is vendored in `vendor/`; Google Fonts are optional.

## Controls
| Action | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | ← / → |
| Jump | W / Space | ↑ |
| Block (hold) | S | ↓ |
| Dash (back+dash = evade) | Left Shift | Numpad0 / Right Shift |
| Light combo (x3) | J | Numpad1 / , |
| Heavy (launcher) | K | Numpad2 / . |
| Jump Kick* (2 hits) / Flip Kick* (anti-air) | Forward+K / Back+K | →/← + Numpad2 |
| Backflip evade* | Back + Left Shift | ← + Numpad0 |
| Special 1 / 2 / 3 | L / U / O | Numpad3-5 / `/` `;` `'` |
| **Domain Expansion** (gauge full) | I, or double-tap D | Numpad6 / ] / double-tap → |
| Pause | Esc | |

\* Only for characters whose rig provides `jumpKick` / `flipKick` / `backflip` clips (currently Gojo · Street Form).

**Toji** (fastest fighter: walk/dash ×1.45, attacks ×1.2, afterimages): K = 3-cut blade rush · Forward+K = flying kick ·
Back+K = rising blade (anti-air launcher) · S1 = gun barrage · S2 = teleport blade slash · S3 = Cursed Armory (super: screen goes dark around Toji, the cursed worm flies in and coils round him, he draws a blade from its mouth in slow motion, blitzes and beheads the opponent — if they survive the hit it was a vision of death and the head snaps back) ·
J J J J = jab, side kick, hook, spinning kick.

**Gojo — S3 = Hollow Purple** (虚式「茈」, super, 60 energy, `src/purple.js`): the whole screen goes black except Gojo
(front camera) → Blue (蒼) forms over his left palm, Red (赫) over his right → his hands meet and the two orbs spiral into
Purple (slow-mo beat) → the two-finger sign (index + middle out, others curled) → he flicks it. Speed ramps (real-time,
`ramp()` in purple.js): the sphere flies in slow motion (over-the-shoulder, then from behind the opponent), the hit is an
almost frozen moment with an orbiting close-up, then time slowly returns while the camera follows the falling upper body
and ends on a wide shot. It erases a trench and **cuts the opponent in half at the waist** (upper body falls, legs buckle). Unblockable, the opponent is frozen
during the build-up. If they survive it was only a vision (like Toji's beheading). The orbs are the meshes from
`models/hollow_purple/hollow_purple.glb`. Finger poses need finger bones (mixamo rigs, or auto-rigged models whose
source skin had fingers, `src/rig.js` → `fingerLayout`); Street Form Gojo has none, so his hand stays open. Any move can call `f.actor.setFingers({ R: { index: 0, middle: 0, ring: 1, little: 1, thumb: 0.9 } })`.

Gamepads are supported too (X light, Y heavy, B / RB / RT specials, LT domain, LB dash).

**CRITICAL SPARK:** press your next attack ~0.1 s *after* a hit connects. It deals 2.5x damage, triggers a red/black impact frame and boosts your Domain gauge.

**Gojo's Domain Expansion** (`src/voiddomain.js`): face close-up, he pulls his blindfold off and becomes the unmasked
Gojo (`domainForm` in roster.js → `models/gojo_domain/model-rigged.glb`, real fingers; back to the blindfold afterwards) → he raises the crossed-finger sign and the world goes
black → a white point behind him swallows the arena → an endless cosmic void (galaxy core, star field, streams of light) with
a pull-back reveal, both fighters floating → the opponent is paralysed (light pours into their head, the screen floods with
text, steady damage) → Gojo walks up and lays his hand on their head → white-out, final hit, glass-shatter exit.

**Domain Expansion:** fills by fighting. It plays a sure-hit cinematic (hand-sign close-ups, an ink sphere, a unique domain world and a glass-shatter exit), then puts you in *burnout* (no specials for 6 s).

## Play online with a friend (remote play)
Step-by-step guide for you and your friend (Hindi + English): **GUIDE.md**.
1. **Host** (you): double-click **HOST-ONLINE.bat** (instead of start.bat). The game opens in your browser (Chrome / Edge).
   PLAY ONLINE WITH A FRIEND → **HOST** → share **this tab** with tab audio → **COPY INVITE LINK** → send it.
2. **Friend**: opens the link (Chrome / Edge, PC or laptop with a keyboard or gamepad) → **JOIN**. Nothing to install.
3. Character select: your friend (Player 2) picks first, then you pick Player 1, then the fight starts.
- How it works: `online_server.py` serves the game, relays the match over WebSockets and opens a free Cloudflare quick
  tunnel (no account; `tools/cloudflared.exe` is downloaded the first time, ~55 MB). The invite link is that tunnel's
  https address. The host's tab is encoded with WebCodecs (H.264 or VP8, 1280x720 @30, sound as Opus) and streamed to the
  friend; the friend's keys come back and are replayed as Player-2 keys (`src/online.js`, `main.js` → `onGuestKey`).
  Everything goes over normal https, so it works on any network (mobile data, any Wi-Fi, another city).
- The game only runs on the host, so every move, cinematic and replay is identical. The friend feels the internet delay
  (ping shown at the bottom); it is the host's + friend's distance to Cloudflare, typically 0.1-0.4 s round trip.
- The invite link changes every time HOST-ONLINE.bat starts. Keep the black window open while playing.
- Self-test: `DB_TEST_OUT=<folder> python online_server.py --no-browser`, then open
  `http://localhost:8765/index.html?onlinetest=1&host=1&autofight=1` and `<tunnel>/?join=1&onlinetest=1&autojoin=1`.

## Match intro, KO replay & voices
- **Intro:** overhead crane shot → each fighter walks in and says their line (press J / Space to skip).
- **KO replay:** after a KO the last moments rewind (VHS effect) and replay in slow motion.
- **Voices:** lines are in `src/roster.js` → `lines` (`intro`, `win`, `domain`, `purple`). To use real recordings, put
  `voices/<id>_<line>.mp3` files in the `voices/` folder (see `voices/README.txt`). Lines without a file are read by the
  browser's text-to-speech (a Japanese voice is used if Windows has one installed). VOICE ON/OFF is on the select screen.

## Adding a new character
1. Put the `.glb` in `models/`.
2. Add an entry in **`src/roster.js`**:
   ```js
   { id: 'yuji', name: 'YUJI', title: 'Divergent Fist', file: 'models/yuji.glb', kit: 'void',
     color: '#ff7a3c', accent: '#ffd84a', aura: '#ff9a5c' },
   ```
   `kit` picks the moveset and VFX: `void`, `shrine` or `heavenly` (new kits go in `src/moves.js` and `src/domain.js`).
3. The model does **not** need bones or animations. It is auto-rigged at load (A-pose or T-pose).
   Open `rigtest.html?c=yuji` to preview it in every pose. If the model includes props or outline shells,
   use `include` / `exclude` / `crop`. Joint heights can be tweaked with `rig: { hipY: 0.5 }`.

### Characters with a real skeleton + animations (recommended)
A rigged GLB looks much better than the auto-rig, because its own skin weights are used. Add a `skeleton` block
(see `gojo_street` in `src/roster.js`):
```js
skeleton: {
  base: 'models/gojo/model-animated (4).glb',          // rigged model
  clips: {                                              // game animation -> clip in any GLB with the same skeleton
    walkF: { file: 'models/gojo/model-rigged.glb', clip: 'walk_relaxed', speed: 1.5, loop: true },
    heavy: { file: 'models/gojo/model-animated (4).glb', clip: 'karate_chop_overhead', speed: 2.4 },
    jumpKick: { file: 'models/gojo/model-animated.glb', clip: 'kick_jump', speed: 1.6, rootMotion: 0.75 }, // rootMotion = travel with the animation
  },
  // rig: 'mixamo',                                     // for Mixamo rigs (mixamorigHips…) — see Sukuna's entry
  // map: { hips: 'MyHips', ... }                       // only for other custom bone names
  // prop: 'throne'  on a clip = show a prop while it plays (src/props.js)
  // weapon: 'blade' on a clip = show that weapon while it plays; rootY: true = the clip's jump lifts the fighter
  // weapons: { blade: { mesh: 'wuqi2', hand: 'R', scale: 6, grip: 0.1 }, gun: { prop: 'pistol', hand: 'R' } }
  //   mesh = a weapon mesh inside the GLB (cut out and put in the hand), prop = built-in prop — see Toji's entry
},
```
Character options: `speed` (walk/dash multiplier), `atkSpeed` (attack speed multiplier), `afterimage: true`.
Game animation names: `jumpKick flipKick backflip` (unlock the extra moves), `idle walkF walkB dash jump fall land block hitL hitH launched down getup ko jab cross kick heavy airAtk castPush castSign slash throwOver rush sign open victory intro`.
Any name without a clip uses the built-in procedural pose, **retargeted onto the real skeleton**.

## Code map
| File | What it does |
|---|---|
| `src/rig.js` | GLB → normalised mesh → auto skeleton + skin weights |
| `src/anim.js`, `src/poses.js` | semantic pose system + all animation clips |
| `src/toon.js` | cel shading, rim light, hit-flash, ink outlines |
| `src/fighter.js` | state machine, physics, combos, afterimages, flame aura |
| `src/moves.js` | normals + kits (specials and supers) |
| `src/domain.js` | Domain Expansion cinematics + the three domain worlds |
| `src/game.js` | rounds, hit resolution, hitstop, super-freeze, KO slow-mo |
| `src/fx.js`, `src/post.js` | VFX and manga post-processing (impact frames, speed lines, halftone, shatter) |
| `src/stage.js`, `src/textures.js` | painted parallax stages (all procedural, no image files) |
| `src/camera.js` | fight camera + cinematic shots, shake, zoom-punch, dutch tilt |
| `src/ai.js`, `src/input.js`, `src/hud.js`, `src/audio.js` | CPU, input, HUD, synthesised SFX |

Tablet: the input layer is abstracted (`VirtualController`), so on-screen touch buttons can be added later without touching the gameplay code.
#   D o m a i n _ b r e a k . 
 
 