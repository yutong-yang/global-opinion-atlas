export type Sentiment='positive'|'neutral'|'negative'|'unknown';
export type Article={
  rowNumber:number;articleId:string;url:string|null;title:string|null;lead:string|null;
  matchedSentence:string|null;keywordSentence:string|null;country:string;iso3:string|null;
  region:string|null;state:string|null;city:string|null;language:string;sentiment:Sentiment;
  sourceName:string|null;sourceDomain:string|null;reach:number|null;engagement:number|null;
  publishTime:string|null;queryKeywords:string|null;
};
export type CountryStat={country:string;iso3:string|null;mentions:number;reach:number;positive:number;neutral:number;negative:number;unknown:number};
export type Metric='mentions'|'reach'|'tone';
export type Filters={
  country:string|null;state:string|null;sentiment:Sentiment|null;language:string|null;
  source:string|null;query:string;hours:[number,number];story:string|null;
};

export const BUMP_COLORS=['#3765d5','#d34f7c','#e8863a','#31a37e','#8b5cf6','#0ea5b7','#b08a00','#64748b'];

export const PLATFORM_PALETTE=['#c33c54','#0f6e8c','#6d5aa5','#5a7d2a','#a8662e','#27548c','#b04a8f','#77683d','#2e8c6a','#476b7e','#c47a2c','#3d7ea1','#8b5e3c','#6a8e4e','#9c4e7c'];
export const PLATFORM_OTHER='#94a3b8';

export type PlatformColors={
  top:string[];
  colorOf:(domain:string)=>string;
  participation:Map<string,number>;
};

// 平台集合与颜色只由全量语料决定，不随筛选重算（固定基准原则）
export function buildPlatformColors(articles:Article[],filteredArticles?:Article[]):PlatformColors{
  const groups=new Map<string,Set<string>>();
  for(const a of articles){
    const d=(a.sourceDomain||'').trim();
    const k=normalizeTitle(a.title);
    if(!d||!k)continue;
    let s=groups.get(k);
    if(!s){s=new Set();groups.set(k,s)}
    s.add(d);
  }
  const participation=new Map<string,number>();
  for(const s of groups.values()){
    if(s.size<2)continue;
    for(const d of s)participation.set(d,(participation.get(d)||0)+1);
  }
  const top=[...participation.entries()]
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,PLATFORM_PALETTE.length)
    .map(e=>e[0]);
  const colorOf=(d:string)=>{const i=top.indexOf(d);return i<0?PLATFORM_OTHER:PLATFORM_PALETTE[i]};
  if(filteredArticles!==undefined){
    participation.clear();
    const fg=new Map<string,Set<string>>();
    for(const a of filteredArticles){
      const d=(a.sourceDomain||'').trim();
      const k=normalizeTitle(a.title);
      if(!d||!k)continue;
      let s=fg.get(k);
      if(!s){s=new Set();fg.set(k,s)}
      s.add(d);
    }
    for(const s of fg.values()){
      if(s.size<2)continue;
      for(const d of s)participation.set(d,(participation.get(d)||0)+1);
    }
  }
  return {top,colorOf,participation};
}

const names:Record<string,string>={'United States':'美国','China':'中国','Germany':'德国','United Kingdom':'英国','Canada':'加拿大','Turkey':'土耳其','Indonesia':'印度尼西亚','India':'印度','France':'法国','Spain':'西班牙','Hong Kong':'中国香港','Mexico':'墨西哥','Malaysia':'马来西亚','Greece':'希腊','Romania':'罗马尼亚','Italy':'意大利','Brazil':'巴西','Taiwan':'中国台湾','Vietnam':'越南','Australia':'澳大利亚','Russia':'俄罗斯','Japan':'日本','Singapore':'新加坡'};
export const name=(s:string)=>names[s]||s;
export const fmt=new Intl.NumberFormat('zh-CN');
export const compact=new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1});
export const hourLabel=(h:number)=>`${String(h).padStart(2,'0')}:00`;

export function hourOfDay(a:Article):number{
  const m=/^(\d{1,2}):/.exec(a.publishTime||'');
  const h=m?parseInt(m[1],10):12;
  return Number.isFinite(h)?Math.min(23,Math.max(0,h)):12;
}

export function minuteOfDay(a:Article):number{
  const m=/^(\d{1,2}):(\d{2})/.exec(a.publishTime||'');
  if(!m)return 12*60;
  const h=Math.min(23,Math.max(0,parseInt(m[1],10)));
  const mi=Math.min(59,Math.max(0,parseInt(m[2],10)));
  return h*60+mi;
}

export const minuteLabel=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

