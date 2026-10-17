# DIEGO — task list
Folders: `sim/`, `api/`. Branch: `diego/*`. Start task 1 now.

- [x] **1. Scaffold.** Create `sim/__init__.py`, `api/__init__.py`, `analysis/__init__.py`, `planning/__init__.py`,
  `requirements.txt` (fastapi uvicorn numpy filterpy pydantic pytest). Commit.

- [x] **2. `sim/generate.py`** — `generate(scenario_id: str, seed: int = 42, overrides: dict | None = None) -> dict`
  returning the RawScenario in CONTRACT.md. Preset `demo`:
  - Map 10000 x 10000 m, `duration_s` 120.
  - Allied sensors S1–S4 spread across the map (radar 2500 m, acoustic 1500 m, rf 3000 m ranges); enemy sensors ES1, ES2 in the
    north-west (range 2000 m).
  - Two enemy launch teams. Team 1 near (1800, 7500) launches at t=5, 20, 35, then relocates to (2600, 6800) and launches at
    t=70, 85. Team 2 near (1500, 3000) launches at t=15, 50, 95. Each drone flies a straight line toward a random point in the
    east half at 25–40 m/s.
  - Every second, each active allied sensor emits a detection for each drone in range: position + Gaussian noise
    (`sigma_m`: radar 40, acoustic 90, rf 140). Plus clutter: per sensor per second, 8% chance of a uniform random point in
    range with `clutter: true`, `truth_drone_id: null`.
  - Friendly routes F1 from (8500, 1000) to (5000, 6500) passing near ES2's coverage, and F2 from (8500, 1000) to (7500, 4000).
  - `home_base` (8500, 1000). Fill `truth_paths` and `truth_launches`.
  - `overrides`: `{"disable": ["S3"]}` and `{"move": {"S3": [x, y]}}`.
  - Write `sim/tests/test_generate.py`: deterministic for the same seed, clutter fraction roughly 8%, every non-clutter
    detection is within its sensor's range.
  - **Push to `main` by 12:00 and tell Leo and Ali.**

- [x] **3. `api/pipeline.py`** — `build_scenario(scenario_id, overrides=None, recon=None) -> dict`:
  sim → `analysis.tracker.run` → `analysis.origin.run` → `analysis.launch_teams.run` → `analysis.forecast.run` →
  `planning.exposure.run` → `analysis.sensor_suggest.run` → assemble one Frame per t → `analysis.alerts.run` → merge alerts →
  `planning.metrics.run`. Import each module inside `try/except` and fall back to empty values, so a missing or broken
  module never breaks the API. Log which modules loaded.

- [x] **4. `api/main.py`** — FastAPI with CORS `*`: `GET /health`, `GET /scenarios`, `GET /scenario/{id}`. Build all presets at
  startup and cache them in memory. Run it and curl each route.

- [x] **5. Deploy to Freestyle.** Follow their docs: run `uvicorn api.main:app --host 0.0.0.0 --port 8000` in a VM and expose the
  preview URL. Send the URL to Neil for `VITE_API_URL`. Write the exact commands into `api/DEPLOY.md`.

- [x] **6. Presets.** `single` (one team, one drone), `swarm` (one team launching 6 drones at once at t=20), `sparse` (only S1
  and S4 active).

- [x] **7. What-if.** `POST /scenario/{id}/whatif` with body `{sensor_id, action: "disable"|"move", x?, y?}` → rebuild with
  overrides and return the Scenario (don't cache it). Then the Freestyle clone flow: pause the running VM, clone it, apply a
  what-if in the clone, and serve it on its own preview URL. Document the steps in `api/DEPLOY.md`.

- [x] **8. Explain.** `POST /scenario/{id}/explain?t=N` → build a compact JSON summary of that frame (top origins with
  confidence, launch-team moves, routes with risk, the latest alerts) and send it to the LLM with the instruction:
  "Summarize in 3 short plain-English lines for an operator. Include confidence. Recommend, never decide." Return `{text}`.
  Fall back to a template string if there's no key.

- [x] **9. Recon endpoints.** `POST /recon/propose?t=N` → `planning.recon.propose`. `POST /recon/approve` `{route_id, operator, t}`
  → reject with 400 if `operator` is empty; otherwise call `planning.recon.fly`, merge the R1 detections into the sim
  detections, rebuild, and set `Frame.recon` per t. `POST /recon/abort` `{route_id, t}` → `fly(..., abort_t=t)` and rebuild.
  Paths are under `/scenario/{id}/`.

- [x] **10. 3:30 freeze.** Final deploy, then confirm every endpoint on the Freestyle URL.
