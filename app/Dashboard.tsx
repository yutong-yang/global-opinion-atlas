'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Article,Sentiment,applyFilters,aggregateCountries,hourlyCounts,bumpSeries,topCountriesBy,propagationRows,buildRepostNetwork,buildMediaOutlets,buildMediaRiver,buildPlatformColors,hotStories,topEntities,mediaInfluence,hourOfDay,fmt,compact,name,hourLabel} from './lib/data';
import MapView from './components/MapView';
import MediaRiver from './components/MediaRiver';
import TimeBrush from './components/TimeBrush';
import BumpChart from './components/BumpChart';
import MediaSpread from './components/MediaSpread';
import MediaNetwork from './components/MediaNetwork';
import MediaCircles from './components/MediaCircles';
import SidePanels from './components/SidePanels';
import EvidencePanel from './components/EvidencePanel';
import ArticleDrawer from './components/ArticleDrawer';
import {withBasePath} from './lib/asset-path.mjs';
import InfoPopover from './components/InfoPopover';
import AgentPanel from './components/AgentPanel';
import type {AgentAction,AgentEntity} from './lib/agentActions';

type Metadata={articleCount:number;countryCount:number};
type Data={articles:Article[];metadata:Metadata};

export default function Dashboard(){
  const[data,setData]=useState<Data|null>(null);
  const[country,setCountry]=useState<string|null>(null);
  const[sentiment,setSentiment]=useState<Sentiment|null>(null);
  const[language,setLanguage]=useState<string|null>(null);
  const[source,setSource]=useState<string|null>(null);
  const[story,setStory]=useState<{key:string;title:string}|null>(null);
  const[query,setQuery]=useState('');
  const[hours,setHours]=useState<[number,number]>([0,23]);
  const[drawer,setDrawer]=useState<Article|null>(null);
  const[canvas,setCanvas]=useState<'map'|'network'|'circles'>('map');
  useEffect(()=>{Promise.all(['articles','metadata'].map(n=>fetch(withBasePath(`/data/${n}.json`,import.meta.env.BASE_URL)).then(r=>r.json() as Promise<unknown>))).then(([articles,metadata])=>setData({articles,metadata} as Data))},[]);

  const core=useMemo(()=>data?applyFilters(data.articles,{country,sentiment,language,source,query,hours,story:story?.key??null},true):[],[data,country,sentiment,language,source,query,story]);
  const filtered=useMemo(()=>core.filter(a=>{const h=hourOfDay(a);return h>=hours[0]&&h<=hours[1]}),[core,hours]);
  const brushCounts=useMemo(()=>hourlyCounts(core),[core]);
  const bumpBase=useMemo(()=>data?applyFilters(data.articles,{country:null,sentiment,language,source,query,hours,story:story?.key??null},true):[],[data,sentiment,language,source,query,story]);
  const propagationBase=useMemo(()=>data?applyFilters(data.articles,{country:null,sentiment,language,source:null,query,hours,story:null},true):[],[data,sentiment,language,query]);
  const platforms=useMemo(()=>data?buildPlatformColors(data.articles):null,[data]);
  const spreadFiltered=useMemo(()=>{
    const winEnd=hours[1]*60+59;
    return propagationBase.filter(a=>{
      const h=hourOfDay(a);
      return h<=hours[1]&&(h<hours[1]||(a.publishTime&&parseInt(a.publishTime.split(':')[0])*60+parseInt(a.publishTime.split(':')[1])<=winEnd));
    });
  },[propagationBase,hours]);
  const spread=useMemo(()=>propagationRows(spreadFiltered,12,story?.key??null),[spreadFiltered,story]);
  const spreadBasis=useMemo(()=>{let m=1;for(const a of propagationBase){const r=a.reach||0;if(r>m)m=r}return m},[propagationBase]);
  const mediaRiver=useMemo(()=>buildMediaRiver(propagationBase,12),[propagationBase]);
  const repostNet=useMemo(()=>buildRepostNetwork(propagationBase),[propagationBase]);
  const mediaOutlets=useMemo(()=>buildMediaOutlets(propagationBase),[propagationBase]);
  const bump=useMemo(()=>{
    const top=topCountriesBy(bumpBase,8);
    const rows=country&&!top.includes(country)?[...top.slice(0,7),country]:top;
    return bumpSeries(bumpBase,rows,3);
  },[bumpBase,country]);
  const countries=useMemo(()=>aggregateCountries(filtered),[filtered]);
  const hot=useMemo(()=>hotStories(filtered,10),[filtered]);
  const agentDeep=useMemo(()=>({topEntities:topEntities(filtered,20),mediaInfluence:mediaInfluence(filtered,10)}),[filtered]);
  const agentOverview=useMemo(()=>{
    const topCountries=[...countries].sort((a,b)=>b.mentions-a.mentions).slice(0,10).map(c=>({country:name(c.country),mentions:c.mentions,reach:c.reach}));
    const topSources=buildMediaOutlets(filtered).outlets.slice(0,8).map(o=>({source:o.domain,mentions:o.articles}));
    const sentimentTotals={positive:0,neutral:0,negative:0,unknown:0};
    for(const c of countries){sentimentTotals.positive+=c.positive;sentimentTotals.neutral+=c.neutral;sentimentTotals.negative+=c.negative;sentimentTotals.unknown+=c.unknown}
    const perHour=hourlyCounts(filtered);
    let peak:{hour:number;count:number}|null=null;
    perHour.forEach((count,hour)=>{if(count>0&&(!peak||count>peak.count))peak={hour,count}});
    return {topCountries,topSources,sentimentTotals,peak};
  },[filtered,countries]);
  const agentEntities=useMemo<AgentEntity[]>(()=>{
    if(!data)return [];
    const top=[...aggregateCountries(data.articles)].sort((a,b)=>b.mentions-a.mentions).slice(0,10);
    const outlets=buildMediaOutlets(data.articles).outlets.slice(0,8);
    return [
      ...top.map(c=>({type:'country' as const,label:name(c.country),value:c.country})),
      ...outlets.flatMap(o=>o.name&&o.name!==o.domain
        ?[{type:'source' as const,label:o.domain,value:o.domain},{type:'source' as const,label:o.name,value:o.domain}]
        :[{type:'source' as const,label:o.domain,value:o.domain}]),
      {type:'sentiment' as const,label:'正面',value:'positive'},
      {type:'sentiment' as const,label:'中性',value:'neutral'},
      {type:'sentiment' as const,label:'负面',value:'negative'},
      {type:'sentiment' as const,label:'未知',value:'unknown'},
    ];
  },[data]);
  const cumulative=useMemo(()=>{const within=hours[1]>=23?core:core.filter(a=>hourOfDay(a)<=hours[1]);return aggregateCountries(within)},[core,hours]);
  const domain=useMemo(()=>{
    const agg=aggregateCountries(core);
    return{maxMentions:Math.max(...agg.map(d=>d.mentions),1),maxReach:Math.max(...agg.map(d=>d.reach),1)};
  },[core]);
  const[playing,setPlaying]=useState(false);
  const hoursRef=useRef(hours);useEffect(()=>{hoursRef.current=hours},[hours]);
  useEffect(()=>{
    if(!playing)return;
    const id=setInterval(()=>{
      const[,b]=hoursRef.current;
      if(b>=23){setPlaying(false);return}
      setHours([0,b+1]);
    },700);
    return()=>clearInterval(id);
  },[playing]);

  if(!data)return <main className="loading"><h1>全球媒体舆情图谱</h1><p>正在准备全部 5,543 篇报道…</p></main>;
  const reset=()=>{setPlaying(false);setCountry(null);setSentiment(null);setLanguage(null);setSource(null);setStory(null);setQuery('');setHours([0,23])};
  const selectStory=(key:string,title:string)=>setStory(cur=>cur&&cur.key===key?null:{key,title});
  const selectCountry=(c:string|null)=>{setCountry(c);if(c)setSource(null)};
  const selectSource=(s:string|null)=>{setSource(s);if(s)setCountry(null)};
  const applyAgentAction=(action:AgentAction)=>{
    switch(action.type){
      case'country':setCountry(String(action.value));break;
      case'source':setSource(String(action.value));break;
      case'hour':setHours([Number(action.value),Number(action.value)]);break;
      case'sentiment':setSentiment(action.value as Sentiment);break;
    }
  };
  const sentiLabel:Record<string,string>={positive:'正面',neutral:'中性',negative:'负面',unknown:'未知'};
  const chips:[string,()=>void][]=[
    ...(country?[[`${name(country)}`,()=>setCountry(null)] as [string,()=>void]]:[]),
    ...(sentiment?[[`情感·${sentiLabel[sentiment]}`,()=>setSentiment(null)] as[string,()=>void]]:[]),
    ...(language?[[`语言·${language}`,()=>setLanguage(null)] as[string,()=>void]]:[]),
    ...(source?[[`媒体·${source}`,()=>setSource(null)] as[string,()=>void]]:[]),
    ...(story?[[`通稿·${story.title.length>18?story.title.slice(0,18)+'…':story.title}`,()=>setStory(null)] as[string,()=>void]]:[]),
    ...(query?[[`搜索·"${query}"`,()=>setQuery('')] as[string,()=>void]]:[]),
    ...(hours[0]>0||hours[1]<23?[[`时间·${hourLabel(hours[0])}–${hourLabel(hours[1]).replace(':00',':59')}`,()=>setHours([0,23])] as[string,()=>void]]:[]),
  ];
  return <main className="va">
    <header className="va-header">
      <div className="va-title">
        <p className="eyebrow">GLOBAL MEDIA OPINION ATLAS</p>
        <h1>全球媒体舆情图谱</h1>
        <p className="subtitle">TikTok 用户迁入小红书 · 2025-01-15 全天 · 媒体报道，不代表全球公众意见</p>
      </div>
      <div className="va-controls">
        <input aria-label="搜索全部文章" placeholder="搜索标题、命中句、关键词或媒体" value={query} onChange={e=>setQuery(e.target.value)}/>
        {!!chips.length&&<button className="reset" onClick={reset}>清除筛选</button>}
      </div>
      <div className="va-stats">
        <div><span>报道</span><strong>{fmt.format(filtered.length)}</strong></div>
        <div><span>潜在触达</span><strong>{compact.format(filtered.reduce((s,a)=>s+(a.reach||0),0))}</strong></div>
        <div><span>国家</span><strong>{new Set(filtered.map(a=>a.country)).size}</strong></div>
      </div>
    </header>
    <div className="chips">{chips.map(([label,clear])=><span className="chip" key={label}>{label}<button onClick={clear} aria-label={`移除 ${label}`}>✕</button></span>)}{!filtered.length&&<span className="chips-empty">当前筛选组合无命中报道，可移除部分筛选或点击「清除筛选」</span>}</div>
    <div className="va-grid">
      <div className="va-left">
        <SidePanels filtered={filtered} platforms={platforms} country={country} language={language} source={source} sentiment={sentiment}
          onSelectCountry={selectCountry} onSelectLanguage={l=>setLanguage(language===l?null:l)} onSelectSource={s=>selectSource(source===s?null:s)} onSelectSentiment={setSentiment}/>
      </div>
      <section className={canvas==='map'?'va-main':'va-main net'}>
        <div className="panel va-map">
          <div className="canvas-tabs">
            <div className="segment" role="group" aria-label="主视图切换">
              <button aria-pressed={canvas==='map'} onClick={()=>setCanvas('map')}>世界地图</button>
              <button aria-pressed={canvas==='network'} onClick={()=>setCanvas('network')}>媒体转载网络</button>
              <button aria-pressed={canvas==='circles'} onClick={()=>setCanvas('circles')}>媒体构成圈</button>
            </div>
          </div>
          {canvas==='map'
            ?<MapView countries={countries} cumulative={cumulative} windowEnd={hours[1]} selected={country} onSelect={selectCountry} domain={domain}/>
            : canvas==='network'
              ?<MediaNetwork network={repostNet} platforms={platforms} story={story?.key??null} source={source} hours={hours}
                onSelectSource={s=>selectSource(source===s?null:s)} onSelectStory={selectStory}/>
              :<MediaCircles data={mediaOutlets} repost={repostNet} platforms={platforms} source={source} hours={hours}
                onSelectSource={s=>selectSource(source===s?null:s)}/>}
        </div>
        <div className="panel va-brush">
          <button className="play-btn" data-on={playing} onClick={()=>{if(!playing)setHours([0,hours[1]>=23?0:hours[1]]);setPlaying(p=>!p)}} aria-label={playing?'暂停播放':'播放时间轴'}>{playing?'⏸ 暂停':'▶ 播放'}</button>
          <TimeBrush counts={brushCounts} range={hours} onChange={setHours} onInterrupt={()=>setPlaying(false)} playing={playing}/>
        </div>
        <div className="panel va-river">
          <h3>媒体发文河流 <small>带=媒体（全天发文量 Top 12 · 厚度∝全天逐时发文 · 色同平台色） · 点=同题转载簇报道（色=话题 · 面积∝触达） · 线=跨媒体转播路径 · 点/线选通稿 · 带筛选媒体</small></h3>
          <MediaRiver bands={mediaRiver.bands} dots={mediaRiver.dots} platforms={platforms} story={story?.key??null} source={source} country={country}
            hours={hours} basis={spreadBasis} onSelectStory={selectStory} onSelectSource={s=>selectSource(source===s?null:s)}/>
        </div>
        <div className="panel va-bump">
          <h3>报道热度排名演变 <small>Top 8 国家 · 按小时 · 3 小时滑动平均 · 点击曲线聚焦国家</small></h3>
          <BumpChart rows={bump} selected={country} onSelect={selectCountry}/>
        </div>
      </section>
      <aside className="va-right">
        <section className="panel spread-panel">
          <h3>热榜 <small>同题转载的时间扩散 · 每行=一篇报道主题 · 点=转载媒体（面积∝触达 · 色=平台） · 深描边=首发 · 点击行/点筛选</small></h3>
          <MediaSpread rows={spread} platforms={platforms} story={story?.key??null} source={source} hours={hours} basis={spreadBasis}
            onSelectStory={selectStory} onSelectSource={s=>selectSource(source===s?null:s)}/>
        </section>
        <EvidencePanel articles={filtered} platforms={platforms} onOpen={setDrawer}/>
      </aside>
    </div>
    <ArticleDrawer article={drawer} platforms={platforms} onClose={()=>setDrawer(null)}/>
    <AgentPanel context={{country,sentiment,language,source,story:story?.title??null,query,hours,articleCount:filtered.length,reach:filtered.reduce((s,a)=>s+(a.reach||0),0),countryCount:new Set(filtered.map(a=>a.country)).size,totalCount:data.metadata.articleCount,...agentOverview,hotStories:hot.map(h=>({key:h.key,title:h.title,outlets:h.outlets,articles:h.articles,peakHour:h.peakHour})),...agentDeep}} entities={agentEntities} onAction={applyAgentAction}/>
    <InfoPopover/>
  </main>;
}
