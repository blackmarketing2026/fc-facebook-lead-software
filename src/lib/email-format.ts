export const RICH_EMAIL_PREFIX = "<!-- rich-email -->";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Reintext → einfaches HTML: Absätze, Zeilenumbrüche und anklickbare Links. */
export function textToHtml(text: string): string {
  const linkify = (escaped: string) => escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}">${url}</a>`);
  const renderParagraph = (para: string) => {
    const link = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi;
    let html = "";
    let last = 0;
    for (const match of para.matchAll(link)) {
      html += linkify(escapeHtml(para.slice(last, match.index)));
      html += `<a href="${escapeHtml(match[2])}">${escapeHtml(match[1])}</a>`;
      last = match.index! + match[0].length;
    }
    return (html + linkify(escapeHtml(para.slice(last)))).replace(/\n/g, "<br>");
  };
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px">${renderParagraph(para)}</p>`)
    .join("");
}

/** Textversion einer E-Mail: Linktext und Ziel sind auch ohne HTML lesbar. */
export function linksToPlainText(text: string): string {
  return text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi, "$1 ($2)");
}

