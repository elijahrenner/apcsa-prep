export function renderInlineCode(input: unknown): string {
  const s = fenceLooseJavaBlocks(typeof input === "string" ? input : String(input ?? ""));
  let html = "";
  let lastIndex = 0;
  const fenceRe = /```(?:java)?\n?([\s\S]*?)```/g;
  for (const match of s.matchAll(fenceRe)) {
    html += renderInlineSegment(s.slice(lastIndex, match.index));
    html += renderCodeBlock(match[1] ?? "");
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  html += renderInlineSegment(s.slice(lastIndex));
  return html;
}

function fenceLooseJavaBlocks(input: string): string {
  if (input.includes("```")) return input;

  const lines = input.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!looksLikeJavaDeclaration(line)) {
      out.push(line);
      continue;
    }

    const block: string[] = [];
    let balance = 0;
    let sawBrace = false;
    while (i < lines.length) {
      const current = lines[i];
      block.push(current);
      for (const ch of current) {
        if (ch === "{") {
          balance++;
          sawBrace = true;
        } else if (ch === "}") {
          balance--;
        }
      }

      const next = lines[i + 1] ?? "";
      if (sawBrace && balance <= 0) break;
      if (!sawBrace && !looksLikeJavaContinuation(next)) break;
      i++;
    }

    out.push("```java", block.join("\n"), "```");
  }

  return out.join("\n");
}

function looksLikeJavaDeclaration(line: string): boolean {
  return /^\s*(public|private|protected)\s+(class|static|final|boolean|int|double|String|void|ArrayList<|[A-Z][A-Za-z0-9_]*\s*\[?\]?)/.test(
    line
  );
}

function looksLikeJavaContinuation(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed === "" ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/**") ||
    /^[{}]/.test(trimmed) ||
    /[;{}]$/.test(trimmed) ||
    looksLikeJavaDeclaration(line)
  );
}

function renderInlineSegment(s: string): string {
  return escapeHtml(s).replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
}

function renderCodeBlock(rawCode: string): string {
  const code = rawCode.endsWith("\n") ? rawCode.slice(0, -1) : rawCode;
  const lines = code.split("\n");
  const labelled = lines.map((line) => line.match(/^(\s*)(\d+\.?)(\s*)(.*)$/));
  const labelledCount = labelled.filter(Boolean).length;
  if (labelledCount < 2) {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }

  const labelWidth = Math.max(
    ...labelled.map((match) => (match ? match[2].length : 0))
  );
  const renderedLines = lines
    .map((line, index) => {
      const match = labelled[index];
      if (!match) {
        return `<span class="code-line"><span class="line-number"></span><span class="line-code">${escapeHtml(
          line
        )}</span></span>`;
      }
      const label = match[2];
      const spacer = match[3] ?? "";
      const text = match[4] ?? "";
      const alignmentSpaces = Math.max(1, labelWidth + 1 - label.length);
      const codeIndent = spacer.slice(Math.min(spacer.length, alignmentSpaces));
      return `<span class="code-line"><span class="line-number">${escapeHtml(
        label.replace(".", "")
      )}</span><span class="line-code">${escapeHtml(codeIndent + text)}</span></span>`;
    })
    .join("\n");

  return `<pre class="has-line-numbers"><code>${renderedLines}</code></pre>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
