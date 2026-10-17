# PLAN.md — c0mpiled-14 @ UC Berkeley (Sat Oct 17, 2026) — 4-person, full scope

**Venue:** MLK Pauley East Ballroom. **Build 11:00–4:30**, awards 5:30.
**Challenge:** YC Fall 2026 RFS → *The Future of American Defense*.

## The product (one sentence)
Software that takes messy sensor data about drones, works out where they likely launched from and where they'll launch next,
shows which friendly routes could be traced back to their origin, and lets a human approve a surveillance drone to go look —
all on simulated data.

## Team and ownership (load: Neil > Leo > Diego > Ali)
| Person | Agent | Owns | Builds | Brief |
|---|---|---|---|---|
| **Neil** (heaviest) | Codex | all of `web/`, `fixtures/` | map, every layer, slider, sensor contribution view, scenario picker, Launch Survey panel, alerts feed, explain panel, what-if UI; Latted video | `team/NEIL.md` |
| **Leo** (2nd) | Claude Code | `analysis/` | tracker, origin heat map, launch-team linking, next-launch forecast, sensor suggestion, alerts | `team/LEO.md` |
| **Diego** (lead) | Claude Code | `sim/`, `api/`, deploy | simulator + presets, `api/pipeline.py` wiring everyone's modules, endpoints, LLM explain, what-if, Freestyle hosting + VM clone | `team/DIEGO.md` |
| **Ali** (lighter, flex) | Claude Code | `planning/` | exposure + safer routes, recon planner with guardrails; then helps Neil, then Leo | `team/ALI.md` |

**Rule:** only edit your own folders. Need something from someone else? Ask them. Contract changes go through Diego.
Ali is the flex helper after ~2:15: if Neil or Leo is behind, Ali takes a piece (agree on who owns which file first).

## Integration checkpoints
- **12:30** — Diego's `sim` + Leo's tracker wired in `pipeline.py`; `/scenario/demo` returns real tracks.
- **1:30** — Neil switches from fixture to live API. **Tag `v-core` at 2:00** (tracks + origin heat map + slider live on Freestyle).
- **2:45** — Ali's exposure + Leo's forecast wired in; routes and forecast on the map.
- **3:30** — Recon flow + what-if + explain wired; **feature freeze**. Final deploy.

## Timeline
| Time | Neil | Leo | Diego | Ali |
|---|---|---|---|---|
| 11:00–11:30 | Vite + map scaffold; `types.ts`; fixture | Fake input + tracker skeleton | Repo + docs + folders; Freestyle VM hello-world | Fake input + exposure skeleton |
| 11:30–12:30 | Sensors, range circles, detections, layer toggles | Kalman tracker, clutter filtered, `sensor_ids`, ellipses | `sim/generate.py` (`demo`), `pipeline.py`, `/scenario/{id}` | Exposure grid, route risk, `exposed_by`, safer waypoints |
| 12:30–1:30 | Tracks, ellipses, origin heat map + confidence | Origin estimates + heat map; launch teams | Wire tracker + origin; deploy to Freestyle | Recon `propose` |
| 1:30–2:15 | **Live API**; **slider**; **sensor contribution view** | Forecast heat map | Presets `single`, `swarm`, `sparse` | Recon `fly` + guardrails |
| 2:15–3:00 | Routes, coverage, forecast, launch-team path, sensor marker, scenario picker; Launch Survey panel | Sensor suggestion | `/whatif` + **Freestyle clone**; wire exposure + forecast | **Flex:** help Neil (alerts feed or Survey panel) |
| 3:00–3:30 | Survey panel, alerts feed, explain panel, what-if side-by-side | Alerts | `/explain`; `/recon/*`; wire alerts | Flex: help Neil / Leo / Diego |
| 3:30–3:50 | **Freeze.** Screen-record; Latted brief | Run demo end-to-end | Final deploy | Run recon flow end-to-end |
| 3:50–4:10 | **Latted video** | Rehearse | Rehearse | Rehearse |
| 4:10–4:30 | **Submit:** Freestyle URL + Latted video + repo. No code after 4:10. | | | |

## If behind, cut in this order
sensor suggestion → launch-team "moved" alerts → what-if side-by-side → forecast layer → recon (show it as a roadmap slide).
**Never cut:** Freestyle hosting, slider, sensor contribution view, origin heat map, exposure routes.

## Sponsor alignment
- **Freestyle** (judge; 1st = $10k credits): live on preview URL; each preset is a VM; **clone a running VM** for what-if.
- **Latted** (judge): launch video = backup demo + for the remote judge.
- **OpenAI** (judge): explain panel; honest confidence; human approves every survey.
- **Quivly** (judge): alerts feed = actions feed with a recommended next step on every alert.
- **Transpose / EF**: startup framing — customer, wedge, why now.
- **Enactus**: dual-use — airport drone safety, wildfire response.
- **Gutgutgoose** (remote): plain-language pitch; video stands alone.

## Demo script (90 s)
1. Problem: messy sensor data — where did that drone come from, and are *we* exposed? Army Fall 2026 RFS.
2. Raw detections + clutter → scrub slider → tracks form, clutter ignored, origin heat map tightens.
3. Click a track → its sensors light up. "That's the fusion."
4. Launch team moves → forecast heat map shows where it'll likely launch next.
5. Friendly view: route turns red, safer corridor appears; sensor suggestion fills the gap.
6. Launch Survey: propose → operator reviews risk → **approve** → sim drone sweeps the forecast zone, stays in geofence, heat map sharpens.
7. Freestyle: pause → clone → disable a sensor → compare. "Two futures, branched in seconds."
8. Explain panel + actions feed. "A human approves everything."
9. Close: software-only wedge into Army open architecture; dual-use; **all data simulated**. Play Latted video.
