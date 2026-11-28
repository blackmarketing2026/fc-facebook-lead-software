"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { RICH_EMAIL_PREFIX, textToHtml } from "@/lib/email-format";

export function RichEmailEditor({ body }: { body: string }) {
  const initial = body.startsWith(RICH_EMAIL_PREFIX) ? body.slice(RICH_EMAIL_PREFIX.length) : textToHtml(body);
  const [html, setHtml] = useState(initial);
  const [error, setError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }), TextStyle, FontSize],
    content: initial,
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    editorProps: { attributes: { class: "min-h-56 p-3 outline-none [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-blue-700 [&_a]:underline", "aria-label": "E-Mail-Text" } },
  });

  function setLink() {
    if (!editor) return;
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive("link")) { setError("Bitte zuerst den gewünschten Text markieren."); return; }
    const value = window.prompt("Internetadresse eingeben:", editor.getAttributes("link").href || "https://");
    if (value === null) return;
    if (!value.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setError(""); return; }
    try {
      const url = new URL(value.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      editor.chain().focus().extendMarkRange("link").setLink({ href: url.href }).run();
      setError("");
    } catch { setError("Bitte eine gültige Internetadresse mit https:// oder http:// eingeben."); }
  }

  return <div>
    <input type="hidden" name="body" value={RICH_EMAIL_PREFIX + html} />
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2" role="toolbar" aria-label="Textformatierung">
        <button type="button" title="Fett" aria-label="Fett" aria-pressed={editor?.isActive("bold")} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()} className={`rounded px-3 py-1 font-bold hover:bg-slate-200 ${editor?.isActive("bold") ? "bg-slate-200" : ""}`}>B</button>
        <button type="button" title="Kursiv" aria-label="Kursiv" aria-pressed={editor?.isActive("italic")} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()} className={`rounded px-3 py-1 italic hover:bg-slate-200 ${editor?.isActive("italic") ? "bg-slate-200" : ""}`}>I</button>
        <button type="button" title="Unterstrichen" aria-label="Unterstrichen" aria-pressed={editor?.isActive("underline")} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`rounded px-3 py-1 underline hover:bg-slate-200 ${editor?.isActive("underline") ? "bg-slate-200" : ""}`}>U</button>
        <select aria-label="Schriftgröße" className="input !w-auto !py-1 text-sm" defaultValue="" onChange={(e) => { const size = e.target.value; if (size) editor?.chain().focus().setFontSize(size).run(); else editor?.chain().focus().unsetFontSize().run(); }}>
          <option value="">Schriftgröße</option><option value="12px">Klein</option><option value="15px">Normal</option><option value="18px">Groß</option><option value="24px">Sehr groß</option>
        </select>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={setLink} className="rounded px-2 py-1 text-sm hover:bg-slate-200">🔗 Link</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()} className="rounded px-2 py-1 text-sm hover:bg-slate-200">Link entfernen</button>
        <button type="button" title="Aufzählung" aria-label="Aufzählung" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()} className="rounded px-2 py-1 text-sm hover:bg-slate-200">• Liste</button>
      </div>
      <EditorContent editor={editor} />
    </div>
    {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
  </div>;
}
