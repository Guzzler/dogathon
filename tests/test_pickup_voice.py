"""RS-14: the pickup chat is Pawthway's assistant, never the shelter.

The prompt used to tell the agent to answer as the shelter's "foster coordinator", in the
shelter's first-person plural, under the shelter's real name -- so a foster could "agree a
day" with a real organisation in writing and that organisation never learned of it. A model
may talk *about* an organisation; it may never talk *as* one. These assertions pin the
absence, because the next warm rewrite of this paragraph is how it comes back.
"""

from __future__ import annotations

from agent.server import PAWTHWAY_SYSTEM


def test_prompt_does_not_claim_the_shelters_voice() -> None:
    lowered = PAWTHWAY_SYSTEM.lower()
    assert "foster coordinator" not in lowered
    assert "first-person plural" not in lowered
    assert "answer in that voice" not in lowered


def test_prompt_says_the_chat_does_not_reach_the_shelter() -> None:
    lowered = PAWTHWAY_SYSTEM.lower()
    assert "never the shelter" in lowered
    assert "doesn't reach them" in lowered
    # Confirmation is the shelter's write, read on the Match screen -- not the model's to say.
    assert "never confirm it yourself" in lowered
