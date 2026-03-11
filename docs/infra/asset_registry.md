# Asset Registry Schema (`asset_registry.duckdb`)

This file defines the **full logical schema** for the asset registry database (`asset_registry.duckdb`).

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `plant_id_eia` naming | Explicit source attribution — clear it's from EIA |
| `plant_name_eia` separate from `asset_name` | `asset_name` = your/client name; `plant_name_eia` = EIA's official name (for QA/traceability) |
| `generator_id_eia` in `asset` | Asset rows are generator-level (1:1 with `solar_asset` or `wind_asset`), so the EIA generator identifier belongs on the parent |
| `client_group_name` optional field | Lightweight solution for edge case where client sees multiple EIA plants as "one site" |
| `asset_type` single value | Child tables already define what types exist; no need for comma-separated complexity |
| `latitude`/`longitude` in `asset` | Canonical coordinates used by the platform (modeling, timezones, file naming, etc.). Historically these started as EIA coords, but they can be refined over time. |
| `latitude_eia`/`longitude_eia` in child tables | Keep the original EIA reference coordinates per technology table for traceability (solar vs wind can diverge as we enrich) |

---

## Relationship Model

```
┌─────────────────────────────────────────────────────────────┐
│                          asset                               │
│                     (common metadata)                        │
├─────────────────────────────────────────────────────────────┤
│ asset_id (PK)                                                │
│ asset_name              ← your/client name                   │
│ asset_type              ← single value: solar, wind, battery │
│                                                              │
│ plant_id_eia            ← EIA Plant Code (ORISPL)            │
│ generator_id_eia        ← EIA Generator ID (Form 860)        │
│ plant_name_eia          ← EIA's official name (optional)     │
│ client_group_name       ← optional grouping for edge cases   │
│                                                              │
│ latitude                ← canonical/modeling latitude        │
│ longitude               ← canonical/modeling longitude       │
│                                                              │
│ state, county, ...                                           │
│ (pricing linkage lives in asset_price: iso, nodes, strategy)  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ M:N (via join table)
                              │
┌─────────────────────────────┴──────────────────────────────┐
│                    portfolio_assets (join)                   │
├─────────────────────────────────────────────────────────────┤
│ portfolio_id (FK → portfolios.id)                            │
│ asset_id     (FK → asset.asset_id)                           │
│ PK (portfolio_id, asset_id)                                  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 1:M
                              │
┌─────────────────────────────────────────────────────────────┐
│                         portfolios                            │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ name                                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:1
                              ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│        solar_asset           │    │         wind_asset           │
├──────────────────────────────┤    ├──────────────────────────────┤
│ asset_id (PK, FK)            │    │ asset_id (PK, FK)            │
│                              │    │                              │
│ latitude_eia    ← reference  │    │ latitude_eia    ← reference  │
│ longitude_eia   ← reference  │    │ longitude_eia   ← reference  │
│                              │    │                              │
│ dc_capacity_mw               │    │ ac_capacity_mw               │
│ ac_capacity_mw               │    │ turbine_model                │
│ system_type                  │    │ n_turbines                   │
│ inverter_model  ← CEC lookup │    │ ...                          │
│ module_model    ← CEC lookup │    │                              │
│ ...                          │    │                              │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## ✅ Current Physical Tables in `asset_registry.duckdb` (v3.3)

This is the **exact set of tables currently present** in the canonical DuckDB file:

**Core Asset Tables:**
- `asset`
- `asset_price`
- `solar_asset`
- `wind_asset`

**Portfolio & Grouping Tables:**
- `portfolios`
- `portfolio_assets`

**Configuration & Reference Tables:**
- `asset_templates` *(added 2026-02)* — Standard templates for prospective assets
- `calibration_factors` *(added 2026-02)*

**Lookup Tables (Physical):** *(added 2026-02)*
- `asset_type_lookup`
- `asset_status_lookup`
- `creation_method_lookup`
- `source_key_lookup`
- `component_code_lookup` *(added 2026-02, v3.3)* — Vocabulary for asset component types (WIND_*, SOLAR_*, SHARED_*, BESS_*)

**Component Tables:** *(added 2026-02, v3.3)*
- `asset_component` — Component-level inventory per asset (one row per component instance; supports hierarchy via `parent_component_id`)

Anything else in this document (e.g., `battery_asset`) is **future / proposed** and is not part of the current DB file.

---

## 🧩 Portfolio Tables (Grouping)

These tables model **grouping** separately from the asset itself:

- `portfolios`: named portfolio entities
- `portfolio_assets`: many-to-many mapping between portfolios and assets

### Basic Physical Schemas (vCurrent)

`portfolios`

| Column | Type (DuckDB) | Description |
|--------|---------------|-------------|
| `id` | `UUID` | Portfolio identifier |
| `name` | `VARCHAR` | Portfolio name |

`portfolio_assets`

| Column | Type (DuckDB) | Description |
|--------|---------------|-------------|
| `portfolio_id` | `UUID` | FK to `portfolios.id` |
| `asset_id` | `UUID` | FK to `asset.asset_id` |

**Note (DuckDB)**: DuckDB does not support `ON DELETE CASCADE` enforcement for foreign keys. This schema still stores the relationships, but cascading deletes must be handled by application logic if needed.

---

## 💲 Pricing Table — `asset_price`

This table provides a clean separation of **pricing linkage/config** from core asset metadata.

### Why a separate table?
- Pricing fields evolve faster (node changes, fallback strategies, different products/feeds).
- Not all pipelines need pricing fields (generation-only workflows shouldn’t depend on pricing config completeness).
- Keeps `asset` focused on **identity + canonical coordinates + classification**.

### Relationship Model
- **1:1** with `asset` via `asset_id` (one row per asset when price workflows are enabled).
- For future flexibility (node changes over time), we can later migrate to **1:N** with `effective_start` / `effective_end`.

### Basic Physical Schema (vCurrent)

We keep this section intentionally lightweight (unlike `asset` / `solar_asset` / `wind_asset`).

**Primary Key:** `asset_id` (UUID, references `asset.asset_id`)

| Column | Type (DuckDB) | Description |
|--------|---------------|-------------|
| `asset_id` | `UUID` | 1:1 link to the parent `asset` |
| `iso` | `VARCHAR` | Market/ISO label used by pricing pipelines |
| `resource_node` | `VARCHAR` | Primary nodal settlement point |
| `fallback_resource_node_1` | `VARCHAR` | Fallback node #1 |
| `fallback_resource_node_2` | `VARCHAR` | Fallback node #2 |
| `hub_node` | `VARCHAR` | Hub settlement point / fallback |
| `price_strategy` | `VARCHAR` | e.g. `nodal_then_hub`, `hub_only`, `nodal_only` |
| `validation_status` | `VARCHAR` | `pass/warn/fail` pricing readiness |
| `notes` | `VARCHAR` | Pricing-specific notes |

---

## Field Dictionary Structure

| Column | Description |
|--------|-------------|
| **Field** | Column name in the database |
| **Field Category** | Logical grouping (Identifier, Classification, Location, System, etc.) |
| **Type** | Data type (`text`, `integer`, `numeric`, `boolean`, `uuid`, `timestamp`) |
| **Units** | Physical units where relevant (MW, m, degrees, etc.) |
| **Required?** | `Yes` / `No` / `Conditional` |
| **Source (priority order)** | Expected sources of truth |
| **Fill Method** | How this field is populated |
| **Validation Rules** | Constraints and checks |
| **Error Handling** | How violations are handled |
| **Expected Values/Range** | Typical range or allowed set |
| **Example** | Example value |
| **Notes** | Conceptual notes |
| **Legacy Field** | Mapping to v1/v2 field names |

---

## 🧱 Table 1: `asset` (Common Asset Metadata)

**Primary Key:** `asset_id` (UUID)

### Identifier Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `asset_id` | Identifier | uuid | | Yes | infrasuredb | Auto-generated | Must be non-null valid UUID; immutable after insert | Reject if missing/invalid | Any valid UUID | `0199de04-0c32-79e8-8818-a576dfe78672` | Primary key for all asset-related tables | |
| `asset_name` | Identifier | text | | Yes | client, eia | User input or import | Not empty; length < 255 | Reject if empty/too long | Non-empty string | `Lamesa Solar` | Your/client's preferred name — may differ from EIA | `site_name` |
| `asset_slug` | Identifier | text | | No | infrasuredb | Auto-generate from `asset_name` | Lowercase; matches `[a-z0-9_]+`; unique within org | Auto-correct/regenerate | Slugified name | `lamesa_solar` | URL-safe version for file paths, APIs | `site_name` |
| `plant_id_eia` | Identifier | integer | | Conditional | eia, client | Import from EIA or user input | Integer; should exist in EIA reference | Reject or `validation_status='fail'` for EIA workflows | Integer | `60372` | EIA Plant Code (ORISPL); NULL for non-EIA assets | `plant_code` |
| `generator_id_eia` | Identifier | text | | Conditional | eia | Import from EIA | If non-null, unique within `(plant_id_eia, generator_id_eia)` tuple | `validation_status='fail'` if missing for EIA generator-level assets | EIA generator ID | `1` | Generator ID is not globally unique; always treat `(plant_id_eia, generator_id_eia)` as a tuple | |
| `plant_name_eia` | Identifier | text | | No | eia | Import from EIA | If non-null, should match EIA records | `validation_status='warn'` on mismatch | Non-empty string or NULL | `Lamesa Solar Farm` | EIA's official plant name; for QA/traceability | |
| `client_group_name` | Identifier | text | | No | client | Manual entry | Free text | None | Non-empty string or NULL | `Desert Sun Complex` | Optional; for grouping multiple EIA plants that client sees as one site | |

### Classification Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `asset_type` | Classification | text | | Yes | client | User input or derived | Must be one of allowed values | Reject if invalid | `{solar, wind, battery}` | `solar` | Single value; child tables define specifics | `site_type` |
| `asset_status` | Classification | text | | Yes | client, eia | User input or EIA import | Must be one of allowed values | Default to `active` if missing | `active` | `active` | Lifecycle status | |
| `technology_code` | Classification | text | | No | eia, catalog | Import from EIA | If non-null, must be from controlled list | `validation_status='warn'` if invalid | `{SOLAR_PV, WIND_ONSHORE, BATTERY, ...}` | `SOLAR_PV` | Master taxonomy code for the asset (shared across technologies). | |

### Location Fields (Canonical Coordinates)

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `latitude` | Location | numeric | degrees | Conditional | eia, uspvdb, uswtdb, client | Default from EIA initially; refine over time | Between -90 and 90 | Reject if invalid | `[-90, 90]` | `32.71561` | Canonical latitude used by the platform (modeling/timezones). | `latitude` |
| `longitude` | Location | numeric | degrees | Conditional | eia, uspvdb, uswtdb, client | Default from EIA initially; refine over time | Between -180 and 180 | Reject if invalid | `[-180, 180]` | `-101.92652` | Canonical longitude used by the platform (modeling/timezones). | `longitude` |
| `state` | Location | text | | No | eia, derived | Import or reverse geocode | If non-null, 2-letter US state code | `validation_status='warn'` on mismatch | 2-letter code or NULL | `TX` | State/region | `state` |
| `county` | Location | text | | No | eia, derived | Import or reverse geocode | Free text | None | Any string | `Dawson` | County or equivalent | `county` |

### Grid/Market Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `balancing_authority` | Classification | text | | No | eia | Import from EIA | If non-null, trimmed | `validation_status='warn'` if invalid | BA code or NULL | `ERCO` | Balancing Authority code | |

> Pricing configuration (`iso`, `resource_node`, fallbacks, `hub_node`, `price_strategy`, etc.) is stored in `asset_price` (see “Pricing Table — `asset_price`” above). This avoids duplicating pricing fields on `asset` and lets pricing rules evolve independently.

### Temporal Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `start_month` | Identifier | text | | Conditional | eia | Import from EIA | One of `{jan, feb, ..., dec}` | `validation_status='fail'` if required but missing | `{jan..dec}` | `apr` | Commissioning month | `start_month` |
| `start_year` | Identifier | integer | | Conditional | eia | Import from EIA | Integer in `[1900, 2100]` | `validation_status='fail'` if outside range | `1900–2100` | `2017` | Commissioning year | `start_year` |

### Auditing Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `validation_status` | Classification | text | | Yes | pipeline | Set by validation pipeline | One of `{pass, warn, fail}` | `fail` blocks pipeline | `{pass, warn, fail}` | `pass` | Overall readiness flag | |
| `created_at` | Auditing | timestamp | | Yes | system | Auto system timestamp | Valid timestamp | Reject if invalid | ISO timestamp | `2024-12-06T10:30:00Z` | Row creation time | |
| `created_by` | Auditing | text | | Yes | system | Auto from auth context | Must match known user/service | Reject if invalid | User/service ID | `autofill_eia_direct` | Who/what created this row. For autofill: `autofill_eia_direct`, `autofill_name_address`, `autofill_latlon`, `csv_import`, `template_create`. | |
| `last_updated` | Auditing | timestamp | | No | system | Auto on update | Valid timestamp | None | ISO timestamp | `2024-12-06T14:45:00Z` | Last modification time | |
| `notes` | Notes | text | | No | client | Manual entry | Free text; ideally <= 4000 chars | Truncate if too long, `validation_status='warn'` | Any free text | `Phase 1 of 2` | Free-form notes | `notes` |

### Template & Traceability Fields *(added 2026-02)*

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `template_id` | Traceability | uuid | | No | system | Set when asset created from template | Must exist in `asset_templates` if non-null | None | UUID or NULL | `a0000001-0000-4000-8000-000000000002` | Reference to source template; NULL for non-template assets | |
| `is_prospective` | Classification | boolean | | No | system | Set based on creation context | Boolean | Default to FALSE | `{TRUE, FALSE}` | `FALSE` | TRUE for hypothetical/screening sites; FALSE for real assets | |
| `creation_method` | Traceability | text | | No | system | Auto-set during creation | Should match `creation_method_lookup` | Default to NULL | See lookup table | `eia_direct` | How this asset was created: `csv_import`, `eia_direct`, `name_address`, `latlon`, `template`, `manual`, `api` | |

**Setting `is_prospective`:** (1) **Template creation** — `create_from_template` sets `is_prospective = TRUE`. (2) **Autofill (EIA / name / latlon)** — use `--prospective` when adding or updating: `python -m scripts.asset_registry_autofill.autofill_script --plant-id <id> --portfolio <name> --apply --prospective`. (3) **Existing asset** — set or clear by slug: `python -m asset_registry_autofill.set_asset_prospective --slug <asset_slug> --set-prospective true|false` (default DB: GCS; use `--db <path>` for local, `--no-upload` to skip uploading after GCS download).

### Financial / Risk Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `asset_exposure` | Financial | numeric | $ | No | derived, client | Auto-calculated from capacity or manual override | If non-null, must be >= 0 | `validation_status='warn'` if negative | `>= 0` | `151426000.0` | Asset exposure value in **USD**. Auto-calculated: Solar = 1483 * ac_capacity_mw * 1000; Wind = 1666 * ac_capacity_mw * 1000. Can be manually overridden. | `replacement_cost` |

---

## 💲 Table 2: `asset_price` (Pricing Linkage / Market Config)

This table is physically present in the DB and is the canonical home for pricing linkage fields:
`iso`, `resource_node`, `fallback_resource_node_1/2`, `hub_node`, `price_strategy`, `validation_status`, `notes`.

See the dedicated “Pricing Table — `asset_price`” section above for the detailed field dictionary.

---

## 🧩 Table 3: `portfolios` (Grouping)

Physically present table:
- `portfolios(id, name)`

---

## 🧩 Table 4: `portfolio_assets` (Join Table)

Physically present table:
- `portfolio_assets(portfolio_id, asset_id)` with composite primary key `(portfolio_id, asset_id)`

---

## ☀️ Table 5: `solar_asset` (Solar-Specific Fields)

**Primary Key:** `asset_id` (UUID, references `asset.asset_id`)

### Identifier & Location Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `asset_id` | Identifier | uuid | | Yes | infrasuredb | Reference from `asset` | Must match existing `asset.asset_id`; immutable | Reject if missing/invalid | Any valid UUID | `(uuid)` | FK to core `asset` row | |
| `latitude_eia` | Location | numeric | degrees | No | eia | Import from EIA | Between -90 and 90 | Reject if invalid | `[-90, 90]` | `32.71561` | Solar-specific EIA reference latitude for traceability | |
| `longitude_eia` | Location | numeric | degrees | No | eia | Import from EIA | Between -180 and 180 | Reject if invalid | `[-180, 180]` | `-101.92652` | Solar-specific EIA reference longitude for traceability | |

### Capacity Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `dc_capacity_mw` | System | numeric(10,3) | MW | Conditional | eia | Import from EIA | If non-null, must be > 0 | `validation_status='fail'` if both DC and AC missing | `> 0` or NULL | `130.500` | DC nameplate capacity | `dc_capacity_mw` |
| `ac_capacity_mw` | System | numeric(10,3) | MW | Yes | eia | Import from EIA | Must be > 0 for modeled assets | `validation_status='fail'` if missing/invalid | `> 0` | `102.000` | AC nameplate capacity | `ac_capacity_mw` |
| `dc_ac_ratio` | System | numeric(4,2) | ratio | No | manual, model | Fixed value or derived | If non-null, within `0.8–1.8` | Default to `1.20` if missing when needed; clamp if out of range | `0.8–1.8` | `1.28` | DC/AC ratio | |

### System Configuration Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `system_type` | System | text | | Yes | eia | Import from EIA (normalized) | Must be one of allowed values | Default to `single_axis_tracking` if missing, `validation_status='warn'` | `{fixed, single_axis_tracking, dual_axis_tracking}` | `single_axis_tracking` | Mounting/tracking type | `system_type` |
| `azimuth_angle_deg` | System | smallint | degrees | Conditional | eia | Import from EIA | Required for fixed systems; `0–360` | Default to `180` if missing for fixed, `validation_status='warn'` | `0–360` | `180` | Panel azimuth (south=180 in N hemisphere) | `azimuth_angle` |
| `tilt_angle_deg` | System | smallint | degrees | Conditional | eia | Import from EIA | Required for fixed systems; `0–90` | Default to `30` if missing for fixed, `validation_status='warn'` | `0–90` | `25` | Panel tilt angle | `tilt_angle` |

### Equipment Fields (CEC Database Integration)

These fields enable manufacturer-specific modeling using the CEC (California Energy Commission) database via pvlib. **Schema:** `inverter_model` and `module_model` are part of the canonical `solar_asset` table; autofill ensures both columns exist (adds them if missing) and leaves values NULL when not provided by enriched data or manual entry.

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `inverter_model` | Equipment | text | | No | client, manual | Manual entry or catalog lookup | If non-null, should match CEC database key | Fall back to generic efficiency formula if NULL or not found | CEC inverter name or NULL | `TMEIC__PVH_L3200GR__600V_` | CEC inverter database lookup key. When specified, enables manufacturer-specific efficiency curves via `pvlib.pvsystem.retrieve_sam('CECInverter')`. If NULL, code uses generic efficiency formula. | |
| `module_model` | Equipment | text | | No | client, manual | Manual entry or catalog lookup | If non-null, should match CEC database key | Fall back to default temp coefficients if NULL or not found | CEC module name or NULL | `Canadian_Solar_Inc__CS6X_300P` | CEC module database lookup key. When specified, enables manufacturer-specific temperature coefficients (gamma_pmp, alpha_sc, beta_voc) via `pvlib.pvsystem.retrieve_sam('CECMod')`. If NULL, code uses default `-0.0045` temp coefficient. | |

**References:**
- [pvlib CEC Database Access](https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.pvsystem.retrieve_sam.html)
- [CEC Inverter List](https://www.energy.ca.gov/programs-and-topics/programs/solar-equipment-lists)
- Database contains 3,264 inverters and thousands of modules with manufacturer-validated parameters

**How to find valid values:**
```python
import pvlib

