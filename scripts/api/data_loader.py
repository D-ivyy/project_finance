"""
GCS + DuckDB data loading for the Project Finance Risk Dashboard.
Ported from notebooks/01_gen1_cashflow_dscr.ipynb cells §1b and §2.
"""
from __future__ import annotations

import os
import tempfile
from typing import Optional

import duckdb
import pandas as pd
from google.cloud import storage

GCS_PROJECT = os.environ.get("GCS_PROJECT", "infrasure-model-gpr")
GCS_BUCKET = os.environ.get("GCS_BUCKET", "infrasure-model-gpr-data")


def _gcs_client() -> storage.Client:
    return storage.Client(project=GCS_PROJECT)


def _download_blob_to_tmpfile(blob: storage.Blob, suffix: str = ".duckdb") -> str:
    """Download a GCS blob to a temp file. Caller must os.unlink() when done."""
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.close()
    blob.reload()
    blob.download_to_filename(tmp.name)
    return tmp.name


# ── Asset registry ─────────────────────────────────────────────────────────────

def load_available_sites() -> list[dict]:
    """Return list of all asset slugs from asset_registry.duckdb."""
    client = _gcs_client()
    blob = client.bucket(GCS_BUCKET).blob("asset_registry.duckdb")
    if not blob.exists():
        raise FileNotFoundError("asset_registry.duckdb not found in GCS root")

    tmp_path = _download_blob_to_tmpfile(blob)
    try:
        con = duckdb.connect(tmp_path, read_only=True)
        df = con.execute(
            "SELECT asset_slug, asset_type, state "
            "FROM asset ORDER BY asset_type, asset_slug"
        ).fetchdf()
        con.close()
        return df.to_dict(orient="records")
    finally:
        os.unlink(tmp_path)


def load_asset_metadata(site_slug: str) -> dict:
    """Return asset metadata for a specific site from asset_registry.duckdb."""
    client = _gcs_client()
    blob = client.bucket(GCS_BUCKET).blob("asset_registry.duckdb")
    tmp_path = _download_blob_to_tmpfile(blob)
    try:
        con = duckdb.connect(tmp_path, read_only=True)

        # Available sites
        available = con.execute(
            "SELECT asset_slug, asset_type, state "
            "FROM asset ORDER BY asset_type, asset_slug"
        ).fetchdf()

        # Specific site
        row = con.execute(
            """
            SELECT a.asset_slug, a.asset_type, a.state,
                   COALESCE(s.ac_capacity_mw, w.ac_capacity_mw) AS ac_capacity_mw
            FROM asset a
            LEFT JOIN solar_asset s USING (asset_id)
            LEFT JOIN wind_asset  w USING (asset_id)
            WHERE a.asset_slug = ?
            """,
            [site_slug],
        ).fetchone()
        con.close()

        if row is None:
            available_slugs = available["asset_slug"].tolist()
            raise ValueError(
                f"Site '{site_slug}' not found in asset_registry. "
                f"Available: {available_slugs}"
            )

        return {
            "asset_slug": row[0],
            "asset_type": row[1],
            "state": row[2],
            "ac_capacity_mw": float(row[3]) if row[3] is not None else None,
            "available_sites": available.to_dict(orient="records"),
        }
    finally:
        os.unlink(tmp_path)


# ── Revenue data ───────────────────────────────────────────────────────────────

def load_revenue_data(
    site_slug: str,
    kind: str = "hub",
    market: str = "da",
) -> tuple[list[dict], list[dict]]:
    """
    Download revenue.duckdb for a site, return (annual_paths, monthly_paths).

    annual_paths: list of rows from the `annual` table
    monthly_paths: list of rows from the `monthly` table (empty if no such table)
    """
    gcs_path = f"aggregated_data/{site_slug}/revenue.duckdb"
    client = _gcs_client()
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(gcs_path)

    if not blob.exists():
        raise FileNotFoundError(
            f"Revenue data not found: gs://{GCS_BUCKET}/{gcs_path}"
        )

    tmp_path = _download_blob_to_tmpfile(blob)
    try:
        con = duckdb.connect(tmp_path, read_only=True)

        # Annual paths
        annual_df = con.execute(
            """
            SELECT path_id, segment, source_year,
                   annual_revenue_usd,
                   price_per_mwh_gen_weighted,
                   revenue_coverage_pct
            FROM annual
            WHERE kind    = ?
              AND market  = ?
              AND eligible_for_rev_dist = TRUE
              AND annual_revenue_usd IS NOT NULL
            ORDER BY path_id
            """,
            [kind, market],
        ).fetchdf()

        # Monthly paths from the `monthly` table in revenue.duckdb.
        # Schema (from notebooks/extra/aggregated_analysis/02_monthly_forecast_plots.ipynb):
        #   path_id, segment, year_month (string "YYYY-MM"),
        #   monthly_revenue_usd, kind, market, eligible_for_rev_dist
        monthly_df = pd.DataFrame()
        try:
            tables = con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main'"
            ).fetchdf()
            table_names = tables["table_name"].tolist()

            if "monthly" in table_names:
                monthly_df = con.execute(
                    """
                    SELECT path_id,
                           segment,
                           year_month,
                           monthly_revenue_usd
                    FROM monthly
                    WHERE kind   = ?
                      AND market = ?
                      AND eligible_for_rev_dist = TRUE
                      AND monthly_revenue_usd IS NOT NULL
                    ORDER BY year_month, path_id
                    """,
                    [kind, market],
                ).fetchdf()

                if not monthly_df.empty:
                    # Extract calendar month (1-12) from year_month "YYYY-MM"
                    monthly_df["month"] = monthly_df["year_month"].str.split("-").str[1].astype(int)
                    # Keep only the columns the frontend expects
                    monthly_df = monthly_df[["path_id", "segment", "month", "monthly_revenue_usd"]]

                print(f"  [data_loader] Monthly rows: {len(monthly_df)} "
                      f"({monthly_df['path_id'].nunique() if not monthly_df.empty else 0} paths)")
        except Exception as e:
            print(f"  [data_loader] Monthly load error: {e}")

        con.close()

        annual_records = annual_df.to_dict(orient="records")
        # Convert numpy int/float to native Python for JSON serialization
        for row in annual_records:
            for k, v in row.items():
                if hasattr(v, "item"):
                    row[k] = v.item()

        monthly_records = monthly_df.to_dict(orient="records") if not monthly_df.empty else []
        for row in monthly_records:
            for k, v in row.items():
                if hasattr(v, "item"):
                    row[k] = v.item()

        return annual_records, monthly_records

    finally:
        os.unlink(tmp_path)
