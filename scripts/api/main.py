"""
FastAPI backend for the Project Finance Risk Dashboard.
Provides two endpoints:
  GET /api/sites            → list available asset slugs from registry
  GET /api/revenue/{slug}   → revenue paths + asset metadata for a site
"""
from __future__ import annotations

from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from data_loader import load_available_sites, load_asset_metadata, load_revenue_data

app = FastAPI(
    title="InfraSure Finance Dashboard API",
    description="GCS data loader for Project Finance Risk Dashboard",
    version="1.0.0",
)

# Allow Next.js dev server (port 3001) and any localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Response models ───────────────────────────────────────────────────────────

class SiteInfo(BaseModel):
    asset_slug: str
    asset_type: str
    state: str


class AssetMeta(BaseModel):
    asset_slug: str
    asset_type: str
    state: str
    ac_capacity_mw: Optional[float]


class RevenuePath(BaseModel):
    path_id: int
    segment: str
    source_year: Optional[int]
    annual_revenue_usd: float
    price_per_mwh_gen_weighted: float
    revenue_coverage_pct: float


class MonthlyPath(BaseModel):
    path_id: int
    segment: str
    month: int
    monthly_revenue_usd: float


class SiteDataResponse(BaseModel):
    asset: AssetMeta
    revenue_paths: list[RevenuePath]
    monthly_paths: list[MonthlyPath]
    available_sites: list[SiteInfo]
    kind: str
    market: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/sites", response_model=list[SiteInfo])
async def get_sites() -> list[dict]:
    """List all available asset slugs from asset_registry.duckdb."""
    try:
        return load_available_sites()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCS error: {e}")


@app.get("/api/revenue/{site_slug}", response_model=SiteDataResponse)
async def get_revenue(
    site_slug: str,
    kind: str = Query(default="hub", pattern="^(hub|node)$"),
    market: str = Query(default="da", pattern="^(da|rt)$"),
) -> dict:
    """
    Load revenue paths + asset metadata for a site.
    Downloads revenue.duckdb from GCS and returns JSON.
    """
    try:
        asset_meta = load_asset_metadata(site_slug)
        annual_paths, monthly_paths = load_revenue_data(site_slug, kind, market)
        return {
            "asset": {
                "asset_slug": asset_meta["asset_slug"],
                "asset_type": asset_meta["asset_type"],
                "state": asset_meta["state"],
                "ac_capacity_mw": asset_meta["ac_capacity_mw"],
            },
            "revenue_paths": annual_paths,
            "monthly_paths": monthly_paths,
            "available_sites": asset_meta["available_sites"],
            "kind": kind,
            "market": market,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading data: {e}")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "finance-dashboard-api"}
