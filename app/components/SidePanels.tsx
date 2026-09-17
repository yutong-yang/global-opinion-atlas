'use client';
import {useMemo} from 'react';
import {Article,Sentiment,CountryStat,name,fmt,compact,toneOf,fieldCounts,mediaByReach} from '../lib/data';

function Diverging({items,selected,onSelect}:{items:{c:CountryStat;neg:number;pos:number}[];selected:string|null;onSelect:(c:string)=>void}){
  return <div className="diverging">{items.map(({c,neg,pos})=><button key={c.country} className={selected===c.country?'div-row active':'div-row'} onClick={()=>onSelect(selected===c.country?'':c.country)}
    title={`${name(c.country)}：正面 ${c.positive} 篇（${(c.positive/c.mentions*100).toFixed(0)}%）· 负面 ${c.negative} 篇（${(c.negative/c.mentions*100).toFixed(0)}%）· 中性 ${c.neutral} 篇｜分歧指数 =（正面−负面）÷ ${c.mentions} ×100`}>
    <span className="div-name">{name(c.country)}</span>
    <span className="div-bar">
      <i className="neg" style={{width:`${neg/2}%`}}/>
      <i className="pos" style={{width:`${pos/2}%`}}/>
    </span>
    <b>{toneOf(c)>0?'+':''}{toneOf(c).toFixed(0)}</b>
  </button>)}</div>;
}

function Bars({title,items,format,selected,onSelect}:{title:string;items:[string,number][];format?:(n:number)=>string;selected?:string|null;onSelect?:(v:string)=>void}){
  const max=Math.max(...items.map(x=>x[1]),1);
  return <section className="panel side-panel">
    <h3>{title}</h3>
    <div className="bars">{items.map(([n,v])=><button key={n} className={onSelect&&selected===n?'bar active':'bar'} disabled={!onSelect} onClick={()=>onSelect?.(n)}>
      <span>{n}</span><i style={{width:`${v/max*100}%`}}/><b>{format?format(v):fmt.format(v)}</b>
    </button>)}</div>
  </section>;
}

export default function SidePanels({filtered,country,language,source,sentiment,onSelectCountry,onSelectLanguage,onSelectSource,onSelectSentiment}:{filtered:Article[];country:string|null;language:string|null;source:string|null;sentiment:Sentiment|null;onSelectCountry:(c:string)=>void;onSelectLanguage:(l:string)=>void;onSelectSource:(s:string)=>void;onSelectSentiment:(s:Sentiment|null)=>void}){
  const sentimentItems=useMemo(()=>{
    const m=new Map<string,CountryStat>();
    for(const a of filtered){
      let c=m.get(a.country);
      if(!c){c={country:a.country,iso3:a.iso3,mentions:0,reach:0,positive:0,neutral:0,negative:0,unknown:0};m.set(a.country,c)}
      c.mentions++;c.reach+=a.reach||0;
      c[a.sentiment==='positive'?'positive':a.sentiment==='neutral'?'neutral':a.sentiment==='negative'?'negative':'unknown']++;
    }
    return [...m.values()].filter(c=>c.mentions>=3&&(c.positive+c.negative)>0)
      .sort((a,b)=>Math.abs(toneOf(b))-Math.abs(toneOf(a))).slice(0,10)
      .map(c=>({c,neg:c.negative/c.mentions*100,pos:c.positive/c.mentions*100}));
  },[filtered]);
  const media=useMemo(()=>mediaByReach(filtered,10).map(m=>[m.domain,m.reach] as[string,number]),[filtered]);
  const langs=useMemo(()=>fieldCounts(filtered,'language').slice(0,8),[filtered]);
  const sentimentCount=(s:Sentiment)=>filtered.filter(a=>a.sentiment===s).length;
  const sentiLabel:Record<Sentiment,string>={positive:'正面',neutral:'中性',negative:'负面',unknown:'未知'};
  return <>
    <section className="panel side-panel">
      <h3>情感分歧 <small>指数 =（正面−负面）÷ 报道数 ×100 · 报道 ≥3 篇</small></h3>
      <div className="senti-legend">
        {(['positive','neutral','negative'] as Sentiment[]).map(s=><button key={s} data-sentiment={s} aria-pressed={sentiment===s} onClick={()=>onSelectSentiment(sentiment===s?null:s)}>
          {sentiLabel[s]} {fmt.format(sentimentCount(s))}</button>)}
      </div>
      <Diverging items={sentimentItems} selected={country} onSelect={onSelectCountry}/>
    </section>
    <Bars title="媒体触达榜 Top10" items={media} format={v=>compact.format(v)} onSelect={onSelectSource} selected={source}/>
    <Bars title="语言分布" items={langs} onSelect={onSelectLanguage} selected={language}/>
  </>;
}
