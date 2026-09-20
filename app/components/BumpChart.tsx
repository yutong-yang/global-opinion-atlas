'use client';
import {useEffect,useRef,useState} from 'react';
import type {MouseEvent as ReactMouseEvent} from 'react';
import {BumpRow,fmt,hourLabel,name} from '../lib/data';

type Tip={x:number;y:number;row:BumpRow;hour:number};

function smoothLine(pts:[number,number][]):string{
  if(pts.length<2)return'';
  if(pts.length<3)return`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}`;
  let d=`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
    const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6;
    const c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;
    d+=`C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function lastHour(ranks:(number|null)[]):number{
  for(let hour=ranks.length-1;hour>=0;hour--)if(ranks[hour]!=null)return hour;
  return-1;
}

function rankChanges(ranks:(number|null)[]):number[]{
  const hours:number[]=[];
  for(let hour=0;hour<ranks.length;hour++){
    if(ranks[hour]!=null&&(hour===0||ranks[hour-1]==null||ranks[hour-1]!==ranks[hour]))hours.push(hour);
  }
  return hours;
}

export default function BumpChart({rows,selected,onSelect}:{rows:BumpRow[];selected:string|null;onSelect:(country:string)=>void}){
  const ref=useRef<HTMLDivElement>(null);
  const[size,setSize]=useState({width:250,height:250});
  const[tip,setTip]=useState<Tip|null>(null);
  const PAD=8;

  useEffect(()=>{
    const element=ref.current;
    if(!element)return;
    const update=()=>setSize({width:element.clientWidth||250,height:element.clientHeight||250});
    update();
    const observer=new ResizeObserver(update);
    observer.observe(element);
    return()=>observer.disconnect();
  },[]);

  const height=Math.max(100,size.height);
  const width=size.width;
  const count=Math.max(1,rows.length);
  const x=(hour:number)=>PAD+(hour/23)*(width-58-PAD);
  const y=(rank:number)=>PAD+(rank-1)/Math.max(1,count-1)*(height-2*PAD-12);
  const toggle=(country:string)=>onSelect(selected===country?'':country);
  const hover=(event:ReactMouseEvent<SVGElement>,row:BumpRow)=>{
    const svg=(event.currentTarget as SVGElement).ownerSVGElement;
    if(!svg)return;
    const bounds=svg.getBoundingClientRect();
    const hour=Math.min(23,Math.max(0,Math.round((event.clientX-bounds.left-PAD)/(width-58-PAD)*23)));
    setTip({x:event.clientX-bounds.left+10,y:event.clientY-bounds.top+10,row,hour});
  };

  return <div ref={ref} className="bump-wrap">
    <svg width={width} height={height} role="img" aria-label="各国报道热度排名演变">
      {rows.map(row=>{
        const segments:[number,number][][]=[];
        let segment:[number,number][]=[];
        for(let hour=0;hour<24;hour++){
          if(row.ranks[hour]!=null)segment.push([x(hour),y(row.ranks[hour]!)]);
          else{
            if(segment.length>1)segments.push(segment);
            segment=[];
          }
        }
        if(segment.length>1)segments.push(segment);
        const last=lastHour(row.ranks);
        const active=selected===row.country;
        return <g key={row.country} className={selected&&!active?'dim':''}>
          {segments.map((points,index)=><path key={index} d={smoothLine(points)} fill="none" stroke={row.color} strokeWidth={active?3:1.8} className="bump-line" onClick={()=>toggle(row.country)}/>) }
          {segments.map((points,index)=><path key={`hit-${index}`} d={smoothLine(points)} fill="none" stroke="transparent" strokeWidth={10} onMouseMove={event=>hover(event,row)} onMouseLeave={()=>setTip(null)} onClick={()=>toggle(row.country)}/>) }
          {(active?rankChanges(row.ranks):[]).map(hour=><circle key={hour} cx={x(hour)} cy={y(row.ranks[hour]!)} r={3.2} fill={row.color} className="bump-dot" onMouseMove={event=>hover(event,row)} onMouseLeave={()=>setTip(null)} onClick={()=>toggle(row.country)}/>) }
          {last>=0&&<text x={x(last)+5} y={y(row.ranks[last]!)+3} className="bump-label" fill={row.color} onClick={()=>toggle(row.country)}>{name(row.country)}</text>}
        </g>;
      })}
      {[0,6,12,18,23].map(hour=><text key={hour} x={x(hour)} y={height-1} textAnchor="middle" className="axis-label">{String(hour).padStart(2,'0')}</text>)}
    </svg>
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}}><b>{name(tip.row.country)}</b><br/>{hourLabel(tip.hour)} · {tip.row.ranks[tip.hour]==null?'无报道':`第 ${tip.row.ranks[tip.hour]} 位`}<br/>{fmt.format(tip.row.counts[tip.hour])} 篇</div>}
  </div>;
}
