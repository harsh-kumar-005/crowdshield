from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/density", tags=["Density Analysis"])


class GateCount(BaseModel):
    id: str
    count: int


class DensityRequest(BaseModel):
    total_crowd: int
    venue_capacity: int
    gates: List[GateCount]


def classify_risk(density_pct: float) -> dict:
    """Returns risk level and color based on density percentage."""
    if density_pct < 40:
        return {"risk_level": "low", "color": "#22c55e", "label": "Low Risk"}
    elif density_pct < 65:
        return {"risk_level": "medium", "color": "#f59e0b", "label": "Moderate Risk"}
    elif density_pct < 85:
        return {"risk_level": "high", "color": "#f97316", "label": "High Risk"}
    else:
        return {"risk_level": "critical", "color": "#ef4444", "label": "CRITICAL — Danger"}


def get_recommendations(risk_level: str, gates: List[GateCount]) -> List[str]:
    """Generates human-readable safety recommendations based on risk level."""
    recs = []
    max_gate = max(gates, key=lambda g: g.count) if gates else None

    if risk_level == "low":
        recs.append("Venue density is within safe limits. Continue standard monitoring.")
    elif risk_level == "medium":
        recs.append("Density approaching 65% capacity. Increase monitoring frequency.")
        if max_gate:
            recs.append(f"Gate '{max_gate.id}' has the highest traffic — consider redirecting flow.")
    elif risk_level == "high":
        recs.append("WARNING: Venue is at high density. Activate crowd management protocols.")
        recs.append("Deploy additional stewards to all entry/exit points immediately.")
        if max_gate:
            recs.append(f"PRIORITY: Gate '{max_gate.id}' is overloaded. Reduce inflow now.")
    elif risk_level == "critical":
        recs.append("CRITICAL ALERT: Stampede risk is elevated. Initiate emergency protocols.")
        recs.append("Open ALL emergency exits. Halt further entry to the venue.")
        recs.append("Alert law enforcement and medical teams to stand by.")
        if max_gate:
            recs.append(f"Gate '{max_gate.id}' is at maximum safe capacity — close gate immediately.")

    return recs


@router.post("/analyze")
async def analyze_density(req: DensityRequest):
    """
    Takes current crowd count and venue capacity,
    returns a risk classification and actionable recommendations.
    """
    density_pct = (req.total_crowd / req.venue_capacity * 100) if req.venue_capacity > 0 else 0
    risk_info = classify_risk(density_pct)
    recs = get_recommendations(risk_info["risk_level"], req.gates)

    # Find the most and least congested gates
    sorted_gates = sorted(req.gates, key=lambda g: g.count, reverse=True)

    return {
        "overall_density_pct": round(density_pct, 1),
        "total_crowd": req.total_crowd,
        "venue_capacity": req.venue_capacity,
        **risk_info,
        "recommendations": recs,
        "gate_analysis": {
            "most_congested": sorted_gates[0].id if sorted_gates else None,
            "least_congested": sorted_gates[-1].id if sorted_gates else None,
            "gate_detail": [{"id": g.id, "count": g.count, "pct": round(g.count / max(g.count for g in req.gates) * 100, 1) if req.gates else 0} for g in sorted_gates]
        }
    }
