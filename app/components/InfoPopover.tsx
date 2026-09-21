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
    title: '媒体河流',
    items: ['每条色带是一家媒体（全天发文量 Top 15）：厚度表示该小时发文量，颜色与各视图平台色一致。', '带内圆点为同题转载簇中的报道：颜色代表文章话题，面积对应潜在触达；连线是同一篇通稿的跨媒体转播路径。', '点击点或连线选中通稿（与媒体传播面板联动）；点击色带筛选媒体。'],
  },
  {
    title: '媒体传播',
    items: ['每一行是一组同题报道，每个点是一家转载媒体。', '点面积对应潜在触达，深色描边标记该组最早出现的报道；点颜色代表平台（Top 15 平台全局固定同色，长尾平台为灰色）。', '选中一行通稿后，顶部路径条按发布时刻连线展示其跨平台转播路径；点击路径站点或图例可筛选平台。', '同一平台的颜色在媒体传播、转载网络、媒体构成圈、触达榜与文章列表中保持一致。'],
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
