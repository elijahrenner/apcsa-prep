"use client";

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";

// Monaco only loads on the client; skip SSR.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export type FrqEditorProps = {
  value: string;
  onChange: (v: string) => void;
  height?: string;
};

/**
 * Bluebook-mimicking Monaco editor for AP CSA FRQ responses.
 * Light theme matching the surrounding glass UI.
 */
export function FrqEditor({ value, onChange, height = "480px" }: FrqEditorProps) {
  const handleMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme("apcsa-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6B7280", fontStyle: "italic" },
        { token: "keyword", foreground: "1E40AF", fontStyle: "bold" },
        { token: "string", foreground: "1E40AF" },
        { token: "number", foreground: "1E40AF" },
        { token: "type", foreground: "1E40AF" },
      ],
      colors: {
        "editor.background": "#FFFFFF00",
        "editor.foreground": "#0F172A",
        "editorLineNumber.foreground": "#9CA3AF",
        "editorLineNumber.activeForeground": "#1E40AF",
        "editor.lineHighlightBackground": "#DBEAFE33",
        "editor.selectionBackground": "#1E40AF33",
        "editorCursor.foreground": "#1E40AF",
        "editorIndentGuide.background": "#DBEAFE80",
        "editor.inactiveSelectionBackground": "#DBEAFE80",
      },
    });
    monaco.editor.setTheme("apcsa-light");

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, "owner", []);
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/60 bg-white/40">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="ml-3 font-mono text-xs text-neutral-500">
          Response.java
        </span>
      </div>
      <div className="bg-white/45">
        <MonacoEditor
          height={height}
          language="java"
          theme="apcsa-light"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
          options={{
            fontFamily: "var(--font-mono), Menlo, monospace",
            fontSize: 14,
            fontLigatures: false,
            minimap: { enabled: false },
            wordWrap: "off",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            tabSize: 4,
            insertSpaces: true,
            renderWhitespace: "none",
            cursorBlinking: "smooth",
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            parameterHints: { enabled: false },
            wordBasedSuggestions: "off",
            hover: { enabled: false },
            formatOnPaste: false,
            formatOnType: false,
            acceptSuggestionOnEnter: "off",
            tabCompletion: "off",
            inlineSuggest: { enabled: false },
            codeLens: false,
            lightbulb: { enabled: "off" as unknown as never },
            contextmenu: false,
            folding: false,
            guides: { indentation: false },
            renderLineHighlight: "line",
            smoothScrolling: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
}
