import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {streamChat} from '../lib/llm';
import type {AgentContext} from '../lib/llm';
import type {AgentAction, AgentEntity} from '../lib/agentActions';
import AgentPanel from './AgentPanel';

vi.mock('../lib/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/llm')>();
  return {...actual, streamChat: vi.fn()};
});

const streamChatMock = vi.mocked(streamChat);

const context: AgentContext = {
  country: null, sentiment: null, language: null,
  source: null, story: null, query: '', hours: [0, 23],
  articleCount: 5543, reach: 81000000, countryCount: 87, totalCount: 5543,
  topCountries: [], topSources: [],
  sentimentTotals: {positive: 0, neutral: 0, negative: 0, unknown: 0},
  peak: null,
  hotStories: [], topEntities: [], mediaInfluence: [],
};

const entities: AgentEntity[] = [
  {type: 'country', label: '美国', value: 'United States'},
  {type: 'country', label: '印度', value: 'India'},
];

const renderPanel = (onAction: (a: AgentAction) => void = vi.fn()) => {
  render(<AgentPanel context={context} entities={entities} onAction={onAction} />);
  fireEvent.click(screen.getByRole('button', {name: '打开 AI 助手'}));
  fireEvent.change(screen.getByLabelText('API Key'), {target: {value: 'sk-abc'}});
};

const ask = (question: string) => {
  fireEvent.change(screen.getByLabelText('输入消息'), {target: {value: question}});
  fireEvent.keyDown(screen.getByLabelText('输入消息'), {key: 'Enter'});
};

const assistantText = () => document.querySelector('.agent-msg.assistant')?.textContent;

beforeEach(() => {
  localStorage.clear();
  streamChatMock.mockReset().mockResolvedValue('回答摘要…');
});

afterEach(cleanup);

describe('AgentPanel', () => {
  it('opens the chat dialog with qwen preselected and closes it', () => {
    render(<AgentPanel context={context} entities={entities} onAction={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: '打开 AI 助手'}));
    expect(screen.getByRole('dialog', {name: 'AI 助手'})).toBeInTheDocument();
    expect(screen.getByLabelText('模型入口')).toHaveValue('qwen');

    fireEvent.click(screen.getByRole('button', {name: '关闭 AI 助手'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches model options when the provider changes', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText('模型入口'), {target: {value: 'deepseek'}});
    const model = screen.getByLabelText('模型') as unknown as HTMLSelectElement;
    expect(model).toHaveValue('deepseek-chat');
    expect(Array.from(model.options).map((o) => o.value)).toContain('deepseek-reasoner');
  });

  it('persists the API key per provider in localStorage', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText('API Key'), {target: {value: 'sk-abc'}});
    expect(localStorage.getItem('goa:agent-key:qwen')).toBe('sk-abc');
  });

  it('sends the view context as system message and streams the reply on Enter', async () => {
    renderPanel();
    ask('现在有哪些话题？');

    await waitFor(() => expect(streamChatMock).toHaveBeenCalledTimes(1));
    const options = streamChatMock.mock.calls[0][0];
    expect(options.provider.id).toBe('qwen');
    expect(options.apiKey).toBe('sk-abc');
    expect(options.model).toBe('qwen-plus');
    expect(options.messages[0].role).toBe('system');
    expect(options.messages[0].content).toContain('当前筛选');
    expect(options.messages[0].content).toContain('5,543');
    const last = options.messages[options.messages.length - 1];
    expect(last).toEqual({role: 'user', content: '现在有哪些话题？'});

    expect(await screen.findByText('回答摘要…')).toBeInTheDocument();
    expect(screen.getByLabelText('输入消息')).toHaveValue('');
  });

  it('asks for an API key instead of calling the provider', async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('API Key'), {target: {value: ''}});
    ask('你好');

    expect(screen.getByRole('alert')).toHaveTextContent('请先填写 API Key');
    expect(streamChatMock).not.toHaveBeenCalled();
  });

  it('strips 定位 markers, shows clean text and auto-applies the first action', async () => {
    streamChatMock.mockResolvedValue('报道最多的是美国【定位:国家:美国】。');
    const onAction = vi.fn();
    renderPanel(onAction);
    ask('哪个国家最多？');

    await waitFor(() => expect(assistantText()).toBe('报道最多的是美国。'));
    expect(screen.queryByText(/【定位/)).not.toBeInTheDocument();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({type: 'country', label: '美国', value: 'United States'});
  });

  it('does not auto-apply before the stream resolves', async () => {
    let resolve!: (text: string) => void;
    streamChatMock.mockReturnValue(new Promise<string>((r) => { resolve = r; }));
    const onAction = vi.fn();
    renderPanel(onAction);
    ask('哪个国家最多？');

    await waitFor(() => expect(streamChatMock).toHaveBeenCalledTimes(1));
    expect(onAction).not.toHaveBeenCalled();
    resolve('美国最多【定位:国家:美国】');
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
  });

  it('auto-applies only the first of multiple markers', async () => {
    streamChatMock.mockResolvedValue('美国【定位:国家:美国】和小红书【定位:话题:小红书】');
    const onAction = vi.fn();
    renderPanel(onAction);
    ask('概况');

    await waitFor(() => expect(assistantText()).toBe('美国和小红书'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({type: 'country', label: '美国', value: 'United States'});
  });

  it('strips markers with unknown labels without firing onAction', async () => {
    streamChatMock.mockResolvedValue('法国也有报道【定位:国家:法国】');
    const onAction = vi.fn();
    renderPanel(onAction);
    ask('法国呢？');

    await waitFor(() => expect(assistantText()).toBe('法国也有报道'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('renders entity mentions as clickable buttons that fire onAction', async () => {
    streamChatMock.mockResolvedValue('美国和印度的报道量靠前。');
    const onAction = vi.fn();
    renderPanel(onAction);
    ask('哪些国家最多？');

    const india = await screen.findByRole('button', {name: '印度'});
    expect(screen.getByRole('button', {name: '美国'})).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.click(india);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({type: 'country', label: '印度', value: 'India'});
  });
});
