"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Undo,
  Redo,
  RemoveFormatting,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Éditeur de texte riche basé sur TipTap (headless, stylé via tokens Tailwind).
 * Toolbar : gras, italique, souligné, barré, listes, citation, lien, code, undo/redo.
 * BubbleMenu flottant au-dessus de la sélection (gras/italique/souligné/barré/lien/code).
 * Coloration syntaxique des blocs de code via lowlight.
 */
export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: { openOnClick: false },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[40vh] px-3 py-2 text-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const setLink = () => {
    const previousUrl = editor?.getAttributes("link").href ?? "";
    const url = window.prompt("URL du lien :", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  if (!editor) return null;

  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), label: "Gras" },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), label: "Italique" },
    { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline"), label: "Souligné" },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike"), label: "Barré" },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), label: "Liste à puces" },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), label: "Liste numérotée" },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote"), label: "Citation" },
    { icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive("codeBlock"), label: "Bloc de code" },
    { icon: LinkIcon, action: setLink, active: editor.isActive("link"), label: "Lien" },
  ];

  const bubbleTools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), label: "Gras" },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), label: "Italique" },
    { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline"), label: "Souligné" },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike"), label: "Barré" },
    { icon: LinkIcon, action: setLink, active: editor.isActive("link"), label: "Lien" },
  ];

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-input bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        {tools.map((tool) => (
          <Button
            key={tool.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={tool.action}
            aria-label={tool.label}
            className={cn(tool.active && "bg-muted text-foreground")}
          >
            <tool.icon className="size-3.5" />
          </Button>
        ))}
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Annuler"
        >
          <Undo className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Rétablir"
        >
          <Redo className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          aria-label="Effacer le formatage"
        >
          <RemoveFormatting className="size-3.5" />
        </Button>
      </div>

      {/* BubbleMenu flottant */}
      <BubbleMenu editor={editor} className="glass-strong flex items-center gap-0.5 rounded-lg border border-border p-1 shadow-lg">
        {bubbleTools.map((tool) => (
          <Button
            key={tool.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={tool.action}
            aria-label={tool.label}
            className={cn(tool.active && "bg-muted text-foreground")}
          >
            <tool.icon className="size-3.5" />
          </Button>
        ))}
      </BubbleMenu>

      {/* Zone d'édition */}
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
}
