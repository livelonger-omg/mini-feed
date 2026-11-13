import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createPostStore } from './store.js'

const DEFAULT_PORT = 8787

function resolvePort(value) {
  const port = Number(value ?? DEFAULT_PORT)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.warn(`PORT 取值不合法（${value}），已回退到 ${DEFAULT_PORT}`)
    return DEFAULT_PORT
  }

  return port
}

const port = resolvePort(process.env.PORT)
const hostname = process.env.HOST ?? '127.0.0.1'
const app = createApp({ store: createPostStore() })

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`碎语 API 已启动：http://${hostname}:${info.port}`)
})
