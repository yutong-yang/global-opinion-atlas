'use client';
import {useEffect} from 'react';
import {Article,PlatformColors,PLATFORM_OTHER,name,fmt,compact} from '../lib/data';

const sentiLabel:Record<string,string>={positive:'正面',neutral:'中性',negative:'负面',unknown:'未知'};

export default function ArticleDrawer({article,platforms,onClose}:{article:Article|null;platforms:PlatformColors|null;onClose:()=>void}){
  useEffect(()=>{
    if(!article)return;
    const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[article,onClose]);
  if(!article)return null;
  return <div className="drawer-overlay" onClick={onClose}>
    <aside className="drawer" onClick={e=>e.stopPropagation()}>
      <button className="drawer-close" onClick={onClose} aria-label="关闭">✕</button>
      <div className="article-meta">
        <span>{name(article.country)}</span>
        <span>{article.language}</span>
        <span data-sentiment={article.sentiment}>{sentiLabel[article.sentiment]}</span>
        <span>{article.publishTime||''} · 2025-01-15</span>
      </div>
      <h2>{article.url?<a href={article.url} target="_blank" rel="noreferrer">{article.title||'无标题'}</a>:article.title||'无标题'}</h2>
      <p className="drawer-source"><i className="plat-dot" style={{background:platforms?platforms.colorOf(article.sourceDomain||''):PLATFORM_OTHER}}/>{article.sourceName||'未知媒体'} · {article.sourceDomain||'未知域名'}</p>
      <dl className="drawer-stats">
        <div><dt>潜在触达</dt><dd>{article.reach==null?'缺失':compact.format(article.reach)}</dd></div>
        <div><dt>互动量</dt><dd>{article.engagement==null?'缺失':fmt.format(article.engagement)}</dd></div>
      </dl>
      {article.lead&&<><h3>导语</h3><p className="drawer-text">{article.lead}</p></>}
      {article.matchedSentence&&<><h3>命中句</h3><blockquote>{article.matchedSentence}</blockquote></>}
      {article.keywordSentence&&<><h3>关键词句</h3><blockquote>{article.keywordSentence}</blockquote></>}
      <h3>原始记录</h3>
      <p className="drawer-text mono">行号 {article.rowNumber} · 文章ID {article.articleId}<br/>地区 {article.region||'—'} / {article.state||'—'} / {article.city||'—'} · 检索词 {article.queryKeywords||'—'}</p>
    </aside>
  </div>;
}
