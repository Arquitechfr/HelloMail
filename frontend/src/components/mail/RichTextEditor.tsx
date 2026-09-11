"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { useTemplates } from "@/lib/queries/templates";
import type { EmailTemplate } from "@/lib/types/templates";
import { TemplateSuggestionMenu } from "./TemplateSuggestionMenu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
  accountId?: string;
  onTemplateInserted?: (template: EmailTemplate) => void;
}

/**
 * Éditeur de texte riche basé sur TipTap (headless, stylé via tokens Tailwind).
 * Toolbar : gras, italique, souligné, barré, listes, citation, lien, code, undo/redo.
 * BubbleMenu flottant au-dessus de la sélection.
 * Autocomplétion intelligente des modèles d'emails à la frappe de ! (ex: !merci).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  accountId,
  onTemplateInserted,
}: RichTextEditorProps) {
  const { data: templatesData } = useTemplates(accountId);
  const templates = useMemo(() => templatesData?.data ?? [], [templatesData?.data]);
  const templatesRef = useRef(templates);
  templatesRef.current = templates;

  // États du menu d'autocomplétion (!)
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionCoords, setSuggestionCoords] = useState<{
    top: number;
    left: number;
    bottom: number;
  } | null>(null);
  const [suggestionRange, setSuggestionRange] = useState<{ from: number; to: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const suggestionOpenRef = useRef(suggestionOpen);
  suggestionOpenRef.current = suggestionOpen;
  const suggestionQueryRef = useRef(suggestionQuery);
  suggestionQueryRef.current = suggestionQuery;
  const suggestionRangeRef = useRef(suggestionRange);
  suggestionRangeRef.current = suggestionRange;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const filteredTemplates = useMemo(() => {
    if (!suggestionOpen) return [];
    const cleanQ = suggestionQuery.toLowerCase().replace(/^!/, "").trim();
    if (!cleanQ) return templates;
    return templates.filter((tpl) => {
      const cleanShortcut = (tpl.shortcut || "").toLowerCase().replace(/^!/, "").trim();
      return (
        cleanShortcut.includes(cleanQ) ||
        tpl.title.toLowerCase().includes(cleanQ) ||
        (tpl.subject && tpl.subject.toLowerCase().includes(cleanQ))
      );
    });
  }, [templates, suggestionOpen, suggestionQuery]);

  const filteredTemplatesRef = useRef(filteredTemplates);
  filteredTemplatesRef.current = filteredTemplates;

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
      handleKeyDown(_view, event) {
        if (!suggestionOpenRef.current) return false;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          const len = filteredTemplatesRef.current.length;
          if (len > 0) setSelectedIndex((prev) => (prev + 1) % len);
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          const len = filteredTemplatesRef.current.length;
          if (len > 0) setSelectedIndex((prev) => (prev - 1 + len) % len);
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          const list = filteredTemplatesRef.current;
          const active = list[selectedIndexRef.current];
          if (active) {
            event.preventDefault();
            insertTemplateRef.current(active);
            return true;
          }
          return false;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setSuggestionOpen(false);
          return true;
        }

        if (event.key === " ") {
          // Si un raccourci complet a été saisi (ex: !merci suivi d'espace)
          const q = suggestionQueryRef.current.toLowerCase().replace(/^!/, "").trim();
          if (q) {
            const exactMatch = templatesRef.current.find((t) => {
              const sc = (t.shortcut || "").toLowerCase().replace(/^!/, "").trim();
              return sc === q;
            });
            if (exactMatch) {
              event.preventDefault();
              insertTemplateRef.current(exactMatch);
              return true;
            }
          }
          // Si ! seul suivi d'un espace, ou mot quelconque : annulation immédiate du menu
          setSuggestionOpen(false);
          return false;
        }

        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
      checkTrigger(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      checkTrigger(ed);
    },
  });

  const insertTemplate = useCallback(
    (template: EmailTemplate) => {
      if (!editor || !suggestionRangeRef.current) return;
      const { from, to } = suggestionRangeRef.current;
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(template.bodyHtml || template.bodyText)
        .run();

      setSuggestionOpen(false);
      setSuggestionRange(null);
      setSuggestionQuery("");
      toast.success(`Modèle "${template.title}" inséré`);
      onTemplateInserted?.(template);
    },
    [editor, onTemplateInserted],
  );

  const insertTemplateRef = useRef(insertTemplate);
  insertTemplateRef.current = insertTemplate;

  const checkTrigger = useCallback((ed: typeof editor) => {
    if (!ed) return;
    const { state } = ed;
    const { from, to } = state.selection;
    if (from !== to) {
      setSuggestionOpen(false);
      return;
    }

    const resolved = state.doc.resolve(from);
    const textBefore = resolved.parent.textBetween(0, resolved.parentOffset, "\n", "\0");

    // Détecte ! suivi de caractères sans espace
    const match = textBefore.match(/(?:^|\s)!([a-zA-Z0-9_\-À-ÿ]*)$/);
    if (match) {
      const query = match[1];
      const triggerStart = from - query.length - 1;
      setSuggestionQuery(query);
      setSuggestionRange({ from: triggerStart, to: from });
      setSelectedIndex(0);

      try {
        const coords = ed.view.coordsAtPos(from);
        setSuggestionCoords({ top: coords.top, left: coords.left, bottom: coords.bottom });
      } catch {
        // ignore si coords non encore calculées
      }
      setSuggestionOpen(true);
    } else {
      setSuggestionOpen(false);
    }
  }, []);

  // Synchronisation des mises à jour de contenu externes (ex: insertion signature, template, brouillon)
  useEffect(() => {
    if (!editor) return;
    if (!value && editor.isEmpty) return;
    const currentHtml = editor.getHTML();
    if (value !== currentHtml) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const setLink = () => {
    const prev = editor?.getAttributes("link").href ?? "";
    const url = window.prompt("URL du lien :", prev);
    if (url === null) return;
    if (!url) editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
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

  const bubbleTools = tools.filter((t) =>
    ["Gras", "Italique", "Souligné", "Barré", "Lien"].includes(t.label),
  );

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
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label="Annuler"><Undo className="size-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label="Rétablir"><Redo className="size-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} aria-label="Effacer le formatage"><RemoveFormatting className="size-3.5" /></Button>
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

      {/* Menu d'autocomplétion des modèles à la frappe de ! */}
      {suggestionOpen && (
        <TemplateSuggestionMenu
          templates={filteredTemplates}
          selectedIndex={selectedIndex}
          query={suggestionQuery}
          coords={suggestionCoords}
          onSelect={insertTemplate}
          onClose={() => setSuggestionOpen(false)}
        />
      )}
    </div>
  );
}
