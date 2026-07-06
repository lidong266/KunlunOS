/**
 * KunlunOS CLI — 昆仑OS 命令行入口
 *
 * 提供交互式 REPL 界面，通过 KunlunAgent 统一调用 Pi 微内核。
 *
 * 使用方式：
 *   npx tsx packages/kunlun-os-core/src/cli.ts
 *
 * 命令：
 *   /help          — 显示帮助
 *   /skill <name>  — 执行指定技能
 *   /template <n>  — 使用 Prompt 模板
 *   /compact       — 上下文压缩
 *   /status        — 显示 OS 状态
 *   /exit          — 退出
 */

import * as readline from 'node:readline';
import { KunlunAgent } from './kunlun-agent.js';
import type { KunlunAgentOptions } from './kunlun-agent.js';
import { NodeExecutionEnv } from '@kunlun/pi-agent-core/node';
import { InMemorySessionRepo } from './harness/session/memory-repo.js';
import type { Model, Models } from '@earendil-works/pi-ai';

// ═══════════════════════════════════════════════════════════════
// CLI 配置
// ═══════════════════════════════════════════════════════════════

interface CLIConfig {
  /** LLM Models 提供者 */
  models: Models;
  /** 默认模型 */
  model: Model<any>;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 可用工具 */
  tools?: any[];
}

// ═══════════════════════════════════════════════════════════════
// KunlunCLI 类
// ═══════════════════════════════════════════════════════════════

export class KunlunCLI {
  private agent: KunlunAgent | null = null;
  private rl: readline.Interface | null = null;
  private running = false;

  constructor(private config: CLIConfig) {}

  /** 启动 CLI */
  async start(): Promise<void> {
    // 创建 Agent
    const env = new (NodeExecutionEnv as any)();
    const sessionRepo = new InMemorySessionRepo();
    const session = await sessionRepo.create();

    const options: KunlunAgentOptions = {
      env,
      session: session as any,
      models: this.config.models,
      model: this.config.model,
      systemPrompt: this.config.systemPrompt ?? 'You are a helpful assistant powered by 昆仑OS.',
      tools: this.config.tools ?? [],
      cognitionEnabled: true,
      toolSecurityEnabled: true,
    };

    this.agent = new KunlunAgent(options);
    await this.agent.start();

    this.printBanner();

    // 启动 REPL
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\n🐉 昆仑> ',
    });

    this.running = true;
    this.rl.prompt();

    this.rl.on('line', async (line: string) => {
      await this.handleInput(line.trim());
      if (this.running) {
        this.rl!.prompt();
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      this.shutdown();
    });
  }

  /** 处理用户输入 */
  private async handleInput(input: string): Promise<void> {
    if (!input) return;
    if (!this.agent) return;

    // 命令处理
    if (input.startsWith('/')) {
      await this.handleCommand(input);
      return;
    }

    // 普通 prompt（通过 harness 调用 Pi 微内核）
    try {
      process.stdout.write('\n🤖 ');
      const response = await this.agent.harness.prompt(input);
      this.printResponse(response);
    } catch (error) {
      console.error('\n❌ 错误:', error instanceof Error ? error.message : String(error));
    }
  }

  /** 处理斜杠命令 */
  private async handleCommand(input: string): Promise<void> {
    const parts = input.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    if (!this.agent) return;

    switch (cmd) {
      case 'help':
        this.printHelp();
        break;

      case 'skill':
        if (args.length === 0) {
          console.log('用法: /skill <name> [additional instructions]');
          return;
        }
        try {
          const skillResp = await this.agent.harness.skill(args[0]!, args.slice(1).join(' '));
          this.printResponse(skillResp);
        } catch (error) {
          console.error('❌ 技能错误:', error instanceof Error ? error.message : String(error));
        }
        break;

      case 'template':
        if (args.length === 0) {
          console.log('用法: /template <name> [args...]');
          return;
        }
        try {
          const tmplResp = await this.agent.harness.promptFromTemplate(args[0]!, args.slice(1));
          this.printResponse(tmplResp);
        } catch (error) {
          console.error('❌ 模板错误:', error instanceof Error ? error.message : String(error));
        }
        break;

      case 'compact':
        try {
          const result = await this.agent.harness.compact();
          console.log(`✅ 上下文已压缩 (${result.tokensBefore} → ${result.summary.length} chars)`);
        } catch (error) {
          console.error('❌ 压缩错误:', error instanceof Error ? error.message : String(error));
        }
        break;

      case 'status':
        this.printStatus();
        break;

      case 'exit':
      case 'quit':
        this.shutdown();
        break;

      default:
        console.log(`未知命令: /${cmd}。输入 /help 查看帮助。`);
    }
  }

  /** 打印欢迎横幅 */
  private printBanner(): void {
    const state = this.agent?.getOSState();
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  昆仑OS (KunlunOS) — 认知操作系统');
    console.log('  三进制认知基础设施 · Pi 微内核驱动');
    console.log('═══════════════════════════════════════════');
    if (state) {
      console.log(`  状态: ${state.status}`);
      console.log(`  实例: ${state.instanceCount} | 管道运行: ${state.pipelineRuns}`);
    }
    console.log('  输入 /help 查看命令 | /exit 退出');
    console.log('═══════════════════════════════════════════');
  }

  /** 打印帮助 */
  private printHelp(): void {
    console.log('');
    console.log('可用命令:');
    console.log('  /help          显示此帮助');
    console.log('  /skill <name>  执行指定技能');
    console.log('  /template <n>  使用 Prompt 模板');
    console.log('  /compact       上下文压缩');
    console.log('  /status        显示 OS 状态');
    console.log('  /exit          退出');
    console.log('');
    console.log('直接输入文本即发送 prompt。');
  }

  /** 打印 OS 状态 */
  private printStatus(): void {
    const state = this.agent?.getOSState();
    if (!state) {
      console.log('OS 未启动');
      return;
    }
    console.log('');
    console.log('═══ 昆仑OS 状态 ═══');
    console.log(`  运行状态: ${state.status}`);
    console.log(`  运行时间: ${Math.floor(state.uptime / 1000)}s`);
    console.log(`  认知实例: ${state.instanceCount}`);
    console.log(`  任务队列: ${state.taskCount}`);
    console.log(`  管道运行: ${state.pipelineRuns}`);
    console.log('═══════════════════');
  }

  /** 打印 Agent 回复 */
  private printResponse(response: any): void {
    const content = response?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'text') {
          console.log(part.text);
        }
      }
    } else if (typeof content === 'string') {
      console.log(content);
    } else {
      console.log(JSON.stringify(response, null, 2));
    }
  }

  /** 关闭 */
  private shutdown(): void {
    console.log('\n👋 昆仑OS 正在关闭...');
    if (this.agent) {
      this.agent.stop();
    }
    if (this.rl) {
      this.rl.close();
    }
    this.running = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 直接运行入口
// ═══════════════════════════════════════════════════════════════

// 如果直接运行此文件（不作为模块导入），启动 CLI
// 需要在外部提供 models 和 model 配置
