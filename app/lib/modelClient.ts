/**
 * Runtime model client used by the Next.js API routes.
 *
 * The app uses the local Codex CLI so it shares the same ChatGPT auth as the
 * generation pipeline instead of requiring a separate provider API key.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { FrqArchetype, FrqBlueprint } from "./frqBlueprint";

export const MODEL = "gpt-5.5";

const FALLBACK_FRQ_GRADER_SYSTEM = `You are an expert AP Computer Science A free-response grader.

You score a student's Java response against an official-style per-criterion rubric.

Rules:
- Be strict but fair. Award a point only when the student's code demonstrates BOTH the correct intent AND a correct (compiling, working) implementation of that criterion.
- Partial credit follows the rubric only  -  do not invent new criteria.
- Style, indentation, and identifier choice do not affect points.
- A response that does not compile may still earn points for criteria its (broken) code clearly attempts and would correctly satisfy if the unrelated error were fixed. Cascading errors caused by one mistake should not be double-penalized.
- Ignore extra helper methods and imports if they don't break the rest.
- Use the reference solution only as a guide for what "correct" looks like  -  never penalize a different but valid approach.

Return STRICT JSON with this shape and nothing else (no markdown fences, no prose):
{
  "per_criterion": [
    { "point_label": string, "awarded": number, "max": number, "justification": string }
  ],
  "total": number,
  "max": number,
  "feedback": string
}

"total" must equal the sum of "awarded" values. "max" must equal the sum of "max" values.
"feedback" is one short paragraph (2-4 sentences) of overall comments addressed to the student.`;

let _systemPromptCache: string | null = null;

export function loadFrqGraderSystemPrompt(): string {
  if (_systemPromptCache) return _systemPromptCache;
  const p = path.resolve(process.cwd(), "../pipeline/prompts/system_frq_grader.md");
  if (existsSync(p)) {
    _systemPromptCache = readFileSync(p, "utf8");
  } else {
    _systemPromptCache = FALLBACK_FRQ_GRADER_SYSTEM;
  }
  return _systemPromptCache;
}

export type CriterionAward = {
  point_label: string;
  awarded: number;
  max: number;
  justification: string;
};

export type FrqGradeResult = {
  per_criterion: CriterionAward[];
  total: number;
  max: number;
  feedback: string;
};

export type GeneratedFrq = {
  archetype: FrqArchetype;
  topic_id: string;
  prompt: string;
  parts: Array<{ label?: string; prompt: string } | string>;
  reference_solution: string;
  rubric: Array<{ point_label: string; criterion: string; points: number }>;
  total_points: number;
};

/**
 * Grade an FRQ response with Codex using the local ChatGPT login.
 */
export async function gradeFrq(opts: {
  rubric: unknown;
  studentCode: string;
  referenceSolution: string;
  totalPoints: number;
  stem?: string;
}): Promise<FrqGradeResult> {
  const systemText = loadFrqGraderSystemPrompt();
  const userParts = [
    systemText,
    "",
    "Return STRICT JSON only. Do not include markdown fences.",
    "",
    opts.stem ? "## Question\n" + opts.stem + "\n" : "",
    "## Rubric (max " + opts.totalPoints + " points)",
    "```json",
    JSON.stringify(opts.rubric, null, 2),
    "```",
    "",
    "## Reference solution (graders' context only)",
    "```java",
    opts.referenceSolution,
    "```",
    "",
    "## Student response",
    "```java",
    opts.studentCode || "// (empty submission)",
    "```",
    "",
    "Award per-criterion points and return STRICT JSON only.",
  ].filter(Boolean);

  const text = await runCodex(userParts.join("\n"), 120_000);

  const parsed = parseGradeJson(text, opts.totalPoints);
  return parsed;
}

