# GCS Bucket Structure: `gs://infrasure-model-gpr-data`

This document describes the folder structure and purpose of each top-level prefix in the InfraSure model-gpr GCS bucket.

---

## Quick Reference

| Name | Status | Purpose |
|------|--------|---------|
| **Root Files** |||
| `asset_registry.duckdb` | ✅ Important | Main config/database |
| **Core Data** |||
| `generation_data/` | ✅ Most Important | Historical generation (solar/wind) |
| `forecast_data/` | ✅ Most Important | Simulated forecast paths ⚠️ |
| `revenue_data/` | ✅ Important | Historical revenue ⚠️ |
| `aggregated_data/` | ✅ Important | Multi-frequency aggregated forecast data (DuckDB) |
| `lmp_prices/` | ✅ Important | LMP pricing data |
| `external_data_sources/` | ✅ Important | Reference CSVs (needs cleanup) |
| `weather_data/` | ✅ Important | ERA5/SEAS5 weather data |
| **Review Required** |||
| `actual_generation/` | ⏸️ Review | Actual gen data (unclear) |
| `backtests/` | ⏸️ Review | Not in current impl |
| `hazard_data/` | ⏸️ Review | Future hazard risk work |
| `s2s_weather_forecast_data/` | ✅ Important | S2S seasonal forecasts (ECMWF SEAS5) |
| `suggestions/` | ⏸️ Review | Unknown |=
| **Utility** |||
| `backups/` | 🗄️ Utility | Registry backups |
| `archive/` | 🗄️ Utility | Deprecated data |

