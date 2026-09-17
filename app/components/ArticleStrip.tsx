'use client';
import {useEffect,useState} from 'react';
import {Article,name,compact,hourLabel,hourOfDay} from '../lib/data';

const PAGE=9;
const sentiClass:Record<string,string>={positive:'pos',neutral:'neu',negative:'neg',unknown:'unk'};
const sentiLabel:Record<string,string>={positive:'正面',neutral:'中性',negative:'负面',unknown:'未知'};

export default function ArticleStrip({articles,onOpen}:{articles:Article[];onOpen:(a:Article)=>void}){
  const[page,setPage]=useState(0);
  const pages=Math.max(1,Math.ceil(articles.length/PAGE));
  useEffect(()=>setPage(0),[articles]);
  const rows=[...articles].sort((a,b)=>hourOfDay(a)-hourOfDay(b)||(a.publishTime||'').localeCompare(b.publishTime||'')).slice(page*PAGE,page*PAGE+PAGE);
  return <section className="panel strip">
    <div className="strip-head">
      <h3>文章证据 <em>{articles.length} 条</em></h3>
      <div className="strip-pager">
        <button disabled={page===0} onClick={()=>setPage(p=>p-1)}>‹</button>
        <span>{page+1} / {pages}</span>
        <button disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>›</button>
      </div>
    </div>
    <div className="strip-body">
      <table>
        <thead><tr><th>时间</th><th>国家</th><th>标题 / 命中句</th><th>媒体</th><th>语言</th><th>情感</th><th>触达</th></tr></thead>
        <tbody>
          {rows.map(a=><tr key={`${a.articleId}-${a.rowNumber}`} onClick={()=>onOpen(a)}>
            <td className="t">{a.publishTime||'--'}</td>
            <td className="c">{name(a.country)}</td>
            <td className="ttl">
              {a.url?<a href={a.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{a.title||'无标题'}</a>:a.title||'无标题'}
              <small>{a.matchedSentence||a.keywordSentence||''}</small>
            </td>
            <td className="s">{a.sourceName||a.sourceDomain||'未知'}</td>
            <td className="l">{a.language}</td>
            <td className="e"><span data-sentiment={a.sentiment}>{sentiLabel[a.sentiment]}</span></td>
            <td className="r">{a.reach==null?'—':compact.format(a.reach)}</td>
          </tr>)}
          {!rows.length&&<tr><td colSpan={7} className="empty">当前筛选条件下没有文章</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
