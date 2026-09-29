# MazeQuest Mini: Technical README

Technical documentation for the first playable prototype of MazeQuest Mini (v1.0, Level 1 "The Forgotten Cellar").
Repository: https://github.com/kfhawas/MazeQuest_Game

## 1. Project overview

| Item | Details |
|---|---|
| **Game name** | MazeQuest Mini |
| **Genre** | Top-down, tile-based puzzle adventure (maze explorer) |
| **Objective** | Guide the adventurer from the start tile to the exit portal by solving four chained puzzles, while collecting gems for a higher star rating |
| **Platform** | Any modern web browser (desktop and mobile). No install or build step |
| **Tech stack** | HTML5 Canvas 2D, vanilla JavaScript (ES2020), CSS. No libraries, images or audio files: all art is drawn in code and all sounds are synthesised with the Web Audio API |
| **How it was built** | Vibe coding: every script, the level design, the UI mockups and the automated test were generated with an AI assistant (Claude) from the prompts in `PRD.md`, then reviewed and play-tested |

### Gameplay mechanics

The level is a 21 × 15 grid of 40-pixel tiles, split into five zones that open one after another.

| Mechanic | How it works |
|---|---|
| Movement | The hero moves one tile at a time in four directions (up, down, left, right). Each step is animated over 130 ms, and holding a key keeps walking |
| Collision | Walls, closed doors, closed gates, levers and crates that cannot be pushed block movement. A blocked move plays a "bump" sound |
| Click-to-move | Clicking any tile makes the hero walk there along the shortest path. Clicking a door, lever or crate walks next to it and uses it |
| Puzzle 1: key and door | The golden key is hidden in the start zone. Walking into the locked door with the key opens it |
| Puzzle 2: lever and gate | Pulling the lever (E, Space, the USE button, or a click) raises a gate in another part of the maze |
| Obstacle 3: spike trap | Nine spike tiles rise and fall on a 2.4-second cycle, rippling along the corridor. They wobble 350 ms before rising. Touching raised spikes costs one heart |
| Puzzle 4: crate and plate | Push the crate (push only, never pull) onto the pressure plate. It locks in place, becomes walkable and opens the final gate |
| Health and checkpoints | The hero has 3 hearts. After damage, the hero respawns at the last checkpoint flag and is invulnerable for 1.2 seconds. A heart pickup restores one heart |
| Collectibles and score | 13 gems. Stars on completion: 1 for finishing, 2 for collecting at least half the gems, 3 for collecting every gem within the 90-second par time. The best time is saved in the browser |
| Win and lose | Reaching the exit portal wins. Losing the last heart ends the game |

### Controls

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Move | WASD or arrow keys | Click a tile | On-screen D-pad |
| Use lever | E or Space | Click the lever | USE button |
| Pause / resume | Esc or P | Pause button | Pause button |
| Restart level | R | Restart button | Restart button |
| Start from a menu | Enter | Play button | Play button |

### Running the game

Open `index.html` in a browser, or publish the repository with GitHub Pages. To run the automated playthrough: `npm install -D playwright`, then `node tests/playthrough.mjs`.

## 2. Code overview

### AI-generated files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | 121 | Page structure: HUD bar, game canvas, the five overlay screens (start menu, how to play, pause, level complete, game over), toast message area and on-screen controls. Loads the two scripts |
| `css/style.css` | 127 | Visual design of the UI: colour tokens, HUD chips, buttons, overlay panels, D-pad, responsive layout for phones |
| `js/level1.js` | 41 | Level data only. Defines `window.MQ_LEVELS`, holding the ASCII map, level name and par time. Contains no logic |
| `js/game.js` | 602 | The game engine: state, rules, input, audio, rendering and screen flow (sections listed below) |
| `tests/playthrough.mjs` | 90 | Automated end-to-end test. Plays the level in headless Chromium, asserts every puzzle works and saves screenshots |
| `docs/mockups/mockups.html` | n/a | Wireframe source for the four UI mockup images in `docs/mockups/` |
| `PRD.md` | n/a | Product requirements, level design and the AI prompts used |

### Level data format (`js/level1.js`)

Each row of the map is a string, and each character is one tile:

| Char | Tile | Char | Tile |
|---|---|---|---|
| `#` | wall | `.` | floor |
| `S` | start position | `X` | exit portal |
| `k` | golden key | `D` | locked door |
| `L` | lever | `G` | gate opened by the lever |
| `^` | spike trap | `c` | checkpoint flag |
| `B` | pushable crate | `P` | pressure plate |
| `H` | gate opened by the plate | `*` | gem |
| `+` | heart | | |

