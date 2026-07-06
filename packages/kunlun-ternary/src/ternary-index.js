/**
 * TernaryIndex — 三元索引系统
 *
 * 替代 FTS5 二值匹配。核心思想：
 *   先返回所有 +1（确认匹配）
 *   再返回所有 0（部分匹配）
 *   排除所有 -1（否定匹配）
 */
export class TernaryIndex {
    index = new Map();
    /**
     * 写入三元索引条目
     */
    indexDocument(docId, keys) {
        for (const { key, quality, confidence } of keys) {
            const entries = this.index.get(key) || [];
            entries.push({
                key,
                documentId: docId,
                matchQuality: quality,
                confidence: Math.max(0, Math.min(1, confidence)),
                lastVerified: new Date(),
            });
            this.index.set(key, entries);
        }
    }
    /**
     * 三元搜索
     * @param queryKeys 查询键数组
     * @param options 搜索选项
     */
    search(queryKeys, options = {}) {
        const { excludeNegative = true, minConfidence = 0, limit = 100, } = options;
        const scoreMap = new Map();
        for (const key of queryKeys) {
            const entries = this.index.get(key) || [];
            for (const entry of entries) {
                if (entry.confidence < minConfidence)
                    continue;
                const current = scoreMap.get(entry.documentId) || {
                    totalQuality: 0,
                    matchCount: 0,
                    details: [],
                };
                current.totalQuality += entry.matchQuality * entry.confidence;
                current.matchCount++;
                current.details.push({
                    key: entry.key,
                    quality: entry.matchQuality,
                    confidence: entry.confidence,
                });
                scoreMap.set(entry.documentId, current);
            }
        }
        let results = Array.from(scoreMap.entries())
            .map(([docId, data]) => ({
            docId,
            totalQuality: data.totalQuality,
            matchCount: data.matchCount,
            details: data.details,
        }));
        // 排除净负分文档
        if (excludeNegative) {
            results = results.filter(r => r.totalQuality > -0.5);
        }
        // 按总分降序排列
        results.sort((a, b) => b.totalQuality - a.totalQuality);
        // 限制返回数量
        return results.slice(0, limit);
    }
    /**
     * 将某个匹配从 0 升级为 +1（验证后确认）
     */
    confirm(key, docId) {
        const entries = this.index.get(key) || [];
        for (const entry of entries) {
            if (entry.documentId === docId && entry.matchQuality === 0) {
                entry.matchQuality = 1;
                entry.confidence = Math.min(1, entry.confidence + 0.2);
                entry.lastVerified = new Date();
                return true;
            }
        }
        return false;
    }
    /**
     * 将某个匹配降级为 -1（验证后否定）
     */
    deny(key, docId) {
        const entries = this.index.get(key) || [];
        for (const entry of entries) {
            if (entry.documentId === docId) {
                entry.matchQuality = -1;
                entry.confidence = Math.max(0, entry.confidence - 0.3);
                entry.lastVerified = new Date();
                return true;
            }
        }
        return false;
    }
    /**
     * 删除文档的所有索引
     */
    removeDocument(docId) {
        let removed = 0;
        for (const [key, entries] of this.index.entries()) {
            const filtered = entries.filter(e => {
                if (e.documentId === docId) {
                    removed++;
                    return false;
                }
                return true;
            });
            if (filtered.length === 0) {
                this.index.delete(key);
            }
            else {
                this.index.set(key, filtered);
            }
        }
        return removed;
    }
    /**
     * 获取索引统计信息
     */
    getStats() {
        const distribution = { 1: 0, 0: 0, '-1': 0 };
        let total = 0;
        for (const entries of this.index.values()) {
            for (const entry of entries) {
                total++;
                const quality = entry.matchQuality;
                if (quality !== undefined)
                    distribution[quality] = (distribution[quality] ?? 0) + 1;
            }
        }
        return {
            totalKeys: this.index.size,
            totalEntries: total,
            qualityDistribution: distribution,
        };
    }
    /** 清空索引 */
    clear() {
        this.index.clear();
    }
}
//# sourceMappingURL=ternary-index.js.map