# List all inverters (3,264 models)
cec_inv = pvlib.pvsystem.retrieve_sam('CECInverter')
print(cec_inv.columns.tolist())  # All valid inverter_model values

# List all modules
cec_mod = pvlib.pvsystem.retrieve_sam('CECMod')
print(cec_mod.columns.tolist())  # All valid module_model values

# Search for specific manufacturer
[name for name in cec_inv.columns if 'TMEIC' in name]
[name for name in cec_mod.columns if 'Canadian' in name]
```

### Environment Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `albedo` | Environment | numeric(4,3) | fraction | No | manual, model | Fixed value | If non-null, within `0.00–0.90` | Default to `0.20` if missing; clamp if out of range | `0.00–0.90` | `0.200` | Ground albedo | `albedo` |
| `linke_turbidity` | Environment | numeric(4,1) | | No | manual, model | Fixed value | If non-null, within `1.0–10.0` | Default to `2.5` if missing; clamp if out of range | `1.0–10.0` | `2.5` | Linke turbidity factor | `linke_turbidity` |
| `temp_coefficient_power` | System | numeric(6,4) | 1/°C | No | manual, model | Fixed value | If non-null, within `-0.010–0.000` | Default to `-0.004` if missing; clamp if out of range | `-0.010–0.000` | `-0.0040` | Power temperature coefficient | `temp_coefficient_power` |
| `ref_temp_c` | Environment | numeric(5,1) | °C | No | manual, model | Fixed value | If non-null, within `-50–80` | Default to `25` if missing | `-50–80` | `25.0` | Reference temperature | `ref_temp` |

### Soiling Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `soiling_daily_rate` | Environment | numeric(8,6) | fraction/day | No | manual, model | Fixed value | If non-null, within `0.0000–0.0100` | Default to `0.0002` if missing; clamp if out of range | `0.0000–0.0100` | `0.0002` | Daily soiling accumulation rate | `soiling_daily_rate` |
| `rain_clean_threshold_mm` | Environment | numeric(6,2) | mm/day | No | manual, model | Fixed value | If non-null, within `0–200` | Default to `1.0` if missing; clamp if out of range | `0–200` | `1.0` | Rain threshold for soiling reset | `rain_clean_threshold` |
| `soiling_max_loss_pct` | Environment | numeric(4,2) | % | No | manual, model | Fixed value | If non-null, within `0–40` | Default to `15` if missing; clamp if out of range | `0–40` | `15.0` | Max seasonal soiling loss cap | `soiling_max_loss` |
| `soiling_seasonal_adjust` | Environment | boolean | | No | manual, model | Fixed value | Boolean | Default to `TRUE` if missing | `{TRUE, FALSE}` | `TRUE` | Apply seasonal soiling adjustment | `soiling_seasonal_adjust` |

### Loss Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `loss_dc_wiring` | System | numeric(5,3) | fraction | No | manual, model | Fixed value | If non-null, within `0.90–1.00` | Default to `0.98` if missing; clamp if out of range | `0.90–1.00` | `0.980` | DC wiring loss fraction | `loss_dc_wiring` |
| `loss_ac_wiring` | System | numeric(5,3) | fraction | No | manual, model | Fixed value | Same as above | Same as above | `0.90–1.00` | `0.990` | AC wiring loss fraction | `loss_ac_wiring` |
| `loss_mismatch` | System | numeric(5,3) | fraction | No | manual, model | Fixed value | Same as above | Same as above | `0.90–1.00` | `0.980` | Module mismatch loss | `loss_mismatch` |
| `loss_nameplate` | System | numeric(5,3) | fraction | No | manual, model | Fixed value | Same as above | Same as above | `0.90–1.00` | `0.990` | Nameplate bias loss | `loss_nameplate` |
| `loss_transformer` | System | numeric(5,3) | fraction | No | manual, model | Fixed value | Same as above | Same as above | `0.90–1.00` | `0.985` | Transformer loss | `loss_transformer` |

### Model Control Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `altitude_m` | Location | numeric | m | No | client, derived | User input or derived from coordinates | Numeric if provided | NULL if missing | Reasonable elevation | `912` | Site elevation above sea level; used for air density adjustments | `altitude` |
| `notes` | Notes | text | | No | manual | Manual entry | Free text; ideally <= 4000 chars | Truncate if too long | Any free text | `Bifacial modules installed 2023` | Solar-specific notes | `notes` |

---

## 🌪️ Table 6: `wind_asset` (Wind-Specific Fields)

**Primary Key:** `asset_id` (UUID, references `asset.asset_id`)

### Identifier & Location Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `asset_id` | Identifier | uuid | | Yes | infrasuredb | Reference from `asset` | Must match existing `asset.asset_id`; immutable | Reject if missing/invalid | Any valid UUID | `(uuid)` | FK to core `asset` row | |
| `latitude_eia` | Location | numeric | degrees | No | eia | Import from EIA | Between -90 and 90 | Reject if invalid | `[-90, 90]` | `34.50000` | Wind-specific EIA reference latitude for traceability | |
| `longitude_eia` | Location | numeric | degrees | No | eia | Import from EIA | Between -180 and 180 | Reject if invalid | `[-180, 180]` | `-103.20000` | Wind-specific EIA reference longitude for traceability | |

### Capacity Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `dc_capacity_mw` | System | numeric(10,3) | MW | No | eia, model | Import or derived | If non-null, must be > 0 | Clear if invalid, rely on AC | `> 0` or NULL | `130.500` | Optional DC capacity (for future DC-side modeling) | |
| `ac_capacity_mw` | System | numeric(10,3) | MW | Yes | eia | Import from EIA | Must be > 0 for modeled assets | `validation_status='fail'` if missing/invalid | `> 0` | `200.000` | AC nameplate capacity | `nameplate_capacity_mw` |
| `dc_ac_ratio` | System | numeric(4,2) | ratio | No | manual, model | Fixed value | If non-null, within `0.8–1.8` | Default to `1.20` if needed; clamp if out of range | `0.8–1.8` | `1.20` | DC/AC ratio (symmetric with solar) | |

### Turbine Specification Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `turbine_model` | System | text | | Yes | eia, uswtdb | Import from EIA/catalog | Must map to valid turbine entry | If missing, try `fallback_turbine_model`; if both fail, `validation_status='fail'` | Controlled vocabulary | `DOE_GE_1.5MW_77` | Primary turbine model for power curves | `turbine_model` |
| `fallback_turbine_model` | System | text | | Yes | uswtdb, manual | Import from USWTDB or manual | Should map to unified curves dataset | If primary invalid but fallback valid, use fallback | Controlled vocabulary | `Vestas_V82` | Fallback if primary lacks curves | `fallback_turbine_model` |
| `turbine_manufacturer` | System | text | | Yes | uswtdb | Import from USWTDB | Must be from controlled manufacturer list | `validation_status='warn'` if missing; try backfill from catalog | Controlled vocabulary | `GE Wind` | Manufacturer name | `turbine_manufacturer` |
| `turbine_model_uswtdb` | System | text | | No | uswtdb | Import from USWTDB | If non-null, must match canonical USWTDB identifier | `validation_status='warn'` if invalid | Controlled vocabulary | `GE1.62-87` | USWTDB canonical model ID | `turbine_model_uswtdb` |
| `turbine_rated_power_kw` | System | integer | kW | Yes | uswtdb | Import from USWTDB/catalog | Must be integer > 0 | Backfill from catalog; if still missing, `validation_status='fail'` | `> 0` | `1620` | Rated power per turbine | `turbine_rated_power_kw` |
| `turbine_height_m` | System | smallint | m | Yes | uswtdb | Import from USWTDB/catalog | Must be in `10–200` m | Backfill from catalog; clamp if out of range, `validation_status='warn'` | `10–200` | `80` | Hub height | `turbine_height` |
| `rotor_diameter_m` | System | numeric(6,2) | m | No | uswtdb | Import from USWTDB/catalog | If non-null, within `30–200` m | Derive from swept area if missing; clamp if out of range | `30–200` | `87` | Rotor diameter | `rotor_diameter_m` |
| `rotor_swept_area_m2` | System | numeric(10,1) | m² | No | uswtdb | Import from USWTDB/catalog | If non-null, > 0 | Derive from diameter if missing | `> 0` | `5944.7` | Rotor swept area | `rotor_swept_area_m2` |
| `tip_height_m` | System | numeric(6,1) | m | No | uswtdb | Import from USWTDB/catalog | If non-null, > 0 | `validation_status='warn'` if inconsistent with hub + radius | `> 0` | `123.4` | Blade tip height | `tip_height_m` |
| `n_turbines` | System | integer | | Yes | eia | Import from EIA | Must be integer >= 1 | `validation_status='fail'` if missing or < 1 | `>= 1` | `95` | Number of turbines in farm | `n_turbines` |

### USWTDB Linkage

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `uswtdb_case_ids` | Identifier | text | | No | uswtdb | Import from USWTDB | JSON array of valid case_ids | `validation_status='warn'` if invalid format | JSON array | `["12345", "12346", "12347"]` | Individual turbine IDs from USWTDB for detailed analysis | |

### Model Control Fields

| Field | Field Category | Type | Units | Required? | Source | Fill Method | Validation Rules | Error Handling | Expected Values | Example | Notes | Legacy Field |
|-------|----------------|------|-------|-----------|--------|-------------|------------------|----------------|-----------------|---------|-------|--------------|
| `altitude_m` | Location | numeric | m | No | client, derived | User input or derived from coordinates | Numeric if provided | NULL if missing | Reasonable elevation | `912` | Site elevation above sea level; used for air density adjustments | `altitude` |
| `loss_percent` | System | numeric(5,2) | % | Yes | model | Fixed value | If non-null, within `0–50` | Default to `10` if missing; clamp if out of range | `0–50` | `10.0` | Aggregate farm-level loss | `loss_percent` |
| `rho_reference_kgm3` | System | numeric(5,3) | kg/m³ | Yes | model | Fixed value | Within `0.5–1.5` | Default to `1.225` if missing; clamp if out of range | `0.5–1.5` | `1.225` | Reference air density | `rho_reference` |
| `batch_size` | Model Control | integer | | Yes | model | Fixed value | Integer >= 1 | Default to `500` if missing | `>= 1` | `500` | Processing batch size | `batch_size` |
| `n_intrahour_samples` | Model Control | integer | | Yes | model | Fixed value | Integer in `1–60` | Default to `10` if missing | `1–60` | `10` | Intrahour temporal resolution | `n_intrahour_samples` |
| `notes` | Notes | text | | No | manual | Manual entry | Free text; ideally <= 4000 chars | Truncate if too long | Any free text | `Partial repower in 2022` | Wind-specific notes | `notes` |

---

## 📐 Table 7: `calibration_factors` (Monthly Calibration Factors)

**Purpose:** Store 12-month multiplicative adjustment factors derived from EIA actuals vs model output comparison. Used by forecast simulation to correct systematic model bias.

**Primary Key:** `calibration_id` (UUID, auto-generated)

### Relationship Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       calibration_factors                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ calibration_id (PK)     ← auto-generated UUID                                │
│ scope_type              ← 'asset', 'iso_asset_type', 'state_asset_type',    │
│                           'national_asset_type'                              │
│ scope_key               ← asset_slug or composite key (e.g., 'ERCOT_wind')  │
│ asset_type              ← 'solar' or 'wind'                                  │
│ asset_id (FK, optional) ← NULL for regional/national, UUID for site-specific │
│                                                                              │
│ factor_jan ... factor_dec ← monthly multiplicative factors                   │
│                                                                              │
│ confidence, n_months_used, calibration_source, version, is_active, ...       │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │ Lookup hierarchy (fallback order)          │
        │                                            │
        │ 1. asset (scope_key = asset_slug)          │
        │ 2. iso_asset_type (scope_key = ISO_type)   │
        │ 3. state_asset_type (scope_key = ST_type)  │
        │ 4. national_asset_type (scope_key = nat)   │
        └────────────────────────────────────────────┘
```

