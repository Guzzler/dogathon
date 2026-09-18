"""The importer's third outcome: "could not look".

RS-13. The weekly drift check (`.github/workflows/import-dogs.yml`) reports drifted, clean
or unreachable, and it tells the third apart from the first two by this script's exit code
alone -- so the exit code is the contract, and these are its tests. They monkeypatch the
scrape, so they need no network, which is the hard constraint on everything in `tests/`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import import_dogs  # noqa: E402


@pytest.fixture
def committed_roster_is_untouched():
    """Fails if the run being tested wrote to either committed data file.

    The reachable-failure path must leave the roster exactly as it found it: the whole point
    of reporting "unknown" is that nothing was learned, and a half-written dogs.json would
    then be reported as drift by the very next step.
    """
    watched = [import_dogs.DOGS_JSON, import_dogs.RAW, import_dogs.RAW.with_name("sfspca_scrape.json")]
    before = {p: (p.read_bytes() if p.exists() else None) for p in watched}
    yield
    for path, content in before.items():
        after = path.read_bytes() if path.exists() else None
        assert after == content, f"{path.name} was written on a path that must write nothing"


def _run(monkeypatch, scrape, *argv: str) -> int:
    monkeypatch.setattr(import_dogs.sfspca, "scrape", scrape)
    monkeypatch.setattr(sys, "argv", ["import_dogs.py", *argv])
    with pytest.raises(SystemExit) as exit_info:
        import_dogs.main()
    return exit_info.value.code


def test_unreachable_shelter_exits_75(monkeypatch, committed_roster_is_untouched):
    def refused(delay: float = 1.0):
        request = httpx.Request("GET", "https://www.sfspca.org/sfspca-adoption-sitemap.xml")
        raise httpx.HTTPStatusError(
            "Client error '403 Forbidden'", request=request, response=httpx.Response(403, request=request)
        )

    # --dry-run so a regression that got past the guard would still not reach Firestore.
    assert _run(monkeypatch, refused, "--dry-run") == import_dogs.EXIT_UNREACHABLE


def test_a_transport_failure_is_also_unreachable(monkeypatch, committed_roster_is_untouched):
    def timed_out(delay: float = 1.0):
        raise httpx.ConnectTimeout("timed out")

    assert _run(monkeypatch, timed_out, "--dry-run") == import_dogs.EXIT_UNREACHABLE


def test_an_empty_scrape_is_unreachable_not_an_empty_roster(monkeypatch, committed_roster_is_untouched):
    """scrape() swallows per-page errors, so a site refusing everything returns [], not a raise.

    Taking that at face value would replace the roster with nothing and report the emptiness
    as drift -- the loudest possible version of the lie this item exists to remove.
    """
    assert _run(monkeypatch, lambda delay=1.0: [], "--dry-run") == import_dogs.EXIT_UNREACHABLE


def test_a_real_import_error_is_not_reported_as_unreachable(monkeypatch, committed_roster_is_untouched):
    """75 means one thing. Anything else must stay distinguishable, or the workflow's catch
    would swallow a genuine breakage and file it as "we could not look"."""

    def broken(delay: float = 1.0):
        raise ValueError("the sitemap parsed into something unexpected")

    monkeypatch.setattr(import_dogs.sfspca, "scrape", broken)
    monkeypatch.setattr(sys, "argv", ["import_dogs.py", "--dry-run"])
    with pytest.raises(ValueError):
        import_dogs.main()


def test_a_good_scrape_still_exits_zero(monkeypatch, tmp_path):
    """The happy path, pinned so the guards above can't grow into the normal case.

    Everything it writes is redirected into tmp_path, so the committed roster is not
    rebuilt by running the test suite.
    """
    record = {
        "id": "test-dog", "name": "Test", "breed": "Mixed Breed", "url": "https://example.test/d",
        "description": "A dog.", "facts": {}, "photo_urls": [],
    }
    monkeypatch.setattr(import_dogs.sfspca, "scrape", lambda delay=1.0: [record])
    monkeypatch.setattr(
        import_dogs.sfspca, "to_dog",
        lambda r: {"id": r["id"], "name": r["name"], "breed": r["breed"], "notes": "A dog."},
    )
    monkeypatch.setattr(import_dogs, "DOGS_JSON", tmp_path / "dogs.json")
    monkeypatch.setattr(import_dogs, "RAW", tmp_path / "shelter_descriptions.json")
    monkeypatch.setattr(import_dogs, "ENRICHMENT", tmp_path / "enrichment.json")
    monkeypatch.setattr(sys, "argv", ["import_dogs.py", "--dry-run"])

    import_dogs.main()   # no SystemExit at all on the normal path

    assert json.loads((tmp_path / "dogs.json").read_text())[0]["id"] == "test-dog"
