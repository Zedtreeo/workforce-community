'use client';

import React from 'react';

/**
 * Minimal, dependency-free renderer for the small subset of markdown the
 * assistant emits: paragraphs, bullet/numbered lists, GitHub-style tables and
 * **bold**. Not a full markdown engine — just enough to keep replies readable
 * without pulling in a library.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={`${keyPrefix}-b${i}`}>{p.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${keyPrefix}-t${i}`}>{p}</React.Fragment>;
  });
}

const isTableSep = (line: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');
const splitRow = (line: string) =>
  line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

export function MarkdownLite({ text }: { text: string }) {
  const lines = (text ?? '').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table: a header row followed by a separator row.
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi} className="border-b border-gray-300 px-2 py-1 text-left font-semibold">
                    {renderInline(h, `h${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border-b border-gray-100 px-2 py-1 align-top">
                      {renderInline(c, `c${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Bullet / numbered list.
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 ml-4 list-disc space-y-0.5">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `li${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Blank line.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph.
    blocks.push(
      <p key={key++} className="my-1 leading-relaxed">
        {renderInline(line, `p${key}`)}
      </p>,
    );
    i++;
  }

  return <div className="space-y-0.5">{blocks}</div>;
}
