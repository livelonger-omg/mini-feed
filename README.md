# 碎语 Chatter

一个把短文字留在浏览器本地的极简信息流。基于 **Node.js + Vue 3 + Pinia** 构建，数据全部保存在浏览器 Local Storage，无后端、无网络请求。

## 功能

- 发布短文字：实时字数统计（上限 280 字），空白内容不可发布
- 查看信息流：新内容置顶，显示头像、昵称、相对时间与正文
- 删除单条：确认后移除，本地数据同步更新
- 本地持久化：内容保存在浏览器 Local Storage，刷新或重新打开页面后依然存在
- 键盘操作：`Ctrl` / `Cmd` + `Enter` 快速发布
- 响应式布局：桌面与移动端均可正常使用

## 技术栈

- Vue 3（`<script setup>` 组合式 API）
- Pinia（状态管理，setup store 写法）
- Vite（开发与构建）
- Vitest + @vue/test-utils + jsdom（TDD 测试）

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（默认 http://localhost:5173）
npm test         # 运行全部测试（一次性）
npm run test:watch  # 监听模式
npm run build    # 生产构建，产物在 dist/
npm run preview  # 预览生产构建
```

## 测试策略（TDD）

开发按「先写测试 → 观察失败 → 最小实现 → 测试转绿」的循环推进，提交历史中保留了红 / 绿两阶段的痕迹。

| 测试文件 | 覆盖行为 |
| --- | --- |
| `tests/unit/storage.spec.js` | 存储读写往返、脏数据过滤、JSON 损坏兜底、配额溢出降级为内存 |
| `tests/unit/format.spec.js` | 相对时间分档（刚刚 / 分钟 / 小时 / 天 / 日期）、未来时间处理 |
| `tests/unit/posts.store.spec.js` | 发布置顶、空白与超长校验、删除同步、300 条上限、跨会话持久化 |
| `tests/components/PostComposer.spec.js` | 计数与禁用态、trim 后提交、空白拦截、`Ctrl+Enter`、超限警示 |
| `tests/components/PostItem.spec.js` | 正文纯文本渲染（防 XSS）、相对时间、删除事件、渐变头像 |
| `tests/components/App.spec.js` | 空状态、倒序排列、刷新后读回、确认删除与取消删除 |

## 项目结构

```
mini-feed/
├── index.html                     # Vite 入口
├── vite.config.js                 # Vite + Vitest 配置（别名 @ → src）
├── src/
│   ├── main.js                    # 创建应用、注册 Pinia
│   ├── App.vue                    # 页面骨架：顶栏、发布框、信息流、空状态
│   ├── components/
│   │   ├── PostComposer.vue       # 发布框：计数、校验、快捷键
│   │   ├── PostItem.vue           # 单条内容卡片
│   │   └── EmptyState.vue         # 空状态引导
│   ├── stores/posts.js            # Pinia store：增删、上限、持久化
│   ├── services/storage.js        # Local Storage 封装（可注入、可降级）
│   ├── utils/format.js            # 相对时间格式化
│   ├── utils/avatar.js            # 头像渐变生成
│   └── styles/base.css            # 设计令牌与全局样式
└── tests/                         # Vitest 测试
```

## 数据说明

- 存储位置：浏览器 `localStorage`，键名 `chatter.posts.v1`
- 数据结构：`{ id, text, createdAt }` 组成的 JSON 数组，按时间倒序
- 清除浏览器站点数据会一并清空所有内容；本地存储不可用（隐私模式 / 配额溢出）时自动降级为内存模式，当次页面仍可正常使用

## 版本演进

- `v1`：纯 HTML + CSS + 原生 JavaScript 单文件版本（保留在 Git 历史中）
- `v2`：Node.js + Vue 3 + Pinia + Vite 版本，测试驱动开发