### Identifier Fields

| Field | Type | Required? | Description | Example |
|-------|------|-----------|-------------|---------|
| `calibration_id` | uuid | Yes | Auto-generated primary key | `uuid-001` |
| `scope_type` | text | Yes | Lookup hierarchy level: `asset`, `iso_asset_type`, `state_asset_type`, `national_asset_type` | `asset` |
| `scope_key` | text | Yes | Primary lookup key (asset_slug or composite like `ERCOT_wind`) | `lakota_wind_wind_farm` |
| `asset_type` | text | Yes | Technology type: `solar` or `wind` | `wind` |
| `asset_id` | uuid | No | Optional FK to `asset.asset_id` for direct SQL joins; NULL for fallback rows | `eb06be74-...` |

### Monthly Factor Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `factor_jan` | numeric(5,3) | January multiplicative factor (0.6–1.4) | `0.968` |
| `factor_feb` | numeric(5,3) | February multiplicative factor | `0.976` |
| `factor_mar` | numeric(5,3) | March multiplicative factor | `1.021` |
| `factor_apr` | numeric(5,3) | April multiplicative factor | `1.081` |
| `factor_may` | numeric(5,3) | May multiplicative factor | `1.099` |
| `factor_jun` | numeric(5,3) | June multiplicative factor | `1.064` |
| `factor_jul` | numeric(5,3) | July multiplicative factor | `0.935` |
| `factor_aug` | numeric(5,3) | August multiplicative factor | `0.939` |
| `factor_sep` | numeric(5,3) | September multiplicative factor | `0.969` |
| `factor_oct` | numeric(5,3) | October multiplicative factor | `1.035` |
| `factor_nov` | numeric(5,3) | November multiplicative factor | `1.122` |
| `factor_dec` | numeric(5,3) | December multiplicative factor | `1.067` |

