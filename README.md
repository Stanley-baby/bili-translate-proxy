# Index-Translate Cloudflare Workers 代理指南

本文档重点说明如何通过 **Cloudflare Workers** 代理调用 B 站免费翻译 API，并接入沉浸式翻译。模型本身介绍从简。

## 1. 为什么需要代理

直接调用 `https://index-translate.bilibili.com/v1/chat/completions` 会遇到两个问题：

1. **浏览器跨域**：沉浸式翻译作为扩展，请求携带 `Origin` 头，触发 B 站风控，返回 `412 Precondition Failed`。
2. **Cloudflare 默认 fetch 也会被拦截**：Workers 的 `fetch` 会自动注入 `cf-connecting-ip`、`cf-worker` 等头，同样被 B 站识别为异常请求。

解决方案：使用 `stealth-fetch/web`，通过 Cloudflare 原生 TCP Socket 发送请求，完全绕过 `cf-*` 头注入。

## 2. 项目文件

仓库根目录需要四个文件：

```
.
├── src/index.js
├── package.json
├── package-lock.json
└── wrangler.toml
```

## 3. 部署

### 3.1 安装依赖

```bash
npm install
```

### 3.2 部署到 Cloudflare

```bash
npx wrangler deploy
```

如果使用 Cloudflare Git 集成，推送后会自动执行 `npx wrangler deploy`，确保 `wrangler.toml` 存在即可。

部署成功后会得到类似 `https://bili-translate-proxy.xxx.workers.dev` 的地址。

> 建议绑定自定义域名，`*.workers.dev` 在国内部分地区可能无法访问。

## 4. 配置沉浸式翻译

进入沉浸式翻译 → 设置 → 翻译服务 → 添加自定义翻译服务：

| 配置项 | 填写内容 |
|--------|----------|
| API 地址 | `https://你的Worker地址/v1/chat/completions` |
| API Key | 任意非空字符串（如 `sk-any`） |
| 模型 | `Index-Translate-35B-A3B` |
| 每秒最大请求数 | 3–5 |

保存并测试即可。

## 5. 测试代理

用 `curl` 验证：

```bash
curl -X POST https://你的Worker地址/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Index-Translate-35B-A3B",
    "messages": [{"role": "user", "content": "请将以下文本翻译为英语，直接输出翻译结果，不要进行任何解释。\n\n你好，世界。"}]
  }'
```

返回翻译结果即表示代理正常。

## 6. 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 412 Precondition Failed | 请求携带 `Origin` 或 `cf-*` 头 | 使用 `stealth-fetch/web`，不要用默认 `fetch` |
| 构建报错 `Could not resolve "buffer"` | 缺少 Node 兼容或用了完整版入口 | `wrangler.toml` 加 `nodejs_compat`，代码改用 `stealth-fetch/web` |
| `Unexpected end of JSON input` | 浏览器直接 GET 访问根路径 | 正常现象，用 POST 请求测试 |
| `ETARGET` 找不到版本 | `stealth-fetch` 版本写错 | 使用 `^0.2.2` |

## 7. 参考

- Index-Translate 仓库：https://github.com/bilibili/Index-Translate
- 在线接口：https://index-translate.bilibili.com
- stealth-fetch：https://www.npmjs.com/package/stealth-fetch
