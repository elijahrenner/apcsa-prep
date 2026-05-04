import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  FRQ_BLUEPRINT_BY_ID,
  frqArchetypeLabel,
  isFrqArchetype,
  type FrqArchetype,
} from "@/lib/frqBlueprint";
import { generateFrq } from "@/lib/modelClient";
import { pickFrqArchetype } from "@/lib/selector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  archetype?: string;
};

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const archetype: FrqArchetype = isFrqArchetype(body.archetype)
    ? body.archetype
    : pickFrqArchetype();
  const blueprint = FRQ_BLUEPRINT_BY_ID.get(archetype);
  if (!blueprint) {
    return NextResponse.json({ error: "unknown archetype" }, { status: 400 });
  }

  const examples = db()
    .prepare(
      `SELECT stem, rubric_json, total_points
         FROM questions
        WHERE type = 'frq' AND archetype = ? AND source = 'princeton-2025'
        ORDER BY RANDOM()
        LIMIT 2`
    )
    .all(archetype)
    .map((row) => {
      const r = row as { stem: string; rubric_json: string; total_points: number };
      let rubric: unknown = [];
      try {
        rubric = JSON.parse(r.rubric_json);
      } catch {
        rubric = [];
      }
      return {
        stem: r.stem.slice(0, 3500),
        rubric,
        total_points: r.total_points,
      };
    });

  const recentTitles = db()
    .prepare(
      `SELECT stem
         FROM questions
        WHERE type = 'frq' AND archetype = ? AND source = 'live-generated'
        ORDER BY created_at DESC
        LIMIT 12`
    )
    .all(archetype)
    .map((row) => String((row as { stem: string }).stem).slice(0, 160));

  let generated;
  try {
    generated = await generateFrq({
      archetype,
      blueprint,
      examples,
      recentTitles,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "generator failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  const id = `frq_live_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const parts = generated.parts.map((part) =>
    typeof part === "string" ? part : [part.label, part.prompt].filter(Boolean).join(" ")
  );

  db()
    .prepare(
      `INSERT INTO questions
         (id, topic_id, type, archetype, stem, parts_json,
          reference_solution, rubric_json, total_points, source, difficulty)
       VALUES
         (@id, @topic_id, 'frq', @archetype, @stem, @parts_json,
          @reference_solution, @rubric_json, @total_points, 'live-generated', 4)`
    )
    .run({
      id,
      topic_id: generated.topic_id || blueprint.defaultTopic,
      archetype,
      stem: generated.prompt,
      parts_json: JSON.stringify(parts),
      reference_solution: generated.reference_solution,
      rubric_json: JSON.stringify(generated.rubric),
      total_points: generated.total_points,
    });

  return NextResponse.json({
    id,
    topic_id: generated.topic_id || blueprint.defaultTopic,
    archetype,
    label: frqArchetypeLabel(archetype),
    source: "live-generated",
    stem: generated.prompt,
    parts,
    rubric: generated.rubric,
    total_points: generated.total_points,
    blueprint,
  });
}

