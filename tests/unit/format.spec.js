import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/utils/format.js'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('一分钟以内显示“刚刚”', () => {
    expect(formatRelativeTime(NOW - 5 * SECOND, NOW)).toBe('刚刚')
  })

  it('一小时内显示分钟', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5 分钟前')
  })

  it('一天内显示小时', () => {
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3 小时前')
  })

  it('一周内显示天数', () => {
    expect(formatRelativeTime(NOW - 2 * DAY, NOW)).toBe('2 天前')
  })

  it('超过一周显示具体日期', () => {
    expect(formatRelativeTime(NOW - 10 * DAY, NOW)).toBe('2026年11月3日')
  })

  it('未来时间按“刚刚”处理', () => {
    expect(formatRelativeTime(NOW + 10 * SECOND, NOW)).toBe('刚刚')
  })
})
