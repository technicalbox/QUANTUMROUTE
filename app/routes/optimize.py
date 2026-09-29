"""Core optimization endpoints: demo, optimize, result retrieval."""

from __future__ import annotations

import logging
import traceback

from fastapi import APIRouter, HTTPException

from app.demo_data import get_demo_request
from app.models import OptimizationMode, OptimizationRequest, OptimizationResult
from app.optimizer import get_stored_result, run_optimization
from app.osrm_client import OSRMError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["optimize"])


# ---------------------------------------------------------------------------
# GET /api/demo – return demo data AND run optimization on it
# ---------------------------------------------------------------------------

@router.get("/demo", response_model=OptimizationResult | OptimizationRequest)
async def demo(
    mode: OptimizationMode = OptimizationMode.BALANCED,
    run: bool = True,
):
    """Run or inspect the built-in demo scenario.

    If run=true (default), solves the CVRP and returns OptimizationResult.
    If run=false, returns the raw OptimizationRequest for UI inspection.
    """
    req = get_demo_request(mode)
    if not run:
        return req
    try:
        return await run_optimization(
            depot=req.depot,
            customers=req.customers,
            vehicles=req.vehicles,
            mode=req.optimization_mode,
        )
    except OSRMError as exc:
        raise HTTPException(status_code=502, detail=f"OSRM error: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Demo optimization failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}") from exc


# ---------------------------------------------------------------------------
# POST /api/optimize – user-supplied data
# ---------------------------------------------------------------------------

@router.post("/optimize", response_model=OptimizationResult)
async def optimize(request: OptimizationRequest):
    """Solve CVRP for user-supplied depot, customers and vehicles."""
    try:
        return await run_optimization(
            depot=request.depot,
            customers=request.customers,
            vehicles=request.vehicles,
            mode=request.optimization_mode,
        )
    except OSRMError as exc:
        raise HTTPException(status_code=502, detail=f"OSRM error: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Optimization failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}") from exc


# ---------------------------------------------------------------------------
# GET /api/optimization/{id} – retrieve a past result
# ---------------------------------------------------------------------------

@router.get("/optimization/{result_id}", response_model=OptimizationResult)
async def get_optimization(result_id: str):
    """Retrieve a previously computed optimization result by ID."""
    result = get_stored_result(result_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Optimization result not found")
    return result
