# MazeQuest Mini — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | MazeQuest Mini — a mini top-down puzzle adventure |
| **Release** | v1.0 — "First Playable" (Level 1: *The Forgotten Cellar*) |
| **Author** | Khaled Hawas |
| **Status** | Implemented |
| **Platform** | Web browser (desktop + mobile), HTML5 Canvas, vanilla JavaScript, zero dependencies |

---

## 1. Overview

MazeQuest Mini is a bite-sized, top-down puzzle adventure. The player guides a small adventurer through a single hand-designed maze, solving chained puzzles (key → door, lever → gate, timed spike traps, crate → pressure plate → gate) and collecting gems before reaching the exit portal.

The first release proves the core loop: **explore → find the tool → unlock the next zone → reach the exit**, all behind a clean, fully clickable UI.

### 1.1 Goals
1. Deliver one complete, beatable maze level with a clear start and exit.
2. Include **at least 3 puzzles/obstacles** that chain together into a readable progression.
3. Reward exploration with optional collectibles and a star rating.
4. Provide one controllable character with responsive 4-direction movement and wall collision.
5. Ship a clickable UI: start menu, how-to-play, in-level HUD, pause, win and game-over screens.
6. Playable with keyboard, mouse (click-to-move) **and** touch (on-screen D-pad).

### 1.2 Non-goals (v1)
- Multiple levels, level select or level editor
- Enemies with AI, combat, inventory beyond a key
- Accounts, online leaderboards, save slots
- Sprite-sheet art pipeline (all art is drawn procedurally on canvas)

### 1.3 Target audience
Casual players (10+) who enjoy short, cozy puzzle games; reviewers who want to see the core loop in under 2 minutes.

### 1.4 Success metrics
| Metric | Target |
|---|---|
| Time to first input from page load | < 5 s |
| Median completion time (first run) | 60–120 s |
| Level completion rate (players who start) | ≥ 80 % |
| Players collecting ≥ 50 % of gems | ≥ 60 % |
| Runtime errors during a full playthrough | 0 (automated test) |

---

## 2. User stories

| # | As a… | I want to… | So that… |
|---|---|---|---|
| U1 | player | start the game from a clear menu | I know how to begin |
| U2 | player | read the controls and what each object does | I'm never stuck on "what is this?" |
| U3 | player | move with WASD/arrow keys | I have precise control |
| U4 | player | click a tile and have my hero walk there | I can play with just a mouse |
| U5 | mobile player | use an on-screen D-pad and USE button | I can play on my phone |
| U6 | player | see hearts, gems, key, lever state and timer | I always know my progress |
| U7 | player | find a key and open a locked door | I feel clever for exploring |
| U8 | player | pull a lever to open a distant gate | I learn cause-and-effect puzzles |
| U9 | player | time my run through spike traps | I get a moment of tension |
| U10 | player | push a crate onto a pressure plate | I solve a spatial puzzle |
| U11 | player | respawn at a checkpoint when hurt | failure isn't punishing |
| U12 | player | pause, restart or quit to menu at any time | I control my session |
| U13 | player | see my time, gems and a star rating at the end | I'm motivated to replay |

---

## 3. Level design — Level 1 "The Forgotten Cellar"

### 3.1 Map (21 × 15 tiles, 40 px each → 840 × 600 canvas)

```
#####################
#S...*.#....#.....*.#     Zone A (start)  ─┐
#.##.#.#.##.#.###.#.#                      │ D = locked door
#....#.D..*....*#...#     Zone B (lever)  ─┘
#.###..###.###.##.#.#
#*..#.##.....#..L.#.#     L = lever controls G
#.#...k#.*#....#*...#     k = key
###################G#     G = lever gate
#..*.^^.^^^.^^.^^.c.#     Zone C: spike corridor (c = checkpoint)
#.###################
#c*.##########......#     Zone D: crate room / Zone E: exit room
#....B....P..H.....X#     B crate → P plate opens H;  X = exit
#..+##########.....*#
#*..##########*....*#
#####################
```

**Legend:** `S` start · `X` exit · `k` key · `D` locked door · `L` lever · `G` lever gate · `^` spike trap · `B` crate · `P` pressure plate · `H` plate gate · `*` gem · `+` heart · `c` checkpoint · `#` wall

