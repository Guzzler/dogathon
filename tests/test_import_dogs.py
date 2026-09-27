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


# --- PH-28: kept for a foster is not the same as still listed ---------------------------------


class _Snap:
    def __init__(self, doc_id: str, data: dict):
        self.id = doc_id
        self._data = data

    def to_dict(self) -> dict:
        return dict(self._data)


class _Collection:
    def __init__(self, name: str, docs: dict[str, dict]):
        self.name = name
        self.docs = docs

    def stream(self):
        return [_Snap(i, d) for i, d in self.docs.items()]

    def document(self, doc_id: str):
        return (self.name, doc_id)


class _Batch:
    def __init__(self, log: list):
        self.log = log
        self.ops: list = []

    def delete(self, ref):
        self.ops.append(("delete", ref[1], None))

    def set(self, ref, data):
        self.ops.append(("set", ref[1], data))

    def update(self, ref, data):
        self.ops.append(("update", ref[1], data))

    def commit(self):
        self.log.extend(self.ops)


class _Client:
    """Just enough of the Admin SDK for `_push_to_firestore()`: stream, batch, and a write log."""

    def __init__(self, dogs: dict[str, dict], fosters: dict[str, dict]):
        self.cols = {"dogs": _Collection("dogs", dogs), "fosters": _Collection("fosters", fosters)}
        self.log: list = []

    def collection(self, name: str):
        return self.cols[name]

    def batch(self):
        return _Batch(self.log)


def _push(monkeypatch, client: _Client, roster: list[dict], plan_only: bool) -> list:
    import agent.firestore_client as fc

    monkeypatch.setattr(fc, "db", lambda: client)
    import_dogs._push_to_firestore(roster, plan_only=plan_only)
    return client.log


def _live():
    return _Client(
        dogs={
            "fresh": {"status": "available"},
            "d-026": {"status": "available"},        # gone from the scrape, a foster has it
            "d-kept-foster": {"status": "foster"},    # gone, matched, already not listed
            "d-gone": {"status": "available"},       # gone, nobody has it
        },
        fosters={"a": {"matchedDogId": "d-026"}, "b": {"matchedDogId": "d-kept-foster"}},
    )


def test_a_stale_available_dog_matched_to_a_foster_is_kept_and_delisted(monkeypatch, capsys):
    log = _push(monkeypatch, _live(), [{"id": "fresh", "status": "available"}], plan_only=False)
    assert ("update", "d-026", {"status": "retired"}) in log
    assert not any(op[1] == "d-026" and op[0] == "delete" for op in log)
    # Already off the listings: its status is the shelter's word and is left alone.
    assert not any(op[1] == "d-kept-foster" for op in log)
    assert "(delisted: ['d-026'])" in capsys.readouterr().out


def test_a_stale_unmatched_dog_is_still_deleted(monkeypatch):
    log = _push(monkeypatch, _live(), [{"id": "fresh", "status": "available"}], plan_only=False)
    assert ("delete", "d-gone", None) in log


def test_plan_only_reports_the_delisting_and_writes_nothing(monkeypatch, capsys):
    log = _push(monkeypatch, _live(), [{"id": "fresh", "status": "available"}], plan_only=True)
    assert log == []
    assert "(delisted: ['d-026'])" in capsys.readouterr().out