**Factor interpretation:**
- `factor = 1.0` → Model matches actuals (no adjustment)
- `factor < 1.0` → Model over-predicts (reduce output)
- `factor > 1.0` → Model under-predicts (increase output)

### Metadata Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `confidence` | text | Data confidence: `high` (3+ yrs), `medium` (1-2 yrs), `low` (fallback) | `high` |
| `n_months_used` | integer | Number of valid month-observations used | `171` |
| `n_sites_used` | integer | Number of sites (for regional/national fallbacks) | `22` |
| `calibration_source` | text | How computed: `site_specific`, `iso_fallback`, `state_fallback`, `national_fallback` | `site_specific` |
| `avg_mape_before` | numeric(5,1) | MAPE before calibration (%) | `12.5` |
| `avg_mape_after` | numeric(5,1) | MAPE after calibration (%) | `8.2` |

### Versioning Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `version` | text | Version identifier | `v1.0` |
| `is_active` | boolean | Only active rows are used in lookups | `TRUE` |
| `valid_from` | date | Start of validity period | `2026-01-01` |
| `valid_to` | date | End of validity period (NULL = current) | NULL |
| `created_at` | timestamp | Row creation time | `2026-02-02T16:00:00Z` |
| `created_by` | text | Who created this row | `calibration_sync` |
| `notes` | text | Warnings about factor quality | `3 months capped` |

