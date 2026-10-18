# Divergent

**Turn noisy drone detections into a decision picture: where the drones are, where they launched from, where the launch team will go next, and which of our routes are exposed. A human approves every action.**

Built at c0mpiled-14 (UC Berkeley) for the YC Fall 2026 RFS, *The Future of American Defense*.
Dual-use: airport drone safety, wildfire response. **All data is simulated.** Surveillance and decision support only: no weapons, targeting, or engagement.

- **Live demo: offline.** It ran on Freestyle during the hackathon and has been shut down to save resources. Watch the launch video below, or run it locally (see "Run it locally").
- **Launch video:** https://youtu.be/zYiZJmwicIA (made with Latted)

## The problem
Drone defense starts with bad data. Radar, acoustic and RF sensors disagree, clutter looks like drones, and each sensor only sees part of the sky. Operators get dots, not answers. The questions that matter are different: *where did it come from, who is behind it, and what is it about to threaten?*

## What Divergent does
1. **Fuses** noisy detections from several allied sensors into clean **tracks** (Kalman filtering, clutter rejection).
2. **Estimates the launch origin** of each drone as a probability heat map, not a single guess.
3. **Groups drones into launch teams** and forecasts where each team will relocate and launch from next.
4. **Scores friendly routes** for exposure: how likely an enemy sensor net could trace them back to us.
5. **Suggests sensor moves** that would sharpen the picture, and runs **what-if** tests (disable or move a sensor, see the picture change side by side).
6. **Plans a surveillance drone** to go look at the most valuable area, avoiding exposed ground. It never moves until a named operator approves, stays inside a geofence, returns home on its own if risk climbs, and can be aborted at any time. Every state change is logged.
7. **Closes the loop:** when the survey drone sights a launch site, the map updates from a heat map to a **confirmed pinpoint**, the launch team is marked confirmed, and an alert fires.
8. **Explains the moment in plain language** for an operator (an LLM when a key is configured, otherwise a deterministic template). It recommends; it never decides.

## Demo scenarios
`demo` (two launch teams, clutter, one team relocates mid-run), `single`, `swarm` (six drones), `sparse` (only two sensors active), `dark` (RF-silent drones launched out of sensor view).

## How it works
```
sim  →  tracker  →  origin  →  launch teams  →  [survey-drone fusion]  →  forecast  →  route exposure  →  sensor suggestions  →  alerts + metrics
```
Each stage is a pure function on plain dicts; `api/pipeline.py` is the only glue. `CONTRACT.md` defines every JSON shape and is the single source of truth between the four modules.

| Folder | Owner | What |
|---|---|---|
| `sim/` | Diego | Seeded scenario generator (sensors, drones, launch teams, clutter) |
| `api/` | Diego | FastAPI service, pipeline glue, what-if, explain, survey-drone endpoints, deploy |
| `analysis/` | Leo | Tracker, origin estimate, launch teams, forecast, sensor suggestions, alerts |
| `planning/` | Ali | Route exposure, survey-drone planner and flight, metrics |
| `web/` | Neil | Operator map: 3D terrain, timeline, alerts, survey and what-if controls |

## Built with
Python, FastAPI, NumPy, filterpy, pytest · React, Vite, TypeScript, MapLibre, deck.gl · **Freestyle** (the API and web app run on a Freestyle VM, and the what-if flow clones a second VM from a snapshot) · Vercel (backup web host) · **Superset** (we used it to build the frontend and several backend features at the same time) · **Latted** (launch video) · OpenAI's Codex and Claude Code (AI coding agents we built with) · Claude (optional explain layer).

## Run it locally
```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
uvicorn api.main:app --port 8000          # API
cd web && npm install && npm run dev      # http://localhost:5173 (?api=http://localhost:8000 for your own API)
python -m pytest planning/tests sim/tests analysis/tests -q
```
Deploy notes: `api/DEPLOY.md`. Set `LLM_API_KEY` to use an LLM for the explain layer.

## Team
Diego, Neil, Leo, Ali
