import {compact, fmt, hourLabel, name} from './data';
import type {Sentiment} from './data';

export type ProviderId = 'qwen' | 'deepseek' | 'openai' | 'custom';

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  baseUrl: string;
  models: ModelOption[];
  defaultModel: string;
  keyUrl: string;
  keyPlaceholder: string;
}

export const DEFAULT_PROVIDER: ProviderId = 'qwen';

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'qwen',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      {id: 'qwen-plus', label: 'qwen-plus（均衡）'},
      {id: 'qwen-max', label: 'qwen-max（最强）'},
      {id: 'qwen-turbo', label: 'qwen-turbo（最快）'},
    ],
    defaultModel: 'qwen-plus',
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    keyPlaceholder: 'DashScope API-KEY',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      {id: 'deepseek-chat', label: 'deepseek-chat'},
      {id: 'deepseek-reasoner', label: 'deepseek-reasoner（推理）'},
    ],
    defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'DeepSeek API Key',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {id: 'gpt-4o-mini', label: 'gpt-4o-mini'},
      {id: 'gpt-4o', label: 'gpt-4o'},
    ],
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'OpenAI API Key',
  },
  {
    id: 'custom',
    label: '自定义',
    baseUrl: '',
    models: [],
    defaultModel: '',
    keyUrl: '',
    keyPlaceholder: 'API Key',
  },
];

