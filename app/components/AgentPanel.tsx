'use client';
import {useEffect, useRef, useState} from 'react';
import {matchEntities, parseMarkers} from '../lib/agentActions';
import type {AgentAction, AgentEntity} from '../lib/agentActions';
import {DEFAULT_PROVIDER, PROVIDERS, buildSystemPrompt, providerById, streamChat} from '../lib/llm';
import type {AgentContext, ChatMessage, ProviderId} from '../lib/llm';

const keyOf = (id: ProviderId) => `goa:agent-key:${id}`;
const readKey = (id: ProviderId) => (typeof window === 'undefined' ? '' : window.localStorage.getItem(keyOf(id)) ?? '');

export default function AgentPanel({context, entities, onAction}: {context: AgentContext; entities: AgentEntity[]; onAction: (action: AgentAction) => void}) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState<ProviderId>(DEFAULT_PROVIDER);
  const provider = providerById(providerId);
  const [model, setModel] = useState(provider.defaultModel);
  const [apiKey, setApiKey] = useState(() => readKey(DEFAULT_PROVIDER));
  const [baseUrl, setBaseUrl] = useState(() => (typeof window === 'undefined' ? '' : window.localStorage.getItem('goa:agent-baseurl') ?? ''));
  const [customModel, setCustomModel] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({top: el.scrollHeight});
  }, [history, open]);

  const switchProvider = (id: ProviderId) => {
    setProviderId(id);
    setModel(providerById(id).defaultModel);
    setApiKey(readKey(id));
  };
  const saveKey = (value: string) => {
    setApiKey(value);
    if (typeof window !== 'undefined') window.localStorage.setItem(keyOf(providerId), value);
  };

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!apiKey.trim()) {
      setError(`请先填写 API Key（当前模型入口：${provider.label}）。`);
      return;
    }
    const finalProvider = providerId === 'custom' && baseUrl.trim()
      ? {...provider, baseUrl: baseUrl.trim().replace(/\/+$/, '')}
      : provider;
    const finalModel = providerId === 'custom' ? customModel.trim() || 'default' : model;
    const messages: ChatMessage[] = [
      {role: 'system', content: buildSystemPrompt(context)},
      ...history,
      {role: 'user', content: text},
    ];
    const controller = new AbortController();
    abortRef.current = controller;
    setHistory((h) => [...h, {role: 'user', content: text}, {role: 'assistant', content: ''}]);
    setInput('');
    setBusy(true);
    setError(null);
    streamChat({
      provider: finalProvider,
      apiKey: apiKey.trim(),
      model: finalModel,
      messages,
      signal: controller.signal,
      onDelta: (piece) => {
        const clean = parseMarkers(piece, entities).text;
        setHistory((h) => {
          const last = h[h.length - 1];
          if (!last) return h;
          return [...h.slice(0, -1), {role: 'assistant' as const, content: last.content + clean}];
        });
      },
    })
      .then((full) => {
        const parsed = parseMarkers(full || '', entities);
        setHistory((h) => {
          const last = h[h.length - 1];
          if (!last) return h;
          const content = full ? parsed.text : parseMarkers(last.content, entities).text;
          return [...h.slice(0, -1), {role: 'assistant' as const, content}];
        });
        if (parsed.actions[0]) onAction(parsed.actions[0]);
        setBusy(false);
      })
      .catch((err: unknown) => {
        setHistory((h) => {
          const last = h[h.length - 1];
          return last && last.role === 'assistant' && !last.content ? h.slice(0, -1) : h;
        });
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '请求失败，请稍后重试。');
        setBusy(false);
      });
  };

  return (
    <div className="agent-popover">
      <button
        type="button"
        className="agent-trigger"
        aria-expanded={open}
        aria-label={open ? '收起 AI 助手' : '打开 AI 助手'}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">✦</span>
      </button>
      {open && (
        <>
          <div className="agent-backdrop" onClick={() => setOpen(false)} />
          <section className="agent-card" role="dialog" aria-label="AI 助手">
            <header>
              <div>
                <p className="info-kicker">AI ASSISTANT</p>
                <h2>AI 助手</h2>
              </div>
              <button type="button" className="info-close" aria-label="关闭 AI 助手" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>
            <div className="agent-settings">
              <label>
                模型入口
                <select aria-label="模型入口" value={providerId} onChange={(e) => switchProvider(e.target.value as ProviderId)}>
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {providerId === 'custom' ? (
                <label>
                  模型名称
                  <input aria-label="模型名称" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="如 glm-4、llama3-70b" />
                </label>
              ) : (
                <label>
                  模型
                  <select aria-label="模型" value={model} onChange={(e) => setModel(e.target.value)}>
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {providerId === 'custom' && (
                <label>
                  接口地址
                  <input
                    aria-label="接口地址"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      if (typeof window !== 'undefined') window.localStorage.setItem('goa:agent-baseurl', e.target.value);
                    }}
                    placeholder="https://…/v1"
                  />
                </label>
              )}
              <label>
                API Key
                <span className="agent-key-row">
                  <input aria-label="API Key" type="password" value={apiKey} onChange={(e) => saveKey(e.target.value)} placeholder={provider.keyPlaceholder} />
                  {provider.keyUrl && (
                    <a href={provider.keyUrl} target="_blank" rel="noreferrer">
                      获取
                    </a>
                  )}
                </span>
              </label>
            </div>
            <p className="agent-note">Key 只保存在你的浏览器（localStorage），前端直连模型服务商。</p>
            <div className="agent-messages" ref={listRef} aria-live="polite">
              {!history.length && (
                <p className="agent-empty">提问会自动带上当前视图的筛选与统计作为上下文，例如：「现在有哪些话题？」「负面报道集中在哪些媒体？」</p>
              )}
              {history.map((m, i) => (
                <div key={i} className={`agent-msg ${m.role}`}>
                  {m.role === 'assistant' && m.content
                    ? matchEntities(m.content, entities).map((seg, j) =>
                        seg.kind === 'ref' ? (
                          <button
                            key={j}
                            type="button"
                            className="agent-ref"
                            title={`在视图中定位${seg.entity.label}`}
                            onClick={() => onAction({type: seg.entity.type, label: seg.entity.label, value: seg.entity.value})}
                          >
                            {seg.entity.label}
                          </button>
                        ) : (
                          <span key={j}>{seg.text}</span>
                        ),
                      )
                    : m.content || (busy && i === history.length - 1 ? '…' : '')}
                </div>
              ))}
            </div>
            {error && (
              <p className="agent-error" role="alert">
                {error}
              </p>
            )}
            <form
              className="agent-form"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                aria-label="输入消息"
                rows={2}
                value={input}
                placeholder="输入问题，Enter 发送，Shift+Enter 换行"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              {busy ? (
                <button type="button" className="agent-stop" onClick={() => abortRef.current?.abort()}>
                  停止
                </button>
              ) : (
                <button type="submit" className="agent-send">
                  发送
                </button>
              )}
            </form>
          </section>
        </>
      )}
    </div>
  );
}
