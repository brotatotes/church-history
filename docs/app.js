/* Christian Church History timeline. Data come from data.js, generated from cited research records. */
(()=>{
const $=s=>document.querySelector(s), ns='http://www.w3.org/2000/svg';
const D=window.CH_DATA, recs=D.records, byId=Object.fromEntries(recs.map(r=>[r.id,r])), NOW=D.meta.now;
const chart=$('#chart'), axis=$('#axis'), plot=$('#plot'), body=$('#body'), panel=$('#panel'), q=$('#q'), results=$('#results');
const lanes=D.lanes, laneById=Object.fromEntries(lanes.map(l=>[l.id,l]));
const BG='#f5eedc', ROWH=42;
const groups=recs.filter(r=>r.kind==='group'&&!r.overlay), overlays=recs.filter(r=>r.overlay), events=recs.filter(r=>r.kind==='event'&&r.start!=null);
let visible=Object.fromEntries(lanes.map(l=>[l.id,true])), ovOn=Object.fromEntries(overlays.map(o=>[o.id,o.start!=null])), modes={}, selected=null, lineage=null, width=0, scrollWanted=null;
// Tree order within each lane: parents before children, siblings by start year.
const kids={};groups.forEach(g=>(kids[g.parent&&byId[g.parent]?g.parent:'_root']??=[]).push(g));
const sy=g=>g.start??9999;let order=[];const seen=new Set();
function visit(g){if(seen.has(g.id))return;seen.add(g.id);order.push(g);(kids[g.id]||[]).sort((a,b)=>sy(a)-sy(b)).forEach(visit)}
(kids._root||[]).sort((a,b)=>sy(a)-sy(b)).forEach(visit);groups.forEach(visit);
const rank=Object.fromEntries(order.map((g,i)=>[g.id,i]));
const rows=groups.map(g=>({...g,key:g.id,lane:g.stream,from:g.start,to:g.end??NOW,dated:g.start!=null}));
const rowById=Object.fromEntries(rows.map(r=>[r.id,r]));
const WARP=y=> y<=1500?y/1500*.36:.36+(y-1500)/530*.64;
const UNWARP=u=>u<=.36?u/.36*1500:1500+(u-.36)/.64*530;
const U0=WARP(0), U1=WARP(2030);let view=[U0,U1];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), x=y=>((WARP(y)-view[0])/(view[1]-view[0]))*width;
const yearAt=px=>UNWARP(view[0]+px/width*(view[1]-view[0]));
function setView(a,b){let span=clamp(b-a,.005,U1-U0);let mid=(a+b)/2;view=[mid-span/2,mid+span/2];if(view[0]<U0)view=[U0,U0+span];if(view[1]>U1)view=[U1-span,U1];draw()}
function zoom(f,p=width/2){let mid=view[0]+p/width*(view[1]-view[0]),span=(view[1]-view[0])*f;setView(mid-p/width*span,mid+(1-p/width)*span)}
function pan(dx){let off=dx/width*(view[1]-view[0]);setView(view[0]-off,view[1]-off)}
function zoomYears(a,b){let v0=WARP(a),v1=WARP(b),d=(v1-v0)*.1;setView(v0-d,v1+d)}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=r=>r.start==null?'date not yet sourced':`${r.start<1000?'AD ':''}${r.start}${r.kind==='event'?'':r.endUnsourced?', end not sourced':r.end==null?' to present':` to ${r.endApprox?'c. ':''}${r.end}`}`;
const lineColor=r=>laneById[r.stream]?.color||'#555';
const chain=id=>{let c=[],s=new Set();while(id&&byId[id]&&!s.has(id)){c.unshift(id);s.add(id);id=byId[id].parent}return c};
const ctx=document.createElement('canvas').getContext('2d');const measure=(t,size=15)=>{ctx.font=`${size}px "EB Garamond", Georgia, "Liberation Serif", serif`;return ctx.measureText(t).width};
function label(text,max,size=15){if(max<48)return '';if(measure(text,size)<=max)return text;let short=text.split(/ \/ | \(|, /)[0];if(measure(short,size)<=max)return short;let s=short;while(s.length>4&&measure(s+'…',size)>max)s=s.slice(0,-1);return s.length>4?s+'…':''}
function add(svg,tag,attrs,text){let e=document.createElementNS(ns,tag);for(let [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);if(text!=null)e.textContent=text;svg.append(e);return e}
// Zoom bands are plain spans of years for navigation, not historical periods.
const BANDS=[[0,500,'AD 1 to 500'],[500,1000,'500 to 1000'],[1000,1500,'1000 to 1500'],[1500,1700,'1500 to 1700'],[1700,1900,'1700 to 1900'],[1900,2026,'1900 to today']];
function renderAxis(){axis.replaceChildren();axis.setAttribute('width',width);axis.setAttribute('height',92);axis.setAttribute('viewBox',`0 0 ${width} 92`);
 add(axis,'rect',{width,height:92,fill:BG});
 BANDS.forEach(([s,e,n],i)=>{let l=clamp(x(s),0,width),r=clamp(x(e),0,width);if(r-l<8)return;let g=add(axis,'g',{class:'era','data-era':`${s},${e}`});add(g,'rect',{x:l,y:4,width:r-l,height:20,fill:i%2?'#eee5cf':'#f2ead7'});if(r-l>measure(n,14)+16)add(g,'text',{x:(l+r)/2,y:19,'text-anchor':'middle','font-size':14,fill:'#6a5a44','pointer-events':'none'},n)});
 let ticks=[];for(let [a,b] of [[0,1500],[1500,2030]]){let dy=x(Math.min(a+100,b))-x(a);let step=[10,20,25,50,100,200,250,500].find(s=>s*dy/100>=70)||500;for(let y=Math.ceil(Math.max(a,0)/step)*step;y<=b;y+=step)if(y>0&&x(y)>0&&x(y)<width)ticks.push(y)}
 ticks.sort((a,b)=>a-b);let last=-100;for(let y of ticks){let xx=x(y);if(xx-last<52||xx<measure(String(y),14)/2+4||xx>width-measure(String(y),14)/2-4)continue;last=xx;add(axis,'line',{x1:xx,x2:xx,y1:25,y2:32,stroke:'#c9bc9f'});add(axis,'text',{x:xx,y:46,'text-anchor':'middle','font-size':14,fill:'#5e5547'},y)}
 const taken=[[],[]];let shown=[];
 for(let e of events){let xx=x(e.start);if(xx<0||xx>width)continue;let text=e.name,w=measure(text,14)+8;let l=clamp(xx+3,4,Math.max(4,width-w-4));let rr=l+w;let row=[0,1].find(i=>taken[i].every(([a,b])=>rr<a-16||l>b+16));if(row===undefined)continue;taken[row].push([l,rr]);shown.push(e);
  let g=add(axis,'g',{class:'evt','data-event':e.id});add(g,'line',{x1:xx,x2:xx,y1:51,y2:90,stroke:'#c4ab7c','stroke-dasharray':'2 4'});add(g,'text',{x:l,y:row?83:67,'font-size':14,fill:selected===e.id?'#3a2a10':'#6e5530','font-style':'italic','font-weight':selected===e.id?'bold':'normal'},text);add(g,'rect',{x:l-2,y:row?70:54,width:w,height:17,fill:'transparent'})}
 return {ticks,shown}}
let layout=[];
function makeLayout(){let top=10,yearL=yearAt(0),yearR=yearAt(width),span=yearR-yearL;
 layout=lanes.filter(l=>visible[l.id]).map(l=>{let all=rows.filter(r=>r.lane===l.id).sort((a,b)=>rank[a.id]-rank[b.id]);if(!all.length)return null;
  let hits=all.filter(r=>!r.dated||(r.to>=yearL&&r.from<=yearR));let forced=lineage?.some(id=>all.some(r=>r.id===id))||all.some(r=>r.id===selected);
  let expanded=modes[l.id]===true||(modes[l.id]!==false&&((span<620&&hits.some(r=>r.dated))||forced));
  let display=expanded?all.filter(r=>!r.dated||(r.to>=yearL-45&&r.from<=yearR+45)||lineage?.includes(r.id)||selected===r.id):[];
  if(expanded&&!display.length)expanded=false;
  let height=expanded?58+display.length*ROWH+14:61;let o={...l,all,display,expanded,y:top,height,cy:top+41};top+=height+8;return o}).filter(Boolean);
 return Math.max(top+(window.innerWidth<=760&&!panel.hidden?body.clientHeight*.8:30),body.clientHeight)}
function renderPlot(ax){let h=makeLayout();plot.replaceChildren();plot.setAttribute('width',width);plot.setAttribute('height',h);plot.setAttribute('viewBox',`0 0 ${width} ${h}`);
 add(plot,'rect',{width,height:h,fill:BG});
 for(let y of ax.ticks){let xx=x(y);add(plot,'line',{x1:xx,x2:xx,y1:0,y2:h,stroke:'#e9dfc8','stroke-width':.8})}
 for(let e of ax.shown){let xx=x(e.start);add(plot,'line',{x1:xx,x2:xx,y1:0,y2:h,stroke:'#dccca8','stroke-width':.8,'stroke-opacity':.7,'stroke-dasharray':'3 6'})}
 let positions={};for(let l of layout){if(l.expanded)l.display.forEach((r,i)=>positions[r.key]=l.y+66+i*ROWH);else l.all.forEach(r=>positions[r.key]=l.cy)}
 // Shaded bands for movements that crossed church boundaries.
 for(let o of overlays){if(!ovOn[o.id]||o.start==null)continue;let a=clamp(x(o.start),0,width),b=clamp(x(o.end??NOW),0,width);if(b<=a)continue;let done=new Set();
  for(let id of o.influenced){let r=rowById[id];if(!r)continue;let y=positions[r.key];if(y==null)continue;let l=layout.find(l=>l.id===r.lane);let k=l.expanded?r.key:l.id;if(done.has(k))continue;done.add(k);
   let ra=Math.max(a,clamp(x(r.from??o.start),0,width)),rb=Math.min(b,clamp(x(r.to),0,width));if(rb<=ra)continue;
   let fo=lineage&&!lineage.includes(o.id)?.08:.24;if(l.expanded)add(plot,'rect',{x:ra,y:y-7,width:rb-ra,height:14,rx:7,fill:o.color,'fill-opacity':fo,'data-overlay':o.id,class:'hit ovband'});
   else{let k2=done.size;add(plot,'rect',{x:ra,y:y+10+((overlays.indexOf(o))%3)*4,width:rb-ra,height:3,rx:1.5,fill:o.color,'fill-opacity':.7,'data-overlay':o.id,class:'hit ovband'})}}}
 let seenPair=new Set();for(let l of layout){let cand=l.expanded?l.display:[...l.all].sort((a,b)=>sy(a)-sy(b));for(let r of cand){if(!r.parent||!r.dated)continue;let p=rowById[r.parent],pl=layout.find(o=>o.id===p?.lane);if(!p||!pl||positions[p.key]==null)continue;if(!l.expanded&&pl.id===l.id)continue;
  let key=pl.id+'>'+l.id;if(!l.expanded&&seenPair.has(key))continue;if(!l.expanded)seenPair.add(key);
  let xx=x(r.from),yp=positions[p.key],yc=positions[r.key];if(xx<0||xx>width||yp==null||yc==null||Math.abs(yp-yc)<1)continue;
  let active=lineage?.includes(r.id)&&lineage?.includes(p.id);let op=lineage?(active?.85:.06):.17;
  add(plot,'path',{d:`M${xx-23},${yp} C${xx+8},${yp} ${xx-21},${yc} ${xx},${yc}`,fill:'none',stroke:active?'#5a4b3a':lineColor(r),'stroke-width':active?2.4:1.1,'stroke-opacity':op,'pointer-events':'none'})}}
 let rowPos={};
 for(let l of layout){let op=lineage&&!l.all.some(r=>lineage.includes(r.id))?.58:1;
  add(plot,'line',{x1:0,x2:width,y1:l.y+l.height+1,y2:l.y+l.height+1,stroke:'#e6dcc4'});
  if(l.expanded){add(plot,'rect',{x:0,y:l.y,width,height:29,fill:BG});add(plot,'line',{x1:0,x2:width,y1:l.y+28,y2:l.y+28,stroke:l.color,'stroke-opacity':.2});let head=add(plot,'g',{'data-lane':l.id,class:'hit',role:'button',tabindex:'0','aria-label':`Collapse ${l.name}`});add(head,'rect',{x:0,y:l.y,width,height:30,fill:'transparent'});add(head,'text',{x:9,y:l.y+20,fill:l.color,'font-size':16,'font-weight':'bold','font-style':l.muted?'italic':'normal','pointer-events':'none'},label(`−  ${l.name} · ${l.display.length} of ${l.all.length} shown`,width-18,16));
   for(let [i,r] of l.display.entries()){let y=l.y+66+i*ROWH;rowPos[r.key]=y;let col=lineColor(r),active=lineage?.includes(r.id),alpha=lineage?(active?1:.62):1;
    if(selected===r.id)add(plot,'rect',{x:0,y:y-20,width,height:40,fill:'#e8d9b0','fill-opacity':.45});
    let g=add(plot,'g',{opacity:alpha,'data-group':r.id,class:'hit',role:'button',tabindex:'0','aria-label':`Open ${r.name}`});
    let xx,end;
    if(r.dated){xx=x(r.from);end=x(r.to);let sw=selected===r.id?6:active?4:2.4,dash=r.status==='placeholder'||l.muted?'8 5':'none';
     if(r.endApprox){let fadeFrom=end-Math.min(60,(end-xx)*.3);add(g,'line',{x1:clamp(xx,0,width),x2:clamp(fadeFrom,0,width),y1:y,y2:y,stroke:col,'stroke-width':sw,'stroke-linecap':'round','stroke-dasharray':dash});add(g,'line',{x1:clamp(fadeFrom,0,width),x2:clamp(end,0,width),y1:y,y2:y,stroke:col,'stroke-width':sw,'stroke-opacity':.35,'stroke-dasharray':'3 4'})}
     else add(g,'line',{x1:clamp(xx,0,width),x2:clamp(end,0,width),y1:y,y2:y,stroke:col,'stroke-width':sw,'stroke-linecap':'round','stroke-dasharray':dash});
     if(!r.parent&&xx>=0&&xx<=width)add(g,'circle',{cx:xx,cy:y,r:5,fill:BG,stroke:col,'stroke-width':2})}
    else{xx=8;end=width;add(g,'line',{x1:8,x2:20,y1:y,y2:y,stroke:col,'stroke-width':2,'stroke-opacity':.5})}
    let start=r.dated?clamp(xx+6,5,width-5):24,avail=width-start-10,size=15;let text=label(r.name,avail,size);
    if(text&&end>5&&xx<width){add(g,'text',{x:start,y:y-8,fill:col,'font-size':size,'font-weight':(active||selected===r.id)?'bold':'normal','pointer-events':'none'},text);
     let note=r.status==='placeholder'?'still being researched':shortDate(r);let off=measure(text,size)+8;if(avail-off>measure(note,13)+8)add(g,'text',{x:start+off,y:y-8,fill:r.status==='placeholder'?'#8a5a00':'#6b6253','font-size':13,'font-style':r.status==='placeholder'?'italic':'normal','pointer-events':'none'},note)}
    add(g,'rect',{x:0,y:y-20,width,height:40,fill:'transparent'})}}
  else{let dated=l.all.filter(r=>r.dated);let x0=Math.min(...dated.map(r=>x(r.from))),x1=Math.max(...dated.map(r=>x(r.to)));let left=clamp(x0,0,width),right=clamp(x1,0,width);
   let g=add(plot,'g',{opacity:op,'data-lane':l.id,class:'hit',role:'button',tabindex:'0','aria-label':`Expand ${l.name}`});
   if(right>left){add(g,'rect',{x:left,y:l.cy-8,width:right-left,height:16,rx:8,fill:l.color,'fill-opacity':l.muted?.12:.22,stroke:l.color,'stroke-width':1,'stroke-dasharray':l.muted?'6 5':'none'});
    for(let r of dated){let xx=x(r.from);if(xx>left+3&&xx<right-3)add(g,'line',{x1:xx,x2:xx,y1:l.cy-5,y2:l.cy+5,stroke:l.color,'stroke-opacity':.45})}}
   let text=`+  ${l.name}  ·  ${l.all.length}`;let font=width<500?15:16;add(g,'text',{x:8,y:l.y+20,fill:l.color,'font-size':font,'font-weight':'bold','font-style':l.muted?'italic':'normal','pointer-events':'none'},label(text,width-18,font));
   add(g,'rect',{x:0,y:l.y,width,height:l.height,fill:'transparent'})}}
 add(plot,'text',{x:10,y:h-10,fill:'#6b6253','font-size':width<500?14:15,'font-style':'italic'},width<500?'Scale widens after 1500 · lines do not show size':'Scale widens after 1500 · lines show sourced dates, not size · open any line for its sources');
 if(scrollWanted){let yy=rowPos[scrollWanted]??positions[scrollWanted];if(yy!=null){let available=window.innerWidth<=760&&!panel.hidden?body.clientHeight*.42:body.clientHeight;body.scrollTop=Math.max(0,yy-available*.28)}scrollWanted=null}}
function draw(){width=Math.max(250,chart.clientWidth);let ax=renderAxis();renderPlot(ax)}
const cite=(r,ns_)=>ns_.map(n=>{let c=r.cites[n-1];return `<a class="cite" href="${esc(c.href)}" title="${esc(c.short)}, ${esc(c.locator)}">[${n}]</a>`}).join('');
const a=(id,txt)=>`<a href="#g=${encodeURIComponent(id)}" data-open="${esc(id)}">${esc(txt)}</a>`;
function openPanel(id){let g=byId[id];if(!g)return;selected=id;$('#tip').hidden=true;
 let laneName=g.kind==='event'?'Event':g.overlay?'Movement across churches':laneById[g.stream]?.name||'';
 let facts=g.facts.map(f=>{let v=f.link?a(f.link,f.value):esc(f.value);let prec=f.precision==='disputed'?'<span class="tag disputed">disputed</span>':'';
  let dis=f.disagreements.map(d=>`<div class="otherview">Another view: ${esc(d.value)}${cite(g,d.cites)}</div>`).join('');
  return `<dt>${esc(f.label)}</dt><dd>${v}${cite(g,f.cites)}${prec}${dis}</dd>`}).join('');
 let ph=g.status==='placeholder'?`<p class="phnote"><strong>Still being researched.</strong> No approved source has yet been found for this entry's ${g.facts.some(f=>f.field==='start')?'relationships':'start date'}. ${g.facts.length?'The facts below are sourced.':'Nothing is shown until a source is found.'}</p>`:'';
 let c=chain(id),ch=groups.filter(v=>v.parent===id);
 let infl=g.overlay&&g.influenced.length?`<section class="linklist"><h3>Influenced</h3><p>${g.influenced.filter(i=>byId[i]).map(i=>a(i,byId[i].name)).join(' · ')}</p><p class="smallnote">${g.start!=null?'Shown on the chart as a shaded band across these lines.':'Not drawn on the chart until its dates are sourced.'}</p></section>`:'';
 let movements=overlays.filter(o=>o.influenced.includes(id));
 let mv=movements.length?`<section class="linklist"><h3>Movements that shaped it</h3><p>${movements.map(o=>a(o.id,o.name)).join(' · ')}</p></section>`:'';
 let place=g.kind==='group'&&!g.overlay?`<section class="lineage"><h3>Placement on this chart</h3><ol>${c.map(v=>`<li>${v===id?esc(byId[v].name):a(v,byId[v].name)}</li>`).join('')}</ol><p class="smallnote">Placement groups related churches for navigation. Sourced relationships appear above.</p>${c.length>1?'<button class="btn" id="highlight" type="button">Highlight lineage</button>':''}</section>`:'';
 let br=ch.length?`<section class="linklist"><h3>Placed beneath it</h3><p>${ch.map(k=>a(k.id,k.name)).join(' · ')}</p></section>`:'';
 let src=g.cites.length?`<section><h3>Sources</h3><ol class="srclist">${g.cites.map(c=>`<li id="n-${esc(g.id)}-${c.n}"><span class="n">[${c.n}]</span><span><a href="${esc(c.href)}">${esc(c.short)}</a>, ${esc(c.locator)}</span></li>`).join('')}</ol><p class="smallnote">Each number opens the stored excerpt. <a href="bibliography.html">Bibliography</a>.</p></section>`:'';
 panel.innerHTML=`<button class="close" aria-label="Close detail panel" id="closepanel">×</button><p class="fam" style="color:${esc(g.overlay?g.color:laneById[g.stream]?.color||'#6e5530')}">${esc(laneName)}</p><h2>${esc(g.name)}</h2>${ph}${g.facts.length?`<dl class="facts">${facts}</dl>`:''}${infl}${mv}${place}${br}${src}`;
 panel.hidden=false;history.replaceState(null,'',`#g=${encodeURIComponent(id)}`);if(window.innerWidth<=760)scrollWanted=id;panel.scrollTop=0;draw()}
function highlight(id,focus=true){let g=byId[id];if(!g)return;if(g.kind==='event'||g.overlay){if(focus&&g.start!=null)zoomYears(Math.max(0,g.start-150),Math.min(2030,(g.end??g.start)+150));if(g.overlay){ovOn[id]=g.start!=null;syncOverlayBoxes();let first=g.influenced.find(i=>rowById[i]);if(first){visible[rowById[first].lane]=true;syncLaneBoxes();scrollWanted=first}}lineage=g.overlay?[id,...g.influenced]:null;openPanel(id);return}
 let ids=chain(id);lineage=ids;selected=id;$('#tip').hidden=true;for(let v of ids){visible[byId[v].stream]=true}syncLaneBoxes();
 $('#chip').hidden=false;$('#chiptext').textContent=`Lineage: ${g.name}`;
 if(focus&&g.start!=null){let end=g.end??NOW;let a0=Math.max(0,g.start-(g.start<500?100:180)),b0=Math.min(2030,end+Math.max(60,end-g.start<100?110:20));if(b0-a0>1200)a0=Math.max(0,g.start-450);zoomYears(a0,b0)}
 scrollWanted=id;openPanel(id);draw()}
function clearLineage(){lineage=null;$('#chip').hidden=true;draw()}
function toggleLane(id){$('#tip').hidden=true;modes[id]=!(layout.find(l=>l.id===id)?.expanded);draw()}
function reset(){view=[U0,U1];modes={};selected=null;lineage=null;$('#chip').hidden=true;panel.hidden=true;body.scrollTop=0;history.replaceState(null,'',location.pathname);draw()}
const searchable=recs;
const match=()=>{let term=q.value.trim().toLowerCase();if(!term){results.hidden=true;q.setAttribute('aria-expanded','false');return []}
 let found=searchable.filter(g=>g.name.toLowerCase().includes(term)).sort((a,b)=>(b.name.toLowerCase().startsWith(term)?1:0)-(a.name.toLowerCase().startsWith(term)?1:0)).slice(0,10);
 results.replaceChildren();for(let g of found){let li=document.createElement('li');li.setAttribute('role','option');li.dataset.id=g.id;let col=g.overlay?g.color:g.kind==='event'?'#c4ab7c':lineColor(g);
  li.innerHTML=`<span><i class="sw" style="background:${col}"></i>${esc(g.name)}${g.kind==='event'?' <em>(event)</em>':g.overlay?' <em>(movement)</em>':''}</span><span class="yr">${g.start??''}</span>`;results.append(li)}
 if(!found.length){let li=document.createElement('li');li.className='none';li.textContent='No matching entries';results.append(li)}results.hidden=false;q.setAttribute('aria-expanded','true');return found};
q.addEventListener('input',match);q.addEventListener('keydown',e=>{if(e.key==='Enter'){let f=match()[0];if(f){highlight(f.id);q.value=f.name;results.hidden=true;q.setAttribute('aria-expanded','false');q.blur()}}else if(e.key==='Escape')results.hidden=true});
results.addEventListener('click',e=>{let li=e.target.closest('li[data-id]');if(!li)return;highlight(li.dataset.id);q.value=byId[li.dataset.id].name;results.hidden=true;q.setAttribute('aria-expanded','false')});
document.addEventListener('click',e=>{if(!e.target.closest('.searchwrap'))results.hidden=true;let el=e.target.closest('[data-open]');if(el){e.preventDefault();highlight(el.dataset.open)}if(e.target.id==='closepanel'){panel.hidden=true;selected=null;history.replaceState(null,'',location.pathname);draw()}if(e.target.id==='highlight')highlight(selected,false)});
$('#chipclear').onclick=clearLineage;$('#zin').onclick=()=>zoom(.68);$('#zout').onclick=()=>zoom(1.48);$('#reset').onclick=reset;
const lf=$('#lanefilters');for(let l of lanes){let n=rows.filter(r=>r.lane===l.id).length;if(!n)continue;let lb=document.createElement('label');lb.innerHTML=`<input type="checkbox" data-lanebox="${l.id}" checked> <span><i class="sw" style="background:${l.color}"></i>${esc(l.name)} <span class="cnt">(${n})</span></span>`;lf.append(lb)}
lf.addEventListener('change',e=>{let id=e.target.dataset.lanebox;if(id){visible[id]=e.target.checked;draw()}});
function syncLaneBoxes(){document.querySelectorAll('[data-lanebox]').forEach(b=>b.checked=visible[b.dataset.lanebox])}
const of=$('#overlayfilters');for(let o of overlays){let lb=document.createElement('label');lb.innerHTML=`<input type="checkbox" data-ovbox="${o.id}" ${ovOn[o.id]?'checked':''} ${o.start==null?'disabled':''}> <span><i class="sw" style="background:${o.color};opacity:.6"></i>${a(o.id,o.name)}${o.start==null?' <em>(still being researched)</em>':''}</span>`;of.append(lb)}
of.addEventListener('change',e=>{let id=e.target.dataset.ovbox;if(id){ovOn[id]=e.target.checked;draw()}});
function syncOverlayBoxes(){document.querySelectorAll('[data-ovbox]').forEach(b=>b.checked=ovOn[b.dataset.ovbox])}
$('#expandall').onclick=()=>{lanes.forEach(l=>modes[l.id]=true);draw();$('#opts').open=false};$('#collapseall').onclick=()=>{lanes.forEach(l=>modes[l.id]=false);draw();$('#opts').open=false};
$('#key').innerHTML=`<li><svg width="40" height="12"><line x1="2" y1="6" x2="38" y2="6" stroke="#4a6585" stroke-width="2.6"/></svg>Line: sourced start to end or present</li><li><svg width="40" height="12"><line x1="2" y1="6" x2="26" y2="6" stroke="#7f786f" stroke-width="2.6"/><line x1="26" y1="6" x2="38" y2="6" stroke="#7f786f" stroke-opacity=".35" stroke-width="2.6" stroke-dasharray="3 4"/></svg>Faded end: end date approximate or not yet sourced</li><li><svg width="40" height="12"><line x1="2" y1="6" x2="38" y2="6" stroke="#6a655e" stroke-width="2.6" stroke-dasharray="8 5"/></svg>Dashed: outside lane or still being researched</li><li><svg width="40" height="14"><rect x="2" y="1" width="36" height="12" rx="3" fill="#b58a3c" fill-opacity=".25"/></svg>Shaded band: movement across churches</li><li><svg width="40" height="12"><line x1="20" y1="0" x2="20" y2="12" stroke="#c4ab7c" stroke-dasharray="2 3"/></svg>Dotted rule: event</li>`;
let moved=false,active=new Map(),initial=null,pinch=null;
function handleHit(t){let n=t?.closest?.('[data-group],[data-lane],[data-era],[data-event],[data-overlay]');if(!n)return;if(n.dataset.group)openPanel(n.dataset.group);else if(n.dataset.overlay)openPanel(n.dataset.overlay);else if(n.dataset.event)openPanel(n.dataset.event);else if(n.dataset.lane)toggleLane(n.dataset.lane);else if(n.dataset.era){let [a0,b0]=n.dataset.era.split(',').map(Number);zoomYears(a0,b0)}}
chart.addEventListener('click',e=>{if(moved){moved=false;e.preventDefault();return}handleHit(e.target)});
chart.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){zoom(.75);e.preventDefault()}else if(e.key==='-'){zoom(1.33);e.preventDefault()}else if(e.key==='ArrowLeft'){pan(70);e.preventDefault()}else if(e.key==='ArrowRight'){pan(-70);e.preventDefault()}else if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-group],[data-lane],[data-era]')){handleHit(e.target);e.preventDefault()}});
chart.addEventListener('wheel',e=>{e.preventDefault();let px=e.clientX-chart.getBoundingClientRect().left;if(e.shiftKey){body.scrollTop+=e.deltaY;return}if(Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.5&&!e.ctrlKey){pan(-e.deltaX);return}zoom(Math.exp(clamp(e.deltaY,-150,150)*.0015),px)},{passive:false});
chart.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;active.set(e.pointerId,{x:e.clientX,y:e.clientY});initial={x:e.clientX,y:e.clientY};if(active.size===2){let p=[...active.values()];pinch={d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),mid:(p[0].x+p[1].x)/2}}moved=false;chart.classList.add('dragging')});
window.addEventListener('pointermove',e=>{if(!active.has(e.pointerId))return;let p=active.get(e.pointerId),dx=e.clientX-p.x,dy=e.clientY-p.y;active.set(e.pointerId,{x:e.clientX,y:e.clientY});if(initial&&Math.hypot(e.clientX-initial.x,e.clientY-initial.y)>5)moved=true;
 if(active.size>=2){let v=[...active.values()];let d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y),mid=(v[0].x+v[1].x)/2;if(pinch&&d>5&&pinch.d>5){zoom(pinch.d/d,mid-chart.getBoundingClientRect().left);pan(mid-pinch.mid)}pinch={d,mid}}else if(moved){pan(dx);body.scrollTop-=dy}});
