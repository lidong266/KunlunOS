# Demo — 玄关 MCP 网关演示

## 前置条件

```bash
cd /root/pi-kunlun
pnpm install
pnpm run build
```

## 运行

```bash
# MCP Server 连接演示
node --experimental-strip-types demo/connect-mcp-server.ts

# MCP 集成测试
pnpm exec vitest run demo/mcp-test.vitest.ts --config integration-tests/vitest.config.ts
```

## 说明

- `connect-mcp-server.ts` — 交互式演示，连接真实 `server-filesystem` 并调用工具
- `mcp-test.vitest.ts` — 自动化测试，验证 MCP Server 的发现和调用全链路

两个演示都使用 `@kunlun/subsystems` workspace 包，需要在项目根目录编译后运行。
