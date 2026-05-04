import { NextResponse } from "next/server";

import { db, type FRQRow } from "@/lib/db";
import {
  FRQ_BLUEPRINT_BY_ID,
  frqArchetypeLabel,
  isFrqArchetype,
  type FrqArchetype,
} from "@/lib/frqBlueprint";
import { pickFrq } from "@/lib/selector";

export const dynamic = "force-dynamic";

type SourceFilter = "all" | "generated" | "princeton-2025";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const archetypeParam = url.searchParams.get("archetype");
  const topicParam = url.searchParams.get("topic") || undefined;
  const sourceParam = url.searchParams.get("source") as SourceFilter | null;
  const source: SourceFilter =
    sourceParam === "generated" || sourceParam === "princeton-2025" ? sourceParam : "all";

  const restrictArchetype: FrqArchetype | undefined = isFrqArchetype(archetypeParam)
    ? archetypeParam
    : undefined;

  const picked = pickFrq({
    restrictArchetype,
    restrictTopic: topicParam,
    source,
  });
  if (!picked) {
    return NextResponse.json(
      { error: "no frqs for selection", archetype: archetypeParam, topic: topicParam, source },
      { status: 404 }
    );
  }

  const row = db()
    .prepare(
      `SELECT id, topic_id, archetype, stem, parts_json, reference_solution,
              rubric_json, total_points, source
         FROM questions
        WHERE id = ? AND type = 'frq'`
    )
    .get(picked.id) as
    | (FRQRow & {
        source: string;
      })
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "unknown frq" }, { status: 404 });
  }

  const blueprint = FRQ_BLUEPRINT_BY_ID.get(row.archetype as FrqArchetype);
  let parts: string[] = [];
  let rubric: Array<{ point_label: string; criterion: string; points: number }> = [];
  try {
    const parsed = row.parts_json ? JSON.parse(row.parts_json) : [];
    if (Array.isArray(parsed)) {
      parts = parsed.map((p) =>
        typeof p === "string" ? p : String(p?.prompt ?? p?.text ?? JSON.stringify(p))
      );
    }
  } catch {
    parts = [];
  }
  try {
    const parsed = JSON.parse(row.rubric_json);
    if (Array.isArray(parsed)) {
      rubric = normalizeRubricPreview(parsed, row.total_points || blueprint?.totalPoints || 7);
    }
  } catch {
    rubric = [];
  }

  return NextResponse.json({
    id: row.id,
    topic_id: row.topic_id,
    archetype: row.archetype,
    label: frqArchetypeLabel(row.archetype),
    source: row.source,
    stem: row.stem,
    parts,
    rubric,
    total_points: row.total_points || blueprint?.totalPoints || 7,
    blueprint,
  });
}

function normalizeRubricPreview(
  parsed: Array<Record<string, unknown>>,
  totalPoints: number
): Array<{ point_label: string; criterion: string; points: number }> {
  const rows = parsed.map((r) => ({
    point_label: String(r.point_label ?? r.label ?? r.point ?? "Point"),
    criterion: String(r.criterion ?? r.what_to_award ?? ""),
    points: parseRubricPoints(r),
    hasPointField: typeof r.point === "string",
  }));

  if (!rows.some((r) => r.hasPointField)) {
    return rows.map(({ point_label, criterion, points }) => ({ point_label, criterion, points }));
  }

  const detailed = rows.filter((r) => {
    if (r.points !== 1) return false;
    if (/^\+?0$/.test(r.point_label.trim())) return false;
    if (/^part\s+\([a-d]\)$/i.test(r.criterion.trim())) return false;
    return !r.criterion.trim().startsWith("+1:");
  });
  const detailedTotal = detailed.reduce((sum, r) => sum + r.points, 0);
  if (detailed.length > 0 && detailedTotal === totalPoints) {
    return detailed.map(({ point_label, criterion, points }) => ({ point_label, criterion, points }));
  }

  return rows
    .filter((r) => r.points > 0 && !/^\+?0$/.test(r.point_label.trim()))
    .map(({ point_label, criterion, points }) => ({ point_label, criterion, points }));
}

function parseRubricPoints(r: Record<string, unknown>): number {
  const direct = Number(r.points ?? r.max);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (typeof r.point === "string") {
    const match = r.point.match(/\+?(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 1;
}
