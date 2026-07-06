import type { Trit } from './trit.js';
/**
 * 三元索引条目
 *
 * 每个索引条目带有 Trit 标记：
 *   +1 = 确认匹配（精确命中）
 *    0 = 部分匹配（语义相关但非精确）
 *   -1 = 否定匹配（明确不匹配，用于排除）
 */
export interface TernaryIndexEntry {
    key: string;
    documentId: string;
    matchQuality: Trit;
    confidence: number;
    lastVerified: Date;
}
/**
 * 三元索引搜索选项
 */
export interface TernarySearchOptions {
    /** 是否排除净负分文档（默认 true） */
    excludeNegative?: boolean;
    /** 最小置信度阈值 */
    minConfidence?: number;
    /** 最大返回结果数 */
    limit?: number;
}
/**
 * 搜索结果
 */
export interface TernarySearchResult {
    docId: string;
    totalQuality: number;
    matchCount: number;
    details: Array<{
        key: string;
        quality: Trit;
        confidence: number;
    }>;
}
/**
 * TernaryIndex — 三元索引系统
 *
 * 替代 FTS5 二值匹配。核心思想：
 *   先返回所有 +1（确认匹配）
 *   再返回所有 0（部分匹配）
 *   排除所有 -1（否定匹配）
 */
export declare class TernaryIndex {
    private index;
    /**
     * 写入三元索引条目
     */
    indexDocument(docId: string, keys: Array<{
        key: string;
        quality: Trit;
        confidence: number;
    }>): void;
    /**
     * 三元搜索
     * @param queryKeys 查询键数组
     * @param options 搜索选项
     */
    search(queryKeys: string[], options?: TernarySearchOptions): TernarySearchResult[];
    /**
     * 将某个匹配从 0 升级为 +1（验证后确认）
     */
    confirm(key: string, docId: string): boolean;
    /**
     * 将某个匹配降级为 -1（验证后否定）
     */
    deny(key: string, docId: string): boolean;
    /**
     * 删除文档的所有索引
     */
    removeDocument(docId: string): number;
    /**
     * 获取索引统计信息
     */
    getStats(): {
        totalKeys: number;
        totalEntries: number;
        qualityDistribution: Record<number, number>;
    };
    /** 清空索引 */
    clear(): void;
}
//# sourceMappingURL=ternary-index.d.ts.map