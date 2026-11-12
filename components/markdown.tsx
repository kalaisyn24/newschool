import type { ReactNode } from "react";

/**
 * Minimal, safe Markdown renderer for lesson texts (no raw HTML):
 * headings (#, ##, ###), paragraphs, bullet/numbered lists, **bold**, *italic*, `code`, [links](https://…).
 */
export function Markdown({ text, className = "prose-lesson" }: { text: string | null | undefined; className?: string }) {
  if (!text?.trim()) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const content = inline(h[2]);
      blocks.push(h[1].length === 1 ? <h2 key={key++} className="text-xl">{content}</h2> : <h3 key={key++}>{content}</h3>);
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*[-*•]\s+/, ""))}</li>);
        i++;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}</li>);
        i++;
      }
      blocks.push(<ol key={key++}>{items}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*•]\s|\s*\d+[.)]\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++}>
        {para.map((p, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </span>
        ))}
      </p>,
    );
  }
  return <div className={className}>{blocks}</div>;
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const label = t.slice(1, t.indexOf("]"));
      out.push(
        <a key={k++} href={m[2]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
