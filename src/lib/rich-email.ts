import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";
import { escapeHtml, RICH_EMAIL_PREFIX } from "./email-format";
import { renderTemplate, type TemplateVars } from "./chain-logic";

export function hasEmailBody(body: string | null | undefined): boolean {
  if (!body) return false;
  if (!body.startsWith(RICH_EMAIL_PREFIX)) return Boolean(body.trim());
  const rendered = renderRichEmail(body.slice(RICH_EMAIL_PREFIX.length), { vorname: "{{vorname}}", name: "{{name}}", email: "{{email}}" });
  return Boolean(rendered.text.trim() || /<img\s[^>]*src="https?:\/\//i.test(rendered.html));
}

export function renderRichEmail(body: string, vars: TemplateVars): { html: string; text: string } {
  const html = sanitizeHtml(renderTemplate(body, {
    vorname: escapeHtml(vars.vorname), name: escapeHtml(vars.name), email: escapeHtml(vars.email),
  }), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "span", "img", "ul", "ol", "li", "blockquote", "h1", "h2", "h3"],
    allowedAttributes: { a: ["href"], span: ["style"], img: ["src", "alt", "style"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    allowedStyles: { span: { "font-size": [/^(12|15|18|24)px$/] }, img: { "max-width": [/^100%$/], height: [/^auto$/] } },
    transformTags: { img: (_tag, attributes) => ({ tagName: "img", attribs: { src: attributes.src ?? "", alt: attributes.alt ?? "", style: "max-width:100%;height:auto" } }) },
  });
  return { html, text: convert(html, { wordwrap: false }) };
}
