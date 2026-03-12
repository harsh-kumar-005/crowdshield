from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import density, detection, risk, simulation

app = FastAPI(
    title="CrowdShield ML Engine",
    description="AI-powered crowd analysis, person detection, and stampede risk prediction API",
    version="1.0.0",
)

# Allow requests from Node.js backend and React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(density.router)
app.include_router(detection.router)
app.include_router(risk.router)
app.include_router(simulation.router)


@app.get("/")
async def root():
    return {
        "service": "CrowdShield ML Engine",
        "status": "online",
        "endpoints": {
            "density_analysis": "POST /density/analyze",
            "person_detection": "POST /detection/count",
            "risk_prediction": "POST /risk/predict",
            "simulation_scenarios": "GET /simulation/scenarios",
            "simulation_run": "POST /simulation/run",
            "interactive_docs": "GET /docs",
        }
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model": "ready"}
