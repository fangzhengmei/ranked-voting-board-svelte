export function calculateRankings(options, votes) {
  if (!Array.isArray(options)) return []
  if (options.length === 0) return []
  
  const validOptions = options.filter(opt => 
    opt && typeof opt === 'object' && 
    typeof opt.id === 'string' && opt.id && 
    typeof opt.name === 'string'
  )
  
  if (validOptions.length === 0) return []
  
  const n = validOptions.length
  const optionIds = new Set(validOptions.map(opt => opt.id))
  
  const scores = new Map()
  const rankCounts = new Map()
  
  validOptions.forEach(opt => {
    scores.set(opt.id, 0)
    rankCounts.set(opt.id, Array(n).fill(0))
  })
  
  const validVotes = Array.isArray(votes) 
    ? votes.filter(vote => vote && typeof vote === 'object' && Array.isArray(vote.ranking))
    : []
  
  validVotes.forEach(vote => {
    const normalizedRanking = []
    const seenIds = new Set()
    
    for (const item of vote.ranking) {
      if (typeof item !== 'string' || !item) continue
      if (!optionIds.has(item)) continue
      if (seenIds.has(item)) continue
      if (normalizedRanking.length >= n) break
      
      seenIds.add(item)
      normalizedRanking.push(item)
    }
    
    for (const opt of validOptions) {
      if (!seenIds.has(opt.id) && normalizedRanking.length < n) {
        normalizedRanking.push(opt.id)
        seenIds.add(opt.id)
      }
    }
    
    normalizedRanking.forEach((optionId, position) => {
      const score = n - 1 - position
      scores.set(optionId, (scores.get(optionId) || 0) + score)
      
      const counts = rankCounts.get(optionId)
      if (counts && position < counts.length) {
        counts[position]++
      }
    })
  })
  
  const rankedOptions = validOptions
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

export function sanitizeRanking(ranking, validOptionIds) {
  if (!Array.isArray(ranking)) return [...validOptionIds]
  
  const seenIds = new Set()
  const result = []
  
  for (const optionId of ranking) {
    if (typeof optionId !== 'string' || !optionId) continue
    if (!validOptionIds.includes(optionId)) continue
    if (seenIds.has(optionId)) continue
    
    seenIds.add(optionId)
    result.push(optionId)
  }
  
  for (const optionId of validOptionIds) {
    if (!seenIds.has(optionId)) {
      result.push(optionId)
    }
  }
  
  return result
}

export function validateVote(vote, validOptions) {
  const errors = []
  
  if (!vote || typeof vote !== 'object') {
    return { valid: false, errors: ['投票对象无效'], ranking: [] }
  }
  
  const validOptionIds = validOptions.map(opt => opt.id)
  const { ranking } = vote
  
  if (!Array.isArray(ranking)) {
    return { valid: false, errors: ['ranking 必须是数组'], ranking: [...validOptionIds] }
  }
  
  const seenIds = new Set()
  const duplicates = new Set()
  const unknownIds = new Set()
  const invalidTypes = []
  
  for (const item of ranking) {
    if (typeof item !== 'string' || !item) {
      invalidTypes.push(typeof item === 'string' ? '空字符串' : typeof item)
      continue
    }
    
    if (!validOptionIds.includes(item)) {
      unknownIds.add(item)
      continue
    }
    
    if (seenIds.has(item)) {
      duplicates.add(item)
    } else {
      seenIds.add(item)
    }
  }
  
  if (duplicates.size > 0) {
    errors.push(`发现重复候选: ${Array.from(duplicates).join(', ')}`)
  }
  
  if (unknownIds.size > 0) {
    errors.push(`发现未知候选ID: ${Array.from(unknownIds).join(', ')}`)
  }
  
  if (invalidTypes.length > 0) {
    errors.push(`发现无效类型: ${Array.from(new Set(invalidTypes)).join(', ')}`)
  }
  
  const missingIds = validOptionIds.filter(id => !seenIds.has(id))
  if (missingIds.length > 0) {
    const missingNames = missingIds
      .map(id => validOptions.find(opt => opt.id === id)?.name || id)
    errors.push(`缺少候选: ${missingNames.join(', ')}`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    ranking: sanitizeRanking(ranking, validOptionIds)
  }
}
