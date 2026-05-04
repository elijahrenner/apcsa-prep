import { readFileSync } from "node:fs";
import path from "node:path";

import { NotebookReader } from "@/components/NotebookReader";

export const dynamic = "force-dynamic";

const NOTES_PATH = path.resolve(process.cwd(), "../sources/apcsa_notes.md");

export default function NotebookPage() {
  const markdown = readFileSync(NOTES_PATH, "utf8");
  return <NotebookReader markdown={markdown} />;
}
