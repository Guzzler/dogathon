"""The agent's foster-writing tools write only what a screen already writes (PH-26).

Every write an agent tool makes must already be a write some screen makes, with the
same fields, guards and side effects. Two tools didn't: `record_swipe(liked=True)`
set `matchedDogId` and `phase` -- an application with no `applications` document, so
no shelter inbox ever saw it -- and `save_intake` rewrote all six answers, blanking
the ones it wasn't given and sending a matched foster back to Discovery. The first is
narrowed to Discovery's swipe; the second has no screen twin and is gone.
"""

from __future__ import annotations

import re
from pathlib import Path

from agent.builtin import adoption, care, foster, shelter
from agent.tools import Registry

FOSTER_ID = "f-200"
PATH = f"fosters/{FOSTER_ID}"
PANEL = Path(__file__).resolve().parents[1] / "web" / "src" / "components" / "AgentChatPanel.tsx"


def _builtin() -> Registry:
    # `registry()` minus Arcade, which only registers when a key is configured.
    return Registry().add_module(shelter).add_module(foster).add_module(care).add_module(adoption)


def _seed(fake_db, **fields) -> None:
    fake_db.docs[PATH] = {"likedDogIds": [], "passedDogIds": [], **fields}


def test_like_saves_the_dog_and_leaves_the_active_foster_alone(fake_db):
    _seed(fake_db, matchedDogId="d-1", phase="care_plan", passedDogIds=["d-2"])

    foster.record_swipe(foster_id=FOSTER_ID, dog_id="d-2", liked=True)

    doc = fake_db.docs[PATH]
    assert doc["matchedDogId"] == "d-1"
    assert doc["phase"] == "care_plan"
    assert doc["likedDogIds"] == ["d-2"]
    # Discovery's like moves the dog out of the passed list; so does this.
    assert doc["passedDogIds"] == []


def test_like_does_not_start_an_application_from_discovery(fake_db):
    _seed(fake_db, phase="discovery")

    foster.record_swipe(foster_id=FOSTER_ID, dog_id="d-3", liked=True)

    doc = fake_db.docs[PATH]
    assert doc["phase"] == "discovery"
    assert "matchedDogId" not in doc
    # No application document either -- applying is the app's job, with its confirm sheet.
    assert not any(k.startswith("applications/") for k in fake_db.docs)


def test_pass_moves_the_dog_out_of_the_saved_list(fake_db):
    _seed(fake_db, likedDogIds=["d-4", "d-5"])

    foster.record_swipe(foster_id=FOSTER_ID, dog_id="d-4", liked=False)

    doc = fake_db.docs[PATH]
    assert doc["likedDogIds"] == ["d-5"]
    assert doc["passedDogIds"] == ["d-4"]


def test_a_repeated_like_is_not_recorded_twice(fake_db):
    _seed(fake_db, likedDogIds=["d-6"])

    foster.record_swipe(foster_id=FOSTER_ID, dog_id="d-6", liked=True)

    assert fake_db.docs[PATH]["likedDogIds"] == ["d-6"]


def test_there_is_no_intake_writing_tool():
    names = {t.name for t in _builtin()}
    assert "save_intake" not in names
    assert "record_swipe" in names
    assert not hasattr(foster, "save_intake")


def test_the_ui_prompts_for_exactly_the_dangerous_tools():
    """`DEFAULT_DANGEROUS` in AgentChatPanel.tsx mirrors `dangerous=True` here.

    Drift either way is a bug: a stale name is a label for a tool the server no
    longer has, a missing one is a write that runs without the approval modal.
    """
    block = re.search(r"DEFAULT_DANGEROUS\s*=\s*\[(.*?)\]", PANEL.read_text(encoding="utf-8"), re.S)
    assert block, "DEFAULT_DANGEROUS not found in AgentChatPanel.tsx"
    ui = set(re.findall(r'"(\w+)"', block.group(1)))
    server = {t.name for t in _builtin() if t.dangerous}
    assert ui == server
