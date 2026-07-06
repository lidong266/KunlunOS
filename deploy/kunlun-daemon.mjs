/**
 * kunlun-daemon — 昆仑OS 守护进程
 *
 * 保持昆仑OS 运行，处理 SIGTERM/SIGINT 优雅关闭。
 * 由 systemd 管理：systemctl start/stop/restart kunlun-os
 */

import { bootKunlunOS } from '@kunlun/os-core';

const os = bootKunlunOS({
  logLevel: 'info',
  cognitionEnabled: true,
  toolSecurityEnabled: true,
  persistentMemoryEnabled: true,
});

console.log(`[${new Date().toISOString()}] 昆仑OS 守护进程已启动`);

// 定期输出心跳
setInterval(() => {
  const state = os.getState();
  console.log(`[${new Date().toISOString()}] 心跳: ${state.status}, ${state.analysisCount} 次分析, ${state.taskCount} 任务`);
}, 300000); // 每5分钟

// 优雅关闭
function shutdown(signal: string) {
  console.log(`[${new Date().toISOString()}] 收到 ${signal}，关闭中...`);
  os.shutdown();
  console.log(`[${new Date().toISOString()}] 昆仑OS 已停止`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

// 保持进程运行
process.stdin.resume();
