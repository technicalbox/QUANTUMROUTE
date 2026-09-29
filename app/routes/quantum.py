"""Quantum demo endpoint – isolated from production CVRP."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.models import QuantumDemoResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quantum", tags=["quantum"])


@router.post("/demo", response_model=QuantumDemoResult)
async def quantum_demo():
    """Run the small 5-node QAOA vs classical TSP experiment."""
    try:
        from app.quantum_demo import run_quantum_demo
        return run_quantum_demo()
    except RuntimeError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Quantum demo failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Quantum demo failed: {exc}",
        ) from exc