### Fallback Hierarchy

When the forecast simulation loads generation data, it performs this hierarchical lookup:

```
1. Site-specific  →  scope_key = asset_slug
       ↓ (not found)
2. ISO fallback   →  scope_key = "{iso}_{asset_type}" (e.g., ERCOT_wind)
       ↓ (not found)
3. State fallback →  scope_key = "{state}_{asset_type}" (e.g., TX_wind)
       ↓ (not found)
4. National       →  scope_key = "national_{asset_type}"
```

### Example Queries

```sql
-- Get active factors for a site
SELECT * FROM calibration_factors 
WHERE scope_key = 'lakota_wind_wind_farm' 
  AND is_active = TRUE;

-- Get all wind fallbacks
SELECT scope_type, scope_key, confidence, factor_jan, factor_jul
FROM calibration_factors
WHERE asset_type = 'wind' AND is_active = TRUE
ORDER BY scope_type;
```

### Related Documentation

- **Scripts:** `scripts/calibration/` (compute_factors.py, sync_to_gcs.py)
- **Usage:** `scripts/forecast_simulation/readers.py` → `load_calibration_factors()`
- **Spec:** `local_docs/plans/calibration/monthly_calibration_spec.md`

---

## 📐 Table 8: `asset_templates` (Standard Asset Configurations) *(added 2026-02)*

