const bold = /\*\*(.*?)\*\*/g;
const italic = /(?<!\*)\*(?!\*)(.*?)\*(?<!\*)(?!\*)/g;
const code = /`([^`]+)`/g;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text: string) {
  return escapeHtml(text)
    .replace(code, '<code>$1</code>')
    .replace(bold, '<strong>$1</strong>')
    .replace(italic, '<em>$1</em>');
}

function renderList(lines: string[]) {
  const items = lines
    .map((line) => `<li>${renderInline(line.replace(/^[-*+]\s*/, ''))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

export function toMarkdownHtml(text: string): string {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length) {
      blocks.push(renderList(currentList));
      currentList = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      currentList.push(line);
      continue;
    }

    flushList();

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      blocks.push(`<h${level}>${renderInline(content)}</h${level}>`);
      continue;
    }

    blocks.push(`<p>${renderInline(line)}</p>`);
  }

  flushList();

  return blocks.join('');
}
