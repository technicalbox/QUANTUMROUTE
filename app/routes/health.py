"""Health-check endpoint."""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health():
    """Simple liveness check."""
    return {"status": "ok", "service": "quantumroute"}
