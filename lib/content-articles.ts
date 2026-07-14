import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { LearnArticle } from './learn'

// Label mapping for the 4 pillar categories
const PILLAR_TAGS: Record<string, string> = {
  'crypto-yield': 'Crypto Yield',
  'stocks': 'Dividend & Income Stocks',
  'airdrops': 'Airdrops',
  'ai-crypto': 'AI×Crypto',
}

// Module-level cache — populated once at first call (build time in Next.js SSG)
let _cache: LearnArticle[] | null = null

export function getFileBasedArticles(): LearnArticle[] {
  if (_cache) return _cache

  const articlesDir = path.join(process.cwd(), 'content', 'articles')
  if (!fs.existsSync(articlesDir)) {
    _cache = []
    return _cache
  }

  const articles: LearnArticle[] = []

  // Walk pillar subdirectories
  const entries = fs.readdirSync(articlesDir)
  for (const entry of entries) {
    const pillarDir = path.join(articlesDir, entry)
    if (!fs.statSync(pillarDir).isDirectory()) continue

    const files = fs.readdirSync(pillarDir).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      const slug = file.replace(/\.md$/, '')
      const fullPath = path.join(pillarDir, file)
      const raw = fs.readFileSync(fullPath, 'utf-8')
      const { data, content } = matter(raw)

      if (!data.title) continue

      const category: string = (data.pillar as string) ?? entry
      const tag: string = PILLAR_TAGS[category] ?? category

      articles.push({
        slug,
        title: (data.title as string) ?? '',
        category,
        tag,
        excerpt: (data.excerpt as string) ?? '',
        date: (data.date as string) ?? '',
        readTime: (data.readTime as string) ?? '5 min',
        content,
        publishedAt: (data.date as string) ?? undefined,
        updatedAt: (data.updated as string) ?? undefined,
        sources: (data.sources as Array<{ label: string; url: string }>) ?? [],
      })
    }
  }

  _cache = articles
  return articles
}
