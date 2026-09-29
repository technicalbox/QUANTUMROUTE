"""QuantumRoute – FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import health, optimize, quantum, v1

# Logging
logging.basicConfig(
    level=logging.DEBUG if settings.IS_DEV else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

app = FastAPI(
    title="QuantumRoute",
    description=(
        "AI-powered last-mile delivery and vehicle-routing optimizer. "
        "Solves Capacitated Vehicle Routing Problems (CVRP) using real "
        "road-network data (OSRM) and Google OR-Tools, with an optional "
        "quantum computing demo via Qiskit."
    ),
    version="1.0.0",
)

# CORS – allow any origin for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health.router)
app.include_router(optimize.router)
app.include_router(quantum.router)
app.include_router(v1.router)


@app.get("/", include_in_schema=False)
async def root():
    """Redirect to API docs."""
    return {
        "service": "QuantumRoute",
        "docs": "/docs",
        "health": "/api/health",
        "demo": "/api/demo",
    }
