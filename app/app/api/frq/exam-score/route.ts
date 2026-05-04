import { NextResponse } from "next/server";

import { recordFrqExam } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  type: "frq_full" | "official";
  practice_exam_id?: number | null;
  items: Array<{
    question_id: string;
    code: string;
    total: number;
    max: number;
    per_criterion: unknown;
    feedback: string;
  }>;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!body.type || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "missing type or items" }, { status: 400 });
  }

  const result = recordFrqExam({
    type: body.type,
    practice_exam_id: body.practice_exam_id ?? null,
    items: body.items,
  });

  return NextResponse.json(result);
}