export function toneOf(c:CountryStat):number{
  return c.mentions?(c.positive-c.negative)/c.mentions*100:0;
}

export function applyFilters(articles:Article[],f:Filters,ignoreHours=false):Article[]{
  const q=f.query.trim().toLowerCase();
  const[h0,h1]=f.hours;
  return articles.filter(a=>{
    if(!ignoreHours){const h=hourOfDay(a);if(h<h0||h>h1)return false}
    if(f.country&&a.country!==f.country)return false;
    if(f.state&&((a.state||'').trim())!==f.state)return false;
    if(f.sentiment&&a.sentiment!==f.sentiment)return false;
    if(f.language&&a.language!==f.language)return false;
    if(f.source&&a.sourceDomain!==f.source)return false;
    if(f.story&&normalizeTitle(a.title)!==f.story)return false;
    if(q&&![a.title,a.matchedSentence,a.keywordSentence,a.sourceName,a.sourceDomain].some(v=>v&&v.toLowerCase().includes(q)))return false;
    return true;
  });
}

export function aggregateCountries(articles:Article[]):CountryStat[]{
  const m=new Map<string,CountryStat>();
  for(const a of articles){
    let c=m.get(a.country);
    if(!c){c={country:a.country,iso3:a.iso3,mentions:0,reach:0,positive:0,neutral:0,negative:0,unknown:0};m.set(a.country,c)}
    c.mentions++;
    c.reach+=a.reach||0;
    c[a.sentiment==='positive'?'positive':a.sentiment==='neutral'?'neutral':a.sentiment==='negative'?'negative':'unknown']++;
  }
  return [...m.values()];
}

export function hourlyCounts(articles:Article[]):number[]{
  const c=Array(24).fill(0) as number[];
  for(const a of articles)c[hourOfDay(a)]++;
  return c;
}

export type BumpRow={country:string;color:string;ranks:(number|null)[];counts:number[]};

export function bumpSeries(articles:Article[],topCountries:string[],smooth=1):BumpRow[]{
  const counts=new Map<string,number[]>();
  const win=Math.max(1,Math.round(smooth));
  const r=Math.floor(win/2);
  for(const c of topCountries)counts.set(c,Array(24).fill(0) as number[]);
  for(const a of articles){
    const arr=counts.get(a.country);
    if(arr)arr[hourOfDay(a)]++;
  }
  const smoothOf=(arr:number[])=>arr.map((_,h)=>{
    let s=0,n=0;
    for(let i=h-r;i<=h+r;i++){if(i>=0&&i<24){s+=arr[i];n++}}
    return s/n;
  });
  const sm=new Map<string,number[]>();
  for(const c of topCountries)sm.set(c,smoothOf(counts.get(c)!));
  const ranks=new Map<string,(number|null)[]>();
  for(const c of topCountries)ranks.set(c,Array(24).fill(null) as (number|null)[]);
  for(let h=0;h<24;h++){
    const present=topCountries.filter(c=>(sm.get(c)![h])>0).sort((a,b)=>(sm.get(b)![h])-(sm.get(a)![h]));
    present.forEach((c,i)=>ranks.get(c)![h]=i+1);
  }
  return topCountries.map((c,i)=>({country:c,color:BUMP_COLORS[i%BUMP_COLORS.length],ranks:ranks.get(c)!,counts:counts.get(c)!}));
}

export function fieldCounts(articles:Article[],field:'language'|'sourceDomain'):[string,number][]{
  const m=new Map<string,number>();
  for(const a of articles){const k=a[field]||'未知';m.set(k,(m.get(k)||0)+1)}
  return [...m.entries()].sort((a,b)=>b[1]-a[1]);
}

export function topCountriesBy(articles:Article[],n:number):string[]{
  const m=new Map<string,number>();
  for(const a of articles)m.set(a.country,(m.get(a.country)||0)+1);
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(e=>e[0]);
}

export function mediaByReach(articles:Article[],n:number):{domain:string;name:string;reach:number;count:number}[]{
  const m=new Map<string,{name:string;reach:number;count:number}>();
  for(const a of articles){
    const k=a.sourceDomain||'未知';
    const e=m.get(k)||{name:a.sourceName||k,reach:0,count:0};
    e.reach+=a.reach||0;e.count++;m.set(k,e);
  }
  return [...m.entries()].map(([domain,v])=>({domain,...v})).sort((a,b)=>b.reach-a.reach).slice(0,n);
}

export type SpreadDot={hour:number;minute:number;domain:string;reach:number;language:string};
export type SpreadRow={key:string;title:string;firstHour:number;firstDomain:string;firstTime:string;count:number;domains:number;reach:number;dots:SpreadDot[]};