**Purpose:** Store predefined standard configurations for creating prospective/hypothetical assets. Enables quick creation of screening sites without manual specification of all technical parameters.

**Primary Key:** `template_id` (UUID)

### Core Fields

| Field | Type | Required? | Description | Example |
|-------|------|-----------|-------------|---------|
| `template_id` | uuid | Yes | Primary key | `a0000001-0000-4000-8000-000000000002` |
| `template_name` | text | Yes | Human-readable name | `Standard 100MW Solar - Single Axis Tracking` |
| `template_slug` | text | Yes | URL-safe identifier (unique) | `std_solar_100mw_sat` |
| `asset_type` | text | Yes | `solar` or `wind` | `solar` |
| `description` | text | No | Detailed description | `Industry-standard utility-scale solar...` |

### Capacity Defaults

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `default_ac_capacity_mw` | decimal(10,3) | Default AC capacity | `100.0` |
| `default_dc_capacity_mw` | decimal(10,3) | Default DC capacity | `125.0` |
| `default_dc_ac_ratio` | decimal(4,2) | Default DC/AC ratio | `1.25` |

### Solar-Specific Defaults (NULL for wind templates)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `default_system_type` | text | `fixed`, `single_axis_tracking`, `dual_axis_tracking` | `single_axis_tracking` |
| `default_tilt_angle_deg` | smallint | Panel tilt (0 for tracking) | `0` |
| `default_azimuth_angle_deg` | smallint | Panel azimuth (0 for tracking) | `0` |
| `default_albedo` | decimal(4,3) | Ground albedo | `0.20` |
| `default_linke_turbidity` | decimal(4,1) | Atmospheric turbidity | `2.5` |
| `default_temp_coefficient_power` | decimal(6,4) | Power temp coefficient | `-0.004` |
| `default_ref_temp_c` | decimal(5,1) | Reference temperature | `25.0` |
| `default_soiling_daily_rate` | decimal(8,6) | Soiling rate per day | `0.0002` |
| `default_rain_clean_threshold_mm` | decimal(6,2) | Rain threshold for cleaning | `1.0` |
| `default_soiling_max_loss_pct` | decimal(4,2) | Max soiling loss % | `15.0` |
| `default_soiling_seasonal_adjust` | boolean | Seasonal soiling adjustment | `TRUE` |
| `default_loss_*` | decimal(5,3) | Various loss factors | `0.98` |

### Wind-Specific Defaults (NULL for solar templates)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `default_turbine_model` | text | Primary turbine model | `Generic_4MW_120m` |
| `default_fallback_turbine_model` | text | Fallback model | `DOE_4MW_100` |
| `default_turbine_manufacturer` | text | Manufacturer name | `Generic` |
| `default_turbine_height_m` | smallint | Hub height | `100` |
| `default_rotor_diameter_m` | decimal(6,2) | Rotor diameter | `120.0` |
| `default_turbine_rated_power_kw` | integer | Power per turbine | `4000` |
| `default_n_turbines` | integer | Number of turbines | `25` |
| `default_loss_percent` | decimal(5,2) | Farm-level loss | `10.0` |

### Metadata

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `is_active` | boolean | Whether template is available | `TRUE` |
| `created_at` | timestamp | Creation time | `2026-02-05T10:00:00Z` |
| `created_by` | text | Creator | `migration_004` |
| `notes` | text | Additional notes | |

### Standard Templates

| Slug | Type | AC MW | Description |
|------|------|-------|-------------|
| `std_solar_50mw_sat` | solar | 50 | Single-axis tracking, 1.25 DC/AC |
| `std_solar_100mw_sat` | solar | 100 | Single-axis tracking, 1.25 DC/AC |
| `std_solar_200mw_sat` | solar | 200 | Single-axis tracking, 1.25 DC/AC |
| `std_solar_100mw_fixed` | solar | 100 | Fixed tilt (25°), south-facing |
| `std_wind_100mw_25turbines` | wind | 100 | 25 × 4MW generic turbines |
| `std_wind_200mw_50turbines` | wind | 200 | 50 × 4MW generic turbines |

### CLI Usage

