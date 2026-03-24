"""
CrowdShield MCP Server
Exposes crowd safety ML tools via Model Context Protocol.

Usage:
  pip install "mcp[cli]"
  python mcp_server.py

Or register in your MCP client config (e.g. Claude Desktop):
  {
    "mcpServers": {
      "crowdshield": {
        "command": "python",
        "args": ["mcp_server.py"],
        "cwd": "/path/to/crowdshield/ml-engine"
      }
    }
  }
"""

import json
import sys

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("MCP package not installed. Run: pip install 'mcp[cli]'")
    sys.exit(1)

import numpy as np

# Import our existing ML routers for reuse
from routers.risk import predict_risk, router as risk_router
from routers.density import analyze_density
from routers.simulation import run_simulation, SCENARIOS

server = Server("crowdshield")


@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="crowdshield_risk_predict",
            description=(
                "Predict stampede risk for a crowd event. "
                "Returns a 0-100 risk score, risk level, contributing factors, and suggested actions. "
                "Uses a Random Forest ML model trained on crowd safety scenarios."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "total_crowd": {
                        "type": "integer",
                        "description": "Total number of people at the venue"
                    },
                    "venue_capacity": {
                        "type": "integer",
                        "description": "Maximum capacity of the venue"
                    },
                    "hour_of_day": {
                        "type": "integer",
                        "description": "Current hour (0-23). Events ending after 9pm have higher risk."
                    },
                    "is_exit_event": {
                        "type": "boolean",
                        "description": "True if crowd is trying to leave (post-event rush)",
                        "default": False
                    },
                    "is_raining": {
                        "type": "boolean",
                        "description": "True if it's currently raining (increases risk)",
                        "default": False
                    },
                },
                "required": ["total_crowd", "venue_capacity", "hour_of_day"]
            }
        ),
        Tool(
            name="crowdshield_density_analyze",
            description=(
                "Analyze crowd density at a venue and get safety recommendations. "
                "Returns risk level (low/medium/high/critical) with actionable recommendations."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "total_crowd": {
                        "type": "integer",
                        "description": "Total number of people at the venue"
                    },
                    "venue_capacity": {
                        "type": "integer",
                        "description": "Maximum capacity of the venue"
                    },
                    "num_gates": {
                        "type": "integer",
                        "description": "Number of open gates/exits",
                        "default": 4
                    },
                },
                "required": ["total_crowd", "venue_capacity"]
            }
        ),
        Tool(
            name="crowdshield_simulate",
            description=(
                "Run a crowd evacuation simulation for a given scenario. "
                "Returns summary stats: agents simulated, agents evacuated, peak risk score, and risk level. "
                "Available scenarios: normal, gate_failure, fire_alert, rain_delay, chinnaswamy."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "scenario": {
                        "type": "string",
                        "enum": ["normal", "gate_failure", "fire_alert", "rain_delay", "chinnaswamy"],
                        "description": "Simulation scenario to run"
                    },
                    "num_agents": {
                        "type": "integer",
                        "description": "Number of agents to simulate (50-1000)",
                        "default": 400
                    },
                },
                "required": ["scenario"]
            }
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "crowdshield_risk_predict":
        total = arguments["total_crowd"]
        capacity = arguments["venue_capacity"]
        hour = arguments["hour_of_day"]
        is_exit = arguments.get("is_exit_event", False)
        is_rain = arguments.get("is_raining", False)

        gates = [{"id": f"Gate {i+1}", "count": total // 4} for i in range(4)]

        # Call the risk prediction logic directly
        from routers.risk import RiskRequest
        req = RiskRequest(
            total_crowd=total,
            venue_capacity=capacity,
            gates=gates,
            hour_of_day=hour,
            is_exit_event=is_exit,
        )
        # Import the predict function
        from routers.risk import predict_risk as _predict
        result = await _predict(req)

        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2, default=str)
        )]

    elif name == "crowdshield_density_analyze":
        total = arguments["total_crowd"]
        capacity = arguments["venue_capacity"]
        num_gates = arguments.get("num_gates", 4)

        gates = [{"id": f"Gate {i+1}", "count": total // num_gates} for i in range(num_gates)]

        from routers.density import DensityRequest
        req = DensityRequest(total_crowd=total, venue_capacity=capacity, gates=gates)
        result = await analyze_density(req)

        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2, default=str)
        )]

    elif name == "crowdshield_simulate":
        scenario = arguments["scenario"]
        num_agents = min(1000, max(50, arguments.get("num_agents", 400)))

        if scenario not in SCENARIOS:
            return [TextContent(type="text", text=f"Unknown scenario: {scenario}. Valid: {list(SCENARIOS.keys())}")]

        frames, risk_timeline = run_simulation(scenario, num_agents, 1.0)
        max_risk = max((r["risk"] for r in risk_timeline), default=0)
        risk_level = "low" if max_risk < 30 else "medium" if max_risk < 55 else "high" if max_risk < 75 else "critical"

        summary = {
            "scenario": scenario,
            "scenario_label": SCENARIOS[scenario]["label"],
            "agents_simulated": num_agents,
            "agents_evacuated": num_agents - len(frames[-1]) if frames else 0,
            "total_frames": len(frames),
            "peak_risk_score": max_risk,
            "peak_risk_level": risk_level,
            "duration_seconds": SCENARIOS[scenario]["duration"],
            "description": SCENARIOS[scenario]["description"],
        }

        return [TextContent(
            type="text",
            text=json.dumps(summary, indent=2)
        )]

    return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
