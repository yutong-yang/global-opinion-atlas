'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {TOPICS,TOPIC_LABEL,TOPIC_COLOR,fmt,hourLabel,Topic} from '../lib/data';

type Tip={x:number;y:number;html:string};

const f1=(v:number)=>v.toFixed(1);
function curveCmds(pts:[number,number][]):string{
  let d='';
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
    const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6;
    const c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;
    d+=`C${f1(c1x)},${f1(c1y)} ${f1(c2x)},${f1(c2y)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d;
}
function bandPath(upper:[number,number][],lower:[number,number][]):string{
  const lo=[...lower].reverse();
  return`M${f1(upper[0][0])},${f1(upper[0][1])}${curveCmds(upper)}L${f1(lo[0][0])},${f1(lo[0][1])}${curveCmds(lo)}Z`;
}

export default function ThemeRiver({series,selected,onSelect,hours}:{series:number[][];selected:Topic|null;onSelect:(t:Topic|null)=>void;hours:[number,number]}){
  const ref=useRef<HTMLDivElement>(null);
  const[width,setWidth]=useState(860);
  const[tip,setTip]=useState<Tip|null>(null);
  const H=168,PAD=6;
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const o=new ResizeObserver(()=>setWidth(e.clientWidth||860));o.observe(e);
    return()=>o.disconnect();
  },[]);
  const{x,bots,tops,maxT}=useMemo(()=>{
    const totals=Array(24).fill(0) as number[];
    series.forEach((row,t)=>row.forEach((v,h)=>totals[h]+=v));
    const maxT=Math.max(...totals,1);
    const bots=series.map(()=>Array(24).fill(0) as number[]);
    const tops=series.map(()=>Array(24).fill(0) as number[]);
    for(let h=0;h<24;h++){
      let base=(maxT-totals[h])/2;
      series.forEach((row,t)=>{bots[t][h]=base;tops[t][h]=base+row[h];base=tops[t][h]});
    }
    const x=(h:number)=>PAD+(h/23)*(width-2*PAD);
    return{x,bots,tops,maxT};
  },[series,width]);
  const y=(v:number)=>H-PAD-(v/maxT)*(H-2*PAD);
  const totals=TOPICS.map((_,t)=>series[t].reduce((s,v)=>s+v,0));
  const layers=TOPICS.map((topic,t)=>{
    const upper: [number,number][]=[],lower:[number,number][]=[];
    for(let h=0;h<24;h++){upper.push([x(h),y(tops[t][h])]);lower.push([x(h),y(bots[t][h])])}
    return{topic,t,d:bandPath(upper,lower),total:totals[t]};
  });
  const onMove=(e:React.MouseEvent)=>{
    const r=ref.current!.getBoundingClientRect();
    const mx=e.clientX-r.left,my=e.clientY-r.top;
    const h=Math.round(((mx-PAD)/(width-2*PAD))*23);
    if(h<0||h>23||my<0||my>H){setTip(null);return}
    const v=(H-PAD-my)/(H-2*PAD)*maxT;
    const t=TOPICS.findIndex((_,ti)=>v>=bots[ti][h]&&v<=tops[ti][h]);
    if(t<0){setTip(null);return}
    setTip({x:mx+12,y:my+12,html:`<b>${TOPIC_LABEL[TOPICS[t]]}</b> · ${hourLabel(h)} 前后<br>${fmt.format(series[t][h])} 篇报道`});
  };
  const onClick=(e:React.MouseEvent)=>{
    const r=ref.current!.getBoundingClientRect();
    const mx=e.clientX-r.left,my=e.clientY-r.top;
    const h=Math.round(((mx-PAD)/(width-2*PAD))*23);
    if(h<0||h>23)return;
    const v=(H-PAD-my)/(H-2*PAD)*maxT;
    const t=TOPICS.findIndex((_,ti)=>v>=bots[ti][h]&&v<=tops[ti][h]);
    onSelect(t>=0&&selected!==TOPICS[t]?TOPICS[t]:null);
  };
  const brushX0=x(Math.max(0,hours[0]-.5)),brushX1=x(Math.min(23,hours[1]+.5));
  return <div ref={ref} className="river-wrap">
    <div className="river-legend">
      {TOPICS.map((t,i)=><button key={t} aria-pressed={selected===t} onClick={()=>onSelect(selected===t?null:t)}>
        <i style={{background:TOPIC_COLOR[t]}}/>{TOPIC_LABEL[t]}<em>{fmt.format(totals[i])}</em>
      </button>)}
    </div>
    <svg width={width} height={H+16} onMouseMove={onMove} onMouseLeave={()=>setTip(null)} onClick={onClick}>
      <rect x={brushX0} y={0} width={Math.max(0,brushX1-brushX0)} height={H} className="river-brush"/>
      {layers.map(l=><path key={l.topic} d={l.d}
        fill={TOPIC_COLOR[l.topic]} stroke="#fff" strokeWidth={.6}
        className={selected?(selected===l.topic?'river-layer':'river-layer dim'):'river-layer'}/>)}
      {[0,6,12,18,23].map(h=><g key={h}>
        <text x={x(h)} y={H+13} textAnchor="middle" className="axis-label">{String(h).padStart(2,'0')}</text>
      </g>)}
    </svg>
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
  </div>;
}