### 3.2 Progression flow

```
Zone A ──(key)──▶ Door D ──▶ Zone B ──(lever)──▶ Gate G ──▶ Zone C (spikes)
                                                              │
Exit X ◀── Zone E ◀── Gate H ◀──(crate on plate)── Zone D ◀───┘
```

### 3.3 Puzzles & obstacles (requirement: ≥ 3 — delivered: 4)

| # | Puzzle | Mechanic | Teaches |
|---|---|---|---|
| 1 | **Locked door** | Key is hidden in a dead-end pocket of Zone A. Walking into the door with a key consumes it and opens the door. Without a key a hint toast appears. | Exploration, item use |
| 2 | **Lever gate** | Lever sits in Zone B, gate G is in a different corner. Pull the lever (E/Space, USE button, or click it when adjacent) → gate raises. Lever is a toggle (can be closed again). | Remote cause-and-effect |
| 3 | **Spike corridor** (trap) | 9 spike tiles cycle up/down on a 2.4 s cycle, each column offset by 280 ms so they ripple. Spikes wobble 350 ms before rising (telegraph). Standing on raised spikes = −1 heart, respawn at checkpoint, 1.2 s invulnerability. | Timing, reading tells |
| 4 | **Crate & pressure plate** | Push the crate (Sokoban rules — push only, never pull) along a corridor onto the plate. It locks in and becomes walkable; teal gate H opens. Corridor geometry makes the puzzle impossible to soft-lock. | Spatial reasoning |

### 3.4 Collectibles & rewards
- **13 gems** spread across all zones, several in dead-ends off the critical path.
- **1 heart pickup** (+1 HP, only consumed when not at full health).
- **2 checkpoints** (after the lever gate and after the spike corridor).
- **Star rating** on completion: ★ finish · ★★ ≥ 50 % gems · ★★★ all gems within par time (90 s).
- **Best time** stored locally and shown on the start menu / win screen.

---

## 4. Character design

| Attribute | Spec |
|---|---|
| Name | "The Adventurer" |
| Look | Small hero with green feathered cap, blue tunic, brown belt, red cape; drawn procedurally on canvas (no image assets) |
| Movement | Grid-based, 4 directions (up/down/left/right); 130 ms smooth tween per tile; holding a key keeps walking |
| Facing | Eyes shift toward the facing direction; last pressed direction is kept |
| Animation | Idle breathing bob; walk hop per step; drop shadow |
| Health | 3 hearts; flashing sprite during invulnerability |
| Collision | Cannot enter walls, closed doors/gates, levers, or crates it can't push |

**AI art reference prompt (for future sprite sheets):**
> "Top-down 16-bit pixel art adventurer, green feathered cap, blue tunic, red cape, brown belt, 4-direction walk cycle, 32×32 sprite sheet, dark purple dungeon palette, transparent background."

---

## 5. Mechanics & UI requirements

### 5.1 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| F1 | Player moves one tile per input via WASD / arrow keys; holding keeps moving | P0 |
| F2 | Collision with walls and closed obstacles; bump sound on blocked move | P0 |
| F3 | Click/tap any reachable tile → BFS path-finding, hero auto-walks there | P0 |
| F4 | Clicking an interactable (lever, door, crate) paths next to it and uses it | P0 |
| F5 | Key pickup → HUD key slot lights → door opens on contact | P0 |
| F6 | Lever toggle → gate G opens/closes, HUD lever chip lights | P0 |
| F7 | Timed spike traps with warning tell; damage + respawn at checkpoint | P0 |
| F8 | Pushable crate, pressure plate, plate-controlled gate | P0 |
| F9 | Gems, heart pickup, checkpoints with visual + audio feedback | P0 |
| F10 | Reaching the exit shows the win screen with time, gems, hearts, stars, best time | P0 |
| F11 | 0 hearts → Game Over screen with Try Again / Main Menu | P0 |
| F12 | Pause (button, Esc, P, window blur) freezes timer; Resume / Restart / How to play / Menu | P0 |
| F13 | On-screen D-pad + USE button for touch/mouse | P1 |
| F14 | Sound effects (WebAudio synth) with mute toggle | P1 |
| F15 | Toast messages for hints and events ("Locked. Find the golden key.") | P1 |
| F16 | Best time persisted in localStorage (fails gracefully) | P2 |

