# Aggregated Analysis Notebooks

Notebooks for analysing the **multi-frequency aggregated forecast data** stored in `aggregated_data/` on GCS. These notebooks read from `generation.duckdb` and `revenue.duckdb` produced by the `forecast_simulation/aggregation` pipeline — never from the raw hourly parquets.

---

## Notebooks

### `01_annual_distribution_analysis.ipynb`

Step-by-step annual distribution analysis for a single site/kind/market:

| Step | What it shows |
|------|--------------|
| 1 | Config — set site, kind, market, data source, `N_RECENT` years |
| 2 | Data loading — loads all annual rows from DuckDB |
| 3 | Summary stats — N eligible/excluded, P10/P50/P90/mean for gen + revenue |
| 4 | Generation histogram + Scott KDE (simulated vs historical overlay) |
| 5 | Revenue histogram + Scott KDE + empirical CDF + KS-test (KDE vs empirical) |
| 6 | Gen-weighted price distribution |
| 7 | Historical years on simulated KDE — outlier labels, **simulated mean vs historical mean** vlines, **last N years highlighted** as red ★ with trend vs P50 |
| 8 | Percentile comparison table: KDE vs empirical CDF at P5/P10/P25/P50/P75/P90/P95 |

### `02_monthly_forecast_plots.ipynb`

Monthly generation/revenue band plots with comparison overlays:

| Step | What it shows |
|------|--------------|
| 1 | Config — set site, kind, market, variable (generation/revenue), `N_RECENT_YEARS` |
| 2 | Data loading — loads eligible monthly rows from DuckDB |
| 3 | Monthly aggregation — P10/P25/P50/P75/P90/mean per calendar month |
| 4 | Band plot — P10–P90 + P25–P75 shaded bands + **simulated mean vs historical mean** overlaid as separate lines + diff table |
| 5 | Side-by-side: simulated-only vs historical-only band comparison |
| 6 | **Recent N years** as individual lines on simulated band — per-month % deviation vs P50 table |

---

## Data source

Both notebooks support a **Local / GCS toggle**:

- **GCS (production):** `gs://infrasure-model-gpr-data/aggregated_data/{site}/`
- **Local (testing):** `local_data/aggregated_data/{site}/` relative to repo root

Set at the top of each notebook. GCS requires ADC credentials (`gcloud auth application-default login`).

---

## Dependencies

```
duckdb>=0.9
scipy
plotly
ipywidgets
pandas
numpy
```

All are available in the repo `venv`. Activate with `source venv/bin/activate` then launch Jupyter.

---

## Running notebooks from the CLI (non-interactive execution)

You can execute notebooks headlessly — useful for batch runs, CI checks, or quickly re-generating all outputs after data changes.

### Prerequisites

```bash
cd /path/to/model-gpr
source venv/bin/activate
pip install nbconvert   # one-time; already in venv
```

### Execute a single notebook (overwrites in-place with fresh outputs)

```bash
jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=120 \
  data_analytics_notebooks/aggregated_analysis/01_annual_distribution_analysis.ipynb
```

### Execute both notebooks in one shot

```bash
for nb in \
  data_analytics_notebooks/aggregated_analysis/01_annual_distribution_analysis.ipynb \
  data_analytics_notebooks/aggregated_analysis/02_monthly_forecast_plots.ipynb; do
  echo "Running $nb ..."
  jupyter nbconvert --to notebook --execute --inplace \
    --ExecutePreprocessor.timeout=120 "$nb" && echo "  ✅ done" || echo "  ❌ failed"
done
```

### Clear all outputs before re-running (clean state)

If a notebook has malformed outputs from a previous run, clear them first:

```bash
python3 -c "
import json, pathlib
for nb_file in [
    'data_analytics_notebooks/aggregated_analysis/01_annual_distribution_analysis.ipynb',
    'data_analytics_notebooks/aggregated_analysis/02_monthly_forecast_plots.ipynb',
]:
    nb_path = pathlib.Path(nb_file)
    nb = json.loads(nb_path.read_text())
    for cell in nb['cells']:
        if cell['cell_type'] == 'code':
            cell['outputs'] = []
            cell['execution_count'] = None
        elif 'outputs' in cell:
            del cell['outputs']
    nb_path.write_text(json.dumps(nb, indent=1))
    print(f'Cleared: {nb_file}')
"
```

Then run the notebooks as above.

### Switching between GCS and local

The notebooks default to `SOURCE = "gcs"`. To run against local data without editing the file, patch inline:

```bash
python3 -c "
import json, pathlib
nb_path = pathlib.Path('data_analytics_notebooks/aggregated_analysis/01_annual_distribution_analysis.ipynb')
nb = json.loads(nb_path.read_text())
nb['cells'][1]['source'] = [l.replace('SOURCE = \"gcs\"', 'SOURCE = \"local\"') for l in nb['cells'][1]['source']]
nb_path.write_text(json.dumps(nb, indent=1))
print('Patched to local')
"
# ... run nbconvert ...
# then patch back:
python3 -c "
import json, pathlib
nb_path = pathlib.Path('data_analytics_notebooks/aggregated_analysis/01_annual_distribution_analysis.ipynb')
nb = json.loads(nb_path.read_text())
nb['cells'][1]['source'] = [l.replace('SOURCE = \"local\"', 'SOURCE = \"gcs\"') for l in nb['cells'][1]['source']]
nb_path.write_text(json.dumps(nb, indent=1))
print('Restored to gcs')
"
```

---

## Eligibility filters (what these notebooks use)

Data is pre-filtered by the aggregation pipeline. The notebooks query **only eligible paths**:

- **Annual generation:** `eligible_for_gen_dist = TRUE` — path has ≥95% generation coverage over full horizon
- **Annual revenue:** `eligible_for_rev_dist = TRUE` — path has ≥95% revenue coverage (gen AND price both present) over full horizon
- **Monthly generation/revenue:** same logic but ≥80% per calendar month (DST-aware expected hours)

Partial-year historical paths (e.g. 2025 with only 7 months of ERA5 data) are excluded from annual but present in monthly.

See `docs/layer_1/data_infrastructure/schema/schema_aggregated_data.md` for full details.
