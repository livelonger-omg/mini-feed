# 碎语 Chatter

一个把短文字留在服务端的极简信息流。前端 **Vue 3 + Pinia**，后端 **Hono** 提供 RESTful API，数据保存在**进程内存**中，前端不再使用 Local Storage。

## 功能

- 发布短文字：实时字数统计（上限 280 字），空白内容不可发布，发布中禁止重复提交
- 查看信息流：从 `GET /api/posts` 拉取，新内容置顶，显示头像、昵称、相对时间与正文
- 删除单条：确认后调用 `DELETE /api/posts/:id`，删除中禁用按钮防重复点击
- 服务端存储：刷新页面数据仍在；服务重启后清空（内存存储）
- 失败处理：加载失败展示错误横幅并可重试；发布失败保留用户草稿；错误可手动关闭
- 键盘操作：`Ctrl` / `Cmd` + `Enter` 快速发布
- 响应式布局：桌面与移动端均可正常使用

## 技术栈

- Hono 4 + `@hono/node-server`（后端 REST API）
- Vue 3（`<script setup>` 组合式 API）+ Pinia
- Vite（开发、代理与构建）
- Vitest + @vue/test-utils + jsdom（TDD 测试，服务端用例运行在 Node 环境）

## 快速开始

```bash
npm install          # 安装依赖
npm run dev          # 同时启动 API(8787) 与前端(5173)，一条命令搞定
npm test             # 运行全部测试（一次）
npm run test:watch   # 监听模式
npm run build        # 生产构建，产物在 dist/
npm run preview      # 预览构建产物（同样把 /api 代理到 8787）
```

也可以分开启动（两个终端）：

```bash
npm run server       # 只启动后端，node --watch server/index.js
npm run web          # 只启动前端，vite
```

打开 http://localhost:5173 即可使用。开发环境下 Vite 会把 `/api` 代理到 `http://127.0.0.1:8787`，因此前端只读 `/api` 相对路径，不涉及跨域。

## API

基础路径 `/api`，请求与响应均为 JSON，错误统一为 `{ "error": { "code": string, "message": string } }`。

| 方法与路径 | 说明 | 成功响应 |
| --- | --- | --- |
| `GET /api/health` | 健康检查 | `200 { status: "ok" }` |
| `GET /api/posts` | 内容列表，按创建时间倒序 | `200 { posts: Post[] }` |
| `GET /api/posts/:id` | 单条内容 | `200 { post: Post }` |
| `POST /api/posts` | 发布内容，body `{ "text": string }` | `201 { post: Post }` + `Location` |
| `DELETE /api/posts/:id` | 删除内容 | `204`（无响应体） |

`Post` 结构固定为 `{ id: string, text: string, createdAt: number }`。

错误码约定：

| HTTP | code | 触发条件 |
| --- | --- | --- |
| 400 | `INVALID_BODY` | 请求体不是 JSON 对象，或 `text` 不是字符串 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超过 8KB |
| 422 | `TEXT_REQUIRED` | `text` 去空白后为空 |
| 422 | `TEXT_TOO_LONG` | 去空白后超过 280 字 |
| 404 | `POST_NOT_FOUND` | 指定的 id 不存在 |
| 404 | `NOT_FOUND` | 未知的 `/api/*` 路径 |
| 500 | `INTERNAL_ERROR` | 未预期异常（不泄露内部信息） |

内容上限：单条 280 字，服务端最多保留 300 条，超出后丢弃最旧的。同一毫秒创建的多条内容按「后写入的在前」排列，顺序稳定。

## 测试策略（TDD）

开发按「先写测试 → 观察失败 → 最小实现 → 测试转绿」的循环推进。

| 测试文件 | 覆盖行为 |
| --- | --- |
| `tests/server/store.spec.js` | 内存存储：倒序、同时间戳稳定排序、按 id 取回、删除、上限裁剪、返回值副本隔离、清空 |
| `tests/server/posts.api.spec.js` | 全部路由：状态码、`Location` 头、trim、边界 280/300、非法 JSON、非字符串、空体、413、404、CORS 预检、500 兜底不泄露细节 |
| `tests/unit/api.spec.js` | HTTP 客户端：GET/POST/DELETE、URL 编码、204 空体、错误体映射、网络异常、502 网关、脏数据过滤 |
| `tests/unit/posts.store.spec.js` | 加载态、错误来源、并发去重、发布置顶、校验拦截、删除 404 幂等、300 条上限、迟到响应丢弃 |
| `tests/components/App.spec.js` | 加载/空状态、加载失败重试、发布成功与失败恢复草稿、删除确认/取消/失败、错误横幅关闭 |
| `tests/components/PostComposer.spec.js` | 计数与禁用态、trim 提交、空白拦截、`Ctrl+Enter`、超限警示、提交中禁用、草稿恢复不覆盖新输入 |
| `tests/components/PostItem.spec.js` | 纯文本渲染（防 XSS）、相对时间、删除事件、删除中禁用、渐变头像 |
| `tests/unit/format.spec.js` | 相对时间分档（刚刚 / 分钟 / 小时 / 天 / 日期）、未来时间处理 |

## 项目结构

```
mini-feed/
├── index.html                     # Vite 入口
├── vite.config.js                 # Vite + Vitest 配置（别名 @ → src，/api 代理）
├── server/                        # 后端
│   ├── app.js                     # Hono 应用：路由、校验、错误码映射、CORS
│   ├── store.js                   # 内存存储（可注入 now / createId / limit）
│   └── index.js                   # 启动入口（PORT / HOST 可配）
├── shared/limits.js               # 前后端共享上限（280 字 / 300 条）
├── src/
│   ├── main.js                    # 创建应用、注册 Pinia
│   ├── App.vue                    # 页面骨架：顶栏、发布框、错误横幅、信息流、空状态
│   ├── components/
│   │   ├── PostComposer.vue       # 发布框：计数、校验、快捷键、提交态、草稿恢复
│   │   ├── PostItem.vue           # 单条内容卡片
│   │   └── EmptyState.vue         # 空状态引导
│   ├── services/api.js            # REST 客户端：请求拼装、超时、错误映射
│   ├── stores/posts.js            # Pinia store：异步增删查、并发保护、错误状态
│   ├── utils/format.js            # 相对时间格式化
│   ├── utils/avatar.js            # 头像渐变生成
│   └── styles/base.css            # 设计令牌与全局样式
└── tests/                         # Vitest 测试（server 用例运行在 Node 环境）
```

## 数据说明

- 存储位置：后端进程内存，单进程共享，**重启即清空**，不做持久化
- 数据结构：`{ id, text, createdAt }`，`createdAt` 为毫秒时间戳
- 端口：API 默认 `8787`（`PORT` 可覆盖），前端开发服务器 `5173`
- 请求超时：10 秒；后端不可用时页面展示「无法连接服务」并提供重试

## 版本演进

- `v1`：纯 HTML + CSS + 原生 JavaScript 单文件版本（保留在 Git 历史中）
- `v2`：Node.js + Vue 3 + Pinia + Vite，数据存于浏览器 Local Storage
- `v3`：Hono + REST API + 内存存储，前端全量改为异步数据流（当前版本）