export function normalizeTitle(t:string|null|undefined):string{
  return String(t||'').toLowerCase().replace(/[\u201c\u201d\u2018\u2019\u00ab\u00bb\u2039\u203a\u300c\u300d\u300e\u300f\u300a\u300b\u3008\u3009"']/g,'').replace(/\s+/g,' ').trim();
}

export function propagationRows(articles:Article[],topN:number,pin:string|null=null):SpreadRow[]{
  const groups=new Map<string,Article[]>();
  for(const a of articles){
    const k=normalizeTitle(a.title);
    if(!k)continue;
    const arr=groups.get(k);
    if(arr)arr.push(a);else groups.set(k,[a]);
  }
  const all:SpreadRow[]=[];
  for(const [key,arts] of groups){
    const doms=new Set<string>();
    for(const a of arts)doms.add(a.sourceDomain||'未知');
    if(doms.size<2)continue;
    const sorted=[...arts].sort((a,b)=>minuteOfDay(a)-minuteOfDay(b));
    const first=sorted[0];
    let reach=0;
    const dots:SpreadDot[]=[];
    for(const a of sorted){
      const r=a.reach||0;reach+=r;
      dots.push({hour:hourOfDay(a),minute:minuteOfDay(a),domain:a.sourceDomain||'未知',reach:r,language:a.language});
    }
    all.push({key,title:first.title||'(无标题)',firstHour:hourOfDay(first),firstDomain:first.sourceDomain||'未知',firstTime:first.publishTime||'--:--',count:arts.length,domains:doms.size,reach,dots});
  }
  all.sort((a,b)=>b.domains-a.domains||b.count-a.count);
  const top=all.slice(0,Math.max(1,topN));
  if(pin&&!top.some(r=>r.key===pin)){const p=all.find(r=>r.key===pin);if(p)top.unshift(p)}
  return top;
}

export type RiverBand={domain:string;name:string;articles:number;reach:number;hours:number[]};
export type RiverDot={key:string;title:string;domain:string;minute:number;hour:number;reach:number;country:string};

export function buildMediaRiver(articles:Article[],topN:number):{bands:RiverBand[];dots:RiverDot[]}{
  const om=new Map<string,RiverBand>();
  for(const a of articles){
    const d=(a.sourceDomain||'').trim();
    if(!d)continue;
    let o=om.get(d);
    if(!o){o={domain:d,name:a.sourceName||d,articles:0,reach:0,hours:Array(24).fill(0) as number[]};om.set(d,o)}
    else if(a.sourceName&&(!o.name||o.name===o.domain))o.name=a.sourceName;
    o.articles++;o.reach+=a.reach||0;o.hours[hourOfDay(a)]++;
  }
  const bands=[...om.values()].sort((a,b)=>b.articles-a.articles||a.domain.localeCompare(b.domain)).slice(0,Math.max(0,topN));
  const inBand=new Set(bands.map(b=>b.domain));
  const groups=new Map<string,Article[]>();
  for(const a of articles){
    const k=normalizeTitle(a.title);
    if(!k)continue;
    const arr=groups.get(k);
    if(arr)arr.push(a);else groups.set(k,[a]);
  }
  const dots:RiverDot[]=[];
  for(const [key,arts] of groups){
    const doms=new Set<string>();
    for(const a of arts)doms.add((a.sourceDomain||'').trim());
    if(doms.size<2)continue;
    const sorted=[...arts].sort((a,b)=>minuteOfDay(a)-minuteOfDay(b));
    const title=sorted[0].title||'(无标题)';
    for(const a of sorted){
      const d=(a.sourceDomain||'').trim();
      if(!inBand.has(d))continue;
      dots.push({key,title,domain:d,minute:minuteOfDay(a),hour:hourOfDay(a),reach:a.reach||0,country:a.country||''});
    }
  }
  return{bands,dots};
}

export type RepostOutlet={domain:string;name:string;articles:number;reach:number;firsts:number;out:number;incoming:number;lang:string;hours:number[]};
export type RepostEdge={source:string;target:string;count:number;hours:number[];firstMinute:number};
export type RepostStory={key:string;title:string;members:string[];count:number;firstDomain:string;firstHour:number;hours:number[]};
export type RepostNetwork={outlets:RepostOutlet[];edges:RepostEdge[];stories:RepostStory[]};

export const LANG_COLORS:Record<string,string>={English:'#3765d5','Chinese (simpl.)':'#d34f7c','Chinese (trad.)':'#7c3aed',Spanish:'#e8863a',German:'#31a37e',French:'#0ea5b7',Indonesian:'#b08a00',Turkish:'#c2410c'};
export const LANG_OTHER='#94a3b8';
export const langColor=(l:string)=>LANG_COLORS[l]||LANG_OTHER;

export function buildRepostNetwork(articles:Article[]):RepostNetwork{
  const groups=new Map<string,Article[]>();
  for(const a of articles){
    const d=(a.sourceDomain||'').trim();
    if(!d)continue;
    const k=normalizeTitle(a.title);
    if(!k)continue;
    const arr=groups.get(k);
    if(arr)arr.push(a);else groups.set(k,[a]);
  }
  type Acc=RepostOutlet&{langCount:Map<string,number>};
  const om=new Map<string,Acc>();
  const em=new Map<string,RepostEdge>();
  const stories:RepostStory[]=[];
  const outletOf=(d:string,nm:string|null):Acc=>{
    let o=om.get(d);
    if(!o){o={domain:d,name:nm||d,articles:0,reach:0,firsts:0,out:0,incoming:0,lang:'',hours:Array(24).fill(0) as number[],langCount:new Map()};om.set(d,o)}
    else if(!o.name&&nm)o.name=nm;
    return o;
  };
  for(const [key,arts] of groups){
    const sorted=[...arts].sort((a,b)=>minuteOfDay(a)-minuteOfDay(b));
    const chain:Article[]=[];
    for(const a of sorted){
      const d=a.sourceDomain!.trim();
      if(chain.length&&chain[chain.length-1].sourceDomain!.trim()===d)continue;
      chain.push(a);
    }
    const members:string[]=[];
    const seen=new Set<string>();
    for(const a of chain){const d=a.sourceDomain!.trim();if(!seen.has(d)){seen.add(d);members.push(d)}}
    if(members.length<2)continue;
    const hours=Array(24).fill(0) as number[];
    for(const a of chain){
      const d=a.sourceDomain!.trim();
      const h=hourOfDay(a);
      hours[h]++;
      const o=outletOf(d,a.sourceName);
      o.articles++;o.reach+=a.reach||0;o.hours[h]++;
      o.langCount.set(a.language,(o.langCount.get(a.language)||0)+1);
    }
    const first=chain[0];
    outletOf(first.sourceDomain!.trim(),first.sourceName).firsts++;
    for(let i=1;i<chain.length;i++){
      const s=chain[i-1].sourceDomain!.trim(),t=chain[i].sourceDomain!.trim();
      const m=minuteOfDay(chain[i]);
      const ek=s+'\u0000'+t;
      let e=em.get(ek);
      if(!e){e={source:s,target:t,count:0,hours:Array(24).fill(0) as number[],firstMinute:m};em.set(ek,e)}
      else if(m<e.firstMinute)e.firstMinute=m;
      e.count++;e.hours[hourOfDay(chain[i])]++;
      om.get(s)!.out++;om.get(t)!.incoming++;
    }
    stories.push({key,title:first.title||'(无标题)',members,count:chain.length,firstDomain:first.sourceDomain!.trim(),firstHour:hourOfDay(first),hours});
  }
  const outlets:RepostOutlet[]=[];
  for(const o of om.values()){
    let lang='';let best=-1;
    for(const [l,c] of o.langCount)if(c>best){best=c;lang=l}
    const{langCount,...rest}=o;
    outlets.push({...rest,lang});
  }
  outlets.sort((a,b)=>b.articles-a.articles||a.domain.localeCompare(b.domain));
  stories.sort((a,b)=>b.members.length-a.members.length||b.count-a.count);
  return {outlets,edges:[...em.values()],stories};
}

export type MediaOutlet={domain:string;name:string;articles:number;reach:number;hours:number[]};
export type MediaOutlets={outlets:MediaOutlet[];total:number;totalReach:number;domainCount:number};

export const LANG_SHORT:Record<string,string>={English:'英语','Chinese (simpl.)':'中文·简','Chinese (trad.)':'中文·繁',Spanish:'西班牙语',German:'德语',French:'法语',Indonesian:'印尼语',Turkish:'土耳其语','Modern Greek (1453-)':'希腊语',Romanian:'罗马尼亚语'};
export const langShort=(l:string)=>LANG_SHORT[l]||l;

export function buildMediaOutlets(articles:Article[]):MediaOutlets{
  const om=new Map<string,MediaOutlet>();
  for(const a of articles){
    const d=(a.sourceDomain||'').trim();
    if(!d)continue;
    let o=om.get(d);
    if(!o){o={domain:d,name:a.sourceName||d,articles:0,reach:0,hours:Array(24).fill(0) as number[]};om.set(d,o)}
    else if(a.sourceName&&(!o.name||o.name===o.domain))o.name=a.sourceName;
    o.articles++;o.reach+=a.reach||0;o.hours[hourOfDay(a)]++;
  }
  const outlets=[...om.values()].sort((a,b)=>b.articles-a.articles||a.domain.localeCompare(b.domain));
  let total=0,totalReach=0;
  for(const o of outlets){total+=o.articles;totalReach+=o.reach}
  return {outlets,total,totalReach,domainCount:om.size};
}

export type HotStory={
  key:string;title:string;articles:number;outlets:number;countries:number;
  positive:number;neutral:number;negative:number;unknown:number;
  engagement:number;peakHour:number;
};

export function hotStories(articles:Article[],n:number):HotStory[]{
  const groups=new Map<string,Article[]>();
  for(const a of articles){
    const k=normalizeTitle(a.title);
    if(!k)continue;
    const arr=groups.get(k);
    if(arr)arr.push(a);else groups.set(k,[a]);
  }
  const all:HotStory[]=[];
  for(const [key,arts] of groups){
    const doms=new Set<string>(),countries=new Set<string>();
    const hours=Array(24).fill(0) as number[];
    let positive=0,neutral=0,negative=0,unknown=0,engagement=0;
    for(const a of arts){
      doms.add(a.sourceDomain||'未知');
      countries.add(a.country);
      hours[hourOfDay(a)]++;
      engagement+=a.engagement||0;
      if(a.sentiment==='positive')positive++;
      else if(a.sentiment==='negative')negative++;
      else if(a.sentiment==='neutral')neutral++;
      else unknown++;
    }
    let peakHour=0,peak=0;
    hours.forEach((c,h)=>{if(c>peak){peak=c;peakHour=h}});
    all.push({key,title:arts[0].title||'(无标题)',articles:arts.length,outlets:doms.size,countries:countries.size,positive,neutral,negative,unknown,engagement,peakHour});
  }
  all.sort((a,b)=>b.outlets-a.outlets||b.articles-a.articles||a.key.localeCompare(b.key));
  return all.slice(0,Math.max(1,n));
}

export type EntityStat={entity:string;articles:number};

export function topEntities(articles:Article[],n:number):EntityStat[]{
  const m=new Map<string,number>();
  for(const a of articles){
    const seen=new Set<string>();
    for(const raw of String(a.keywordSentence||'').split(';')){
      const e=raw.trim().replace(/\s+/g,' ').toLowerCase();
      if(!e||seen.has(e))continue;
      seen.add(e);
      m.set(e,(m.get(e)||0)+1);
    }
  }
  return [...m.entries()]
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,Math.max(1,n))
    .map(([entity,c])=>({entity,articles:c}));
}

export type MediaInfluence={domain:string;name:string;reach:number;articles:number;countries:number};

export function mediaInfluence(articles:Article[],n:number):MediaInfluence[]{
  const m=new Map<string,{domain:string;name:string;reach:number;articles:number;countries:Set<string>}>();
  for(const a of articles){
    const d=(a.sourceDomain||'').trim();
    if(!d)continue;
    let e=m.get(d);
    if(!e){e={domain:d,name:a.sourceName||d,reach:0,articles:0,countries:new Set()};m.set(d,e)}
    else if(a.sourceName&&(!e.name||e.name===e.domain))e.name=a.sourceName;
    e.articles++;
    e.countries.add(a.country);
    e.reach=Math.max(e.reach,a.reach||0);
  }
  return [...m.entries()]
    .map(([domain,e])=>({domain,name:e.name,reach:e.reach,articles:e.articles,countries:e.countries.size}))
    .sort((a,b)=>b.reach-a.reach||a.domain.localeCompare(b.domain))
    .slice(0,Math.max(1,n));
}

export type RegionStat={name:string;articles:number;reach:number;cities:Map<string,number>};

export function regionBreakdown(articles:Article[]):{states:RegionStat[];totalWithState:number;totalWithCity:number}{
  const sm=new Map<string,RegionStat>();
  let totalWithState=0,totalWithCity=0;
  for(const a of articles){
    const s=(a.state||'').trim();
    if(s){
      totalWithState++;
      let e=sm.get(s);
      if(!e){e={name:s,articles:0,reach:0,cities:new Map()};sm.set(s,e)}
      e.articles++;
      e.reach+=a.reach||0;
      const c=(a.city||'').trim();
      if(c){
        totalWithCity++;
        e.cities.set(c,(e.cities.get(c)||0)+1);
      }
    }
  }
  const states=[...sm.values()].sort((a,b)=>b.articles-a.articles);
  return{states,totalWithState,totalWithCity};
}