**Legend:** ✅ Active/Important | ⏸️ Review Required | 🗄️ Utility/Archive | ⚠️ Has naming issues

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL DATA SOURCES                             │
├─────────────────────────────────────────────────────────────────────────┤
│  • EIA (plant metadata, actual generation)                              │
│  • GridStatus API (LMP prices: CAISO, ERCOT, MISO, PJM, SPP)           │
│  • Hydronos API (ERA5 reanalysis, SEAS5 forecasts)                     │
│  • USWTDB (turbine specifications)                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    RAW DATA INGESTION (Scripts)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  hydronos_weather_*.py  →  weather_data/                               │
│  price_fetcher/         →  lmp_prices/{location}/                      │
│  asset_registry_autofill/ → asset_registry.duckdb                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      CORE DATA STORAGE (GCS)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  📋 asset_registry.duckdb      (metadata, pricing nodes, params)       │
│  🌡️  weather_data/              (ERA5 hourly: temp, wind, solar rad)    │
│  💰 lmp_prices/{location}/      (DA/RT hourly prices by node/hub)       │
│  🏢 external_data_sources/     (CSVs: enriched data, turbine curves)   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   GENERATION MODELING (Scripts)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  solar_gen_code.py      →  generation_data/solar_gen_data/             │
│  wind_gen_code_fast.py  →  generation_data/wind_gen_data/              │
│                                                                          │
│  [Physics + ML calibration models]                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    GENERATED POWER DATA (GCS)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ⚡ generation_data/            (hourly generation for each asset)       │
│     ├── solar_gen_data/                                                 │
│     └── wind_gen_data/                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              FORECAST SIMULATION (Bootstrap Resampling)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  forecast_simulation/                                                    │
│    Reads: generation_data/ + lmp_prices/ + asset_registry.duckdb       │
│    Methods: Uniform, Weather-Conditional, Climatology (n=0-1000 paths) │
│    Writes: forecast_data/ + revenue_data/                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      FORECAST OUTPUTS (GCS)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  📊 forecast_data/{site}/{kind}/{market}/*_forecast.parquet            │
│     (probabilistic generation paths: P10/P50/P90 distributions)         │
│                                                                          │
│  💵 revenue_data/{site}/{kind}/*_historical.parquet                     │
│     (generation × price = revenue time series)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│               AGGREGATION POST-PROCESS (forecast_simulation/aggregation) │
├─────────────────────────────────────────────────────────────────────────┤
│  Reads: forecast_data/{site}/{kind}/{market}/*_forecast.parquet         │
│  Writes: aggregated_data/{site}/generation.duckdb                      │
│          aggregated_data/{site}/revenue.duckdb                         │
│          aggregated_data/{site}/aggregation_manifest.json              │
│          aggregated_data/_summary/annual.parquet  (cross-site)         │
│                                                                          │
│  Triggered: automatically at end of forecast-simulation run            │
│             OR manually: forecast-aggregation CLI                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOWNSTREAM USE CASES                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  • Risk Analysis (VaR, CVaR)                                            │
│  • Parametric Insurance Design (TRANSFER module)                        │
│  • Portfolio Optimization                                               │
│  • Client Reporting & Dashboards                                        │
└─────────────────────────────────────────────────────────────────────────┘

                      ┌──────────────────────────┐
                      │   SUPPORT FOLDERS        │
                      ├──────────────────────────┤
                      │ backups/    (snapshots)  │
                      │ archive/    (deprecated) │
                      │ backtests/  (validation) │
                      │ hazard_data/ (future)    │
                      └──────────────────────────┘
```

### Key Data Flow Principles

1. **Raw → Modeled → Forecasted**  
   Weather/price data → Physics models → Bootstrap simulation → Probabilistic outputs

2. **Single Source of Truth**  
   `asset_registry.duckdb` is the canonical configuration for all assets

3. **Separation of Concerns**  
   - Generation modeling (physics + ML) is separate from forecast simulation (statistical resampling)
   - Price data fetching is independent from generation modeling
   - Asset metadata management is centralized

4. **GCS as Central Storage**  
   All scripts read from and write to GCS (no local-only workflows for production)

---

## Root-Level Files

### `asset_registry.duckdb`
**Status:** ✅ Important — Main Config/Database  
**Purpose:** Canonical asset registry containing all asset metadata, pricing node mappings, solar/wind parameters, and portfolio associations.  
**Notes:**
- Single source of truth for asset configuration
- Backups stored in `backups/asset_registry/`
- Schema: `asset`, `solar_asset`, `wind_asset`, `asset_price`, `portfolios`, `portfolio_assets`

---

## Core Data Folders (Important / Active)

### `generation_data/`
**Status:** ✅ Most Important — Keep  
**Purpose:** Historical generation data for all assets (solar + wind).  
**Structure:**
- `solar_gen_data/` — Solar generation parquet files
- `wind_gen_data/` — Wind generation parquet files

Each asset has a parquet file with hourly generation values. Foundation for all forecast simulation and revenue modeling.

**Target structure (future):**
```
generation_data/
├── solar/
│   ├── hourly/
│   ├── daily/
│   └── monthly/
└── wind/
    ├── hourly/
    ├── daily/
    └── monthly/
```

---

### `forecast_data/`
**Status:** ✅ Most Important — Keep  
**Purpose:** Output of `forecast_simulation` pipeline. Probabilistic generation forecast paths.  
**Structure:**
```
forecast_data/
└── {asset_slug}/
    ├── node/{da|rt}/{asset_slug}_node_{da|rt}_forecast.parquet
    └── hub/{da|rt}/{asset_slug}_hub_{da|rt}_forecast.parquet
```
**⚠️ Known Issue:** Mixed capital/lowercase naming in some asset folders — needs cleanup.

---

### `revenue_data/`
**Status:** ✅ Important — Keep (other team uses)  
**Purpose:** Historical revenue calculations (generation × price) for each asset.  
**Structure:** Mirrors `forecast_data/` with `{asset_slug}/{node|hub}/{da|rt}_historical.parquet`.  
**⚠️ Known Issue:** Mixed capital/lowercase naming in some asset folders — needs cleanup.

---

### `aggregated_data/`
**Status:** ✅ Important — Keep  
**Purpose:** Multi-frequency aggregated forecast outputs (annual, monthly) stored as DuckDB files. Produced by `forecast_simulation/aggregation` as a post-process step after `forecast_data/` parquets are written.  
**Schema:** [schema_aggregated_data.md](schema/schema_aggregated_data.md)  
**Structure:**
```
aggregated_data/
├── {asset_slug}/
│   ├── generation.duckdb           ← annual + monthly generation aggregates
│   ├── revenue.duckdb              ← annual + monthly revenue aggregates
│   └── aggregation_manifest.json  ← thresholds, counts, run timestamp
└── _summary/
    └── annual.parquet              ← cross-site summary (all sites, annual rows)
```
**Key design decisions:**
- One DuckDB per domain (generation vs revenue) per site — different historical depth, different retention.
- `kind` and `market` are columns inside the tables (not folders), so one file holds hub/da + hub/rt + node/da + node/rt for a site.
- Only combinations with a corresponding forecast parquet are present — auto-detected at aggregation time.
- All time grouping uses `datetime_local` (site local timezone), never UTC index, to get correct calendar month/day boundaries and DST-aware coverage %.
- Coverage thresholds: annual ≥95%, monthly ≥80% (configurable in `config.json → aggregation` block).
- Price metric: `price_per_mwh_gen_weighted = revenue / generation` (correct "average received price"); `price_per_mwh_simple_mean` stored as optional reference.

**Notes:**
- Source is always the hourly forecast parquet in `forecast_data/`.
- DuckDB files are safe to download and query locally with zero setup.
- Cross-site portfolio queries: use `_summary/annual.parquet` rather than downloading per-site files.

---

### `lmp_prices/`
**Status:** ✅ Important — Keep  
**Purpose:** Locational marginal price (LMP) data organized by pricing location.  
**Structure:**
```
lmp_prices/
└── {location_name}/
    ├── da_hourly.parquet   # Day-ahead prices
    └── rt_hourly.parquet   # Real-time prices
```
**Notes:**
- Location names must match `hub_node` / `resource_node` values in `asset_registry.duckdb`
- Known naming issues: `ARKANSASHUB` vs `ARKANSAS.HUB`, `VACS` (missing)

---

### `external_data_sources/`
**Status:** ✅ Important — Keep (needs cleanup)  
**Purpose:** External reference data used by various scripts.  
**Contents:** CSV files with EIA data, turbine curves, node mappings, etc.  
**Notes:** Many scripts depend on files in this folder. Review before modifying.

---

### `weather_data/`
**Status:** ✅ Important — Keep  
**Purpose:** Weather data (ERA5 reanalysis, SEAS5 forecasts) for generation modeling.  
**Schema:** [schema_weather_data.md](schema/schema_weather_data.md) — file naming, column schema, units, and examples.

---

## Review Required (Not in Current Implementation)

### `backtests/`
**Status:** ⏸️ Review Required  
**Purpose:** Backtest results and validation data.  
**Notes:** Not part of current production implementation. Needs deep dive to determine usefulness.

---

### `hazard_data/`
**Status:** ⏸️ Review Required  
**Purpose:** Hazard modeling data (for MEASURE module).  
**Notes:** Not in current performance modeling, but important for future hazard risk work.

---

### `s2s_weather_forecast_data/`
**Status:** ✅ Important — Keep  
**Purpose:** ECMWF SEAS5 seasonal forecast data for weather-conditional bootstrap methods.  
**Structure:**
```
s2s_weather_forecast_data/
└── {asset_slug}_seas_daily_forecast_{model}.json
```
**Example:** `albemarle_beach_solar_seas_daily_forecast_ECMWF_IFS.json`

**File Format:** JSON with nested structure:
```json
{
  "lat": "35.92819",
  "lon": "-76.62045", 
  "model": "ECMWF_IFS",
  "fetched_variables": ["temperature_2m", "shortwave_radiation_net", ...],
  "errors": {},
  "data": {
    "shortwave_radiation_net": {
      "time": ["2026-01-02T00:00:00", ...],
      "data": [{
        "name": "shortwave_radiation_net",
        "units": "W/m2",
        "values": {"0": [...], "1": [...], ..., "50": [...]},
        "source": "ECMWF IFS SEAS5"
      }]
    },
    ...
  }
}
```

**Key Properties:**
| Property | Value |
|----------|-------|
| Model | ECMWF IFS SEAS5 |
| Ensemble Members | 51 |
| Forecast Horizon | ~7 months (215 days) |
| Temporal Resolution | Daily |

**Fetch Script:** `scripts/hydronos_weather_forecast_fetch.py`  
**Documentation:** `local_docs/S2S_Forecast_Data_ECMWF_IFS.md`

---

### `suggestions/`
**Status:** ⏸️ Review Required  
**Purpose:** Unknown / miscellaneous.  
**Notes:** Keep for now.

---

### `actual_generation/`
**Status:** ⏸️ Review Required  
**Purpose:** Actual generation data (possibly from EIA or other sources).  
**Notes:** Relationship to `generation_data/` unclear — needs review.

---

## Support / Utility Folders

### `backups/`
**Status:** 🗄️ Utility — Backup Storage  
**Purpose:** Backup copies of important files (registry snapshots, etc.).  
**Structure:**
```
backups/
└── asset_registry/
    ├── README.txt
    └── asset_registry.backup_*.duckdb
```

---

### `archive/`
**Status:** 🗄️ Utility — Deprecated/Legacy Data  
**Purpose:** Storage for data no longer in active use but preserved for reference.  
**Contents:**
- `site_registry.csv` — Legacy CSV export of asset registry (deprecated)
- `forecast_data_legacy/` — Title_Case forecast folders from old code (archived 2026-01-16, 46 assets)
- `revenue_data_legacy/` — Title_Case revenue folders from old code (archived 2026-01-16, 46 assets)
- `adj_generation_data/` — Legacy adjusted generation data (deprecated format)
- `adj_weather_data/` — Legacy adjusted weather data (deprecated format)
- `new_forecast_data/` — Old forecast approach (deprecated)
- `price_data/` — Old price data folder (deprecated)
- `resurety_generation/` — Legacy resurety generation data (deprecated)

**Notes:** Data here is not used by current pipelines. Safe to delete after confirmation.

---

## Deleted

### `metadata/`
**Status:** ❌ Deleted  
**Reason:** Very old, not useful. Deleted 2026-01-16.

---

## Folder Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Important / Active — Do not modify without review |
| 🗄️ | Utility / Archive — Support folder for backups and legacy data |
| ⏸️ | Review Required — Not in current implementation, needs evaluation |
| ❌ | Deleted / Deprecated — Removed or can be removed |

---

## Known Issues / Cleanup Needed

1. **`forecast_data/` + `revenue_data/`**: Mixed capital/lowercase asset folder names
2. **`lmp_prices/`**: `ARKANSASHUB` vs `ARKANSAS.HUB` naming mismatch; `VACS` folder missing
3. **`external_data_sources/`**: Needs review and cleanup

---

## Naming Conventions

- **Asset slugs:** lowercase, underscores (e.g., `armenia_mountain_wind_farm`)
- **Timestamps:** ISO 8601 UTC (e.g., `20260114T171427Z`)
- **Pricing locations:** Must match exactly what's in `lmp_prices/` folder names
- **File extensions:** `.parquet` for data, `.duckdb` for databases

---

---

## File Naming Conventions & Formats

This table documents the **exact naming patterns, file formats, and casing rules** used across all scripts.

### Source of Asset Identifier

All scripts derive file names from `asset_registry.duckdb`:
- **Column used:** `asset_slug` (from `asset` table)
- **Format:** Lowercase with underscores (e.g., `armenia_mountain_wind_farm`)
- **No transformations:** Scripts use `asset_slug` as-is (no case conversion)

**⚠️ Terminology Note:** In the code, variables are often named `site`, `site_name`, or similar, but they **always get their value from the `asset_slug` column** in the database. There is no separate `site` column - `{site}` in patterns below means "value from `asset_slug`".

### File Naming Patterns by Script/Output

| Script | GCS Path Pattern | File Name Pattern | Extension | Casing Rules | Notes |
|--------|------------------|-------------------|-----------|--------------|-------|
| **Generation Scripts** ||||||
| `solar_gen_code.py` | `generation_data/solar_gen_data/` | `{asset_slug}_generation.parquet` | `.parquet` | Lowercase | asset_slug from DB |
| `wind_gen_code_fast.py` | `generation_data/wind_gen_data/` | `{asset_slug}_generation.parquet` | `.parquet` | Lowercase | asset_slug from DB |
| **Price Fetcher** ||||||
| `price_fetcher/` | `lmp_prices/{location}/` | `da_hourly.parquet` | `.parquet` | **Preserve case** | location = hub_node or resource_node from DB |
| | | `rt_hourly.parquet` | `.parquet` | **Preserve case** | ⚠️ Location must match DB exactly |
| **Forecast Simulation** ||||||
| `forecast_simulation/` | `forecast_data/{asset_slug}/{kind}/{market}/` | `{asset_slug}_{kind}_{market}_forecast.parquet` | `.parquet` | Lowercase | asset_slug from DB, kind=node/hub, market=da/rt |
| | `revenue_data/{asset_slug}/{kind}/` | `{market}_historical.parquet` | `.parquet` | Lowercase | market = da or rt |
| | `forecast_data/{asset_slug}/logs/` | `simulation_{timestamp}.log` | `.log` | Lowercase | timestamp = YYYYMMDDTHHMMSSZ |
| **Forecast Aggregation** ||||||
| `forecast_simulation/aggregation/` | `aggregated_data/{asset_slug}/` | `generation.duckdb` | `.duckdb` | Lowercase | Annual + monthly gen aggregates; kind/market as columns |
| | `aggregated_data/{asset_slug}/` | `revenue.duckdb` | `.duckdb` | Lowercase | Annual + monthly revenue aggregates; gen-weighted price |
| | `aggregated_data/{asset_slug}/` | `aggregation_manifest.json` | `.json` | Lowercase | Thresholds, counts, run timestamp |
| | `aggregated_data/_summary/` | `annual.parquet` | `.parquet` | Lowercase | Cross-site annual rows (all sites) |
| **Hindcast** ||||||
| `hindcast.py` | `hindcast_data/{method}/{asset_slug}/{kind}/{market}/{year}/` | `{asset_slug}_{kind}_{market}_hindcast_{init_date}.parquet` | `.parquet` | Lowercase | init_date = YYYY-MM-DD |
| | | `bootstrap_{init_date}.json` | `.json` | Lowercase | Year selections metadata |
| **Actual Generation** ||||||
| `fetch_actual_gen_eia.py` | `actual_generation/monthly/` | `{asset_slug}_actual_gen_eia.csv` | `.csv` | Lowercase | Sanitized: spaces→underscores |
| **Asset Registry** ||||||
| `asset_registry_db/` | Root | `asset_registry.duckdb` | `.duckdb` | Lowercase | Canonical registry |
| | Root | `site_registry.csv` | `.csv` | Lowercase | Legacy CSV export |
| **External Data** ||||||
| `asset_registry_autofill/` | `external_data_sources/` | `solar_enriched.csv` | `.csv` | Lowercase | EIA product |
| | | `wind_enriched.csv` | `.csv` | Lowercase | EIA product |
| | | `lmp_master_sheet_mapping.csv` | `.csv` | Lowercase | LMP node mapping |
| | | `uswtdb_V8_1_20250522.csv` | `.csv` | Mixed case | USWTDB turbine data |
| | | `turbine_curves_v1.csv` | `.csv` | Lowercase | Power curves |
| **Weather Data** ||||||
| `hydronos_weather_api_code.py` | `weather_data/` | `{asset_slug}_{variable}.nc` or `.parquet` | `.nc`/`.parquet` | Lowercase | ERA5 historical reanalysis |
| `hydronos_weather_forecast_fetch.py` | `s2s_weather_forecast_data/` | `{asset_slug}_seas_daily_forecast_{model}.json` | `.json` | Lowercase | ECMWF SEAS5 (51 ensembles, ~7mo) |

### Critical Naming Rules

| Rule | Detail | Example | Impact if Violated |
|------|--------|---------|-------------------|
| **1. asset_slug is canonical** | All scripts MUST use `asset_slug` from `asset` table exactly | `armenia_mountain_wind_farm` | File not found errors |
| **2. Folder names = lowercase** | All GCS folder names use lowercase | `forecast_data/`, not `Forecast_Data/` | Path not found |
| **3. LMP location = case-sensitive** | `lmp_prices/{location}/` preserves DB casing | `ARKANSAS.HUB` ≠ `arkansas.hub` | Missing price data error |
| **4. File extensions** | `.parquet` for data, `.duckdb` for DB, `.csv` for external, `.json` for metadata | Always use correct extension | Read failures |
| **5. Underscores, not spaces** | File names use `_` separator | `armenia_mountain` not `armenia mountain` | Invalid paths |
| **6. Timestamps = UTC ISO** | Format: `YYYYMMDDTHHMMSSZ` | `20260114T171922Z` | Sorting/parsing issues |

### Known Inconsistencies

| Issue | Current State | Should Be | Status |
|-------|---------------|-----------|--------|
| **Mixed case in forecast_data/** | ~~Some folders: `Armenia_Mountain_Wind_Farm/`~~ | All lowercase: `armenia_mountain_wind_farm/` | ✅ **RESOLVED** (2026-01-16) |
| **Mixed case in revenue_data/** | ~~Some folders: `Armenia_Mountain_Wind_Farm/`~~ | All lowercase: `armenia_mountain_wind_farm/` | ✅ **RESOLVED** (2026-01-16) |
| **LMP location naming** | `ARKANSASHUB` vs `ARKANSAS.HUB` in registry | Standardize to match actual folder names | ⚠️ To investigate |
| **VACS hub missing** | `american_beech_solar_llc` has `hub_node=VACS` | Need to create `lmp_prices/VACS/` or update DB | ⚠️ Blocks forecast |
| **Folder count mismatch** | `forecast_data/` has 52 folders, `revenue_data/` has 48 | Should be same count? | ⚠️ To investigate |

**Resolution Details (2026-01-16):**
- Archived 46 Title_Case folders from `forecast_data/` → `archive/forecast_data_legacy/`
- Archived 46 Title_Case folders from `revenue_data/` → `archive/revenue_data_legacy/`
- All active folders now use lowercase matching `asset_slug` from database
- Old data preserved in archive for reference

### Case Sensitivity Summary

| Component | Casing Rule | Example |
|-----------|-------------|---------|
| GCS folder names | **Lowercase** | `generation_data/`, `forecast_data/` |
| File names (data) | **Lowercase** | `{asset_slug}_generation.parquet` |
| File names (config) | **Lowercase** | `asset_registry.duckdb` |
| asset_slug (from DB) | **As-is (lowercase)** | `armenia_mountain_wind_farm` |
| LMP location names | **Preserve DB case** | `EASTERN HUB`, `HB_NORTH`, `ARKANSAS.HUB` |
| Market identifiers | **Lowercase** | `da`, `rt` (not `DA`, `RT`) |
| Kind identifiers | **Lowercase** | `node`, `hub` (not `Node`, `Hub`) |

---

## Script → GCS Folder Mapping

This section documents which scripts read from and write to which GCS folders.

### Generation Scripts

| Script | Reads From | Writes To | Purpose |
|--------|------------|-----------|---------|
| `solar_gen_code.py` | `weather_data/` (ERA5) | `generation_data/solar_gen_data/` | Generate hourly solar generation |
| `wind_gen_code_fast.py` | `weather_data/` (ERA5) | `generation_data/wind_gen_data/` | Generate hourly wind generation |
| | `asset_registry.duckdb` | | (turbine params) |
| | `external_data_sources/` | | (turbine curves) |

### Price Data Scripts

| Script | Reads From | Writes To | Purpose |
|--------|------------|-----------|---------|
| `price_fetcher/` | GridStatus API | `lmp_prices/{location}/` | Fetch LMP prices |
| | | `{da,rt}_hourly.parquet` | (day-ahead & real-time) |

### Weather Data Scripts

| Script | Reads From | Writes To | Purpose |
|--------|------------|-----------|---------|
| `hydronos_weather_api_code.py` | Hydronos API | `weather_data/` | Fetch ERA5 historical reanalysis |
| `hydronos_weather_forecast_fetch.py` | Hydronos API | `s2s_weather_forecast_data/` | Fetch ECMWF SEAS5 forecasts |
| | `asset_registry.duckdb` | `{slug}_seas_daily_forecast_{model}.json` | (51 ensembles, ~7mo horizon) |

### Forecast Simulation Pipeline

| Script | Reads From | Writes To | Purpose |
|--------|------------|-----------|---------|
| `forecast_simulation/` | `asset_registry.duckdb` | `forecast_data/{site}/{kind}/{market}/` | Generate probabilistic |
| | `generation_data/` | `*_forecast.parquet` | forecast paths |
| | `lmp_prices/{location}/` | | |
| | | `revenue_data/{site}/{kind}/` | |
| | | `{market}_historical.parquet` | |
| | | `forecast_data/{site}/logs/` | (run logs) |

### Forecast Aggregation (Post-Process)

| Script | Reads From | Writes To | Purpose |
|--------|------------|-----------|---------|
| `forecast_simulation/aggregation/` | `forecast_data/{site}/{kind}/{market}/` | `aggregated_data/{site}/generation.duckdb` | Annual + monthly gen aggregates |
| | `*_forecast.parquet` | `aggregated_data/{site}/revenue.duckdb` | Annual + monthly revenue aggregates |
| | | `aggregated_data/{site}/aggregation_manifest.json` | Run metadata |
| | | `aggregated_data/_summary/annual.parquet` | Cross-site summary |

### Asset Registry Management

| Script | Reads From | Writes To | Purpose |
|--------|------------|-----------|---------|
| `asset_registry_db/` | `asset_registry.duckdb` | `asset_registry.duckdb` | Query/export registry |
| `asset_registry_autofill/` | `external_data_sources/` | `asset_registry.duckdb` | Auto-populate pricing |
| | - `solar_enriched.csv` | | nodes & metadata |
| | - `wind_enriched.csv` | | |
| | - `lmp_master_sheet_mapping.csv` | | |

### Actual Generation (EIA)

| Script | Reads From | Writes To | Purpose |
|--------|------------|-----------|---------|
| `fetch_actual_gen_eia.py` | EIA API | `actual_generation/monthly/` | Fetch actual generation |
| | | `{plant_id}_monthly.parquet` | for validation |

---

## Script Dependencies Summary

```
weather_data/               → [solar_gen_code.py, wind_gen_code_fast.py]
                           → generation_data/

generation_data/            → [forecast_simulation]
lmp_prices/                → [forecast_simulation]
asset_registry.duckdb      → [forecast_simulation, solar/wind gen codes, autofill]
                           → forecast_data/
                           → revenue_data/

forecast_data/              → [forecast_simulation/aggregation]  (post-process)
                           → aggregated_data/

external_data_sources/      → [asset_registry_autofill]
                           → asset_registry.duckdb
```

---

## Notes

- Last updated: 2026-02-27
- Bucket: `gs://infrasure-model-gpr-data`
- Project: `infrasure-model-gpr`
