import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rebuildSkillFromAttempts } from "@/lib/skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isInteger(examId) || examId <= 0) {
    return NextResponse.json({ error: "invalid exam id" }, { status: 400 });
  }

  const d = db();
  const existing = d.prepare(`SELECT id FROM exams WHERE id = ?`).get(examId);
  if (!existing) {
    return NextResponse.json({ error: "exam not found" }, { status: 404 });
  }

  const tx = d.transaction(() => {
    const attempts = d.prepare(`DELETE FROM attempts WHERE exam_id = ?`).run(examId);
    d.prepare(`DELETE FROM exam_items WHERE exam_id = ?`).run(examId);
    d.prepare(`DELETE FROM exams WHERE id = ?`).run(examId);
    return attempts.changes;
  });

  const deletedAttempts = tx();
  if (deletedAttempts > 0) {
    rebuildSkillFromAttempts();
  }

  return NextResponse.json({ ok: true, deleted_attempts: deletedAttempts });
}
