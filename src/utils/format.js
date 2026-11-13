const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 把时间戳格式化为相对时间描述。
 * @param {number} timestamp 目标时间戳（毫秒）
 * @param {number} [now] 当前时间戳，便于测试注入
 */
export function formatRelativeTime(timestamp, now = Date.now()) {
  const diff = Math.max(0, now - timestamp)

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`

  const date = new Date(timestamp)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
