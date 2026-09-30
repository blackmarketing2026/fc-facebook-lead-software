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

  it("lehnt Mails ohne JSON ab", () => {
    expect(parseLeadText("Hallo, wie geht's?").ok).toBe(false);
    expect(parseLeadText("[1, 2, 3]").ok).toBe(false);
    expect(parseLeadText('[{"name":"x",').ok).toBe(false);
  });

  it("macht Schlüssel lesbar", () => {
    expect(humanize("sofort_einen_anwalt")).toBe("Sofort einen anwalt");
  });
});
