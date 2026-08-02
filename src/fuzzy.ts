// 模糊比對：前綴 > 子字串 > 字元子序列（如「大附」命中「大師附加」）。
// 分數高者在前；同分維持原順序（sort 穩定，保留使用頻率排序）。

export function matchScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t.startsWith(q)) return 3
  if (t.includes(q)) return 2
  return isSubsequence(q, t) ? 1 : 0
}

function isSubsequence(query: string, target: string): boolean {
  let i = 0
  for (const ch of target) {
    if (ch === query[i]) i++
    if (i === query.length) return true
  }
  return i === query.length
}

export function fuzzyFilter(query: string, items: string[], limit = 20): string[] {
  const q = query.trim()
  if (!q) return items.slice(0, limit)
  return items
    .map((s) => ({ s, score: matchScore(q, s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s)
    .slice(0, limit)
}