A new level is added by appending another object with the same shape to `MQ_LEVELS`.

### Modules inside `js/game.js`

`game.js` is a single file wrapped in an immediately invoked function, so nothing leaks into the global scope except the `window.MQ` test hook. It is organised into the sections below.

| Section (module) | Key functions / data | Purpose |
|---|---|---|
| Configuration | `TILE`, `MAX_HEARTS`, `MOVE_MS`, `SPIKE_PERIOD`, `SPIKE_UP`, `SPIKE_WARN`, `INVULN_MS`, `DIRS`, `KEYMAP` | Tunable constants for tile size, health, movement speed and trap timing, plus key bindings |
| Game state | `state`, `tiles`, `player`, `crate`, `hearts`, `gems`, `hasKeyCount`, `gateOpen`, `plateActive`, `checkpoint`, `path` | Single source of truth for everything that changes during play |
| Audio | `beep()`, `sfx.*` | Synthesises every sound effect (step, gem, key, door, lever, push, hurt, win and so on) with the Web Audio API. Respects the mute toggle |
| Level manager | `loadLevel()`, `mkPlayer()` | Parses the ASCII map into the `tiles` grid, places the player and crate, counts gems, resets all state and sizes the canvas |
| Collision and rules | `inside()`, `crateAt()`, `passable()` | Decides whether a tile can be entered, based on the tile type and the door, gate and plate state |
| Trap timing | `spikeState()` | Returns `up`, `warn` or `down` for a spike column at a given time. Each column is offset by 280 ms to create the ripple |
| Character movement and interaction | `tryMove()`, `onArrive()`, `toggleLever()`, `interact()`, `hurt()` | Moves the hero, opens doors, pushes the crate, collects items, sets checkpoints, applies damage and respawns |
| Pathfinding | `findPath()`, `onCanvasClick()` | Breadth-first search over walkable tiles for click-to-move. It converts the click position to a tile and queues the steps |
| Scoring and HUD | `updateHUD()`, `fmt()`, star calculation in `win()` | Shows hearts, gems, key, lever state and timer. Computes stars and the best time |
| Feedback effects | `toast()`, `burst()`, `shake` | On-screen messages, particle bursts and screen shake |
| Screen manager (state machine) | `show()`, `startGame()`, `pause()`, `resume()`, `toMenu()`, `win()`, `gameOver()` | Switches between menu, playing, paused, won and game over, and shows the matching overlay |
| Game loop | `frame()`, `update()` | Runs every animation frame. Advances movement, consumes queued path steps and held keys, checks spike damage and updates particles |
| Renderer | `render()`, `drawTile()`, `drawFloor()`, `drawCrate()`, `drawPlayer()`, `drawHeart()`, `drawVignette()`, `drawAttract()` | Draws the whole scene on the canvas each frame, with no image files |
| Input bindings | `keydown` / `keyup` / `blur` listeners, canvas click, D-pad pointer events, button handlers | Translates keyboard, mouse and touch input into game actions. Losing window focus auto-pauses |
| Test hook | `window.MQ` (`snapshot`, `goto`, `idle`, `spikeState`, `start`) | Read-only access used by the automated playthrough |

## 3. Game architecture and logic flow

### How the scripts interact

The architecture has one direction of data flow. Input never draws anything, and the renderer never changes state.

| Step | Layer | Code | Output |
|---|---|---|---|
| 1 | Input | Key, click, tap or button listeners | An action: a direction, "interact", or a screen command |
| 2 | Character controller | `tryMove()`, `interact()`, `findPath()` | A requested change to the world |
| 3 | Level manager and rules | `passable()`, `crateAt()`, `spikeState()`, `onArrive()` | Allowed or blocked. If allowed, the game state is updated (tiles, flags, items, hearts) |
| 4 | Feedback | `updateHUD()`, `toast()`, `sfx.*`, `burst()` | HUD numbers, messages, sounds and particles |
| 5 | Screen manager | `win()`, `gameOver()`, `pause()` | The overlay for the new state |
| 6 | Renderer | `render()` on the next frame | The updated scene on the canvas |

Example chain for the key and door puzzle:

1. The player presses the right arrow. The `keydown` listener maps it to `right` and calls `tryMove("right")`.
2. `tryMove()` sees that the next tile is `D` and that `hasKeyCount` is 1. It uses the key, turns the tile into floor, plays `sfx.door()`, shows the toast "Door unlocked!" and calls `updateHUD()`, which dims the key chip.
3. `passable()` now returns true, so the hero starts the 130 ms step.
4. On the next frames, `update()` animates the step, and `render()` draws the open doorway and the hero moving through it.

