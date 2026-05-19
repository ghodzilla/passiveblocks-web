import fs from "fs";
import path from "path";
import { LEARN_ARTICLES } from "./learn";

export type DraftType = "newsletter" | "learn" | "x-posts" | "guide" | "other";

export interface DraftMeta {
  slug: string;          // filename without .md
  filename: string;      // e.g. newsletter-issue-001.md
  title: string;
  type: DraftType;
  typeLabel: string;
  modifiedAt: string;    // ISO date
  modifiedAtMs: number;
  wordCount: number;
  preview: string;       // first ~200 chars of body
  status: "LIVE" | "DRAFT";
}

export interface DraftFull extends DraftMeta {
  content: string;
}

const DRAFTS_DIR = path.join(process.cwd(), "content", "drafts");

function classify(filename: string): { type: DraftType; typeLabel: string } {
  const f = filename.toLowerCase();
  if (f.startsWith("newsletter-")) return { type: "newsletter", typeLabel: "Newsletter" };
  if (f.startsWith("x-posts-") || f.startsWith("x-thread-")) return { type: "x-posts", typeLabel: "X Posts" };
  if (f.startsWith("guide-")) return { type: "guide", typeLabel: "Guide" };
  if (f.startsWith("learn-")) return { type: "learn", typeLabel: "Learn Article" };
  return { type: "other", typeLabel: "Other" };
}

function extractTitle(raw: string, fallback: string): string {
  const lines = raw.split("\n");
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) return m[1].replace(/[*_`]/g, "").trim();
  }
  return fallback;
}

function stripMarkdown(s: string): string {
  return s
    .replace(/^---[\s\S]*?---/, "") // front matter
    .replace(/^#+\s+.*$/gm, "")     // headings
    .replace(/[*_`>#]/g, "")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveLiveStatus(filename: string): "LIVE" | "DRAFT" {
  // Match drafts to existing live LEARN_ARTICLES by slug overlap.
  const base = filename.replace(/\.md$/, "").toLowerCase();
  for (const a of LEARN_ARTICLES) {
    const s = a.slug.toLowerCase();
    if (base === s) return "LIVE";
    if (base === `learn-${s}`) return "LIVE";
    // Heuristic: trailing slug match (e.g. learn-impermanent-loss.md ~ how-impermanent-loss-works)
    if (s.length > 6 && base.includes(s)) return "LIVE";
  }
  return "DRAFT";
}

function readAllSync(): { file: string; raw: string; mtime: Date }[] {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  const entries = fs.readdirSync(DRAFTS_DIR).filter((f) => f.endsWith(".md"));
  return entries.map((file) => {
    const full = path.join(DRAFTS_DIR, file);
    const raw = fs.readFileSync(full, "utf8");
    const stat = fs.statSync(full);
    return { file, raw, mtime: stat.mtime };
  });
}

export function getAllDrafts(): DraftMeta[] {
  return readAllSync()
    .map(({ file, raw, mtime }) => {
      const slug = file.replace(/\.md$/, "");
      const { type, typeLabel } = classify(file);
      const title = extractTitle(raw, slug);
      const text = stripMarkdown(raw);
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      const preview = text.slice(0, 220);
      return {
        slug,
        filename: file,
        title,
        type,
        typeLabel,
        modifiedAt: mtime.toISOString().slice(0, 10),
        modifiedAtMs: mtime.getTime(),
        wordCount: words,
        preview,
        status: deriveLiveStatus(file),
      } satisfies DraftMeta;
    })
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs);
}

export function getDraft(slug: string): DraftFull | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  const filename = `${slug}.md`;
  const full = path.join(DRAFTS_DIR, filename);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, "utf8");
  const stat = fs.statSync(full);
  const { type, typeLabel } = classify(filename);
  const title = extractTitle(raw, slug);
  const text = stripMarkdown(raw);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  return {
    slug,
    filename,
    title,
    type,
    typeLabel,
    modifiedAt: stat.mtime.toISOString().slice(0, 10),
    modifiedAtMs: stat.mtime.getTime(),
    wordCount: words,
    preview: text.slice(0, 220),
    status: deriveLiveStatus(filename),
    content: raw,
  };
}

export function groupByType(drafts: DraftMeta[]): { type: DraftType; label: string; items: DraftMeta[] }[] {
  const order: { type: DraftType; label: string }[] = [
    { type: "newsletter", label: "Newsletter Issues" },
    { type: "learn", label: "Learn Articles" },
    { type: "guide", label: "Guides" },
    { type: "x-posts", label: "X Posts" },
    { type: "other", label: "Other" },
  ];
  return order
    .map(({ type, label }) => ({ type, label, items: drafts.filter((d) => d.type === type) }))
    .filter((g) => g.items.length > 0);
}
