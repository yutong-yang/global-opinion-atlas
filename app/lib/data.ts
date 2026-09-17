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
export type Topic='TikTok'|'RedNote'|'Xiaohongshu'|'refugees';
export type Filters={
  country:string|null;topic:Topic|null;sentiment:Sentiment|null;language:string|null;
  source:string|null;query:string;hours:[number,number];story:string|null;
};

export const TOPICS:Topic[]=['TikTok','RedNote','Xiaohongshu','refugees'];
export const TOPIC_LABEL:Record<Topic,string>={TikTok:'TikTok',RedNote:'RedNote',Xiaohongshu:'小红书',refugees:'refugees'};
export const TOPIC_COLOR:Record<Topic,string>={TikTok:'#3765d5',RedNote:'#e8863a',Xiaohongshu:'#d34f7c',refugees:'#31a37e'};
const CANON:Record<string,Topic>={tiktok:'TikTok',rednote:'RedNote',xiaohongshu:'Xiaohongshu',refugee:'refugees',refugees:'refugees'};

export const BUMP_COLORS=['#3765d5','#d34f7c','#e8863a','#31a37e','#8b5cf6','#0ea5b7','#b08a00','#64748b'];

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

export function topicsOf(a:Article):Topic[]{
  const out=new Set<Topic>();
  for(const raw of String(a.queryKeywords||'').split(';')){
    const t=CANON[raw.trim().toLowerCase()];
    if(t)out.add(t);
  }
  return [...out];
}

export function toneOf(c:CountryStat):number{
  return c.mentions?(c.positive-c.negative)/c.mentions*100:0;
}

export function applyFilters(articles:Article[],f:Filters,ignoreHours=false):Article[]{
  const q=f.query.trim().toLowerCase();
  const[h0,h1]=f.hours;
  return articles.filter(a=>{
    if(!ignoreHours){const h=hourOfDay(a);if(h<h0||h>h1)return false}
    if(f.country&&a.country!==f.country)return false;
    if(f.topic&&!topicsOf(a).includes(f.topic))return false;
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

export function riverSeries(articles:Article[]):number[][]{
  const s=TOPICS.map(()=>Array(24).fill(0) as number[]);
  for(const a of articles)for(const t of topicsOf(a))s[TOPICS.indexOf(t)][hourOfDay(a)]++;
  return s;
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

export type SpreadDot={hour:number;domain:string;reach:number;language:string};
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
    const sorted=[...arts].sort((a,b)=>hourOfDay(a)-hourOfDay(b));
    const first=sorted[0];
    let reach=0;
    const dots:SpreadDot[]=[];
    for(const a of sorted){
      const r=a.reach||0;reach+=r;
      dots.push({hour:hourOfDay(a),domain:a.sourceDomain||'未知',reach:r,language:a.language});
    }
    all.push({key,title:first.title||'(无标题)',firstHour:hourOfDay(first),firstDomain:first.sourceDomain||'未知',firstTime:first.publishTime||'--:--',count:arts.length,domains:doms.size,reach,dots});
  }
  all.sort((a,b)=>b.domains-a.domains||b.count-a.count);
  const top=all.slice(0,Math.max(1,topN));
  if(pin&&!top.some(r=>r.key===pin)){const p=all.find(r=>r.key===pin);if(p)top.unshift(p)}
  return top;
}
