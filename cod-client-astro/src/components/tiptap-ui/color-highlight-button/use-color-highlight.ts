"use client"

import { editorT } from "@/i18n/editor"

import * as React from "react"
import { type Editor } from "@tiptap/react"
import { useHotkeys } from "react-hotkeys-hook"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useIsMobile } from "@/hooks/use-mobile"

// --- Lib ---
import { isMarkInSchema, isNodeTypeSelected } from "@/lib/tiptap-utils"

// --- Icons ---
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"

export const COLOR_HIGHLIGHT_SHORTCUT_KEY = "mod+shift+h"
export interface HighlightColorOption {
  label: string
  value: string
  border: string
}

export const HIGHLIGHT_COLORS: HighlightColorOption[] = [
  {
    label: editorT("editor.color_gray"),
    value: "#f8f8f7",
    border: "rgba(84, 72, 49, 0.15)",
  },
  {
    label: editorT("editor.color_brown"),
    value: "#f4eeee",
    border: "rgba(210, 162, 141, 0.35)",
  },
  {
    label: editorT("editor.color_orange"),
    value: "#fbecdd",
    border: "rgba(224, 124, 57, 0.27)",
  },
  {
    label: editorT("editor.color_yellow"),
    value: "#fef9c3",
    border: "#fbe604",
  },
  {
    label: editorT("editor.color_green"),
    value: "#dcfce7",
    border: "#c7fad8",
  },
  {
    label: editorT("editor.color_blue"),
    value: "#e0f2fe",
    border: "#ceeafd",
  },
  {
    label: editorT("editor.color_purple"),
    value: "#f3e8ff",
    border: "#e4ccff",
  },
  {
    label: editorT("editor.color_pink"),
    value: "#fcf1f6",
    border: "rgba(225, 136, 179, 0.27)",
  },
  {
    label: editorT("editor.color_red"),
    value: "#ffe4e6",
    border: "#ffccd0",
  },
]
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

/**
 * Configuration for the color highlight functionality
 */
export interface UseColorHighlightConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * The color to apply when toggling the highlight.
   */
  highlightColor?: string
  /**
   * Optional label to display alongside the icon.
   */
  label?: string
  /**
   * Whether the button should hide when the mark is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Called when the highlight is applied.
   */
  onApplied?: ({ color, label }: { color: string; label: string }) => void
}

export function pickHighlightColorsByValue(values: string[]) {
  const colorMap = new Map(
    HIGHLIGHT_COLORS.map((color) => [color.value, color])
  )
  return values
    .map((value) => colorMap.get(value))
    .filter((color): color is (typeof HIGHLIGHT_COLORS)[number] => !!color)
}

/**
 * The colours the highlight popover offers, keyed by the literal value a mark
 * stores. Upstream keys these by `var(--tt-color-highlight-*)`; those resolve to
 * the same swatches in the editor but match nothing in `HIGHLIGHT_COLORS`, so
 * the palette comes back empty — and a variable could not be stored anyway,
 * because the write chokepoint accepts a highlight colour only as a hex.
 */
export const DEFAULT_HIGHLIGHT_COLORS = pickHighlightColorsByValue([
  "#dcfce7",
  "#e0f2fe",
  "#ffe4e6",
  "#f3e8ff",
  "#fef9c3",
])

export function canColorHighlight(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (
    !isMarkInSchema("highlight", editor) ||
    isNodeTypeSelected(editor, ["image"])
  )
    return false

  return editor.can().setMark("highlight")
}

export function isColorHighlightActive(
  editor: Editor | null,
  highlightColor?: string
): boolean {
  if (!editor || !editor.isEditable) return false
  return highlightColor
    ? editor.isActive("highlight", { color: highlightColor })
    : editor.isActive("highlight")
}

export function removeHighlight(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (!canColorHighlight(editor)) return false

  return editor.chain().focus().unsetMark("highlight").run()
}

export function shouldShowButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  if (!editor || !editor.isEditable) return false
  if (!isMarkInSchema("highlight", editor)) return false

  if (hideWhenUnavailable && !editor.isActive("code")) {
    return canColorHighlight(editor)
  }

  return true
}

export function useColorHighlight(config: UseColorHighlightConfig) {
  const {
    editor: providedEditor,
    label,
    highlightColor,
    hideWhenUnavailable = false,
    onApplied,
  } = config

  const { editor } = useTiptapEditor(providedEditor)
  const isMobile = useIsMobile()
  const [isVisible, setIsVisible] = React.useState<boolean>(true)
  const canColorHighlightState = canColorHighlight(editor)
  const isActive = isColorHighlightActive(editor, highlightColor)

  React.useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
    }

    handleSelectionUpdate()

    editor.on("selectionUpdate", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor, hideWhenUnavailable])

  const handleColorHighlight = React.useCallback(() => {
    if (!editor || !canColorHighlightState || !highlightColor || !label)
      return false

    if (editor.state.storedMarks) {
      const highlightMarkType = editor.schema.marks.highlight
      if (highlightMarkType) {
        editor.view.dispatch(
          editor.state.tr.removeStoredMark(highlightMarkType)
        )
      }
    }

    setTimeout(() => {
      const success = editor
        .chain()
        .focus()
        .toggleMark("highlight", { color: highlightColor })
        .run()
      if (success) {
        onApplied?.({ color: highlightColor, label })
      }
      return success
    }, 0)

    return true
  }, [canColorHighlightState, highlightColor, editor, label, onApplied])

  const handleRemoveHighlight = React.useCallback(() => {
    const success = removeHighlight(editor)
    if (success) {
      onApplied?.({ color: "", label: "Remove highlight" })
    }
    return success
  }, [editor, onApplied])

  useHotkeys(
    COLOR_HIGHLIGHT_SHORTCUT_KEY,
    (event) => {
      event.preventDefault()
      handleColorHighlight()
    },
    {
      enabled: isVisible && canColorHighlightState,
      enableOnContentEditable: !isMobile,
      enableOnFormTags: true,
    }
  )

  return {
    isVisible,
    isActive,
    handleColorHighlight,
    handleRemoveHighlight,
    canColorHighlight: canColorHighlightState,
    label: label || `Highlight`,
    shortcutKeys: COLOR_HIGHLIGHT_SHORTCUT_KEY,
    Icon: HighlighterIcon,
  }
}
