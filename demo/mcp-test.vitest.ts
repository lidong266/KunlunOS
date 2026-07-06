/**
 * MCP Server 真实连接测试
 * 演示玄关连接真实 MCP Server（@modelcontextprotocol/server-filesystem）
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPGateway, MCPToolType } from '@kunlun/subsystems';
import { createEcosystemSensor } from '@kunlun/ocgs';

const TIMEOUT = 30000;

describe('MCP Server 真实连接测试', () => {
  let gw: MCPGateway;

  beforeAll(() => {
    gw = new MCPGateway({ autoDiscover: false, callTimeout: 15000 });
  });

  afterAll(async () => {
    await gw.fullReset();
  });

  it('本地工具注册和调用', () => {
    gw.registerTool('echo', '回显', MCPToolType.RESOURCE, {
      text: { type: 'string' },
    });
    expect(gw.listTools()).toHaveLength(1);
  });

  it('连接 MCP Server 并发现/调用工具', { timeout: TIMEOUT }, async () => {
    // ── 连接 ──
    const client = await gw.addServer({
      command: 'npx',
      args: ['--yes', '@modelcontextprotocol/server-filesystem@0.6.2', '/tmp', '/root'],
      name: 'filesystem',
    });

    expect(client.isConnected).toBe(true);

    // ── 发现工具 ──
    const tools = await client.listTools();
    console.log('  发现', tools.length, '个工具:', tools.map(t => t.name).join(', '));
    expect(tools.length).toBeGreaterThan(0);

    // ── 调用 list_directory 获取 /tmp 内容 ──
    const listTool = tools.find(t => t.name === 'list_directory');
    expect(listTool).toBeDefined();

    const listResult = await client.callTool('list_directory', { path: '/tmp' });
    console.log('  📂 /tmp 目录内容:', JSON.stringify(listResult).slice(0, 300));
    expect(listResult).toBeDefined();

    // ── 调用 get_file_info 获取单个文件信息 ──
    const infoResult = await client.callTool('get_file_info', { path: '/root' });
    console.log('  📄 /root 信息:', JSON.stringify(infoResult).slice(0, 200));

    // ── 同步到注册表 ──
    gw.syncExternalTools();
    expect(gw.listTools().length).toBeGreaterThanOrEqual(2);

    // ── 状态 ──
    const servers = gw.listServers();
    const fs = servers.find(s => s.name === 'filesystem');
    expect(fs).toBeDefined();
    expect(fs!.status).toBe('connected');
    expect(fs!.toolCount).toBe(9);
    console.log('  🖥️  Server:', fs!.serverInfo?.name, 'v' + fs!.serverInfo?.version);

    // ── 断开 ──
    await gw.removeServer('filesystem');
    const after = gw.listServers();
    expect(after.find(s => s.name === 'filesystem')).toBeUndefined();
    console.log('  ✅ 已断开');
  });

  it('OCGS 生态感知能检测到运行的 MCP Server', { timeout: TIMEOUT }, async () => {
    // 先启动一个 MCP Server
    const client = await gw.addServer({
      command: 'npx',
      args: ['--yes', '@modelcontextprotocol/server-filesystem@0.6.2', '/tmp'],
      name: 'ocgs-test-server',
    });
    expect(client.isConnected).toBe(true);

    // OCGS 扫描
    const sensor = createEcosystemSensor({
      timeoutMs: 5000,
      enabledSources: ['openclaw', 'mcp_topology'],
    });
    const result = await sensor.scanEcosystem();

    // openclaw 不再是 stub
    const oc = result.sourceDetails.find(d => d.source === 'openclaw');
    expect(oc).toBeDefined();
    expect(oc!.status).not.toBe('stub');
    console.log('  🔍 openclaw 状态:', oc!.status);
    console.log('  🔍 openclaw 信号:', oc!.signals.map(s => s.description).join('; '));

    // mcp_topology 不再是 stub
    const mt = result.sourceDetails.find(d => d.source === 'mcp_topology');
    expect(mt).toBeDefined();
    expect(mt!.status).not.toBe('stub');
    console.log('  🔍 mcp_topology 状态:', mt!.status);
    console.log('  🔍 mcp_topology 信号:', mt!.signals.map(s => s.description).join('; '));

    // 清理
    await gw.removeServer('ocgs-test-server');
  });
});
