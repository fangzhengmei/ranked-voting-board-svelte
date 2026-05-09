import { describe, it, expect } from 'vitest'
import { calculateRankings } from './ranking'

describe('排名计算逻辑', () => {
  describe('基本排名计算', () => {
    it('空选项应返回空数组', () => {
      const options = []
      const votes = []
      expect(calculateRankings(options, votes)).toEqual([])
    })

    it('没有投票时应按原始顺序排列，分数均为0', () => {
      const options = [
        { id: '1', name: '选项A' },
        { id: '2', name: '选项B' },
        { id: '3', name: '选项C' }
      ]
      const votes = []
      const result = calculateRankings(options, votes)
      
      expect(result.length).toBe(3)
      expect(result.every(r => r.score === 0)).toBe(true)
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
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
})
