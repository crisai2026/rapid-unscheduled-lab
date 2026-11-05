# Rapid Unscheduled Lab

A rocket lab and flight simulator that runs in the browser. Build a rocket from parts, launch it, and watch real-ish physics decide whether it reaches space or ends in a *rapid unscheduled disassembly*.

## Play

Online: https://crisai2026.github.io/rapid-unscheduled-lab/
Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → Deploy from branch `main`, folder `/root`).

## What it simulates

- **Mass**: every part has its own weight, and fuel is weight too. Burning fuel makes the rocket lighter.
- **Thrust, gravity and drag**: thinner air higher up, more drag near the speed of sound.
- **Stability**: centre of mass vs. centre of pressure. Fins keep it pointing forward; without them it flips and tumbles.
- **Breaking apart**: too much sideways air load or a hard landing turns the rocket into separate tumbling pieces, and leftover fuel explodes.
- **Staging**: up to 3 stages with interstages, plus 2 or 4 solid boosters. Dropped stages keep flying with the same physics.
- **Wind, steering and parachutes**: an autopilot steers by tilting the engine, and the parachute rips if you open it too fast.
- **Sound**: countdown voice, turbopump spin-up, engine roar, sonic boom, stage separation and explosions, all generated in the browser.

## Controls (flight)

| Key | Action |
|---|---|
| Space | Launch / abort / drop boosters / separate stage |
| A / D | Steer |
| T | Autopilot on/off |
| P | Parachute |
| X | Cut engine |
| M | Sound on/off |

## Roadmap

1. Staging and sound ✅
2. Realistic graphics (textures, shadows, better smoke and explosions)
3. Lab easter eggs and booster landing challenge
4. Electronics: a flight computer you wire up yourself
5. Full 3D steering

Physics values are in the `CONFIG` block at the top of the script, so they are easy to tweak.
