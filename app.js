
const API='https://plan.usos.tu.kielce.pl/api';
const state={mode:'ft',tab:'lecturers',lecturers:[],groups:[],rooms:[],selected:null,events:[],weekOffset:0,cache:new Map(),favoritesOnly:false,academic:null};
const FAVORITES_KEY='plan_psk_favorites_v1';
function readFavorites(){try{return JSON.parse(localStorage.getItem(FAVORITES_KEY)||'{}')}catch{return {}}}
function favKey(tab,id,mode=state.mode){return `${mode}:${tab}:${id}`}
function isFavorite(tab,id,mode=state.mode){return !!readFavorites()[favKey(tab,id,mode)]}
function toggleFavorite(tab,id,label){const all=readFavorites(),key=favKey(tab,id);if(all[key])delete all[key];else all[key]={tab,id:String(id),mode:state.mode,label:String(label||''),savedAt:Date.now()};localStorage.setItem(FAVORITES_KEY,JSON.stringify(all));updateFavoritesUI();renderSelector()}
function favoritesForCurrent(){const all=readFavorites();return Object.values(all).filter(x=>x.mode===state.mode&&x.tab===state.tab)}
function updateFavoritesUI(){const n=favoritesForCurrent().length;const b=$('#favoritesToggle');if(!b)return;$('#favoritesCount').textContent=n;b.classList.toggle('active',state.favoritesOnly);b.setAttribute('aria-pressed',String(state.favoritesOnly));b.title=state.favoritesOnly?'Pokaż wszystkie':'Pokaż tylko ulubione'}
const FACULTIES={
 '200000':{short:'WBiA',name:'Wydział Budownictwa i Architektury',color:'#743A33'},
 '300000':{short:'WEAiI',name:'Wydział Elektrotechniki, Automatyki i Informatyki',color:'#EF7A1B'},
 '500000':{short:'WIŚGiE',name:'Wydział Inżynierii Środowiska, Geodezji i Energetyki Odnawialnej',color:'#006B42'},
 '100000':{short:'WMiBM',name:'Wydział Mechatroniki i Budowy Maszyn',color:'#163F8B'},
 '400000':{short:'WZiMK',name:'Wydział Zarządzania i Modelowania Komputerowego',color:'#818181'},
 '1903100':{short:'SD',name:'Szkoła Doktorska',color:'#55585d'}
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
async function get(path){const key=state.mode+':'+path;if(state.cache.has(key))return state.cache.get(key);const r=await fetch(API+path);if(!r.ok)throw new Error(r.status+' '+r.statusText);const j=await r.json();state.cache.set(key,j);return j}
const suffix=()=>state.mode==='pt'?'_pt':'';
function uniqEvents(a){const m=new Map();for(const e of a||[]){const k=[e.course_id,e.name,e.type,e.day,e.frequency,e.hr_start,e.min_start,e.hr_end,e.min_end,e.room_id,(e.groups_ids||[]).join(','),(e.lecturers_ids||[]).join(',')].join('|');if(!m.has(k))m.set(k,e)}return [...m.values()]}
async function loadLists(){try{$('#status').textContent='Ładowanie danych…';const s=suffix();const [l,g,r]=await Promise.all([get('/lecturers'+s),get('/groups'+s),get('/rooms'+s)]);state.lecturers=l;state.groups=g;state.rooms=r;$('#status').textContent=`${l.length} prowadzących · ${g.length} grup · ${r.length} sal`;renderSelector()}catch(e){$('#status').textContent='Błąd API: '+e.message}}
function renderSelector(){
 $('#selector').classList.remove('hidden');$('#planArea').classList.remove('hidden');
 const q=norm($('#search').value);let data=[],filterKeys=[];
 if(state.tab==='lecturers'){
   data=[...state.lecturers].sort((a,b)=>a.surname.localeCompare(b.surname,'pl'));
   filterKeys=[...new Set(data.map(x=>norm(x.surname)[0]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pl'));
 }
 if(state.tab==='rooms'){
   data=[...state.rooms].sort((a,b)=>a.room.localeCompare(b.room,'pl',{numeric:true}));
   filterKeys=[...new Set(data.map(x=>x.building))].sort();
 }
 if(state.tab==='groups'){
   data=[...state.groups].sort((a,b)=>(a.programme_name||'').localeCompare(b.programme_name||'','pl') || (a.name||'').localeCompare(b.name||'','pl',{numeric:true}));
   filterKeys=Object.keys(FACULTIES).filter(fid=>data.some(x=>String(x.faculty_id)===fid));
 }
 const active=$('#filters').dataset.active||'';
 $('#filters').innerHTML=`<button class="pill ${!active?'active':''}" data-f="">Wszystkie</button>`+filterKeys.map(x=>{const f=FACULTIES[x];return `<button class="pill ${active===String(x)?'active':''}" data-f="${esc(x)}" style="${f?`border-color:${f.color}`:''}">${esc(f?.short||x)}</button>`}).join('');
 data=data.filter(x=>{
   const text=norm(state.tab==='lecturers'?`${x.full_name} ${x.surname}`:state.tab==='rooms'?`${x.room} ${x.building}`:`${x.programme_name} ${x.programme} ${x.name} ${x.name1} ${x.stage_name}`);
   let f=true;if(active)f=state.tab==='lecturers'?norm(x.surname)[0]===active:state.tab==='rooms'?String(x.building)===active:String(x.faculty_id)===active;
   return f&&(!q||text.includes(q));
 });
 if(state.favoritesOnly)data=data.filter(x=>isFavorite(state.tab,state.tab==='lecturers'?x.lecturer_id:state.tab==='rooms'?x.room_id:x.group_id));
 updateFavoritesUI();
 if(state.tab==='groups'){
   // Wydział → kierunek → semestr → grupy. Dzięki temu nie ma płaskiej listy kilkudziesięciu pozycji.
   const byFaculty={};
   for(const x of data)(byFaculty[String(x.faculty_id)]??=[]).push(x);
   $('#items').innerHTML=Object.entries(FACULTIES).filter(([fid])=>byFaculty[fid]?.length).map(([fid,fac])=>{
     const byProgramme={};
     for(const x of byFaculty[fid]){
       const key=x.programme_name||x.programme||'Pozostałe';
       (byProgramme[key]??=[]).push(x);
     }
     const programmes=Object.entries(byProgramme).sort(([a],[b])=>a.localeCompare(b,'pl')).map(([programme,groups])=>{
       const bySemester={};
       for(const x of groups){
         const sem=Number(x.stage_num)||0;
         (bySemester[sem]??=[]).push(x);
       }
       const semesters=Object.entries(bySemester).sort((a,b)=>Number(a[0])-Number(b[0])).map(([sem,semesterGroups])=>{
         semesterGroups.sort((a,b)=>(a.name||a.name1||'').localeCompare(b.name||b.name1||'','pl',{numeric:true}));
         const semesterName=Number(sem)>0?`Semestr ${sem}`:'Semestr nieokreślony';
         return `<div class="semester-block"><div class="semester-title">${semesterName}<span>${semesterGroups.length} ${semesterGroups.length===1?'grupa':'grup'}</span></div><div class="semester-groups">${semesterGroups.map(x=>`<button class="group-item${isFavorite('groups',x.group_id)?' favorite':''}" data-id="${x.group_id}" title="${esc(x.stage_name||'')}"><span class="fav-star" data-fav="1" data-id="${x.group_id}" data-label="${esc(x.name||x.name1||('Grupa '+x.group_id))}" title="${isFavorite('groups',x.group_id)?'Usuń z ulubionych':'Dodaj do ulubionych'}">${isFavorite('groups',x.group_id)?'★':'☆'}</span><b>${esc(x.name||x.name1||('Grupa '+x.group_id))}</b><small>${esc(x.stage_name||'')}</small></button>`).join('')}</div></div>`;
       }).join('');
       return `<section class="programme-section"><div class="programme-title">${esc(programme)}</div>${semesters}</section>`;
     }).join('');
     return `<section class="faculty-section faculty-tree" style="--fc:${fac.color}"><div class="faculty-title"><strong>${esc(fac.short)}</strong><span>${esc(fac.name)}</span></div><div class="programme-list">${programmes}</div></section>`;
   }).join('')||'<div class="empty">Brak wyników</div>';
 }else{
   $('#items').innerHTML=data.map(x=>{let id,label,sub;if(state.tab==='lecturers'){id=x.lecturer_id;label=x.full_name;sub='ID '+id}else{id=x.room_id;label=x.room;sub='Budynek '+x.building};return `<div class="item${isFavorite(state.tab,id)?' favorite':''}" data-id="${id}"><span class="fav-star" data-fav="1" data-id="${id}" data-label="${esc(label)}" title="${isFavorite(state.tab,id)?'Usuń z ulubionych':'Dodaj do ulubionych'}">${isFavorite(state.tab,id)?'★':'☆'}</span><b>${esc(label)}</b><small>${esc(sub)}</small></div>`}).join('')||'<div class="empty">Brak wyników</div>';
 }
}
async function selectItem(id){let path,title;
 if(state.tab==='lecturers'){path='/lecturers_classes'+suffix()+'/'+id;const x=state.lecturers.find(x=>x.lecturer_id==id);title=x?.full_name}
 else if(state.tab==='groups'){path='/groups_classes'+suffix()+'/'+id;const x=state.groups.find(x=>x.group_id==id);title=(x?.programme_name||x?.programme||'Grupa')+(x?.name?` · ${x.name}`:'')}
 else{path='/rooms_classes'+suffix()+'/'+id;const x=state.rooms.find(x=>x.room_id==id);title='Sala '+x?.room}
 try{$('#weekMeta').textContent='Ładowanie planu…';state.events=uniqEvents(await get(path));state.selected={tab:state.tab,id,title};$('#weekMeta').textContent=`${title||''} · ${state.events.length} unikalnych zajęć`;renderCalendar()}catch(e){state.events=[];$('#weekMeta').textContent='Nie udało się pobrać planu: '+e.message;renderCalendar()}}
function mins(h,m){return (+h)*60+(+m||0)}
function groupInfo(id){const g=state.groups.find(x=>x.group_id==id);if(!g)return {label:'Grupa '+id,color:'#777'};const fac=FACULTIES[String(g.faculty_id)];return {label:g.name||g.name1||g.programme||('Grupa '+id),color:fac?.color||'#777',title:g.programme_name||g.programme||''}}
function lecturerInfo(id){const l=state.lecturers.find(x=>x.lecturer_id==id);return {label:l?.full_name||('Prowadzący '+id),id};}
function freqLabel(f){return ({CO_TYDZIEN:'co tydzień',CO_DWA_TYG_PARZ:'parzyste',CO_DWA_TYG_NIEPARZ:'nieparzyste'}[f]||String(f||'').replaceAll('_',' ').toLowerCase())}
function typeLabel(t){const x=norm(t);return ({LAB:'LABORATORIUM',PRO:'PROJEKT',WYK:'WYKŁAD',CWI:'ĆWICZENIA',CW:'ĆWICZENIA',SEM:'SEMINARIUM'}[x]||String(t||'ZAJĘCIA').replaceAll('_',' '))}
const DAY_NAMES=['PONIEDZIAŁEK','WTOREK','ŚRODA','CZWARTEK','PIĄTEK'];
const DAY_BY_NUM={1:'PONIEDZIAŁEK',2:'WTOREK',3:'ŚRODA',4:'CZWARTEK',5:'PIĄTEK'};
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseDate(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)}
function currentMonday(){const now=new Date(),n=(now.getDay()+6)%7;const d=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);d.setDate(d.getDate()-n+state.weekOffset*7);return d}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function inRange(k,a,b){return k>=a&&k<=b}
function academicWeekInfo(k){if(!state.academic)return null;for(const w of (state.academic.weekSchedule?.standard||[]))if(inRange(k,w[0],w[1]))return {nr:w[2],parity:w[3]};return null}
function holidayName(k){return state.academic?.holidays?.find(x=>x[0]===k)?.[1]||null}
function universityFreeInfo(k){
 const ranges=state.academic?.universityFreeRanges||[];
 return ranges.find(r=>inRange(k,r.start,r.end))||null;
}
function replacementFor(k){return state.academic?.stationary?.events?.find(e=>e.date===k&&e.type==='replacement')||null}
function stationaryPeriodFor(k){const sc=state.academic?.stationary?.standard;return sc?.periods?.find(p=>inRange(k,p.start,p.end))||null}
function academicPeriodFor(k){const sc=state.academic?.stationary?.standard;return sc?.academicPeriods?.find(p=>inRange(k,p.start,p.end))||null}
function dayContext(date){
 const k=dateKey(date),holiday=holidayName(k),replacement=replacementFor(k),week=academicWeekInfo(k),period=stationaryPeriodFor(k),academicPeriod=academicPeriodFor(k),uniFree=universityFreeInfo(k);
 const free=state.mode==='ft'&&(!!holiday||!!uniFree||(!period&&!replacement));
 const specialLabel=state.academic?.specialFreeLabels?.[k];
 let freeLabel=specialLabel||holiday||uniFree?.label||academicPeriod?.label||(!period?'Poza okresem zajęć':'Dzień wolny od zajęć');
 return {key:k,date,holiday,replacement,week,period,academicPeriod,free,freeLabel};
}
function frequencyMatches(freq,parity){
 const f=norm(freq);
 if(!f||f==='CO_TYDZIEN')return true;
 if(f.includes('NIEPARZ'))return parity==='n'||parity==='n/p';
 if(f.includes('PARZ'))return parity==='p'||parity==='n/p';
 return true;
}
function parityLabel(p){return p==='p'?'parzysty':p==='n'?'nieparzysty':p==='n/p'?'mieszany':''}
function renderCalendar(){
 const start=8*60,end=22*60,scale=68/60,mon=currentMonday();
 let html='<div class="timecol"><div class="corner">#</div>';
 for(let h=8;h<=22;h++)html+=`<div class="time" style="top:${50+(h*60-start)*scale+4}px">${String(h).padStart(2,'0')}:00</div>`;
 html+='</div>';
 DAY_NAMES.forEach((displayDay,idx)=>{
   const ctx=dayContext(addDays(mon,idx));
   const effectiveDay=ctx.replacement?DAY_BY_NUM[ctx.replacement.replacement?.weekday]||displayDay:displayDay;
   const effectiveParity=ctx.replacement?.replacement?.parity||ctx.week?.parity||null;
   const dateShort=ctx.date.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'});
   let badge='';
   if(ctx.replacement)badge=`<span class="day-badge replacement-badge">${esc(ctx.replacement.detail||'Zamiana planu')}</span>`;
   else if(ctx.free)badge=`<span class="day-badge free-badge">${esc(ctx.freeLabel)}</span>`;
   else if(ctx.week)badge=`<span class="day-badge parity-badge">tydz. ${esc(ctx.week.nr)} · ${esc(parityLabel(ctx.week.parity))}</span>`;
   html+=`<div class="daycol${ctx.free?' free-day':''}${ctx.replacement?' replacement-day':''}" data-day="${displayDay}"><div class="day-date-label"><b>${displayDay}</b><span>${dateShort}</span>${badge}</div>`;
   if(ctx.free){html+=`<div class="free-day-overlay"><strong>WOLNE</strong><span>${esc(ctx.freeLabel)}</span></div></div>`;return}
   const events=state.events.filter(x=>x.day===effectiveDay&&frequencyMatches(x.frequency,effectiveParity));
   for(const e of events){
     let a=mins(e.hr_start,e.min_start),b=mins(e.hr_end,e.min_end);if(b<=start||a>=end)continue;
     const top=50+(Math.max(a,start)-start)*scale,height=(Math.min(b,end)-Math.max(a,start))*scale-2;
     const gids=e.groups_ids||[],lids=e.lecturers_ids||[];
     let lecturerHtml='';
     if(lids.length===1){const l=lecturerInfo(lids[0]);lecturerHtml=`<div class="lecturer-one">${esc(l.label)}</div>`}
     else if(lids.length===2)lecturerHtml=`<div class="lecturers-inline">${lids.map(id=>`<span>${esc(lecturerInfo(id).label)}</span>`).join('')}</div>`;
     else if(lids.length>2)lecturerHtml=`<div class="lecturer-summary"><strong>${lids.length}</strong> prowadzących · najedź</div><div class="hover-lecturers"><div class="lecturers-list"><div class="lecturers-label">Prowadzący (${lids.length})</div>${lids.map(id=>`<span>${esc(lecturerInfo(id).label)}</span>`).join('')}</div></div>`;
     let groupHtml='';
     if(gids.length===1){const g=groupInfo(gids[0]);groupHtml=`<div class="group-one" style="--fc:${g.color}" title="${esc(g.title)}">${esc(g.label)}</div>`}
     else if(gids.length>1)groupHtml=`<div class="group-summary"><strong>${gids.length}</strong> grup · najedź</div><div class="hover-groups"><div class="groups"><div class="groups-label">Grupy (${gids.length})</div>${gids.map(id=>{const g=groupInfo(id);return `<span style="--fc:${g.color}" title="${esc(g.title)}">${esc(g.label)}</span>`}).join('')}</div></div>`;
     const popUp=(top+height)>(50+(end-start)*scale-180)?' popover-up':'',hasMore=(gids.length>1||lids.length>2)?' has-more':'';
     html+=`<div class="event ${esc(e.type)}${hasMore}${popUp}" style="top:${top}px;height:${height}px;--event-h:${height}px"><div class="event-top"><span class="type-badge ${esc(e.type)}">${esc(typeLabel(e.type))}</span><span class="freq">${esc(freqLabel(e.frequency))}</span></div><div class="roomwrap"><span class="room">${esc(e.room||'')}</span></div><div class="name">${esc(e.name)}</div>${lecturerHtml}${groupHtml}</div>`;
   }
   if(ctx.replacement)html+=`<div class="replacement-note">${esc(ctx.replacement.detail||'Zamiana planu')}</div>`;
   html+='</div>';
 });
 $('#calendar').innerHTML=html;updateWeekHeader();
}
function updateWeekHeader(){
 const mon=currentMonday(),sun=addDays(mon,6),fmt=d=>d.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}),wk=academicWeekInfo(dateKey(mon));
 $('#weekRange').textContent=`${fmt(mon)} – ${fmt(sun)}`;
 const base=state.selected?`${state.selected.title||''} · ${state.events.length} unikalnych zajęć`:'wybierz prowadzącego, grupę lub salę';
 const w=wk?` · tydzień ${wk.nr} · ${parityLabel(wk.parity)}`:'';
 $('#weekMeta').textContent=base+w;
}
async function loadAcademicCalendar(){try{const r=await fetch('plan-calendar.json',{cache:'no-store'});if(!r.ok)throw new Error(r.status);state.academic=await r.json();renderCalendar()}catch(e){console.warn('Nie udało się wczytać plan-calendar.json',e);state.academic=null;renderCalendar()}}
$$('.tab').forEach(b=>b.onclick=()=>{ $$('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.tab=b.dataset.tab; state.selected=null; state.events=[]; $('#filters').dataset.active=''; $('#search').value=''; renderSelector(); renderCalendar(); });
$$('.mode').forEach(b=>b.onclick=async()=>{ if(state.mode===b.dataset.mode)return; $$('.mode').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.mode=b.dataset.mode; state.selected=null; state.events=[]; state.weekOffset=0; $('#filters').dataset.active=''; $('#search').value=''; renderCalendar(); await loadLists(); });
$('#search').oninput=renderSelector;$('#filters').onclick=e=>{const b=e.target.closest('[data-f]');if(!b)return;$('#filters').dataset.active=b.dataset.f;renderSelector()};$('#items').onclick=e=>{const star=e.target.closest('[data-fav]');if(star){e.stopPropagation();toggleFavorite(state.tab,star.dataset.id,star.dataset.label);return}const el=e.target.closest('.item, .group-item');if(el)selectItem(el.dataset.id)};$('#favoritesToggle').onclick=()=>{state.favoritesOnly=!state.favoritesOnly;renderSelector()};$('#prevWeek').onclick=()=>{state.weekOffset--;renderCalendar()};$('#nextWeek').onclick=()=>{state.weekOffset++;renderCalendar()};
updateFavoritesUI();renderCalendar();loadAcademicCalendar();loadLists();
