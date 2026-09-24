import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Selection } from "@tiptap/extensions"
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import type { UploadFunction } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"

/** The dashboard gives the product name the page's only h1 (sanitiser allow-list). */
export const DESCRIPTION_HEADING_LEVELS = [2, 3, 4] as const

/**
 * TipTap's Highlight serializes `background-color: <colour>; color: inherit`.
 * We keep only the background: the stored colour is then a plain hex the
 * storefront can render, and the theme decides the text colour on top of it —
 * which is what keeps a highlight readable in a dark storefront or a dark
 * editor (see the `.dark .tiptap mark` rule in simple-editor.scss).
 */
const DescriptionHighlight = Highlight.extend({
  addAttributes() {
    const parent = (this.parent?.() ?? {}) as Record<
      string,
      { renderHTML?: (attributes: { color?: string | null }) => Record<string, unknown> }
    >
    const color = parent.color
    if (!color) return parent

    return {
      ...parent,
      color: {
        ...color,
        renderHTML: (attributes: { color?: string | null }) =>
          attributes.color
            ? { "data-color": attributes.color, style: `background-color: ${attributes.color}` }
            : {},
      },
    }
  },
})

/** Mirrors the write chokepoint's image rules (10 MB, these MIME types). */
export const DESCRIPTION_IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,image/gif"
export const DESCRIPTION_IMAGE_MAX_BYTES = 10 * 1024 * 1024

/**
 * The description editor's extension set, in one place so the editor island and
 * the parser tests in `rich-text-model.test.ts` cannot drift apart.
 *
 * Deliberate omissions, each because the storage contract would reject the
 * output:
 *   • `code` / `codeBlock` — no code in product descriptions (a ``` input rule
 *     would create markup the allow-list strips, so it is off rather than
 *     merely unbuttoned);
 *   • h1 — the product name is the page's only h1;
 *   • `subscript` / `superscript` — not part of the e-commerce feature set.
 *
 * `TextAlign`, `Highlight` and the task list DO write attributes the allow-list
 * has to accept (see ADR 0002); they are configured here and allowed there.
 */
/**
 * @param upload Injected so the editor island supplies the real uploader while
 * tests can build the same schema without touching the API layer.
 */
export function descriptionEditorExtensions(upload: UploadFunction) {
  return [
    StarterKit.configure({
      horizontalRule: false,
      codeBlock: false,
      code: false,
      heading: { levels: [...DESCRIPTION_HEADING_LEVELS] },
      link: {
        openOnClick: false,
        enableClickSelection: true,
      },
    }),
    HorizontalRule,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    DescriptionHighlight.configure({ multicolor: true }),
    Image,
    Typography,
    Selection,
    ImageUploadNode.configure({
      accept: DESCRIPTION_IMAGE_ACCEPT,
      maxSize: DESCRIPTION_IMAGE_MAX_BYTES,
      limit: 3,
      upload,
    }),
  ]
}
