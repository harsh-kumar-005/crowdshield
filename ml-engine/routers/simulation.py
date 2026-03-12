import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/simulation", tags=["Crowd Simulation"])

# ─── Constants ────────────────────────────────────────────────────────────────
FPS = 12            # frames per second output
DT = 1.0 / FPS     # time step in seconds
AGENT_RADIUS = 0.4  # metres
MAX_SPEED = 1.4     # m/s normal walking speed
PANIC_SPEED = 2.2   # m/s panicked running speed

# ─── Venue layout: gates as (x, y) positions on venue boundary ────────────────
# Venue is modelled as a 60m x 40m rectangle (roughly stadium floor)
VENUE_W = 60.0
VENUE_H = 40.0

GATE_DEFS = {
    "Gate N1": {"pos": np.array([20.0, 0.0]),  "capacity": 1000},  # North wall
    "Gate N2": {"pos": np.array([40.0, 0.0]),  "capacity": 1000},
    "Gate S1": {"pos": np.array([20.0, 40.0]), "capacity": 1000},  # South wall
    "Gate S2": {"pos": np.array([40.0, 40.0]), "capacity": 1000},
    "Tunnel":  {"pos": np.array([0.0,  20.0]), "capacity": 400},   # West tunnel — bottleneck
}

# ─── Scenario presets ──────────────────────────────────────────────────────────
SCENARIOS = {
    "normal": {
        "label": "Normal Event Exit",
        "description": "Standard post-event crowd dispersal. All gates open.",
        "num_agents": 500,
        "duration": 30,
        "closed_gates": [],
        "panic": False,
        "panic_start": None,
        "chinnaswamy": False,
    },
    "gate_failure": {
        "label": "Gate Failure",
        "description": "Gate N2 and Gate S2 close suddenly at t=8s. Crowd redirects.",
        "num_agents": 600,
        "duration": 40,
        "closed_gates": [],
        "gate_failure_at": 8.0,
        "gates_that_fail": ["Gate N2", "Gate S2"],
        "panic": False,
        "panic_start": None,
        "chinnaswamy": False,
    },
    "fire_alert": {
        "label": "Fire/Emergency Alert",
        "description": "Fire alert at t=5s triggers panic behaviour — agents rush and compress.",
        "num_agents": 700,
        "duration": 35,
        "closed_gates": [],
        "panic": False,
        "panic_start": 5.0,
        "chinnaswamy": False,
    },
    "rain_delay": {
        "label": "Concert Rain Delay",
        "description": "Event is delayed. Crowd clusters under the covered north section.",
        "num_agents": 400,
        "duration": 25,
        "closed_gates": [],
        "panic": False,
        "panic_start": None,
        "rain": True,
        "chinnaswamy": False,
    },
    "chinnaswamy": {
        "label": "🔴 Chinnaswamy Incident (Jun 4, 2025)",
        "description": "42000 crowd, post-match exit rush. Gate N2 and S1 closed. Tunnel becomes critical bottleneck.",
        "num_agents": 800,  # scaled down for performance, represents 42k
        "duration": 60,
        "closed_gates": ["Gate N2", "Gate S1"],
        "panic": True,
        "panic_start": 10.0,
        "chinnaswamy": True,
    },
}


# ─── Request / Response models ────────────────────────────────────────────────
class SimulationRequest(BaseModel):
    scenario: str = "normal"
    num_agents: Optional[int] = None  # override scenario default
    speed_multiplier: float = 1.0


class AgentFrame(BaseModel):
    x: float
    y: float
    status: str  # "moving", "bunching", "panic", "exited"