window.addEventListener('pointerup',e=>{active.delete(e.pointerId);if(active.size<2)pinch=null;if(!active.size){chart.classList.remove('dragging');$('#tip').hidden=true;if(moved)setTimeout(()=>{moved=false},60)}});
chart.addEventListener('pointerover',e=>{let n=e.target.closest('[data-group],[data-lane],[data-event],[data-overlay]');let tip=$('#tip');if(!n||active.size||matchMedia('(hover: none)').matches){tip.hidden=true;return}
 let r=byId[n.dataset.group||n.dataset.event||n.dataset.overlay];tip.textContent=r?`${r.name} · ${r.status==='placeholder'?'still being researched':shortDate(r)}`:laneById[n.dataset.lane].name;let cr=chart.getBoundingClientRect();tip.style.left=clamp(e.clientX-cr.left+12,4,width-210)+'px';tip.style.top=clamp(e.clientY-cr.top+12,4,cr.height-50)+'px';tip.hidden=false});
chart.addEventListener('pointermove',e=>{let tip=$('#tip');if(tip.hidden||active.size)return;let r=chart.getBoundingClientRect();tip.style.left=clamp(e.clientX-r.left+12,4,width-210)+'px';tip.style.top=clamp(e.clientY-r.top+12,4,r.height-50)+'px'});
chart.addEventListener('pointerleave',()=>$('#tip').hidden=true);
new ResizeObserver(()=>draw()).observe(chart);
const start=()=>{draw();let m=location.hash.match(/^#g=([\w-]+)$/);if(m&&byId[m[1]])highlight(m[1])};
(document.fonts?document.fonts.ready:Promise.resolve()).then(start);
window.addEventListener('hashchange',()=>{let m=location.hash.match(/^#g=([\w-]+)$/);if(m&&byId[m[1]]&&selected!==m[1])highlight(m[1])});
window.CH={zoomTo:zoomYears,select:highlight,reset,view:()=>[yearAt(0),yearAt(width)]};
})();
