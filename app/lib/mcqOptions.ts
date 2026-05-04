type OptionObject = {
  label?: unknown;
  text?: unknown;
  value?: unknown;
};

const LETTERS = ["A", "B", "C", "D"] as const;

export function parseMcqOptions(optionsJson: string): string[] {
  return normalizeMcqOptions(JSON.parse(optionsJson));
}

export function normalizeMcqOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  if (raw.every((opt) => typeof opt === "string")) {
    return raw.slice(0, 4);
  }

  const byLabel = new Map<string, string>();
  const fallback: string[] = [];

  for (const opt of raw) {
    if (typeof opt === "string") {
      fallback.push(opt);
      continue;
    }
    if (!opt || typeof opt !== "object") {
      fallback.push(String(opt ?? ""));
      continue;
    }

    const obj = opt as OptionObject;
    const text = String(obj.text ?? obj.value ?? "");
    const label = typeof obj.label === "string" ? obj.label.toUpperCase() : "";
    if (LETTERS.includes(label as (typeof LETTERS)[number])) {
      byLabel.set(label, text);
    } else {
      fallback.push(text);
    }
  }

  if (byLabel.size > 0) {
    return LETTERS.map((letter, i) => byLabel.get(letter) ?? fallback[i] ?? "");
  }

  return fallback.slice(0, 4);
}
