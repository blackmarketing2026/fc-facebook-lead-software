import { describe, expect, it } from "vitest";
import { humanize, parseLeadText } from "@/lib/lead-parser";

const SAMPLE = `[{"name":"Sprache","values":["Deutsch"]},{"name":"welche_bausteine_benötigst_du_für_deinen_rechtschutz?","values":["privatrechtsschutz"]},{"name":"angenommen,_du_gerätst_morgen_unverschuldet_in_einen_rechtsstreit:_was_wäre_dir_dann_am_wichtigsten?","values":["sofort_einen_anwalt_einschalten_zu_können"]},{"name":"email","values":["beulich30@gmail.com"]},{"name":"full_name","values":["Gunter Beulich"]},{"name":"phone_number","values":["+4915170069230"]}]`;

describe("parseLeadText", () => {
  it("parst das Beispiel-JSON", () => {
    const r = parseLeadText(SAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.answers).toHaveLength(6);
    expect(r.lead.fullName).toBe("Gunter Beulich");
    expect(r.lead.email).toBe("beulich30@gmail.com");
    expect(r.lead.phone).toBe("+4915170069230");
    expect(r.lead.language).toBe("Deutsch");
    expect(r.lead.answers[1].questionLabel).toBe("Welche bausteine benötigst du für deinen rechtschutz?");
    expect(r.lead.answers[2].answers).toEqual(["Sofort einen anwalt einschalten zu können"]);
    expect(r.lead.answers[3].answers).toEqual(["beulich30@gmail.com"]);
  });

  it("findet das JSON auch mit umgebendem Text", () => {
    const r = parseLeadText(`Neuer Lead!\n\n${SAMPLE}\n\n-- \nGesendet von Zapier [Bot]`);
    expect(r.ok).toBe(true);
  });

  it("liest HTML-Mails", () => {
    const html = `<p>${SAMPLE.replace(/"/g, "&quot;")}</p>`;
    const r = parseLeadText("", html);
    expect(r.ok).toBe(true);
  });

  it("parst das echte Lead-Format mit Umlauten", () => {
    const mail = `[{"name":"Sprache","values":["Deutsch"]},{"name":"email","values":["max.mustermann@example.com"]},{"name":"full_name","values":["Gunnar Deißner"]},{"name":"phone_number","values":["+4915100000002"]},{"name":"welche_bausteine_benötigst_du_für_deinen_rechtschutz?","values":["privatrechtsschutz"]},{"name":"angenommen,_du_gerätst_morgen_unverschuldet_in_einen_rechtsstreit:_was_wäre_dir_dann_am_wichtigsten?","values":["sofort_einen_anwalt_einschalten_zu_können"]}]`;
    const result = parseLeadText(mail);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.fullName).toBe("Gunnar Deißner");
    expect(result.lead.email).toBe("max.mustermann@example.com");
    expect(result.lead.answers.at(-1)?.answers).toEqual(["Sofort einen anwalt einschalten zu können"]);
  });

  it("verträgt Zeilenumbrüche des Mailprogramms mitten in den Werten", () => {
    const mail = `[{"name":"Sprache","values":["Deutsch"]},{"name":"welche_bausteine_benötigst_du_für_deinen_rechtschutz?","values":["strafrechtsschutz"]},{"name":"email","values":["
max.mustermann@example.com"]},{"name":"full_name","values":["Max
Mustermann"]},{"name":"phone_number","values":["+4915100000001"]}]`;
    const result = parseLeadText(mail);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.email).toBe("max.mustermann@example.com");
    expect(result.lead.fullName).toBe("Max Mustermann");
    expect(result.lead.phone).toBe("+4915100000001");
    expect(result.lead.language).toBe("Deutsch");
  });

  it("verträgt typografische Anführungszeichen und HTML-Entities", () => {
    const smart = parseLeadText(`[{“name”:“full_name”,“values”:[“Max Mustermann”]}]`);
    expect(smart.ok && smart.lead.fullName).toBe("Max Mustermann");
    const html = parseLeadText("", `<p>[{&#34;name&#34;:&#34;full_name&#34;,&#34;values&#34;:[&#34;J&ouml;rg&#34;]}]</p>`);
    expect(html.ok && html.lead.fullName).toBe("Jörg");
  });

  it("lehnt Mails ohne JSON ab", () => {
    expect(parseLeadText("Hallo, wie geht's?").ok).toBe(false);
    expect(parseLeadText("[1, 2, 3]").ok).toBe(false);
    expect(parseLeadText('[{"name":"x",').ok).toBe(false);
  });

  it("macht Schlüssel lesbar", () => {
    expect(humanize("sofort_einen_anwalt")).toBe("Sofort einen anwalt");
  });
});
