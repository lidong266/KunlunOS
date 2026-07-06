#!/usr/bin/env node
/**
 * kunlun-cli — 昆仑OS 命令行接口
 *
 * 用法：
 *   kunlun status     查看状态
 *   kunlun test       运行测试
 *   kunlun analyze Q  分析问题
 *   kunlun boot       启动守护进程
 *   kunlun stop       停止守护进程
 */

import { bootKunlunOS, getKunlunOS } from '@kunlun/os-core';

const args = process.argv.slice(2);
const cmd = args[0] || 'help';

async function main() {
  switch (cmd) {
    case 'status':
    case 's': {
      const os = getKunlunOS();
      const state = os.getState();
      console.log('╔══════════════════════════════════════╗');
      console.log('║       昆仑OS 状态                    ║');
      console.log('╠══════════════════════════════════════╣');
      console.log(`║  状态:    ${state.status.padEnd(25)}║`);
      console.log(`║  运行时间: ${formatUptime(state.uptime).padEnd(22)}║`);
      console.log(`║  任务数:  ${String(state.taskCount).padEnd(25)}║`);
      console.log(`║  分析次数: ${String(state.analysisCount).padEnd(24)}║`);
      console.log('╚══════════════════════════════════════╝');
      break;
    }

    case 'test':
    case 't': {
      console.log('运行昆仑OS 测试套件...');
      const { execSync } = await import('node:child_process');
      try {
        const result = execSync('npx vitest@2.1.9 run', {
          cwd: process.env.KUNLUN_HOME || process.cwd(),
          encoding: 'utf8',
          stdio: 'inherit',
        });
      } catch { /* vitest exits with non-zero on test failures */ }
      break;
    }

    case 'analyze':
    case 'a': {
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('用法: kunlun analyze <问题>');
        process.exit(1);
      }
      const os = bootKunlunOS();
      const analysis = await os.injectCognition(
        [{ role: 'user', content: query }],
        '',
      );
      console.log('╔══════════════════════════════════════╗');
      console.log('║       昆仑OS 认知分析                ║');
      console.log('╠══════════════════════════════════════╣');
      console.log(`║  查询: ${query.slice(0, 30)}`);
      console.log(`║  矛盾: ${analysis.contradictions.length} 组`);
      for (const c of analysis.contradictions) {
        console.log(`║    ${c.thesis} ↔ ${c.antithesis}`);
      }
      const unifLabel = analysis.unifiability === 1 ? '可统一' : analysis.unifiability === 0 ? '待分析' : '不可调和';
      console.log(`║  可统一性: ${unifLabel}`);
      console.log(`║  摘要: ${analysis.summary}`);
      if (analysis.strategy) {
        console.log(`║  策略: ${analysis.strategy.slice(0, 40)}`);
      }
      console.log('╚══════════════════════════════════════╝');
      break;
    }

    case 'boot':
    case 'start': {
      const os = bootKunlunOS();
      console.log(`✅ 昆仑OS 已启动 (PID: ${process.pid})`);
      // 保持进程运行
      process.on('SIGTERM', () => { os.shutdown(); process.exit(0); });
      process.on('SIGINT', () => { os.shutdown(); process.exit(0); });
      break;
    }

    default:
      console.log('昆仑OS v0.5.0 — AI 认知操作系统');
      console.log('');
      console.log('用法: kunlun <命令>');
      console.log('');
      console.log('命令:');
      console.log('  status, s        查看运行状态');
      console.log('  test, t          运行测试套件');
      console.log('  analyze, a <Q>   分析问题');
      console.log('  boot, start      启动守护进程');
      console.log('  help             显示此帮助');
      console.log('');
      console.log('示例:');
      console.log('  kunlun status');
      console.log('  kunlun analyze "性能和可维护性如何权衡"');
      break;
  }
}

function formatUptime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