# ─── Core simulation ──────────────────────────────────────────────────────────
def run_simulation(scenario_key: str, num_agents: int, speed_mult: float):
    """
    Runs a simplified Social Force Model simulation.
    Returns list of frames, each frame is a list of agent dicts.
    """
    scenario = SCENARIOS[scenario_key]
    duration = scenario["duration"]
    total_frames = int(duration * FPS)

    # Open gates for this scenario
    open_gates = {k: v for k, v in GATE_DEFS.items() if k not in scenario.get("closed_gates", [])}

    # Initialise agents at random positions spread across the venue interior
    rng = np.random.default_rng(42)
    positions = rng.uniform(
        low=[5.0, 5.0],
        high=[VENUE_W - 5, VENUE_H - 5],
        size=(num_agents, 2)
    ).astype(np.float64)
    velocities = np.zeros((num_agents, 2), dtype=np.float64)
    exited = np.zeros(num_agents, dtype=bool)

    # Assign each agent a target gate (nearest open gate at start)
    gate_positions = np.array([v["pos"] for v in open_gates.values()])
    gate_names = list(open_gates.keys())

    def assign_targets(pos, open_gate_pos):
        dists = np.linalg.norm(pos[:, None, :] - open_gate_pos[None, :, :], axis=2)
        return np.argmin(dists, axis=1)

    target_gate_idx = assign_targets(positions, gate_positions)

    frames = []
    panic_active = False
    gate_failure_done = False

    for frame_idx in range(total_frames):
        t = frame_idx * DT * speed_mult

        # ── Trigger panic ────────────────────────────────────────────
        ps = scenario.get("panic_start")
        if ps and t >= ps and not panic_active:
            panic_active = True

        # ── Gate failure mid-simulation ──────────────────────────────
        gf_at = scenario.get("gate_failure_at")
        if gf_at and t >= gf_at and not gate_failure_done:
            for gname in scenario.get("gates_that_fail", []):
                if gname in open_gates:
                    del open_gates[gname]
            gate_positions = np.array([v["pos"] for v in open_gates.values()])
            gate_names = list(open_gates.keys())
            if len(gate_positions) > 0:
                target_gate_idx = assign_targets(positions, gate_positions)
            gate_failure_done = True

        max_spd = PANIC_SPEED if panic_active else MAX_SPEED

        frame_agents = []
        active_mask = ~exited

        if active_mask.sum() == 0:
            # All agents exited — pad remaining frames
            frames.append([])
            continue

        # ── Driving force: agent wants to reach its target gate ──────
        if len(gate_positions) == 0:
            # No open gates — agents mill around (worst case scenario)
            driving = np.zeros_like(velocities)
        else:
            safe_idx = np.clip(target_gate_idx, 0, len(gate_positions) - 1)
            targets = gate_positions[safe_idx]
            to_target = targets - positions
            dist_to_target = np.linalg.norm(to_target, axis=1, keepdims=True) + 1e-6
            desired_vel = (to_target / dist_to_target) * max_spd
            driving = (desired_vel - velocities) * 0.4  # relaxation time τ=2.5s

        # ── Separation force: push away from nearby agents ───────────
        separation = np.zeros_like(positions)
        for i in np.where(active_mask)[0]:
            diffs = positions[i] - positions  # vectors from all agents to i
            dists = np.linalg.norm(diffs, axis=1)
            # Only agents within 2m affect this agent
            close = (dists < 2.0) & (dists > 0) & active_mask
            if close.sum() > 0:
                force_mag = np.maximum(0, (2.0 - dists[close]) / 2.0)
                dirs = diffs[close] / (dists[close, None] + 1e-6)
                sep_force = (dirs * force_mag[:, None]).sum(axis=0)
                # Panic reduces separation (people compress)
                sep_scale = 0.3 if panic_active else 1.2
                separation[i] = sep_force * sep_scale

        # ── Wall repulsion ───────────────────────────────────────────
        wall = np.zeros_like(positions)
        margin = 1.5
        wall[:, 0] += np.maximum(0, margin - positions[:, 0]) * 3.0       # left wall
        wall[:, 0] -= np.maximum(0, positions[:, 0] - (VENUE_W - margin)) * 3.0  # right
        wall[:, 1] += np.maximum(0, margin - positions[:, 1]) * 3.0       # top
        wall[:, 1] -= np.maximum(0, positions[:, 1] - (VENUE_H - margin)) * 3.0  # bottom

        # ── Integrate ────────────────────────────────────────────────
        acceleration = driving + separation + wall
        velocities += acceleration * DT
        # Clamp speed
        speeds = np.linalg.norm(velocities, axis=1, keepdims=True)
        too_fast = speeds > max_spd
        velocities[too_fast[:, 0]] = (
            velocities[too_fast[:, 0]] / speeds[too_fast[:, 0]] * max_spd
        )
        positions += velocities * DT

        # ── Check exit ───────────────────────────────────────────────
        if len(gate_positions) > 0:
            for gpos in gate_positions:
                dist_to_gate = np.linalg.norm(positions - gpos, axis=1)
                newly_exited = (dist_to_gate < 1.5) & active_mask
                exited |= newly_exited
                velocities[newly_exited] = 0

        # ── Determine agent status for visualisation ─────────────────
        local_density = np.zeros(num_agents)
        for i in np.where(active_mask)[0]:
            dists_all = np.linalg.norm(positions - positions[i], axis=1)
            local_density[i] = ((dists_all < 3.0) & active_mask).sum()

        for i in range(num_agents):
            if exited[i]:
                continue
            spd = np.linalg.norm(velocities[i])
            dens = local_density[i]

            if panic_active and dens > 12:
                status = "panic"
            elif dens > 8 or spd < 0.15:
                status = "bunching"
            else:
                status = "moving"

            frame_agents.append({
                "x": round(float(positions[i, 0]), 2),
                "y": round(float(positions[i, 1]), 2),
                "status": status,
            })

        frames.append(frame_agents)

    # ── Build risk timeline ──────────────────────────────────────────────────
    risk_timeline = []
    for fi, frame in enumerate(frames):
        panic_count = sum(1 for a in frame if a.get("status") == "panic")
        bunching_count = sum(1 for a in frame if a.get("status") == "bunching")
        total = len(frame)
        if total == 0:
            risk = 0
        else:
            risk = min(100, int((panic_count * 3 + bunching_count * 1.5) / max(total, 1) * 100))
        risk_timeline.append({"frame": fi, "risk": risk, "t": round(fi * DT, 1)})

    return frames, risk_timeline