export async function generateFrq(opts: {
  archetype: FrqArchetype;
  blueprint: FrqBlueprint;
  examples: Array<{
    stem: string;
    rubric: unknown;
    total_points: number;
  }>;
  recentTitles: string[];
}): Promise<GeneratedFrq> {
  const writerPath = path.resolve(process.cwd(), "../pipeline/prompts/system_frq_writer.md");
  const writerSystem = existsSync(writerPath)
    ? readFileSync(writerPath, "utf8")
    : "You are an expert AP Computer Science A free-response item writer.";

  const prompt = [
    writerSystem,
    "",
    "Generate exactly ONE new AP CSA FRQ, not 10.",
    "Return STRICT JSON only: one object, no array, no markdown fences, no commentary.",
    "",
    "## Target slot",
    JSON.stringify(
      {
        archetype: opts.archetype,
        position: opts.blueprint.position,
        label: opts.blueprint.label,
        total_points: opts.blueprint.totalPoints,
        default_topic: opts.blueprint.defaultTopic,
        mastery_targets: opts.blueprint.masteryTargets,
        rubric_focus: opts.blueprint.rubricFocus,
      },
      null,
      2
    ),
    "",
    "## Princeton Review 2025-2026 grounding examples",
    JSON.stringify(opts.examples, null, 2),
    "",
    "## Recently generated scenario/title fragments to avoid",
    JSON.stringify(opts.recentTitles, null, 2),
    "",
    "## Required JSON shape",
    JSON.stringify(
      {
        archetype: opts.archetype,
        topic_id: opts.blueprint.defaultTopic,
        prompt:
          "Full student-facing FRQ stem with class context and method/class requirements. Any Java declarations or code snippets must be inside ```java fenced code blocks.",
        parts: [
          { label: "(a)", prompt: "Student-facing part text." },
          { label: "(b)", prompt: "Student-facing part text." },
        ],
        reference_solution: "Complete Java reference solution.",
        rubric: [
          {
            point_label: "Header / signature",
            criterion: "Concrete, testable code shape that earns this point.",
            points: 1,
          },
        ],
        total_points: opts.blueprint.totalPoints,
      },
      null,
      2
    ),
    "",
    "Hard requirements:",
    `- total_points must be exactly ${opts.blueprint.totalPoints}.`,
    "- rubric point values must sum exactly to total_points.",
    "- Make the scenario new; do not copy names, classes, or story framing from the examples.",
    "- Keep it AP CSA 2025-26 scoped: no inheritance, interfaces, abstract classes, instanceof, super, extends, or String.charAt.",
    "- Use substring(i, i+1) instead of charAt.",
    "- Use only Java Quick Reference style APIs: String, Math, Integer, Double, ArrayList, Object, File, Scanner.",
    "- The prompt should be answerable in a Bluebook editor without external files.",
    "- In prompt and parts, render every Java class declaration, method signature, field declaration, array initializer, and multi-line code snippet inside ```java fenced code blocks.",
    "- Do not leave Java code as plain prose. A partial class declaration must be one fenced code block.",
    "- The reference solution should be concise AP-style Java, not over-engineered.",
  ].join("\n");

  const text = await runCodex(prompt, 150_000);
  return normalizeGeneratedFrq(parseJsonObject(text), opts);
}

const COACH_SYSTEM = `You are a focused AP Computer Science A study coach.

The user will paste a JSON snapshot of their accumulated practice data: recent exam
scores, weakest topics, MCQ accuracy by unit, and FRQ archetype performance.

Reply with EXACTLY 2–3 sentences, no more than 280 characters total, plain text only
(no markdown, no lists, no headers). Be concrete: name 1–2 specific topics or FRQ
archetypes the user should drill, and explain briefly why based on the data. Avoid
generic encouragement and filler. If the user has almost no data, say so and suggest
they take a full practice exam first.`;

export type CoachSnapshot = {
  recent_exams: Array<{
    type: string;
    raw: number | null;
    max?: number;
    scaled: number | null;
    days_ago: number;
  }>;
  weakest_topics: Array<{
    section: string;
    name: string;
    mastery_pct: number;
    n_seen: number;
  }>;
  mcq_by_unit: Array<{ unit: number; n: number; accuracy_pct: number }>;
  frq_by_archetype: Array<{
    archetype: string;
    n: number;
    avg_pct: number;
  }>;
  total_attempts: number;
};

export async function coachSummary(snapshot: CoachSnapshot): Promise<string> {
  const prompt =
    COACH_SYSTEM +
    "\n\nPractice data:\n```json\n" +
    JSON.stringify(snapshot, null, 2) +
    "\n```\n\nGive me 2-3 sentences of focused study guidance.";
  return (await runCodex(prompt, 45_000)).trim();
}

function runCodex(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "codex",
      [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--model",
        MODEL,
        "-",
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("codex timed out"));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error((stderr || stdout || `codex exited ${code}`).trim()));
      }
    });

    child.stdin.end(prompt);
  });
}

