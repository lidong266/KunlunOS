import { describe, it, expect, beforeEach } from 'vitest';
import { CognitivePipeline, PIPELINE_LAYER_ORDER } from '../src/index.js';
import type { PipelineData, PipelineStage, PipelineLayerType } from '../src/index.js';

function makeInput(payload: unknown = 'test-data'): PipelineData {
  return {
    type: 'perceive',
    payload,
    meta: {
      source: 'test',
      confidence: 0.8,
      timestamp: Date.now(),
      chain: [],
    },
  };
}

function makeProcessor(layer: PipelineLayerType, name: string, transform?: (p: unknown) => unknown): PipelineStage {
  return {
    name,
    type: layer,
    async process(input: PipelineData): Promise<PipelineData> {
      return {
        ...input,
        payload: transform ? transform(input.payload) : input.payload,
        meta: {
          ...input.meta,
          confidence: Math.min(1, input.meta.confidence + 0.01),
        },
      };
    },
  };
}

describe('CognitivePipeline', () => {
  let pipeline: CognitivePipeline;

  beforeEach(() => {
    pipeline = new CognitivePipeline();
  });

  it('should initialize with 7 layers', () => {
    const layers = pipeline.getLayers();
    expect(layers).toHaveLength(7);
    expect(layers).toEqual(['perceive', 'think', 'express', 'memorize', 'govern', 'evolve', 'act']);
  });

  it('should have empty processors by default', () => {
    for (const layer of PIPELINE_LAYER_ORDER) {
      const stage = pipeline.getStage(layer);
      expect(stage).toHaveLength(0);
    }
  });

  it('should add processor to a specific layer', () => {
    const processor = makeProcessor('perceive', 'sensor');
    pipeline.addProcessor('perceive', processor);
    const stage = pipeline.getStage('perceive');
    expect(stage).toHaveLength(1);
    expect(stage[0]!.name).toBe('sensor');
  });

  it('should add multiple processors to same layer', () => {
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'p1'));
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'p2'));
    expect(pipeline.getStage('perceive')).toHaveLength(2);
  });

  it('should throw on unknown layer in addProcessor', () => {
    expect(() => pipeline.addProcessor('unknown' as PipelineLayerType, makeProcessor('perceive', 'x')))
      .toThrow('Unknown pipeline layer');
  });

  it('should throw on unknown layer in getStage', () => {
    expect(() => pipeline.getStage('unknown' as PipelineLayerType))
      .toThrow('Unknown pipeline layer');
  });

  it('should run pipeline with no processors and return unchanged payload', async () => {
    const input = makeInput('hello');
    const result = await pipeline.run(input);
    expect(result.payload).toBe('hello');
    expect(result.meta.chain).toHaveLength(7); // each layer recorded
  });

  it('should run pipeline with processors transforming data', async () => {
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'sensor', (p) => `sensed:${p}`));
    pipeline.addProcessor('think', makeProcessor('think', 'analyzer', (p) => `analyzed:${p}`));
    const input = makeInput('raw');
    const result = await pipeline.run(input);
    expect(result.payload).toBe('analyzed:sensed:raw');
  });

  it('should track processing chain via getChain', async () => {
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'sensor'));
    pipeline.addProcessor('think', makeProcessor('think', 'brain'));
    const chain = await pipeline.getChain(makeInput());
    expect(chain).toHaveLength(7);
    expect(chain[0]).toContain('perceive:sensor');
    expect(chain[1]).toContain('think:brain');
    // layers with no processors have empty names
    expect(chain[2]).toContain('express:');
  });

  it('should update type field through each layer', async () => {
    const input = makeInput();
    const result = await pipeline.run(input);
    // final type should be 'act' (last layer)
    expect(result.type).toBe('act');
  });

  it('should increment confidence through processors', async () => {
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'p1'));
    pipeline.addProcessor('think', makeProcessor('think', 'p2'));
    const result = await pipeline.run(makeInput());
    // each processor adds 0.01, 2 processors => 0.8 + 0.02 = 0.82
    expect(result.meta.confidence).toBeCloseTo(0.82);
  });

  it('should clear a specific stage', () => {
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'p1'));
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'p2'));
    expect(pipeline.getStage('perceive')).toHaveLength(2);
    pipeline.clearStage('perceive');
    expect(pipeline.getStage('perceive')).toHaveLength(0);
  });

  it('should throw on clearing unknown layer', () => {
    expect(() => pipeline.clearStage('unknown' as PipelineLayerType))
      .toThrow('Unknown pipeline layer');
  });

  it('should clear all stages', () => {
    pipeline.addProcessor('perceive', makeProcessor('perceive', 'p1'));
    pipeline.addProcessor('think', makeProcessor('think', 'p2'));
    pipeline.addProcessor('act', makeProcessor('act', 'p3'));
    pipeline.clearAll();
    for (const layer of PIPELINE_LAYER_ORDER) {
      expect(pipeline.getStage(layer)).toHaveLength(0);
    }
  });

  it('should handle empty chain in input data', async () => {
    const input = makeInput();
    input.meta.chain = [];
    const result = await pipeline.run(input);
    expect(result.meta.chain).toHaveLength(7);
  });

  it('should preserve original chain entries when adding new ones', async () => {
    const input = makeInput();
    input.meta.chain = ['pre-entry'];
    const result = await pipeline.run(input);
    expect(result.meta.chain[0]).toBe('pre-entry');
    expect(result.meta.chain).toHaveLength(8); // pre-entry + 7 layers
  });

  it('should run complete pipeline with all 7 layers having processors', async () => {
    for (const layer of PIPELINE_LAYER_ORDER) {
      pipeline.addProcessor(layer, makeProcessor(layer, `${layer}-proc`));
    }
    const result = await pipeline.run(makeInput('start'));
    expect(result.payload).toBe('start'); // no transform, just pass-through
    expect(result.meta.chain).toHaveLength(7);
    for (const layer of PIPELINE_LAYER_ORDER) {
      const chainEntry = result.meta.chain[PIPELINE_LAYER_ORDER.indexOf(layer)];
      expect(chainEntry).toContain(`${layer}-proc`);
    }
  });
});
