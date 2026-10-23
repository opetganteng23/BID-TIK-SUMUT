"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Bold, Heading2, Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Quote, Redo2, Table2, Underline as UIcon, Undo2, Video } from "lucide-react";
import { useRef } from "react";
import { cx } from "@/components/ui";
import { MediaLibrary } from "@/components/admin/MediaPicker";
import { X } from "lucide-react";

type Props = { id: string; label: string; html: string; json?: unknown; onChange: (html: string, json: unknown) => void };

function Btn({ on, label, active, disabled, children }: { on: () => void; label: string; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={on} disabled={disabled} aria-label={label} title={label} aria-pressed={active} className={cx("inline-flex size-11 items-center justify-center rounded-lg hover:bg-surface-2 disabled:opacity-40", active && "bg-surface-2 ring-2 ring-fg")}>
      {children}
    </button>
  );
}

/** Editor Tiptap. Hanya dimuat di admin. HTML hasil render disanitasi ulang di server saat simpan. */
export function RichTextEditor({ id, label, html, json, onChange }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } } }),
      Image,
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: (json as object | undefined) && Object.keys(json as object).length ? (json as object) : html,
    editorProps: { attributes: { id, class: "prose-article min-h-64 rounded-b-xl border-2 border-t-0 border-border bg-surface p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]", "aria-label": label, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), e.getJSON()),
  });

  if (!editor) return <div className="min-h-64 animate-pulse rounded-xl bg-surface-2" aria-busy="true" />;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Alamat tautan (https, mailto, atau tel)", prev ?? "https://");
    if (url === null) return;
    if (url === "") return void editor.chain().focus().unsetLink().run();
    if (!/^(https:\/\/|mailto:|tel:)/i.test(url)) return void window.alert("Tautan harus memakai https, mailto, atau tel.");
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addVideo = () => {
    const url = window.prompt("Alamat video YouTube");
    if (url) editor.commands.setYoutubeVideo({ src: url });
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <div role="toolbar" aria-label="Format teks" className="flex flex-wrap gap-0.5 rounded-t-xl border-2 border-border bg-surface p-1">
        <Btn label="Tebal" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="size-4" /></Btn>
        <Btn label="Miring" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="size-4" /></Btn>
        <Btn label="Garis bawah" on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}><UIcon className="size-4" /></Btn>
        <Btn label="Judul 2" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="size-4" /></Btn>
        <Btn label="Judul 3" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="size-4" /></Btn>
        <Btn label="Daftar poin" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="size-4" /></Btn>
        <Btn label="Daftar angka" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="size-4" /></Btn>
        <Btn label="Kutipan" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="size-4" /></Btn>
        <Btn label="Tautan" on={setLink} active={editor.isActive("link")}><Link2 className="size-4" /></Btn>
        <Btn label="Sisipkan gambar" on={() => dlg.current?.showModal()}><ImageIcon className="size-4" /></Btn>
        <Btn label="Sisipkan video YouTube" on={addVideo}><Video className="size-4" /></Btn>
        <Btn label="Sisipkan tabel" on={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="size-4" /></Btn>
        <Btn label="Urungkan" on={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="size-4" /></Btn>
        <Btn label="Ulangi" on={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="size-4" /></Btn>
      </div>
      <EditorContent editor={editor} />

      <dialog ref={dlg} aria-label="Pilih gambar" className="m-auto w-[min(96vw,60rem)] rounded-[20px] border border-border bg-surface p-0 text-fg backdrop:bg-black/40">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-xl">Sisipkan gambar</h2>
          <button type="button" onClick={() => dlg.current?.close()} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Tutup"><X className="size-5" aria-hidden /></button>
        </div>
        <div className="max-h-[75svh] overflow-y-auto p-4">
          <MediaLibrary kind="image" onPick={(m) => { editor.chain().focus().setImage({ src: m.url, alt: m.alt ?? "" }).run(); dlg.current?.close(); }} />
        </div>
      </dialog>
    </div>
  );
}
