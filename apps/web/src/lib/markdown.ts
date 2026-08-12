// Minimal, dependency-free Markdown -> HTML renderer for KB articles.
// HTML is escaped first (articles are admin-authored, but we stay safe), then a
// small subset of Markdown is applied: headings, bold/italic, inline code,
// links, and ordered/unordered lists.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inline = (s: string) =>
  escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-surface-100 text-[0.85em] font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-600 underline" target="_blank" rel="noreferrer">$1</a>');

export function renderMarkdown(md: string): string {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  const hSize = [
    '',
    'text-xl font-bold mt-5 mb-2 text-content-primary',
    'text-lg font-bold mt-4 mb-2 text-content-primary',
    'text-base font-semibold mt-3 mb-1 text-content-primary',
    'font-semibold mt-2 mb-1 text-content-primary',
    'font-semibold text-content-primary',
    'font-semibold text-content-primary',
  ];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { closeList(); continue; }

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      closeList();
      const level = m[1].length;
      out.push(`<h${level} class="${hSize[level]}">${inline(m[2])}</h${level}>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (listType !== 'ul') { closeList(); out.push('<ul class="list-disc pl-5 my-2 space-y-1">'); listType = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      if (listType !== 'ol') { closeList(); out.push('<ol class="list-decimal pl-5 my-2 space-y-1">'); listType = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      out.push(`<p class="my-2">${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
