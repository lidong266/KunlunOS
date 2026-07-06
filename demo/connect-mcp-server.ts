/**
 * MCP Server 连接演示
 * 演示玄关 (Xuanguan) 如何连接真实 MCP Server 并调用工具
 *
 * 使用方式：
 *   先编译项目：cd /root/pi-kunlun && pnpm run build
 *   然后用 tsx 运行：npx tsx demo/connect-mcp-server.ts
 */

import { MCPGateway, MCPToolType } from '@kunlun/subsystems';

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  玄关 MCP 网关 — 真实 MCP Server 连接演示  ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // ─── 创建网关 ───
  const gw = new MCPGateway({ autoDiscover: false, callTimeout: 15000 });
  console.log('✅ 网关已创建');

  // ─── 注册本地工具 ───
  gw.registerTool('local_echo', '本地回显工具', MCPToolType.RESOURCE, {
    text: { type: 'string', description: '要回显的文本' },
  }, 1 /* T_TRUE */);
  console.log('✅ 本地工具已注册');

  // ─── 连接 MCP Server ───
  // 使用 @modelcontextprotocol/server-filesystem（需要先 npx 安装）
  console.log('\n🔌 正在连接 MCP Server: server-filesystem...');

  try {
    const client = await gw.addServer({
      command: 'npx',
      args: ['--yes', '@modelcontextprotocol/server-filesystem@0.6.2', '/tmp'],
      name: 'filesystem',
    });
    console.log(`✅ 已连接: ${client.serverInfo?.name ?? 'unknown'} v${client.serverInfo?.version ?? '?'}`);
    console.log(`   协议版本: ${client.capabilities ? '可用' : '未知'}`);
    console.log(`   已发现 ${client.tools.length} 个工具`);
  } catch (err) {
    console.log('⚠️  filesystem server 连接失败（首次运行需下载，重试即可）:', err instanceof Error ? err.message : String(err));
    console.log('   继续演示本地能力...');
  }

  // ─── 显示状态 ───
  console.log('\n📊 网关状态:');
  console.log(JSON.stringify(gw.getStats(), null, 2));

  // ─── 列出所有服务器 ───
  const servers = gw.listServers();
  console.log(`\n🖥️  已注册 MCP Server: ${servers.length}`);
  for (const s of servers) {
    console.log(`   - ${s.name} (${s.command}) → ${s.status}, ${s.toolCount} 个工具`);
  }

  // ─── 列出所有工具 ───
  const tools = gw.listTools();
  console.log(`\n🔧 可用工具 (${tools.length}):`);
  for (const t of tools) {
    const src = t.pluginId ? `[来自 ${t.pluginId}]` : '[本地]';
    console.log(`   - ${t.name}: ${t.description} ${src}`);
  }

  // ─── 调用本地工具 ───
  console.log('\n🔄 调用本地工具 local_echo...');
  const localResult = await gw.callTool({
    toolName: 'local_echo',
    callId: 'demo-001',
    arguments: { text: 'Hello from 玄关!' },
  });
  console.log(`   状态: ${localResult.status}`);
  console.log(`   数据: ${JSON.stringify(localResult.data)}`);

  // ─── 如果 filesystem 连接成功，调用远程工具 ───
  const fsClient = servers.find(s => s.name === 'filesystem');
  if (fsClient && fsClient.status === 'connected' && fsClient.toolCount > 0) {
    const toolName = fsClient.tools.some(t => t.name === 'read_file') ? 'read_file' : fsClient.tools[0]?.name;
    if (toolName) {
      console.log(`\n🔄 调用远程工具 ${toolName}...`);
      const remoteResult = await gw.callTool({
        toolName,
        callId: 'demo-002',
        arguments: toolName === 'read_file' ? { path: '/tmp/test-mcp.txt' } : {},
      });
      console.log(`   状态: ${remoteResult.status}`);
      console.log(`   数据: ${JSON.stringify(remoteResult.data).slice(0, 200)}`);
    }
  }

  // ─── 同步外部工具到注册表 ───
  gw.syncExternalTools();
  console.log(`\n📋 同步后总工具数: ${gw.listTools().length}`);

  // ─── 断开连接 ───
  console.log('\n🔌 断开所有 MCP Server...');
  await gw.fullReset();
  console.log('✅ 已断开');

  console.log('\n🎉 演示完成');
}

main().catch(console.error);
