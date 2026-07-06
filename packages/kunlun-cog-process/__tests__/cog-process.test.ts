import { describe, it, expect, beforeEach } from 'vitest';
import { CogProcessManager, PROCESS_STAGE_ORDER } from '../src/index.js';
import type { CogProcess, CogProcessStage, CoreContradiction } from '../src/index.js';

describe('CogProcessManager', () => {
  let manager: CogProcessManager;

  beforeEach(() => {
    manager = new CogProcessManager();
  });

  function makeContradiction(thesis: string = 'test-thesis', antithesis: string = 'test-antithesis'): CoreContradiction {
    return { thesis, antithesis };
  }

  it('should create a process from a contradiction', () => {
    const proc = manager.createProcess(makeContradiction());
    expect(proc.id).toBeDefined();
    expect(proc.name).toBe('test-thesis');
    expect(proc.stage).toBe('nascent');
    expect(proc.currentLayer).toBe('perceive');
  });

  it('should store and retrieve created process', () => {
    const proc = manager.createProcess(makeContradiction());
    const retrieved = manager.getProcess(proc.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(proc.id);
  });

  it('should return undefined for non-existent process', () => {
    const result = manager.getProcess('non-existent');
    expect(result).toBeUndefined();
  });

  it('should list all processes', () => {
    manager.createProcess(makeContradiction('a'));
    manager.createProcess(makeContradiction('b'));
    const all = manager.getAllProcesses();
    expect(all).toHaveLength(2);
  });

  it('should advance process stage', () => {
    const proc = manager.createProcess(makeContradiction());
    expect(proc.stage).toBe('nascent');
    const newStage = manager.advanceProcess(proc.id);
    expect(newStage).toBe('exploring');
    expect(proc.stage).toBe('exploring');
    expect(proc.currentLayer).toBe('think');
  });

  it('should advance through multiple stages', () => {
    const proc = manager.createProcess(makeContradiction());
    manager.advanceProcess(proc.id); // nascent → exploring
    manager.advanceProcess(proc.id); // exploring → crystallizing
    manager.advanceProcess(proc.id); // crystallizing → expressing
    expect(proc.stage).toBe('expressing');
  });

  it('should not advance beyond archived', () => {
    const proc = manager.createProcess(makeContradiction());
    manager.advanceProcess(proc.id);
    manager.advanceProcess(proc.id);
    manager.advanceProcess(proc.id);
    manager.advanceProcess(proc.id); // expressing → archived
    expect(proc.stage).toBe('archived');
    manager.advanceProcess(proc.id); // should stay archived
    expect(proc.stage).toBe('archived');
  });

  it('should throw when advancing non-existent process', () => {
    expect(() => manager.advanceProcess('non-existent')).toThrow('Process not found');
  });

  it('should archive a process', () => {
    const proc = manager.createProcess(makeContradiction());
    expect(proc.stage).toBe('nascent');
    manager.archiveProcess(proc.id);
    expect(proc.stage).toBe('archived');
  });

  it('should throw when archiving non-existent process', () => {
    expect(() => manager.archiveProcess('non-existent')).toThrow('Process not found');
  });

  it('should filter processes by stage', () => {
    const p1 = manager.createProcess(makeContradiction('a'));
    const p2 = manager.createProcess(makeContradiction('b'));
    manager.advanceProcess(p1.id); // a → exploring
    const nascent = manager.getByStage('nascent');
    const exploring = manager.getByStage('exploring');
    expect(nascent).toHaveLength(1);
    expect(exploring).toHaveLength(1);
  });

  it('should spawn a sub-process', () => {
    const proc = manager.createProcess(makeContradiction());
    const child = proc.spawn({ name: 'sub-task', coreContradiction: { thesis: 'sub-thesis', antithesis: 'sub-anti' } });
    expect(child.id).toBeDefined();
    expect(child.name).toBe('sub-task');
    expect(child.stage).toBe('nascent');
    expect(proc.subProcesses).toContain(child.id);
  });

  it('should converge when resolution exists', () => {
    const proc = manager.createProcess(makeContradiction());
    expect(proc.converge()).toBe(false);
    proc.coreContradiction.resolution = 'resolved!';
    expect(proc.converge()).toBe(true);
  });
});
