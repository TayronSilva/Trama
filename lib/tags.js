export function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : String(tags ?? '').split(',');

  const result = [];
  const seen = new Set();
  for (const raw of source) {
    const tag = String(raw ?? '').trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}
