
const S={
  cycle:"standard",
  showNonstationary:true
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let D;
const names=["stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"];
const monthNames=["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parse=s=>new Date(s+"T12:00:00");
function addRange(map,a,b,e,filter=null){for(let d=parse(a),z=parse(b);d<=z;d.setDate(d.getDate()+1)){if(filter&&!filter(d))continue;(map[iso(d)]??=[]).push({...e})}}
function weekInfo(k){for(const w of (D.weekSchedule[S.cycle]||[]))if(k>=w[0]&&k<=w[1])return {nr:w[2],parity:w[3]};return null}
function holiday(k){const h=(D.holidays||[]).find(x=>x[0]===k);return h?.[1]||null}
const UNIVERSITY_FREE_RANGES = [
  ["2026-12-23","2027-01-06"],
  ["2027-03-26","2027-03-30"],
  ["2027-05-01","2027-05-04"],
  ["2027-05-13","2027-05-14"], // Juwenalia
  ["2027-05-27","2027-05-31"],  // dzień wolny
  ["2027-05-31","2027-05-31"]
];
const DAY_LABELS = {
  "2027-05-13": { text: "JUWENALIA", type: "juwenalia" },
  "2027-05-14": { text: "JUWENALIA", type: "juwenalia" },
  "2027-05-31": { text: "PŚk DZIECIOM", type: "psk-dzieciom" }
};

function universityFreeDay(k){
  return UNIVERSITY_FREE_RANGES.some(([a,b])=>k>=a && k<=b);
}
function eventMap(){
 const m={}, sc=D.stationary[S.cycle];
 (sc.periods||[]).forEach(p=>addRange(m,p.start,p.end,{type:p.type,title:p.label,detail:"Studia stacjonarne"},d=>{
   const k=iso(d);
   return d.getDay()>=1 && d.getDay()<=5 && !holiday(k) && !universityFreeDay(k);
 }));
 (sc.academicPeriods||[]).forEach(p=>addRange(m,p.start,p.end,{type:p.type,title:p.label,detail:"Kalendarz Rektora PŚk"}));
 D.stationary.events.forEach(e=>(m[e.date]??=[]).push({...e,detail:(e.detail?e.detail+" · ":"")+"Studia stacjonarne"}));

if(S.showNonstationary){

  const nc=D.nonstationary.standard;

  (nc.meetings||[]).forEach(x=>addRange(m,x[1],x[2],{
    type:x[3]==="Wykłady" ? "lecture" : "meeting",
    title:`Zjazd ${x[0]} – niestacjonarne`,
    detail:x[3] || "Zajęcia niestacjonarne"
  }));

  (nc.periods||[]).forEach(p=>{

    const nt =
      p.type==="exam" ? "exam-ns" :
      p.type==="resit" ? "resit-ns" :
      p.type==="registration" ? "registration-ns" :
      p.type;

    addRange(m,p.start,p.end,{
      type:nt,
      title:`${p.label} – niestacjonarne`,
      detail:"Studia niestacjonarne"
    });

  });

}
 return m;
}
function month(y,m,map){
 const box=document.createElement("section");box.className="month";
 box.innerHTML=`<h2>${monthNames[m]} ${y}</h2><div class="weekhead"><div class="weekcol-head">TYDZ.</div>${["Pn","Wt","Śr","Cz","Pt","So","Nd"].map(x=>`<div>${x}</div>`).join("")}</div><div class="days"></div>`;
 const grid=box.querySelector(".days"), first=new Date(y,m,1,12),off=(first.getDay()+6)%7;
 for(let i=0;i<42;i++){
  const d=new Date(y,m,1-off+i,12),
      k=iso(d),
      ev=map[k]||[],
      wi=weekInfo(k),
      hol=holiday(k),
      uniFree=universityFreeDay(k),
      dayLabel=DAY_LABELS[k]||"";
  
  if(i%7===0){
    const weekCell=document.createElement("div");
    weekCell.className="weekcol";
    weekCell.innerHTML=wi
      ? `<strong>${wi.nr}</strong><span>${wi.parity==="p"?"P":wi.parity==="n"?"NP":wi.parity.toUpperCase()}</span>`
      : `<strong>–</strong><span></span>`;
    grid.appendChild(weekCell);
  }
  const replacementEvent=ev.find(x=>x.type==="replacement" && x.replacement);
  const replacementCode=replacementEvent
    ? ({1:"pn",2:"wt",3:"śr",4:"czw",5:"pt"}[replacementEvent.replacement.weekday] || "") + "/" +
      (replacementEvent.replacement.parity==="p" ? "p" : "n")
    : "";
  const hasMeeting=ev.some(x=>x.type==="meeting"||x.type==="lecture");
  const exam=ev.some(x=>x.type==="exam"),resit=ev.some(x=>x.type==="resit"),reg=ev.some(x=>x.type==="registration");
  const examNS=ev.some(x=>x.type==="exam-ns"),resitNS=ev.some(x=>x.type==="resit-ns"),regNS=ev.some(x=>x.type==="registration-ns");
  const teaching=ev.some(x=>x.type==="teaching"||x.type==="replacement");
  const freeDay=ev.some(x=>x.type==="free") || !!uniFree;
  const weekend=d.getDay()===0||d.getDay()===6;
  let cls="day"+(d.getMonth()!=m?" out":"")+(weekend?" weekend":"")+((!teaching||freeDay)&&d.getMonth()==m?" nonteaching":"")+(hol?" holiday":"")+(hasMeeting?" has-meeting":"")+(exam?" examday":"")+(resit?" resitday":"")+(reg?" registrationday":"")+(examNS?" exam-ns-border":"")+(resitNS?" resit-ns-border":"")+(regNS?" registration-ns-border":"");
  let labels=[];
if(dayLabel){
  labels.push(
    `<span class="special-label ${dayLabel.type}">${dayLabel.text}</span>`
  );
}
  if(hasMeeting)labels.push(ev.find(x=>x.type==="meeting"||x.type==="lecture").title.replace(" – niestacjonarne",""));
  if(exam)labels.push("SESJA"); else if(resit)labels.push("POPR."); else if(reg)labels.push("REJ.");
  if(examNS)labels.push("SESJA NS"); else if(resitNS)labels.push("POPR. NS"); else if(regNS)labels.push("REJ. NS");
  const el=document.createElement("div");el.className=cls;
  el.innerHTML=`<span class="n">${d.getDate()}${replacementCode?`<small class="replacement-code">${replacementCode}</small>`:""}</span><div class="label">${labels.join("<br>")}</div><div class="tags">${[...new Set(ev.map(x=>x.type))].map(t=>`<i class="dot ${t}"></i>`).join("")}</div>`;
  const all=[...ev];if(hol)all.unshift({type:"holiday",title:hol,detail:"Święto / dzień ustawowo wolny"});
  if(all.length){el.title=all.map(x=>x.title).join(" • ");el.onclick=()=>details(d,all)}
  grid.appendChild(el);
 } return box;
}
function details(d,ev){$("#drawer").classList.add("open");$("#drawerContent").innerHTML=`<h2>${d.getDate()} ${names[d.getMonth()]} ${d.getFullYear()}</h2>`+ev.map(e=>`<div class="event" style="border-left-color:${e.type==="holiday"?"#ff5b5b":`var(--${e.type})`}"><b>${e.title}</b><br><small>${e.detail||""}</small></div>`).join("")}
function render(){
 const cal=$("#calendar"),map=eventMap();cal.innerHTML="";
 $("#periodTitle").textContent=S.cycle==="standard"?"Rok akademicki 2026/2027":"I semestr studiów II stopnia · 2026/2027";
 $$(".cycle button").forEach(b=>b.classList.toggle("active",b.dataset.v===S.cycle));
 for(const [y,m] of [[2026,8],[2026,9],[2026,10],[2026,11],[2027,0],[2027,1],[2027,2],[2027,3],[2027,4],[2027,5],[2027,6],[2027,7],[2027,8]])cal.appendChild(month(y,m,map));
}
fetch("calendar.json").then(r=>r.json()).then(x=>{D=x;render()}).catch(()=>$("#calendar").innerHTML='<div class="empty">Uruchom katalog przez serwer HTTP, np. <b>python -m http.server 8000</b>.</div>');
$$(".cycle button").forEach(b=>b.onclick=()=>{S.cycle=b.dataset.v;render()});$("#close").onclick=()=>$("#drawer").classList.remove("open");
$("#toggle-ns").addEventListener("change", e=>{
  S.showNonstationary=e.target.checked;
  render();
});