```bash
# List available templates
python -m scripts.asset_registry_autofill.create_from_template --list-templates

# Create prospective solar site
python -m scripts.asset_registry_autofill.create_from_template \
    --template std_solar_100mw_sat \
    --lat 35.5 --lon -100.2 \
    --portfolio "2026_Screening" \
    --apply

# Create with custom capacity
python -m scripts.asset_registry_autofill.create_from_template \
    --template std_wind_100mw_25turbines \
    --lat 32.1 --lon -101.5 \
    --override-ac-capacity 150 \
    --name "West Texas Wind Project" \
    --portfolio "2026_Screening" \
    --apply
```

---

## 🔮 Future (Not in DB Yet): `battery_asset` (Battery-Specific Fields)

**Primary Key:** `asset_id` (UUID, references `asset.asset_id`)

*Schema to be defined when battery modeling is implemented. Placeholder fields:*

| Field | Field Category | Type | Units | Required? | Notes |
|-------|----------------|------|-------|-----------|-------|
| `asset_id` | Identifier | uuid | | Yes | FK to `asset` |
| `generator_id_eia` | Identifier | text | | Conditional | EIA Generator ID (Form 860 Schedule 6.2) |
| `latitude` | Location | numeric | degrees | Yes | Modeling latitude |
| `longitude` | Location | numeric | degrees | Yes | Modeling longitude |
| `storage_capacity_mwh` | System | numeric | MWh | Yes | Energy storage capacity |
| `power_rating_mw` | System | numeric | MW | Yes | Charge/discharge rate |
| `duration_hours` | System | numeric | hours | No | Derived or explicit |
| `round_trip_efficiency` | System | numeric | fraction | No | Round-trip efficiency |

---

## Coordinate Fill Logic

```
On EIA Import:
1. Set asset.latitude = canonical latitude (default from EIA initially)
2. Set asset.longitude = canonical longitude (default from EIA initially)
3. Set solar_asset.latitude_eia = EIA latitude (reference)
4. Set solar_asset.longitude_eia = EIA longitude (reference)

On USWTDB/USPVDB Enrichment:
1. If better coordinates available:
   - Update asset.latitude / asset.longitude to improved centroid/coordinates
   - (Keep child `*_latitude_eia`/`*_longitude_eia` unchanged for traceability)

On Client Override:
1. Client provides precise coordinates
2. Update asset.latitude / asset.longitude
3. (Keep child `*_latitude_eia`/`*_longitude_eia` unchanged for traceability)
```

---

## 📖 Scenarios & Examples

This section illustrates how the **vCurrent physical schema** behaves.

**Key rules (vCurrent):**
- **Canonical modeling coordinates** live on `asset.latitude` / `asset.longitude`
- **EIA reference coordinates** live on the child table (`solar_asset.latitude_eia`, `wind_asset.latitude_eia`)
- **`generator_id_eia` lives on `asset`** (not in child tables)
- Pricing linkage fields live in `asset_price` (1:1 by `asset_id`)

### Scenario 1: Simple Solar Asset (one plant, one generator)

```
asset:
  plant_id_eia=60372
  generator_id_eia="1"
  asset_slug="lamesa_solar"
  latitude=32.715
  longitude=-101.926

solar_asset:
  asset_id=<same uuid>
  latitude_eia=32.715
  longitude_eia=-101.926
  ac_capacity_mw=102.0
```

### Scenario 2: Two generators under the same EIA plant

- EIA: `(plant_id_eia=60372, generator_id_eia="1")` and `(plant_id_eia=60372, generator_id_eia="2")`
- DB: **two `asset` rows** (generator-level), each with its own `solar_asset` row.

### Scenario 3: Pricing linkage (optional)

- If price workflows are enabled, the asset has a 1:1 `asset_price` row (by `asset_id`) with `iso`, node/hub fields, and `price_strategy`.

---

## 🔍 Common Queries Reference

### Find Assets by Client Grouping

```sql
SELECT 
    client_group_name,
    COUNT(*) as n_assets,
    SUM(CASE WHEN asset_type = 'solar' THEN 1 ELSE 0 END) as n_solar,
    SUM(CASE WHEN asset_type = 'wind' THEN 1 ELSE 0 END) as n_wind
FROM asset
WHERE client_group_name IS NOT NULL
GROUP BY client_group_name;
```

### Find All Generators for an EIA Plant

```sql
SELECT 
    a.asset_name,
    a.asset_type,
    a.generator_id_eia as generator_id_eia,
    COALESCE(s.ac_capacity_mw, w.ac_capacity_mw) as capacity_mw
FROM asset a
LEFT JOIN solar_asset s USING (asset_id)
LEFT JOIN wind_asset w USING (asset_id)
WHERE a.plant_id_eia = 60372;
```

### Compare EIA vs Modeling Coordinates

```sql
SELECT 
    a.asset_name,
    a.latitude  AS modeling_lat,
    a.longitude AS modeling_lng,
    s.latitude_eia,
    s.longitude_eia,
    ABS(a.latitude  - s.latitude_eia)  AS lat_diff,
    ABS(a.longitude - s.longitude_eia) AS lng_diff
FROM asset a
JOIN solar_asset s USING (asset_id)
WHERE s.latitude_eia IS NOT NULL
  AND (a.latitude != s.latitude_eia OR a.longitude != s.longitude_eia);
```

### Find Assets Missing Generator ID (Validation Check)

```sql
SELECT a.asset_id, a.asset_name, a.plant_id_eia
FROM asset a
WHERE a.plant_id_eia IS NOT NULL  -- has EIA plant
  AND a.generator_id_eia IS NULL;  -- but missing generator ID
```

---

## ⚠️ Important Nuances & Gotchas

### 1. Generator ID is NOT Globally Unique

- `generator_id_eia = "1"` exists at thousands of plants
- **Always use `(plant_id_eia, generator_id_eia)` tuple for joins**
- The `asset_id` (UUID) is the only truly unique identifier in your system

### 2. EIA Coordinates Are Plant-Level, Not Generator-Level

- A 100-turbine wind farm gets ONE coordinate from EIA
- For accuracy, override in child tables using USWTDB/USPVDB/client data
- Always preserve original EIA coords in `latitude_eia`/`longitude_eia` for traceability

### 3. Hybrid Sites Need Careful Handling

- Same `plant_id_eia` can have solar, wind, AND battery generators
- Each becomes a separate `asset` row with its own child record
- Use `client_group_name` to tie them together for reporting

### 4. `client_group_name` is Optional — Don't Overuse

- Only needed when client's grouping differs from EIA structure
- For simple cases (one plant = one asset), leave it NULL
- Overusing it creates confusion about what's "canonical"

### 5. Validation Status Cascades

- If `solar_asset` or `wind_asset` fails validation, the parent `asset` should also reflect this
- Check validation at both levels before running models

### 6. Non-EIA Assets Are Valid

