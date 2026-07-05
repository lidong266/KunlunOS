import { describe, it, expect, beforeEach } from 'vitest';
import { TernaryIndex } from '../src/ternary-index.js';

describe('TernaryIndex', () => {
  let idx: TernaryIndex;

  beforeEach(() => {
    idx = new TernaryIndex();
  });

  describe('indexDocument', () => {
    it('should index a document with multiple keys', () => {
      idx.indexDocument('doc1', [
        { key: 'contradiction', quality: 1, confidence: 0.9 },
        { key: 'practice', quality: 0, confidence: 0.5 },
      ]);
      const stats = idx.getStats();
      expect(stats.totalKeys).toBe(2);
      expect(stats.totalEntries).toBe(2);
    });

    it('should accumulate multiple documents under the same key', () => {
      idx.indexDocument('doc1', [{ key: 'contradiction', quality: 1, confidence: 0.9 }]);
      idx.indexDocument('doc2', [{ key: 'contradiction', quality: -1, confidence: 0.7 }]);
      const stats = idx.getStats();
      expect(stats.totalKeys).toBe(1);
      expect(stats.totalEntries).toBe(2);
    });

    it('should clamp confidence to [0, 1]', () => {
      idx.indexDocument('doc1', [
        { key: 'test', quality: 1, confidence: 1.5 },
        { key: 'test2', quality: 0, confidence: -0.3 },
      ]);
      const results = idx.search(['test', 'test2']);
      expect(results).toHaveLength(1);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      idx.indexDocument('doc_pos', [
        { key: 'contradiction', quality: 1, confidence: 0.9 },
        { key: 'practice', quality: 1, confidence: 0.8 },
      ]);
      idx.indexDocument('doc_mixed', [
        { key: 'contradiction', quality: 1, confidence: 0.7 },
        { key: 'practice', quality: -1, confidence: 0.6 },
      ]);
      idx.indexDocument('doc_neg', [
        { key: 'contradiction', quality: -1, confidence: 0.9 },
        { key: 'practice', quality: -1, confidence: 0.8 },
      ]);
    });

    it('should return results sorted by totalQuality descending', () => {
      const results = idx.search(['contradiction', 'practice']);
      expect(results).toHaveLength(2); // doc_neg excluded
      expect(results[0].docId).toBe('doc_pos');
      expect(results[1].docId).toBe('doc_mixed');
      expect(results[0].totalQuality).toBeGreaterThan(results[1].totalQuality);
    });

    it('should exclude net-negative docs by default', () => {
      const results = idx.search(['practice']);
      // doc_pos: 0.8, doc_mixed: -0.6, doc_neg: -0.8
      // doc_neg and doc_mixed both net negative under single key
      // Actually with practice: doc_pos(+1*0.8), doc_mixed(-1*0.6), doc_neg(-1*0.8)
      expect(results.find(r => r.docId === 'doc_neg')).toBeUndefined();
      expect(results.find(r => r.docId === 'doc_pos')).toBeDefined();
    });

    it('should include negative docs when excludeNegative is false', () => {
      const results = idx.search(['practice'], { excludeNegative: false });
      expect(results.find(r => r.docId === 'doc_neg')).toBeDefined();
      expect(results).toHaveLength(3);
    });

    it('should filter by minConfidence', () => {
      const results = idx.search(['contradiction', 'practice'], { minConfidence: 0.7 });
      // doc_mixed has practice at confidence 0.6 — but contradiction at 0.7 passes
      // The filter is per-entry, so entries below threshold are skipped
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit option', () => {
      // Add more docs to test limit
      idx.indexDocument('doc3', [{ key: 'contradiction', quality: 1, confidence: 0.5 }]);
      const results = idx.search(['contradiction'], { limit: 2, excludeNegative: false });
      expect(results).toHaveLength(2);
    });

    it('should return empty array for unknown keys', () => {
      const results = idx.search(['nonexistent']);
      expect(results).toHaveLength(0);
    });

    it('should compute correct totalQuality with weighted confidence', () => {
      const results = idx.search(['contradiction', 'practice']);
      const docPos = results.find(r => r.docId === 'doc_pos')!;
      // 1*0.9 + 1*0.8 = 1.7
      expect(docPos.totalQuality).toBeCloseTo(1.7, 5);
    });
  });

  describe('confirm', () => {
    it('should upgrade a match from 0 to +1', () => {
      idx.indexDocument('doc1', [{ key: 'contradiction', quality: 0, confidence: 0.5 }]);
      const ok = idx.confirm('contradiction', 'doc1');
      expect(ok).toBe(true);

      const results = idx.search(['contradiction']);
      expect(results[0].totalQuality).toBeGreaterThan(0);
      expect(results[0].details[0].quality).toBe(1);
    });

    it('should boost confidence on confirm', () => {
      idx.indexDocument('doc1', [{ key: 'contradiction', quality: 0, confidence: 0.5 }]);
      idx.confirm('contradiction', 'doc1');
      const results = idx.search(['contradiction']);
      expect(results[0].details[0].confidence).toBe(0.7); // 0.5 + 0.2
    });

    it('should not confirm already positive matches', () => {
      idx.indexDocument('doc1', [{ key: 'contradiction', quality: 1, confidence: 0.5 }]);
      const ok = idx.confirm('contradiction', 'doc1');
      expect(ok).toBe(false);
    });

    it('should return false for non-existent key', () => {
      const ok = idx.confirm('nonexistent', 'doc1');
      expect(ok).toBe(false);
    });
  });

  describe('deny', () => {
    it('should downgrade any match to -1', () => {
      idx.indexDocument('doc1', [{ key: 'contradiction', quality: 1, confidence: 0.9 }]);
      const ok = idx.deny('contradiction', 'doc1');
      expect(ok).toBe(true);

      const results = idx.search(['contradiction'], { excludeNegative: false });
      expect(results[0].details[0].quality).toBe(-1);
    });

    it('should reduce confidence on deny', () => {
      idx.indexDocument('doc1', [{ key: 'contradiction', quality: 1, confidence: 0.9 }]);
      idx.deny('contradiction', 'doc1');
      const results = idx.search(['contradiction'], { excludeNegative: false });
      expect(results[0].details[0].confidence).toBeCloseTo(0.6, 5); // 0.9 - 0.3
    });

    it('should return false for non-existent key', () => {
      const ok = idx.deny('nonexistent', 'doc1');
      expect(ok).toBe(false);
    });
  });

  describe('removeDocument', () => {
    it('should remove all entries for a document', () => {
      idx.indexDocument('doc1', [
        { key: 'a', quality: 1, confidence: 0.9 },
        { key: 'b', quality: 0, confidence: 0.5 },
      ]);
      const removed = idx.removeDocument('doc1');
      expect(removed).toBe(2);
      expect(idx.search(['a', 'b'])).toHaveLength(0);
    });

    it('should return 0 for non-existent document', () => {
      const removed = idx.removeDocument('nonexistent');
      expect(removed).toBe(0);
    });

    it('should clean up empty keys', () => {
      idx.indexDocument('doc1', [{ key: 'a', quality: 1, confidence: 0.9 }]);
      idx.removeDocument('doc1');
      const stats = idx.getStats();
      expect(stats.totalKeys).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should report correct quality distribution', () => {
      idx.indexDocument('doc1', [
        { key: 'k1', quality: 1, confidence: 0.9 },
        { key: 'k2', quality: 0, confidence: 0.5 },
        { key: 'k3', quality: -1, confidence: 0.7 },
      ]);
      const stats = idx.getStats();
      expect(stats.qualityDistribution[1]).toBe(1);
      expect(stats.qualityDistribution[0]).toBe(1);
      expect(stats.qualityDistribution[-1]).toBe(1);
    });

    it('should report zero for empty index', () => {
      const stats = idx.getStats();
      expect(stats.totalKeys).toBe(0);
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      idx.indexDocument('doc1', [{ key: 'a', quality: 1, confidence: 0.9 }]);
      idx.clear();
      expect(idx.getStats().totalEntries).toBe(0);
    });
  });
});
