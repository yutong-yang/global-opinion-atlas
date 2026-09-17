'use client';
import {useEffect,useRef,useState} from 'react';
import {BumpRow,name,hourLabel,fmt} from '../lib/data';

type Tip={x:number;y:number;html:string};

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

export default function BumpChart({rows,selected,onSelect}:{rows:BumpRow[];selected:string|null;onSelect:(c:string)=>void}){
  const ref=useRef<HTMLDivElement>(null);
  const[width,setWidth]=useState(250);
  const[tip,setTip]=useState<Tip|null>(null);
  const H=250,PAD=8;
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    setWidth(e.clientWidth||250);
    const o=new ResizeObserver(()=>setWidth(e.clientWidth||250));o.observe(e);
    return()=>o.disconnect();
  },[]);
  const n=rows.length||1;
  const x=(h:number)=>PAD+(h/23)*(width-58-PAD);
  const y=(r:number)=>PAD+(r-1)/Math.max(1,n-1)*(H-2*PAD-12);
  const lastOf=(ranks:(number|null)[])=>{for(let h=23;h>=0;h--)if(ranks[h]!=null)return h;return-1};
  const changes=(ranks:(number|null)[])=>{
    const out:number[]=[];
    for(let h=0;h<24;h++){
      if(ranks[h]==null)continue;
      if(h===0||ranks[h-1]==null||ranks[h-1]!==ranks[h])out.push(h);
    }
    return out;
  };
  const hover=(e:React.MouseEvent,row:BumpRow)=>{
    const b=ref.current!.getBoundingClientRect();
    const h=Math.min(23,Math.max(0,Math.round((e.clientX-b.left-PAD)/(width-58-PAD)*23)));
    const r=row.ranks[h];
    setTip({x:e.clientX-b.left+10,y:e.clientY-b.top+10,html:`<b>${name(row.country)}</b><br>${hourLabel(h)} · ${r==null?'无报道':'第 '+r+' 位'}<br>${fmt.format(row.counts[h])} 篇`});
  };
  return <div ref={ref} className="bump-wrap">
    <svg width={width} height={H}>
      {rows.map(row=>{
        const segs:[number,number][][]=[];
        let cur:[number,number][]=[];
        for(let h=0;h<24;h++){
          if(row.ranks[h]!=null)cur.push([x(h),y(row.ranks[h]!)]);
          else{if(cur.length>1)segs.push(cur);cur=[]}
        }
        if(cur.length>1)segs.push(cur);
        const lh=lastOf(row.ranks);
        const dim=selected&&selected!==row.country;
        return <g key={row.country} className={dim?'dim':''}>
          {segs.map((s,i)=><path key={i} d={smoothLine(s)} fill="none" stroke={row.color} strokeWidth={selected===row.country?3:1.8} className="bump-line"
            onClick={()=>onSelect(selected===row.country?'':row.country)}/>)}
          {segs.map((s,i)=><path key={'hit'+i} d={smoothLine(s)} fill="none" stroke="transparent" strokeWidth={10}
            onMouseMove={e=>hover(e,row)} onMouseLeave={()=>setTip(null)}
            onClick={()=>onSelect(selected===row.country?'':row.country)}/>)}
          {(selected===row.country?changes(row.ranks):[]).map(h=><circle key={h} cx={x(h)} cy={y(row.ranks[h]!)} r={3.2} fill={row.color} className="bump-dot"
            onMouseMove={e=>hover(e,row)}
            onMouseLeave={()=>setTip(null)}
            onClick={()=>onSelect(selected===row.country?'':row.country)}/>)}
          {lh>=0&&<text x={x(lh)+5} y={y(row.ranks[lh]!)+3} className="bump-label" fill={row.color}
            onClick={()=>onSelect(selected===row.country?'':row.country)}>{name(row.country)}</text>}
        </g>;
      })}
      {[0,6,12,18,23].map(h=><text key={h} x={x(h)} y={H-1} textAnchor="middle" className="axis-label">{String(h).padStart(2,'0')}</text>)}
    </svg>
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
  </div>;
}