export function providerById(id: ProviderId): ProviderConfig {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export interface AgentContext {
  country: string | null;
  sentiment: Sentiment | null;
  language: string | null;
  source: string | null;
  story: string | null;
  query: string;
  hours: [number, number];
  articleCount: number;
  reach: number;
  countryCount: number;
  totalCount: number;
  topCountries: {country: string; mentions: number; reach: number}[];
  topSources: {source: string; mentions: number}[];
  sentimentTotals: {positive: number; neutral: number; negative: number; unknown: number};
  peak: {hour: number; count: number} | null;
  hotStories: {key: string; title: string; outlets: number; articles: number; peakHour: number}[];
  topEntities: {entity: string; articles: number}[];
  mediaInfluence: {domain: string; name: string; reach: number; articles: number}[];
}

const SENTIMENT_LABEL: Record<Sentiment, string> = {positive: '正面', neutral: '中性', negative: '负面', unknown: '未知'};

export function buildSystemPrompt(ctx: AgentContext): string {
  const filters: string[] = [];
  if (ctx.country) filters.push(`国家=${name(ctx.country)}`);
  if (ctx.sentiment) filters.push(`情感=${SENTIMENT_LABEL[ctx.sentiment]}`);
  if (ctx.language) filters.push(`语言=${ctx.language}`);
  if (ctx.source) filters.push(`媒体=${ctx.source}`);
  if (ctx.story) filters.push(`通稿=${ctx.story}`);
  if (ctx.query) filters.push(`搜索="${ctx.query}"`);
  const time = `${hourLabel(ctx.hours[0])}–${hourLabel(ctx.hours[1]).replace(':00', ':59')}`;
  if (ctx.hours[0] > 0 || ctx.hours[1] < 23) filters.push(`时间=${time}`);
  const filterLine = filters.length ? filters.join(' · ') : `未设置筛选（全天 ${time}）`;
  const overview: string[] = [];
  if (ctx.topCountries.length) {
    overview.push(`- 国家 Top10：${ctx.topCountries.map((c) => `${c.country} ${fmt.format(c.mentions)}`).join(' · ')}（按报道量）`);
  }
  if (ctx.topSources.length) {
    overview.push(`- 媒体 Top8：${ctx.topSources.map((s) => `${s.source} ${fmt.format(s.mentions)}`).join(' · ')}（按报道量）`);
  }
  const sentiTotal = ctx.sentimentTotals.positive + ctx.sentimentTotals.neutral + ctx.sentimentTotals.negative + ctx.sentimentTotals.unknown;
  if (sentiTotal > 0) {
    const s = ctx.sentimentTotals;
    overview.push(`- 情感分布：${(['positive', 'neutral', 'negative', 'unknown'] as const).map((k) => `${SENTIMENT_LABEL[k]} ${fmt.format(s[k])}`).join(' · ')}`);
  }
  if (ctx.peak) {
    overview.push(`- 峰值小时：${hourLabel(ctx.peak.hour)}–${hourLabel(ctx.peak.hour).replace(':00', ':59')}（${fmt.format(ctx.peak.count)} 篇）`);
  }
  const overviewBlock = overview.length
    ? ['【视图概览】（当前筛选范围内）', ...overview].join('\n')
    : '【视图概览】当前筛选下暂无可汇总数据。';
  const trunc=(t:string)=>t.length>40?t.slice(0,40)+'…':t;
  const hotBlock=ctx.hotStories.length
    ?['【热榜 Top10】（按跨媒体转载广度排序）',
      ...ctx.hotStories.map((s,i)=>`- ${i+1}. ${trunc(s.title)} · ${s.outlets} 家媒体 ${fmt.format(s.articles)} 篇 · 峰值 ${hourLabel(s.peakHour)}`)].join('\n')
    :'【热榜】当前筛选下无数据。';
  const entityBlock=ctx.topEntities.length
    ?['【高频实体 Top20】（按出现文章数）',...ctx.topEntities.map(e=>`- ${e.entity} ${fmt.format(e.articles)}`)].join('\n')
    :'【高频实体】当前筛选下无数据。';
  const influenceBlock=ctx.mediaInfluence.length
    ?['【媒体影响力 Top10】（reach 为该媒体受众规模，reach 已按媒体去重，不要多篇求和）',
      ...ctx.mediaInfluence.map(m=>`- ${m.domain} 触达约 ${compact.format(m.reach)} · ${fmt.format(m.articles)} 篇`)].join('\n')
    :'【媒体影响力】当前筛选下无数据。';
  return [
    '你是「全球媒体舆情图谱」内嵌的 AI 助手，帮助用户解读当前舆情视图、分析媒体报道与辅助写作。',
    '【当前视图上下文】',
    `- 数据集：TikTok 用户迁入小红书（2025-01-15 全天）的媒体报道，共 ${fmt.format(ctx.totalCount)} 篇；当前筛选后可见 ${fmt.format(ctx.articleCount)} 篇，覆盖 ${ctx.countryCount} 个国家/地区，潜在触达约 ${compact.format(ctx.reach)}。`,
    `- 当前筛选：${filterLine}`,
    overviewBlock,
    hotBlock,
    entityBlock,
    influenceBlock,
    '【回答要求】',
    '- 用中文回答，简洁准确。',
    '- 用户问"哪个/哪些最多、最高、排名"时，直接基于【视图概览】给出排名与数字，不要回答"视图未包含"。',
    '- 用户问"最热/热度"时，基于【热榜 Top10】回答；热度=报道媒体数（跨媒体转载广度），不是单帖点赞数；互动量数据仅部分媒体提供，只有被问及时才引用。',
    '- 提到【视图概览】中的国家、媒体、情感时，在实体后插入对应定位标记：【定位:国家:美国】【定位:媒体:msn.com】【定位:小时:15】【定位:情感:负面】；标记值必须与【视图概览】中的写法一致。',
    '- 只能基于上述上下文与对话内容作答，不要编造具体数字、媒体或事件；【视图概览】未包含的信息要明确说明"当前视图未包含该信息"。',
    '- 数据为媒体报道口径，不代表全球公众意见；回答时注意这一边界。',
  ].join('\n');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatOptions {
  provider: ProviderConfig;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta?: (piece: string) => void;
}

export async function streamChat({provider, apiKey, model, messages, signal, onDelta}: StreamChatOptions): Promise<string> {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
    body: JSON.stringify({model, messages, stream: true}),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `请求失败（HTTP ${res.status}）`;
    try {
      const data = (await res.json()) as {error?: {message?: string}; message?: string};
      message = data.error?.message ?? data.message ?? message;
    } catch {
      // keep the status-based message
    }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';
  let finished = false;
  const handleLine = (line: string) => {
    const text = line.trim();
    if (!text.startsWith('data:')) return;
    const payload = text.slice(5).trim();
    if (payload === '[DONE]') {
      finished = true;
      return;
    }
    try {
      const json = JSON.parse(payload) as {choices?: {delta?: {content?: string}}[]};
      const piece = json.choices?.[0]?.delta?.content;
      if (typeof piece === 'string' && piece) {
        output += piece;
        onDelta?.(piece);
      }
    } catch {
      // ignore malformed payloads
    }
  };
  while (!finished) {
    const {done, value} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});
    let index = buffer.indexOf('\n');
    while (index >= 0) {
      handleLine(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf('\n');
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
  return output;
}
