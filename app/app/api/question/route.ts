import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseMcqOptions } from "@/lib/mcqOptions";
import { pickMcq, pickTopic } from "@/lib/selector";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topicParam = url.searchParams.get("topic") || undefined;
  const unitParam = url.searchParams.get("unit");
  const restrictUnit = unitParam ? Number(unitParam) : undefined;

  const topic_id = pickTopic({
    restrictTopic: topicParam,
    restrictUnit: restrictUnit && !Number.isNaN(restrictUnit) ? restrictUnit : undefined,
  });
  const picked = pickMcq(topic_id);
  if (!picked) {
    return NextResponse.json({ error: "no questions for topic", topic_id }, { status: 404 });
  }

  const row = db()
    .prepare(
      `SELECT q.id, q.topic_id, q.stem, q.options_json, q.difficulty,
              t.unit, t.section, t.name AS topic_name
         FROM questions q JOIN topics t ON t.id = q.topic_id
        WHERE q.id = ?`
    )
    .get(picked.id) as {
    id: string;
    topic_id: string;
    stem: string;
    options_json: string;
    difficulty: number;
    unit: number;
    section: string;
    topic_name: string;
  };

  return NextResponse.json({
    id: row.id,
    topic_id: row.topic_id,
    topic: { unit: row.unit, section: row.section, name: row.topic_name },
    stem: row.stem,
    options: parseMcqOptions(row.options_json),
    difficulty: row.difficulty,
  });
}
