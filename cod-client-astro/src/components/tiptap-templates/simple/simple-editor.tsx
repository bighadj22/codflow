"use client"

import * as React from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node (styles for the node views this editor renders) ---
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import { LinkPopover, LinkContent, LinkButton } from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile"

// --- Lib ---
import { editorT } from "@/i18n/editor"
import { uploadDescriptionImage } from "@/features/products/editor-image-upload"
import {
  DESCRIPTION_HEADING_LEVELS,
  descriptionEditorExtensions,
} from "@/components/tiptap-templates/simple/simple-editor-extensions"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

export interface SimpleEditorProps {
  /** The stored description, HTML when the field's format is `"html"`. */
  value: string
  /** Emits the serialized HTML on every edit. */
  onChange: (html: string) => void
  disabled?: boolean
  busy?: boolean
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[...DESCRIPTION_HEADING_LEVELS]} portal={isMobile} />
        <ListDropdownMenu
          types={["bulletList", "orderedList", "taskList"]}
          portal={isMobile}
        />
        <BlockquoteButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton />
      </ToolbarGroup>

      <Spacer />
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? <ColorHighlightPopoverContent /> : <LinkContent />}
  </>
)

/**
 * Rich-text product description editor — the Tiptap "Simple editor" template,
 * wired to this app.
 *
 * Adaptations to the vendored template, all deliberate: props with two-way value
 * sync so the value lives in the product form; the dashboard's R2 upload seam
 * instead of the demo uploader; h2–h4, no code/code-block, no theme toggle (the
 * dashboard owns light/dark); every string from the dictionaries.
 */
export function SimpleEditor({ value, onChange, disabled, busy }: SimpleEditorProps) {
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = React.useState<"main" | "highlighter" | "link">("main")

  // Every `useEditor` option except the callbacks is compared by reference on
  // each render (EditorInstanceManager.compareOptions). A fresh array, object
  // or string there makes TipTap call `editor.setOptions`, whose
  // `view.updateState` resets the ProseMirror view mid-edit. The upstream
  // template never notices because it takes no props and barely re-renders;
  // this one re-renders on every keystroke, so each option has to be stable.
  const extensions = React.useMemo(
    () => descriptionEditorExtensions(uploadDescriptionImage),
    [],
  )
  const editorProps = React.useMemo(
    () => ({
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": editorT("editor.content_aria"),
        class: "simple-editor",
      },
    }),
    [],
  )
  // Mount-time value only: after that the editor owns its document.
  const initialContent = React.useRef(value).current

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: !disabled && !busy,
    editorProps,
    extensions,
    content: initialContent,
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML())
    },
  })

  React.useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled && !busy)
  }, [editor, disabled, busy])

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar>
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
              isMobile={isMobile}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === "highlighter" ? "highlighter" : "link"}
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        <EditorContent editor={editor} role="presentation" className="simple-editor-content" />
      </EditorContext.Provider>
    </div>
  )
}
