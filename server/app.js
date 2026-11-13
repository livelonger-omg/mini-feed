import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { MAX_LENGTH, createPostStore } from './store.js'

// 正文上限 280 字，8KB 足够容纳，超出直接拒绝，避免读取超大请求体
const MAX_BODY_SIZE = 8 * 1024

const ERROR_MESSAGES = {
  INVALID_BODY: '请求体必须是包含 text 字段的 JSON 对象',
  TEXT_REQUIRED: '内容不能为空',
  TEXT_TOO_LONG: `内容不能超过 ${MAX_LENGTH} 个字符`,
  PAYLOAD_TOO_LARGE: '请求体过大',
  POST_NOT_FOUND: '内容不存在或已被删除',
  NOT_FOUND: '接口不存在',
  INTERNAL_ERROR: '服务暂时不可用，请稍后重试'
}

function fail(context, status, code, message = ERROR_MESSAGES[code]) {
  return context.json({ error: { code, message } }, status)
}

/**
 * 解析 JSON 请求体，非法 JSON 或非对象一律视为无效请求体。
 */
async function readBody(context) {
  let body

  try {
    body = await context.req.json()
  } catch {
    return null
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  return body
}

/**
 * 校验并归一化正文，返回 { text } 或 { error: { status, code } }。
 * 请求体结构错误归 400，语义校验失败归 422。
 */
function normalizeText(body) {
  if (typeof body.text !== 'string') {
    return { error: { status: 400, code: 'INVALID_BODY' } }
  }

  const text = body.text.trim()

  if (!text) return { error: { status: 422, code: 'TEXT_REQUIRED' } }
  if (text.length > MAX_LENGTH) {
    return { error: { status: 422, code: 'TEXT_TOO_LONG' } }
  }

  return { text }
}

export function createApp({ store = createPostStore() } = {}) {
  const app = new Hono()

  app.use(
    '/api/*',
    cors({
      origin: process.env.CORS_ORIGIN ?? '*',
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type']
    })
  )

  app.get('/api/health', (context) => context.json({ status: 'ok' }))

  app.get('/api/posts', (context) => context.json({ posts: store.list() }))

  app.get('/api/posts/:id', (context) => {
    const post = store.get(context.req.param('id'))

    if (!post) return fail(context, 404, 'POST_NOT_FOUND')

    return context.json({ post })
  })

  app.post(
    '/api/posts',
    bodyLimit({
      maxSize: MAX_BODY_SIZE,
      onError: (context) => fail(context, 413, 'PAYLOAD_TOO_LARGE')
    }),
    async (context) => {
      const body = await readBody(context)

      if (!body) return fail(context, 400, 'INVALID_BODY')

      const { text, error } = normalizeText(body)

      if (error) return fail(context, error.status, error.code)

      const post = store.create(text)

      context.header('Location', `/api/posts/${post.id}`)

      return context.json({ post }, 201)
    }
  )

  app.delete('/api/posts/:id', (context) => {
    if (!store.remove(context.req.param('id'))) {
      return fail(context, 404, 'POST_NOT_FOUND')
    }

    return context.body(null, 204)
  })

  app.notFound((context) => fail(context, 404, 'NOT_FOUND'))

  // 兜底：任何未预期的异常都返回统一的 JSON 错误体，且不向外泄露堆栈或内部信息
  app.onError((error, context) => {
    // Hono 内部用 HTTPException 表达 4xx，必须原样返回，否则会被降级成 500
    if ('getResponse' in error) return error.getResponse()

    console.error('[api] 未处理的异常：', error)
    return fail(context, 500, 'INTERNAL_ERROR')
  })

  return app
}
