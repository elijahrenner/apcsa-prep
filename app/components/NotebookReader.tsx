"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";

type Block =
  | { type: "h1" | "h3"; text: string; id?: string }
  | { type: "term"; text: string; id: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; lang: string; code: string }
  | { type: "table"; rows: string[][] };

type Section = {
  id: string;
  title: string;
  blocks: Block[];
  searchText: string;
};

export function NotebookReader({ markdown }: { markdown: string }) {
  const parsed = useMemo(() => parseNotebook(markdown), [markdown]);
  const [query, setQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [navOpen, setNavOpen] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(parsed.sections.map((section) => [section.id, true]))
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = normalizedQuery
    ? parsed.sections.filter((section) => section.searchText.includes(normalizedQuery))
    : parsed.sections;
  const matchCount = normalizedQuery
    ? visibleSections.reduce(
        (total, section) => total + countPhrase(section.searchText, normalizedQuery),
        0
      )
    : 0;
  const activeMatchIndex = matchCount > 0 ? currentMatchIndex % matchCount : 0;

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (!normalizedQuery || matchCount === 0) return;
    const timer = window.setTimeout(() => {
      const matches = Array.from(
        document.querySelectorAll<HTMLElement>("[data-notebook-match='true']")
      );
      matches.forEach((match) => {
        match.classList.remove("notebook-current-match");
        match.removeAttribute("aria-current");
      });

      const activeMatch = matches[activeMatchIndex];
      activeMatch?.classList.add("notebook-current-match");
      activeMatch?.setAttribute("aria-current", "true");
      activeMatch?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeMatchIndex, matchCount, normalizedQuery, visibleSections.length]);

  function setAll(value: boolean) {
    setOpen(Object.fromEntries(parsed.sections.map((section) => [section.id, value])));
  }

  function jumpTo(section: Section) {
    setOpen((prev) => ({ ...prev, [section.id]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(section.id)?.scrollIntoView({ block: "start" });
    });
  }

  function goToNextSearchMatch() {
    if (!normalizedQuery || matchCount === 0) return;
    setCurrentMatchIndex((index) => (index + 1) % matchCount);
  }

  function goToPreviousSearchMatch() {
    if (!normalizedQuery || matchCount === 0) return;
    setCurrentMatchIndex((index) => (index - 1 + matchCount) % matchCount);
  }

  return (
    <div className="relative left-1/2 -my-10 w-screen -translate-x-1/2">
      <div
        className={`grid min-h-[calc(100vh-4rem)] border-t border-neutral-200/80 bg-white/85 ${
          navOpen ? "lg:grid-cols-[18rem_minmax(0,1fr)]" : "lg:grid-cols-1"
        }`}
      >
        {navOpen && (
          <aside className="border-b border-neutral-200/80 bg-neutral-50/90 px-4 py-4 lg:sticky lg:top-[3.6rem] lg:h-[calc(100vh-3.6rem)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 px-2 pb-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Units
              </div>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-800 hover:text-blue-800"
                aria-label="Hide notebook navigation"
              >
                Hide
              </button>
            </div>
            <nav className="space-y-1">
              {parsed.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => jumpTo(section)}
                  className="block w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-white hover:text-blue-800"
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>
        )}

        <main className="min-w-0 px-5 py-7 sm:px-8 lg:px-10">
          <div className="sticky top-[3.55rem] z-20 -mx-5 border-b border-neutral-200/80 bg-white/92 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNavOpen((value) => !value)}
                  className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm shadow-slate-900/5 transition-colors hover:border-blue-800 hover:text-blue-800"
                  aria-expanded={navOpen}
                >
                  {navOpen ? "Hide units" : "Show units"}
                </button>
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm shadow-slate-900/5 focus-within:border-blue-800">
                  <span className="text-sm font-medium text-slate-700">Search</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      goToNextSearchMatch();
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Search notes, code, tables..."
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAll(true)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-800"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => setAll(false)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-800"
                >
                  Collapse all
                </button>
              </div>
            </div>
            {normalizedQuery && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={goToPreviousSearchMatch}
                  disabled={matchCount === 0}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 font-medium text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-neutral-200 disabled:hover:text-slate-700"
                  aria-label="Previous search match"
                >
                  ←
                </button>
                <span className="min-w-14 text-center font-medium text-slate-700">
                  {matchCount > 0 ? `${activeMatchIndex + 1} / ${matchCount}` : "0 / 0"}
                </span>
                <button
                  type="button"
                  onClick={goToNextSearchMatch}
                  disabled={matchCount === 0}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 font-medium text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-neutral-200 disabled:hover:text-slate-700"
                  aria-label="Next search match"
                >
                  →
                </button>
              </div>
            )}
          </div>

          <article className="notebook-markdown w-full max-w-none pt-6">
            {parsed.title && (
              <h1 className="mb-8 text-4xl font-semibold tracking-tight text-slate-950">
                {renderInline(parsed.title)}
              </h1>
            )}

            {visibleSections.map((section) => {
              const expanded = normalizedQuery ? true : open[section.id] ?? true;
              return (
                <details
                  key={section.id}
                  id={section.id}
                  open={expanded}
                  className="scroll-mt-32 border-t border-neutral-200 py-5 first:border-t-0"
                  onToggle={(event) => {
                    if (normalizedQuery) return;
                    const nextOpen = event.currentTarget.open;
                    setOpen((prev) => ({
                      ...prev,
                      [section.id]: nextOpen,
                    }));
                  }}
                >
                  <summary className="cursor-pointer list-none text-2xl font-semibold tracking-tight text-slate-950 marker:hidden">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-sm text-blue-800">▶</span>
                      {renderInline(section.title, normalizedQuery)}
                    </span>
                  </summary>
                  <div className="pt-2">
                    {section.blocks.map((block, i) => (
                      <MarkdownBlock key={i} block={block} query={normalizedQuery} />
                    ))}
                  </div>
                </details>
              );
            })}

            {visibleSections.length === 0 && (
              <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-slate-600">
                No matching notes.
              </div>
            )}
          </article>
        </main>
      </div>
    </div>
  );
}

function MarkdownBlock({ block, query }: { block: Block; query: string }) {
  switch (block.type) {
    case "h1":
      return (
        <h1 className="mb-8 text-4xl font-semibold tracking-tight text-slate-950">
          {renderInline(block.text, query)}
        </h1>
      );
    case "h3":
      return (
        <h3
          id={block.id}
          className="scroll-mt-32 mt-7 text-xl font-semibold tracking-tight text-slate-950"
        >
          {renderInline(block.text, query)}
        </h3>
      );
    case "term":
      return (
        <h3 id={block.id} className="scroll-mt-32 mt-6 text-base font-semibold text-slate-950">
          {renderInline(block.text, query)}
        </h3>
      );
    case "p":
      return (
        <p className="mt-2 text-base leading-7 text-slate-800">
          {renderInline(block.text, query)}
        </p>
      );
    case "ul":
      return (
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-base leading-7 text-slate-800">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, query)}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre>
          <code>{highlightPhrase(block.code, query)}</code>
        </pre>
      );
    case "table":
      return <NotesTable rows={block.rows} query={query} />;
  }
}

function NotesTable({ rows, query }: { rows: string[][]; query: string }) {
  const [head, separator, ...body] = rows;
  const hasSeparator = separator?.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  const data = hasSeparator ? body : rows.slice(1);

  return (
    <div className="mt-4 overflow-x-auto border border-neutral-200 bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-neutral-50 text-slate-900">
          <tr>
            {head.map((cell, i) => (
              <th key={i} className="border-b border-neutral-200 px-3 py-2 font-semibold">
                {renderInline(cell, query)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-slate-800">
                  {renderInline(cell, query)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseNotebook(markdown: string): { title: string; sections: Section[] } {
  let title = "";
  const sections: Section[] = [];
  const rawLines = markdown.split(/\r?\n/);
  const nextId = createSlugger();
  let current: Section | null = null;
  let pendingBlocks: Block[] = [];

  for (let i = 0; i < rawLines.length; ) {
    const line = rawLines[i];
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);

    if (h1) {
      title = h1[1].trim();
      i++;
      continue;
    }

    if (h2) {
      if (current) {
        current.searchText = blockText(current.blocks, current.title);
        sections.push(current);
      } else if (pendingBlocks.length > 0) {
        const introTitle = "Intro";
        sections.push({
          id: nextId(introTitle),
          title: introTitle,
          blocks: pendingBlocks,
          searchText: blockText(pendingBlocks, introTitle),
        });
        pendingBlocks = [];
      }
      const text = h2[1].trim();
      current = { id: nextId(text), title: text, blocks: [], searchText: "" };
      i++;
      continue;
    }

    const { block, next } = parseBlockAt(rawLines, i, nextId);
    if (block) {
      if (current) current.blocks.push(block);
      else pendingBlocks.push(block);
    }
    i = next;
  }

  if (current) {
    current.searchText = blockText(current.blocks, current.title);
    sections.push(current);
  }

  return { title, sections };
}

function parseBlockAt(
  lines: string[],
  i: number,
  nextId: (text: string) => string
): { block: Block | null; next: number } {
  const line = lines[i];

  if (!line?.trim()) return { block: null, next: i + 1 };
  if (line.startsWith("## ")) return { block: null, next: i + 1 };

  const codeStart = line.match(/^```(\w+)?\s*$/);
  if (codeStart) {
    const code: string[] = [];
    i++;
    while (i < lines.length && !lines[i].startsWith("```")) {
      code.push(lines[i]);
      i++;
    }
    return {
      block: { type: "code", lang: codeStart[1] ?? "", code: code.join("\n") },
      next: i < lines.length ? i + 1 : i,
    };
  }

  if (line.startsWith("|")) {
    const rows: string[][] = [];
    while (i < lines.length && lines[i].startsWith("|")) {
      rows.push(splitTableRow(lines[i]));
      i++;
    }
    return { block: { type: "table", rows }, next: i };
  }

  const heading = line.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length;
    const text = heading[2].trim();
    if (level === 2) return { block: null, next: i + 1 };
    return {
      block: { type: level === 1 ? "h1" : "h3", text, id: level > 1 ? nextId(text) : undefined },
      next: i + 1,
    };
  }

  if (line.startsWith("- ")) {
    const items: string[] = [];
    while (i < lines.length && lines[i].startsWith("- ")) {
      items.push(lines[i].slice(2).trim());
      i++;
    }
    return { block: { type: "ul", items }, next: i };
  }

  const term = line.match(/^\*([^*]+)\*$/);
  if (term) {
    const text = term[1].trim();
    return { block: { type: "term", text, id: nextId(text) }, next: i + 1 };
  }

  const paragraph: string[] = [line.trim()];
  i++;
  while (
    i < lines.length &&
    lines[i].trim() &&
    !lines[i].startsWith("#") &&
    !lines[i].startsWith("```") &&
    !lines[i].startsWith("|") &&
    !lines[i].startsWith("- ") &&
    !/^\*[^*]+\*$/.test(lines[i])
  ) {
    paragraph.push(lines[i].trim());
    i++;
  }
  return { block: { type: "p", text: paragraph.join(" ") }, next: i };
}

function blockText(blocks: Block[], title: string): string {
  const parts = [title];
  for (const block of blocks) {
    if ("text" in block) parts.push(block.text);
    if (block.type === "ul") parts.push(...block.items);
    if (block.type === "code") parts.push(block.code);
    if (block.type === "table") parts.push(block.rows.flat().join(" "));
  }
  return parts.join(" ").toLowerCase();
}

function countPhrase(text: string, query: string): number {
  if (!query) return 0;
  let count = 0;
  let index = 0;
  while (index < text.length) {
    const next = text.indexOf(query, index);
    if (next === -1) break;
    count++;
    index = next + query.length;
  }
  return count;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function renderInline(text: string, query = ""): ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{highlightPhrase(part.slice(1, -1), query)}</code>;
    }
    return <span key={i}>{renderEmphasis(part, query)}</span>;
  });
}

function renderEmphasis(text: string, query: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{highlightPhrase(part.slice(2, -2), query)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{highlightPhrase(part.slice(1, -1), query)}</em>;
    }
    return <Fragment key={i}>{highlightPhrase(part, query)}</Fragment>;
  });
}

function highlightPhrase(text: string, query: string): ReactNode {
  if (!query) return text;
  const needle = query.toLowerCase();
  const lower = text.toLowerCase();
  const pieces: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < text.length) {
    const next = lower.indexOf(needle, index);
    if (next === -1) break;
    if (next > index) pieces.push(text.slice(index, next));
    pieces.push(
      <mark
        key={key++}
        data-notebook-match="true"
        className="rounded bg-blue-100 px-0.5 text-blue-800 ring-1 ring-blue-800/20"
      >
        {text.slice(next, next + query.length)}
      </mark>
    );
    index = next + query.length;
  }

  if (pieces.length === 0) return text;
  if (index < text.length) pieces.push(text.slice(index));
  return pieces;
}

function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = slugify(text) || "section";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