function parseJsonObject(text: string): unknown {
  let body = text.trim();
  const fenceMatch = body.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) body = fenceMatch[1].trim();
  if (!body.startsWith("{")) {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) body = body.slice(start, end + 1);
  }
  return JSON.parse(body);
}

function normalizeGeneratedFrq(
  raw: unknown,
  opts: {
    archetype: FrqArchetype;
    blueprint: FrqBlueprint;
  }
): GeneratedFrq {
  const o = raw as Partial<GeneratedFrq>;
  const rubric = Array.isArray(o.rubric)
    ? o.rubric.map((r) => ({
        point_label: String(r.point_label ?? "Point"),
        criterion: String(r.criterion ?? ""),
        points: Number(r.points ?? 1) || 1,
      }))
    : [];
  const total = opts.blueprint.totalPoints;
  const rubricSum = rubric.reduce((sum, r) => sum + r.points, 0);
  if (!o.prompt || !o.reference_solution || rubric.length === 0 || rubricSum !== total) {
    throw new Error("generated FRQ failed shape/rubric validation");
  }
  const banned = /\b(extends|super|interface|implements|instanceof|abstract)\b|String\.charAt|\.charAt\s*\(/;
  const combined = [o.prompt, o.reference_solution, JSON.stringify(o.parts ?? [])].join("\n");
  if (banned.test(combined)) {
    throw new Error("generated FRQ used a banned 2025-26 construct");
  }

  return {
    archetype: opts.archetype,
    topic_id: typeof o.topic_id === "string" ? o.topic_id : opts.blueprint.defaultTopic,
    prompt: fenceLooseJavaBlocks(String(o.prompt)),
    parts: Array.isArray(o.parts)
      ? o.parts.map((part) =>
          typeof part === "string"
            ? fenceLooseJavaBlocks(part)
            : { ...part, prompt: fenceLooseJavaBlocks(String(part.prompt ?? "")) }
        )
      : [],
    reference_solution: String(o.reference_solution),
    rubric,
    total_points: total,
  };
}

function fenceLooseJavaBlocks(text: string): string {
  if (text.includes("```")) return text;

  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!looksLikeJavaBlockStart(line)) {
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
      if (!sawBrace && i > 0 && current.trim() === "") break;
      if (sawBrace && balance > 0) {
        i++;
        continue;
      }
      if (!sawBrace && !looksLikeJavaContinuation(next)) break;
      i++;
    }

    out.push("```java", block.join("\n"), "```");
  }
  return out.join("\n");
}

function looksLikeJavaBlockStart(line: string): boolean {
  return /^\s*(public|private|protected)\s+(class|static|final|boolean|int|double|String|void|ArrayList<|[A-Z][A-Za-z0-9_]*\s*\[?\]?)/.test(
    line
  );
}

function looksLikeJavaContinuation(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed === "" ||
    /^[{}]/.test(trimmed) ||
    /[;{}]$/.test(trimmed) ||
    /^\*/.test(trimmed) ||
    /^\/\*\*/.test(trimmed)
  );
}

function parseGradeJson(text: string, fallbackMax: number): FrqGradeResult {
  // Strip markdown fences if present.
  let body = text.trim();
  const fenceMatch = body.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) body = fenceMatch[1].trim();

  // Extract first {...} block if there's leading prose.
  if (!body.startsWith("{")) {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) body = body.slice(start, end + 1);
  }

  let obj: unknown;
  try {
    obj = JSON.parse(body);
  } catch {
    return {
      per_criterion: [],
      total: 0,
      max: fallbackMax,
      feedback: "Grader returned unparseable output. Raw response: " + text.slice(0, 500),
    };
  }

  const o = obj as Partial<FrqGradeResult>;
  const per = Array.isArray(o.per_criterion) ? o.per_criterion : [];
  const total = typeof o.total === "number" ? o.total : per.reduce((a, c) => a + (Number(c.awarded) || 0), 0);
  const max = typeof o.max === "number" ? o.max : (per.reduce((a, c) => a + (Number(c.max) || 0), 0) || fallbackMax);
  const feedback = typeof o.feedback === "string" ? o.feedback : "";
  return { per_criterion: per, total, max, feedback };
}