- International assets, private/behind-the-meter, synthetic test assets
- All EIA fields (`plant_id_eia`, `generator_id_eia`) can be NULL
- Canonical modeling coordinates still live on `asset.latitude` / `asset.longitude`

### 7. ID Normalization Matters

- EIA data may have `"1.0"` vs `"1"` depending on Excel handling
- Always normalize: `str(int(float(id)))` or equivalent
- Store as text to avoid numeric precision issues with IDs like `"GEN01"`

---

## 📚 Lookup Tables (Physical Reference Tables)

These lookup tables define the **allowed values** for categorical fields. As of 2026-02, they are **physical tables** in the database, enabling referential integrity and standardization.

### `asset_type_lookup`

| code | display_name | description |
|------|--------------|-------------|
| `solar` | Solar | Solar photovoltaic generation facility |
| `wind` | Wind | Wind turbine generation facility |
| `hybrid` | Hybrid | Combined solar and wind facility |
| `storage` | Storage | Battery energy storage system |

**Used in:** `asset.asset_type`

---

### `asset_status_lookup`

| code | display_name | description |
|------|--------------|-------------|
| `operating` | Operating | Currently in commercial operation |
| `proposed` | Proposed | Prospective/hypothetical site for screening |
| `under_construction` | Under Construction | Approved and being built |
| `retired` | Retired | No longer in operation |
| `standby` | Standby | Not generating but available |

**Used in:** `asset.asset_status`

---

### `creation_method_lookup` *(added 2026-02)*

Describes **how an asset was created** in the database. Used for traceability.

| code | display_name | description |
|------|--------------|-------------|
| `csv_import` | CSV Import | Bulk imported from CSV file |
| `eia_direct` | EIA Direct | Created directly from EIA Plant ID |
| `name_address` | Name/Address Resolution | Resolved from plant name and address |
| `latlon` | Lat/Lon Resolution | Resolved from latitude/longitude coordinates |
| `template` | Template Create | Created from standard asset template |
| `manual` | Manual Entry | Manually entered by user |
| `api` | API Import | Imported via external API |

**Used in:** `asset.creation_method`, `asset.created_by`

---

### `source_key_lookup`

Describes **where a value came from and how it was produced**. Used for data lineage tracking.

| code | display_name | description |
|------|--------------|-------------|
| `eia860` | EIA-860 | U.S. Energy Information Administration Form 860 |
| `eia861` | EIA-861 | U.S. Energy Information Administration Form 861 |
| `eia923` | EIA-923 | U.S. Energy Information Administration Form 923 |
| `user_provided` | User Provided | Data provided directly by user/client |
| `internal` | Internal | InfraSure internal data |
| `public_record` | Public Record | From public utility records or filings |

**Used in:** `Source` column throughout field definitions

---

### Querying Lookup Tables

```sql
-- List all asset types
SELECT code, display_name, description FROM asset_type_lookup;

-- List all creation methods
SELECT code, display_name, description FROM creation_method_lookup;

-- Validate asset type (join example)
SELECT a.asset_name, a.asset_type, atl.display_name
FROM asset a
JOIN asset_type_lookup atl ON a.asset_type = atl.code;
```

---

## 🔧 Component Schema (Phase 1) *(added 2026-02, v3.3)*

Component-level tracking enables hazard modeling (fragility curves per component), capital allocation, and future equipment-based lookups. Phase 1 is additive: two new tables, no changes to existing tables.

### `component_code_lookup`

Controlled vocabulary for `asset_component.component_code`. Same pattern as other lookup tables.

| Column | Type | Description |
|--------|------|-------------|
| `code` | VARCHAR (PK) | Component code (e.g. `WIND_TOWER`, `SOLAR_INVERTER`) |
| `display_name` | VARCHAR | Human-readable name |
| `description` | VARCHAR | Detailed description |
| `level` | VARCHAR | `component` or `subcomponent` |
| `parent_code` | VARCHAR | Parent component code (NULL for top-level) |
| `applicable_asset_types` | VARCHAR | `wind`, `solar`, or `wind,solar` |
| `typical_capital_pct_low` | DOUBLE | Typical capital % range lower bound |
| `typical_capital_pct_high` | DOUBLE | Typical capital % range upper bound |
| `is_active` | BOOLEAN | Active flag |

### `asset_component`

One row per component instance per asset. Top-level components have `parent_component_id IS NULL`; subcomponents reference their parent. Populated from existing `wind_asset` / `solar_asset` data (migration 009).

| Column | Type | Description |
|--------|------|-------------|
| `component_id` | UUID (PK) | Unique component instance ID |
| `asset_id` | UUID (FK) | FK to `asset.asset_id` |
| `component_code` | VARCHAR | From `component_code_lookup` (e.g. `WIND_NACELLE`) |
| `parent_component_id` | UUID (FK) | Self-ref to `asset_component.component_id`; NULL = top-level |
| `component_name` | VARCHAR | Human-readable name |
| `manufacturer` | VARCHAR | Equipment manufacturer |
| `model` | VARCHAR | Equipment model (links to curves on GCS) |
| `quantity` | INTEGER | Number of units (e.g. n_turbines) |
| `capital_pct` | DOUBLE | % of total asset capital (0.0–1.0) |
| `rated_capacity` | DOUBLE | Rated capacity in standard units |
| `rated_capacity_unit` | VARCHAR | e.g. `kW`, `MW`, `Wp` |
| `specs` | JSON | Component-specific technical details (queryable via `json_extract`) |
| `year_installed` | INTEGER | Optional |
| `notes` | VARCHAR | Optional |
| `created_at` | TIMESTAMP | Row creation time |
| `last_updated` | TIMESTAMP | Last modification time |

**Indexes:** `idx_asset_component_asset_id` on `asset_id`; `idx_asset_component_code` on `component_code`.

**Query interface:** `asset_registry_db.query_interface` → `load_asset_components()`, `get_component_code_lookup()`.

---

*Document version: 3.3*  
*Last updated: February 23, 2026*  
*For InfraSure internal reference*

**Changelog (3.3):**
- Added `component_code_lookup` table and ~40 component codes (wind, solar, shared, BESS)
- Added `asset_component` table with FK to `asset` and self-ref for hierarchy
- Migration 009 populates components from existing `wind_asset` / `solar_asset` data
- Added `load_asset_components()` and `get_component_code_lookup()` in query_interface.py
- Clarified `solar_asset.inverter_model` and `module_model` as canonical columns (autofill ensures they exist; values NULL unless from manual/catalog)

**Changelog (3.2):**
- Added `asset_templates` table for standard asset configurations
- Added `template_id`, `is_prospective`, `creation_method` columns to `asset` table
- Converted lookup tables from documentation artifacts to physical tables
- Added `creation_method_lookup` table
- Updated `source_key_lookup` values
- Fixed `asset_exposure` to use integer rounding (avoid floating-point artifacts)
- Updated `created_by` field to reflect actual creation method


