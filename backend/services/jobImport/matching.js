// Name normalisation + fuzzy scoring shared by driver/contractor/customer
// resolution. Scores are 0..1; 1 means the normalised names are identical.

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function similarity(rawA, rawB) {
  const a = normalizeName(rawA);
  const b = normalizeName(rawB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const compactA = a.replace(/ /g, "");
  const compactB = b.replace(/ /g, "");
  if (compactA === compactB) return 0.98;
  // "romeo" vs "romeo kitchens", "cabs" vs "cabs ngo"
  const tokensA = a.split(" ");
  const tokensB = b.split(" ");
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (shorter.every((token, i) => longer[i] === token)) return 0.9;
  const distance = levenshtein(compactA, compactB);
  return 1 - distance / Math.max(compactA.length, compactB.length);
}

// Returns up to `limit` candidates scoring >= minScore, best first.
function rankCandidates(name, items, getName, { minScore = 0.75, limit = 5 } = {}) {
  return items
    .map((item) => ({ item, score: similarity(name, getName(item)) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { normalizeName, similarity, rankCandidates };
