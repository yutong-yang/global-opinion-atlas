'use client';

import {useEffect, useRef, useState} from 'react';

const encodingGroups = [
  {
    title: '世界地图',
    items: ['底色表示当前所选指标：报道量、潜在触达或情感偏向。', '气泡面积表示从 00:00 到当前时间的累计潜在触达。'],
  },
  {
    title: '排名与时间',
    items: ['排名曲线越靠上，代表该国家在对应时段的报道热度越高。', '底部时间轴控制所有图表的统计窗口；播放会逐小时推进。'],
  },
  {
    title: '主题河流',
    items: ['河流宽度表示该主题在对应时段的报道数量。', '颜色区分主题，点击色带可聚焦或取消聚焦。'],
  },
  {
    title: '媒体传播',
    items: ['每一行是一组同题报道，每个点是一家转载媒体。', '点面积对应潜在触达，深色描边标记该组最早出现的报道。'],
  },
];

export default function InfoPopover() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="info-popover">
      {open && <button className="info-backdrop" aria-label="关闭说明浮层" onClick={() => setOpen(false)} />}
      {open && (
        <section className="info-card" role="dialog" aria-modal="true" aria-labelledby="encoding-guide-title">
          <header>
            <div>
              <p className="info-kicker">VISUAL ENCODING</p>
              <h2 id="encoding-guide-title">如何阅读本图</h2>
            </div>
            <button ref={closeButtonRef} className="info-close" aria-label="关闭视觉编码说明" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="info-content">
            {encodingGroups.map(group => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                <ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul>
              </section>
            ))}
          </div>
          <p className="info-note"><strong>范围说明</strong>　本页统计媒体报道样本，呈现的是媒体覆盖与叙事分布，不代表全球公众意见。</p>
        </section>
      )}
      <button
        className="info-trigger"
        aria-label="查看视觉编码说明"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >i</button>
    </div>
  );
}
