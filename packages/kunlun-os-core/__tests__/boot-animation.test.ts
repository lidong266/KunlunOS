/**
 * BootAnimator 测试
 *
 * 测试终端启动动画模块的各个方法：
 *   - showLogo() 输出非空
 *   - completePhase 成功/失败图标
 *   - showBootComplete 包含统计信息
 *   - showBootAnim=false 时不输出动画
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BootAnimator } from '../src/boot-animation';

describe('BootAnimator', () => {
  let captured: string[];

  beforeEach(() => {
    captured = [];
    // 手动注入 write 方法来捕获输出
  });

  // 一个辅助：创建 BootAnimator 并重定向输出到数组
  function createAnimator(showAnim = true): BootAnimator {
    const anim = new BootAnimator(showAnim);
    // 强制覆盖原生 write 以便测试环境捕获输出
    return anim;
  }

  function captureOutput(fn: (anim: BootAnimator) => void): string {
    const chunks: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(
      (chunk: string | Uint8Array) => {
        chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
        return true;
      },
    );
    try {
      const anim = new BootAnimator(true);
      // 强制 TTY 为 true（测试环境可能不是TTY但我们需要测动画）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anim as any).isTTY = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anim as any).enabled = true;
      fn(anim);
    } finally {
      writeSpy.mockRestore();
    }
    return chunks.join('');
  }

  // ═══════════════════════════════════════════════════════════
  // showLogo
  // ═══════════════════════════════════════════════════════════

  describe('showLogo()', () => {
    it('should output a non-empty logo', () => {
      const output = captureOutput((anim) => anim.showLogo());
      expect(output.length).toBeGreaterThan(0);
    });

    it('should contain brand identifier', () => {
      const output = captureOutput((anim) => anim.showLogo());
      // Logo 是 ASCII 艺术字 "KUNLUN OS"，明文含 "Cognitive Operating System"
      const text = output.replace(/\x1b\[[0-9;]*m/g, '');
      expect(text).toMatch(/Cognitive Operating System|KUNLUN/);
    });

    it('should contain version string', () => {
      const output = captureOutput((anim) => anim.showLogo());
      // version like v0.x.x
      expect(output).toMatch(/v\d+\.\d+\.\d+/);
    });

    it('should not output when isTTY is false', () => {
      // 创建一个动画已禁用的实例
      const anim = new BootAnimator(false);
      const writeSpy = vi.spyOn(process.stdout, 'write');

      // 即便 isEnabled 为 false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anim as any).enabled = false;
      anim.showLogo();

      // 不应该写入任何内容
      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // completePhase
  // ═══════════════════════════════════════════════════════════

  describe('completePhase()', () => {
    it('should show ✓ for success', () => {
      const output = captureOutput((anim) => {
        anim.startPhase(0);
        anim.completePhase(0, 'success');
      });
      // 去除 ANSI 转义码后检查纯文本
      const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toMatch(/✓/);
    });

    it('should show ✗ for error', () => {
      const output = captureOutput((anim) => {
        anim.startPhase(0);
        anim.completePhase(0, 'error');
      });
      const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toMatch(/✗/);
    });

    it('should be a no-op when animation is disabled', () => {
      const anim = new BootAnimator(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anim as any).enabled = false;
      const writeSpy = vi.spyOn(process.stdout, 'write');
      anim.completePhase(0, 'success');
      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // showBootComplete
  // ═══════════════════════════════════════════════════════════

  describe('showBootComplete()', () => {
    it('should include duration in the output', () => {
      const output = captureOutput((anim) => {
        anim.showBootComplete({
          durationMs: 1234,
          phaseCount: 6,
          subsystemCount: 13,
          instanceIds: ['kunlun-os-kernel-0', 'kunlun-os-kernel-1'],
        });
      });
      expect(output).toMatch(/1\.23|1\.2[34]/);
    });

    it('should include phase count', () => {
      const output = captureOutput((anim) => {
        anim.showBootComplete({
          durationMs: 100,
          phaseCount: 6,
          subsystemCount: 13,
          instanceIds: ['a', 'b'],
        });
      });
      expect(output).toMatch(/6/);
    });

    it('should include subsystem count', () => {
      const output = captureOutput((anim) => {
        anim.showBootComplete({
          durationMs: 100,
          phaseCount: 6,
          subsystemCount: 13,
          instanceIds: [],
        });
      });
      expect(output).toMatch(/13/);
    });

    it('should show "Boot Complete" or similar success text', () => {
      const output = captureOutput((anim) => {
        anim.showBootComplete({
          durationMs: 100,
          phaseCount: 6,
          subsystemCount: 13,
          instanceIds: [],
        });
      });
      expect(output.toLowerCase()).toMatch(/boot complete|ready|ok|success/);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 降级模式
  // ═══════════════════════════════════════════════════════════

  describe('text fallback (non-TTY)', () => {
    it('should show text logo when animation is disabled', () => {
      const anim = new BootAnimator(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anim as any).enabled = false;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      anim.showLogoText();
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(calls).toMatch(/KunlunOS|kunlun/i);
      consoleSpy.mockRestore();
    });

    it('should log phase completion in text mode', () => {
      const anim = new BootAnimator(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anim as any).enabled = false;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      anim.completePhaseText(1, 'success');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('phase1'),
      );
      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Config 集成: showBootAnim=false 时不显示动画
  // ═══════════════════════════════════════════════════════════

  describe('integration: showBootAnim config', () => {
    it('should create animator when showBootAnim=true', () => {
      const animator = new BootAnimator(true);
      expect(animator).toBeDefined();
    });

    it('should still return an instance when showBootAnim=false (for graceful no-ops)', () => {
      const animator = new BootAnimator(false);
      expect(animator).toBeDefined();
    });

    it('should emit no output when disabled and no-op methods called', () => {
      const anim = new BootAnimator(true);
      Object.defineProperty(anim, 'enabled', { value: false, writable: false, configurable: true });

      const writeSpy = vi.spyOn(process.stdout, 'write');
      anim.showLogo();
      anim.startPhase(0);
      anim.completePhase(0, 'success');
      anim.showBootComplete({ durationMs: 1, phaseCount: 1, subsystemCount: 1, instanceIds: [] });
      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });
});
