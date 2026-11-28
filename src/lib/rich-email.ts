import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";
import { escapeHtml, RICH_EMAIL_PREFIX } from "./email-format";
import { renderTemplate, type TemplateVars } from "./chain-logic";

export function hasEmailBody(body: string | null | undefined): boolean {
  if (!body) return false;
  return body.startsWith(RICH_EMAIL_PREFIX)
    ? Boolean(convert(body.slice(RICH_EMAIL_PREFIX.length), { wordwrap: false }).trim())
    : Boolean(body.trim());
}

export function renderRichEmail(body: string, vars: TemplateVars): { html: string; text: string } {
  const html = sanitizeHtml(renderTemplate(body, {
    vorname: escapeHtml(vars.vorname), name: escapeHtml(vars.name), email: escapeHtml(vars.email),
  }), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "span", "ul", "ol", "li", "blockquote", "h1", "h2", "h3"],
    allowedAttributes: { a: ["href"], span: ["style"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    allowedStyles: { span: { "font-size": [/^(12|15|18|24)px$/] } },
  });
  return { html, text: convert(html, { wordwrap: false }) };
}
