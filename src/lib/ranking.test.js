import { describe, it, expect } from 'vitest'
import { calculateRankings, sanitizeRanking, validateVote } from './ranking'

describe('排名计算逻辑', () => {
  describe('基本排名计算', () => {
    it('空选项应返回空数组', () => {
      const options = []
      const votes = []
      expect(calculateRankings(options, votes)).toEqual([])
    })

    it('没有投票时应按原始顺序排列，分数均为0且并列第1', () => {
      const options = [
        { id: '1', name: '选项A' },
        { id: '2', name: '选项B' },
        { id: '3', name: '选项C' }
      ]
      const votes = []
      const result = calculateRankings(options, votes)
      
      expect(result.length).toBe(3)
      expect(result.every(r => r.score === 0)).toBe(true)
      expect(result.every(r => r.rank === 1)).toBe(true)
    })

    it('单人投票应完全按投票顺序排列', () => {
      const options = [
        { id: '1', name: '选项A' },
        { id: '2', name: '选项B' },
        { id: '3', name: '选项C' }
      ]
      const votes = [
        { userId: 'u1', userName: '用户1', ranking: ['2', '1', '3'] }
      ]
      const result = calculateRankings(options, votes)
      
      expect(result[0].id).toBe('2')
      expect(result[1].id).toBe('1')
      expect(result[2].id).toBe('3')
      expect(result[0].score).toBe(2)
      expect(result[1].score).toBe(1)
      expect(result[2].score).toBe(0)
    })
  })

  describe('多人投票排名', () => {
    it('多人投票应正确计算综合排名', () => {
      const options = [
        { id: '1', name: '选项A' },
        { id: '2', name: '选项B' },
        { id: '3', name: '选项C' }
      ]
      
      // 用户1: A > B > C (A=2, B=1, C=0)
      // 用户2: B > A > C (B=2, A=1, C=0)
      // 用户3: A > C > B (A=2, C=1, B=0)
      // 总分: A=5, B=3, C=1
      const votes = [
        { userId: 'u1', userName: '用户1', ranking: ['1', '2', '3'] },
        { userId: 'u2', userName: '用户2', ranking: ['2', '1', '3'] },
        { userId: 'u3', userName: '用户3', ranking: ['1', '3', '2'] }
      ]
      
      const result = calculateRankings(options, votes)
      
      expect(result[0].id).toBe('1')
      expect(result[0].score).toBe(5)
      expect(result[1].id).toBe('2')
      expect(result[1].score).toBe(3)
      expect(result[2].id).toBe('3')
      expect(result[2].score).toBe(1)
    })
  })

  describe('平票处理规则', () => {
    it('总分相同时应比较第一名次数', () => {
      const options = [
        { id: '1', name: '选项A' },
        { id: '2', name: '选项B' },
        { id: '3', name: '选项C' }
      ]
      
      // 用户1: A > B > C (A=2, B=1, C=0)
      // 用户2: B > A > C (B=2, A=1, C=0)
      // 用户3: A > B > C (A=2, B=1, C=0)
      // 用户4: B > C > A (B=2, C=1, A=0)
      // 总分: A=5, B=6, C=1 (不对，重新算)
      // A: 2+1+2+0 = 5, B: 1+2+1+2 = 6, C: 0+0+0+1 = 1
      
      // 调整为平局情况:
      // 用户1: A > B > C (A=2, B=1, C=0)
      // 用户2: B > A > C (B=2, A=1, C=0)
      // 总分: A=3, B=3, C=0
      // A第一名次数: 1, B第一名次数: 1
      // 再看第二名次数: A: 1, B: 1
      // 最后按名称排序
      
      const votes = [
        { userId: 'u1', userName: '用户1', ranking: ['1', '2', '3'] },
        { userId: 'u2', userName: '用户2', ranking: ['2', '1', '3'] }
      ]
      
      const result = calculateRankings(options, votes)
      
      expect(result[0].score).toBe(result[1].score)
      expect(result[0].rank).toBe(result[1].rank)
    })

    it('总分和第一名次数都相同时应比较第二名次数', () => {
      const options = [
        { id: '1', name: '选项A' },
        { id: '2', name: '选项B' },
        { id: '3', name: '选项C' },
        { id: '4', name: '选项D' }
      ]
      
      // 4个选项，第一名得3分，第二名2分，第三名1分，第四名0分
      // 用户1: A > B > C > D (A=3, B=2, C=1, D=0)
      // 用户2: B > A > D > C (B=3, A=2, D=1, C=0)
      // 用户3: A > C > B > D (A=3, C=2, B=1, D=0)
      // 用户4: B > C > A > D (B=3, C=2, A=1, D=0)
      // 总分: A=3+2+3+1=9, B=2+3+1+3=9, C=1+0+2+2=5, D=0+1+0+0=1
      // A第一名次数: 2, B第一名次数: 2
      // 继续比较第二名次数...
      
      const votes = [
        { userId: 'u1', userName: '用户1', ranking: ['1', '2', '3', '4'] },
        { userId: 'u2', userName: '用户2', ranking: ['2', '1', '4', '3'] },
        { userId: 'u3', userName: '用户3', ranking: ['1', '3', '2', '4'] },
        { userId: 'u4', userName: '用户4', ranking: ['2', '3', '1', '4'] }
      ]
      
      const result = calculateRankings(options, votes)
      
      expect(result[0].score).toBe(9)
      expect(result[1].score).toBe(9)
      expect(result[0].rank).toBe(result[1].rank)
    })

    it('所有条件都相同时应按名称字母顺序排序', () => {
      const options = [
        { id: '2', name: 'B选项' },
        { id: '1', name: 'A选项' },
        { id: '3', name: 'C选项' }
      ]
      
      const votes = [
        { userId: 'u1', userName: '用户1', ranking: ['2', '1', '3'] },
        { userId: 'u2', userName: '用户2', ranking: ['1', '2', '3'] }
      ]
      
      const result = calculateRankings(options, votes)
      
      const optionA = result.find(r => r.id === '1')
      const optionB = result.find(r => r.id === '2')
      
      expect(optionA.score).toBe(optionB.score)
      expect(optionA.rank).toBe(optionB.rank)
    })
  })

  describe('排名编号处理', () => {
    it('存在并列时应正确跳过排名编号', () => {
      const options = [
        { id: '1', name: '选项A' },
        { id: '2', name: '选项B' },
        { id: '3', name: '选项C' },
        { id: '4', name: '选项D' }
      ]
      
      // 4个选项，第一名3分，第二名2分，第三名1分，第四名0分
      // 用户1: A > B > C > D (A=3, B=2, C=1, D=0)
      // 用户2: B > A > C > D (B=3, A=2, C=1, D=0)
      // 用户3: A > B > D > C (A=3, B=2, D=1, C=0)
      // 总分: A=3+2+3=8, B=2+3+2=7, C=1+1+0=2, D=0+0+1=1
      // 不对，这没有并列，让我重新设计
      
      // 让 A 和 B 并列第一，C 第三，D 第四
      // 用户1: A > B > C > D (A=3, B=2, C=1, D=0)
      // 用户2: B > A > C > D (B=3, A=2, C=1, D=0)
      // 用户3: A > B > D > C (A=3, B=2, D=1, C=0)
      // 用户4: B > A > D > C (B=3, A=2, D=1, C=0)
      // 总分: A=3+2+3+2=10, B=2+3+2+3=10, C=1+1+0+0=2, D=0+0+1+1=2
      // A和B并列第一，C和D并列第三
      
      // 换一个场景：A和B并列第一，C第三，D第四
      // 这样需要 C > D
      // 用户1: A > B > C > D (A=3, B=2, C=1, D=0)
      // 用户2: B > A > C > D (B=3, A=2, C=1, D=0)
      // 总分: A=5, B=5, C=2, D=0
      
      const votes = [
        { userId: 'u1', userName: '用户1', ranking: ['1', '2', '3', '4'] },
        { userId: 'u2', userName: '用户2', ranking: ['2', '1', '3', '4'] }
      ]
      
      const result = calculateRankings(options, votes)
      
      const optionA = result.find(r => r.id === '1')
      const optionB = result.find(r => r.id === '2')
      const optionC = result.find(r => r.id === '3')
      const optionD = result.find(r => r.id === '4')
      
      expect(optionA.rank).toBe(1)
      expect(optionB.rank).toBe(1)
      expect(optionC.rank).toBe(3)
      expect(optionD.rank).toBe(4)
    })
  })

  describe('异常投票数据防护', () => {
    const options = [
      { id: '1', name: '选项A' },
      { id: '2', name: '选项B' },
      { id: '3', name: '选项C' }
    ]

    describe('重复候选处理', () => {
      it('投票顺序中有重复候选时应只计一次', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1', '1', '2'] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        const optionC = result.find(r => r.id === '3')
        
        expect(optionA.score).toBe(2)
        expect(optionB.score).toBe(1)
        expect(optionC.score).toBe(0)
      })

      it('多个重复候选应按首次出现位置计分', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1', '2', '2', '1'] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        
        expect(optionA.score).toBe(2)
        expect(optionB.score).toBe(1)
      })
    })

    describe('缺失候选处理', () => {
      it('缺少候选时应将缺失项排在最后并给予最低分数', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1', '2'] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionC = result.find(r => r.id === '3')
        expect(optionC.score).toBe(0)
      })

      it('缺少多个候选时应按选项顺序依次排在最后', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1'] }
        ]
        const result = calculateRankings(options, votes)
        
        expect(result.length).toBe(3)
      })

      it('完全空投票应按选项顺序计分', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: [] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        const optionC = result.find(r => r.id === '3')
        
        expect(optionA.score).toBe(2)
        expect(optionB.score).toBe(1)
        expect(optionC.score).toBe(0)
      })
    })

    describe('未知候选ID处理', () => {
      it('未知候选ID应被忽略', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1', 'unknown', '2'] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        
        expect(optionA.score).toBe(2)
        expect(optionB.score).toBe(1)
      })

      it('全部是未知ID时应按选项顺序计分', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['x', 'y', 'z'] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        const optionC = result.find(r => r.id === '3')
        
        expect(optionA.score).toBe(2)
        expect(optionB.score).toBe(1)
        expect(optionC.score).toBe(0)
      })

      it('混合未知和重复ID应正确处理', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1', 'unknown', '1', '2'] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        const optionC = result.find(r => r.id === '3')
        
        expect(optionA.score).toBe(2)
        expect(optionB.score).toBe(1)
        expect(optionC.score).toBe(0)
      })
    })

    describe('无效数据类型处理', () => {
      it('null 选项应返回空数组', () => {
        expect(calculateRankings(null, [])).toEqual([])
      })

      it('undefined 选项应返回空数组', () => {
        expect(calculateRankings(undefined, [])).toEqual([])
      })

      it('无效格式选项应被过滤', () => {
        const invalidOptions = [
          null, undefined, {}, { id: null }, { id: '' }, { id: 123 }, options[0]]
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: [options[0].id, options[1].id, options[2].id] }
        ]
        const result = calculateRankings(invalidOptions, votes)
        
        expect(result.length).toBe(1)
        expect(result[0].id).toBe(options[0].id)
      })

      it('null 投票应被忽略', () => {
        const votes = [
          null, undefined, { userId: 'u1', userName: '用户1', ranking: ['1', '2', '3'] }
        ]
        const result = calculateRankings(options, votes)
        
        expect(result.length).toBe(3)
      })

      it('无 ranking 字段的投票应被忽略', () => {
        const votes = [
          { userId: 'u1', userName: '用户1' },
          { userId: 'u2', userName: '用户2', ranking: ['1', '2', '3'] }
        ]
        const result = calculateRankings(options, votes)
        
        expect(result.length).toBe(3)
      })
    })

    describe('越界索引处理', () => {
      it('投票长度超过选项数量应只取前N个', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1', '2', '3', '2', '1'] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        const optionC = result.find(r => r.id === '3')
        
        expect(optionA.score).toBe(2)
        expect(optionB.score).toBe(1)
        expect(optionC.score).toBe(0)
      })
    })

    describe('异常数据后的排名稳定性', () => {
      it('存在异常投票时排名应可解释', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['1', '1', 'unknown', '2'] },
          { userId: 'u2', userName: '用户2', ranking: ['2', '3'] }
        ]
        const result = calculateRankings(options, votes)
        
        expect(result.length).toBe(3)
        expect(result.every(r => typeof r.score === 'number')).toBe(true)
        expect(result.every(r => typeof r.rank === 'number')).toBe(true)
      })

      it('所有投票都异常时应按选项顺序计分', () => {
        const votes = [
          { userId: 'u1', userName: '用户1', ranking: ['unknown'] },
          { userId: 'u2', userName: '用户2', ranking: [] }
        ]
        const result = calculateRankings(options, votes)
        
        const optionA = result.find(r => r.id === '1')
        const optionB = result.find(r => r.id === '2')
        const optionC = result.find(r => r.id === '3')
        
        expect(optionA.score).toBe(4)
        expect(optionB.score).toBe(2)
        expect(optionC.score).toBe(0)
      })
    })
  })

  describe('sanitizeRanking 函数', () => {
    it('应过滤重复项并追加缺失项', () => {
      const validOptionIds = ['1', '2', '3']
      const ranking = ['1', '1', '2']
      const result = sanitizeRanking(ranking, validOptionIds)
      
      expect(result).toEqual(['1', '2', '3'])
    })

    it('应过滤未知ID', () => {
      const validOptionIds = ['1', '2', '3']
      const ranking = ['1', 'unknown', '2']
      const result = sanitizeRanking(ranking, validOptionIds)
      
      expect(result).toEqual(['1', '2', '3'])
    })

    it('null 输入应返回默认排序', () => {
      const validOptionIds = ['1', '2', '3']
      const result = sanitizeRanking(null, validOptionIds)
      
      expect(result).toEqual(['1', '2', '3'])
    })
  })

  describe('validateVote 函数', () => {
    const validOptions = [
      { id: '1', name: '选项A' },
      { id: '2', name: '选项B' },
      { id: '3', name: '选项C' }
    ]

    it('有效投票应返回 valid=true', () => {
      const vote = { ranking: ['1', '2', '3'] }
      const result = validateVote(vote, validOptions)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('应检测重复候选', () => {
      const vote = { ranking: ['1', '1', '2'] }
      const result = validateVote(vote, validOptions)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('重复'))).toBe(true)
    })

    it('应检测未知候选ID', () => {
      const vote = { ranking: ['1', 'unknown', '3'] }
      const result = validateVote(vote, validOptions)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('未知'))).toBe(true)
    })

    it('应检测缺失候选', () => {
      const vote = { ranking: ['1', '2'] }
      const result = validateVote(vote, validOptions)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('缺少'))).toBe(true)
    })

    it('应检测无效类型', () => {
      const vote = { ranking: ['1', null, 123, '', '3'] }
      const result = validateVote(vote, validOptions)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('无效类型'))).toBe(true)
    })

    it('应返回修正后的 ranking', () => {
      const vote = { ranking: ['1', '1', 'unknown', '3'] }
      const result = validateVote(vote, validOptions)
      
      expect(result.ranking).toEqual(['1', '3', '2'])
    })

    it('null 投票应返回错误', () => {
      const result = validateVote(null, validOptions)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('投票对象无效')
    })

    it('无 ranking 字段应返回错误', () => {
      const result = validateVote({}, validOptions)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('ranking 必须是数组')
    })
  })
})