# ─── Endpoint ──────────────────────────────────────────────────────────────────
@router.get("/scenarios")
async def list_scenarios():
    """Returns all available scenario presets."""
    return [
        {
            "key": k,
            "label": v["label"],
            "description": v["description"],
            "default_agents": v["num_agents"],
            "duration_seconds": v["duration"],
            "closed_gates": v.get("closed_gates", []),
        }
        for k, v in SCENARIOS.items()
    ]


@router.post("/run")
async def run_sim(req: SimulationRequest):
    """
    Runs the crowd simulation for the given scenario.
    Returns all frames and a risk timeline.
    This may take 1-3 seconds to compute.
    """
    if req.scenario not in SCENARIOS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown scenario '{req.scenario}'. Valid: {list(SCENARIOS.keys())}")

    scenario = SCENARIOS[req.scenario]
    num_agents = req.num_agents or scenario["num_agents"]
    num_agents = max(50, min(num_agents, 1000))  # clamp 50–1000

    frames, risk_timeline = run_simulation(req.scenario, num_agents, req.speed_multiplier)

    exited_count = 0
    if frames:
        all_seen = set()
        for frame in frames:
            for a in frame:
                pass  # exited agents are simply removed from frames
        # Count agents NOT in last frame
        exited_count = num_agents - len(frames[-1]) if frames else 0

    max_risk = max((r["risk"] for r in risk_timeline), default=0)
    risk_level = "low" if max_risk < 30 else "medium" if max_risk < 55 else "high" if max_risk < 75 else "critical"

    return {
        "scenario": req.scenario,
        "scenario_label": scenario["label"],
        "num_agents": num_agents,
        "total_frames": len(frames),
        "fps": FPS,
        "venue": {"width": VENUE_W, "height": VENUE_H},
        "gates": [
            {"name": k, "x": float(v["pos"][0]), "y": float(v["pos"][1]),
             "open": k not in scenario.get("closed_gates", [])}
            for k, v in GATE_DEFS.items()
        ],
        "frames": frames,
        "risk_timeline": risk_timeline,
        "summary": {
            "agents_evacuated": exited_count,
            "max_risk_score": max_risk,
            "peak_risk_level": risk_level,
            "duration_seconds": scenario["duration"],
        }
    }
