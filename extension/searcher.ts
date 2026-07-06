/**
 * 谛听搜索层 — 通过 agent-reach 各平台 CLI 执行搜索
 *
 * 直接调用 agent-reach 已安装的 CLI，不绕 mcporter。
 * 所有后端都走 execSync，哪个平台有就用哪个。
 */

import { execSync } from 'node:child_process';

// ═══════════════════════════════════════════════════════════════
// 搜索结果
// ═══════════════════════════════════════════════════════════════

export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
  source: string;
}

export interface SearchConfig {
  enabled: boolean;
  timeout: number;
}

const DEFAULT_CONFIG: SearchConfig = {
  enabled: true,
  timeout: 8000,
};

let config: SearchConfig = { ...DEFAULT_CONFIG };

export function setSearchConfig(c: Partial<SearchConfig>): void {
  config = { ...config, ...c };
}

export function getSearchConfig(): SearchConfig {
  return { ...config };
}

// ═══════════════════════════════════════════════════════════════
// agent-reach 平台路由
// ═══════════════════════════════════════════════════════════════

const AGENT_REACH = '/root/.agent-reach-venv/bin/agent-reach';

/**
 * 对分析查询执行搜索
 * 按优先级尝试各平台，全部失败则返回空
 */
export async function searchWeb(query: string, maxResults = 3): Promise<{
  results: SearchResult[];
  summary: string;
}> {
  if (!config.enabled) {
    return { results: [], summary: '' };
  }

  let results: SearchResult[] = [];

  // 后端 1: GitHub 搜索（免费，无需 Key）
  if (results.length === 0) results = await searchGitHub(query, maxResults);

  // 后端 2: B站搜索（免费，无需 Key）
  if (results.length === 0) results = await searchBilibili(query, maxResults);

  // 后端 3: RSS 搜索（通过 agent-reach 的能力）
  if (results.length === 0) results = await searchRSS(query, maxResults);

  // 后端 4: Jina Reader（读已知 URL，作为兜底）
  if (results.length === 0) results = await searchJina(query, maxResults);

  const summary = formatSearchSummary(results, query);
  return { results, summary };
}

// ═══════════════════════════════════════════════════════════════
// GitHub 搜索 (gh CLI)
// ═══════════════════════════════════════════════════════════════

async function searchGitHub(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const out = execSync(
      `gh search repos "${query}" --limit ${limit} --json name,description,url 2>/dev/null`,
      { encoding: 'utf8', timeout: config.timeout, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    if (!out || out.trim().length === 0) return [];

    const items = JSON.parse(out);
    if (!Array.isArray(items)) return [];

    return items.slice(0, limit).map((r: any) => ({
      title: r.name || '',
      snippet: r.description || '',
      url: r.url || '',
      source: 'github',
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// B站搜索
// ═══════════════════════════════════════════════════════════════

async function searchBilibili(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const out = execSync(
      `curl -s --max-time 5 "https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encoded}&page=1" \
        -H "User-Agent: Mozilla/5.0" 2>/dev/null`,
      { encoding: 'utf8', timeout: config.timeout, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    if (!out) return [];

    const data = JSON.parse(out);
    const results = data?.data?.result || [];

    return results.slice(0, limit).map((r: any) => ({
      title: r.title?.replace(/<[^>]*>/g, '') || '',
      snippet: r.desc || r.author || '',
      url: `https://www.bilibili.com/video/${r.bvid}`,
      source: 'bilibili',
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// RSS 搜索 (通过 python feedparser)
// ═══════════════════════════════════════════════════════════════

// 预置的 RSS 源（可扩展）
const RSS_FEEDS: Record<string, string> = {
  '科技': 'https://feeds.feedburner.com/36kr/article',
  '经济': 'https://feedx.net/rss/bbcchinese.xml',
  '综合': 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
};

async function searchRSS(query: string, limit: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  for (const [category, feedUrl] of Object.entries(RSS_FEEDS)) {
    try {
      const out = execSync(
        `python3 -c "
import feedparser, json
feed = feedparser.parse('${feedUrl}')
items = []
for e in feed.entries[:10]:
    if '${query}' in (e.title or '') or '${query}' in (e.summary or ''):
        items.append({'title': e.title, 'snippet': e.summary[:100], 'url': e.link})
print(json.dumps(items, ensure_ascii=False))
" 2>/dev/null`,
        { encoding: 'utf8', timeout: config.timeout, stdio: ['pipe', 'pipe', 'ignore'] },
      );
      if (!out) continue;

      const items = JSON.parse(out);
      if (Array.isArray(items)) {
        for (const item of items.slice(0, limit - results.length)) {
          results.push({
            title: item.title || '',
            snippet: item.snippet || '',
            url: item.url || '',
            source: 'rss/' + category,
          });
        }
      }
      if (results.length >= limit) break;
    } catch {
      continue;
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Jina Reader (读网页内容)
// ═══════════════════════════════════════════════════════════════

async function searchJina(query: string, limit: number): Promise<SearchResult[]> {
  // Jina Reader 是读具体 URL 的，不是搜索引擎。
  // 这里作为兜底：如果查询看起来像 URL，直接读取
  if (!query.match(/^https?:\/\//)) return [];

  try {
    const out = execSync(
      `curl -s --max-time 5 "https://r.jina.ai/${encodeURIComponent(query)}" 2>/dev/null`,
      { encoding: 'utf8', timeout: config.timeout, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    if (!out || out.length < 50) return [];

    return [{
      title: query.slice(0, 60),
      snippet: out.replace(/\n/g, ' ').slice(0, 200),
      url: query,
      source: 'jina',
    }];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// 格式化
// ═══════════════════════════════════════════════════════════════

function formatSearchSummary(results: SearchResult[], query: string): string {
  if (results.length === 0) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push('【联网搜索结果】');

  const sourceIcons: Record<string, string> = {
    github: '🐙', bilibili: '📺', rss: '📰', jina: '🌐',
    exa: '🔍', wikipedia: '📖',
  };

  for (const r of results) {
    const icon = sourceIcons[r.source] || '🌐';
    lines.push(`  ${icon} [${r.source}] ${r.title}`);
    if (r.snippet) lines.push(`    ${r.snippet.slice(0, 120)}`);
  }
  lines.push('');

  return lines.join('\n');
}
