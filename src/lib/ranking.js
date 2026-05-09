export function calculateRankings(options, votes) {
  if (options.length === 0) return []
  if (votes.length === 0) return options.map((opt, idx) => ({ ...opt, score: 0, rank: idx + 1 }))

  const n = options.length
  const scores = new Map()
  const rankCounts = new Map()
  const optionNames = new Map()

  options.forEach(opt => {
    scores.set(opt.id, 0)
    rankCounts.set(opt.id, Array(n).fill(0))
    optionNames.set(opt.id, opt.name)
  })

  votes.forEach(vote => {
    vote.ranking.forEach((optionId, idx) => {
      const score = n - 1 - idx
      scores.set(optionId, (scores.get(optionId) || 0) + score)
      const counts = rankCounts.get(optionId)
      if (counts) counts[idx]++
    })
  })

  const rankedOptions = options
    .map(opt => ({
      ...opt,
      score: scores.get(opt.id) || 0,
      rankCounts: [...(rankCounts.get(opt.id) || [])]
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score

      for (let i = 0; i < n; i++) {
        if (a.rankCounts[i] !== b.rankCounts[i]) {
          return b.rankCounts[i] - a.rankCounts[i]
        }
      }

      return a.name.localeCompare(b.name)
    })

  let currentRank = 1
  const result = []
  
  for (let i = 0; i < rankedOptions.length; i++) {
    if (i > 0 && !isSameRank(rankedOptions[i - 1], rankedOptions[i])) {
      currentRank = i + 1
    }
    result.push({
      ...rankedOptions[i],
      rank: currentRank
    })
  }

  return result
}

function isSameRank(a, b) {
  if (a.score !== b.score) return false
  for (let i = 0; i < a.rankCounts.length; i++) {
    if (a.rankCounts[i] !== b.rankCounts[i]) return false
  }
  return true
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
