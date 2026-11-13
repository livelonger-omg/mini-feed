export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #5B8CFF, #A97BFF)',
  'linear-gradient(135deg, #4EE0B5, #5B8CFF)',
  'linear-gradient(135deg, #A97BFF, #FF9BC4)',
  'linear-gradient(135deg, #F0B429, #FF6B6B)',
  'linear-gradient(135deg, #5B8CFF, #4EE0B5)',
  'linear-gradient(135deg, #8FA3FF, #C08BFF)'
]

/**
 * 依据内容 id 稳定地挑选一个头图渐变，避免每条都一样。
 */
export function gradientFor(seed = '') {
  let hash = 0

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973
  }

  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}
