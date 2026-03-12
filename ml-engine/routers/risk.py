import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

router = APIRouter(prefix="/risk", tags=["Stampede Risk Prediction"])

# ─────────────────────────────────────────────────────────────────────
# SYNTHETIC TRAINING DATA
# Each row represents one historical scenario:
# [density_pct, flow_rate, hour_of_day, is_exit_event, venue_size_k]
# Labels: 0=low, 1=medium, 2=high, 3=critical
# ─────────────────────────────────────────────────────────────────────
TRAINING_DATA = np.array([
    # density, flow_rate, hour, exit_event, venue_size  → label
    [20,  100, 14, 0, 40],  # 0 low
    [30,  120, 16, 0, 40],  # 0 low
    [15,   80, 10, 0, 60],  # 0 low
    [35,  200, 18, 0, 40],  # 1 medium
    [50,  300, 19, 0, 40],  # 1 medium
    [45,  250, 17, 0, 60],  # 1 medium
    [60,  400, 20, 1, 40],  # 2 high
    [70,  450, 21, 1, 40],  # 2 high
    [65,  380, 20, 0, 40],  # 2 high
    [80,  600, 22, 1, 40],  # 3 critical
    [90,  700, 22, 1, 40],  # 3 critical
    [85,  650, 21, 1, 40],  # 3 critical
    [95,  800, 22, 1, 60],  # 3 critical  <- Chinnaswamy-like scenario
    [92,  750, 23, 1, 33],  # 3 critical
    [25,  150, 12, 0, 55],  # 0 low
    [40,  220, 19, 0, 55],  # 1 medium
    [72,  500, 21, 1, 66],  # 2 high
])

LABELS = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 0, 1, 2]

RISK_NAMES = {0: "low", 1: "medium", 2: "high", 3: "critical"}
RISK_COLORS = {0: "#22c55e", 1: "#f59e0b", 2: "#f97316", 3: "#ef4444"}

ACTIONS = {
    0: ["Continue normal monitoring", "Standard patrol schedule is sufficient"],
    1: ["Increase monitoring frequency", "Remind stewards of crowd flow protocols", "Prepare backup routes"],
    2: ["Activate crowd management protocols", "Deploy additional stewards at gates", "Reduce venue entry rate by 30%"],
    3: ["EMERGENCY: Initiate immediate evacuation assist", "Open all emergency exits NOW", "Alert police and medical teams", "Halt all new entries to venue", "Broadcast crowd diversion instructions on PA system"],
}

# Train the model at module import time (instant for small dataset)
_clf = RandomForestClassifier(n_estimators=100, random_state=42)
_clf.fit(TRAINING_DATA, LABELS)
print("Risk prediction model trained and ready.")


class GateCount(BaseModel):
    id: str
    count: int


class RiskRequest(BaseModel):
    total_crowd: int
    venue_capacity: int
    gates: List[GateCount]
    hour_of_day: Optional[int] = 20     # 0-23, defaults to 8pm (peak risk)
    is_exit_event: Optional[bool] = False  # True = concert/match just ended → rush out


@router.post("/predict")
async def predict_risk(req: RiskRequest):
    """
    Takes crowd and event parameters, returns a 0-100 risk score
    and recommended emergency actions using a trained Random Forest model.
    """
    density_pct = (req.total_crowd / req.venue_capacity * 100) if req.venue_capacity > 0 else 0
    gate_counts = [g.count for g in req.gates]
    flow_rate = max(gate_counts) if gate_counts else 0
    venue_size_k = req.venue_capacity // 1000

    features = np.array([[
        density_pct,
        flow_rate,
        req.hour_of_day,
        1 if req.is_exit_event else 0,
        venue_size_k,
    ]])

    predicted_class = int(_clf.predict(features)[0])
    probabilities = _clf.predict_proba(features)[0]

    # Map class probability to a 0-100 risk score
    # Weighted: low=0-25, medium=26-50, high=51-75, critical=76-100
    risk_score = int(
        probabilities[0] * 12.5 +
        probabilities[1] * 37.5 +
        probabilities[2] * 62.5 +
        probabilities[3] * 87.5
    )

    # Get feature importance for "top factors" explanation
    importances = _clf.feature_importances_
    feature_names = ["Venue Density", "Gate Flow Rate", "Time of Day", "Post-Event Exodus", "Venue Size"]
    top_factors = sorted(
        zip(feature_names, importances),
        key=lambda x: x[1],
        reverse=True
    )[:3]

    return {
        "risk_score": risk_score,
        "risk_level": RISK_NAMES[predicted_class],
        "risk_color": RISK_COLORS[predicted_class],
        "density_pct": round(density_pct, 1),
        "top_factors": [f[0] for f in top_factors],
        "suggested_actions": ACTIONS[predicted_class],
        "model_confidence_pct": round(float(max(probabilities)) * 100, 1),
        "input_summary": {
            "total_crowd": req.total_crowd,
            "venue_capacity": req.venue_capacity,
            "hour_of_day": req.hour_of_day,
            "is_exit_event": req.is_exit_event,
        }
    }
