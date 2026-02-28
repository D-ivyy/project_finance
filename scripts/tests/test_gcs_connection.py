"""
Test GCS connection to gs://infrasure-model-gpr-data.
Requires: gcloud auth application-default login
Run: pytest scripts/tests/test_gcs_connection.py -v
"""
import pytest
from google.cloud import storage

BUCKET_NAME = "infrasure-model-gpr-data"
PROJECT = "infrasure-model-gpr"


@pytest.fixture(scope="module")
def gcs_client():
    return storage.Client(project=PROJECT)


@pytest.fixture(scope="module")
def bucket(gcs_client):
    return gcs_client.bucket(BUCKET_NAME)


def test_gcs_client_connects(gcs_client):
    """Client can be created (credentials valid)."""
    assert gcs_client is not None
    assert gcs_client.project == PROJECT


def test_bucket_exists_and_is_accessible(bucket):
    """Bucket exists and we have read access."""
    assert bucket.exists()


def test_bucket_has_expected_root_content(bucket):
    """Bucket has at least the known root-level asset registry."""
    blobs = list(bucket.list_blobs(max_results=50, delimiter="/"))
    names = [b.name for b in blobs]
    assert "asset_registry.duckdb" in names, f"Expected asset_registry.duckdb in root; got {names[:20]}"


def test_bucket_has_top_level_prefixes(bucket):
    """Bucket has top-level prefixes (folders) as per gcs_bucket_structure.md."""
    it = bucket.list_blobs(max_results=100, delimiter="/")
    list(it)  # consume iterator so .prefixes is populated
    prefixes = getattr(it, "prefixes", set()) or set()
    known = {"generation_data/", "forecast_data/", "revenue_data/", "aggregated_data/", "lmp_prices/"}
    found = [p for p in prefixes if p in known]
    assert len(found) >= 1, f"Expected at least one of {known}; got prefixes: {list(prefixes)[:30]}"
