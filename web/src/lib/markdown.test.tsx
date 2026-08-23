import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

/**
 * The parser buffers lines and flushes on a change of block, which is where this kind of
 * code breaks: a list that swallows the sentence introducing it, or one that never closes.
 * Rendering to static markup checks the order the blocks come out in, which is the part a
 * reader notices.
 */
const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe("Markdown", () => {
  it("gathers consecutive bullets into one list, whichever marker the agent used", () => {
    const out = html("- leash and collar\n* a towel\n• proof of address");
    expect(out.match(/<ul>/g)).toHaveLength(1);
    expect(out.match(/<li>/g)).toHaveLength(3);
    expect(out).toContain("proof of address");
  });

  it("strips the numbering from an ordered list rather than printing it twice", () => {
    const out = html("1. Sign the paperwork\n2) Load the carrier");
    expect(out).toContain("<ol>");
    expect(out).not.toContain("1.");
    expect(out).toContain("Load the carrier");
  });

  it("keeps the sentence introducing a list out of the sentence following it", () => {
    const out = html("Bring with you:\n- a leash\nAllow about 30 minutes.");
    expect(out).toBe(
      '<div class="md"><p><span>Bring with you:</span></p><ul><li><span>a leash</span></li></ul>' +
        "<p><span>Allow about 30 minutes.</span></p></div>",
    );
  });

  it("renders bold and code as elements, not literal asterisks and backticks", () => {
    const out = html("**Bring with you** a `carrier`");
    expect(out).toContain("<strong>Bring with you</strong>");
    expect(out).toContain("<code>carrier</code>");
    expect(out).not.toContain("**");
  });

  it("turns a heading into styled text without the hashes", () => {
    const out = html("## What to bring");
    expect(out).toContain('class="md-heading"');
    expect(out).not.toContain("#");
  });

  it("escapes markup in the message instead of rendering it", () => {
    const out = html("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