### 5.2 Screens

| Screen | Contents | Mockup |
|---|---|---|
| Start menu | Logo, tagline, **Play**, **How to Play**, mute, best time | `docs/mockups/01-start-menu.png` |
| Level interface | HUD (hearts, gems, key, lever, level name, timer, sound, restart, pause), game board, toast, D-pad, USE | `docs/mockups/02-level-interface.png` |
| Pause / How to play | Resume, Restart, How to play, Main menu · controls grid + object legend | `docs/mockups/03-pause-howto.png` |
| Win / Game over | Stars, stats, Play again, Main menu · Try again, Main menu | `docs/mockups/04-win-gameover.png` |

### 5.3 Controls

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Move | WASD / Arrows | Click tile | D-pad |
| Use lever | E / Space | Click lever | USE |
| Pause | Esc / P | ❚❚ button | ❚❚ button |
| Restart | R | ↻ button | ↻ button |
| Start from menu | Enter | Play button | Play button |

### 5.4 Visual style
- Dark "cellar" palette (deep purples) with high-contrast interactables: **gold** key/door, **orange** lever/gate G, **teal** plate/gate H, **cyan** gems, **red** hearts/danger, **violet** exit portal. Color pairs make cause → effect readable at a glance.
- Pixel display font ("Press Start 2P") for titles; Inter for UI text.
- Juice: particles on pickups, screen shake on damage, glowing gems, animated portal, spike wobble.

---

## 6. Technical design

| Area | Decision |
|---|---|
| Stack | HTML5 Canvas + vanilla JS (ES2020) + CSS; no build step, no dependencies |
| Structure | `index.html` (DOM UI) · `css/style.css` · `js/level1.js` (ASCII level data) · `js/game.js` (engine) |
| Level format | Array of strings with a single-character legend → easy to author and to prompt an AI with |
| Game loop | `requestAnimationFrame`; state machine: `menu → playing ⇄ paused → won / over` |
| Path-finding | BFS on the tile grid, respecting current door/gate/crate state |
| Audio | WebAudio oscillators — no audio files |
| Responsiveness | Canvas scales to container width; click coords mapped via `getBoundingClientRect`; mobile HUD condenses |
| Testing | `tests/playthrough.mjs` — Playwright script that plays the level start to finish and asserts every puzzle |
| Hosting | Any static host (GitHub Pages) — open `index.html` directly |

---

## 7. Acceptance criteria (v1 release checklist)

- [x] One maze level with a clear start (S) and exit portal (X)
- [x] ≥ 3 puzzles/obstacles: locked door + key, lever + gate, spike traps, crate + pressure plate
- [x] Collectibles encourage exploration (13 gems, heart, star rating)
- [x] One controllable character with up/down/left/right movement
- [x] Collision with walls and obstacles
- [x] Interactive objects respond to movement **and** clicks
- [x] Clickable start menu and level interface (HUD, pause, win, game over)
- [x] Full playthrough passes automated test with 0 runtime errors

---

## 8. Future roadmap

| Version | Scope |
|---|---|
| v1.1 | Level select + 2 more levels; undo for crate pushes |
| v1.2 | Patrolling enemy, moving platforms, colored key/door pairs |
| v1.3 | Pixel-art sprite sheets, music, accessibility options (color-blind palette, reduced motion) |
| v2.0 | In-browser level editor using the same ASCII format; share levels via URL |

---

## 9. AI context & references

Prompts used / reusable for AI tools:
- **Level generation:** "Design a 21×15 ASCII maze using this legend (…). Zones must be connected only through D, G, H. Key must be reachable from S without passing D. Crate corridor must be walled above and below so the crate can't be soft-locked."
- **UI mockups:** "Low-fidelity wireframes for a top-down puzzle game: start menu, gameplay HUD with hearts/gems/key/timer/pause, pause overlay, win screen with 3 stars. Hand-drawn style, annotated."
- **Inspiration:** classic Zelda-style dungeon rooms (key/door, switch/gate), Sokoban (crate pushing), *Chip's Challenge* (tile-based hazards).