`level1.js` feeds `loadLevel()` once at the start of each game. After that, `game.js` works only on its own copy of the map, so restarting always begins from a clean level.

### Game state machine

| From | Event | To |
|---|---|---|
| menu | Play button or Enter | playing |
| playing | Esc, P, pause button or window loses focus | paused |
| paused | Resume, Esc or P | playing |
| paused | Main menu | menu |
| playing | Hero steps on the exit portal | won |
| playing | Last heart lost | over |
| won or over | Play again, Try again or Enter | playing |
| won or over | Main menu | menu |
| playing or paused | Restart (button or R) | playing (fresh level) |

Only the `playing` state runs `update()`. `render()` runs in every state, so the board stays visible behind the overlays.

### Per-frame loop

`requestAnimationFrame` calls `frame()` about 60 times per second:

1. Compute `dt`, the milliseconds since the last frame.
2. If the state is `playing`, run `update(now, dt)`:
    1. Update the timer in the HUD.
    2. If the hero is mid-step, advance the animation. When the step completes, call `onArrive()` (pick up items, checkpoints, exit).
    3. If the hero is standing still, take the next step from the click-to-move `path`. If there is none, take the step for the held key.
    4. If the hero stands on a spike tile that is `up` and the hero is not invulnerable, call `hurt()`.
    5. Move and fade the particles, and decay the screen shake.
3. Call `render(now)`: tiles, crate, click marker, hero, particles, vignette.
4. Request the next frame.

### Sequence of events from start to end

1. **Page load.** The browser loads `index.html` and `style.css`, then `level1.js` (which defines `MQ_LEVELS`), then `game.js`. `game.js` binds all input listeners, reads the best time from local storage, shows the start menu and starts the frame loop. The canvas shows an animated tile pattern (`drawAttract()`).
2. **Start.** The player presses Play or Enter. `startGame()` calls `loadLevel(MQ_LEVELS[0])`, which builds the grid, places the hero on `S`, counts 13 gems, sets 3 hearts, clears all flags and starts the timer. The state becomes `playing`, the overlay hides, and a toast gives the goal.
3. **Zone A: find the key.** The hero explores the start zone, collecting gems (`onArrive()` increments `gems` and updates the HUD) until reaching `k`. `hasKeyCount` becomes 1 and the key chip lights up.
4. **Door.** Walking into `D` with the key opens it (puzzle 1). Without the key, a hint toast appears and the move is blocked.
5. **Zone B: lever.** Next to `L`, the player presses E, Space or USE, or clicks the lever. `toggleLever()` flips `gateOpen`, the lever graphic swings, and gate `G` renders as open (puzzle 2).
6. **Checkpoint.** Past the gate, the hero steps on the first flag `c`, and `checkpoint` is updated.
7. **Zone C: spikes.** In the corridor, the player times each step using the wobble warning. If raised spikes are touched, `hurt()` removes a heart, shakes the screen, respawns the hero at the checkpoint and grants 1.2 seconds of invulnerability. At 0 hearts, `gameOver()` shows the Game Over screen, which offers Try Again or Main Menu.
8. **Zone D: crate.** After the second checkpoint and an optional heart pickup, the player pushes the crate right along the corridor. When it reaches `P`, `tryMove()` locks the crate and sets `plateActive`, and gate `H` opens (puzzle 4).
9. **Zone E: exit.** The hero collects the last gems and steps onto `X`. `onArrive()` calls `win()`.
10. **End.** `win()` stops the timer, computes stars from gems collected and time, updates the best time in local storage, and fills in the Level Complete screen (time, gems, hearts left, best time, stars). From there, Play Again restarts at step 2 and Main Menu returns to step 1.

## 4. Testing and extending

- **Automated test:** `tests/playthrough.mjs` drives the real game through `window.MQ`. It collects the key, opens the door, pulls the lever, crosses the spikes by waiting for safe windows, pushes the crate onto the plate, collects all 13 gems, checks pause, reaches the exit, and fails on any JavaScript error.
- **Tuning:** difficulty is controlled by the constants at the top of `game.js` (`MOVE_MS`, `SPIKE_PERIOD`, `SPIKE_UP`, `SPIKE_WARN`, `MAX_HEARTS`) and by `parTimeSec` in the level data.
- **Adding a level:** add an object to `MQ_LEVELS` with `id`, `name`, `parTimeSec` and `map`. The v1 flow always loads the first level, so a level-select screen would call `loadLevel(MQ_LEVELS[n])`.
- **Known limitations of v1:** one level only. The crate cannot be pulled, and the corridor layout prevents it from getting stuck. Only the best time is saved.
