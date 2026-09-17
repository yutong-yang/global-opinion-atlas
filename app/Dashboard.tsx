'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Article,Sentiment,Metric,Topic,applyFilters,aggregateCountries,riverSeries,hourlyCounts,bumpSeries,topCountriesBy,propagationRows,hourOfDay,fmt,compact,name,hourLabel,TOPIC_LABEL} from './lib/data';
import MapView from './components/MapView';
import ThemeRiver from './components/ThemeRiver';
import TimeBrush from './components/TimeBrush';
import BumpChart from './components/BumpChart';
import MediaSpread from './components/MediaSpread';
import SidePanels from './components/SidePanels';
import ArticleStrip from './components/ArticleStrip';
import ArticleDrawer from './components/ArticleDrawer';
import {withBasePath} from './lib/asset-path.mjs';
import InfoPopover from './components/InfoPopover';

type Metadata={articleCount:number;countryCount:number};
type Data={articles:Article[];metadata:Metadata};

export default function Dashboard(){
  const[data,setData]=useState<Data|null>(null);
  const[metric,setMetric]=useState<Metric>('mentions');
  const[country,setCountry]=useState<string|null>(null);
  const[topic,setTopic]=useState<Topic|null>(null);
  const[sentiment,setSentiment]=useState<Sentiment|null>(null);
  const[language,setLanguage]=useState<string|null>(null);
  const[source,setSource]=useState<string|null>(null);
  const[story,setStory]=useState<{key:string;title:string}|null>(null);
  const[query,setQuery]=useState('');
  const[hours,setHours]=useState<[number,number]>([0,23]);
  const[drawer,setDrawer]=useState<Article|null>(null);
  useEffect(()=>{Promise.all(['articles','metadata'].map(n=>fetch(withBasePath(`/data/${n}.json`,import.meta.env.BASE_URL)).then(r=>r.json() as Promise<unknown>))).then(([articles,metadata])=>setData({articles,metadata} as Data))},[]);

  const core=useMemo(()=>data?applyFilters(data.articles,{country,topic,sentiment,language,source,query,hours,story:story?.key??null},true):[],[data,country,topic,sentiment,language,source,query,story]);
  const filtered=useMemo(()=>core.filter(a=>{const h=hourOfDay(a);return h>=hours[0]&&h<=hours[1]}),[core,hours]);
  const riverBase=useMemo(()=>data?applyFilters(data.articles,{country,topic:null,sentiment,language,source,query,hours,story:story?.key??null},true):[],[data,country,sentiment,language,source,query,story]);
  const river=useMemo(()=>riverSeries(riverBase),[riverBase]);
  const brushCounts=useMemo(()=>hourlyCounts(core),[core]);
  const bumpBase=useMemo(()=>data?applyFilters(data.articles,{country:null,topic,sentiment,language,source,query,hours,story:story?.key??null},true):[],[data,topic,sentiment,language,source,query,story]);
  const propagationBase=useMemo(()=>data?applyFilters(data.articles,{country:null,topic,sentiment,language,source:null,query,hours,story:null},true):[],[data,topic,sentiment,language,query]);
  const spread=useMemo(()=>propagationRows(propagationBase,12,story?.key??null),[propagationBase,story]);
  const spreadBasis=useMemo(()=>{let m=1;for(const a of propagationBase){const r=a.reach||0;if(r>m)m=r}return m},[propagationBase]);
  const bump=useMemo(()=>{
    const top=topCountriesBy(bumpBase,8);
    const rows=country&&!top.includes(country)?[...top.slice(0,7),country]:top;
    return bumpSeries(bumpBase,rows,3);
  },[bumpBase,country]);
  const countries=useMemo(()=>aggregateCountries(filtered),[filtered]);
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
      const[a,b]=hoursRef.current;
      if(b-a===0){
        if(a>=23){setPlaying(false);setHours([0,23]);return}
        setHours([a+1,a+1]);
      }else{
        setHours([a,a]);
      }
    },700);
    return()=>clearInterval(id);
  },[playing]);

  if(!data)return <main className="loading"><h1>全球媒体舆情图谱</h1><p>正在准备全部 5,543 篇报道…</p></main>;
  const reset=()=>{setPlaying(false);setCountry(null);setTopic(null);setSentiment(null);setLanguage(null);setSource(null);setStory(null);setQuery('');setHours([0,23])};
  const selectStory=(key:string,title:string)=>setStory(cur=>cur&&cur.key===key?null:{key,title});
  const sentiLabel:Record<string,string>={positive:'正面',neutral:'中性',negative:'负面',unknown:'未知'};
  const chips:[string,()=>void][]=[
    ...(country?[[`${name(country)}`,()=>setCountry(null)] as [string,()=>void]]:[]),
    ...(topic?[[`话题·${TOPIC_LABEL[topic]}`,()=>setTopic(null)] as[string,()=>void]]:[]),
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
        <div className="segment" role="group" aria-label="地图指标">
          {(['mentions','reach','tone'] as Metric[]).map(m=><button key={m} aria-pressed={metric===m} onClick={()=>setMetric(m)}>{m==='mentions'?'报道量':m==='reach'?'触达量':'情感偏向'}</button>)}
        </div>
        <input aria-label="搜索全部文章" placeholder="搜索标题、命中句、关键词或媒体" value={query} onChange={e=>setQuery(e.target.value)}/>
        {!!chips.length&&<button className="reset" onClick={reset}>清除筛选</button>}
      </div>
      <div className="va-stats">
        <div><span>报道</span><strong>{fmt.format(filtered.length)}</strong></div>
        <div><span>潜在触达</span><strong>{compact.format(filtered.reduce((s,a)=>s+(a.reach||0),0))}</strong></div>
        <div><span>国家</span><strong>{new Set(filtered.map(a=>a.country)).size}</strong></div>
      </div>
    </header>
    {!!chips.length&&<div className="chips">{chips.map(([label,clear])=><span className="chip" key={label}>{label}<button onClick={clear} aria-label={`移除 ${label}`}>✕</button></span>)}</div>}
    <div className="va-grid">
      <div className="va-left">
        <section className="panel">
          <h3>报道热度排名演变 <small>Top 8 国家 · 按小时 · 3 小时滑动平均 · 点击曲线聚焦国家</small></h3>
          <BumpChart rows={bump} selected={country} onSelect={setCountry}/>
        </section>
        <section className="panel spread-panel">
          <h3>媒体传播 <small>同题转载的时间扩散 · 每行=一篇报道主题 · 点=转载媒体（面积∝触达） · 深描边=首发 · 点击行/点筛选</small></h3>
          <MediaSpread rows={spread} story={story?.key??null} source={source} hours={hours} basis={spreadBasis}
            onSelectStory={selectStory} onSelectSource={s=>setSource(source===s?null:s)}/>
        </section>
      </div>
      <section className="va-main">
        <div className="panel va-map">
          <MapView countries={countries} cumulative={cumulative} windowEnd={hours[1]} metric={metric} selected={country} onSelect={setCountry} domain={domain}/>
          <p className="map-legend">{metric==='tone'?'色阶：绿=偏正（＞+5）· 灰=中性 · 红=偏负（＜−5）':'色阶：'+(metric==='mentions'?'报道量':'触达量')+'（对数 · 全天固定基准）'} · 气泡面积 ∝ 累计触达（00:00 起累积） · 拖拽平移 · 滚轮缩放 · 双击复位</p>
        </div>
        <div className="panel va-brush">
          <button className="play-btn" data-on={playing} onClick={()=>setPlaying(p=>!p)} aria-label={playing?'暂停播放':'播放时间轴'}>{playing?'⏸ 暂停':'▶ 播放'}</button>
          <TimeBrush counts={brushCounts} range={hours} onChange={setHours} onInterrupt={()=>setPlaying(false)}/>
        </div>
        <div className="panel va-river"><ThemeRiver series={river} selected={topic} onSelect={setTopic} hours={hours}/></div>
      </section>
      <aside className="va-right">
        <SidePanels filtered={filtered} country={country} language={language} source={source} sentiment={sentiment}
          onSelectCountry={setCountry} onSelectLanguage={l=>setLanguage(language===l?null:l)} onSelectSource={s=>setSource(source===s?null:s)} onSelectSentiment={setSentiment}/>
      </aside>
    </div>
    <ArticleStrip articles={filtered} onOpen={setDrawer}/>
    <ArticleDrawer article={drawer} onClose={()=>setDrawer(null)}/>
    <InfoPopover/>
  </main>;
}
