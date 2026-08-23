import type { ReactNode } from "react";

/**
 * The agent writes markdown, so a bubble that renders plain text shows people
 * `**Bring with you**` and a row of hyphens. This covers the subset it actually
 * emits -- headings, bullets, numbered lists, bold/italic/code -- and returns
 * React elements rather than HTML, so there's no innerHTML to sanitise.
 *
 * Deliberately not a full markdown implementation: no tables, links or block
 * quotes, because the assistant doesn't produce them and every extra rule is
 * another way to mis-parse someone's message.
 */

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    return <span key={key}>{part}</span>;
  });
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*(#{1,4})\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(" ").trim();
    if (joined) blocks.push(<p key={`p${blocks.length}`}>{inline(joined, `p${blocks.length}`)}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={`u${blocks.length}`}>
        {items.map((b, i) => <li key={i}>{inline(b, `u${blocks.length}-${i}`)}</li>)}
      </ul>,
    );
    bullets = [];
  };
  const flushNumbered = () => {
    if (!numbered.length) return;
    const items = numbered;
    blocks.push(
      <ol key={`o${blocks.length}`}>
        {items.map((b, i) => <li key={i}>{inline(b, `o${blocks.length}-${i}`)}</li>)}
      </ol>,
    );
    numbered = [];
  };
  const flushAll = () => { flushParagraph(); flushBullets(); flushNumbered(); };

  for (const line of lines) {
    if (!line.trim()) { flushAll(); continue; }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      blocks.push(
        <p key={`h${blocks.length}`} className="md-heading">
          {inline(heading[2], `h${blocks.length}`)}
        </p>,
      );
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) { flushParagraph(); flushNumbered(); bullets.push(bullet[1]); continue; }

    const num = NUMBERED.exec(line);
    if (num) { flushParagraph(); flushBullets(); numbered.push(num[2]); continue; }

    flushBullets();
    flushNumbered();
    paragraph.push(line.trim());
  }
  flushAll();

  return <div className="md">{blocks}</div>;
}
