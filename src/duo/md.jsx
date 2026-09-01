/* Just enough Markdown for the Tips & Notes.

   These were written in Duolingo's own editor over about eight years, so the
   markdown is inconsistent: setext headings under rows of dashes, tables with
   no leading pipe, bold inside table cells, the odd stray tag. The renderer
   below handles the subset those notes actually use, and isolates every Hebrew
   run so a right-to-left word inside an English sentence does not drag the
   punctuation around with it. */

import { Fragment } from "react";

const HEB = /[֐-׿]/;

/* inline: **bold**, *italic*, `code`, [text](url), and Hebrew isolation */
function inline(text, keyBase = "i") {
  const out = [];
  const re = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|_[^_\n]+_)/g;
  let last = 0, m, n = 0;
  const plain = (s) => {
    /* split into Hebrew and non-Hebrew runs so each can carry its own
       direction */
    const parts = s.split(/([֐-׿][֐-׿\s"'׳״.,!?()־-]*)/g);
    return parts.filter(Boolean).map((p, i) =>
      HEB.test(p)
        ? <span className="he" key={`${keyBase}-h-${n}-${i}`} dir="rtl" lang="he">{p}</span>
        : <Fragment key={`${keyBase}-t-${n}-${i}`}>{p}</Fragment>
    );
  };
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...plain(text.slice(last, m.index)));
    const tok = m[0];
    n++;
    if (tok.startsWith("***")) out.push(<strong key={`${keyBase}-be${n}`}><em>{plain(tok.slice(3, -3))}</em></strong>);
    else if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-b${n}`}>{plain(tok.slice(2, -2))}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={`${keyBase}-c${n}`}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      out.push(<a key={`${keyBase}-a${n}`} href={href} target="_blank" rel="noreferrer">{plain(label)}</a>);
    } else out.push(<em key={`${keyBase}-e${n}`}>{plain(tok.slice(1, -1))}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(...plain(text.slice(last)));
  return out;
}

const isTableRow = (l) => l.includes("|") && l.trim().length > 1;
const isDivider = (l) => /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(l) && l.includes("-");
const cells = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

export default function Markdown({ text }) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    /* setext heading: a line of text underlined with --- or === */
    if (lines[i + 1] && /^\s*[-=]{3,}\s*$/.test(lines[i + 1]) && !isTableRow(line)) {
      blocks.push(<h3 key={i}>{inline(line.trim(), `h${i}`)}</h3>);
      i += 2;
      continue;
    }

    /* a bare rule */
    if (/^\s*[-*_]{3,}\s*$/.test(line)) { i++; continue; }

    /* atx heading */
    const atx = line.match(/^(#{1,6})\s+(.*)$/);
    if (atx) {
      blocks.push(<h3 key={i}>{inline(atx[2], `h${i}`)}</h3>);
      i++;
      continue;
    }

    /* table: a header row, a divider, then body rows */
    if (isTableRow(line) && lines[i + 1] && isDivider(lines[i + 1])) {
      const head = cells(line);
      const body = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isDivider(lines[j])) {
        body.push(cells(lines[j]));
        j++;
      }
      blocks.push(
        <table key={i}>
          <thead><tr>{head.map((c, k) => <th key={k}>{inline(c, `th${i}-${k}`)}</th>)}</tr></thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>{head.map((_, k) => <td key={k}>{inline(row[k] || "", `td${i}-${r}-${k}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
      i = j;
      continue;
    }

    /* list */
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items = [];
      const ordered = /^\s*\d+\./.test(line);
      let j = i;
      while (j < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        j++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={i}>{items.map((it, k) => <li key={k}>{inline(it, `li${i}-${k}`)}</li>)}</List>
      );
      i = j;
      continue;
    }

    /* blockquote */
    if (/^\s*>/.test(line)) {
      const buf = [];
      let j = i;
      while (j < lines.length && /^\s*>/.test(lines[j])) { buf.push(lines[j].replace(/^\s*>\s?/, "")); j++; }
      blocks.push(<blockquote key={i}>{inline(buf.join(" "), `q${i}`)}</blockquote>);
      i = j;
      continue;
    }

    /* paragraph: run of non-blank lines that are not something else */
    const buf = [];
    let j = i;
    while (
      j < lines.length && lines[j].trim() &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[j]) && !/^#{1,6}\s/.test(lines[j]) &&
      !(lines[j + 1] && isDivider(lines[j + 1]) && isTableRow(lines[j])) &&
      !/^\s*[-*_]{3,}\s*$/.test(lines[j])
    ) { buf.push(lines[j]); j++; }
    if (!buf.length) { i++; continue; }
    blocks.push(<p key={i}>{inline(buf.join(" "), `p${i}`)}</p>);
    i = j;
  }

  return <div className="d-notes">{blocks}</div>;
}
