'use client';
import {useEffect,useState} from 'react';
import {Article,PlatformColors,PLATFORM_OTHER,name,compact,hourLabel,hourOfDay} from '../lib/data';

const PAGE=14;
const sentiLabel:Record<string,string>={positive:'正面',neutral:'中性',negative:'负面',unknown:'未知'};

export default function EvidencePanel({articles,platforms,onOpen}:{articles:Article[];platforms:PlatformColors|null;onOpen:(a:Article)=>void}){
  const[page,setPage]=useState(0);
  const pages=Math.max(1,Math.ceil(articles.length/PAGE));
  useEffect(()=>setPage(0),[articles]);
  const rows=[...articles].sort((a,b)=>hourOfDay(a)-hourOfDay(b)||(a.publishTime||'').localeCompare(b.publishTime||'')).slice(page*PAGE,page*PAGE+PAGE);
  return <section className="panel evidence">
    <div className="evidence-head">
      <div className="ev-tabs" role="tablist">
        <button role="tab" aria-selected={true} className="ev-tab">文章证据 <em>{articles.length} 条</em></button>
      </div>
      <div className="evidence-pager">
        <button disabled={page===0} onClick={()=>setPage(p=>p-1)}>‹</button>
        <span>{page+1} / {pages}</span>
        <button disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>›</button>
      </div>
    </div>
    <div className="evidence-list">
      {rows.map(a=><div key={`${a.articleId}-${a.rowNumber}`} className="evidence-row" title={a.title||'无标题'} onClick={()=>onOpen(a)}>
        <div className="evidence-title">
          {a.url?<a href={a.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{a.title||'无标题'}</a>:a.title||'无标题'}
        </div>
        <div className="evidence-meta">{hourLabel(hourOfDay(a))} · {name(a.country)} · <i className="plat-dot" style={{background:platforms?platforms.colorOf(a.sourceDomain||''):PLATFORM_OTHER}}/>{a.sourceName||a.sourceDomain||'未知媒体'} · <span data-sentiment={a.sentiment}>{sentiLabel[a.sentiment]}</span> · {a.reach==null?'—':compact.format(a.reach)}</div>
      </div>)}
      {!rows.length&&<div className="evidence-empty">当前筛选条件下没有匹配报道</div>}
    </div>
  </section>;
}
