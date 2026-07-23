// ════════════════════════════════════════════════════════════
// FLETERA DEMO — standalone dispatcher (no backend, no deps)
// Clean rewrite: full i18n, theme-safe, all buttons working.
// ════════════════════════════════════════════════════════════
var React = window.React; var ReactDOM = window.ReactDOM;
const {useState,useEffect,useMemo,useRef} = React;
const ce = React.createElement;

// ── Language (global, simple) ─────────────────────────────────
window._lang = window._lang || 'ru';
const setLangGlobal = (l)=>{ window._lang = l; };

// ── Date helpers ──────────────────────────────────────────────
const now   = () => new Date();
const nowLocalISO = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
const today = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const addH  = (dt,h) => { let b=new Date(dt); if(isNaN(b.getTime())) b=new Date(); const d=new Date(b.getTime()+h*3600000); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
const fmtDT = s => { if(!s) return '—'; const d=new Date(s); if(isNaN(d.getTime())) return '—'; const loc=window._lang==='en'?'en-GB':'ru'; return d.toLocaleDateString(loc,{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString(loc,{hour:'2-digit',minute:'2-digit'}); };
const fmtD = s => { if(!s) return '—'; const d=new Date(s); if(isNaN(d.getTime())) return '—'; const loc=window._lang==='en'?'en-GB':'ru'; return d.toLocaleDateString(loc,{day:'2-digit',month:'2-digit',year:'numeric'}); };
const addDaysISO = (s,days) => { const d=new Date(s); if(isNaN(d.getTime())) return ''; d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
// ── Механик: пороги ТО/шин/дат ──
const TO_TRACTOR_KM=100000, TO_TRACTOR_WARN_KM=12000;
const TO_TRAILER_KM=55000, TO_TRAILER_WARN_KM=8000;
const TIRE_STEER_KM=210000, TIRE_DRIVE_KM=275000, TIRE_TRAILER_KM=275000, TIRE_WARN_KM=20000;
const UNIT_SERVICE_DAYS=182, UNIT_FULL_SERVICE_DAYS=365, DATE_WARN_DAYS=30;
const UNIT_TYPES=['Thermo King','Carrier','Другая'];
// ── Кадры: пороги ──
const WORK_AMBER_DAYS=25, WORK_RED_DAYS=30;
const WAYBILL_AMBER=3, WAYBILL_RED=4;
function dayKey(dt){ return dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate(); }
function elapsedDays(d){
  if(!d||!d.workStart) return null;
  var t=new Date(d.workStart); if(isNaN(t.getTime())) return null;
  t.setHours(12,0,0,0); var n=new Date(); n.setHours(12,0,0,0);
  var e=Math.floor((n.getTime()-t.getTime())/86400000)+1;
  return e<0?null:e;
}
// Множество нерабочих дней: выходные из карточки + периоды из календаря (объединение — без двойного вычета)
function offDaySet(d,vacations,fromISO,toISO){
  var set={}, lo=dOnly(fromISO), hi=dOnly(toISO);
  if(lo==null||hi==null) return set;
  var addRange=function(a,b){
    var s=dOnly(a), e=dOnly(b); if(s==null||e==null) return;
    if(e<lo||s>hi) return;
    var cur=new Date(Math.max(s,lo)); cur.setHours(12,0,0,0);
    var end=new Date(Math.min(e,hi)); end.setHours(12,0,0,0);
    while(cur.getTime()<=end.getTime()){ set[dayKey(cur)]=1; cur.setDate(cur.getDate()+1); }
  };
  ((d&&d.daysOff)||[]).forEach(function(o){ if(o&&o.from&&o.to) addRange(o.from,o.to); });
  (vacations||[]).forEach(function(v){ if(v&&d&&v.driverName===d.name&&v.from&&v.to) addRange(v.from,v.to); });
  return set;
}
function offDaysCount(d,vacations,fromISO,toISO){ return Object.keys(offDaySet(d,vacations,fromISO,toISO)).length; }
function isOffToday(d,vacations){ return !!offDaySet(d,vacations,today(),today())[dayKey(new Date())]; }
function workedDays(d,vacations){
  var e=elapsedDays(d); if(e==null) return null;
  return Math.max(0, e - offDaysCount(d,vacations,d.workStart,today()));
}
function workStatus(days){
  if(days==null) return {st:'unknown',label:'—',color:'var(--text3)'};
  if(days>=WORK_RED_DAYS) return {st:'red',label:days+' дн. подряд',color:'var(--red)'};
  if(days>=WORK_AMBER_DAYS) return {st:'amber',label:days+' дн. подряд',color:'var(--amber)'};
  return {st:'green',label:days+' дн.',color:'var(--green)'};
}
function waybillStatus(trips){
  var n=Number(trips); if(isNaN(n)) n=0;
  if(n>=WAYBILL_RED) return {st:'red',label:n+' рейса — менять',color:'var(--red)'};
  if(n>=WAYBILL_AMBER) return {st:'amber',label:n+' рейса',color:'var(--amber)'};
  return {st:'green',label:n+' рейса',color:'var(--green)'};
}
function dOnly(s){ var d=new Date(s); if(isNaN(d.getTime())) return null; d.setHours(0,0,0,0); return d.getTime(); }
function overlapDays(a,b){ var a1=dOnly(a.from),a2=dOnly(a.to),b1=dOnly(b.from),b2=dOnly(b.to);
  if(a1==null||a2==null||b1==null||b2==null) return false; return a1<=b2 && b1<=a2; }
function daysUntil(s){ if(!s) return null; const d=new Date(s); if(isNaN(d.getTime())) return null; return Math.ceil((d.getTime()-Date.now())/86400000); }
function dateStatus(s){ var d=daysUntil(s); if(d==null) return {st:'unknown',label:'нет данных',color:'var(--text3)'};
  if(d<0) return {st:'red',label:'просрочено '+Math.abs(d)+' дн.',color:'var(--red)'};
  if(d<=DATE_WARN_DAYS) return {st:'amber',label:'через '+d+' дн.',color:'var(--amber)'};
  return {st:'green',label:'до '+fmtD(s),color:'var(--green)'};
}
function kmStatus(cur,last,interval,warn){
  if(cur==null||cur===''||last==null||last===''||isNaN(Number(cur))||isNaN(Number(last))) return {st:'unknown',label:'нет данных',color:'var(--text3)',left:null};
  var used=Number(cur)-Number(last), left=interval-used;
  if(left<=0) return {st:'red',label:'просрочено на '+Math.round(-left/1000)+' тыс.км',color:'var(--red)',left:left};
  if(left<=warn) return {st:'amber',label:'осталось '+Math.round(left/1000)+' тыс.км',color:'var(--amber)',left:left};
  return {st:'green',label:'осталось '+Math.round(left/1000)+' тыс.км',color:'var(--green)',left:left};
}
var HOMOGLYPH={'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','Y':'У','I':'І'};
function normPlate(s){ if(!s) return ''; var x=String(s).toUpperCase(); x=x.replace(/[-–—]\s*\d\s*$/,'');
  x=x.replace(/[^А-ЯЁA-Z0-9]/g,'');
  return x.replace(/[A-Z]/g,function(ch){ return HOMOGLYPH[ch]||ch; }); }
function parseKmNum(s){ if(s==null) return null; var x=String(s).replace(/\s/g,''); if(!x) return null;
  if(/^\d{1,3}([.,]\d{3})+$/.test(x)) x=x.replace(/[.,]/g,''); else x=x.replace(/,/g,'.');
  var n=parseFloat(x); return isNaN(n)?null:Math.round(n); }
function parseMileagePaste(text){
  var rows=[];
  String(text||'').split(/\r?\n/).forEach(function(raw){
    var line=raw.trim(); if(!line) return;
    var pm=line.match(/([А-ЯЁA-Z]{2})\s*[-]?\s*(\d{4})/i);
    if(!pm){ rows.push({raw:line,plate:null,km:null}); return; }
    var plate=normPlate(pm[1]+pm[2]);
    var rest=line.slice(0,pm.index)+' '+line.slice(pm.index+pm[0].length);
    rest=rest.replace(/[-–—]\s*\d\s*(?![\d])/g,' ');
    var nums=rest.match(/\d[\d\s.,]*\d|\d+/g)||[];
    var best=null;
    nums.forEach(function(t){ var n=parseKmNum(t); if(n!=null&&(best==null||n>best)) best=n; });
    rows.push({raw:line,plate:plate,km:best});
  });
  return rows;
}
function matchMileageRows(rows,tractors){
  var byPlate={}; (tractors||[]).forEach(function(t){ byPlate[normPlate(t.plate)]=t; });
  var matched=[],unmatched=[];
  rows.forEach(function(r){
    if(!r.plate||r.km==null){ unmatched.push(r); return; }
    var t=byPlate[r.plate];
    if(t) matched.push({id:t.id,plate:t.plate,km:r.km,old:t.odometer,raw:r.raw}); else unmatched.push(r);
  });
  return {matched:matched,unmatched:unmatched};
}
function MileagePasteModal({tractors,onApply,onCreate,onClose}){
  const [txt,setTxt]=useState('');
  const res=matchMileageRows(parseMileagePaste(txt),tractors);
  const m=res.matched, u=res.unmatched;
  const creatable=u.filter(function(x){ return x.plate&&x.km!=null; });
  const junk=u.filter(function(x){ return !(x.plate&&x.km!=null); });
  return ce(Modal,{title:'📋 Массовая вставка пробегов',onClose,wide:true},
    ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:9,lineHeight:1.6}},
      'Скопируйте пробеги из программы геолокации (или из Excel) и вставьте сюда — по одной машине в строке. Понимает форматы: «АТ 4774  1147593», «ДАФ р.н. АТ 4774 - 7   1.147.593», обратный порядок «1147593  АТ 4774», а также номера латиницей (AT 4774).'),
    ce('textarea',{value:txt,onChange:function(e){setTxt(e.target.value);},rows:8,placeholder:'АТ 4774\t1147593\nАТ 7777\t962243\n…',
      style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:11,color:'var(--text)',fontSize:13,fontFamily:'monospace',lineHeight:1.5,resize:'vertical'}}),
    txt.trim()?ce('div',{style:{marginTop:12}},
      ce('div',{style:{display:'flex',gap:14,fontSize:12.5,fontWeight:800,marginBottom:8,flexWrap:'wrap'}},
        ce('span',{style:{color:'var(--green)'}},'Совпало: '+m.length),
        ce('span',{style:{color:creatable.length?'var(--cyan)':'var(--text3)'}},'Нет карточки: '+creatable.length),
        ce('span',{style:{color:junk.length?'var(--amber)':'var(--text3)'}},'Не распознано: '+junk.length)),
      m.length?ce('div',{style:{maxHeight:170,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10,marginBottom:8}},
        m.map(function(x,i){ var diff=(x.old!=null&&x.old!==''&&!isNaN(Number(x.old)))?(x.km-Number(x.old)):null;
          return ce('div',{key:i,style:{display:'flex',alignItems:'center',gap:10,padding:'7px 11px',fontSize:12.5,
            borderBottom:i<m.length-1?'1px solid var(--border)':'none'}},
            ce('span',{style:{fontWeight:800,minWidth:90}},x.plate),
            ce('span',{style:{color:'var(--text3)'}},(x.old||'—')+' →'),
            ce('span',{style:{fontWeight:800,color:'var(--green)'}},x.km),
            (diff!=null&&diff<0)?ce('span',{style:{marginLeft:'auto',color:'var(--amber)',fontWeight:700,fontSize:11.5}},'⚠ меньше прежнего'):null); })):null,
      creatable.length?ce('div',{style:{padding:'9px 11px',borderRadius:10,marginBottom:8,fontSize:12,lineHeight:1.6,
        background:'color-mix(in srgb,var(--cyan) 10%,transparent)',border:'1px solid color-mix(in srgb,var(--cyan) 30%,transparent)',color:'var(--text2)'}},
        'Этих тягачей ещё нет в списке механика: '+creatable.map(function(x){return x.plate;}).join(', ')+'. Можно создать карточки сразу с этими пробегами.'):null,
      junk.length?ce('div',{style:{maxHeight:90,overflowY:'auto',fontSize:11.5,color:'var(--text3)',lineHeight:1.6}},
        junk.map(function(x,i){ return ce('div',{key:i},'• '+x.raw+'  (номер не распознан)'); })):null):null,
    ce('div',{style:{display:'flex',gap:9,marginTop:14,flexWrap:'wrap'}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},'Отмена'),
      creatable.length?ce('button',{onClick:function(){ onCreate(creatable.map(function(x){return {plate:x.plate,km:x.km};})); onClose(); },className:'fl-press',
        style:{flex:1,padding:'12px',border:'1px solid color-mix(in srgb,var(--cyan) 50%,transparent)',borderRadius:11,color:'var(--cyan)',fontSize:13.5,fontWeight:800,cursor:'pointer',
          background:'color-mix(in srgb,var(--cyan) 12%,transparent)',fontFamily:'inherit'}},'➕ Создать карточки ('+creatable.length+')'):null,
      ce('button',{onClick:function(){ if(m.length){ onApply(m); onClose(); } },disabled:!m.length,className:'fl-press',
        style:{flex:1,padding:'12px',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:m.length?'pointer':'default',
          background:m.length?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--bg3)',opacity:m.length?1:0.5}},
        'Обновить пробеги ('+m.length+')')));
}
/* Совместимость: старое общее поле tireMileage считаем 1-й осью, пока ось не заполнена явно */
function axleVal(tr,n){
  if(!tr) return '';
  var v=tr['tireAxle'+n];
  if(v!=null && v!=='') return v;
  if(n===1 && tr.tireMileage!=null && tr.tireMileage!=='') return tr.tireMileage;
  return '';
}
function tireStatus(cur,last,interval,warn){
  var s=kmStatus(cur,last,interval,warn);
  if(s.st==='unknown') return s;
  var used=Number(cur)-Number(last);
  if(used<0) return {st:'amber',label:'проверьте пробег',color:'var(--amber)',left:s.left,used:used};
  return {st:s.st,label:'прошла '+Math.round(used/1000)+' тыс.км',color:s.color,left:s.left,used:used};
}
function CapOdometerModal({tractors,onApply,onClose}){
  const [state,setState]=useState({loading:true,err:'',rows:null});
  useEffect(function(){
    capFetch('odometer').then(function(r){
      if(!r.ok){ setState({loading:false,err:r.err||'нет ответа',rows:null}); return; }
      var data=(r.val&&(r.val.data||r.val))||[];
      setState({loading:false,err:Array.isArray(data)?'':'неожиданный формат',rows:Array.isArray(data)?data:null});
    });
  },[]);
  const byPlate={}, byDigits={};
  (tractors||[]).forEach(function(t){ var n=capNorm(t.plate); if(n){ byPlate[n]=t; var d=(String(t.plate||'').match(/\d{4}/)||[])[0]; if(d&&!byDigits[d]) byDigits[d]=t; } });
  const matched=[],zero=[],nocard=[];
  (state.rows||[]).forEach(function(r){
    var p=capParseName(r.name||'');
    if(p.kind!=='tractor') return;                        // прицепы одометра не имеют
    var km=Number(String(r.odometer_km==null?'':r.odometer_km).replace(',','.'));  // бывает строкой
    if(!isFinite(km)||km<=0){ zero.push({plate:p.plate,raw:r.name}); return; }     // 0 = нет данных, НЕ пишем
    var t=byPlate[p.plate]||byDigits[p.digits];
    if(!t){ nocard.push({plate:p.plate,km:Math.round(km),raw:r.name}); return; }
    var old=Number(t.odometer);
    matched.push({id:t.id,plate:t.plate,km:Math.round(km),old:isFinite(old)?old:null,at:r.measured_at});
  });
  const back=matched.filter(function(m){ return m.old!=null&&m.km<m.old; });
  return ce(Modal,{title:'📡 Пробеги из CapNavi',onClose,wide:true},
    state.loading?ce('div',{style:{padding:'26px 4px',color:'var(--text3)',fontSize:13}},'Запрашиваю данные…'):
    state.err?ce('div',{style:{background:'color-mix(in srgb,var(--red) 12%,transparent)',border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',
      borderRadius:11,padding:'12px 14px',color:'var(--red)',fontSize:12.5,fontWeight:700,lineHeight:1.5}},'⚠ '+state.err):
    ce('div',null,
      ce('div',{style:{display:'flex',gap:14,fontSize:12.5,fontWeight:800,marginBottom:10,flexWrap:'wrap'}},
        ce('span',{style:{color:'var(--green)'}},'Обновим: '+matched.length),
        ce('span',{style:{color:zero.length?'var(--text3)':'var(--text3)'}},'Без показаний: '+zero.length),
        ce('span',{style:{color:nocard.length?'var(--cyan)':'var(--text3)'}},'Нет карточки: '+nocard.length)),
      back.length?ce('div',{style:{padding:'9px 12px',borderRadius:10,marginBottom:10,fontSize:12,lineHeight:1.5,
        background:'color-mix(in srgb,var(--amber) 12%,transparent)',border:'1px solid color-mix(in srgb,var(--amber) 40%,transparent)',color:'var(--amber)'}},
        '⚠ У '+back.length+' машин новый пробег МЕНЬШЕ прежнего ('+back.map(function(m){return m.plate;}).join(', ')+'). Проверьте перед применением.'):null,
      matched.length?ce('div',{style:{maxHeight:240,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10,marginBottom:10}},
        matched.map(function(m,i){ var less=m.old!=null&&m.km<m.old;
          return ce('div',{key:i,style:{display:'flex',alignItems:'center',gap:10,padding:'7px 11px',fontSize:12.5,
            borderBottom:i<matched.length-1?'1px solid var(--border)':'none'}},
            ce('span',{style:{fontWeight:800,minWidth:100}},m.plate),
            ce('span',{style:{color:'var(--text3)'}},(m.old!=null?m.old:'—')+' →'),
            ce('span',{style:{fontWeight:800,color:less?'var(--amber)':'var(--green)'}},m.km),
            m.old!=null&&m.km>m.old?ce('span',{style:{color:'var(--text3)',fontSize:11}},'+'+(m.km-m.old)+' км'):null,
            less?ce('span',{style:{marginLeft:'auto',color:'var(--amber)',fontWeight:700,fontSize:11.5}},'⚠ меньше прежнего'):null); })):
        ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'10px 2px'}},'Нечего обновлять.'),
      zero.length?ce('div',{style:{fontSize:11.5,color:'var(--text3)',lineHeight:1.6,marginBottom:8}},
        'Без показаний (пропускаем, старые данные не трогаем): '+zero.map(function(z){return z.plate;}).join(', ')):null,
      nocard.length?ce('div',{style:{fontSize:11.5,color:'var(--text3)',lineHeight:1.6}},
        'Нет карточки у механика: '+nocard.map(function(z){return z.plate+' ('+z.km+')';}).join(', ')):null),
    ce('div',{style:{display:'flex',gap:9,marginTop:14}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},'Отмена'),
      ce('button',{onClick:function(){ if(matched.length){ onApply(matched); onClose(); } },disabled:!matched.length,className:'fl-press',
        style:{flex:1,padding:'12px',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:matched.length?'pointer':'default',
          background:matched.length?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--bg3)',opacity:matched.length?1:0.5}},
        'Обновить пробеги ('+matched.length+')')));
}
function StatusPill({s,label}){ var s2=s||{st:'unknown',label:'нет данных',color:'var(--text3)'};
  return ce('div',{style:{display:'flex',flexDirection:'column',gap:2,minWidth:0}},
    label?ce('div',{style:{fontSize:10,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.3px'}},label):null,
    ce('div',{style:{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',borderRadius:8,width:'fit-content',
      background:'color-mix(in srgb,'+s2.color+' 14%,transparent)',border:'1px solid color-mix(in srgb,'+s2.color+' 35%,transparent)'}},
      ce('span',{style:{width:7,height:7,borderRadius:7,background:s2.color,flexShrink:0}}),
      ce('span',{style:{fontSize:11.5,fontWeight:800,color:s2.color,whiteSpace:'nowrap'}},s2.label)));
}
const uid   = () => Math.floor(Date.now()/1000) + Math.floor(Math.random()*1000);
const maxId = (arr) => arr.length ? Math.max.apply(null, arr.map(x=>Number(x.id)||0)) : 0;

// ── Status keys ───────────────────────────────────────────────
const MOVING = ['FORWARD','LOADED','BACK','AT_LOAD','ARRIVED_LOAD','LOADING','AT_UNLOAD','ARRIVED_UNLOAD','UNLOADED','BACK_GO'];
// ── Roles / logists ───────────────────────────────────────────
const LOGIST_PALETTE = ['#f59e0b','#a78bfa','#22d3ee','#34d399','#f43f5e','#60a5fa','#fbbf24','#ec4899','#10b981','#c084fc'];
const DEFAULT_LOGISTS = [{name:'Анна',color:'#f59e0b'},{name:'Милана',color:'#a78bfa'},{name:'Кристина',color:'#22d3ee'}];
let LOGISTS = DEFAULT_LOGISTS.map(function(l){return l.name;});
let LOGIST_COLOR = (function(){ var m={}; DEFAULT_LOGISTS.forEach(function(l){ m[l.name]=l.color; }); return m; })();
let ROLES = LOGISTS.concat(['Механик','Кадры','Руководитель']);
function normLogists(x){ var a = Array.isArray(x)?x:(x&&typeof x==='object'?Object.keys(x).map(function(k){return x[k];}):null); if(!a) return null; a=a.filter(function(l){return l&&l.name;}).map(function(l,i){ return {name:String(l.name),color:l.color||LOGIST_PALETTE[i%LOGIST_PALETTE.length]}; }); return a; }
function applyLogists(list){ var a=normLogists(list); if(!a||!a.length) return; LOGISTS=a.map(function(l){return l.name;}); LOGIST_COLOR={}; a.forEach(function(l){ LOGIST_COLOR[l.name]=l.color; }); ROLES=LOGISTS.concat(['Механик','Кадры','Руководитель']); }
const DEFAULT_TPL_FWD = `🚛 Рейс
🏢 Клиент: {client}
📍 Загрузка: {loadAddr}
🎯 Выгрузка: {unloadAddr}
🕐 Загрузка: {loadTime}
🌡 {temp}
📝 {note}`;
const DEFAULT_TPL_BACK = `↩ ОБРАТНЫЙ ГРУЗ
📦 {cargo}
📍 Загрузка: {backFrom}
🎯 Выгрузка: {backTo}
🕐 Отправление: {departAt}
📝 {backNote}`;
function stripMoney(s){
  if(!s) return s;
  var NL=String.fromCharCode(10);
  var out=String(s).split(NL).map(function(ln){
    var L=ln;
    L=L.replace(/(?:ставк|тариф|прайс|стоимост|цен[ауыео]|оплат|сумм)[а-яё]*[^\d\n]{0,8}\d[\d\s.,]*\s*(?:руб(?:\.|лей|ля)?|₽|byn|rub|бел[\s.]*руб)?(?![а-яёa-zА-ЯЁA-Z])/gi,'');
    L=L.replace(/\d[\d\s.,]*\s*(?:руб(?:\.|лей|ля)?|₽|byn|rub|бел[\s.]*руб)(?![а-яёa-zА-ЯЁA-Z])/gi,'');
    L=L.replace(/\s*₽/g,'');
    L=L.replace(/[ \t]{2,}/g,' ').replace(/^[ \t]*[,;:\-—=]+[ \t]*/,'').replace(/[ \t]+([,;.])/g,'$1').replace(/[ \t]+$/,'');
    return L;
  }).filter(function(l){ return l.trim()!==''; }).join(NL);
  return out.trim();
}
function getTpl(settings,kind){ var t=settings&&settings.driverTpl; if(t&&t[kind]) return t[kind]; return kind==='back'?DEFAULT_TPL_BACK:DEFAULT_TPL_FWD; }
function applyTpl(tpl,v){
  var NL=String.fromCharCode(10);
  var lines=String(tpl||'').split(NL), out=[];
  lines.forEach(function(ln){
    var hadPh=ln.indexOf('{')>=0;
    var filled=ln;
    for(var k in v){ filled=filled.split('{'+k+'}').join(v[k]!=null?String(v[k]):''); }
    if(hadPh){
      var t=filled.replace(/\s+$/,'');
      if(t===''||t.charAt(t.length-1)===':') return;
      if(!/[0-9A-Za-zА-Яа-яЁё]/.test(t)) return;
    }
    out.push(filled);
  });
  return out.join(NL).trim();
}
const SC = { FREE:'var(--green)',FORWARD:'var(--accent)',LOADED:'var(--green)',BACK:'var(--cyan)',
  AT_LOAD:'var(--amber)',ARRIVED_LOAD:'var(--amber)',LOADING:'var(--amber)',
  AT_UNLOAD:'var(--violet)',ARRIVED_UNLOAD:'var(--violet)',UNLOADED:'var(--green)',BACK_GO:'var(--cyan)',
  SERVICE:'var(--orange)',WASH:'var(--cyan)',DOCS:'var(--orange)',PROBLEM:'var(--red)',NEED_SERVICE:'var(--red)' };
// Raw hex (for places where a real color value is needed, e.g. alpha blends)
const SCHEX = { FREE:'#34d399',FORWARD:'#4f8cff',LOADED:'#34d399',BACK:'#22d3ee',
  AT_LOAD:'#fbbf24',ARRIVED_LOAD:'#fbbf24',LOADING:'#fbbf24',
  AT_UNLOAD:'#a78bfa',ARRIVED_UNLOAD:'#a78bfa',UNLOADED:'#34d399',BACK_GO:'#22d3ee',
  SERVICE:'#fb923c',WASH:'#22d3ee',DOCS:'#fb923c',PROBLEM:'#f87171',NEED_SERVICE:'#f87171' };

// ── Full i18n dictionary ──────────────────────────────────────
const STR = {
  ru:{
    app_name:'Fletera', app_sub:'Демо диспетчерской',
    tab_park:'Парк', tab_moving:'Рейсы', tab_clients:'Клиенты', tab_orders:'Заказы', tab_plan:'Планирование', tab_log:'Журнал',
    hdr_free:'свободны', hdr_route:'в рейсе', hdr_issues:'проблемы', unit_trucks:'ТС',
    btn_driver:'Режим водителя', th_dark:'Тёмная', th_light:'Светлая',
    flt_all:'Все', flt_free:'Свободные', flt_moving:'В рейсе', flt_back:'Обратный', flt_problem:'Проблема', flt_service:'Сервис', flt_need:'Нужен сервис', flt_docs:'Путевой',
    search_ph:'Номер или водитель…', add_truck:'+ Машина',
    none_found:'Ничего не найдено',
    lbl_location:'Локация', lbl_free_in:'Освободится', lbl_waybill:'Рейсов', lbl_client:'Клиент',
    lbl_cargo_to:'Везёт туда', lbl_cargo_back:'Обратный груз', lbl_loading:'Загрузка', lbl_unloading:'Выгрузка',
    lbl_hired:'Привлечённая', lbl_route_h:'Рейс', lbl_will_unload:'выгрузит',
    on_service:'На сервисе', need_service:'Нужен сервис',
    now_word:'сейчас', trips_word:'рейс.',
    btn_to_route:'В рейс', btn_edit_route:'Рейс / клиент', btn_return:'Обратный', btn_msg:'Сообщение',
    btn_link:'Ссылка', btn_swap:'Пересадка', btn_free:'Свободна', btn_waybill:'Путевой',
    btn_remove_back:'Снять обратку', btn_cancel:'Отмена', btn_save:'Сохранить', btn_save_changes:'Сохранить изменения',
    btn_delete:'Удалить', btn_back:'Назад', btn_close:'Закрыть', btn_add:'Добавить', btn_assign:'Назначить',
    moving_title:'Машины в рейсе', moving_sub:'Все машины, кроме свободных и стоящих на сервисе.',
    moving_found:'Найдено', moving_empty:'Нет машин в рейсе',
    blk_loading:'Загрузка', blk_back:'Обратка', blk_what_to:'Что везёт туда', blk_what_back:'Какая обратка',
    back_assigned:'Обратный груз назначен', depart_word:'Отправление',
    advice:'Совет', advice_soon:'Освободится через ~{h} ч — пора искать обратный груз.',
    advice_later:'В рейсе, освободится через ~{h} ч.', advice_active:'Активный рейс.',
    clients_title:'Клиенты', add_client:'+ Клиент', cl_active:'В рейсе', cl_assign_truck:'Назначить машину', cl_edit:'Изменить',
    orders_title:'Заказы', add_order:'+ Заказ', ord_need_truck:'Нужна машина', ord_assigned:'Назначена',
    ord_ai:'Рекомендуемые машины', ord_take:'Взять', ord_assign:'Назначить',
    plan_title:'Планирование рейсов', add_plan:'+ Запланировать', plan_empty:'Нет запланированных рейсов',
    note_for_driver:'Примечание для водителя',
    log_title:'Журнал рейсов', log_total:'Всего рейсов: {n} · Водителей: {d}', log_empty:'Журнал пуст',
    log_trips:'рейс.', dir_back:'Обратно', dir_to:'',
    m_route:'Рейс', m_back_title:'Обратный груз', m_order_new:'Новый заказ', m_order_edit:'Изменить заказ',
    m_client_new:'Новый клиент', m_client_edit:'Изменить клиента', m_plan:'Планирование рейса',
    m_swap:'Пересадка водителя', m_truck_new:'Новая машина', m_assign_truck:'Назначить машину', m_assign_for:'Машина для',
    dir_forward_btn:'→ Туда', dir_back_btn:'← Обратно',
    from_city:'Откуда выезжает', be_at_load:'Быть на загрузке к', load_hours:'Время загрузки (часов)',
    calc:'Расчёт доставки', calc_depart:'Выезд из', calc_load:'Загрузка', calc_load_end:'Конец загрузки',
    calc_unload:'Выгрузка', calc_free:'Машина свободна',
    load_addr:'Адрес загрузки', unload_addr:'Адрес выгрузки', add_point:'+ Добавить точку загрузки',
    point_word:'Точка', join_back:'Сразу добавить обратный рейс', save_points:'Сохранить ({n} точки)', save_arrow:'Сохранить →',
    mode_order:'Из заказа', mode_manual:'Вручную', no_avail_orders:'Нет свободных заказов. Добавьте их во вкладке «Заказы».',
    cargo:'Груз', from_short:'Откуда', to_short:'Куда', from_city_ph:'Город загрузки', to_city_ph:'Город выгрузки',
    depart_date:'Дата отправления', travel_h:'Время в пути (ч)', save_back:'Сохранить обратку',
    plate:'Номер', driver:'Водитель', phone:'Телефон', type_word:'Тип', t_own:'Своя', t_hired:'Привлечённая', carrier:'Перевозчик',
    fill_fields:'Заполните поля',
    choose_client:'Выбрать клиента', new_client:'+ Новый клиент', new_client_name:'Название нового клиента', new_client_city:'Город / точка загрузки',
    client_word:'Клиент', count_trucks:'Кол-во машин', rate_rub:'Ставка (руб)', temp_mode:'Темп. режим',
    cargo_ph:'Что везём?', note_ph:'Контакты склада, время работы, особые условия…',
    enter_cargo:'Укажите груз',
    client_name:'Название клиента', client_color:'Цвет клиента', city_load:'Город загрузки', city_unload:'Город выгрузки',
    route_time_h:'Время рейса (ч)', note_for_drivers:'Примечание для водителей',
    enter_name:'Введите название', add_client_ok:'Добавить клиента ✓',
    plan_date:'Планируемая дата загрузки', note_opt:'Примечание (необязательно)',
    ai_pick:'Подбор машины под', ai_none:'Нет доступных машин', ai_free:'свободна', ai_free_in:'освободится ~{h} ч', ai_near:'рядом с загрузкой', ai_choose:'Выбрать',
    swap_now:'Сейчас', swap_to:'На какую машину пересадить водителя', swap_choose:'Выберите машину', swap_in_route:'в рейсе',
    swap_will:'Водители поменяются местами:', swap_pin:'PIN/код водителя перейдёт вместе с водителем.', swap_do:'Поменять водителей',
    msg_to:'для водителя', msg_forward:'Загрузка туда', msg_back:'Обратный груз',
    note_block:'Примечание для водителя:', open_wa:'Открыть в WhatsApp', send_tg:'Telegram',
    link_title:'Ссылка для отметки статуса', link_copy:'Скопировать', link_open:'Открыть', link_wa:'Ссылка в WhatsApp', link_tg:'Ссылка в Telegram',
    drv_route:'Текущий рейс', grp_load:'Загрузка', grp_unload:'Выгрузка', grp_back:'Обратный груз', grp_problem:'Проблемы',
    s_AT_LOAD:'Выехал на загрузку', s_AT_LOAD_d:'Еду к месту загрузки',
    s_ARRIVED_LOAD:'Приехал на загрузку', s_ARRIVED_LOAD_d:'На месте, жду загрузку',
    s_LOADING:'Начали загружать', s_LOADING_d:'Идёт погрузка',
    s_LOADED:'Загрузился', s_LOADED_d:'Загрузка завершена, выезжаю',
    s_AT_UNLOAD:'Выехал на выгрузку', s_AT_UNLOAD_d:'Груз в машине, еду на точку',
    s_ARRIVED_UNLOAD:'Приехал на выгрузку', s_ARRIVED_UNLOAD_d:'На месте выгрузки',
    s_UNLOADED:'Выгрузился', s_UNLOADED_d:'Выгрузка завершена',
    s_BACK_GO:'Выехал за обраткой', s_BACK_GO_d:'Еду на точку загрузки обратки',
    s_BACK:'Загрузил обратный груз', s_BACK_d:'Обратка на борту, выезжаю',
    s_FREE:'Выгрузил обратный груз', s_FREE_d:'Обратка сдана, свободен',
    s_PROBLEM:'Есть проблема!', s_PROBLEM_d:'Авария, поломка, задержка',
    auth_title:'Fletera', auth_sub:'Демо диспетчерской системы', auth_pw:'Пароль', auth_login:'Войти →',
    auth_hint_a:'Пароль:', auth_hint_b:'— нажмите, чтобы вставить', auth_err:'Неверный пароль',
    drv_pin_prompt:'PIN водителя:', drv_pin_bad:'PIN не найден',
    saved:'✓ Сохранено', t_client_upd:'✓ Клиент обновлён', t_client_add:'✓ Клиент добавлен',
    t_order_upd:'✓ Заказ обновлён', t_order_add:'✓ Заказ добавлен', t_truck_add:'✓ Машина добавлена',
    t_planned:'✓ Запланировано', t_swap_done:'✓ Пересадка выполнена', t_assigned:'✓ Машина назначена',
    confirm_del_order:'Удалить заказ?', confirm_del_plan:'Удалить план?',
    st_FREE:'Свободна', st_FORWARD:'В рейсе', st_LOADED:'Загружен', st_BACK:'Обратный',
    st_AT_LOAD:'Едет на загрузку', st_ARRIVED_LOAD:'На загрузке', st_LOADING:'Грузится',
    st_AT_UNLOAD:'Едет на выгрузку', st_ARRIVED_UNLOAD:'На выгрузке', st_UNLOADED:'Выгрузился',
    st_BACK_GO:'За обраткой', st_SERVICE:'Сервис', st_WASH:'Мойка', st_DOCS:'Путевой',
    st_PROBLEM:'Проблема', st_NEED_SERVICE:'Нужен сервис',
    cur_rub:'₽',
  },
  en:{
    app_name:'Fletera', app_sub:'Dispatch demo',
    tab_park:'Fleet', tab_moving:'On route', tab_clients:'Clients', tab_orders:'Orders', tab_plan:'Planning', tab_log:'Log',
    hdr_free:'free', hdr_route:'on route', hdr_issues:'issues', unit_trucks:'units',
    btn_driver:'Driver mode', th_dark:'Dark', th_light:'Light',
    flt_all:'All', flt_free:'Free', flt_moving:'On route', flt_back:'Return', flt_problem:'Problem', flt_service:'Service', flt_need:'Needs service', flt_docs:'Waybill',
    search_ph:'Plate or driver…', add_truck:'+ Truck',
    none_found:'Nothing found',
    lbl_location:'Location', lbl_free_in:'Free in', lbl_waybill:'Trips', lbl_client:'Client',
    lbl_cargo_to:'Outbound', lbl_cargo_back:'Return cargo', lbl_loading:'Loading', lbl_unloading:'Unloading',
    lbl_hired:'Contracted', lbl_route_h:'Route', lbl_will_unload:'unloads',
    on_service:'On service', need_service:'Needs service',
    now_word:'now', trips_word:'trips',
    btn_to_route:'Assign', btn_edit_route:'Route / client', btn_return:'Return', btn_msg:'Message',
    btn_link:'Link', btn_swap:'Swap', btn_free:'Set free', btn_waybill:'Waybill',
    btn_remove_back:'Remove return', btn_cancel:'Cancel', btn_save:'Save', btn_save_changes:'Save changes',
    btn_delete:'Delete', btn_back:'Back', btn_close:'Close', btn_add:'Add', btn_assign:'Assign',
    moving_title:'Trucks on route', moving_sub:'All trucks except free and on-service ones.',
    moving_found:'Found', moving_empty:'No trucks on route',
    blk_loading:'Loading', blk_back:'Return', blk_what_to:'Outbound cargo', blk_what_back:'Return cargo',
    back_assigned:'Return cargo assigned', depart_word:'Departure',
    advice:'Tip', advice_soon:'Free in ~{h}h — time to find return cargo.',
    advice_later:'On route, free in ~{h}h.', advice_active:'Active route.',
    clients_title:'Clients', add_client:'+ Client', cl_active:'On route', cl_assign_truck:'Assign truck', cl_edit:'Edit',
    orders_title:'Orders', add_order:'+ Order', ord_need_truck:'Needs truck', ord_assigned:'Assigned',
    ord_ai:'Recommended trucks', ord_take:'Take', ord_assign:'Assign',
    plan_title:'Route planning', add_plan:'+ Plan route', plan_empty:'No planned routes',
    note_for_driver:'Note for driver',
    log_title:'Trip log', log_total:'Trips: {n} · Drivers: {d}', log_empty:'Log is empty',
    log_trips:'trips', dir_back:'Return', dir_to:'',
    m_route:'Route', m_back_title:'Return cargo', m_order_new:'New order', m_order_edit:'Edit order',
    m_client_new:'New client', m_client_edit:'Edit client', m_plan:'Plan route',
    m_swap:'Driver swap', m_truck_new:'New truck', m_assign_truck:'Assign truck', m_assign_for:'Truck for',
    dir_forward_btn:'→ Outbound', dir_back_btn:'← Return',
    from_city:'Departs from', be_at_load:'Be at loading by', load_hours:'Loading time (hours)',
    calc:'Delivery estimate', calc_depart:'Departs from', calc_load:'Loading', calc_load_end:'Loading end',
    calc_unload:'Unloading', calc_free:'Truck free',
    load_addr:'Loading address', unload_addr:'Unloading address', add_point:'+ Add loading point',
    point_word:'Point', join_back:'Add a return trip right away', save_points:'Save ({n} points)', save_arrow:'Save →',
    mode_order:'From order', mode_manual:'Manual', no_avail_orders:'No free orders. Add them in the Orders tab.',
    cargo:'Cargo', from_short:'From', to_short:'To', from_city_ph:'Loading city', to_city_ph:'Unloading city',
    depart_date:'Departure date', travel_h:'Travel time (h)', save_back:'Save return cargo',
    plate:'Plate', driver:'Driver', phone:'Phone', type_word:'Type', t_own:'Own', t_hired:'Contracted', carrier:'Carrier',
    fill_fields:'Fill in fields',
    choose_client:'Choose client', new_client:'+ New client', new_client_name:'New client name', new_client_city:'City / loading point',
    client_word:'Client', count_trucks:'Truck count', rate_rub:'Rate (RUB)', temp_mode:'Temp. mode',
    cargo_ph:'What to carry?', note_ph:'Warehouse contacts, working hours, special terms…',
    enter_cargo:'Enter cargo',
    client_name:'Client name', client_color:'Client color', city_load:'Loading city', city_unload:'Unloading city',
    route_time_h:'Route time (h)', note_for_drivers:'Note for drivers',
    enter_name:'Enter name', add_client_ok:'Add client ✓',
    plan_date:'Planned loading date', note_opt:'Note (optional)',
    ai_pick:'Truck match for', ai_none:'No trucks available', ai_free:'free', ai_free_in:'free in ~{h}h', ai_near:'near loading point', ai_choose:'Select',
    swap_now:'Now', swap_to:'Which truck to move the driver to', swap_choose:'Select truck', swap_in_route:'on route',
    swap_will:'Drivers will be swapped:', swap_pin:'The driver PIN/code moves with the driver.', swap_do:'Swap drivers',
    msg_to:'for driver', msg_forward:'Outbound loading', msg_back:'Return cargo',
    note_block:'Note for driver:', open_wa:'Open in WhatsApp', send_tg:'Telegram',
    link_title:'Status check-in link', link_copy:'Copy', link_open:'Open', link_wa:'Link via WhatsApp', link_tg:'Link via Telegram',
    drv_route:'Current route', grp_load:'Loading', grp_unload:'Unloading', grp_back:'Return cargo', grp_problem:'Problems',
    s_AT_LOAD:'Heading to loading', s_AT_LOAD_d:'Driving to loading point',
    s_ARRIVED_LOAD:'Arrived at loading', s_ARRIVED_LOAD_d:'On site, waiting to load',
    s_LOADING:'Loading started', s_LOADING_d:'Loading in progress',
    s_LOADED:'Loaded', s_LOADED_d:'Loading done, departing',
    s_AT_UNLOAD:'Heading to unloading', s_AT_UNLOAD_d:'Cargo aboard, driving to point',
    s_ARRIVED_UNLOAD:'Arrived at unloading', s_ARRIVED_UNLOAD_d:'On site at unloading',
    s_UNLOADED:'Unloaded', s_UNLOADED_d:'Unloading done',
    s_BACK_GO:'Heading for return cargo', s_BACK_GO_d:'Driving to return-cargo loading',
    s_BACK:'Loaded return cargo', s_BACK_d:'Return cargo aboard, departing',
    s_FREE:'Delivered return cargo', s_FREE_d:'Return cargo delivered, free',
    s_PROBLEM:'There is a problem!', s_PROBLEM_d:'Accident, breakdown, delay',
    auth_title:'Fletera', auth_sub:'Dispatch system demo', auth_pw:'Password', auth_login:'Log in →',
    auth_hint_a:'Password:', auth_hint_b:'— click to insert', auth_err:'Wrong password',
    drv_pin_prompt:'Driver PIN:', drv_pin_bad:'PIN not found',
    saved:'✓ Saved', t_client_upd:'✓ Client updated', t_client_add:'✓ Client added',
    t_order_upd:'✓ Order updated', t_order_add:'✓ Order added', t_truck_add:'✓ Truck added',
    t_planned:'✓ Planned', t_swap_done:'✓ Swap done', t_assigned:'✓ Truck assigned',
    confirm_del_order:'Delete order?', confirm_del_plan:'Delete plan?',
    st_FREE:'Free', st_FORWARD:'On route', st_LOADED:'Loaded', st_BACK:'Return',
    st_AT_LOAD:'To loading', st_ARRIVED_LOAD:'At loading', st_LOADING:'Loading',
    st_AT_UNLOAD:'To unloading', st_ARRIVED_UNLOAD:'At unloading', st_UNLOADED:'Unloaded',
    st_BACK_GO:'For return', st_SERVICE:'Service', st_WASH:'Wash', st_DOCS:'Waybill',
    st_PROBLEM:'Problem', st_NEED_SERVICE:'Needs service',
    cur_rub:'₽',
  }
};
// Single translator used everywhere.
const T = (key, vars) => {
  const lang = window._lang === 'en' ? 'en' : 'ru';
  let s = (STR[lang] && STR[lang][key]) || STR.ru[key] || key;
  if (vars) Object.keys(vars).forEach(k => { s = s.split('{'+k+'}').join(vars[k]); });
  return s;
};
// Localized status label
const stLabel = (st) => T('st_'+st) || st;

// ── Demo data: trucks ─────────────────────────────────────────
const makeTrucks = () => {
  const h = n => addH(nowLocalISO(), n);
  const d = today();
  return [
    {id:1, plate:'AA 1001-7', driver:'Иванов Александр Петрович', phone:'+375291111001', pin:'1001', isHired:false, carrier:'',
     status:'LOADED', location:'Минск', clientId:'c2', clientName:'ФудЛогистик',
     loadAddr:'г. Брест, ул. Катин Бор 106', unloadAddr:'г. Москва, Балашиха, Стройка вл.1',
     loadAt:h(-8), freeAt:h(28), backCargo:null, onService:false, needService:false,
     trips:[{id:1001,dir:'forward',clientId:'c2',clientName:'ФудЛогистик',from:'Брест',to:'Москва',loadAt:h(-8),freeAt:h(28),date:d,wb:false}]},
    {id:2, plate:'BB 2002-7', driver:'Петров Дмитрий Сергеевич', phone:'+375292222002', pin:'1002', isHired:false, carrier:'',
     status:'FORWARD', location:'Смоленск', clientId:'c1', clientName:'АгроПром',
     loadAddr:'г. Минск, ул. Промышленная 15', unloadAddr:'г. Москва, Каширское шоссе 12',
     loadAt:h(-5), freeAt:h(32), backCargo:null, onService:false, needService:false,
     trips:[{id:1002,dir:'forward',clientId:'c1',clientName:'АгроПром',from:'Минск',to:'Москва',loadAt:h(-5),freeAt:h(32),date:d,wb:false}]},
    {id:3, plate:'CC 3003-7', driver:'Сидоров Михаил Андреевич', phone:'+375293333003', pin:'1003', isHired:false, carrier:'',
     status:'FORWARD', location:'Брест', clientId:'c6', clientName:'ПродТрейд',
     loadAddr:'г. Гомель, ул. Советская 5', unloadAddr:'г. Москва, ул. Складочная 1',
     loadAt:h(-2), freeAt:h(36), backCargo:null, onService:false, needService:false,
     trips:[{id:1003,dir:'forward',clientId:'c6',clientName:'ПродТрейд',from:'Гомель',to:'Москва',loadAt:h(-2),freeAt:h(36),date:d,wb:false}]},
    {id:4, plate:'DD 4004-7', driver:'Козлов Николай Игоревич', phone:'+375294444004', pin:'1004', isHired:false, carrier:'',
     status:'BACK', location:'Москва', clientId:'c3', clientName:'МеталлТорг',
     loadAddr:'г. Москва, Коровинское шоссе 35', unloadAddr:'г. Минск, ул. Складская 3',
     loadAt:h(-20), freeAt:h(6),
     backCargo:{cargo:'Металлопрокат (обратно)',from:'г. Москва, Коровинское шоссе 35',to:'г. Минск, Складская 3',departAt:h(-20),freeAt:h(6),rate:13000},
     onService:false, needService:false,
     trips:[{id:1004,dir:'back',clientId:'c3',clientName:'МеталлТорг',from:'Москва',to:'Минск',loadAt:h(-20),freeAt:h(6),date:d,wb:false}]},
    {id:5, plate:'EE 5005-7', driver:'Новиков Сергей Владимирович', phone:'+375295555005', pin:'1005', isHired:false, carrier:'',
     status:'FORWARD', location:'Минск', clientId:'c5', clientName:'ГолдМира',
     loadAddr:'г. Минск, дер. Колядичи 147', unloadAddr:'г. Брест, ул. Московская 364',
     loadAt:h(3), freeAt:h(44), backCargo:null, onService:false, needService:false,
     trips:[{id:1005,dir:'forward',clientId:'c5',clientName:'ГолдМира',from:'Минск',to:'Брест',loadAt:h(3),freeAt:h(44),date:d,wb:false}]},
    {id:6, plate:'FF 6006-7', driver:'Морозов Алексей Николаевич', phone:'+375296666006', pin:'1006', isHired:false, carrier:'',
     status:'SERVICE', location:'Минск', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:'', backCargo:null, onService:true, needService:false, trips:[]},
    {id:7, plate:'GG 7007-7', driver:'Волков Андрей Геннадьевич', phone:'+375297777007', pin:'1007', isHired:false, carrier:'',
     status:'FREE', location:'Москва', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-4), backCargo:null, onService:false, needService:false, trips:[]},
    {id:8, plate:'HH 8008-7', driver:'Лебедев Виталий Романович', phone:'+375298888008', pin:'1008', isHired:false, carrier:'',
     status:'FREE', location:'Минск', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-1), backCargo:null, onService:false, needService:false, trips:[]},
    {id:101,plate:'KK 1101-7', driver:'Захаров Евгений Павлович', phone:'+375291101101', pin:'2001', isHired:true, carrier:'ИП Захаров',
     status:'FORWARD', location:'Гродно', clientId:'c8', clientName:'ТехноРесурс',
     loadAddr:'г. Гродно, ул. Сов. Пограничников 3', unloadAddr:'г. Москва, МКАД 84 км',
     loadAt:h(-6), freeAt:h(30), backCargo:null, onService:false, needService:false,
     trips:[{id:1011,dir:'forward',clientId:'c8',clientName:'ТехноРесурс',from:'Гродно',to:'Москва',loadAt:h(-6),freeAt:h(30),date:d,wb:false}]},
    {id:102,plate:'LL 1102-7', driver:'Соколов Максим Дмитриевич', phone:'+375291102102', pin:'2002', isHired:true, carrier:'ИП Захаров',
     status:'FREE', location:'Минск', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-5), backCargo:null, onService:false, needService:false, trips:[]},
    {id:103,plate:'MM 1103-7', driver:'Попов Игорь Александрович', phone:'+375291103103', pin:'2003', isHired:true, carrier:'ООО Транзит',
     status:'FREE', location:'Смоленск', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-2), backCargo:null, onService:false, needService:false, trips:[]},
    {id:104,plate:'NN 1104-7', driver:'Лазарев Олег Сергеевич', phone:'+375291104104', pin:'2004', isHired:true, carrier:'ООО Транзит',
     status:'FREE', location:'Москва', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-8), backCargo:null, onService:false, needService:false, trips:[]},
    {id:105,plate:'OO 1105-7', driver:'Медведев Роман Анатольевич', phone:'+375291105105', pin:'2005', isHired:true, carrier:'ИП Медведев',
     status:'FREE', location:'Минск', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-3), backCargo:null, onService:false, needService:false, trips:[]},
    {id:106,plate:'PP 1106-7', driver:'Кузнецов Виктор Степанович', phone:'+375291106106', pin:'2006', isHired:true, carrier:'ИП Медведев',
     status:'FREE', location:'Брест', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-6), backCargo:null, onService:false, needService:false, trips:[]},
    {id:107,plate:'QQ 1107-7', driver:'Тихонов Роман Борисович', phone:'+375291107107', pin:'2007', isHired:true, carrier:'ООО Логист',
     status:'FREE', location:'Гомель', clientId:'', clientName:'',
     loadAddr:'', unloadAddr:'', loadAt:'', freeAt:h(-4), backCargo:null, onService:false, needService:false, trips:[]},
  ];
};

// ── Demo data: clients (now WITH notes) ───────────────────────
const makeClients = () => [
  {id:'c1',name:'АгроПром', color:'#4f8cff',loadCity:'Минск', loadAddr:'г. Минск, ул. Промышленная 15', routeHours:20,temp:null,
   note:'Склад работает 8:00–20:00. Звонить кладовщику Сергею за час до прибытия: +375 29 555-10-15. Пропуск на въезд заказывать заранее.',
   unloadOptions:[{city:'Москва', addr:'г. Москва, Каширское шоссе 12'}]},
  {id:'c2',name:'ФудЛогистик', color:'#34d399',loadCity:'Брест', loadAddr:'г. Брест, ул. Катин Бор 106', routeHours:22,temp:'+4',
   note:'Рефрижератор обязателен, держать +4°C. Санитарная книжка у водителя. Загрузка строго по записи, окно 06:00–10:00.',
   unloadOptions:[{city:'Балашиха', addr:'г. Балашиха, ст. Стройка вл.1'}]},
  {id:'c3',name:'МеталлТорг', color:'#fbbf24',loadCity:'Москва', loadAddr:'г. Москва, Коровинское шоссе 35', routeHours:22,temp:null,
   note:'Груз тяжёлый — крепить ремнями. Документы (ТТН, CMR) забрать на проходной у охраны. Контакт: Андрей +7 905 123-45-67.',
   unloadOptions:[{city:'Минск', addr:'г. Минск, ул. Складская 3'}]},
  {id:'c4',name:'СтройКомплект', color:'#22d3ee',loadCity:'Минск', loadAddr:'г. Минск, ул. Брикета 31', routeHours:3,temp:null,
   note:'Разгрузка манипулятором на месте. Заехать со двора, ворота №2.',
   unloadOptions:[{city:'Барановичи', addr:'г. Барановичи, ул. Фабричная 11А'}]},
  {id:'c5',name:'ГолдМира', color:'#f43f5e',loadCity:'Минск', loadAddr:'г. Минск, дер. Колядичи 147', routeHours:5,temp:null,
   note:'Паллетный груз, 12 паллет. Погрузчик есть. Бухгалтерия подписывает документы до 17:00.',
   unloadOptions:[{city:'Брест', addr:'г. Брест, ул. Московская 364'}]},
  {id:'c6',name:'ПродТрейд', color:'#a78bfa',loadCity:'Гомель', loadAddr:'г. Гомель, ул. Советская 5', routeHours:18,temp:'+2',
   note:'Температурный режим +2°C, термолента обязательна. Звонить логисту Марине: +375 29 700-22-33.',
   unloadOptions:[{city:'Москва', addr:'г. Москва, ул. Складочная 1'}]},
  {id:'c7',name:'БелЭкспорт', color:'#10b981',loadCity:'Витебск', loadAddr:'г. Витебск, ул. Ленина 22', routeHours:16,temp:null,
   note:'Экспорт, нужен полный пакет документов и пломба. На границе декларант встретит.',
   unloadOptions:[{city:'Смоленск', addr:'г. Смоленск, ул. Промышленная 8'}]},
  {id:'c8',name:'ТехноРесурс', color:'#ec4899',loadCity:'Гродно', loadAddr:'г. Гродно, ул. Сов. Пограничников 3', routeHours:24,temp:null,
   note:'Хрупкий груз (электроника). Аккуратная погрузка, проложить пузырчатой плёнкой. Приёмка по серийным номерам.',
   unloadOptions:[{city:'Москва', addr:'г. Москва, МКАД 84 км'}]},
];

// ── Demo data: orders (now WITH notes) ────────────────────────
const makeOrders = () => [
  {id:101,client:'АгроПром', cid:'c1',cargo:'Зерно пшеница', cnt:1,from:'г. Минск, Промышленная 15', to:'г. Москва, Каширское 12', rate:14500,temp:'',  date:today(),assigned:2,
   note:'Зерновоз или тент. Загрузка с верхнего люка, выгрузка самосвалом.'},
  {id:102,client:'ФудЛогистик', cid:'c2',cargo:'Рыба мороженая', cnt:1,from:'г. Брест, Катин Бор 106', to:'г. Балашиха, Стройка 1', rate:16000,temp:'+4',date:today(),assigned:1,
   note:'Реф −18°C на перевозку, +4°C на приёмке. Не размораживать! Температурный лист обязателен.'},
  {id:103,client:'МеталлТорг', cid:'c3',cargo:'Металлопрокат', cnt:2,from:'г. Москва, Коровинское 35', to:'г. Минск, Складская 3', rate:13000,temp:'',  date:today(),assigned:4,
   note:'Две машины, длинномер. Крепёж ремнями обязателен, габарит по высоте.'},
  {id:104,client:'ПродТрейд', cid:'c6',cargo:'Консервы', cnt:1,from:'г. Гомель, Советская 5', to:'г. Москва, Складочная 1', rate:15500,temp:'+2',date:today(),assigned:3,
   note:'Паллетированный груз, 20 паллет. Гидроборт желателен.'},
  {id:105,client:'СтройКомплект',cid:'c4',cargo:'Стройматериалы',cnt:1,from:'г. Минск, Брикета 31', to:'г. Барановичи, Фабричная 11А',rate:5000, temp:'',  date:today(),assigned:null,
   note:'Короткое плечо. Разгрузка манипулятором заказчика. Заехать через ворота №2.'},
];

// ── UI primitives ─────────────────────────────────────────────
const Btn = ({onClick,color='var(--accent)',children,wide,sm,solid}) => ce('button',{
  onClick, className:'fl-press', style:{
    padding: wide?'9px 14px':sm?'5px 9px':'6px 11px',
    width: wide?'100%':'auto',
    borderRadius:9, border:`1px solid ${solid?'transparent':color}`,
    background: solid?color:`color-mix(in srgb, ${color} 14%, transparent)`,
    color: solid?'#fff':color, fontWeight:700,
    fontSize:sm?11.5:12.5, fontFamily:'inherit',
    whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:5
  }
}, children);

const Modal = ({title,onClose,children,wide}) => ReactDOM.createPortal(ce('div',{
  className:'fl-modal-overlay',
  onClick:e=>{if(e.target===e.currentTarget)onClose();},
  style:{position:'fixed',inset:0,background:'rgba(5,8,16,.66)',backdropFilter:'blur(4px)',
    display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:500,
    padding:'40px 14px',overflowY:'auto'}
}, ce('div',{className:'fl-modal',style:{
  background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:18,
  padding:'22px 20px',width:'100%',maxWidth:wide?680:420,
  boxShadow:'var(--shadow-lg)', marginTop:'2vh', marginBottom:40
}},
  ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}},
    ce('div',{style:{fontWeight:800,fontSize:17,color:'var(--text)',fontFamily:'Plus Jakarta Sans,sans-serif'}},title),
    ce('button',{onClick:onClose,className:'fl-press',style:{width:30,height:30,borderRadius:9,
      background:'var(--bg3)',color:'var(--text2)',fontSize:18,lineHeight:1,
      display:'flex',alignItems:'center',justifyContent:'center'}},'×')
  ),
  children
)), document.body);

const Field = ({label,children}) => ce('div',{style:{marginBottom:13}},
  label && ce('div',{style:{fontSize:11,color:'var(--text3)',fontWeight:700,letterSpacing:'.3px',marginBottom:6}},label),
  children
);

const Input = ({value,onChange,onKeyDown,placeholder,type='text',autoFocus}) => ce('input',{
  value:value==null?'':value, onChange:e=>onChange(e.target.value), onKeyDown, placeholder, type, autoFocus,
  style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,
    padding:'10px 12px',color:'var(--text)',fontSize:14}
});

const Textarea = ({value,onChange,placeholder,rows=3}) => ce('textarea',{
  value:value==null?'':value, onChange:e=>onChange(e.target.value), placeholder, rows,
  style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,
    padding:'10px 12px',color:'var(--text)',fontSize:13.5,fontFamily:'inherit',resize:'vertical',lineHeight:1.5}
});

const Select = ({value,onChange,options}) => ce('select',{
  value, onChange:e=>onChange(e.target.value),
  style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,
    padding:'10px 12px',color:'var(--text)',fontSize:14}
}, options.map(o=>ce('option',{key:o.value,value:o.value},o.label)));

// Status pill
const Pill = ({status}) => {
  const col = SC[status]||'var(--text3)';
  return ce('span',{style:{display:'inline-flex',alignItems:'center',gap:5,
    padding:'4px 11px',borderRadius:999,
    border:`1px solid color-mix(in srgb, ${col} 40%, transparent)`,
    background:`color-mix(in srgb, ${col} 16%, transparent)`,
    color:col,fontWeight:700,fontSize:11.5,whiteSpace:'nowrap'}},
    ce('span',{style:{width:6,height:6,borderRadius:999,background:col,flexShrink:0}}),
    stLabel(status));
};

// ── Build the per-driver note (client note + matching order note) ──
// This is what the "Сообщение"/"Message" feature reads.
const gatherNotes = (truck,clients,orders) => {
  const out = [];
  const cl = clients && clients.find(c=>c.id===truck.clientId);
  if (cl && cl.note) out.push(cl.note);
  if (orders && truck.clientId){
    // any order tied to this client OR explicitly assigned to this truck
    orders.forEach(o=>{
      const sameClient = (o.cid||o.clientId)===truck.clientId;
      const sameTruck  = o.assigned===truck.id;
      if ((sameClient||sameTruck) && o.note && out.indexOf(o.note)===-1) out.push(o.note);
    });
  }
  return out.join('\n———\n');
};

const CITIES = ['Минск','Брест','Смоленск','Москва','Барановичи','Гродно','Гомель','Витебск'];

// ── Forward / route modal ─────────────────────────────────────
function ForwardModal({truck,clients,onSave,onClose}) {
  const c0 = clients.find(c=>c.id===truck.clientId) || clients[0];
  const [cid,setCid] = useState(c0?c0.id:(clients[0]&&clients[0].id));
  const [dir,setDir] = useState(truck.backCargo?'back':'forward');
  const [fromCity,setFromCity] = useState(truck.location||'Минск');
  const [loadAddr,setLoadAddr] = useState(truck.loadAddr||'');
  const [unloadAddr,setUnloadAddr] = useState(truck.unloadAddr||'');
  const [loadAt,setLoadAt] = useState(truck.loadAt||nowLocalISO());
  const [loadH,setLoadH] = useState('3');
  const [joinTwo,setJoinTwo] = useState(false);
  const [extraStops,setExtraStops] = useState([]);
  const [cq,setCq] = useState('');
  const cl = clients.find(c=>c.id===cid) || clients[0];

  useEffect(()=>{
    if(cl){ setLoadAddr(cl.loadAddr||''); setUnloadAddr((cl.unloadOptions&&cl.unloadOptions[0]&&cl.unloadOptions[0].addr)||''); }
  },[cid]);

  const loadEnd = addH(loadAt, parseInt(loadH)||3);
  const arriveUnload = addH(loadEnd, (cl&&cl.routeHours)||20);
  const free = addH(arriveUnload, 1);

  const addStop = ()=> setExtraStops(p=>p.concat([{cid:(clients[0]&&clients[0].id),note:''}]));
  const removeStop = (i)=> setExtraStops(p=>p.filter((_,idx)=>idx!==i));
  const updStop = (i,f,v)=> setExtraStops(p=>p.map((s,idx)=>idx!==i?s:Object.assign({},s,{[f]:v})));

  const save = ()=>{
    const mainTrip={id:uid(),dir:'forward',clientId:cid,clientName:(cl&&cl.name)||'',
      from:loadAddr,to:unloadAddr,loadAt,arriveUnload,freeAt:free,date:today(),wb:false};
    let allTrips=[mainTrip], lastFree=free, lastTo=unloadAddr;
    extraStops.forEach(stop=>{
      const sc=clients.find(c=>c.id===stop.cid)||cl;
      const sf=addH(lastFree,(sc&&sc.routeHours)||15);
      const sa=(sc&&sc.unloadOptions&&sc.unloadOptions[0]&&sc.unloadOptions[0].addr)||'';
      allTrips.push({id:uid(),dir:'forward',clientId:stop.cid,clientName:(sc&&sc.name)||'',
        from:lastTo,to:sa,loadAt:lastFree,arriveUnload:addH(lastFree,(sc&&sc.routeHours)||15),
        freeAt:sf,date:today(),wb:false,note:stop.note||''});
      lastFree=sf; lastTo=sa;
    });
    if(joinTwo){
      const backFree=addH(lastFree,(cl&&cl.routeHours)||20);
      const autoBack={cargo:((cl&&cl.name)||'')+' ('+T('lbl_cargo_back')+')',from:lastTo,to:loadAddr,departAt:lastFree,freeAt:backFree};
      onSave({status:'FORWARD',location:fromCity,clientId:cid,clientName:(cl&&cl.name)||'',
        loadAddr,unloadAddr,loadAt,freeAt:backFree,backCargo:autoBack,trips:allTrips});
    } else {
      onSave({status:'FORWARD',location:fromCity,clientId:cid,clientName:(cl&&cl.name)||'',
        loadAddr,unloadAddr,loadAt,freeAt:lastFree,trips:allTrips});
    }
  };

  const box={background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:11,padding:'11px 12px',marginBottom:10};
  const lbl={fontSize:10,fontWeight:800,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--text3)',marginBottom:7};
  const chip=(active,col='var(--accent)')=>({padding:'6px 11px',borderRadius:8,fontSize:12,fontWeight:700,
    cursor:'pointer',background:active?`color-mix(in srgb, ${col} 18%, transparent)`:'var(--bg2)',
    border:`1px solid ${active?col:'var(--border)'}`,color:active?col:'var(--text3)'});

  return ce(Modal,{title:T('m_route')+' — '+truck.plate,onClose,wide:true},
    ce('div',{style:{display:'flex',gap:7,marginBottom:11}},
      [['forward',T('dir_forward_btn')],['back',T('dir_back_btn')]].map(([d,txt])=>
        ce('button',{key:d,className:'fl-press',onClick:()=>setDir(d),style:Object.assign({flex:1,textAlign:'center'},chip(dir===d))},txt))),
    ce('div',{style:Object.assign({},box)},
      ce('div',{style:lbl},T('client_word')),
      ce('input',{placeholder:T('search_ph'),value:cq,onChange:e=>setCq(e.target.value),
        style:{width:'100%',background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:9,padding:'9px 11px',color:'var(--text)',fontSize:13,fontFamily:'inherit',marginBottom:8}}),
      ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap',maxHeight:300,overflowY:'auto'}},
        clients.filter(function(c){var sq=cq.trim().toLowerCase();return !sq||(c.name||'').toLowerCase().indexOf(sq)>=0;}).map(c=>ce('button',{key:c.id,className:'fl-press',onClick:()=>setCid(c.id),
          style:chip(cid===c.id,c.color)},c.name)))),
    cl&&cl.temp&&ce('div',{style:{fontSize:12,color:'var(--cyan)',marginBottom:8,fontWeight:600}},'🌡 '+cl.temp+'°C'),
    null,
    ce('div',{style:box},
      ce('div',{style:lbl},T('be_at_load')),
      ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}},
        [6,8,10,12,14,16,18,20].map(h=>{const hs=String(h).padStart(2,'0');
          return ce('button',{key:h,className:'fl-press',onClick:()=>setLoadAt(loadAt.slice(0,11)+hs+':00'),
            style:chip(loadAt.slice(11,13)===hs)},hs+':00');})),
      ce('input',{type:'datetime-local',value:loadAt,onChange:e=>setLoadAt(e.target.value),
        style:{width:'100%',background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:9,
          padding:'9px 11px',color:'var(--green)',fontSize:14,fontFamily:'inherit'}})),
    ce('div',{style:box},
      ce('div',{style:lbl},T('load_hours')),
      ce('div',{style:{display:'flex',gap:6}},
        ['1','2','3','4','5'].map(h=>ce('button',{key:h,className:'fl-press',onClick:()=>setLoadH(h),
          style:Object.assign({flex:1,textAlign:'center'},chip(loadH===h))},h+' ч')))),
    ce('div',{style:box},
      ce('div',{style:lbl},T('calc')),
      [[T('calc_depart')+' '+fromCity,loadAt,'var(--text2)'],
       [T('calc_load'),loadAt,'var(--violet)'],
       [T('calc_load_end'),loadEnd,'var(--accent)'],
       [T('calc_unload')+' '+((cl&&cl.unloadOptions&&cl.unloadOptions[0]&&cl.unloadOptions[0].city)||'—'),arriveUnload,'var(--green)'],
       [T('calc_free'),free,'var(--green)']
      ].map(row=>ce('div',{key:row[0],style:{display:'flex',justifyContent:'space-between',
        padding:'5px 0',borderBottom:'1px solid var(--border)',fontSize:12}},
        ce('span',{style:{color:'var(--text3)'}},row[0]),
        ce('span',{style:{color:row[2],fontWeight:700}},fmtDT(row[1]))))),
    ce(Field,{label:T('load_addr')},ce(Input,{value:loadAddr,onChange:setLoadAddr})),
    ce(Field,{label:T('unload_addr')},ce(Input,{value:unloadAddr,onChange:setUnloadAddr})),
    extraStops.length>0 && ce('div',{style:{marginBottom:10}},
      extraStops.map((stop,i)=>{
        const sc=clients.find(c=>c.id===stop.cid)||clients[0];
        return ce('div',{key:i,style:{background:'var(--bg3)',border:'1px solid color-mix(in srgb,var(--accent) 30%,transparent)',
          borderRadius:11,padding:'11px',marginBottom:8}},
          ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}},
            ce('span',{style:{fontSize:12,fontWeight:800,color:'var(--accent)'}},T('point_word')+' '+(i+2)+': '+((sc&&sc.name)||'—')),
            ce('button',{onClick:()=>removeStop(i),className:'fl-press',style:{color:'var(--red)',fontSize:16,width:24,height:24}},'✕')),
          ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}},
            clients.map(c=>ce('button',{key:c.id,className:'fl-press',onClick:()=>updStop(i,'cid',c.id),
              style:chip(stop.cid===c.id,c.color)},c.name))),
          sc&&sc.unloadOptions&&sc.unloadOptions[0]&&ce('div',{style:{fontSize:11,color:'var(--text2)',
            padding:'6px 9px',background:'var(--bg2)',borderRadius:8,marginBottom:7}},'🎯 '+sc.unloadOptions[0].addr),
          ce(Input,{value:stop.note,onChange:v=>updStop(i,'note',v),placeholder:T('note_for_driver')}));
      })),
    ce('button',{onClick:addStop,className:'fl-press',style:{width:'100%',padding:'11px',marginBottom:12,
      background:'color-mix(in srgb,var(--accent) 8%,transparent)',border:'1px dashed color-mix(in srgb,var(--accent) 45%,transparent)',
      borderRadius:10,color:'var(--accent)',fontWeight:700,fontSize:13,fontFamily:'inherit'}},T('add_point')),
    ce('label',{style:{display:'flex',alignItems:'center',gap:9,fontSize:13,color:'var(--text2)',cursor:'pointer',marginBottom:16}},
      ce('input',{type:'checkbox',checked:joinTwo,onChange:e=>setJoinTwo(e.target.checked),
        style:{accentColor:'var(--accent)',width:16,height:16}}),
      T('join_back')),
    ce('div',{style:{display:'flex',gap:9}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'11px',
        background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',
        borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},
        extraStops.length>0?T('save_points',{n:extraStops.length+1}):T('save_arrow')))
  );
}

// ── Return-cargo modal ────────────────────────────────────────
function BackModal({truck,orders,clients,onSave,onClose}) {
  const [mode,setMode] = useState('order');
  const [selectedOid,setSelectedOid] = useState('');
  const [cargo,setCargo] = useState((truck.backCargo&&truck.backCargo.cargo)||T('lbl_cargo_back'));
  const [from,setFrom] = useState((truck.backCargo&&truck.backCargo.from)||truck.unloadAddr||'');
  const [to,setTo] = useState((truck.backCargo&&truck.backCargo.to)||truck.loadAddr||'');
  const [dep,setDep] = useState((truck.backCargo&&truck.backCargo.departAt) || truck.freeAt || addH(truck.loadAt||nowLocalISO(), 20));
  const [freeH,setFreeH] = useState('20');
  const [oq,setOq] = useState('');

  const availOrders = (orders||[]).filter(o=>!o.assigned);
  const selectedOrder = availOrders.find(o=>String(o.id)===String(selectedOid));

  useEffect(()=>{
    if(selectedOrder){ setCargo(selectedOrder.cargo||T('lbl_cargo_back')); setFrom(selectedOrder.from||''); setTo(selectedOrder.to||''); }
  },[selectedOid]);

  const save = ()=>{
    const freeAt = addH(dep, parseInt(freeH)||20);
    onSave({status:'FORWARD', backCargo:{cargo,from,to,departAt:dep,freeAt,
      orderId:(selectedOrder&&selectedOrder.id)||null, rate:(selectedOrder&&selectedOrder.rate)||null, text:(selectedOrder&&selectedOrder.text)||'', note:(selectedOrder&&selectedOrder.note)||''}, freeAt});
  };
  const box={background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:11,padding:'11px 12px'};
  const chip=(active,col='var(--accent)')=>({flex:1,textAlign:'center',padding:'8px',borderRadius:9,fontSize:12.5,fontWeight:700,
    cursor:'pointer',background:active?`color-mix(in srgb,${col} 18%,transparent)`:'var(--bg2)',
    border:`1px solid ${active?col:'var(--border)'}`,color:active?col:'var(--text3)'});

  return ce(Modal,{title:T('m_back_title')+' — '+truck.plate,onClose,wide:true},
    ce('div',{style:{display:'flex',gap:7,marginBottom:11}},
      [['order','📋 '+T('mode_order')],['manual','✏️ '+T('mode_manual')]].map(([m,txt])=>
        ce('button',{key:m,className:'fl-press',onClick:()=>setMode(m),style:chip(mode===m)},txt))),
    mode==='order' && ce('div',{style:Object.assign({marginBottom:12},box)},
      ce('input',{placeholder:T('search_ph'),value:oq,onChange:e=>setOq(e.target.value),
        style:{width:'100%',background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:9,padding:'9px 11px',color:'var(--text)',fontSize:13,fontFamily:'inherit',marginBottom:9}}),
      (function(){
        var oql=oq.trim().toLowerCase();
        var shown=availOrders.filter(function(o){ return !oql || ((o.cargo||'')+' '+(o.client||'')+' '+(o.from||'')+' '+(o.to||'')).toLowerCase().indexOf(oql)>=0; });
        return shown.length===0
          ? ce('div',{style:{fontSize:12.5,color:'var(--text3)',textAlign:'center',padding:14}},T('no_avail_orders'))
          : ce('div',{style:{maxHeight:300,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}},
            shown.map(function(o){
              const cl=clients&&clients.find(c=>c.id===o.cid);
              return ce('div',{key:o.id,className:'fl-press',onClick:()=>setSelectedOid(String(o.id)),style:{
                padding:'9px 11px',borderRadius:9,cursor:'pointer',
                background:selectedOid===String(o.id)?'color-mix(in srgb,var(--accent) 14%,transparent)':'var(--bg2)',
                border:'1px solid '+(selectedOid===String(o.id)?'var(--accent)':'var(--border)')}},
                ce('div',{style:{fontSize:12.5,fontWeight:700,color:'var(--text)'}},
                  o.cargo,' · ',ce('span',{style:{color:(cl&&cl.color)||'var(--text3)'}},o.client)),
                ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:2}},o.from,' → ',o.to),
                o.note&&ce('div',{style:{fontSize:11,color:'var(--text2)',marginTop:4,fontStyle:'italic'}},'📝 '+o.note),
                o.rate&&ce('span',{style:{fontSize:11.5,color:'var(--green)',fontWeight:700}},(Number(o.rate)||0).toLocaleString()+' '+T('cur_rub')));
            }));
      })()),
    ce('div',{style:{marginTop:mode==='order'?12:0}},
      ce(Field,{label:T('cargo')},ce(Input,{value:cargo,onChange:setCargo})),
      ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
        ce(Field,{label:T('from_short')},ce(Input,{value:from,onChange:setFrom,placeholder:T('from_city_ph')})),
        ce(Field,{label:T('to_short')},ce(Input,{value:to,onChange:setTo,placeholder:T('to_city_ph')}))),
      ce(Field,{label:T('depart_date')},
        ce('input',{type:'datetime-local',value:dep,onChange:e=>setDep(e.target.value),
          style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,
            padding:'10px 12px',color:'var(--text)',fontSize:14,fontFamily:'inherit'}})),
      ce(Field,{label:T('travel_h')},
        ce('div',{style:{display:'flex',gap:6}},
          ['10','15','20','24','30'].map(h=>ce('button',{key:h,className:'fl-press',onClick:()=>setFreeH(h),
            style:{flex:1,textAlign:'center',padding:'8px',borderRadius:9,fontSize:12.5,fontWeight:700,cursor:'pointer',
              background:freeH===h?'color-mix(in srgb,var(--accent) 18%,transparent)':'var(--bg3)',
              border:`1px solid ${freeH===h?'var(--accent)':'var(--border)'}`,
              color:freeH===h?'var(--accent)':'var(--text3)'}},h+' ч')))),
      ce('div',{style:{display:'flex',gap:9,marginTop:6}},
        ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
        ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'11px',
          background:'linear-gradient(135deg,var(--cyan),var(--accent))',border:'none',
          borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},T('save_back'))))
  );
}

// ── Message modal (driver message + check-in link) ────────────
// The "note for driver" is built from client.note + matching order.note.
function MsgModal({truck,clients,orders,settings,onClose}) {
  const [msgType,setMsgType] = useState('forward');
  const cl = clients && clients.find(c=>c.id===truck.clientId);
  const notes = gatherNotes(truck,clients,orders);
  const fwdTrips = (truck.trips||[]).filter(tr=>tr.dir==='forward');

  const bc = truck.backCargo;
  const _v = {
    client: truck.clientName||'', loadAddr: truck.loadAddr||'', unloadAddr: truck.unloadAddr||'',
    loadTime: truck.loadAt?fmtDT(truck.loadAt):'', temp: (cl&&cl.temp)?(cl.temp+'°C'):'', note: stripMoney(notes||''),
    cargo: (bc&&bc.cargo)||'', backFrom: (bc&&bc.from)||'', backTo: (bc&&bc.to)||'',
    departAt: (bc&&bc.departAt)?fmtDT(bc.departAt):'', backNote: stripMoney((bc&&(bc.text||bc.note))||'')
  };
  let fwdMsg;
  if(fwdTrips.length>1){
    const lines=[];
    fwdTrips.forEach((tr,i)=>{
      const tc=clients&&clients.find(c=>c.id===tr.clientId);
      lines.push((i+1)+') '+(tr.clientName||'—'));
      if(tr.from) lines.push(T('lbl_loading')+': '+tr.from);
      if(tr.to)   lines.push(T('lbl_unloading')+': '+tr.to);
      if(tr.loadAt) lines.push('🕐 '+fmtDT(tr.loadAt));
      if(tc&&tc.temp) lines.push('🌡 '+tc.temp+'°C');
      if(tr.note){ var _tn=stripMoney(tr.note); if(_tn) lines.push('📝 '+_tn); }
      else if(tc&&tc.note){ var _cn=stripMoney(tc.note); if(_cn) lines.push('📝 '+_cn); }
      lines.push('');
    });
    fwdMsg=lines.join(String.fromCharCode(10));
  } else {
    fwdMsg=applyTpl(getTpl(settings,'fwd'), _v);
  }
  const backMsg = bc ? applyTpl(getTpl(settings,'back'), _v) : null;

  const driverLink = DRIVER_URL+'?pin='+truck.pin;
  const activeMsg = msgType==='forward'?fwdMsg:(backMsg||fwdMsg);
  const activeNote = msgType==='forward' ? stripMoney(notes) : stripMoney((bc&&(bc.text||bc.note))||'');
  const phoneDigits = (truck.phone||'').replace(/[^0-9]/g,'');

  const copy = (txt)=>{ try{navigator.clipboard&&navigator.clipboard.writeText(txt);}catch(e){} };
  const openWA = (txt)=>{ if(phoneDigits) window.open('https://wa.me/'+phoneDigits+'?text='+encodeURIComponent(txt),'_blank'); copy(txt); };
  const openTG = (txt)=>{ window.open('https://t.me/share/url?url=&text='+encodeURIComponent(txt),'_blank'); copy(txt); };
  const openMAX = (txt)=>{ window.open('https://max.ru/:share?text='+encodeURIComponent(txt),'_blank'); copy(txt); };

  const tabChip=(active,col)=>({flex:1,textAlign:'center',padding:'8px',borderRadius:9,fontSize:12.5,fontWeight:700,cursor:'pointer',
    background:active?`color-mix(in srgb,${col} 18%,transparent)`:'var(--bg3)',
    border:`1px solid ${active?col:'var(--border)'}`,color:active?col:'var(--text3)'});
  const linkBtn=(col)=>({flex:1,padding:'9px',borderRadius:9,fontWeight:700,fontSize:12,cursor:'pointer',
    background:`color-mix(in srgb,${col} 14%,transparent)`,border:`1px solid color-mix(in srgb,${col} 35%,transparent)`,color:col});

  return ce(Modal,{title:'👤 '+truck.driver,onClose,wide:true},
    ce('div',{style:{display:'flex',gap:7,marginBottom:11}},
      ce('button',{className:'fl-press',onClick:()=>setMsgType('forward'),style:tabChip(msgType==='forward','var(--accent)')},'→ '+T('msg_forward')),
      bc&&ce('button',{className:'fl-press',onClick:()=>setMsgType('back'),style:tabChip(msgType==='back','var(--cyan)')},'↩ '+T('msg_back'))),
    ce('div',{style:{fontSize:11,color:'var(--text3)',marginBottom:10,display:'flex',alignItems:'center',gap:6,lineHeight:1.4}},'🔒 Ставка видна только в системе — водителю она не отправляется.'),
    activeNote&&ce('div',{style:{background:'color-mix(in srgb,var(--accent) 8%,transparent)',
      border:'1px solid color-mix(in srgb,var(--accent) 22%,transparent)',borderRadius:11,padding:'10px 12px',marginBottom:10}},
      ce('div',{style:{color:'var(--accent)',fontWeight:700,fontSize:11.5,marginBottom:5}},'📝 '+T('note_block')),
      ce('div',{style:{color:'var(--text2)',whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.55}},activeNote)),
    ce('pre',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:11,padding:'12px',
      fontSize:13,color:'var(--text2)',whiteSpace:'pre-wrap',lineHeight:1.6,marginBottom:11,
      maxHeight:240,overflowY:'auto',fontFamily:'inherit'}},activeMsg),
    ce('div',{style:{display:'flex',gap:7,marginBottom:12}},
      ce('button',{className:'fl-press',onClick:()=>openWA(activeMsg),style:{flex:1,padding:'11px',background:'#25d366',
        border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}},'📱 '+T('open_wa')),
      ce('button',{className:'fl-press',onClick:()=>openTG(activeMsg),style:{flex:1,padding:'11px',background:'#229ED9',
        border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}},'✈️ '+T('send_tg')),
      ce('button',{className:'fl-press',onClick:()=>openMAX(activeMsg),style:{flex:1,padding:'11px',background:'linear-gradient(135deg,#6d5cff,#a24bff)',
        border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}},'📨 MAX'),
      ce('button',{className:'fl-press',onClick:()=>copy(activeMsg),style:{padding:'11px 15px',background:'var(--bg3)',
        border:'1px solid var(--border)',borderRadius:10,color:'var(--text2)',fontWeight:700,fontSize:13,cursor:'pointer'}},'📋')),
    ce('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:11,padding:'12px'}},
      ce('div',{style:{fontSize:11,color:'var(--amber)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:7}},'🔗 '+T('link_title')),
      ce('div',{style:{fontSize:12,color:'var(--text2)',marginBottom:5}},'PIN: '+truck.pin),
      ce('div',{style:{fontSize:11,color:'var(--text3)',wordBreak:'break-all',marginBottom:9,padding:'6px 8px',background:'var(--bg2)',borderRadius:7}},driverLink),
      ce('div',{style:{display:'flex',gap:7,marginBottom:7}},
        ce('button',{className:'fl-press',onClick:()=>copy(driverLink),style:linkBtn('var(--text2)')},'📋 '+T('link_copy')),
        ce('button',{className:'fl-press',onClick:()=>window.open(driverLink,'_blank'),style:linkBtn('var(--accent)')},'👁 '+T('link_open'))),
      ce('div',{style:{display:'flex',gap:7}},
        ce('button',{className:'fl-press',onClick:()=>openWA(T('link_title')+': '+driverLink+'\nPIN: '+truck.pin),style:linkBtn('#25d366')},'📤 '+T('link_wa')),
        ce('button',{className:'fl-press',onClick:()=>openTG(T('link_title')+': '+driverLink+'\nPIN: '+truck.pin),style:linkBtn('#229ED9')},'📤 '+T('link_tg')))),
    ce('div',{style:{marginTop:12}},ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_close')))
  );
}

// ── Add truck ─────────────────────────────────────────────────
function AddTruckModal({onSave,onClose,maxId}) {
  const [plate,setPlate] = useState('');
  const [driver,setDriver] = useState('');
  const [phone,setPhone] = useState('');
  const [hired,setHired] = useState(false);
  const [carrier,setCarrier] = useState('');
  const ok = plate && driver;
  const save = ()=>{ if(!ok) return;
    onSave({id:maxId+1,plate,driver,phone,pin:String(1000+maxId+1),isHired:hired,carrier:hired?carrier:'',
      status:'FREE',location:'',clientId:'',clientName:'',loadAddr:'',unloadAddr:'',loadAt:'',freeAt:'',
      backCargo:null,onService:false,needService:false,trips:[]}); };
  const tchip=(active)=>({flex:1,padding:'9px',borderRadius:9,fontSize:12.5,fontWeight:700,cursor:'pointer',
    background:active?'color-mix(in srgb,var(--accent) 18%,transparent)':'var(--bg3)',
    border:`1px solid ${active?'var(--accent)':'var(--border)'}`,color:active?'var(--accent)':'var(--text3)'});
  return ce(Modal,{title:T('m_truck_new'),onClose},
    ce(Field,{label:T('plate')},ce(Input,{value:plate,onChange:setPlate,placeholder:'AA 0000-7',autoFocus:true})),
    ce(Field,{label:T('driver')},ce(Input,{value:driver,onChange:setDriver,placeholder:'Иванов Иван Иванович'})),
    ce(Field,{label:T('phone')},ce(Input,{value:phone,onChange:setPhone,placeholder:'+375...'})),
    ce(Field,{label:T('type_word')},
      ce('div',{style:{display:'flex',gap:7}},
        [[false,T('t_own')],[true,T('t_hired')]].map(([v,l])=>
          ce('button',{key:l,className:'fl-press',onClick:()=>setHired(v),style:tchip(hired===v)},l)))),
    hired&&ce(Field,{label:T('carrier')},ce(Input,{value:carrier,onChange:setCarrier,placeholder:'ИП Иванов / ООО Транс'})),
    ce('div',{style:{display:'flex',gap:9,marginTop:6}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'11px',
        background:ok?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--border2)',border:'none',
        borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:ok?'pointer':'not-allowed',opacity:ok?1:.6}},
        ok?T('btn_add'):T('fill_fields')))
  );
}

// ── Add / Edit order ──────────────────────────────────────────
function OrderModal({clients,onSave,onClose,maxId,editOrder}) {
  const e0 = editOrder;
  const [mode,setMode] = useState('existing');
  const [cid,setCid] = useState((e0&&e0.cid)||(clients[0]&&clients[0].id));
  const [newClientName,setNewClientName] = useState(e0 && !clients.find(c=>c.id===e0.cid) ? e0.client : '');
  const [newClientCity,setNewClientCity] = useState('');
  const [cargo,setCargo] = useState((e0&&e0.cargo)||'');
  const [rate,setRate] = useState((e0&&e0.rate)||'');
  const [cnt,setCnt] = useState((e0&&e0.cnt)||'1');
  const [temp,setTemp] = useState((e0&&e0.temp)||'');
  const [note,setNote] = useState((e0&&e0.note)||'');
  const [fromAddr,setFromAddr] = useState((e0&&e0.from)||'');
  const [toAddr,setToAddr] = useState((e0&&e0.to)||'');
  const cl = clients.find(c=>c.id===cid)||clients[0];

  useEffect(()=>{
    if(!e0 && mode==='existing' && cl){
      setFromAddr(cl.loadAddr); setToAddr((cl.unloadOptions&&cl.unloadOptions[0]&&cl.unloadOptions[0].addr)||'');
      if(cl.temp && !temp) setTemp(cl.temp);
    }
  },[cid,mode]);

  const save = ()=>{
    if(!cargo) return;
    let clientName='', finalCid=cid, finalClientData=null;
    if(mode==='new'){
      clientName=(newClientName||T('new_client')).trim();
      finalCid='custom_'+Date.now();
      finalClientData={id:finalCid,name:clientName,color:'#4f8cff',
        loadCity:newClientCity||(fromAddr.split(',')[0]||''),loadAddr:fromAddr,routeHours:20,
        temp:temp||null,note:note||'',unloadOptions:[{city:toAddr.split(',')[0]||'',addr:toAddr}]};
    } else { clientName=(cl&&cl.name)||''; }
    const base={client:clientName,cid:finalCid,cargo,cnt:parseInt(cnt)||1,from:fromAddr,to:toAddr,
      rate:parseInt(rate)||0,temp,note,date:today(),newClient:finalClientData};
    if(e0) onSave(Object.assign({},e0,base)); else onSave(Object.assign({id:maxId+1},base,{assigned:null}));
  };
  const chip=(active,col='var(--accent)')=>({padding:'6px 11px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',
    background:active?`color-mix(in srgb,${col} 18%,transparent)`:'var(--bg3)',
    border:`1px solid ${active?col:'var(--border)'}`,color:active?col:'var(--text3)'});

  return ce(Modal,{title:e0?T('m_order_edit'):T('m_order_new'),onClose,wide:true},
    ce('div',{style:{display:'flex',gap:7,marginBottom:11}},
      ce('button',{className:'fl-press',onClick:()=>setMode('existing'),style:Object.assign({flex:1,textAlign:'center',padding:'9px'},chip(mode==='existing'))},T('choose_client')),
      ce('button',{className:'fl-press',onClick:()=>setMode('new'),style:Object.assign({flex:1,textAlign:'center',padding:'9px'},chip(mode==='new','var(--green)'))},T('new_client'))),
    mode==='existing'
      ? ce(Field,{label:T('client_word')},
          ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
            clients.map(c=>ce('button',{key:c.id,className:'fl-press',onClick:()=>setCid(c.id),style:chip(cid===c.id,c.color)},c.name))))
      : ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
          ce(Field,{label:T('new_client_name')},ce(Input,{value:newClientName,onChange:setNewClientName,placeholder:'…',autoFocus:true})),
          ce(Field,{label:T('new_client_city')},ce(Input,{value:newClientCity,onChange:setNewClientCity,placeholder:'Минск / Брест / Москва'}))),
    ce(Field,{label:T('cargo')},ce(Input,{value:cargo,onChange:setCargo,placeholder:T('cargo_ph'),autoFocus:mode==='existing'})),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}},
      ce(Field,{label:T('count_trucks')},ce(Input,{value:cnt,onChange:setCnt,type:'number'})),
      ce(Field,{label:T('rate_rub')},ce(Input,{value:rate,onChange:setRate,type:'number',placeholder:'15000'})),
      ce(Field,{label:T('temp_mode')},ce(Input,{value:temp,onChange:setTemp,placeholder:'+4'}))),
    ce(Field,{label:T('load_addr')},ce(Input,{value:fromAddr,onChange:setFromAddr})),
    ce(Field,{label:T('unload_addr')},ce(Input,{value:toAddr,onChange:setToAddr})),
    ce(Field,{label:'📝 '+T('note_for_driver')},ce(Textarea,{value:note,onChange:setNote,placeholder:T('note_ph'),rows:3})),
    ce('div',{style:{display:'flex',gap:9,marginTop:4}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'11px',
        background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',
        borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},e0?T('btn_save_changes'):T('btn_save')))
  );
}

// ── Add client ────────────────────────────────────────────────
const CLIENT_COLORS=['#4f8cff','#34d399','#fbbf24','#22d3ee','#f43f5e','#a78bfa','#10b981','#ec4899','#fb923c','#0ea5e9'];
function AddClientModal({onSave,onClose}) {
  const [name,setName] = useState('');
  const [color,setColor] = useState('#4f8cff');
  const [loadCity,setLoadCity] = useState('');
  const [loadAddr,setLoadAddr] = useState('');
  const [unCity,setUnCity] = useState('');
  const [unAddr,setUnAddr] = useState('');
  const [routeH,setRouteH] = useState('20');
  const [temp,setTemp] = useState('');
  const [note,setNote] = useState('');
  const valid = name.trim().length>0;
  const save = ()=>{ if(!valid) return;
    onSave({id:'c_'+Date.now(),name:name.trim(),color,loadCity,loadAddr,
      routeHours:parseInt(routeH)||20,temp:temp||null,note,
      unloadOptions:[{city:unCity||unAddr.split(',')[0]||'',addr:unAddr}]}); };
  return ce(Modal,{title:T('m_client_new'),onClose,wide:true},
    ce(Field,{label:T('client_name')},ce(Input,{value:name,onChange:setName,placeholder:'…',autoFocus:true})),
    ce(Field,{label:T('client_color')},
      ce('div',{style:{display:'flex',gap:8,flexWrap:'wrap',paddingTop:2}},
        CLIENT_COLORS.map(c=>ce('button',{key:c,className:'fl-press',onClick:()=>setColor(c),style:{
          width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',
          border:color===c?'3px solid var(--bg2)':'2px solid transparent',
          boxShadow:color===c?('0 0 0 2px '+c):'none',flexShrink:0}})))),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
      ce(Field,{label:T('city_load')},ce(Input,{value:loadCity,onChange:setLoadCity,placeholder:'Минск'})),
      ce(Field,{label:T('city_unload')},ce(Input,{value:unCity,onChange:setUnCity,placeholder:'Москва'}))),
    ce(Field,{label:T('load_addr')},ce(Input,{value:loadAddr,onChange:setLoadAddr,placeholder:'г. Минск, ул. …'})),
    ce(Field,{label:T('unload_addr')},ce(Input,{value:unAddr,onChange:setUnAddr,placeholder:'г. Москва, ул. …'})),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
      ce(Field,{label:T('route_time_h')},ce(Input,{value:routeH,onChange:setRouteH,type:'number',placeholder:'20'})),
      ce(Field,{label:T('temp_mode')},ce(Input,{value:temp,onChange:setTemp,placeholder:'+4'}))),
    ce(Field,{label:'📝 '+T('note_for_drivers')},ce(Textarea,{value:note,onChange:setNote,placeholder:T('note_ph'),rows:3})),
    ce('div',{style:{display:'flex',gap:9,marginTop:6}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'11px',border:'none',borderRadius:11,
        color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',
        background:valid?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--border2)',opacity:valid?1:.6}},
        valid?T('add_client_ok'):T('enter_name')))
  );
}

// ── Edit client ───────────────────────────────────────────────
function EditClientModal({client,onSave,onClose}) {
  const [name,setName] = useState(client.name);
  const [color,setColor] = useState(client.color||'#4f8cff');
  const [loadCity,setLoadCity] = useState(client.loadCity);
  const [loadAddr,setLoadAddr] = useState(client.loadAddr);
  const [unloadAddr,setUnloadAddr] = useState((client.unloadOptions&&client.unloadOptions[0]&&client.unloadOptions[0].addr)||'');
  const [routeHours,setRouteHours] = useState(String(client.routeHours||20));
  const [temp,setTemp] = useState(client.temp||'');
  const [note,setNote] = useState(client.note||'');
  const save = ()=> onSave(Object.assign({},client,{name,color,loadCity,loadAddr,
    unloadOptions:[{city:unloadAddr.split(',')[0]||'',addr:unloadAddr}],
    routeHours:parseInt(routeHours)||20,temp:temp||null,note}));
  return ce(Modal,{title:T('m_client_edit')+' — '+client.name,onClose,wide:true},
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
      ce(Field,{label:T('client_name')},ce(Input,{value:name,onChange:setName})),
      ce(Field,{label:T('city_load')},ce(Input,{value:loadCity,onChange:setLoadCity}))),
    ce(Field,{label:T('client_color')},
      ce('div',{style:{display:'flex',gap:8,flexWrap:'wrap',paddingTop:2}},
        CLIENT_COLORS.map(c=>ce('button',{key:c,className:'fl-press',onClick:()=>setColor(c),style:{
          width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',
          border:color===c?'3px solid var(--bg2)':'2px solid transparent',
          boxShadow:color===c?('0 0 0 2px '+c):'none',flexShrink:0}})))),
    ce(Field,{label:T('load_addr')},ce(Input,{value:loadAddr,onChange:setLoadAddr})),
    ce(Field,{label:T('unload_addr')},ce(Input,{value:unloadAddr,onChange:setUnloadAddr})),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
      ce(Field,{label:T('route_time_h')},ce(Input,{value:routeHours,onChange:setRouteHours,type:'number'})),
      ce(Field,{label:T('temp_mode')},ce(Input,{value:temp,onChange:setTemp,placeholder:'+4'}))),
    ce(Field,{label:'📝 '+T('note_for_drivers')},ce(Textarea,{value:note,onChange:setNote,placeholder:T('note_ph'),rows:4})),
    ce('div',{style:{display:'flex',gap:9,marginTop:4}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'11px',
        background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',
        borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},T('btn_save')))
  );
}

// ── Plan modal (truck matching) ───────────────────────────────
function PlanModal({clients,trucks,orders,onSave,onClose}) {
  const [cid,setCid] = useState(clients[0]&&clients[0].id);
  const [dt,setDt] = useState(today());
  const [note,setNote] = useState('');
  const cl = clients.find(c=>c.id===cid);

  const suggestions = useMemo(()=>{
    if(!cl) return [];
    const loadCity=(cl.loadCity||'').toLowerCase();
    return trucks
      .filter(t=>t.status==='FREE'||MOVING.includes(t.status))
      .map(t=>{
        const freeH=t.freeAt?Math.round((new Date(t.freeAt)-now())/3.6e6):0;
        const locMatch=!!(t.location&&t.location.toLowerCase().includes(loadCity)&&loadCity);
        const score=(locMatch?50:0)+Math.max(0,30-Math.abs(freeH-8));
        return {truck:t,score,freeH,locMatch};
      })
      .sort((a,b)=>b.score-a.score).slice(0,4);
  },[cid,trucks]);

  const save = (tid)=>{
    const tk=trucks.find(x=>x.id===Number(tid));
    if(!tk) return;
    onSave({id:uid(),truckId:tk.id,truckPlate:tk.plate,truckDriver:tk.driver,
      clientId:cid,clientName:(cl&&cl.name)||'',loadAddr:(cl&&cl.loadAddr)||'',date:dt,note,createdAt:nowLocalISO()});
  };
  const chip=(active,col='var(--accent)')=>({padding:'6px 11px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',
    background:active?`color-mix(in srgb,${col} 18%,transparent)`:'var(--bg3)',
    border:`1px solid ${active?col:'var(--border)'}`,color:active?col:'var(--text3)'});

  return ce(Modal,{title:T('m_plan'),onClose,wide:true},
    ce(Field,{label:T('client_word')},
      ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
        clients.map(c=>ce('button',{key:c.id,className:'fl-press',onClick:()=>setCid(c.id),style:chip(cid===c.id,c.color)},c.name)))),
    cl&&ce('div',{style:{fontSize:12,color:'var(--text2)',marginBottom:10}},
      '📍 '+cl.loadAddr+' → 🎯 '+((cl.unloadOptions&&cl.unloadOptions[0]&&cl.unloadOptions[0].addr)||'—')+' · '+cl.routeHours+' ч'),
    ce(Field,{label:T('plan_date')},
      ce('input',{type:'date',value:dt,onChange:e=>setDt(e.target.value),
        style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,
          padding:'10px 12px',color:'var(--text)',fontSize:14,fontFamily:'inherit'}})),
    ce(Field,{label:T('note_opt')},ce(Input,{value:note,onChange:setNote})),
    ce('div',{style:{background:'color-mix(in srgb,var(--green) 8%,transparent)',
      border:'1px solid color-mix(in srgb,var(--green) 25%,transparent)',borderRadius:11,padding:'11px',marginBottom:12}},
      ce('div',{style:{fontSize:11.5,color:'var(--green)',fontWeight:700,marginBottom:9}},'🤖 '+T('ai_pick')+' '+((cl&&cl.name)||'')),
      suggestions.length===0
        ? ce('div',{style:{fontSize:12.5,color:'var(--text3)'}},T('ai_none'))
        : suggestions.map(s=>ce('div',{key:s.truck.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'8px 10px',borderRadius:9,marginBottom:6,
            background:s.locMatch?'color-mix(in srgb,var(--green) 10%,transparent)':'var(--bg4)',
            border:`1px solid ${s.locMatch?'color-mix(in srgb,var(--green) 30%,transparent)':'var(--border)'}`}},
            ce('div',null,
              ce('div',{style:{fontSize:12.5,fontWeight:700,color:'var(--text)'}},s.truck.plate+' · '+s.truck.driver),
              ce('div',{style:{fontSize:11,color:'var(--text3)'}},
                (s.truck.location||'—')+(s.freeH>0?' · '+T('ai_free_in',{h:s.freeH}):' · '+T('ai_free'))+(s.locMatch?' ✓ '+T('ai_near'):''))),
            ce('div',{style:{display:'flex',alignItems:'center',gap:9}},
              ce('span',{style:{fontSize:11,fontWeight:700,color:s.score>60?'var(--green)':s.score>30?'var(--amber)':'var(--red)'}},s.score+'/100'),
              ce(Btn,{onClick:()=>save(s.truck.id),color:'var(--accent)',sm:true},T('ai_choose'))))) ),
    ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_close'))
  );
}

// ── Swap modal ────────────────────────────────────────────────
function SwapModal({truck,trucks,onSwap,onClose}) {
  if(!truck) return null;
  const [targetId,setTargetId] = useState('');
  const target = trucks.find(t=>String(t.id)===String(targetId));
  return ce(Modal,{title:T('m_swap'),onClose,wide:true},
    ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:13}},
      T('swap_now')+': '+truck.plate+' · '+truck.driver+' · '+truck.phone),
    ce(Field,{label:T('swap_to')},
      ce('select',{value:targetId,onChange:e=>setTargetId(e.target.value),
        style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--amber)',borderRadius:10,
          padding:'10px 12px',color:'var(--text)',fontSize:13.5,fontFamily:'inherit'}},
        ce('option',{value:''},T('swap_choose')),
        trucks.filter(t=>t.id!==truck.id).map(t=>ce('option',{key:t.id,value:t.id},
          t.plate+' · '+t.driver+(t.status!=='FREE'?' ('+T('swap_in_route')+')':''))))),
    target&&ce('div',{style:{background:'var(--bg3)',border:'1px solid color-mix(in srgb,var(--amber) 40%,transparent)',
      borderRadius:10,padding:'11px 13px',fontSize:12.5,marginBottom:14}},
      ce('div',{style:{color:'var(--text2)',marginBottom:6}},T('swap_will')),
      ce('div',{style:{color:'var(--text)'}},truck.plate+': '+truck.driver+' → '+target.driver),
      ce('div',{style:{color:'var(--text)'}},target.plate+': '+target.driver+' → '+truck.driver),
      ce('div',{style:{color:'var(--amber)',marginTop:7}},T('swap_pin'))),
    ce('div',{style:{display:'flex',gap:9}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{disabled:!target,className:'fl-press',onClick:()=>{if(target)onSwap(truck.id,target.id);},
        style:{flex:2,padding:'11px',borderRadius:11,border:'none',
          background:target?'var(--amber)':'var(--border2)',color:target?'#1a1505':'var(--text4)',
          fontWeight:800,cursor:target?'pointer':'not-allowed',fontSize:14}},T('swap_do')))
  );
}

// ── Driver status page (full screen) ──────────────────────────
function DriverPage({truck,clients,orders,onUpdate,onClose}) {
  const [status,setStatus] = useState(truck.status);
  const notes = gatherNotes(truck,clients,orders);

  const apply = (s)=>{
    (function(){ var _id=String(Date.now())+Math.random().toString(36).slice(2,6); var _a=(s==='PROBLEM')?'problem':(s==='FREE'?'done':s); var _o={}; _o[_id]={ts:nowLocalISO(),plate:truck.plate||'',driver:truck.driver||'',logist:truck.logist||'',action:_a,label:s}; dbPatch('/history',_o); })();
    if(s==='PROBLEM'){ onUpdate({problem:true,lastEvent:'⚠ Проблема',lastTime:nowLocalISO()}); return; }
    setStatus(s);
    let patch;
    if(s==='FREE') patch={status:'FREE',problem:false,freeAt:nowLocalISO(),clientId:'',clientName:'',loadAddr:'',unloadAddr:'',loadAt:'',backCargo:null,trips:[]};
    else patch={status:s,problem:false,freeAt:truck.freeAt};
    onUpdate(patch);
  };
  const groups=[
    {label:T('grp_load'),color:'var(--amber)',items:['AT_LOAD','ARRIVED_LOAD','LOADING','LOADED']},
    {label:T('grp_unload'),color:'var(--violet)',items:['AT_UNLOAD','ARRIVED_UNLOAD','UNLOADED']},
    {label:T('grp_back'),color:'var(--cyan)',items:['BACK_GO','BACK','FREE']},
    {label:T('grp_problem'),color:'var(--red)',items:['PROBLEM']},
  ];
  const ICON={AT_LOAD:'🚛',ARRIVED_LOAD:'📍',LOADING:'⬆️',LOADED:'✅',AT_UNLOAD:'🚛',ARRIVED_UNLOAD:'📍',UNLOADED:'✅',BACK_GO:'🔄',BACK:'📦',FREE:'🏁',PROBLEM:'🚨'};

  return ce('div',{style:{position:'fixed',inset:0,background:'var(--bg)',zIndex:600,display:'flex',flexDirection:'column',overflowY:'auto'}},
    ce('div',{style:{padding:'14px 16px',borderBottom:'1px solid var(--border)',background:'var(--bg2)',
      display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}},
      ce('div',null,
        ce('div',{style:{fontWeight:800,fontSize:16,color:'var(--text)'}},truck.driver),
        ce('div',{style:{fontSize:12,color:'var(--text3)'}},truck.plate)),
      ce('button',{onClick:onClose,className:'fl-press',style:{background:'var(--bg3)',border:'1px solid var(--border)',
        borderRadius:10,padding:'8px 14px',color:'var(--text2)',fontSize:13,fontWeight:700}},'← '+T('btn_back'))),
    (truck.clientName||truck.loadAddr||notes)&&ce('div',{style:{padding:'12px 16px',background:'var(--bg2)',
      borderBottom:'1px solid var(--border)',fontSize:12.5,color:'var(--text2)'}},
      ce('div',{style:{fontSize:10.5,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}},T('drv_route')),
      truck.clientName&&ce('div',{style:{marginBottom:4}},'🏢 ',ce('b',{style:{color:'var(--text)'}},truck.clientName)),
      truck.loadAddr&&ce('div',{style:{marginBottom:3}},'📍 ',truck.loadAddr),
      truck.unloadAddr&&ce('div',{style:{marginBottom:notes?8:0}},'🎯 ',truck.unloadAddr),
      notes&&ce('div',{style:{marginTop:6,padding:'9px 11px',background:'color-mix(in srgb,var(--accent) 8%,transparent)',
        border:'1px solid color-mix(in srgb,var(--accent) 22%,transparent)',borderRadius:10}},
        ce('div',{style:{color:'var(--accent)',fontWeight:700,fontSize:11,marginBottom:4}},'📝 '+T('note_block')),
        ce('div',{style:{color:'var(--text2)',whiteSpace:'pre-wrap',fontSize:12.5,lineHeight:1.5}},notes))),
    ce('div',{style:{padding:'14px 16px',maxWidth:560,margin:'0 auto',width:'100%'}},
      groups.map(g=>ce('div',{key:g.label,style:{marginBottom:16}},
        ce('div',{style:{fontSize:10,color:g.color,fontWeight:800,letterSpacing:'1.4px',textTransform:'uppercase',marginBottom:8}},g.label),
        g.items.map(s=>ce('button',{key:s,className:'fl-press',onClick:()=>apply(s),style:{
          width:'100%',marginBottom:7,padding:'13px 15px',borderRadius:13,textAlign:'left',cursor:'pointer',fontFamily:'inherit',
          background:status===s?`color-mix(in srgb,${g.color} 16%,transparent)`:'var(--bg2)',
          border:`2px solid ${status===s?g.color:'var(--border)'}`,display:'flex',alignItems:'center',gap:13}},
          ce('div',{style:{width:40,height:40,borderRadius:10,flexShrink:0,
            background:status===s?`color-mix(in srgb,${g.color} 28%,transparent)`:'var(--bg3)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}},ICON[s]||'•'),
          ce('div',null,
            ce('div',{style:{fontSize:14,fontWeight:700,color:status===s?g.color:'var(--text)'}},T('s_'+s)),
            ce('div',{style:{fontSize:12,color:'var(--text3)',marginTop:1}},T('s_'+s+'_d')))))) ) )
  );
}

// ── Login ─────────────────────────────────────────────────────
function Login({onOk}) {
  const [pass,setPass] = useState('');
  const [err,setErr] = useState('');
  const [,force] = useState(0);
  const go = ()=>{ if(['demo','fletera','1234'].includes(pass.trim().toLowerCase())) onOk();
    else { setErr(T('auth_err')); setTimeout(()=>setErr(''),2000); } };
  return ce('div',{style:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}},
    ce('div',{className:'fl-modal',style:{background:'var(--bg2)',border:'1px solid var(--border)',
      borderRadius:22,padding:'40px 34px',width:380,boxShadow:'var(--shadow-lg)'}},
      ce('div',{style:{display:'flex',alignItems:'center',gap:11,marginBottom:8}},
        ce('div',{style:{width:42,height:42,borderRadius:12,background:'linear-gradient(135deg,var(--accent),var(--accent2))',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,boxShadow:'0 6px 20px color-mix(in srgb,var(--accent) 45%,transparent)'}},'🚛'),
        ce('div',{style:{fontWeight:800,fontSize:24,color:'var(--text)',fontFamily:'Plus Jakarta Sans,sans-serif',letterSpacing:'-.5px'}},
          'Fle',ce('span',{style:{color:'var(--accent)'}},'tera'))),
      ce('div',{style:{fontSize:13,color:'var(--text3)',marginBottom:28}},T('auth_sub')),
      ce('div',{style:{fontSize:11,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.8px',marginBottom:7}},T('auth_pw')),
      ce('input',{type:'password',value:pass,placeholder:'demo',autoFocus:true,
        onChange:e=>{setPass(e.target.value);setErr('');},onKeyDown:e=>{if(e.key==='Enter')go();},
        style:{width:'100%',background:'var(--bg3)',border:`1px solid ${err?'var(--red)':'var(--border2)'}`,
          borderRadius:11,padding:'13px 15px',color:'var(--text)',fontSize:15,fontFamily:'inherit'}}),
      err&&ce('div',{style:{color:'var(--red)',fontSize:12.5,marginTop:6,fontWeight:600}},err),
      ce('button',{onClick:go,className:'fl-press',style:{marginTop:13,width:'100%',padding:'14px',
        background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:12,
        color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer'}},T('auth_login')),
      ce('div',{style:{marginTop:15,padding:'11px 14px',background:'color-mix(in srgb,var(--accent) 6%,transparent)',
        border:'1px solid color-mix(in srgb,var(--accent) 14%,transparent)',borderRadius:11,fontSize:12.5,color:'var(--text3)',textAlign:'center'}},
        T('auth_hint_a')+' ',ce('b',{style:{color:'var(--accent)',cursor:'pointer'},onClick:()=>setPass('demo')},'demo'),' '+T('auth_hint_b')))
  );
}

// ── Truck card (Fleet tab) ────────────────────────────────────
function TruckCard({truck,clients,orders,settings,role,isBoss,onUpdate,onSwapRequest,onOpenDriver,onDelete,onUndoDispatch}) {
  const [modal,setModal] = useState(null);
  const sc = SC[truck.status]||'var(--text3)';
  const isMoving = MOVING.includes(truck.status);
  const cl = clients.find(c=>c.id===truck.clientId)||null;
  const lastTrip = (truck.trips&&truck.trips.length)?truck.trips[truck.trips.length-1]:null;
  const bc = truck.backCargo;
  const bord = (truck.problem||truck.status==='PROBLEM')?'var(--red)':truck.onService?'var(--orange)':truck.needService?'var(--amber)':'var(--border)';
  const hf = truck.freeAt?Math.round((new Date(truck.freeAt)-now())/3.6e6):null;
  const wl = (truck.trips&&truck.trips.length)||0;
  const upd = patch=>{ onUpdate(truck.id,patch); setModal(null); };
  const setFree = ()=> upd({status:'FREE',clientId:'',clientName:'',loadAddr:'',unloadAddr:'',loadAt:'',freeAt:nowLocalISO(),backCargo:null,trips:[]});

  return ce('div',{className:'fl-card fl-row-hover',style:{
    background:'var(--bg2)',border:`1px solid ${bord}`,borderRadius:14,padding:'14px 15px',
    position:'relative',overflow:'hidden',boxShadow:'var(--shadow)'}},
    ce('div',{style:{position:'absolute',top:0,left:0,right:0,height:3,background:sc}}),
    ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:8}},
      ce('div',{style:{minWidth:0}},
        ce('div',{style:{fontWeight:800,fontSize:14,color:'var(--text)',fontFamily:'Plus Jakarta Sans,sans-serif'}},truck.plate),
        ce('div',{style:{fontSize:12,color:'var(--text2)',marginTop:1}},truck.driver),
        ce('div',{style:{fontSize:11,color:'var(--text3)'}},truck.phone)),
      ce('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5}},
        ce(Pill,{status:truck.status}),
        truck.isHired&&ce('span',{style:{padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:700,
          background:'color-mix(in srgb,var(--amber) 16%,transparent)',color:'var(--amber)',
          border:'1px solid color-mix(in srgb,var(--amber) 35%,transparent)',whiteSpace:'nowrap'}},T('lbl_hired')))),
    truck.isHired&&truck.carrier&&ce('div',{style:{fontSize:11,color:'var(--amber)',marginBottom:6}},truck.carrier),

    truck.problem&&ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'9px 11px',borderRadius:10,
      background:'color-mix(in srgb,var(--red) 14%,transparent)',border:'1px solid color-mix(in srgb,var(--red) 45%,transparent)'}},
      ce('span',{style:{fontSize:13,fontWeight:800,color:'var(--red)'}},'⚠ ПРОБЛЕМА'),
      truck.lastTime?ce('span',{style:{fontSize:11.5,color:'var(--text2)'}},fmtDT(truck.lastTime)):null,
      ce('button',{className:'fl-press',onClick:()=>onUpdate(truck.id,{problem:false}),style:{marginLeft:'auto',padding:'5px 10px',borderRadius:8,
        border:'1px solid color-mix(in srgb,var(--green) 45%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}},'✓ Решена')),
    ce('div',{style:{display:'flex',alignItems:'center',gap:7,marginBottom:8}},
      ce('span',{style:{fontSize:11,color:'var(--text3)',fontWeight:700,flexShrink:0}},'Логист:'),
      ce('select',{value:truck.logist||'',onChange:e=>onUpdate(truck.id,{logist:e.target.value}),
        style:{flex:1,background:'var(--bg3)',borderRadius:8,padding:'6px 9px',fontSize:12.5,fontWeight:700,fontFamily:'inherit',
          color:truck.logist?(LOGIST_COLOR[truck.logist]||'var(--text)'):'var(--text3)',
          border:'1px solid '+(truck.logist?('color-mix(in srgb,'+(LOGIST_COLOR[truck.logist]||'var(--accent)')+' 45%,transparent)'):'var(--border)')}},
        ce('option',{value:''},'— не назначен —'),
        LOGISTS.map(lg=>ce('option',{key:lg,value:lg},lg)))),
    ce('div',{onClick:()=>setModal('note'),style:{cursor:'pointer',marginBottom:8,padding:'9px 11px',borderRadius:10,
      background:truck.note?'color-mix(in srgb,var(--amber) 12%,transparent)':'var(--bg3)',
      border:'1px solid '+(truck.note?'color-mix(in srgb,var(--amber) 42%,transparent)':'var(--border)')}},
      ce('div',{style:{fontSize:10,fontWeight:800,color:'var(--amber)',letterSpacing:'.4px',textTransform:'uppercase',marginBottom:truck.note?4:0}},'📝 Заметка'+(truck.note?'':' — нажмите, чтобы добавить')),
      truck.note?ce('div',{style:{fontSize:13,color:'var(--text)',whiteSpace:'pre-wrap',lineHeight:1.45,fontWeight:600}},truck.note):null),

    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 10px',fontSize:12,marginBottom:8}},
      ce('div',{style:{color:'var(--text3)'}},T('lbl_location')+': ',
        ce('span',{style:{color:'var(--text2)',fontWeight:600}},truck.location||'—')),
      ce('div',{style:{color:'var(--text3)'}},T('lbl_waybill')+': ',
        ce('span',{style:{color:wl<=1?'var(--orange)':'var(--green)',fontWeight:700}},wl+' '+T('trips_word'))),
      isMoving&&hf!==null&&ce('div',{style:{color:'var(--text3)'}},T('lbl_free_in')+': ',
        ce('span',{style:{color:hf<=4?'var(--green)':'var(--accent)',fontWeight:700}},hf<=0?T('now_word'):'~'+hf+' ч')),
      cl&&ce('div',{style:{color:'var(--text3)'}},T('lbl_client')+': ',
        ce('span',{style:{color:cl.color,fontWeight:700}},cl.name)),
      lastTrip&&lastTrip.dir==='forward'&&ce('div',{style:{color:'var(--text3)',gridColumn:'1/-1'}},
        T('lbl_cargo_to')+': ',ce('span',{style:{color:'var(--text)'}},lastTrip.clientName),
        ' · '+T('lbl_will_unload')+': ',ce('span',{style:{color:'var(--violet)',fontWeight:700}},fmtDT(truck.freeAt))),
      bc&&truck.backCargo&&ce('div',{style:{color:'var(--text3)',gridColumn:'1/-1'}},
        T('lbl_cargo_back')+': ',ce('span',{style:{color:'var(--cyan)',fontWeight:700}},bc.cargo),
        ' · '+T('lbl_will_unload')+': ',ce('span',{style:{color:'var(--green)',fontWeight:700}},fmtDT(bc.freeAt)))),

    isMoving&&ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'8px 11px',borderRadius:10,
      background:'color-mix(in srgb,var(--accent) 10%,transparent)',border:'1px solid color-mix(in srgb,var(--accent) 30%,transparent)'}},
      ce('span',{style:{fontSize:10.5,color:'var(--accent)',fontWeight:800,textTransform:'uppercase',letterSpacing:'.4px'}},'🕓 Освободится'),
      ce('span',{style:{fontSize:14,color:'var(--text)',fontWeight:800}},truck.freeAt?fmtDT(truck.freeAt):'—'),
      hf!==null?ce('span',{style:{marginLeft:'auto',fontSize:11.5,color:hf<=4?'var(--green)':'var(--text3)',fontWeight:700}},hf<=0?'сейчас':('~'+hf+' ч')):null),
    (function(){ var _cl=clients&&clients.find(function(c){return c.id===truck.clientId;}); var _tmp=(_cl&&_cl.temp)||''; return (isMoving&&_tmp)?ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'7px 11px',borderRadius:10,background:'color-mix(in srgb,var(--cyan) 10%,transparent)',border:'1px solid color-mix(in srgb,var(--cyan) 30%,transparent)'}},ce('span',{style:{fontSize:10.5,color:'var(--cyan)',fontWeight:800,textTransform:'uppercase',letterSpacing:'.4px'}},'🌡 Температура'),ce('span',{style:{fontSize:14,color:'var(--text)',fontWeight:800}},_tmp+'°C')):null; })(),

    ce('div',{style:{display:'flex',gap:14,marginBottom:8,padding:'7px 11px',background:'var(--bg3)',borderRadius:9,border:'1px solid var(--border)'}},
      ce('label',{style:{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11.5,color:truck.onService?'var(--orange)':'var(--text3)'}},
        ce('input',{type:'checkbox',checked:!!truck.onService,
          onChange:e=>upd({onService:e.target.checked,status:e.target.checked?'SERVICE':(truck.status==='SERVICE'?'FREE':truck.status)}),
          style:{accentColor:'var(--orange)',width:14,height:14}}),T('on_service')),
      ce('label',{style:{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11.5,color:truck.needService?'var(--amber)':'var(--text3)'}},
        ce('input',{type:'checkbox',checked:!!truck.needService,onChange:e=>upd({needService:e.target.checked}),
          style:{accentColor:'var(--amber)',width:14,height:14}}),T('need_service'))),

    bc&&truck.backCargo&&ce('div',{style:{background:'color-mix(in srgb,var(--cyan) 8%,transparent)',
      border:'1px solid color-mix(in srgb,var(--cyan) 28%,transparent)',borderRadius:9,padding:'8px 11px',marginBottom:8,fontSize:12}},
      ce('div',{style:{color:'var(--cyan)',fontWeight:700,marginBottom:3}},T('lbl_cargo_back')),
      ce('div',{style:{color:'var(--text)',fontWeight:600}},bc.cargo||'—'),
      bc.from&&ce('div',{style:{color:'var(--text3)'}},T('lbl_loading')+': '+bc.from),
      bc.to&&ce('div',{style:{color:'var(--text3)'}},T('lbl_unloading')+': '+bc.to)),

    ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
      ce(Btn,{onClick:()=>setModal('forward'),color:'var(--accent)'},isMoving?T('btn_edit_route'):T('btn_to_route')),
      ce(Btn,{onClick:()=>setModal('back'),color:'var(--cyan)'},T('btn_return')),
      truck.phone&&ce(Btn,{onClick:()=>setModal('msg'),color:'var(--green)'},'💬 '+T('btn_msg')),
      ce(Btn,{onClick:()=>{if(onSwapRequest)onSwapRequest(truck);},color:'var(--amber)'},T('btn_swap')),
      ce(Btn,{onClick:()=>setModal('edittruck'),color:'var(--violet)',sm:true},'✏️ '+T('cl_edit')),
      ce(Btn,{onClick:setFree,color:'var(--green)',sm:true},T('btn_free')),
      ce(Btn,{onClick:()=>window.open(DRIVER_URL+'?pin='+(truck.pin||''),'_blank'),color:'var(--text3)',sm:true},'📱'),
      isMoving&&onUndoDispatch&&ce(Btn,{onClick:()=>{ if(window.confirm('Отменить ошибочную отправку? У водителя '+(truck.driver||'')+' спишется 1 рейс в путевом. На саму машину это не влияет.')) onUndoDispatch(truck.id); },color:'var(--red)',sm:true},'↩ −1 путевой')),

    modal==='forward'&&ce(ForwardModal,{truck,clients,onSave:upd,onClose:()=>setModal(null)}),
    modal==='back'&&ce(BackModal,{truck,orders,clients,onSave:upd,onClose:()=>setModal(null)}),
    modal==='msg'&&ce(MsgModal,{truck,clients,orders,settings,onClose:()=>setModal(null)}),
    modal==='note'&&ce(NoteModal,{truck,onSave:upd,onClose:()=>setModal(null)}),
    modal==='edittruck'&&ce(EditTruckModal,{truck,onSave:upd,onDelete:onDelete,onClose:()=>setModal(null)})
  );
}

// ── Moving card (On-route tab) ────────────────────────────────
function MovingCard({tr,clients,orders,settings,onUpdate,onModal,modal,setModal}) {
  const sc = SC[tr.status]||'var(--text3)';
  const lt = (tr.trips&&tr.trips.length)?tr.trips[tr.trips.length-1]:null;
  const freeH = tr.freeAt?Math.round((new Date(tr.freeAt)-now())/3.6e6):null;
  const fwd = (tr.trips||[]).filter(r=>r.dir==='forward');
  const blk={borderRadius:10,padding:'9px 11px'};
  const blkLbl=(col)=>({fontSize:10,color:col,fontWeight:800,letterSpacing:'.8px',textTransform:'uppercase'});

  return ce('div',{className:'fl-card fl-row-hover',style:{background:'var(--bg2)',
    border:`1px solid color-mix(in srgb,${sc} 40%,transparent)`,borderRadius:14,padding:'14px 15px',boxShadow:'var(--shadow)'}},
    ce('div',{style:{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}},
      ce('div',null,
        ce('div',{style:{fontWeight:800,fontSize:13.5,color:'var(--text)',fontFamily:'Plus Jakarta Sans,sans-serif'}},tr.plate),
        tr.isHired&&ce('div',{style:{fontSize:11,color:'var(--amber)',fontWeight:600}},tr.carrier),
        ce('div',{style:{fontSize:13,color:'var(--text2)',fontWeight:600,marginTop:2}},tr.driver)),
      ce(Pill,{status:tr.status})),
    ce('div',{style:{fontSize:12,color:'var(--text2)',marginTop:7}},
      (tr.loadAddr&&tr.unloadAddr)?(tr.loadAddr.split(',')[0]+' → '+tr.unloadAddr.split(',')[0]):'—',
      ' · '+T('lbl_location')+': '+(tr.location||'—')),
    tr.problem&&ce('div',{style:{display:'flex',alignItems:'center',gap:8,margin:'8px 0',padding:'9px 11px',borderRadius:10,
      background:'color-mix(in srgb,var(--red) 14%,transparent)',border:'1px solid color-mix(in srgb,var(--red) 45%,transparent)'}},
      ce('span',{style:{fontSize:13,fontWeight:800,color:'var(--red)'}},'⚠ ПРОБЛЕМА'),
      tr.lastTime?ce('span',{style:{fontSize:11.5,color:'var(--text2)'}},fmtDT(tr.lastTime)):null,
      ce('button',{className:'fl-press',onClick:()=>onUpdate(tr.id,{problem:false}),style:{marginLeft:'auto',padding:'5px 10px',borderRadius:8,
        border:'1px solid color-mix(in srgb,var(--green) 45%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}},'✓ Решена')),
    ce('div',{style:{display:'flex',alignItems:'center',gap:7,margin:'8px 0'}},
      ce('span',{style:{fontSize:11,color:'var(--text3)',fontWeight:700,flexShrink:0}},'Логист:'),
      ce('select',{value:tr.logist||'',onChange:e=>onUpdate(tr.id,{logist:e.target.value}),
        style:{flex:1,background:'var(--bg3)',borderRadius:8,padding:'6px 9px',fontSize:12.5,fontWeight:700,fontFamily:'inherit',
          color:tr.logist?(LOGIST_COLOR[tr.logist]||'var(--text)'):'var(--text3)',
          border:'1px solid '+(tr.logist?('color-mix(in srgb,'+(LOGIST_COLOR[tr.logist]||'var(--accent)')+' 45%,transparent)'):'var(--border)')}},
        ce('option',{value:''},'— не назначен —'),
        LOGISTS.map(lg=>ce('option',{key:lg,value:lg},lg)))),
    ce('div',{onClick:()=>setModal({type:'note',tid:tr.id}),style:{cursor:'pointer',margin:'8px 0',padding:'9px 11px',borderRadius:10,
      background:tr.note?'color-mix(in srgb,var(--amber) 12%,transparent)':'var(--bg3)',
      border:'1px solid '+(tr.note?'color-mix(in srgb,var(--amber) 42%,transparent)':'var(--border)')}},
      ce('div',{style:{fontSize:10,fontWeight:800,color:'var(--amber)',letterSpacing:'.4px',textTransform:'uppercase',marginBottom:tr.note?4:0}},'📝 Заметка'+(tr.note?'':' — нажмите, чтобы добавить')),
      tr.note?ce('div',{style:{fontSize:13,color:'var(--text)',whiteSpace:'pre-wrap',lineHeight:1.45,fontWeight:600}},tr.note):null),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:9,marginBottom:7}},
      ce('div',{style:Object.assign({background:'var(--bg4)',border:'1px solid color-mix(in srgb,var(--violet) 35%,transparent)'},blk)},
        ce('div',{style:blkLbl('var(--violet)')},T('blk_loading')),
        ce('div',{style:{fontSize:16,color:'var(--text)',fontWeight:800,marginTop:2}},
          tr.loadAt?fmtDT(tr.loadAt):'—')),
      ce('div',{style:Object.assign({background:'var(--bg4)',border:'1px solid color-mix(in srgb,var(--cyan) 35%,transparent)'},blk)},
        ce('div',{style:blkLbl('var(--cyan)')},T('blk_back')),
        ce('div',{style:{fontSize:16,color:'var(--text)',fontWeight:800,marginTop:2}},
          (tr.backCargo&&tr.backCargo.departAt)?fmtDT(tr.backCargo.departAt):'—'))),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:7}},
      ce('div',{style:Object.assign({background:'var(--bg3)',border:'1px solid color-mix(in srgb,var(--violet) 35%,transparent)'},blk)},
        ce('div',{style:blkLbl('var(--violet)')},T('blk_what_to')),
        fwd.length>1
          ? ce('div',{style:{marginTop:3}},fwd.map((r,i)=>ce('div',{key:i,style:{fontSize:12,color:'var(--text)',fontWeight:700,
              borderBottom:i<fwd.length-1?'1px solid var(--border)':'none',paddingBottom:3,marginBottom:3}},
              ce('span',{style:{color:'var(--violet)',marginRight:4}},(i+1)+'.'),r.clientName||'—',
              ce('div',{style:{color:'var(--text3)',fontSize:10,fontWeight:500}},
                (r.from?r.from.split(',')[0]:'')+(r.to?' → '+r.to.split(',')[0]:'')))))
          : ce('div',{style:{fontSize:14,color:'var(--text)',fontWeight:800,marginTop:2}},tr.clientName||(lt&&lt.clientName)||'—')),
      ce('div',{style:Object.assign({background:'var(--bg3)',border:'1px solid color-mix(in srgb,var(--cyan) 35%,transparent)'},blk)},
        ce('div',{style:blkLbl('var(--cyan)')},T('blk_what_back')),
        ce('div',{style:{fontSize:14,color:'var(--text)',fontWeight:800,marginTop:2}},(tr.backCargo&&tr.backCargo.cargo)||'—'))),
    tr.backCargo&&ce('div',{style:{background:'color-mix(in srgb,var(--cyan) 8%,transparent)',
      border:'1px solid color-mix(in srgb,var(--cyan) 28%,transparent)',borderRadius:9,padding:'8px 11px',marginBottom:8,fontSize:12}},
      ce('div',{style:{color:'var(--cyan)',fontWeight:700,marginBottom:3}},T('back_assigned')),
      ce('div',{style:{color:'var(--text)',fontWeight:700}},tr.backCargo.cargo||'—'),
      tr.backCargo.from&&ce('div',{style:{color:'var(--text2)'}},tr.backCargo.from+' → '+(tr.backCargo.to||'—')),
      tr.backCargo.departAt&&ce('div',{style:{color:'var(--text2)'}},T('depart_word')+': '+fmtDT(tr.backCargo.departAt)),
      tr.backCargo.rate&&ce('div',{style:{color:'var(--green)',fontWeight:700}},Number(tr.backCargo.rate).toLocaleString()+' '+T('cur_rub'))),
    ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'8px 11px',borderRadius:10,
      background:'color-mix(in srgb,var(--accent) 10%,transparent)',border:'1px solid color-mix(in srgb,var(--accent) 30%,transparent)'}},
      ce('span',{style:{fontSize:10.5,color:'var(--accent)',fontWeight:800,textTransform:'uppercase',letterSpacing:'.4px'}},'🕓 Освободится'),
      ce('span',{style:{fontSize:15,color:'var(--text)',fontWeight:800}},tr.freeAt?fmtDT(tr.freeAt):'—'),
      freeH!==null?ce('span',{style:{marginLeft:'auto',fontSize:11.5,color:freeH<=4?'var(--green)':'var(--text3)',fontWeight:700}},freeH<=0?'сейчас':('~'+freeH+' ч')):null),
    (function(){ var _cl=clients&&clients.find(function(c){return c.id===tr.clientId;}); var _tmp=(_cl&&_cl.temp)||''; return _tmp?ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'7px 11px',borderRadius:10,background:'color-mix(in srgb,var(--cyan) 10%,transparent)',border:'1px solid color-mix(in srgb,var(--cyan) 30%,transparent)'}},ce('span',{style:{fontSize:10.5,color:'var(--cyan)',fontWeight:800,textTransform:'uppercase',letterSpacing:'.4px'}},'🌡 Температура'),ce('span',{style:{fontSize:15,color:'var(--text)',fontWeight:800}},_tmp+'°C')):null; })(),
    ce('div',{style:{background:'color-mix(in srgb,var(--green) 8%,transparent)',border:'1px solid color-mix(in srgb,var(--green) 22%,transparent)',
      borderRadius:9,padding:'8px 11px',fontSize:12,color:'var(--text2)',marginBottom:8}},
      ce('span',{style:{color:'var(--green)',fontWeight:700}},T('advice')+': '),
      freeH!==null?(freeH<=6?T('advice_soon',{h:Math.max(0,freeH)}):T('advice_later',{h:freeH})):T('advice_active')),
    ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
      ce(Btn,{onClick:()=>setModal({type:'forwardEdit',tid:tr.id}),color:'var(--accent)'},T('btn_edit_route')),
      ce(Btn,{onClick:()=>setModal({type:'back',tid:tr.id}),color:'var(--cyan)'},T('btn_return')),
      tr.backCargo&&ce(Btn,{onClick:()=>onUpdate(tr.id,{backCargo:null}),color:'var(--red)',sm:true},T('btn_remove_back')),
      ce(Btn,{onClick:()=>setModal({type:'msg',tid:tr.id}),color:'var(--green)'},'💬 '+T('btn_msg')),
      ce(Btn,{onClick:()=>onUpdate(tr.id,{status:'FREE',clientId:'',clientName:'',freeAt:nowLocalISO(),loadAt:'',backCargo:null,trips:[]}),color:'var(--green)',sm:true},T('btn_free'))),
    modal&&modal.type==='forwardEdit'&&modal.tid===tr.id&&ce(ForwardModal,{truck:tr,clients,onSave:p=>{onUpdate(tr.id,p);setModal(null);},onClose:()=>setModal(null)}),
    modal&&modal.type==='back'&&modal.tid===tr.id&&ce(BackModal,{truck:tr,orders,clients,onSave:p=>{onUpdate(tr.id,p);setModal(null);},onClose:()=>setModal(null)}),
    modal&&modal.type==='msg'&&modal.tid===tr.id&&ce(MsgModal,{truck:tr,clients,orders,settings,onClose:()=>setModal(null)}),
    modal&&modal.type==='note'&&modal.tid===tr.id&&ce(NoteModal,{truck:tr,onSave:p=>{onUpdate(tr.id,p);setModal(null);},onClose:()=>setModal(null)})
  );
}

// ── Log tab ───────────────────────────────────────────────────
function LogTab({trucks,logDate,setLogDate}) {
  const entries = useMemo(()=>{
    const all=[];
    trucks.forEach(t=>{ (t.trips||[]).forEach(tr=>{
      all.push({driver:t.driver,plate:t.plate,client:tr.clientName,dir:tr.dir,
        from:tr.from||'',to:tr.to||'',date:tr.date||today(),loadAt:tr.loadAt,freeAt:tr.freeAt,wb:tr.wb}); }); });
    return all.sort((a,b)=>new Date(b.loadAt||0)-new Date(a.loadAt||0));
  },[trucks]);
  const byDriver = useMemo(()=>{ const m={}; entries.forEach(e=>{(m[e.driver]=m[e.driver]||[]).push(e);}); return m; },[entries]);

  return ce('div',{style:{padding:'16px',maxWidth:1100,margin:'0 auto'}},
    ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}},
      ce('h2',{style:{fontWeight:800,color:'var(--text)',margin:0,fontSize:20}},T('log_title')),
      ce('input',{type:'date',value:logDate,onChange:e=>setLogDate(e.target.value),
        style:{background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:10,padding:'7px 12px',color:'var(--text)',fontSize:13,fontFamily:'inherit'}})),
    ce('div',{style:{fontSize:12.5,color:'var(--text3)',marginBottom:12}},T('log_total',{n:entries.length,d:Object.keys(byDriver).length})),
    Object.keys(byDriver).map(driver=>ce('div',{key:driver,className:'fl-card',style:{background:'var(--bg2)',
      border:'1px solid var(--border)',borderRadius:13,padding:'14px',marginBottom:10,boxShadow:'var(--shadow)'}},
      ce('div',{style:{fontWeight:800,color:'var(--text)',fontSize:13.5,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}},
        driver,ce('span',{style:{fontSize:11.5,color:'var(--accent)',fontWeight:600}},byDriver[driver].length+' '+T('log_trips'))),
      byDriver[driver].map((tr,i)=>ce('div',{key:i,style:{borderTop:'1px solid var(--border)',paddingTop:7,marginTop:7,
        display:'grid',gridTemplateColumns:'auto 1fr',gap:'2px 12px',fontSize:12}},
        ce('span',{style:{color:'var(--text3)'}},fmtDT(tr.loadAt)),
        ce('div',null,
          ce('b',{style:{color:tr.dir==='back'?'var(--cyan)':'var(--accent)'}},tr.dir==='back'?'← '+T('dir_back'):'→ '+tr.client),
          ' ',ce('span',{style:{color:'var(--text3)'}},(tr.from&&tr.to)?tr.from+' → '+tr.to:''),
          tr.wb&&ce('span',{style:{color:'var(--green)',marginLeft:4}},'✓')))))),
    entries.length===0&&ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},T('log_empty'))
  );
}

// ── Assign-truck-to-order / -client (top-level, not nested) ──
function AssignModal({title,fieldLabel,free,onAssign,onClose,order}) {
  const [q,setQ] = useState('');
  const [sel,setSel] = useState(free[0]?String(free[0].id):'');
  var list = free;
  if(order && typeof bestTrucksForOrder==='function'){ list = bestTrucksForOrder(free.slice(),order); }
  var ql = q.trim().toLowerCase();
  var shown = list.filter(function(t){ return !ql || ((t.plate||'')+' '+(t.driver||'')+' '+(t.location||'')).toLowerCase().indexOf(ql)>=0; });
  var inp={width:'100%',background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:10,padding:'10px 12px',color:'var(--text)',fontSize:14,fontFamily:'inherit'};
  return ce(Modal,{title,onClose,wide:true},
    ce('div',{style:{fontSize:12.5,color:'var(--text3)',marginBottom:8}},fieldLabel),
    ce('input',{placeholder:T('search_ph'),value:q,onChange:e=>setQ(e.target.value),style:inp}),
    ce('div',{style:{marginTop:10,maxHeight:380,overflowY:'auto',display:'flex',flexDirection:'column',gap:7}},
      shown.length===0
        ? ce('div',{style:{fontSize:13,color:'var(--text3)',padding:14,textAlign:'center'}},T('ai_none'))
        : shown.map(function(t){ return ce('div',{key:t.id,className:'fl-press',onClick:()=>setSel(String(t.id)),style:{
            display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:11,cursor:'pointer',
            background:sel===String(t.id)?'color-mix(in srgb,var(--accent) 14%,transparent)':'var(--bg2)',
            border:'1px solid '+(sel===String(t.id)?'var(--accent)':'var(--border)')}},
          ce('div',{style:{minWidth:0}},
            ce('div',{style:{fontWeight:800,fontSize:13.5,color:'var(--text)'}},t.plate,
              t.isHired?ce('span',{style:{fontSize:10.5,color:'var(--amber)',marginLeft:6}},t.carrier):null),
            ce('div',{style:{fontSize:12,color:'var(--text2)',marginTop:2}},t.driver+(t.location?' · '+t.location:'')),
            (t._km!=null)?ce('div',{style:{fontSize:11,color:t._color||'var(--text3)',marginTop:2,fontWeight:700}},'~'+t._km+' км · '+(t._verdict||'')):null),
          ce('button',{className:'fl-press',onClick:e=>{if(e&&e.stopPropagation)e.stopPropagation();onAssign(Number(t.id));},style:{
            flexShrink:0,padding:'8px 14px',borderRadius:9,border:'none',color:'#fff',fontWeight:800,fontSize:12.5,cursor:'pointer',
            background:'linear-gradient(135deg,'+(t._color||'var(--accent)')+',var(--accent2))'}},T('btn_assign'))); })),
    ce('div',{style:{display:'flex',gap:9,marginTop:12}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:()=>{if(sel)onAssign(Number(sel));},className:'fl-press',
        disabled:!sel,style:{flex:1,padding:'11px',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,
        background:sel?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--border2)',cursor:sel?'pointer':'not-allowed',opacity:sel?1:.6}},
        T('btn_assign')+' →'))
  );
}

// ── Main App ──────────────────────────────────────────────────
function LogistsModal({logists,trucks,onSave,onClose}){
  const [list,setList]=useState((logists||[]).map(function(l){return {name:l.name,color:l.color};}));
  const [nm,setNm]=useState('');
  const [col,setCol]=useState(LOGIST_PALETTE[0]);
  const cnt=function(name){ return (trucks||[]).filter(function(t){return t.logist===name;}).length; };
  const bad=(function(){ var n=(nm||'').trim(); return !n || n==='Руководитель' || list.some(function(l){return l.name===n;}); })();
  const add=function(){ if(bad) return; var n=(nm||'').trim(); var nl=list.concat([{name:n,color:col}]); setList(nl); setNm(''); var used=nl.map(function(l){return l.color;}); setCol(LOGIST_PALETTE.filter(function(c){return used.indexOf(c)<0;})[0]||LOGIST_PALETTE[0]); };
  const del=function(name){ setList(list.filter(function(l){return l.name!==name;})); };
  const save=function(){ if(!list.length) return; onSave(list); onClose(); };
  return ce(Modal,{title:'👥 Логисты',onClose,wide:true},
    ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:12,lineHeight:1.6}},'Добавляйте и удаляйте логистов. Каждый видит только свои машины; «Руководитель» — отдельная роль, её менять не нужно. При удалении логиста его машины становятся свободными (без логиста) — их можно переназначить на доске.'),
    ce('div',{style:{display:'flex',flexDirection:'column',gap:8,marginBottom:16}},
      list.length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'8px 2px'}},'Список пуст — добавьте хотя бы одного логиста.'):
      list.map(function(l){ var c=cnt(l.name); return ce('div',{key:l.name,style:{display:'flex',alignItems:'center',gap:11,padding:'10px 12px',borderRadius:11,background:'var(--bg2)',border:'1px solid var(--border)'}},
        ce('span',{style:{width:13,height:13,borderRadius:4,background:l.color,flexShrink:0}}),
        ce('span',{style:{fontWeight:800,fontSize:15,color:l.color}},l.name),
        ce('span',{style:{fontSize:11.5,color:'var(--text3)'}},c>0?('машин: '+c):'нет машин'),
        ce('button',{onClick:function(){del(l.name);},className:'fl-press',title:'Удалить',style:{marginLeft:'auto',width:30,height:30,borderRadius:8,border:'1px solid var(--border2)',background:'var(--bg3)',color:'var(--red)',cursor:'pointer',fontSize:15,fontWeight:800,lineHeight:1}},'✕')); })),
    ce('div',{style:{borderTop:'1px solid var(--border)',paddingTop:14}},
      ce('div',{style:{fontSize:12,fontWeight:800,color:'var(--text3)',marginBottom:9}},'Добавить логиста'),
      ce('div',{style:{display:'flex',gap:8,alignItems:'center',marginBottom:10}},
        ce('input',{value:nm,onChange:function(e){setNm(e.target.value);},placeholder:'Имя логиста',onKeyDown:function(e){ if(e.key==='Enter'){ e.preventDefault(); add(); } },
          style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:'11px 12px',color:'var(--text)',fontSize:14,fontFamily:'inherit'}}),
        ce('button',{onClick:add,disabled:bad,className:'fl-press',style:{flexShrink:0,padding:'0 18px',height:44,borderRadius:10,border:'none',cursor:bad?'default':'pointer',fontFamily:'inherit',fontWeight:800,fontSize:14,background:bad?'var(--bg3)':'linear-gradient(135deg,var(--accent),var(--accent2))',color:bad?'var(--text3)':'#fff'}},'Добавить')),
      ce('div',{style:{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}},
        ce('span',{style:{fontSize:11.5,color:'var(--text3)',marginRight:2}},'Цвет:'),
        LOGIST_PALETTE.map(function(c){ return ce('button',{key:c,onClick:function(){setCol(c);},className:'fl-press',style:{width:26,height:26,borderRadius:7,cursor:'pointer',background:c,border:col===c?'3px solid var(--text)':'2px solid var(--border)'}}); }))),
    ce('div',{style:{display:'flex',gap:9,marginTop:18}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},'Отмена'),
      ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'12px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},'Сохранить')));
}
const BOSS_PASS='Egida2002';
function RolePicker({onPick,logists,trucks,onSaveLogists}){
  const [manage,setManage]=useState(false);
  const [askBoss,setAskBoss]=useState(false);
  const [bp,setBp]=useState('');
  const [bpErr,setBpErr]=useState('');
  const tryBoss=()=>{ if(bp.trim()===BOSS_PASS){ setAskBoss(false); setBp(''); setBpErr(''); onPick('Руководитель'); }
    else { setBpErr('Неверный пароль'); setTimeout(()=>setBpErr(''),2000); } };
  return ce('div',{style:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20,color:'var(--text)'}},
    manage?ce(LogistsModal,{logists,trucks,onSave:onSaveLogists,onClose:function(){setManage(false);}}):null,
    askBoss?ce(Modal,{title:'👔 Вход для руководителя',onClose:function(){setAskBoss(false);setBp('');setBpErr('');}},
      ce('div',{style:{fontSize:12.5,color:'var(--text3)',marginBottom:10}},'Этот раздел защищён отдельным паролем.'),
      ce('input',{type:'password',value:bp,autoFocus:true,placeholder:'Пароль',
        onChange:function(e){setBp(e.target.value);},onKeyDown:function(e){ if(e.key==='Enter') tryBoss(); },
        style:{width:'100%',background:'var(--bg3)',border:'1px solid '+(bpErr?'var(--red)':'var(--border2)'),borderRadius:10,padding:'12px 13px',color:'var(--text)',fontSize:15,fontFamily:'inherit'}}),
      bpErr?ce('div',{style:{color:'var(--red)',fontSize:12,fontWeight:700,marginTop:7}},bpErr):null,
      ce('div',{style:{display:'flex',gap:9,marginTop:16}},
        ce(Btn,{onClick:function(){setAskBoss(false);setBp('');},color:'var(--text3)',wide:true},'Отмена'),
        ce('button',{onClick:tryBoss,className:'fl-press',style:{flex:1,padding:'12px',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',
          background:'linear-gradient(135deg,var(--green),var(--accent))'}},'Войти →'))):null,
    ce('div',{style:{width:'100%',maxWidth:420}},
      ce('div',{style:{textAlign:'center',marginBottom:22}},
        ce('div',{style:{fontWeight:800,fontSize:24,fontFamily:'Plus Jakarta Sans,sans-serif'}},'Fle',ce('span',{style:{color:'var(--accent)'}},'tera')),
        ce('div',{style:{fontSize:13.5,color:'var(--text3)',marginTop:5}},'Кто работает? Выберите себя')),
      ROLES.map(function(r){ var isBoss=r==='Руководитель'; var isMech=r==='Механик'; var isHr=r==='Кадры'; var col=isBoss?'var(--green)':isMech?'var(--cyan)':isHr?'var(--violet)':(LOGIST_COLOR[r]||'var(--accent)');
        return ce('button',{key:r,className:'fl-press',onClick:()=>{ if(isBoss) setAskBoss(true); else onPick(r); },style:{width:'100%',marginBottom:11,padding:'16px 18px',
          borderRadius:14,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:13,
          background:`color-mix(in srgb,${col} 12%,transparent)`,border:`1px solid color-mix(in srgb,${col} 40%,transparent)`,color:col,fontWeight:800,fontSize:17}},
          ce('span',{style:{fontSize:23}},isBoss?'👔':isMech?'🔧':isHr?'🗂':'👤'), r,
          isBoss?ce('span',{style:{marginLeft:'auto',fontSize:11,color:'var(--text3)',fontWeight:600}},'🔒 по паролю'):null); }),
      ce('button',{onClick:function(){setManage(true);},className:'fl-press',style:{marginTop:8,width:'100%',padding:'13px',borderRadius:13,cursor:'pointer',fontFamily:'inherit',background:'transparent',border:'1px dashed var(--border2)',color:'var(--text3)',fontWeight:700,fontSize:13.5}},'✏️ Изменить список логистов')));
}
function NoteModal({truck,onSave,onClose}){
  const [note,setNote]=useState(truck.note||'');
  return ce(Modal,{title:'📝 Заметка — '+(truck.plate||''),onClose},
    ce('textarea',{value:note,onChange:e=>setNote(e.target.value),rows:5,autoFocus:true,placeholder:'Важная информация по машине / водителю…',
      style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:11,color:'var(--text)',fontSize:14,fontFamily:'inherit',lineHeight:1.5}}),
    ce('div',{style:{display:'flex',gap:9,marginTop:10}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},'Отмена'),
      ce('button',{onClick:()=>onSave({note:note}),className:'fl-press',style:{flex:1,padding:'11px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',
        border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},'Сохранить')));
}
function TemplateModal({settings,onSave,onClose}){
  const [fwd,setFwd]=useState(getTpl(settings,'fwd'));
  const [back,setBack]=useState(getTpl(settings,'back'));
  const [groupWa,setGroupWa]=useState((settings&&settings.groupWa)||'');
  const [groupMax,setGroupMax]=useState((settings&&settings.groupMax)||'');
  var ta={width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:11,color:'var(--text)',fontSize:13,fontFamily:'inherit',lineHeight:1.5};
  return ce(Modal,{title:'⚙ Настройки: шаблон и группы',onClose,wide:true},
    ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:10,lineHeight:1.7}},'Переменные подставляются сами. Туда: ',
      ce('span',{style:{color:'var(--accent)'}},'{client} {loadAddr} {unloadAddr} {loadTime} {temp} {note}'),'. Обратка: ',
      ce('span',{style:{color:'var(--cyan)'}},'{cargo} {backFrom} {backTo} {departAt} {backNote}'),'. Пустые строки убираются автоматически.'),
    ce(Field,{label:'Шаблон «туда»'},ce('textarea',{value:fwd,onChange:e=>setFwd(e.target.value),rows:7,style:ta})),
    ce(Field,{label:'Шаблон «обратка»'},ce('textarea',{value:back,onChange:e=>setBack(e.target.value),rows:6,style:ta})),
    ce('div',{style:{borderTop:'1px solid var(--border)',margin:'4px 0 12px'}}),
    ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:9}},'Ссылки на группу для видео загрузки/выгрузки (водитель нажимает кнопку — открывается группа):'),
    ce(Field,{label:'🔗 Группа WhatsApp'},ce(Input,{value:groupWa,onChange:setGroupWa,placeholder:'https://chat.whatsapp.com/...'})),
    ce(Field,{label:'🔗 Группа MAX'},ce(Input,{value:groupMax,onChange:setGroupMax,placeholder:'https://max.ru/... (ссылка-приглашение)'})),
    ce('div',{style:{display:'flex',gap:9,marginTop:6}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},'Отмена'),
      ce('button',{onClick:()=>onSave({fwd:fwd,back:back,groupWa:groupWa,groupMax:groupMax}),className:'fl-press',style:{flex:1,padding:'11px',
        background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},'Сохранить')));
}
function AssignLogistModal({role,trucks,onAssign,onClose}){
  const [q,setQ]=useState('');
  const list=(trucks||[]).filter(t=>t.logist!==role).filter(t=>{var x=q.toLowerCase();return !x||(t.plate||'').toLowerCase().includes(x)||(t.driver||'').toLowerCase().includes(x);});
  return ce(Modal,{title:'➕ Добавить машину под себя — '+role,onClose,wide:true},
    ce('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Поиск по номеру или водителю',autoFocus:true,
      style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:'10px 12px',color:'var(--text)',fontSize:13,fontFamily:'inherit',marginBottom:10}}),
    ce('div',{style:{maxHeight:400,overflowY:'auto',display:'flex',flexDirection:'column',gap:7}},
      list.length===0?ce('div',{style:{color:'var(--text3)',textAlign:'center',padding:20}},'Нет машин'):
      list.map(t=>ce('button',{key:t.id,className:'fl-press',onClick:()=>onAssign(t.id),style:{display:'flex',justifyContent:'space-between',alignItems:'center',
        padding:'11px 13px',borderRadius:11,cursor:'pointer',fontFamily:'inherit',background:'var(--bg3)',border:'1px solid var(--border)',textAlign:'left'}},
        ce('div',null,ce('div',{style:{fontWeight:700,color:'var(--text)',fontSize:13}},t.plate),ce('div',{style:{fontSize:11.5,color:'var(--text3)'}},t.driver)),
        ce('span',{style:{fontSize:11,fontWeight:700,color:t.logist?(LOGIST_COLOR[t.logist]||'var(--amber)'):'var(--green)'}},t.logist?('у '+t.logist):'свободна')))));
}
function ManagerCard({t,onUpdate}){
  const sc = SC[t.status]||'var(--text3)';
  const moving = MOVING.includes(t.status);
  const hf = t.freeAt?Math.round((new Date(t.freeAt)-now())/3.6e6):null;
  return ce('div',{style:{background:'var(--bg2)',borderRadius:11,padding:'10px 11px',marginBottom:9,
    borderLeft:'3px solid '+sc,border:'1px solid '+(t.problem?'color-mix(in srgb,var(--red) 55%,transparent)':'var(--border)')}},
    ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:3}},
      ce('div',{style:{fontWeight:800,fontSize:13,color:'var(--text)'}},t.plate),
      ce(Pill,{status:t.status})),
    ce('div',{style:{fontSize:11.5,color:'var(--text2)',marginBottom:4}},t.driver||'—'),
    t.problem&&ce('div',{style:{fontSize:11,fontWeight:800,color:'var(--red)',marginBottom:5}},'⚠ ПРОБЛЕМА'+(t.lastTime?(' · '+fmtDT(t.lastTime)):'')),
    moving&&(t.loadAddr||t.unloadAddr)&&ce('div',{style:{fontSize:11,color:'var(--text3)',marginBottom:3}},
      (t.loadAddr?t.loadAddr.split(',')[0]:'')+' → '+(t.unloadAddr?t.unloadAddr.split(',')[0]:'')),
    moving&&ce('div',{style:{fontSize:11.5,color:'var(--accent)',fontWeight:700,marginBottom:5}},'🕓 '+(t.freeAt?fmtDT(t.freeAt):'—')+(hf!==null?(hf<=0?' · сейчас':' · ~'+hf+'ч'):'')),
    t.note&&ce('div',{style:{fontSize:11.5,color:'var(--text)',whiteSpace:'pre-wrap',lineHeight:1.4,marginBottom:6,padding:'5px 7px',borderRadius:7,
      background:'color-mix(in srgb,var(--amber) 12%,transparent)',border:'1px solid color-mix(in srgb,var(--amber) 35%,transparent)'}},'📝 '+t.note),
    moving&&ce('button',{onClick:function(){ onUpdate(t.id,{status:'FREE',clientId:'',clientName:'',loadAddr:'',unloadAddr:'',loadAt:'',freeAt:nowLocalISO(),backCargo:null,trips:[],problem:false}); },className:'fl-press',style:{width:'100%',marginBottom:7,padding:'7px',borderRadius:8,border:'1px solid color-mix(in srgb,var(--green) 45%,transparent)',background:'color-mix(in srgb,var(--green) 12%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:'inherit'}},'✓ Завершить рейс (освободить)'),
    ce('select',{value:t.logist||'',onChange:e=>onUpdate(t.id,{logist:e.target.value}),
      style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 7px',fontSize:11.5,fontWeight:700,fontFamily:'inherit',
        color:t.logist?(LOGIST_COLOR[t.logist]||'var(--text)'):'var(--text3)'}},
      ce('option',{value:''},'— не назначен —'),
      LOGISTS.map(lg=>ce('option',{key:lg,value:lg},lg))));
}
function ManagerBoard({trucks,onUpdate,search,setSearch}){
  const q=(search||'').toLowerCase();
  const match=t=>!q||(t.plate||'').toLowerCase().includes(q)||(t.driver||'').toLowerCase().includes(q);
  const rank=t=>t.problem?0:(MOVING.includes(t.status)?1:2);
  const sortf=(a,b)=>rank(a)-rank(b);
  const cols=LOGISTS.map(function(lg){ return {name:lg,color:LOGIST_COLOR[lg],items:trucks.filter(t=>t.logist===lg&&match(t)).sort(sortf)}; });
  cols.push({name:'Свободный транспорт',color:'var(--green)',free:true,items:trucks.filter(t=>!t.logist&&match(t)).sort(sortf)});
  return ce('div',null,
    ce('div',{style:{marginBottom:12}},
      ce('input',{placeholder:'Поиск по номеру или водителю',value:search||'',onChange:e=>setSearch(e.target.value),
        style:{background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:9,padding:'8px 12px',color:'var(--text)',fontSize:13,width:280,maxWidth:'100%',fontFamily:'inherit'}})),
    ce('div',{style:{display:'flex',gap:12,overflowX:'auto',paddingBottom:10,alignItems:'flex-start'}},
      cols.map(function(col){
        var movingN=col.items.filter(t=>MOVING.includes(t.status)).length;
        var freeN=col.items.filter(t=>t.status==='FREE').length;
        var probN=col.items.filter(t=>t.problem).length;
        return ce('div',{key:col.name,style:{flex:'1 0 280px',minWidth:280,maxWidth:400,background:'var(--bg)',
          border:'1px solid color-mix(in srgb,'+col.color+' 30%,transparent)',borderRadius:13,padding:'11px 11px 6px'}},
          ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,paddingBottom:8,borderBottom:'1px solid var(--border)'}},
            ce('div',{style:{display:'flex',alignItems:'center',gap:8}},
              ce('span',{style:{width:11,height:11,borderRadius:3,background:col.color,display:'inline-block'}}),
              ce('span',{style:{fontWeight:800,fontSize:14,color:col.color}},col.name)),
            ce('span',{style:{fontSize:13,fontWeight:800,color:'var(--text2)'}},col.items.length)),
          ce('div',{style:{display:'flex',gap:9,fontSize:10.5,color:'var(--text3)',marginBottom:9,flexWrap:'wrap'}},
            ce('span',null,'в рейсе: ',ce('b',{style:{color:'var(--accent)'}},movingN)),
            ce('span',null,'своб.: ',ce('b',{style:{color:'var(--green)'}},freeN)),
            probN>0?ce('span',null,'⚠ ',ce('b',{style:{color:'var(--red)'}},probN)):null),
          ce('div',{style:{maxHeight:'72vh',overflowY:'auto'}},
            col.items.length===0?ce('div',{style:{fontSize:12,color:'var(--text3)',textAlign:'center',padding:16}},col.free?'Все машины распределены':'Нет машин'):
            col.items.map(t=>ce(ManagerCard,{key:t.id,t:t,onUpdate:onUpdate}))));
      })));
}
function ManagerKPI({trucks,orders,history}){
  const inWork = t=>MOVING.includes(t.status);
  const hasBack = t=>!!(t.backCargo&&(t.backCargo.cargo||t.backCargo.from||t.backCargo.to));
  const overdue = t=>inWork(t)&&t.freeAt&&(new Date(t.freeAt).getTime()<now());
  const stale = t=>{ if(!inWork(t)||!t.lastTime) return false; var d=new Date(t.lastTime); if(isNaN(d.getTime())) return false; return (now()-d.getTime())>6*3600*1000; };
  const ago = iso=>{ if(!iso) return '—'; var d=new Date(iso); if(isNaN(d.getTime())) return '—'; var m=Math.round((now()-d.getTime())/60000); if(m<0) m=0; if(m<1) return 'только что'; if(m<60) return m+' мин'; var h=Math.floor(m/60); if(h<24) return h+' ч'; return Math.floor(h/24)+' дн'; };
  const total=trucks.length, moving=trucks.filter(inWork).length, free=trucks.filter(t=>t.status==='FREE').length,
        prob=trucks.filter(t=>t.problem).length, svc=trucks.filter(t=>t.onService||t.status==='SERVICE').length,
        back=trucks.filter(t=>inWork(t)&&hasBack(t)).length, late=trucks.filter(overdue).length,
        util=total?Math.round(moving/total*100):0, backPct=moving?Math.round(back/moving*100):0;
  const th={textAlign:'left',padding:'9px 10px',fontSize:11,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.3px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'};
  const td={padding:'10px',fontSize:13,color:'var(--text)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'};
  const stat=(label,val,col,sub)=>ce('div',{style:{flex:'1 1 130px',minWidth:130,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px'}},
    ce('div',{style:{fontSize:10.5,color:'var(--text3)',fontWeight:700,marginBottom:4,textTransform:'uppercase',letterSpacing:'.4px'}},label),
    ce('div',{style:{fontSize:23,fontWeight:800,color:col||'var(--text)'}},val),
    sub?ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:2}},sub):null);
  const bar=u=>ce('span',{style:{display:'inline-flex',alignItems:'center',gap:7}},
    ce('span',{style:{width:48,height:7,borderRadius:4,background:'var(--bg3)',display:'inline-block',position:'relative',overflow:'hidden',flexShrink:0}},
      ce('span',{style:{position:'absolute',left:0,top:0,bottom:0,width:u+'%',background:u>=66?'var(--green)':(u>=33?'var(--amber)':'var(--red)')}})),
    ce('span',{style:{fontWeight:700}},u+'%'));
  const groups=LOGISTS.map(lg=>({name:lg,color:LOGIST_COLOR[lg],ts:trucks.filter(t=>t.logist===lg)}));
  groups.push({name:'Без логиста',color:'var(--text3)',ts:trucks.filter(t=>!t.logist)});
  function logistRow(g){ var m=g.ts.filter(inWork).length, f=g.ts.filter(t=>t.status==='FREE').length, p=g.ts.filter(t=>t.problem).length,
      b=g.ts.filter(t=>inWork(t)&&hasBack(t)).length, lt=g.ts.filter(overdue).length, u=g.ts.length?Math.round(m/g.ts.length*100):0;
    return ce('tr',{key:g.name},
      ce('td',{style:td},ce('span',{style:{display:'inline-flex',alignItems:'center',gap:7,fontWeight:800,color:g.color}},
        ce('span',{style:{width:9,height:9,borderRadius:3,background:g.color,display:'inline-block'}}),g.name)),
      ce('td',{style:Object.assign({},td,{fontWeight:700})},g.ts.length),
      ce('td',{style:td},ce('span',{style:{color:'var(--accent)',fontWeight:700}},m)),
      ce('td',{style:td},ce('span',{style:{color:'var(--green)',fontWeight:700}},f)),
      ce('td',{style:td},bar(u)),
      ce('td',{style:td},m>0?ce('span',{style:{fontWeight:700,color:b===m?'var(--green)':(b>0?'var(--cyan)':'var(--amber)')}},b+'/'+m):ce('span',{style:{color:'var(--text3)'}},'—')),
      ce('td',{style:td},lt>0?ce('span',{style:{color:'var(--red)',fontWeight:800}},'⏰ '+lt):ce('span',{style:{color:'var(--text3)'}},'0')),
      ce('td',{style:td},p>0?ce('span',{style:{color:'var(--red)',fontWeight:800}},'⚠ '+p):ce('span',{style:{color:'var(--text3)'}},'0')));
  }
  const rank=t=>t.problem?0:(overdue(t)?1:(inWork(t)?2:3));
  const drivers=trucks.slice().sort((a,b)=>rank(a)-rank(b));
  function driverRow(t){ var od=overdue(t), st=stale(t);
    return ce('tr',{key:t.id,style:{background:t.problem?'color-mix(in srgb,var(--red) 7%,transparent)':(od?'color-mix(in srgb,var(--amber) 8%,transparent)':'transparent')}},
      ce('td',{style:Object.assign({},td,{fontWeight:700})},t.driver||'—'),
      ce('td',{style:td},t.plate),
      ce('td',{style:td},t.logist?ce('span',{style:{color:LOGIST_COLOR[t.logist]||'var(--text)',fontWeight:700}},t.logist):ce('span',{style:{color:'var(--text3)'}},'—')),
      ce('td',{style:td},ce(Pill,{status:t.status})),
      ce('td',{style:td},inWork(t)?(t.freeAt?ce('span',{style:{color:od?'var(--red)':'var(--text2)',fontWeight:od?800:400}},(od?'⏰ ':'')+fmtDT(t.freeAt)):ce('span',{style:{color:'var(--text3)'}},'—')):ce('span',{style:{color:'var(--text3)'}},'—')),
      ce('td',{style:Object.assign({},td,{color:st?'var(--amber)':'var(--text2)',fontWeight:st?700:400})},(st?'⚠ ':'')+ago(t.lastTime)),
      ce('td',{style:td},t.problem?ce('span',{style:{color:'var(--red)',fontWeight:800}},'⚠'):(od?ce('span',{style:{color:'var(--red)'}},'⏰'):ce('span',{style:{color:'var(--green)'}},'✓'))));
  }
  const sect=t=>ce('div',{style:{fontSize:13,fontWeight:800,color:'var(--text2)',marginBottom:9}},t);
  const tableWrap=(minW,inner)=>ce('div',{style:{overflowX:'auto',border:'1px solid var(--border)',borderRadius:12,marginBottom:22}},
    ce('table',{style:{width:'100%',borderCollapse:'collapse',minWidth:minW}},inner));
  const [period,setPeriod]=useState('7');
  const pdays=period==='1'?1:(period==='7'?7:30);
  const pcut=(function(){ if(period==='1'){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); } return now()-pdays*86400000; })();
  const hist=(history||[]).filter(function(e){ return e&&e.ts&&(new Date(e.ts).getTime()>=pcut); });
  const _done=e=>e.action==='done', _prob=e=>e.action==='problem', _load=e=>e.action==='loaded';
  const pstat=list=>({done:list.filter(_done).length,load:list.filter(_load).length,prob:list.filter(_prob).length,total:list.length});
  const perLog=LOGISTS.map(function(lg){ return {name:lg,color:LOGIST_COLOR[lg],st:pstat(hist.filter(function(e){return e.logist===lg;}))}; });
  perLog.push({name:'Без логиста',color:'var(--text3)',st:pstat(hist.filter(function(e){return !e.logist;}))});
  var _byd={}; hist.forEach(function(e){ var k=(e.plate||'')+'|'+(e.driver||''); if(!_byd[k]) _byd[k]={plate:e.plate,driver:e.driver,logist:e.logist,ev:[]}; _byd[k].ev.push(e); });
  const drvStat=Object.keys(_byd).map(function(k){ var d=_byd[k]; return {plate:d.plate,driver:d.driver,logist:d.logist,st:pstat(d.ev)}; }).sort(function(a,b){ return (b.st.done-a.st.done)||(b.st.total-a.st.total); });
  const recent=hist.slice().sort(function(a,b){ return (a.ts||'')<(b.ts||'')?1:-1; }).slice(0,15);
  const aIcon=a=>a==='problem'?'⚠':(a==='done'?'✅':(a==='loaded'?'📦':'🚚'));
  const aColor=a=>a==='problem'?'var(--red)':(a==='done'?'var(--green)':(a==='loaded'?'var(--accent)':'var(--text3)'));
  const periodBtn=(v,l)=>ce('button',{key:v,className:'fl-press',onClick:()=>setPeriod(v),style:{padding:'7px 14px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:800,border:'none',background:period===v?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--bg2)',color:period===v?'#fff':'var(--text3)'}},l);
  return ce('div',null,
    sect('📦 Сводка автопарка'),
    ce('div',{style:{display:'flex',gap:10,flexWrap:'wrap',marginBottom:22}},
      stat('Всего машин',total,'var(--text)'),
      stat('В рейсе',moving,'var(--accent)',util+'% загрузка'),
      stat('Свободно',free,'var(--green)'),
      stat('С обраткой',back,back>0?'var(--cyan)':'var(--text)',moving?backPct+'% рейсов':'нет рейсов'),
      stat('Опаздывают',late,late>0?'var(--red)':'var(--text)'),
      stat('Проблемы',prob,prob>0?'var(--red)':'var(--text)'),
      stat('На ТО',svc,'var(--amber)')),
    sect('👤 KPI логистов'),
    tableWrap(620, ce('div',null,
      ce('thead',null,ce('tr',null,['Логист','Машин','В рейсе','Свободно','Загрузка','Обратка','Опоздания','Проблемы'].map(h=>ce('th',{key:h,style:th},h)))),
      ce('tbody',null,groups.map(logistRow)))),
    sect('🚛 KPI водителей'),
    tableWrap(640, ce('div',null,
      ce('thead',null,ce('tr',null,['Водитель','Машина','Логист','Статус','Освободится','Отметка','OK'].map((h,i)=>ce('th',{key:i,style:th},h)))),
      ce('tbody',null,drivers.map(driverRow)))),
    sect('📈 Итоги за период'),
    ce('div',{style:{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}},
      periodBtn('1','Сегодня'),periodBtn('7','7 дней'),periodBtn('30','30 дней'),
      ce('span',{style:{fontSize:11.5,color:'var(--text3)',marginLeft:6}},'событий: '+hist.length)),
    hist.length===0?ce('div',{style:{fontSize:12.5,color:'var(--text3)',padding:'14px 4px',marginBottom:22}},'Пока нет данных за период. Журнал наполняется автоматически, когда водители отмечают статусы (загрузка, выгрузка, «Завершил рейс», «Проблема»).'):ce('div',null,
      tableWrap(560, ce('div',null,
        ce('thead',null,ce('tr',null,['Логист','Завершено','Загрузок','Проблем','Отметок'].map(h=>ce('th',{key:h,style:th},h)))),
        ce('tbody',null,perLog.map(function(g){ return ce('tr',{key:g.name},
          ce('td',{style:td},ce('span',{style:{display:'inline-flex',alignItems:'center',gap:7,fontWeight:800,color:g.color}},ce('span',{style:{width:9,height:9,borderRadius:3,background:g.color,display:'inline-block'}}),g.name)),
          ce('td',{style:Object.assign({},td,{fontWeight:800,color:'var(--green)'})},g.st.done),
          ce('td',{style:td},g.st.load),
          ce('td',{style:td},g.st.prob>0?ce('span',{style:{color:'var(--red)',fontWeight:700}},g.st.prob):'0'),
          ce('td',{style:Object.assign({},td,{color:'var(--text2)'})},g.st.total)); })))),
      drvStat.length>0?ce('div',null,
        ce('div',{style:{fontSize:12,fontWeight:800,color:'var(--text3)',margin:'2px 0 8px'}},'По водителям'),
        tableWrap(560, ce('div',null,
          ce('thead',null,ce('tr',null,['Водитель','Машина','Логист','Завершено','Проблем','Отметок'].map((h,i)=>ce('th',{key:i,style:th},h)))),
          ce('tbody',null,drvStat.map(function(d,i){ return ce('tr',{key:i},
            ce('td',{style:Object.assign({},td,{fontWeight:700})},d.driver||'—'),
            ce('td',{style:td},d.plate||'—'),
            ce('td',{style:td},d.logist?ce('span',{style:{color:LOGIST_COLOR[d.logist]||'var(--text)',fontWeight:700}},d.logist):'—'),
            ce('td',{style:Object.assign({},td,{fontWeight:800,color:'var(--green)'})},d.st.done),
            ce('td',{style:td},d.st.prob>0?ce('span',{style:{color:'var(--red)',fontWeight:700}},d.st.prob):'0'),
            ce('td',{style:Object.assign({},td,{color:'var(--text2)'})},d.st.total)); }))))):null,
      ce('div',{style:{fontSize:12,fontWeight:800,color:'var(--text3)',margin:'2px 0 8px'}},'Последние события'),
      ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',marginBottom:16}},
        recent.map(function(e,i){ return ce('div',{key:i,style:{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderBottom:i<recent.length-1?'1px solid var(--border)':'none',fontSize:12.5}},
          ce('span',{style:{fontSize:14}},aIcon(e.action)),
          ce('span',{style:{color:'var(--text3)',minWidth:96,fontSize:11.5}},e.ts?fmtDT(e.ts):''),
          ce('span',{style:{fontWeight:700,color:'var(--text)'}},e.plate||'—'),
          ce('span',{style:{color:'var(--text2)'}},e.driver||''),
          e.logist?ce('span',{style:{color:LOGIST_COLOR[e.logist]||'var(--text3)',fontWeight:700,fontSize:11.5}},e.logist):null,
          ce('span',{style:{marginLeft:'auto',color:aColor(e.action),fontWeight:700}},e.label||e.action)); }))),
    ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:4,lineHeight:1.6}},
      '«Обратка» — сколько машин в рейсе едут с обратным грузом (а не порожняком), напр. 3/5. «Опоздания» — расчётное время освобождения уже прошло, а машина ещё в рейсе. «Отметка» — когда водитель последний раз отмечал статус; ⚠ если не отмечался больше 6 часов. Итоги за период считаются из журнала отметок водителей.'));
}
function ChatModal({role,onClose,onSeen}){
  const [msgs,setMsgs]=useState([]);
  const [txt,setTxt]=useState('');
  const [snd,setSnd]=useState(false);
  const endRef=useRef(null);
  const load=()=>dbGet('/chat/messages').then(function(o){ if(!o){setMsgs([]);return;} var a=Object.keys(o).map(function(k){return o[k];}).filter(Boolean).sort(function(x,y){return (x.ts||'')<(y.ts||'')?-1:1;}); setMsgs(a.slice(-100)); }).catch(function(){});
  useEffect(()=>{ load(); var iv=setInterval(load,8000); return ()=>clearInterval(iv); },[]);
  useEffect(()=>{ if(endRef.current&&endRef.current.scrollIntoView) endRef.current.scrollIntoView({block:'end'}); },[msgs]);
  useEffect(()=>{ if(msgs.length&&onSeen) onSeen(msgs[msgs.length-1].ts||''); },[msgs]);
  const send=()=>{ var t=(txt||'').trim(); if(!t) return; var id=String(Date.now())+Math.random().toString(36).slice(2,6);
    var m={from:'office',name:role||'Диспетчер',text:t,ts:nowLocalISO()}; setSnd(true);
    var patch={}; patch['messages/'+id]=m; patch['last']={ts:m.ts,from:'office',name:m.name};
    dbPatch('/chat',patch).then(function(){ setTxt(''); return load(); }).then(function(){ setSnd(false); }).catch(function(){ setSnd(false); }); };
  return ce(Modal,{title:'💬 Чат водителей',onClose,wide:true},
    ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:8,lineHeight:1.5}},'Общий чат: видят все водители и диспетчерская. Вы пишете как «'+(role||'Диспетчер')+'».'),
    ce('div',{style:{height:'56vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:9,padding:'4px 2px',marginBottom:10}},
      msgs.length===0?ce('div',{style:{color:'var(--text3)',textAlign:'center',marginTop:24,fontSize:13}},'Сообщений пока нет.'):
      msgs.map(function(m,i){ var mine=(m.from==='office'&&m.name===role); var drv=(m.from==='driver');
        return ce('div',{key:i,style:{alignSelf:mine?'flex-end':'flex-start',maxWidth:'82%'}},
          ce('div',{style:{fontSize:10.5,fontWeight:700,marginBottom:2,textAlign:mine?'right':'left',color:drv?'var(--amber)':'var(--cyan)'}},
            mine?'Вы':((drv?'🚛 ':'🏢 ')+(m.name||'—')+((m.plate&&drv)?(' · '+m.plate):''))),
          ce('div',{style:{padding:'8px 11px',borderRadius:13,fontSize:13.5,lineHeight:1.4,whiteSpace:'pre-wrap',
            background:mine?'var(--accent)':(drv?'color-mix(in srgb,var(--amber) 12%,transparent)':'var(--bg3)'),
            color:mine?'#fff':'var(--text)',border:mine?'none':'1px solid var(--border)'}},
            (m.text||''),
            m.geo?ce('div',{style:{marginTop:6}},ce('a',{href:'https://maps.google.com/?q='+m.geo.lat+','+m.geo.lng,target:'_blank',rel:'noopener',
              style:{color:mine?'#cfe0ff':'var(--cyan)',fontWeight:700,fontSize:12.5}},'🗺 Открыть на карте')):null),
          ce('div',{style:{fontSize:9.5,color:'var(--text3)',marginTop:2,textAlign:mine?'right':'left'}}, m.ts?fmtDT(m.ts):'')); }),
      ce('div',{ref:endRef})),
    ce('div',{style:{display:'flex',gap:8,alignItems:'flex-end'}},
      ce('textarea',{value:txt,onChange:e=>setTxt(e.target.value),placeholder:'Сообщение водителям…',rows:1,
        onKeyDown:e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } },
        style:{flex:1,resize:'none',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:11,padding:'11px 12px',color:'var(--text)',fontSize:14,fontFamily:'inherit',maxHeight:120}}),
      ce('button',{onClick:send,disabled:snd,className:'fl-press',style:{flexShrink:0,height:44,padding:'0 18px',borderRadius:11,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:800,fontSize:16,
        background:'linear-gradient(135deg,var(--accent),var(--accent2))',color:'#fff',opacity:snd?0.6:1}},'➤')));
}
// ═══════════ МЕХАНИК ═══════════
function fld(label,input){ return ce('div',{style:{display:'flex',flexDirection:'column',gap:4}}, ce('div',{style:{fontSize:10.5,color:'var(--text3)',fontWeight:700}},label), input); }
const mecInp={background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:9,padding:'7px 9px',color:'var(--text)',fontSize:13,fontFamily:'inherit',width:'100%'};
function dashCard(label,val,color){
  return ce('div',{style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:13,padding:'14px 16px'}},
    ce('div',{style:{fontSize:24,fontWeight:800,color:color}},val),
    ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginTop:2}},label));
}
function MechLegend(){
  const [open,setOpen]=useState(false);
  const tk=n=>Math.round(n/1000)+' тыс. км';
  const row=(icon,name,rule)=>ce('div',{key:name,style:{display:'flex',gap:10,padding:'8px 12px',borderBottom:'1px solid var(--border)',fontSize:12.5,alignItems:'baseline'}},
    ce('span',{style:{fontSize:13,width:18,flexShrink:0}},icon),
    ce('span',{style:{fontWeight:800,minWidth:170,flexShrink:0}},name),
    ce('span',{style:{color:'var(--text2)',lineHeight:1.5}},rule));
  return ce('div',{style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:13,marginBottom:20,overflow:'hidden'}},
    ce('button',{className:'fl-press',onClick:()=>setOpen(!open),style:{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'12px 16px',
      background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',color:'var(--text)',fontSize:13.5,fontWeight:800,textAlign:'left'}},
      ce('span',null,'ℹ️'),'Как считаются статусы',
      ce('span',{style:{marginLeft:'auto',color:'var(--text3)',fontSize:12,fontWeight:600}},open?'скрыть ▲':'показать ▼')),
    open?ce('div',null,
      ce('div',{style:{padding:'10px 16px',fontSize:12,color:'var(--text3)',lineHeight:1.6,borderBottom:'1px solid var(--border)'}},
        'Пробег по ТО и шинам считается так: ',ce('b',null,'текущий пробег тягача − пробег на момент последней замены/ТО'),'. У прицепа своего одометра нет, поэтому берётся пробег ',ce('b',null,'привязанного тягача'),' — если тягач не привязан, покажет «нет данных».'),
      row('🔧','ТО тягача','каждые '+tk(TO_TRACTOR_KM)+'. Жёлтый — когда осталось меньше '+tk(TO_TRACTOR_WARN_KM)+', красный — просрочено.'),
      row('🔧','ТО прицепа','каждые '+tk(TO_TRAILER_KM)+'. Жёлтый — меньше '+tk(TO_TRAILER_WARN_KM)+'.'),
      row('🛞','Шины: рулевая ось','показываем, сколько шина уже прошла. Ресурс '+tk(TIRE_STEER_KM)+': жёлтый — когда до ресурса осталось меньше '+tk(TIRE_WARN_KM)+', красный — ресурс исчерпан.'),
      row('🛞','Шины: ведущая ось','то же самое, ресурс '+tk(TIRE_DRIVE_KM)+'.'),
      row('🛞','Шины прицепа (1/2/3 ось)','ресурс '+tk(TIRE_TRAILER_KM)+' на каждую ось отдельно, пробег считается по тягачу, который её возит.'),
      row('❄️','ТО установки (термокинг)','раз в '+UNIT_SERVICE_DAYS+' дней (~6 мес.) от даты последнего ТО. Вводится дата последнего ТО — срок следующего считается сам.'),
      row('📅','Техосмотр, FRC, тарировка,\u00A0пропуск, страховка, КАСКО','по дате окончания. Жёлтый — осталось '+DATE_WARN_DAYS+' дней или меньше, красный — дата прошла.'),
      row('🔋','Замена АКБ','просто дата последней замены, без срока — цвет не меняется.'),
      ce('div',{style:{display:'flex',gap:16,padding:'10px 16px',fontSize:12,flexWrap:'wrap'}},
        ce('span',{style:{color:'var(--green)',fontWeight:700}},'🟢 в порядке'),
        ce('span',{style:{color:'var(--amber)',fontWeight:700}},'🟡 скоро'),
        ce('span',{style:{color:'var(--red)',fontWeight:700}},'🔴 просрочено'),
        ce('span',{style:{color:'var(--text3)',fontWeight:700}},'⚪ нет данных — поле не заполнено'))):null);
}
function MechDash({tractors,trailers,acts,onJump}){
  const items=[];
  tractors.forEach(function(t){
    items.push({plate:t.plate||'—',cat:'ТО тягача',s:kmStatus(t.odometer,t.toMileage,TO_TRACTOR_KM,TO_TRACTOR_WARN_KM),jump:'tractors'});
    items.push({plate:t.plate||'—',cat:'Шины руль',s:tireStatus(t.odometer,t.tireSteer,TIRE_STEER_KM,TIRE_WARN_KM),jump:'tractors'});
    items.push({plate:t.plate||'—',cat:'Шины ведущая',s:tireStatus(t.odometer,t.tireDrive,TIRE_DRIVE_KM,TIRE_WARN_KM),jump:'tractors'});
    items.push({plate:t.plate||'—',cat:'Техосмотр',s:dateStatus(t.techInsp),jump:'tractors'});
    items.push({plate:t.plate||'—',cat:'Тарировка тахографа',s:dateStatus(t.tachograph),jump:'tractors'});
    items.push({plate:t.plate||'—',cat:'Пропуск РФ',s:dateStatus(t.pass),jump:'tractors'});
    items.push({plate:t.plate||'—',cat:'Страховка',s:dateStatus(t.insurance),jump:'tractors'});
    items.push({plate:t.plate||'—',cat:'КАСКО',s:dateStatus(t.kasko),jump:'tractors'});
  });
  trailers.forEach(function(tr){
    var pt=tractors.find(function(x){return x.plate===tr.pairedTractor;});
    var odo=pt?pt.odometer:null;
    items.push({plate:tr.plate||'—',cat:'ТО прицепа',s:kmStatus(odo,tr.toMileage,TO_TRAILER_KM,TO_TRAILER_WARN_KM),jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'Шины прицепа 1 ось',s:tireStatus(odo,axleVal(tr,1),TIRE_TRAILER_KM,TIRE_WARN_KM),jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'Шины прицепа 2 ось',s:tireStatus(odo,axleVal(tr,2),TIRE_TRAILER_KM,TIRE_WARN_KM),jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'Шины прицепа 3 ось',s:tireStatus(odo,axleVal(tr,3),TIRE_TRAILER_KM,TIRE_WARN_KM),jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'Техосмотр прицепа',s:dateStatus(tr.techInsp),jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'FRC',s:dateStatus(tr.frc),jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'ТО установки',s:tr.unitService?dateStatus(addDaysISO(tr.unitService,UNIT_SERVICE_DAYS)):{st:'unknown',label:'нет данных',color:'var(--text3)'},jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'ТО полное установки',s:tr.unitFullService?dateStatus(addDaysISO(tr.unitFullService,UNIT_FULL_SERVICE_DAYS)):{st:'unknown',label:'нет данных',color:'var(--text3)'},jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'Страховка',s:dateStatus(tr.insurance),jump:'trailers'});
    items.push({plate:tr.plate||'—',cat:'КАСКО',s:dateStatus(tr.kasko),jump:'trailers'});
  });
  const red=items.filter(function(i){return i.s.st==='red';});
  const amber=items.filter(function(i){return i.s.st==='amber';});
  const openActs=acts.filter(function(a){return !a.resolved;});
  const sorted=red.concat(amber);
  return ce('div',null,
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}},
      dashCard('🚚 Тягачей',tractors.length,'var(--accent)'),
      dashCard('🚛 Прицепов',trailers.length,'var(--accent)'),
      dashCard('🔴 Критично',red.length,'var(--red)'),
      dashCard('🟡 Скоро',amber.length,'var(--amber)'),
      dashCard('📋 Незакрытых актов',openActs.length,'var(--violet)')),
    ce(MechLegend,null),
    ce('div',{style:{fontWeight:800,fontSize:14,marginBottom:10,color:'var(--text)'}},'⚠ Требуют внимания'),
    sorted.length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'16px 4px'}},'Всё в порядке — просроченных и скорых пунктов нет.'):
    ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
      sorted.map(function(it,i){ return ce('div',{key:i,className:'fl-press',onClick:function(){onJump(it.jump);},style:{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',
        borderBottom:i<sorted.length-1?'1px solid var(--border)':'none',fontSize:13}},
        ce('span',{style:{width:8,height:8,borderRadius:8,background:it.s.color,flexShrink:0}}),
        ce('span',{style:{fontWeight:800,minWidth:90}},it.plate),
        ce('span',{style:{color:'var(--text3)',minWidth:150}},it.cat),
        ce('span',{style:{marginLeft:'auto',fontWeight:700,color:it.s.color}},it.s.label)); })));
}
function TractorCard({t,onUpd,onDel}){
  const to=kmStatus(t.odometer,t.toMileage,TO_TRACTOR_KM,TO_TRACTOR_WARN_KM);
  const ts=tireStatus(t.odometer,t.tireSteer,TIRE_STEER_KM,TIRE_WARN_KM);
  const td=tireStatus(t.odometer,t.tireDrive,TIRE_DRIVE_KM,TIRE_WARN_KM);
  const ti=dateStatus(t.techInsp), ta=dateStatus(t.tachograph), pa=dateStatus(t.pass);
  const ins=dateStatus(t.insurance), kas=dateStatus(t.kasko);
  const akb=t.akbDate?{st:'green',label:'замена '+fmtD(t.akbDate),color:'var(--text2)'}:{st:'unknown',label:'нет данных',color:'var(--text3)'};
  const num=function(field){ return {defaultValue:t[field]||'',onBlur:function(e){ onUpd(t.id,(function(){var o={};o[field]=e.target.value.replace(',','.').trim();return o;})()); },style:mecInp,inputMode:'numeric'}; };
  const dat=function(field){ return {type:'date',defaultValue:t[field]||'',onBlur:function(e){ onUpd(t.id,(function(){var o={};o[field]=e.target.value;return o;})()); },style:mecInp}; };
  return ce('div',{className:'fl-card',style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:14,boxShadow:'var(--shadow)'}},
    ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:10}},
      ce('input',{defaultValue:t.plate||'',onBlur:function(e){ onUpd(t.id,{plate:e.target.value.trim()}); },style:Object.assign({},mecInp,{fontWeight:800,fontSize:15,flex:1})}),
      ce('button',{onClick:function(){ if(window.confirm('Удалить тягач '+(t.plate||'')+' из списка механика?')) onDel(t.id); },className:'fl-press',
        style:{width:32,height:32,borderRadius:8,border:'1px solid color-mix(in srgb,var(--red) 45%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer',fontSize:15,flexShrink:0}},'🗑')),
    ce('div',{style:{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}},
      ce(StatusPill,{s:to,label:'ТО'}),ce(StatusPill,{s:ts,label:'Шины руль'}),ce(StatusPill,{s:td,label:'Шины ведущая'}),
      ce(StatusPill,{s:ti,label:'Техосмотр'}),ce(StatusPill,{s:ta,label:'Тарировка'}),ce(StatusPill,{s:pa,label:'Пропуск РФ'}),
      ce(StatusPill,{s:ins,label:'Страховка'}),ce(StatusPill,{s:kas,label:'КАСКО'}),ce(StatusPill,{s:akb,label:'АКБ'})),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}},
      fld('Текущий пробег, км',ce('input',num('odometer'))),
      fld('Пробег на посл. ТО',ce('input',num('toMileage'))),
      fld('Пробег замены шин (руль)',ce('input',num('tireSteer'))),
      fld('Пробег замены шин (ведущая)',ce('input',num('tireDrive'))),
      fld('Техосмотр до',ce('input',dat('techInsp'))),
      fld('Тарировка тахографа до',ce('input',dat('tachograph'))),
      fld('Пропуск РФ до',ce('input',dat('pass'))),
      fld('Страховка (ОСАГО) до',ce('input',dat('insurance'))),
      fld('КАСКО до',ce('input',dat('kasko'))),
      fld('Дата замены АКБ',ce('input',dat('akbDate'))), null),
    ce('textarea',{defaultValue:t.note||'',onBlur:function(e){ onUpd(t.id,{note:e.target.value}); },placeholder:'Заметка…',rows:2,
      style:Object.assign({},mecInp,{resize:'vertical'})}));
}
function MechTractors({tractors,onAdd,onUpd,onDel,onBulk,onBulkCreate}){
  const [paste,setPaste]=useState(false);
  const [capOdo,setCapOdo]=useState(false);
  const add=function(){ var p=window.prompt('Гос.номер тягача:'); if(p&&p.trim()) onAdd(p.trim()); };
  return ce('div',null,
    paste?ce(MileagePasteModal,{tractors:tractors,onApply:onBulk,onCreate:onBulkCreate,onClose:function(){setPaste(false);}}):null,
    capOdo?ce(CapOdometerModal,{tractors:tractors,onApply:onBulk,onClose:function(){setCapOdo(false);}}):null,
    ce('div',{style:{display:'flex',justifyContent:'flex-end',gap:9,marginBottom:12}},
      ce('button',{className:'fl-press',onClick:function(){setCapOdo(true);},style:{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--cyan) 55%,transparent)',background:'color-mix(in srgb,var(--cyan) 16%,transparent)',color:'var(--cyan)',fontWeight:800,fontSize:12.5}},'📡 Пробеги из CapNavi'),
      ce('button',{className:'fl-press',onClick:function(){setPaste(true);},style:{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--accent) 50%,transparent)',background:'color-mix(in srgb,var(--accent) 14%,transparent)',color:'var(--accent)',fontWeight:800,fontSize:12.5}},'📋 Вставить пробеги'),
      ce('button',{className:'fl-press',onClick:add,style:{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12.5}},'➕ Добавить тягач')),
    tractors.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Пока нет тягачей в этом списке.'):
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:14}},
      tractors.map(function(t){ return ce(TractorCard,{key:t.id,t:t,onUpd:onUpd,onDel:onDel}); })));
}
function TrailerCard({tr,tractors,onUpd,onDel}){
  const pt=tractors.find(function(x){return x.plate===tr.pairedTractor;});
  const odo=pt?pt.odometer:null;
  const to=kmStatus(odo,tr.toMileage,TO_TRAILER_KM,TO_TRAILER_WARN_KM);
  const ts1=tireStatus(odo,axleVal(tr,1),TIRE_TRAILER_KM,TIRE_WARN_KM);
  const ts2=tireStatus(odo,axleVal(tr,2),TIRE_TRAILER_KM,TIRE_WARN_KM);
  const ts3=tireStatus(odo,axleVal(tr,3),TIRE_TRAILER_KM,TIRE_WARN_KM);
  const frc=dateStatus(tr.frc);
  const tinsp=dateStatus(tr.techInsp);
  const ins=dateStatus(tr.insurance), kas=dateStatus(tr.kasko);
  const akb=tr.akbDate?{st:'green',label:'замена '+fmtD(tr.akbDate),color:'var(--text2)'}:{st:'unknown',label:'нет данных',color:'var(--text3)'};
  const unit=tr.unitService?dateStatus(addDaysISO(tr.unitService,UNIT_SERVICE_DAYS)):{st:'unknown',label:'нет данных',color:'var(--text3)'};
  const unitFull=tr.unitFullService?dateStatus(addDaysISO(tr.unitFullService,UNIT_FULL_SERVICE_DAYS)):{st:'unknown',label:'нет данных',color:'var(--text3)'};
  const txt=function(field){ return {defaultValue:tr[field]||'',onBlur:function(e){ onUpd(tr.id,(function(){var o={};o[field]=e.target.value.trim();return o;})()); },style:mecInp}; };
  const num=function(field){ return {defaultValue:tr[field]||'',onBlur:function(e){ onUpd(tr.id,(function(){var o={};o[field]=e.target.value.replace(',','.').trim();return o;})()); },style:mecInp,inputMode:'numeric'}; };
  const dat=function(field){ return {type:'date',defaultValue:tr[field]||'',onBlur:function(e){ onUpd(tr.id,(function(){var o={};o[field]=e.target.value;return o;})()); },style:mecInp}; };
  return ce('div',{className:'fl-card',style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:14,boxShadow:'var(--shadow)'}},
    ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:10}},
      ce('input',{defaultValue:tr.plate||'',onBlur:function(e){ onUpd(tr.id,{plate:e.target.value.trim()}); },style:Object.assign({},mecInp,{fontWeight:800,fontSize:15,flex:1})}),
      ce('button',{onClick:function(){ if(window.confirm('Удалить прицеп '+(tr.plate||'')+' из списка механика?')) onDel(tr.id); },className:'fl-press',
        style:{width:32,height:32,borderRadius:8,border:'1px solid color-mix(in srgb,var(--red) 45%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer',fontSize:15,flexShrink:0}},'🗑')),
    ce('div',{style:{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}},
      ce(StatusPill,{s:to,label:'ТО прицепа'}),ce(StatusPill,{s:ts1,label:'Шины 1 ось'}),ce(StatusPill,{s:ts2,label:'Шины 2 ось'}),ce(StatusPill,{s:ts3,label:'Шины 3 ось'}),ce(StatusPill,{s:tinsp,label:'Техосмотр'}),ce(StatusPill,{s:frc,label:'FRC'}),ce(StatusPill,{s:unit,label:'ТО установки'}),ce(StatusPill,{s:unitFull,label:'ТО полное'}),
      ce(StatusPill,{s:ins,label:'Страховка'}),ce(StatusPill,{s:kas,label:'КАСКО'}),ce(StatusPill,{s:akb,label:'АКБ'})),
    (!pt&&tr.pairedTractor)?ce('div',{style:{fontSize:11,color:'var(--amber)',marginBottom:8}},'⚠ Тягач «'+tr.pairedTractor+'» не найден в списке тягачей — ТО и шины считаются как «нет данных».'):null,
    (!tr.pairedTractor)?ce('div',{style:{fontSize:11,color:'var(--text3)',marginBottom:8}},'Привяжите тягач ниже — ТО и шины прицепа считаются по его пробегу.'):null,
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}},
      fld('Экономический №',ce('input',txt('econ'))),
      fld('Тягач (гос.номер)',ce('select',{value:tr.pairedTractor||'',onChange:function(e){ onUpd(tr.id,{pairedTractor:e.target.value}); },style:mecInp},
        ce('option',{value:''},'— не привязан —'),
        tractors.map(function(x){ return ce('option',{key:x.id,value:x.plate},x.plate||'—'); }))),
      fld('Пробег тягача на посл. ТО прицепа',ce('input',num('toMileage'))),
      fld('Замена шин: 1 ось (пробег тягача)',ce('input',{defaultValue:axleVal(tr,1),onBlur:function(e){ onUpd(tr.id,{tireAxle1:e.target.value.replace(',','.').trim()}); },style:mecInp,inputMode:'numeric'})),
      fld('Замена шин: 2 ось (пробег тягача)',ce('input',{defaultValue:axleVal(tr,2),onBlur:function(e){ onUpd(tr.id,{tireAxle2:e.target.value.replace(',','.').trim()}); },style:mecInp,inputMode:'numeric'})),
      fld('Замена шин: 3 ось (пробег тягача)',ce('input',{defaultValue:axleVal(tr,3),onBlur:function(e){ onUpd(tr.id,{tireAxle3:e.target.value.replace(',','.').trim()}); },style:mecInp,inputMode:'numeric'})),
      fld('Техосмотр до',ce('input',dat('techInsp'))),
      fld('FRC действует до',ce('input',dat('frc'))),
      fld('Тип установки',ce('select',{value:tr.unitType||'',onChange:function(e){ onUpd(tr.id,{unitType:e.target.value}); },style:mecInp},
        ce('option',{value:''},'— не указана —'),
        UNIT_TYPES.map(function(u){ return ce('option',{key:u,value:u},u); }))),
      fld('Посл. ТО установки',ce('input',dat('unitService'))),
      fld('Посл. ПОЛНОЕ ТО установки',ce('input',dat('unitFullService'))),
      fld('Страховка (ОСАГО) до',ce('input',dat('insurance'))),
      fld('КАСКО до',ce('input',dat('kasko'))),
      fld('Дата замены АКБ',ce('input',dat('akbDate')))),
    ce('textarea',{defaultValue:tr.note||'',onBlur:function(e){ onUpd(tr.id,{note:e.target.value}); },placeholder:'Заметка…',rows:2,
      style:Object.assign({},mecInp,{resize:'vertical'})}));
}
function MechTrailers({trailers,tractors,onAdd,onUpd,onDel}){
  const add=function(){ var p=window.prompt('Гос.номер прицепа:'); if(p&&p.trim()) onAdd(p.trim()); };
  return ce('div',null,
    ce('div',{style:{display:'flex',justifyContent:'flex-end',marginBottom:12}},
      ce('button',{className:'fl-press',onClick:add,style:{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12.5}},'➕ Добавить прицеп')),
    trailers.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Пока нет прицепов в этом списке.'):
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:14}},
      trailers.map(function(tr){ return ce(TrailerCard,{key:tr.id,tr:tr,tractors:tractors,onUpd:onUpd,onDel:onDel}); })));
}
function ActEditor({a,onSave,onCancel}){
  a=a||{};
  const [num_,setNum]=useState(a.num||'');
  const [driver,setDriver]=useState(a.driver||'');
  const [date,setDate]=useState(a.date||today());
  const [tractorPlate,setTractorPlate]=useState(a.tractorPlate||'');
  const [trailerPlate,setTrailerPlate]=useState(a.trailerPlate||'');
  const [tractorDefects,setTractorDefects]=useState(a.tractorDefects||'');
  const [trailerDefects,setTrailerDefects]=useState(a.trailerDefects||'');
  const save=function(){ onSave(Object.assign({},a,{num:num_,driver:driver,date:date,tractorPlate:tractorPlate,trailerPlate:trailerPlate,tractorDefects:tractorDefects,trailerDefects:trailerDefects,resolved:a.resolved||false})); };
  return ce('div',{className:'fl-card',style:{background:'var(--bg2)',border:'1px solid var(--accent)',borderRadius:14,padding:16,marginBottom:14,boxShadow:'var(--shadow)'}},
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}},
      fld('№ акта',ce('input',{value:num_,onChange:function(e){setNum(e.target.value);},style:mecInp})),
      fld('Водитель',ce('input',{value:driver,onChange:function(e){setDriver(e.target.value);},style:mecInp})),
      fld('Дата',ce('input',{type:'date',value:date,onChange:function(e){setDate(e.target.value);},style:mecInp})),
      fld('Тягач (гос.номер)',ce('input',{value:tractorPlate,onChange:function(e){setTractorPlate(e.target.value);},style:mecInp})),
      fld('Прицеп (гос.номер)',ce('input',{value:trailerPlate,onChange:function(e){setTrailerPlate(e.target.value);},style:mecInp})), null),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}},
      fld('Замечания по тягачу',ce('textarea',{value:tractorDefects,onChange:function(e){setTractorDefects(e.target.value);},rows:4,style:Object.assign({},mecInp,{resize:'vertical'})})),
      fld('Замечания по прицепу',ce('textarea',{value:trailerDefects,onChange:function(e){setTrailerDefects(e.target.value);},rows:4,style:Object.assign({},mecInp,{resize:'vertical'})}))),
    ce('div',{style:{display:'flex',gap:9}},
      ce(Btn,{onClick:onCancel,color:'var(--text3)',wide:true},'Отмена'),
      ce('button',{onClick:save,className:'fl-press',style:{flex:1,padding:'11px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}},'Сохранить')));
}
function ActFullModal({a,onClose,onEdit}){
  const line=(k,v)=>ce('div',{style:{display:'flex',gap:10,padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}},
    ce('span',{style:{color:'var(--text3)',minWidth:120,flexShrink:0}},k),
    ce('span',{style:{color:'var(--text)',fontWeight:600}},v||'—'));
  const box=(t,v,col)=>ce('div',{style:{marginTop:12}},
    ce('div',{style:{fontSize:11,fontWeight:800,color:col,marginBottom:6}},t),
    ce('div',{style:{padding:'11px 13px',borderRadius:11,background:'var(--bg3)',border:'1px solid var(--border)',
      fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap',color:'var(--text2)',minHeight:44}},v||'— замечаний нет —'));
  return ce(Modal,{title:'📋 Акт №'+(a.num||'—'),onClose,wide:true},
    ce('div',{style:{marginBottom:6}},
      ce('span',{style:{padding:'5px 12px',borderRadius:8,fontWeight:800,fontSize:12,
        background:a.resolved?'color-mix(in srgb,var(--green) 14%,transparent)':'color-mix(in srgb,var(--amber) 14%,transparent)',
        color:a.resolved?'var(--green)':'var(--amber)'}},a.resolved?'✓ Устранено':'● Открыт')),
    line('Водитель',a.driver),
    line('Дата',a.date?fmtD(a.date):null),
    line('Тягач',a.tractorPlate),
    line('Прицеп',a.trailerPlate),
    box('🚚 ЗАМЕЧАНИЯ ПО ТЯГАЧУ',a.tractorDefects,'var(--accent)'),
    box('🚛 ЗАМЕЧАНИЯ ПО ПРИЦЕПУ',a.trailerDefects,'var(--cyan)'),
    ce('div',{style:{display:'flex',gap:9,marginTop:16}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},'Закрыть'),
      onEdit?ce('button',{onClick:onEdit,className:'fl-press',style:{flex:1,padding:'12px',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',
        background:'linear-gradient(135deg,var(--accent),var(--accent2))'}},'✎ Изменить'):null));
}
function ActCard({a,onSave,onDel}){
  const [editing,setEditing]=useState(false);
  const [full,setFull]=useState(false);
  if(editing) return ce(ActEditor,{a:a,onSave:function(x){ onSave(x); setEditing(false); },onCancel:function(){ setEditing(false); }});
  const cut=s=>{ s=String(s||'').trim(); return s.length>90?(s.slice(0,88)+'…'):s; };
  return ce('div',null,
    full?ce(ActFullModal,{a:a,onClose:function(){setFull(false);},onEdit:function(){ setFull(false); setEditing(true); }}):null,
    ce('div',{className:'fl-card fl-press',onClick:function(){setFull(true);},style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:14,marginBottom:12,boxShadow:'var(--shadow)',opacity:a.resolved?0.6:1,cursor:'pointer'}},
      ce('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}},
        ce('div',{style:{fontWeight:800,fontSize:14}},'Акт №'+(a.num||'—')),
        ce('div',{style:{color:'var(--text3)',fontSize:12}},a.driver||'—'),
        ce('div',{style:{color:'var(--text3)',fontSize:12}},fmtD(a.date)),
        ce('div',{style:{color:'var(--text2)',fontSize:12}},(a.tractorPlate||'—')+' / '+(a.trailerPlate||'—')),
        ce('label',{onClick:function(e){e.stopPropagation();},style:{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:12,color:a.resolved?'var(--green)':'var(--text3)',fontWeight:700,cursor:'pointer'}},
          ce('input',{type:'checkbox',checked:!!a.resolved,onChange:function(e){ e.stopPropagation(); onSave(Object.assign({},a,{resolved:e.target.checked})); }}),
          a.resolved?'Устранено':'Открыт'),
        ce('button',{onClick:function(e){e.stopPropagation();setEditing(true);},className:'fl-press',style:{width:30,height:30,borderRadius:8,border:'1px solid var(--border2)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer'}},'✎'),
        ce('button',{onClick:function(e){ e.stopPropagation(); if(window.confirm('Удалить акт №'+(a.num||'')+'?')) onDel(a.id); },className:'fl-press',
          style:{width:30,height:30,borderRadius:8,border:'1px solid color-mix(in srgb,var(--red) 45%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer'}},'🗑')),
      ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}},
        ce('div',null, ce('div',{style:{fontSize:10.5,color:'var(--text3)',fontWeight:700,marginBottom:4}},'ТЯГАЧ'),
          ce('div',{style:{fontSize:12.5,color:'var(--text2)'}},cut(a.tractorDefects)||'—')),
        ce('div',null, ce('div',{style:{fontSize:10.5,color:'var(--text3)',fontWeight:700,marginBottom:4}},'ПРИЦЕП'),
          ce('div',{style:{fontSize:12.5,color:'var(--text2)'}},cut(a.trailerDefects)||'—'))),
      ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:8}},'нажмите — полный акт')));
}
function MechActs({acts,onSave,onDel}){
  const [adding,setAdding]=useState(false);
  const sorted=acts.slice().sort(function(a,b){ return (b.date||'')<(a.date||'')?-1:1; });
  return ce('div',null,
    ce('div',{style:{display:'flex',justifyContent:'flex-end',marginBottom:12}},
      ce('button',{className:'fl-press',onClick:function(){setAdding(true);},style:{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12.5}},'➕ Новый акт')),
    adding?ce(ActEditor,{onSave:function(a){ onSave(a); setAdding(false); },onCancel:function(){ setAdding(false); }}):null,
    sorted.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Актов пока нет.'):
    sorted.map(function(a){ return ce(ActCard,{key:a.id,a:a,onSave:onSave,onDel:onDel}); }));
}
function MechStock({tires,bags,akb,tractors,trailers,onAddTire,onUpdTire,onDelTire,onAddBag,onUpdBag,onDelBag,onAddAkb,onUpdAkb,onDelAkb}){
  tires=tires||[]; bags=bags||[]; akb=akb||[];
  const allPlates=(tractors||[]).map(function(t){return t.plate;}).concat((trailers||[]).map(function(t){return t.plate;})).filter(Boolean);
  const sum=list=>list.reduce(function(a,x){ var n=Number(x.qty); return a+(isNaN(n)?0:n); },0);
  const inp=(x,field,upd,ph)=>ce('input',{defaultValue:x[field]||'',placeholder:ph||'',onBlur:function(e){ var o={}; o[field]=e.target.value.trim(); upd(x.id,o); },style:mecInp});
  const head=(title,count,total,onAdd,label)=>ce('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'}},
    ce('div',{style:{fontWeight:800,fontSize:14}},title),
    ce('span',{style:{fontSize:12,color:'var(--text3)'}},'позиций: '+count+' · всего шт: '+total),
    ce('button',{className:'fl-press',onClick:onAdd,style:{marginLeft:'auto',padding:'7px 14px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',
      border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12}},label));
  const delBtn=(fn,id)=>ce('button',{onClick:function(){ if(window.confirm('Удалить позицию?')) fn(id); },className:'fl-press',
    style:{width:30,height:30,borderRadius:8,border:'1px solid color-mix(in srgb,var(--red) 45%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer',flexShrink:0}},'🗑');
  return ce('div',null,
    ce('div',{style:{marginBottom:26}},
      head('🛞 Шины на складе',tires.length,sum(tires),onAddTire,'➕ Добавить шины'),
      tires.length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'14px 2px'}},'Склад пуст. Добавьте позицию — размер, марку и количество.'):
      ce('div',{style:{display:'grid',gap:8}},
        tires.map(function(x){ return ce('div',{key:x.id,style:{display:'grid',gridTemplateColumns:'1.3fr 1.3fr 70px 1fr 1fr 1.4fr 30px',gap:7,alignItems:'center',
          background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:9}},
          inp(x,'size',onUpdTire,'385/65 R22.5'),
          inp(x,'brand',onUpdTire,'Марка'),
          ce('input',{defaultValue:x.qty||'',placeholder:'шт',inputMode:'numeric',onBlur:function(e){ onUpdTire(x.id,{qty:e.target.value.trim()}); },style:Object.assign({},mecInp,{textAlign:'center'})}),
          ce('select',{value:x.axle||'',onChange:function(e){ onUpdTire(x.id,{axle:e.target.value}); },style:mecInp},
            ce('option',{value:''},'— ось —'),['руль','ведущая','прицеп'].map(function(a){ return ce('option',{key:a,value:a},a); })),
          ce('select',{value:x.cond||'',onChange:function(e){ onUpdTire(x.id,{cond:e.target.value}); },style:mecInp},
            ['новые','б/у','восстановленные'].map(function(a){ return ce('option',{key:a,value:a},a); })),
          inp(x,'note',onUpdTire,'Заметка'),
          delBtn(onDelTire,x.id)); }))),
    ce('div',{style:{marginBottom:26}},
      head('🔋 АКБ на складе',akb.length,sum(akb),onAddAkb,'➕ Добавить АКБ'),
      akb.length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'14px 2px'}},'Аккумуляторов на складе нет.'):
      ce('div',{style:{display:'grid',gap:8}},
        akb.map(function(x){ return ce('div',{key:x.id,style:{display:'grid',gridTemplateColumns:'1.3fr 1fr 70px 1fr 1.6fr 30px',gap:7,alignItems:'center',
          background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:9}},
          inp(x,'brand',onUpdAkb,'Марка'),
          ce('input',{defaultValue:x.cap||'',placeholder:'Ач',inputMode:'numeric',onBlur:function(e){ onUpdAkb(x.id,{cap:e.target.value.trim()}); },style:mecInp}),
          ce('input',{defaultValue:x.qty||'',placeholder:'шт',inputMode:'numeric',onBlur:function(e){ onUpdAkb(x.id,{qty:e.target.value.trim()}); },style:Object.assign({},mecInp,{textAlign:'center'})}),
          ce('select',{value:x.cond||'',onChange:function(e){ onUpdAkb(x.id,{cond:e.target.value}); },style:mecInp},
            ['новые','б/у','на списание'].map(function(a){ return ce('option',{key:a,value:a},a); })),
          inp(x,'note',onUpdAkb,'Заметка'),
          delBtn(onDelAkb,x.id)); }))),
    ce('div',null,
      head('🎈 Подушки в машинах',bags.length,sum(bags),onAddBag,'➕ Добавить'),
      ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:9,lineHeight:1.5}},'Где физически лежат запасные подушки — в какой машине и сколько.'),
      bags.length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'14px 2px'}},'Пока ничего не отмечено.'):
      ce('div',{style:{display:'grid',gap:8}},
        bags.map(function(x){ return ce('div',{key:x.id,style:{display:'grid',gridTemplateColumns:'1.2fr 70px 1.2fr 1.6fr 30px',gap:7,alignItems:'center',
          background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:9}},
          ce('input',{defaultValue:x.plate||'',placeholder:'Машина',list:'fl-plates',onBlur:function(e){ onUpdBag(x.id,{plate:e.target.value.trim()}); },style:mecInp}),
          ce('input',{defaultValue:x.qty||'',placeholder:'шт',inputMode:'numeric',onBlur:function(e){ onUpdBag(x.id,{qty:e.target.value.trim()}); },style:Object.assign({},mecInp,{textAlign:'center'})}),
          inp(x,'kind',onUpdBag,'Тип/каталог №'),
          inp(x,'note',onUpdBag,'Заметка'),
          delBtn(onDelBag,x.id)); })),
      ce('datalist',{id:'fl-plates'},allPlates.map(function(p,i){ return ce('option',{key:i,value:p}); }))));
}
const KASKO_STATUS=['заявлено','согласовано','в ремонте','готово'];
const KASKO_COLOR={'заявлено':'var(--amber)','согласовано':'var(--cyan)','в ремонте':'var(--accent)','готово':'var(--green)'};
function MechKasko({items,tractors,trailers,onAdd,onUpd,onDel}){
  const [hideDone,setHideDone]=useState(false);
  const plates=(tractors||[]).map(function(t){return {p:t.plate,k:'tractor'};}).concat((trailers||[]).map(function(t){return {p:t.plate,k:'trailer'};})).filter(function(x){return x.p;});
  const list=(items||[]).filter(function(x){ return !hideDone||x.status!=='готово'; })
    .sort(function(a,b){ var o=KASKO_STATUS.indexOf(a.status)-KASKO_STATUS.indexOf(b.status); return o||((b.date||'')<(a.date||'')?-1:1); });
  const open=(items||[]).filter(function(x){ return x.status!=='готово'; }).length;
  return ce('div',null,
    ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:12,lineHeight:1.6}},
      'Что нужно отремонтировать или заменить по страховому случаю КАСКО — отдельно по тягачам и прицепам. Ведите здесь, чтобы не потерять, что уже заявлено, а что ещё нет.'),
    ce('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}},
      ce('span',{style:{fontSize:12.5,color:'var(--text3)'}},'Незакрытых: ',ce('b',{style:{color:open?'var(--amber)':'var(--text3)'}},open)),
      ce('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text3)',cursor:'pointer'}},
        ce('input',{type:'checkbox',checked:hideDone,onChange:function(e){setHideDone(e.target.checked);}}),'скрыть готовые'),
      ce('button',{className:'fl-press',onClick:onAdd,style:{marginLeft:'auto',padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12.5}},'➕ Добавить ремонт')),
    list.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Ремонтов по КАСКО не отмечено.'):
    ce('div',{style:{display:'grid',gap:8}},
      list.map(function(x){ var col=KASKO_COLOR[x.status]||'var(--text3)';
        return ce('div',{key:x.id,style:{background:'var(--bg2)',border:'1px solid '+(x.status==='готово'?'var(--border)':'color-mix(in srgb,'+col+' 40%,transparent)'),
          borderRadius:12,padding:'10px 12px',opacity:x.status==='готово'?0.65:1}},
          ce('div',{style:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:8}},
            ce('select',{value:x.kind||'tractor',onChange:function(e){ onUpd(x.id,{kind:e.target.value}); },style:Object.assign({},mecInp,{width:110})},
              ce('option',{value:'tractor'},'🚚 Тягач'),ce('option',{value:'trailer'},'🚛 Прицеп')),
            ce('input',{defaultValue:x.plate||'',placeholder:'Гос.номер',list:'fl-kasko-plates',onBlur:function(e){ onUpd(x.id,{plate:e.target.value.trim()}); },style:Object.assign({},mecInp,{width:130,fontWeight:800})}),
            ce('div',{style:{display:'flex',flexDirection:'column',gap:2}},
              ce('span',{style:{fontSize:9.5,color:'var(--text3)',fontWeight:700}},'ДАТА СЛУЧАЯ'),
              ce('input',{type:'date',defaultValue:x.date||'',onBlur:function(e){ onUpd(x.id,{date:e.target.value}); },style:Object.assign({},mecInp,{width:145})})),
            ce('input',{defaultValue:x.claimNo||'',placeholder:'№ дела/убытка',onBlur:function(e){ onUpd(x.id,{claimNo:e.target.value.trim()}); },style:Object.assign({},mecInp,{width:140})}),
            ce('select',{value:x.status||'заявлено',onChange:function(e){ onUpd(x.id,{status:e.target.value}); },
              style:Object.assign({},mecInp,{width:140,fontWeight:800,color:col,borderColor:'color-mix(in srgb,'+col+' 45%,transparent)'})},
              KASKO_STATUS.map(function(st){ return ce('option',{key:st,value:st},st); })),
            ce('button',{onClick:function(){ if(window.confirm('Удалить запись?')) onDel(x.id); },className:'fl-press',
              style:{marginLeft:'auto',width:30,height:30,borderRadius:8,border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer',flexShrink:0}},'🗑')),
          ce('textarea',{defaultValue:x.what||'',placeholder:'Что менять / что повреждено…',rows:2,onBlur:function(e){ onUpd(x.id,{what:e.target.value}); },
            style:Object.assign({},mecInp,{resize:'vertical',marginBottom:6})}),
          ce('input',{defaultValue:x.note||'',placeholder:'Заметка (СТО, сроки, сумма…)',onBlur:function(e){ onUpd(x.id,{note:e.target.value}); },style:mecInp})); })),
    ce('datalist',{id:'fl-kasko-plates'},plates.map(function(x,i){ return ce('option',{key:i,value:x.p}); })));
}
// ═══════════ ТЕМПЕРАТУРА (CapNavi) ═══════════
const TEMP_STALE_MIN=60; // старше — считаем, что данные устарели
function tempAgeMin(iso){ if(!iso) return null; var t=new Date(iso); if(isNaN(t.getTime())) return null; return Math.floor((Date.now()-t.getTime())/60000); }
function tempStatus(val,range,ageMin){
  if(val==null) return {st:'none',label:'нет данных',color:'var(--text3)'};
  if(ageMin!=null&&ageMin>TEMP_STALE_MIN) return {st:'stale',label:'данные устарели',color:'var(--amber)'};
  if(!range) return {st:'plain',label:'без требований',color:'var(--text2)'};
  var pad=0.5; // допуск на колебания датчика
  if(val>range.max+pad) return {st:'high',label:'выше нормы на '+(val-range.max).toFixed(1)+'°',color:'var(--red)'};
  // Заморозка (требование одним числом ниже нуля): холоднее — не брак, ругаемся только на «теплее»
  var frozenPoint=(range.min===range.max&&range.max<=0);
  if(!frozenPoint&&val<range.min-pad) return {st:'low',label:'ниже нормы на '+(range.min-val).toFixed(1)+'°',color:'var(--red)'};
  return {st:'ok',label:'в норме',color:'var(--green)'};
}
function fmtTemp(v){ return v==null?'—':((v>0?'+':'')+String(v)+'°'); }
/* История температуры: формат ответа CAP может отличаться — разбираем несколько вариантов */
function capHistoryPoints(val){
  var out=[];
  var push=function(o){
    if(!o) return;
    var t=o.measured_at||o.at||o.ts||o.time||o.date;
    var v=o.value_c;
    if(v===undefined) v=o.value; if(v===undefined) v=o.temp; if(v===undefined) v=o.t;
    if(t==null) return;
    var n=Number(String(v==null?'':v).replace(',','.'));
    out.push({at:t, val:isFinite(n)?n:null});
  };
  var walk=function(x,depth){
    if(!x||depth>4) return;
    if(Array.isArray(x)){ x.forEach(function(i){
      if(i&&typeof i==='object'&&(i.points||i.values||i.history)) walk(i.points||i.values||i.history,depth+1);
      else if(i&&typeof i==='object'&&(i.sensors)) walk(i.sensors,depth+1);
      else push(i); }); return; }
    if(typeof x==='object'){
      if(x.points||x.values||x.history) return walk(x.points||x.values||x.history,depth+1);
      if(x.sensors) return walk(x.sensors,depth+1);
      if(x.data) return walk(x.data,depth+1);
      push(x);
    }
  };
  walk(val,0);
  return out.filter(function(p){ return p.val!=null&&!isNaN(new Date(p.at).getTime()); })
    .sort(function(a,b){ return new Date(a.at)-new Date(b.at); });
}
function TempChart({points,range}){
  if(!points.length) return null;
  const W=680,H=180,padL=38,padR=10,padT=12,padB=24;
  const xs=points.map(function(p){ return new Date(p.at).getTime(); });
  const ys=points.map(function(p){ return p.val; });
  let lo=Math.min.apply(null,ys), hi=Math.max.apply(null,ys);
  if(range){ lo=Math.min(lo,range.min); hi=Math.max(hi,range.max); }
  if(hi-lo<2){ hi+=1; lo-=1; }
  const pad=(hi-lo)*0.12; lo-=pad; hi+=pad;
  const x0=Math.min.apply(null,xs), x1=Math.max.apply(null,xs);
  const px=function(t){ return padL+((t-x0)/Math.max(1,x1-x0))*(W-padL-padR); };
  const py=function(v){ return padT+(1-(v-lo)/Math.max(0.001,hi-lo))*(H-padT-padB); };
  const d=points.map(function(p,i){ return (i?'L':'M')+px(new Date(p.at).getTime()).toFixed(1)+' '+py(p.val).toFixed(1); }).join(' ');
  const bandTop=range?py(range.max):null, bandBot=range?py(range.min):null;
  const ticks=[lo,(lo+hi)/2,hi];
  const fmtT=function(t){ var d2=new Date(t); return String(d2.getDate()).padStart(2,'0')+'.'+String(d2.getMonth()+1).padStart(2,'0')+' '+String(d2.getHours()).padStart(2,'0')+':'+String(d2.getMinutes()).padStart(2,'0'); };
  return ce('svg',{viewBox:'0 0 '+W+' '+H,style:{width:'100%',height:'auto',display:'block'}},
    range?ce('rect',{x:padL,y:Math.min(bandTop,bandBot),width:W-padL-padR,height:Math.abs(bandBot-bandTop)||2,
      fill:'color-mix(in srgb,var(--green) 16%,transparent)'}):null,
    ticks.map(function(v,i){ return ce('g',{key:i},
      ce('line',{x1:padL,y1:py(v),x2:W-padR,y2:py(v),stroke:'var(--border)',strokeWidth:1}),
      ce('text',{x:4,y:py(v)+4,fill:'var(--text3)',fontSize:10},v.toFixed(1))); }),
    ce('path',{d:d,fill:'none',stroke:'var(--accent)',strokeWidth:2,strokeLinejoin:'round',strokeLinecap:'round'}),
    points.filter(function(p){ return range&&(p.val>range.max+0.5||(range.min!==range.max||range.max>0)&&p.val<range.min-0.5); })
      .map(function(p,i){ return ce('circle',{key:i,cx:px(new Date(p.at).getTime()),cy:py(p.val),r:2.5,fill:'var(--red)'}); }),
    ce('text',{x:padL,y:H-6,fill:'var(--text3)',fontSize:10},fmtT(x0)),
    ce('text',{x:W-padR,y:H-6,fill:'var(--text3)',fontSize:10,textAnchor:'end'},fmtT(x1)));
}
function TempHistoryModal({vid,title,range,onClose}){
  const now=new Date();
  const iso=function(d){ var p=function(n){return String(n).padStart(2,'0');};
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())+':00+03:00'; };
  const [hours,setHours]=useState(24);
  const [st,setSt]=useState({loading:true,err:'',pts:[],raw:null});
  const load=function(h){
    setSt({loading:true,err:'',pts:[],raw:null});
    var to=new Date(), from=new Date(to.getTime()-h*3600*1000);
    capFetch('temperature/history',{vehicle_id:vid,from:iso(from),to:iso(to)}).then(function(r){
      if(!r.ok){ setSt({loading:false,err:r.err||'нет ответа',pts:[],raw:null}); return; }
      var pts=capHistoryPoints(r.val);
      setSt({loading:false,err:'',pts:pts,raw:pts.length?null:r.val});
    });
  };
  useEffect(function(){ load(hours); },[hours]);
  const pts=st.pts;
  const vals=pts.map(function(p){return p.val;});
  const mn=vals.length?Math.min.apply(null,vals):null;
  const mx=vals.length?Math.max.apply(null,vals):null;
  const avg=vals.length?(vals.reduce(function(a,b){return a+b;},0)/vals.length):null;
  const viol=range?pts.filter(function(p){ return p.val>range.max+0.5||((range.min!==range.max||range.max>0)&&p.val<range.min-0.5); }):[];
  return ce(Modal,{title:'📈 История температуры — '+title,onClose,wide:true},
    ce('div',{style:{display:'flex',gap:7,marginBottom:12,flexWrap:'wrap'}},
      [[6,'6 ч'],[24,'сутки'],[72,'3 дня'],[168,'неделя']].map(function(o){ var on=hours===o[0];
        return ce('button',{key:o[0],className:'fl-press',onClick:function(){setHours(o[0]);},style:{padding:'7px 14px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:800,
          border:'1px solid '+(on?'var(--accent)':'var(--border2)'),background:on?'color-mix(in srgb,var(--accent) 14%,transparent)':'var(--bg2)',color:on?'var(--accent)':'var(--text3)'}},o[1]); }),
      range?ce('span',{style:{alignSelf:'center',marginLeft:'auto',fontSize:11.5,color:'var(--text3)'}},'зелёная полоса — требуемый режим'):null),
    st.loading?ce('div',{style:{padding:'30px 4px',color:'var(--text3)',fontSize:13}},'Загружаю историю…'):
    st.err?ce('div',{style:{background:'color-mix(in srgb,var(--red) 12%,transparent)',border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',
      borderRadius:11,padding:'12px 14px',color:'var(--red)',fontSize:12.5,fontWeight:700}},'⚠ '+st.err):
    !pts.length?ce('div',null,
      ce('div',{style:{color:'var(--text3)',fontSize:13,marginBottom:8}},'Точек за период нет — либо данных нет, либо формат ответа отличается от ожидаемого.'),
      st.raw?ce('pre',{style:{maxHeight:220,overflow:'auto',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,padding:11,
        fontSize:11,color:'var(--text2)',whiteSpace:'pre-wrap'}},JSON.stringify(st.raw).slice(0,1500)):null):
    ce('div',null,
      ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10,marginBottom:12}},
        dashCard('Минимум',fmtTemp(mn!=null?Math.round(mn*10)/10:null),'var(--cyan)'),
        dashCard('Максимум',fmtTemp(mx!=null?Math.round(mx*10)/10:null),'var(--amber)'),
        dashCard('Среднее',fmtTemp(avg!=null?Math.round(avg*10)/10:null),'var(--text2)'),
        dashCard('Вне режима',viol.length,viol.length?'var(--red)':'var(--green)',pts.length+' точек')),
      ce('div',{style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'10px 8px',marginBottom:10}},
        ce(TempChart,{points:pts,range:range})),
      viol.length?ce('div',{style:{fontSize:12,color:'var(--red)',fontWeight:700,lineHeight:1.6}},
        '⚠ Выход за режим: '+viol.length+' измерений. Первое — '+fmtDT(viol[0].at)+' ('+fmtTemp(viol[0].val)+').'):
        ce('div',{style:{fontSize:12,color:'var(--green)',fontWeight:700}},'✓ За период нарушений режима не зафиксировано.')));
}
function TempTab({trucks,clients}){
  const [rows,setRows]=useState(null);
  const [hist,setHist]=useState(null);
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const [at,setAt]=useState('');
  const [onlyBad,setOnlyBad]=useState(false);
  const load=function(){
    setLoading(true); setErr('');
    capFetch('temperature/current').then(function(r){
      setLoading(false);
      if(!r.ok){ setErr(r.err||'не удалось получить данные'); return; }
      var data=(r.val&&(r.val.data||r.val))||[];
      if(!Array.isArray(data)){ setErr('неожиданный формат ответа'); return; }
      setRows(data); setAt(new Date().toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}));
    });
  };
  useEffect(function(){ load(); var iv=setInterval(load,10*60*1000); return function(){ clearInterval(iv); }; },[]);
  // индекс температур по нормализованному номеру прицепа
  const byPlate={};
  (rows||[]).forEach(function(r){
    var p=capParseName(r.name||'');
    var s=r.sensors||{};
    var v=(s.value_c===undefined?null:s.value_c);
    if(p.plate) byPlate[p.plate]={val:v,at:s.measured_at,status:s.status,raw:r.name,vid:r.vehicle_id};
  });
  // строим строки по НАШИМ машинам
  const list=(trucks||[]).filter(function(t){ return !t.isHired; }).map(function(t){
    var sp=splitFleteraPlate(t.plate);
    var mTrail=byPlate[sp.trailer]||null;
    var mTract=byPlate[sp.tractor]||null;
    var tractVal=(mTract&&mTract.val!=null)?mTract.val:null;   // у части тягачей тоже есть датчик
    // основной показатель — рефустановка на прицепе; если её нет, берём датчик тягача
    var m=(mTrail&&mTrail.val!=null)?mTrail:((tractVal!=null)?mTract:(mTrail||mTract));
    var fromTractor=!!(m&&mTract&&m===mTract);
    var cl=(clients||[]).find(function(c){ return c.id===t.clientId; });
    var reqRaw=(cl&&cl.temp)||'';
    var range=parseTempRange(reqRaw);
    var moving=MOVING.includes(t.status);
    var age=m?tempAgeMin(m.at):null;
    var s=tempStatus(m?m.val:null, moving?range:null, age);
    return {t:t,sp:sp,val:m?m.val:null,at:m?m.at:null,age:age,req:reqRaw,range:range,s:s,moving:moving,found:!!m,
      vid:m?m.vid:null,fromTractor:fromTractor,
      alt:(mTrail&&mTrail.val!=null&&tractVal!=null)?tractVal:null};
  }).sort(function(a,b){
    var rank=function(x){ if(x.s.st==='high'||x.s.st==='low') return 0; if(x.moving) return 1; if(x.s.st==='stale') return 2; return 3; };
    var d=rank(a)-rank(b); if(d) return d;
    return (b.val==null?-999:b.val)-(a.val==null?-999:a.val);
  });
  const bad=list.filter(function(x){ return x.s.st==='high'||x.s.st==='low'; });
  const shown=onlyBad?bad:list;
  const movingCnt=list.filter(function(x){return x.moving;}).length;
  const noData=list.filter(function(x){ return !x.found||x.val==null; }).length;
  return ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
    hist?ce(TempHistoryModal,{vid:hist.vid,title:hist.title,range:hist.range,onClose:function(){setHist(null);}}):null,
    ce('div',{style:{display:'flex',alignItems:'center',gap:12,marginBottom:14,flexWrap:'wrap'}},
      ce('div',{style:{fontWeight:800,fontSize:19}},'🌡 Температура в рефах'),
      at?ce('span',{style:{fontSize:12,color:'var(--text3)'}},'обновлено в '+at):null,
      ce('button',{className:'fl-press',onClick:load,disabled:loading,style:{marginLeft:'auto',padding:'8px 15px',borderRadius:9,cursor:loading?'default':'pointer',fontFamily:'inherit',
        border:'1px solid var(--border2)',background:'var(--bg2)',color:'var(--text2)',fontWeight:800,fontSize:12.5,opacity:loading?0.6:1}},loading?'обновляю…':'⟳ Обновить')),
    err?ce('div',{style:{background:'color-mix(in srgb,var(--red) 12%,transparent)',border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',
      borderRadius:11,padding:'11px 14px',color:'var(--red)',fontSize:12.5,fontWeight:700,marginBottom:14,lineHeight:1.5}},
      '⚠ Не удалось получить данные CapNavi: '+err+'. Проверьте, что ключ действует и функция /api/cap развёрнута на Vercel.'):null,
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:11,marginBottom:16}},
      dashCard('🚚 В рейсе',movingCnt,'var(--accent)'),
      dashCard('🔴 Вне режима',bad.length,bad.length?'var(--red)':'var(--text3)','из тех, кто в рейсе'),
      dashCard('🌡 С датчиком',Object.keys(byPlate).length,'var(--cyan)'),
      dashCard('⚪ Без данных',noData,'var(--text3)')),
    ce('div',{style:{display:'flex',alignItems:'center',gap:12,marginBottom:10,flexWrap:'wrap'}},
      ce('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text3)',cursor:'pointer'}},
        ce('input',{type:'checkbox',checked:onlyBad,onChange:function(e){setOnlyBad(e.target.checked);}}),'только нарушения'),
      ce('span',{style:{fontSize:11.5,color:'var(--text3)'}},'Норма — из карточки клиента текущего рейса, допуск ±0.5°. Нажмите на строку — история за период.')),
    rows===null&&!err?ce('div',{style:{textAlign:'center',padding:40,color:'var(--text3)'}},'Загружаю данные CapNavi…'):
    shown.length===0?ce('div',{style:{textAlign:'center',padding:40,color:'var(--text3)'}},onlyBad?'Нарушений нет.':'Нет данных.'):
    ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
      shown.map(function(x,i){ var t=x.t;
        return ce('div',{key:t.id,className:x.vid?'fl-press':'',onClick:x.vid?function(){ setHist({vid:x.vid,title:(t.plate||'')+' · '+(t.driver||''),range:x.moving?x.range:null}); }:null,
          style:{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',flexWrap:'wrap',cursor:x.vid?'pointer':'default',
          borderBottom:i<shown.length-1?'1px solid var(--border)':'none',
          borderLeft:'3px solid '+(x.s.st==='high'||x.s.st==='low'?'var(--red)':(x.moving?'var(--accent)':'transparent')),
          background:(x.s.st==='high'||x.s.st==='low')?'color-mix(in srgb,var(--red) 7%,transparent)':'transparent'}},
          ce('div',{style:{minWidth:150}},
            ce('div',{style:{fontWeight:800,fontSize:13}},t.plate||'—'),
            ce('div',{style:{fontSize:11.5,color:'var(--text3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:190}},t.driver||'—')),
          ce('div',{style:{minWidth:92,textAlign:'center'}},
            ce('div',{style:{fontSize:20,fontWeight:800,color:x.val==null?'var(--text3)':x.s.color}},fmtTemp(x.val)),
            x.age!=null?ce('div',{style:{fontSize:10,color:'var(--text3)'}},x.age<1?'только что':(x.age<60?(x.age+' мин назад'):(Math.floor(x.age/60)+' ч назад'))):null,
            x.fromTractor?ce('div',{style:{fontSize:9.5,color:'var(--amber)',fontWeight:700}},'датчик тягача'):null,
            x.alt!=null?ce('div',{style:{fontSize:9.5,color:'var(--text3)'}},'тягач: '+fmtTemp(x.alt)):null),
          ce('div',{style:{minWidth:110}},
            ce('div',{style:{fontSize:9.5,color:'var(--text3)',fontWeight:700}},'ТРЕБУЕТСЯ'),
            ce('div',{style:{fontSize:12.5,color:x.req?'var(--text2)':'var(--text3)'}},x.moving?(x.req?(x.req+'°'):'не указано'):'—')),
          ce('div',{style:{flex:1,minWidth:170,fontSize:12,color:'var(--text3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},
            x.moving?((t.clientName||'')+(t.unloadAddr?(' → '+t.unloadAddr):'')):'свободна'),
          ce('span',{style:{marginLeft:'auto',padding:'4px 11px',borderRadius:8,fontSize:11.5,fontWeight:800,whiteSpace:'nowrap',
            background:'color-mix(in srgb,'+x.s.color+' 14%,transparent)',color:x.s.color}},
            !x.found?'нет в CapNavi':x.s.label)); })));
}
// ═══════════ ПУЛЬТ РУКОВОДИТЕЛЯ ═══════════
function bossCard(label,val,color,sub){
  return ce('div',{style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:13,padding:'13px 15px',minWidth:0}},
    ce('div',{style:{fontSize:22,fontWeight:800,color:color}},val),
    ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginTop:2}},label),
    sub?ce('div',{style:{fontSize:10.5,color:'var(--text3)',marginTop:2,opacity:.8}},sub):null);
}
function bossRow(children,onClick,accent){
  return ce('div',{className:onClick?'fl-press':'',onClick:onClick,style:{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',
    borderBottom:'1px solid var(--border)',fontSize:13,cursor:onClick?'pointer':'default',
    borderLeft:accent?('3px solid '+accent):'3px solid transparent'}},children);
}
function BossTripModal({tr,clients,onClose}){
  const cl=(clients||[]).find(function(c){ return c.id===tr.clientId; });
  const line=(k,v)=>v?ce('div',{style:{display:'flex',gap:10,padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}},
    ce('span',{style:{color:'var(--text3)',minWidth:130,flexShrink:0}},k),
    ce('span',{style:{color:'var(--text)',fontWeight:600,whiteSpace:'pre-wrap'}},v)):null;
  const back=tr.backCargo;
  return ce(Modal,{title:'🚛 '+(tr.plate||'—'),onClose,wide:true},
    ce('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}},
      ce('span',{style:{padding:'5px 12px',borderRadius:8,fontWeight:800,fontSize:12,
        background:'color-mix(in srgb,var(--accent) 14%,transparent)',color:'var(--accent)'}},stLabel(tr.status)),
      tr.problem?ce('span',{style:{padding:'5px 12px',borderRadius:8,fontWeight:800,fontSize:12,
        background:'color-mix(in srgb,var(--red) 14%,transparent)',color:'var(--red)'}},'⚠ ПРОБЛЕМА'):null,
      tr.logist?ce('span',{style:{padding:'5px 12px',borderRadius:8,fontWeight:800,fontSize:12,
        background:'color-mix(in srgb,'+(LOGIST_COLOR[tr.logist]||'var(--text3)')+' 14%,transparent)',color:LOGIST_COLOR[tr.logist]||'var(--text3)'}},'👤 '+tr.logist):null),
    line('Водитель',tr.driver),
    line('Телефон',tr.phone),
    line('Клиент',tr.clientName||(cl&&cl.name)),
    line('Загрузка',tr.loadAddr),
    line('Выгрузка',tr.unloadAddr),
    line('Время загрузки',tr.loadAt?fmtDT(tr.loadAt):null),
    line('Температура',(cl&&cl.temp)?(cl.temp+'°C'):null),
    line('Освободится',tr.freeAt?fmtDT(tr.freeAt):null),
    line('Где сейчас',tr.location),
    line('Последняя отметка',tr.lastEvent?(tr.lastEvent+(tr.lastTime?(' · '+fmtDT(tr.lastTime)):'')):null),
    line('Заметка',tr.note),
    back?ce('div',{style:{marginTop:12,padding:'11px 13px',borderRadius:11,
      background:'color-mix(in srgb,var(--cyan) 8%,transparent)',border:'1px solid color-mix(in srgb,var(--cyan) 30%,transparent)'}},
      ce('div',{style:{fontSize:11,fontWeight:800,color:'var(--cyan)',marginBottom:6}},'ОБРАТНЫЙ ГРУЗ'),
      line('Груз',back.cargo),
      line('Откуда',back.from),
      line('Куда',back.to),
      line('Отправление',back.departAt?fmtDT(back.departAt):null),
      line('Заметка',back.note)):
      ce('div',{style:{marginTop:12,fontSize:12.5,color:'var(--text3)'}},'Обратный груз не назначен.'));
}
function BossLogistics({trucks,clients,plans}){
  const [day,setDay]=useState(today());
  const [openTrip,setOpenTrip]=useState(null);
  const wd=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const base=new Date(); base.setHours(0,0,0,0);
  const days=[]; for(var i=-3;i<14;i++) days.push(new Date(base.getTime()+i*864e5));
  const ds=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const todayStr=ds(new Date());
  const loadKeys=t=>{ var out=[]; var push=function(v){ if(!v) return; var d=new Date(v); if(!isNaN(d.getTime())) out.push(ds(d)); };
    push(t.loadAt); (t.trips||[]).forEach(function(x){ if(x) push(x.loadAt); }); return out; };
  const onDay=(t,key)=>{ if(!MOVING.includes(t.status)) return false; var ks=loadKeys(t); if(!ks.length) return key===todayStr; return ks.indexOf(key)>=0; };
  const list=(trucks||[]).filter(function(t){ return onDay(t,day); });
  const dayPlans=(plans||[]).filter(function(p){ var sd=p.loadDate||p.date; return sd===day; });
  const short=s=>{ s=String(s||'').trim(); return s.length>34?(s.slice(0,32)+'…'):(s||'—'); };
  return ce('div',null,
    ce('div',{style:{display:'flex',gap:7,overflowX:'auto',paddingBottom:8,marginBottom:14}},
      days.map(function(d){ var key=ds(d), act=key===day, past=key<todayStr;
        var cnt=(trucks||[]).filter(function(t){return onDay(t,key);}).length+(plans||[]).filter(function(p){ var sd=p.loadDate||p.date; return sd===key; }).length;
        return ce('button',{key:key,className:'fl-press',onClick:()=>setDay(key),style:{flexShrink:0,minWidth:66,padding:'8px 10px',borderRadius:11,cursor:'pointer',fontFamily:'inherit',textAlign:'center',
          border:'1px solid '+(act?'var(--accent)':'var(--border)'),opacity:(past&&!act)?0.5:1,
          background:act?'color-mix(in srgb,var(--accent) 16%,transparent)':'var(--bg2)',color:act?'var(--accent)':'var(--text3)'}},
          ce('div',{style:{fontSize:11,fontWeight:700}},wd[d.getDay()]+(key===todayStr?' •':'')),
          ce('div',{style:{fontSize:13,fontWeight:800,marginTop:2}},String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')),
          ce('div',{style:{fontSize:10,marginTop:2}},cnt?cnt+' маш.':'—')); })),
    openTrip?ce(BossTripModal,{tr:openTrip,clients:clients,onClose:function(){setOpenTrip(null);}}):null,
    ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:8}},'Загрузка в этот день: '+list.length+(dayPlans.length?(' · план: '+dayPlans.length):'')+' · нажмите на рейс — откроется полная информация'),
    list.length===0&&dayPlans.length===0?ce('div',{style:{textAlign:'center',padding:40,color:'var(--text3)',fontSize:13}},'В этот день загрузок нет.'):
    ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
      list.map(function(t){ var cl=(clients||[]).find(function(c){return c.id===t.clientId;}); var b=t.backCargo;
        return ce('div',{key:t.id,className:'fl-press',onClick:function(){setOpenTrip(t);},style:{display:'grid',
          gridTemplateColumns:'150px 1fr 1fr 130px',gap:12,alignItems:'center',padding:'11px 13px',cursor:'pointer',
          borderBottom:'1px solid var(--border)',borderLeft:'3px solid '+(t.problem?'var(--red)':(LOGIST_COLOR[t.logist]||'transparent'))}},
          ce('div',{style:{minWidth:0}},
            ce('div',{style:{fontWeight:800,fontSize:13}},t.plate||'—'),
            ce('div',{style:{fontSize:11.5,color:'var(--text3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},t.driver||'—')),
          ce('div',{style:{minWidth:0}},
            ce('div',{style:{fontSize:10,color:'var(--violet)',fontWeight:800}},'ТУДА'),
            ce('div',{style:{fontSize:12.5,color:'var(--text2)'}},short((t.clientName||(cl&&cl.name)||'')+(t.unloadAddr?(' → '+t.unloadAddr):'')))),
          ce('div',{style:{minWidth:0}},
            ce('div',{style:{fontSize:10,color:'var(--cyan)',fontWeight:800}},'ОБРАТКА'),
            ce('div',{style:{fontSize:12.5,color:b?'var(--text2)':'var(--text3)'}},b?short((b.cargo||'')+(b.to?(' → '+b.to):'')):'нет')),
          ce('div',{style:{textAlign:'right'}},
            ce('span',{style:{padding:'4px 10px',borderRadius:8,fontSize:11.5,fontWeight:800,
              background:t.problem?'color-mix(in srgb,var(--red) 14%,transparent)':'color-mix(in srgb,var(--accent) 12%,transparent)',
              color:t.problem?'var(--red)':'var(--accent)'}},t.problem?'⚠ проблема':stLabel(t.status)),
            t.freeAt?ce('div',{style:{fontSize:10.5,color:'var(--text3)',marginTop:3}},'до '+fmtDT(t.freeAt)):null)); }),
      dayPlans.map(function(p){ return ce('div',{key:'p'+p.id,style:{display:'flex',gap:10,padding:'10px 13px',fontSize:12.5,
        borderBottom:'1px solid var(--border)',borderLeft:'3px dashed var(--violet)',color:'var(--text3)'}},
        ce('span',{style:{fontWeight:800,color:'var(--violet)'}},'ПЛАН'),
        ce('span',null,(p.plate||'—')+' · '+short(p.clientName||p.note||''))); })));
}
function BossMechanic({tractors,trailers,acts,tires,bags,akb,kasko}){
  const [sub,setSub]=useState('dash');
  const [full,setFull]=useState(null);
  const items=[];
  (tractors||[]).forEach(function(t){
    items.push({plate:t.plate,cat:'ТО тягача',s:kmStatus(t.odometer,t.toMileage,TO_TRACTOR_KM,TO_TRACTOR_WARN_KM),o:t,kind:'tractor'});
    items.push({plate:t.plate,cat:'Шины руль',s:tireStatus(t.odometer,t.tireSteer,TIRE_STEER_KM,TIRE_WARN_KM),o:t,kind:'tractor'});
    items.push({plate:t.plate,cat:'Шины ведущая',s:tireStatus(t.odometer,t.tireDrive,TIRE_DRIVE_KM,TIRE_WARN_KM),o:t,kind:'tractor'});
    items.push({plate:t.plate,cat:'Техосмотр',s:dateStatus(t.techInsp),o:t,kind:'tractor'});
    items.push({plate:t.plate,cat:'Страховка',s:dateStatus(t.insurance),o:t,kind:'tractor'});
    items.push({plate:t.plate,cat:'КАСКО',s:dateStatus(t.kasko),o:t,kind:'tractor'});
    items.push({plate:t.plate,cat:'Пропуск РФ',s:dateStatus(t.pass),o:t,kind:'tractor'});
  });
  (trailers||[]).forEach(function(tr){
    var pt=(tractors||[]).find(function(x){return x.plate===tr.pairedTractor;}); var odo=pt?pt.odometer:null;
    items.push({plate:tr.plate,cat:'ТО прицепа',s:kmStatus(odo,tr.toMileage,TO_TRAILER_KM,TO_TRAILER_WARN_KM),o:tr,kind:'trailer'});
    [1,2,3].forEach(function(n){ items.push({plate:tr.plate,cat:'Шины '+n+' ось',s:tireStatus(odo,axleVal(tr,n),TIRE_TRAILER_KM,TIRE_WARN_KM),o:tr,kind:'trailer'}); });
    items.push({plate:tr.plate,cat:'Техосмотр',s:dateStatus(tr.techInsp),o:tr,kind:'trailer'});
    items.push({plate:tr.plate,cat:'FRC',s:dateStatus(tr.frc),o:tr,kind:'trailer'});
    items.push({plate:tr.plate,cat:'ТО установки',s:tr.unitService?dateStatus(addDaysISO(tr.unitService,UNIT_SERVICE_DAYS)):{st:'unknown'},o:tr,kind:'trailer'});
  });
  const red=items.filter(function(i){return i.s.st==='red';});
  const amber=items.filter(function(i){return i.s.st==='amber';});
  const openKasko=(kasko||[]).filter(function(x){return x.status!=='готово';});
  const openActs=(acts||[]).filter(function(a){return !a.resolved;});
  const subs=[['dash','⚠ Требуют внимания ('+(red.length+amber.length)+')'],['stock','📦 Склад'],['kasko','🛠 КАСКО'+(openKasko.length?(' ('+openKasko.length+')'):'')],['acts','📋 Осмотры'+(openActs.length?(' ('+openActs.length+')'):'')]];
  const sum=l=>(l||[]).reduce(function(a,x){ var n=Number(x.qty); return a+(isNaN(n)?0:n); },0);
  return ce('div',null,
    full?ce(Modal,{title:(full.kind==='trailer'?'🚛 ':'🚚 ')+(full.o.plate||'—'),onClose:function(){setFull(null);},wide:true},
      ce('div',{style:{display:'flex',flexWrap:'wrap',gap:8}},
        items.filter(function(i){ return i.o===full.o; }).map(function(i,k){ return ce(StatusPill,{key:k,s:i.s,label:i.cat}); })),
      full.o.note?ce('div',{style:{marginTop:12,fontSize:12.5,color:'var(--text2)'}},'📝 '+full.o.note):null):null,
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:11,marginBottom:16}},
      bossCard('🚚 Тягачей',(tractors||[]).length,'var(--accent)'),
      bossCard('🚛 Прицепов',(trailers||[]).length,'var(--accent)'),
      bossCard('🔴 Критично',red.length,'var(--red)'),
      bossCard('🟡 Скоро',amber.length,'var(--amber)'),
      bossCard('🛠 КАСКО',openKasko.length,'var(--violet)','незакрытых'),
      bossCard('📋 Актов',openActs.length,'var(--cyan)','незакрытых')),
    ce('div',{style:{display:'inline-flex',gap:3,marginBottom:12,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:3,flexWrap:'wrap'}},
      subs.map(function(v){ var on=sub===v[0];
        return ce('button',{key:v[0],className:'fl-press',onClick:function(){setSub(v[0]);},style:{padding:'7px 14px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:800,border:'none',
          background:on?'linear-gradient(135deg,var(--cyan),var(--accent))':'transparent',color:on?'#fff':'var(--text3)'}},v[1]); })),
    sub==='dash'?(red.concat(amber).length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'16px 4px'}},'Всё в порядке.'):
      ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
        red.concat(amber).map(function(it,i){ return ce('div',{key:i,className:'fl-press',onClick:function(){setFull(it);},style:{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',cursor:'pointer',
          borderBottom:'1px solid var(--border)',fontSize:13,borderLeft:'3px solid '+it.s.color}},
          ce('span',{style:{fontWeight:800,minWidth:100}},it.plate||'—'),
          ce('span',{style:{color:'var(--text3)',minWidth:140}},it.cat),
          ce('span',{style:{marginLeft:'auto',fontWeight:700,color:it.s.color}},it.s.label)); }))):null,
    sub==='stock'?ce('div',null,
      ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:11,marginBottom:12}},
        bossCard('🛞 Шины',sum(tires),'var(--accent)','позиций: '+(tires||[]).length),
        bossCard('🔋 АКБ',sum(akb),'var(--green)','позиций: '+(akb||[]).length),
        bossCard('🎈 Подушки',sum(bags),'var(--amber)','в '+(bags||[]).length+' маш.')),
      ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
        (tires||[]).map(function(x,i){ return bossRow([ce('span',{key:'a',style:{fontWeight:700,minWidth:130}},x.size||'—'),
          ce('span',{key:'b',style:{color:'var(--text3)',minWidth:100}},x.brand||''),
          ce('span',{key:'c',style:{color:'var(--text3)'}},x.axle||''),
          ce('span',{key:'d',style:{marginLeft:'auto',fontWeight:800}},(x.qty||0)+' шт'),
          ce('span',{key:'e',style:{color:'var(--text3)',fontSize:11.5,minWidth:60,textAlign:'right'}},x.cond||'')],null,'var(--accent)'); }),
        (akb||[]).map(function(x,i){ return bossRow([ce('span',{key:'a',style:{fontWeight:700,minWidth:130}},'🔋 '+(x.brand||'—')),
          ce('span',{key:'b',style:{color:'var(--text3)'}},x.cap?(x.cap+' Ач'):''),
          ce('span',{key:'d',style:{marginLeft:'auto',fontWeight:800}},(x.qty||0)+' шт'),
          ce('span',{key:'e',style:{color:'var(--text3)',fontSize:11.5,minWidth:60,textAlign:'right'}},x.cond||'')],null,'var(--green)'); }),
        (bags||[]).map(function(x,i){ return bossRow([ce('span',{key:'a',style:{fontWeight:700,minWidth:130}},'🎈 '+(x.plate||'—')),
          ce('span',{key:'b',style:{color:'var(--text3)'}},x.kind||''),
          ce('span',{key:'d',style:{marginLeft:'auto',fontWeight:800}},(x.qty||0)+' шт')],null,'var(--amber)'); }),
        ((tires||[]).length+(akb||[]).length+(bags||[]).length)===0?ce('div',{style:{padding:'16px 13px',color:'var(--text3)',fontSize:13}},'Склад пуст.'):null)):null,
    sub==='kasko'?((kasko||[]).length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'16px 4px'}},'Ремонтов по КАСКО нет.'):
      ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
        (kasko||[]).slice().sort(function(a,b){ return KASKO_STATUS.indexOf(a.status)-KASKO_STATUS.indexOf(b.status); }).map(function(x,i){
          var col=KASKO_COLOR[x.status]||'var(--text3)';
          return bossRow([ce('span',{key:'a',style:{fontSize:13}},x.kind==='trailer'?'🚛':'🚚'),
            ce('span',{key:'b',style:{fontWeight:800,minWidth:100}},x.plate||'—'),
            ce('span',{key:'c',style:{color:'var(--text2)',flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},x.what||'—'),
            ce('span',{key:'d',style:{color:'var(--text3)',fontSize:11.5}},x.date?fmtD(x.date):''),
            ce('span',{key:'e',style:{fontWeight:800,color:col,minWidth:100,textAlign:'right'}},x.status||'')],null,col); }))):null,
    sub==='acts'?((acts||[]).length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'16px 4px'}},'Актов нет.'):
      ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
        (acts||[]).slice().sort(function(a,b){ return (a.resolved?1:0)-(b.resolved?1:0); }).map(function(a,i){
          return bossRow([ce('span',{key:'a',style:{fontWeight:800,minWidth:80}},'№'+(a.num||'—')),
            ce('span',{key:'b',style:{color:'var(--text2)',minWidth:150}},a.driver||'—'),
            ce('span',{key:'c',style:{color:'var(--text3)',fontSize:11.5,minWidth:90}},a.date?fmtD(a.date):''),
            ce('span',{key:'d',style:{color:'var(--text3)',flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},[(a.tractorDefects||''),(a.trailerDefects||'')].filter(Boolean).join(' · ')||'без замечаний'),
            ce('span',{key:'e',style:{fontWeight:800,fontSize:11.5,color:a.resolved?'var(--green)':'var(--amber)'}},a.resolved?'устранено':'открыт')],null,a.resolved?'var(--green)':'var(--amber)'); }))):null);
}
function BossHr({drivers,vacations,waybills,history}){
  const tnow=Date.now();
  const inRange=v=>{ var a=dOnly(v.from),b=dOnly(v.to); return a!=null&&b!=null&&a<=tnow&&tnow<=b; };
  const onVac=(vacations||[]).filter(function(v){ return inRange(v)&&v.type==='отпуск'; });
  const onSick=(vacations||[]).filter(function(v){ return inRange(v)&&v.type==='больничный'; });
  const offToday=(drivers||[]).filter(function(d){ return isOffToday(d,vacations)&&!onVac.some(function(v){return v.driverName===d.name;})&&!onSick.some(function(v){return v.driverName===d.name;}); });
  const over=(drivers||[]).map(function(d){ var n=workedDays(d,vacations); return {d:d,n:n,s:workStatus(n)}; })
    .filter(function(x){ return !isOffToday(x.d,vacations)&&(x.s.st==='red'||x.s.st==='amber'); })
    .sort(function(a,b){ return (b.n||0)-(a.n||0); });
  const wbBad=(drivers||[]).map(function(d){ var w=(waybills||[]).find(function(x){return (x.driverName||'').trim()===(d.name||'').trim();});
    var issued=(w&&w.issued)||d.workStart||''; var since=dOnly(issued)||0;
    var n=(history||[]).filter(function(e){ return e&&e.action==='dispatch'&&(e.driver||'').trim()===(d.name||'').trim()&&(dOnly(e.ts)==null||dOnly(e.ts)>=since); }).length;
    return {d:d,n:n,s:waybillStatus(n)}; }).filter(function(x){ return x.s.st!=='green'; });
  const soon=(vacations||[]).filter(function(v){ var a=dOnly(v.from); return a!=null&&a>tnow&&a<tnow+30*864e5; })
    .sort(function(a,b){ return (dOnly(a.from)||0)-(dOnly(b.from)||0); });
  const block=(title,list,render,empty,color)=>ce('div',{style:{marginBottom:18}},
    ce('div',{style:{fontWeight:800,fontSize:13.5,marginBottom:8,color:color}},title+' — '+list.length),
    list.length===0?ce('div',{style:{fontSize:12.5,color:'var(--text3)',padding:'6px 2px'}},empty):
    ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},list.map(render)));
  return ce('div',null,
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:11,marginBottom:18}},
      bossCard('🧑‍✈️ Водителей',(drivers||[]).length,'var(--accent)'),
      bossCard('🏖 В отпуске',onVac.length,'var(--violet)'),
      bossCard('🏠 На выходном',offToday.length,'var(--green)'),
      bossCard('🔴 Переработка',over.filter(function(x){return x.s.st==='red';}).length,'var(--red)','30+ дней'),
      bossCard('📋 Путевых менять',wbBad.length,'var(--cyan)')),
    block('🔴 Переработка',over,function(x,i){ return bossRow([
      ce('span',{key:'a',style:{fontWeight:800,minWidth:180}},x.d.name||'—'),
      ce('span',{key:'b',style:{color:'var(--text3)',minWidth:90}},x.d.plate||''),
      ce('span',{key:'c',style:{marginLeft:'auto',fontWeight:800,color:x.s.color}},x.s.label)],null,x.s.color); },'Никто не перерабатывает.','var(--red)'),
    block('🏖 В отпуске сейчас',onVac,function(v,i){ return bossRow([
      ce('span',{key:'a',style:{fontWeight:800,minWidth:180}},v.driverName||'—'),
      ce('span',{key:'b',style:{color:'var(--text3)'}},fmtD(v.from)+' — '+fmtD(v.to)),
      v.note?ce('span',{key:'c',style:{color:'var(--text3)',fontSize:11.5}},'· '+v.note):null],null,VAC_COLOR['отпуск']); },'Никого.','var(--violet)'),
    onSick.length?block('🤒 На больничном',onSick,function(v,i){ return bossRow([
      ce('span',{key:'a',style:{fontWeight:800,minWidth:180}},v.driverName||'—'),
      ce('span',{key:'b',style:{color:'var(--text3)'}},fmtD(v.from)+' — '+fmtD(v.to))],null,VAC_COLOR['больничный']); },'','var(--red)'):null,
    block('🏠 На выходном сегодня',offToday,function(d,i){ return bossRow([
      ce('span',{key:'a',style:{fontWeight:800,minWidth:180}},d.name||'—'),
      ce('span',{key:'b',style:{color:'var(--text3)'}},d.plate||'')],null,VAC_COLOR['выходной']); },'Все на линии.','var(--green)'),
    block('📅 Отпуска в ближайший месяц',soon,function(v,i){ return bossRow([
      ce('span',{key:'a',style:{fontWeight:800,minWidth:180}},v.driverName||'—'),
      ce('span',{key:'b',style:{color:'var(--text3)',minWidth:60}},v.type||''),
      ce('span',{key:'c',style:{color:'var(--text2)'}},fmtD(v.from)+' — '+fmtD(v.to))],null,VAC_COLOR[v.type]||'var(--violet)'); },'Запланированных отпусков нет.','var(--text2)'));
}
function BossPanel(props){
  const [sec,setSec]=useState(null);
  const secs=[
    {k:'log',t:'📦 Логистика',d:'Кто грузится по дням, туда и обратка',c:'var(--accent)'},
    {k:'mec',t:'🔧 Механик',d:'ТО, шины, склад, КАСКО, осмотры',c:'var(--cyan)'},
    {k:'hr',t:'🗂 Кадры',d:'Отпуска, выходные, переработка',c:'var(--violet)'},
    {k:'board',t:'📋 Доска логистов',d:'Кто чем управляет, свободный транспорт',c:'var(--amber)'},
    {k:'kpi',t:'📊 KPI и аналитика',d:'Загрузка парка, итоги за период',c:'var(--green)'},
    {k:'temp',t:'🌡 Температура',d:'Режим в рефах, кто вышел за норму',c:'var(--red)'},
  ];
  if(!sec) return ce('div',{style:{padding:'26px 16px',maxWidth:900,margin:'0 auto'}},
    ce('div',{style:{fontWeight:800,fontSize:21,marginBottom:4}},'👔 Пульт руководителя'),
    ce('div',{style:{fontSize:13,color:'var(--text3)',marginBottom:22}},'Выберите раздел — внутри всё кратко, нажатие открывает подробности.'),
    ce('div',{style:{display:'grid',gap:12}},
      secs.map(function(s){ return ce('button',{key:s.k,className:'fl-press',onClick:function(){setSec(s.k);},style:{
        width:'100%',padding:'20px 22px',borderRadius:15,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:15,
        background:'color-mix(in srgb,'+s.c+' 10%,transparent)',border:'1px solid color-mix(in srgb,'+s.c+' 38%,transparent)'}},
        ce('div',{style:{flex:1}},
          ce('div',{style:{fontWeight:800,fontSize:18,color:s.c}},s.t),
          ce('div',{style:{fontSize:12.5,color:'var(--text3)',marginTop:3}},s.d)),
        ce('span',{style:{fontSize:20,color:s.c}},'›')); })));
  const cur=secs.find(function(s){return s.k===sec;});
  return ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
    ce('div',{style:{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}},
      ce('button',{className:'fl-press',onClick:function(){setSec(null);},style:{padding:'8px 14px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid var(--border2)',background:'var(--bg2)',color:'var(--text2)',fontWeight:800,fontSize:12.5}},'‹ Разделы'),
      ce('div',{style:{fontWeight:800,fontSize:17,color:cur.c}},cur.t)),
    sec==='log'?ce(BossLogistics,{trucks:props.trucks,clients:props.clients,plans:props.plans}):null,
    sec==='mec'?ce(BossMechanic,{tractors:props.tractors,trailers:props.trailers,acts:props.acts,tires:props.tires,bags:props.bags,akb:props.akb,kasko:props.kasko}):null,
    sec==='hr'?ce(BossHr,{drivers:props.hrDrivers,vacations:props.hrVacations,waybills:props.hrWaybills,history:props.history}):null,
    sec==='board'?ce(ManagerBoard,{trucks:props.trucks,onUpdate:props.onUpdate,search:props.search,setSearch:props.setSearch}):null,
    sec==='kpi'?ce(ManagerKPI,{trucks:props.trucks,orders:props.orders,history:props.history}):null,
    sec==='temp'?ce(TempTab,{trucks:props.trucks,clients:props.clients}):null);
}
function MechBase({trucks,tractors,trailers}){
  const moving=(trucks||[]).filter(function(t){ return MOVING.includes(t.status); });
  const findT=function(plate){ return (tractors||[]).find(function(x){ return normPlate(x.plate)===normPlate(plate); }); };
  const worst=function(mt){
    if(!mt) return null;
    var arr=[kmStatus(mt.odometer,mt.toMileage,TO_TRACTOR_KM,TO_TRACTOR_WARN_KM),
             tireStatus(mt.odometer,mt.tireSteer,TIRE_STEER_KM,TIRE_WARN_KM),
             tireStatus(mt.odometer,mt.tireDrive,TIRE_DRIVE_KM,TIRE_WARN_KM),
             dateStatus(mt.techInsp),dateStatus(mt.insurance),dateStatus(mt.kasko),dateStatus(mt.pass)];
    var labels=['ТО','шины руль','шины ведущая','техосмотр','страховка','КАСКО','пропуск'];
    var ri=arr.findIndex(function(x){return x.st==='red';});
    if(ri>=0) return {s:arr[ri],what:labels[ri]};
    var ai=arr.findIndex(function(x){return x.st==='amber';});
    if(ai>=0) return {s:arr[ai],what:labels[ai]};
    return null;
  };
  const rows=moving.map(function(t){ var mt=findT(t.plate); return {t:t,mt:mt,w:worst(mt),ft:t.freeAt?new Date(t.freeAt).getTime():null}; })
    .sort(function(a,b){
      var ar=(a.w&&a.w.s.st==='red')?0:1, br=(b.w&&b.w.s.st==='red')?0:1;
      if(ar!==br) return ar-br;
      if(a.ft==null) return 1; if(b.ft==null) return -1; return a.ft-b.ft; });
  const need=rows.filter(function(r){ return r.w; }).length;
  return ce('div',null,
    ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:12,lineHeight:1.6}},
      'Свои машины, которые сейчас в рейсе, — отсортированы: сначала те, у кого что-то просрочено, потом по времени возвращения. Видно, когда машина будет на базе и что на ней нужно сделать.'),
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:11,marginBottom:14}},
      dashCard('🚚 В рейсе',rows.length,'var(--accent)'),
      dashCard('🔧 Нужно обслужить',need,need?'var(--amber)':'var(--text3)','из тех, кто в рейсе')),
    rows.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Сейчас нет своих машин в рейсе.'):
    ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
      rows.map(function(r,i){ var t=r.t;
        return ce('div',{key:t.id,style:{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',flexWrap:'wrap',
          borderBottom:i<rows.length-1?'1px solid var(--border)':'none',
          borderLeft:'3px solid '+(r.w?r.w.s.color:'transparent'),
          background:(r.w&&r.w.s.st==='red')?'color-mix(in srgb,var(--red) 7%,transparent)':'transparent'}},
          ce('span',{style:{fontWeight:800,minWidth:100}},t.plate||'—'),
          ce('span',{style:{color:'var(--text2)',minWidth:160}},t.driver||'—'),
          ce('span',{style:{color:'var(--text3)',fontSize:12.5,flex:1,minWidth:180}},(t.loadAddr||'—')+' → '+(t.unloadAddr||'—')),
          ce('div',{style:{display:'flex',flexDirection:'column',gap:1,minWidth:130}},
            ce('span',{style:{fontSize:9.5,color:'var(--text3)',fontWeight:700}},'БУДЕТ НА БАЗЕ'),
            ce('span',{style:{fontSize:12.5,fontWeight:800,color:r.ft&&r.ft<Date.now()?'var(--amber)':'var(--text)'}},t.freeAt?fmtDT(t.freeAt):'—')),
          r.w?ce('span',{style:{padding:'4px 10px',borderRadius:8,fontSize:11.5,fontWeight:800,
            background:'color-mix(in srgb,'+r.w.s.color+' 14%,transparent)',color:r.w.s.color}},r.w.what+': '+r.w.s.label)
            :(r.mt?ce('span',{style:{fontSize:11.5,color:'var(--green)',fontWeight:700}},'✓ всё в норме')
                  :ce('span',{style:{fontSize:11.5,color:'var(--text3)'}},'нет карточки у механика'))); })));
}
function MechanicTab(props){
  const tractors=props.tractors, trailers=props.trailers, acts=props.acts;
  const [view,setView]=useState('dash');
  const kaskoOpen=((props.kasko)||[]).filter(function(x){return x.status!=='готово';}).length;
  const movingCnt=((props.trucks)||[]).filter(function(t){return MOVING.includes(t.status);}).length;
  const tabs=[['dash','📊 Сводка'],['base','🚚 В рейсе'+(movingCnt?(' ('+movingCnt+')'):'')],['tractors','🚚 Тягачи ('+tractors.length+')'],['trailers','🚛 Прицепы ('+trailers.length+')'],['stock','📦 Склад'],['kasko','🛠 КАСКО'+(kaskoOpen?(' ('+kaskoOpen+')'):'')],['acts','📋 Осмотры ('+acts.length+')']];
  return ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
    ce('div',{style:{display:'inline-flex',gap:3,marginBottom:16,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:3,flexWrap:'wrap'}},
      tabs.map(function(v){ var on=view===v[0];
        return ce('button',{key:v[0],className:'fl-press',onClick:function(){setView(v[0]);},style:{padding:'8px 16px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:800,border:'none',
          background:on?'linear-gradient(135deg,var(--cyan),var(--accent))':'transparent',color:on?'#fff':'var(--text3)'}},v[1]); })),
    view==='dash'&&ce(MechDash,{tractors:tractors,trailers:trailers,acts:acts,onJump:setView}),
    view==='base'&&ce(MechBase,{trucks:props.trucks||[],tractors:tractors,trailers:trailers}),
    view==='tractors'&&ce(MechTractors,{tractors:tractors,onAdd:props.onAddTractor,onUpd:props.onUpdTractor,onDel:props.onDelTractor,onBulk:props.onBulkOdometer,onBulkCreate:props.onBulkCreate}),
    view==='trailers'&&ce(MechTrailers,{trailers:trailers,tractors:tractors,onAdd:props.onAddTrailer,onUpd:props.onUpdTrailer,onDel:props.onDelTrailer}),
    view==='stock'&&ce(MechStock,{tires:props.tires||[],bags:props.bags||[],akb:props.akb||[],tractors:tractors,trailers:trailers,
      onAddTire:props.onAddTire,onUpdTire:props.onUpdTire,onDelTire:props.onDelTire,
      onAddBag:props.onAddBag,onUpdBag:props.onUpdBag,onDelBag:props.onDelBag,
      onAddAkb:props.onAddAkb,onUpdAkb:props.onUpdAkb,onDelAkb:props.onDelAkb}),
    view==='kasko'&&ce(MechKasko,{items:props.kasko||[],tractors:tractors,trailers:trailers,onAdd:props.onAddKasko,onUpd:props.onUpdKasko,onDel:props.onDelKasko}),
    view==='acts'&&ce(MechActs,{acts:acts,onSave:props.onSaveAct,onDel:props.onDelAct}));
}
// ═══════════ КАДРЫ ═══════════
const VAC_TYPES=['отпуск','выходной','больничный','отгул'];
const VAC_COLOR={'отпуск':'#6366f1','выходной':'#22c55e','больничный':'#ef4444','отгул':'#f59e0b'};
const MONTHS_RU=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
function HrLegend(){
  const [open,setOpen]=useState(false);
  const row=(icon,name,rule)=>ce('div',{key:name,style:{display:'flex',gap:10,padding:'8px 12px',borderBottom:'1px solid var(--border)',fontSize:12.5,alignItems:'baseline'}},
    ce('span',{style:{fontSize:13,width:18,flexShrink:0}},icon),
    ce('span',{style:{fontWeight:800,minWidth:150,flexShrink:0}},name),
    ce('span',{style:{color:'var(--text2)',lineHeight:1.5}},rule));
  return ce('div',{style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:13,marginBottom:20,overflow:'hidden'}},
    ce('button',{className:'fl-press',onClick:()=>setOpen(!open),style:{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'12px 16px',
      background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',color:'var(--text)',fontSize:13.5,fontWeight:800,textAlign:'left'}},
      ce('span',null,'ℹ️'),'Как считаются статусы',
      ce('span',{style:{marginLeft:'auto',color:'var(--text3)',fontSize:12,fontWeight:600}},open?'скрыть ▲':'показать ▼')),
    open?ce('div',null,
      row('📆','Дни без выходного','считается от даты «на работе с». Зелёный — до '+WORK_AMBER_DAYS+' дн., оранжевый — с '+WORK_AMBER_DAYS+', красный — с '+WORK_RED_DAYS+'. У кого отпуск/выходной — счётчик не идёт.'),
      row('📋','Путевой лист','по числу рейсов: до '+(WAYBILL_AMBER-1)+' — зелёный, '+WAYBILL_AMBER+' — оранжевый, '+WAYBILL_RED+' и больше — красный (пора менять).'),
      row('📅','Отпуска','календарь по дням. Внизу показывает, какие машины остаются без водителя — чтобы не было накладок.'),
      row('🚚','На базу','машины в рейсе, отсортированы по времени освобождения — кто раньше будет в Минске, тому раньше менять путевой.')):null);
}
function HrDash({drivers,vacations,waybills,history,trucks,onJump}){
  const worked=drivers.map(function(d){ var n=workedDays(d,vacations); return {d:d,days:n,s:workStatus(n),offToday:isOffToday(d,vacations)}; })
    .filter(function(x){ return !x.offToday; });
  const red=worked.filter(function(x){ return x.s.st==='red'; });
  const amber=worked.filter(function(x){ return x.s.st==='amber'; });
  const tripsSince=function(name,sinceISO){ var since=dOnly(sinceISO)||0;
    return (history||[]).filter(function(e){ return e&&e.action==='dispatch'&&(e.driver||'').trim()===(name||'').trim()&&(dOnly(e.ts)==null||dOnly(e.ts)>=since); }).length; };
  const wbBad=(drivers||[]).map(function(d){ var w=(waybills||[]).find(function(x){return (x.driverName||'').trim()===(d.name||'').trim();});
    var issued=(w&&w.issued)||d.workStart||''; var n=tripsSince(d.name,issued); return {d:d,n:n,s:waybillStatus(n)}; })
    .filter(function(x){ return x.s.st!=='green'; }).sort(function(a,b){return b.n-a.n;});
  const tnow=Date.now();
  const onVac=vacations.filter(function(v){ var a=dOnly(v.from),b=dOnly(v.to); return a!=null&&b!=null&&a<=tnow&&tnow<=b; });
  const inRoute=(trucks||[]).filter(function(t){ return MOVING.includes(t.status); });
  const list=red.map(function(x){ return {who:x.d.name||'—',plate:x.d.plate||'',cat:'Без выходного',s:x.s,jump:'drivers'}; })
    .concat(amber.map(function(x){ return {who:x.d.name||'—',plate:x.d.plate||'',cat:'Без выходного',s:x.s,jump:'drivers'}; }))
    .concat(wbBad.map(function(w){ return {who:w.d.name||'—',plate:w.d.plate||'',cat:'Путевой — '+w.n+' рейса',s:w.s,jump:'waybills'}; }));
  return ce('div',null,
    ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}},
      dashCard('🧑‍✈️ Водителей',drivers.length,'var(--accent)'),
      dashCard('🚚 В рейсе сейчас',inRoute.length,'var(--accent)'),
      dashCard('🏖 В отпуске',onVac.length,'var(--violet)'),
      dashCard('🔴 Устали (30+ дн.)',red.length,'var(--red)'),
      dashCard('📋 Путевых менять',wbBad.length,'var(--cyan)')),
    inRoute.length?ce('div',{style:{marginBottom:18}},
      ce('div',{style:{fontWeight:800,fontSize:13.5,marginBottom:8}},'🚚 Сейчас в рейсе — '+inRoute.length),
      ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
        inRoute.slice(0,8).map(function(t,i){ return ce('div',{key:t.id,style:{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',fontSize:12.5,
          borderBottom:i<Math.min(inRoute.length,8)-1?'1px solid var(--border)':'none'}},
          ce('span',{style:{fontWeight:800,minWidth:100}},t.plate||'—'),
          ce('span',{style:{color:'var(--text2)',minWidth:160}},t.driver||'—'),
          ce('span',{style:{color:'var(--text3)',flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},(t.loadAddr||'—')+' → '+(t.unloadAddr||'—')),
          t.freeAt?ce('span',{style:{marginLeft:'auto',color:'var(--text3)',fontSize:11.5}},'до '+fmtDT(t.freeAt)):null); }))):null,
    ce(HrLegend,null),
    ce('div',{style:{fontWeight:800,fontSize:14,marginBottom:10}},'⚠ Требуют внимания'),
    list.length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'16px 4px'}},'Всё в порядке.'):
    ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
      list.map(function(it,i){ return ce('div',{key:i,className:'fl-press',onClick:function(){onJump(it.jump);},style:{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',
        borderBottom:i<list.length-1?'1px solid var(--border)':'none',fontSize:13}},
        ce('span',{style:{width:8,height:8,borderRadius:8,background:it.s.color,flexShrink:0}}),
        ce('span',{style:{fontWeight:800,minWidth:170}},it.who),
        ce('span',{style:{color:'var(--text3)',minWidth:90}},it.plate),
        ce('span',{style:{color:'var(--text3)'}},it.cat),
        ce('span',{style:{marginLeft:'auto',fontWeight:700,color:it.s.color}},it.s.label)); })));
}
function HrDriverRow({d,vacations,onUpd,onDel}){
  const [open,setOpen]=useState(false);
  const elapsed=elapsedDays(d);
  const off=d.workStart?offDaysCount(d,vacations,d.workStart,today()):0;
  const days=workedDays(d,vacations);
  const s=workStatus(days);
  const offToday=isOffToday(d,vacations);
  const tnow=Date.now();
  const vac=(vacations||[]).find(function(v){ var a=dOnly(v.from),b=dOnly(v.to); return v.driverName===d.name&&a!=null&&b!=null&&a<=tnow&&tnow<=b; });
  const list=(d.daysOff||[]);
  const saveList=n=>onUpd(d.id,{daysOff:n.length?n:null});
  const addOff=()=>{ saveList(list.concat([{from:today(),to:today()}])); setOpen(true); };
  const updOff=(i,patch)=>saveList(list.map(function(o,j){ return j===i?Object.assign({},o,patch):o; }));
  const delOff=i=>saveList(list.filter(function(o,j){ return j!==i; }));
  return ce('div',{style:{background:'var(--bg2)',border:'1px solid '+(s.st==='red'?'color-mix(in srgb,var(--red) 45%,transparent)':'var(--border)'),borderRadius:12,padding:'10px 12px'}},
    ce('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
      ce('input',{defaultValue:d.name||'',onBlur:function(e){ onUpd(d.id,{name:e.target.value.trim()}); },style:Object.assign({},mecInp,{fontWeight:800,width:200,flexShrink:0})}),
      ce('input',{defaultValue:d.plate||'',placeholder:'Машина',onBlur:function(e){ onUpd(d.id,{plate:e.target.value.trim()}); },style:Object.assign({},mecInp,{width:110,flexShrink:0})}),
      ce('div',{style:{display:'flex',flexDirection:'column',gap:2}},
        ce('span',{style:{fontSize:9.5,color:'var(--text3)',fontWeight:700}},'НА РАБОТЕ С'),
        ce('input',{type:'date',defaultValue:d.workStart||'',onBlur:function(e){ onUpd(d.id,{workStart:e.target.value}); },style:Object.assign({},mecInp,{width:145})})),
      vac?ce('span',{style:{padding:'5px 11px',borderRadius:8,fontSize:11.5,fontWeight:800,color:'#fff',background:VAC_COLOR[vac.type]||'var(--violet)'}},
        (vac.type||'отпуск')+' до '+fmtD(vac.to))
        :offToday?ce('span',{style:{padding:'5px 11px',borderRadius:8,fontSize:11.5,fontWeight:800,color:'#fff',background:VAC_COLOR['выходной']}},'сегодня выходной')
        :ce(StatusPill,{s:s,label:'Отработал'}),
      (elapsed!=null&&off>0)?ce('span',{style:{fontSize:11,color:'var(--text3)'}},'прошло '+elapsed+' дн. − '+off+' вых.'):null,
      ce('button',{className:'fl-press',onClick:()=>setOpen(!open),style:{marginLeft:'auto',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:11.5,fontWeight:800,
        border:'1px solid '+(list.length?'color-mix(in srgb,var(--violet) 50%,transparent)':'var(--border2)'),background:'transparent',color:list.length?'var(--violet)':'var(--text3)'}},
        '🏠 Выходные'+(list.length?(' ('+list.length+')'):'')+(open?' ▲':' ▼')),
      ce('button',{className:'fl-press',onClick:function(){ onUpd(d.id,{workStart:today()}); },title:'Начать отсчёт заново с сегодняшнего дня',
        style:{padding:'7px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:11.5,fontWeight:800,
        border:'1px solid color-mix(in srgb,var(--green) 45%,transparent)',background:'transparent',color:'var(--green)'}},'▶ Вышел сегодня'),
      ce('button',{onClick:function(){ if(window.confirm('Удалить '+(d.name||'')+' из списка кадров?')) onDel(d.id); },className:'fl-press',
        style:{width:30,height:30,borderRadius:8,border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer',flexShrink:0}},'🗑')),
    open?ce('div',{style:{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}},
      ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:8,lineHeight:1.5}},
        'Выходные внутри рабочего периода — эти дни вычитаются из счётчика. Отпуска и больничные из календаря вычитаются автоматически, здесь их дублировать не нужно.'),
      list.length===0?ce('div',{style:{fontSize:12.5,color:'var(--text3)',marginBottom:8}},'Выходных не отмечено.'):
      ce('div',{style:{display:'grid',gap:6,marginBottom:8}},
        list.map(function(o,i){ var n=(dOnly(o.from)!=null&&dOnly(o.to)!=null)?Math.floor((dOnly(o.to)-dOnly(o.from))/86400000)+1:0;
          return ce('div',{key:i,style:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}},
            ce('span',{style:{fontSize:11.5,color:'var(--text3)',width:16}},'с'),
            ce('input',{type:'date',value:o.from||'',onChange:function(e){ updOff(i,{from:e.target.value}); },style:Object.assign({},mecInp,{width:145})}),
            ce('span',{style:{fontSize:11.5,color:'var(--text3)'}},'по'),
            ce('input',{type:'date',value:o.to||'',onChange:function(e){ updOff(i,{to:e.target.value}); },style:Object.assign({},mecInp,{width:145})}),
            ce('span',{style:{fontSize:11.5,fontWeight:700,color:n>0?'var(--text2)':'var(--red)'}},n>0?(n+' дн.'):'проверьте даты'),
            ce('button',{onClick:function(){delOff(i);},className:'fl-press',style:{width:26,height:26,borderRadius:7,border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer',fontSize:12}},'✕')); })),
      ce('button',{className:'fl-press',onClick:addOff,style:{padding:'7px 14px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:800,
        border:'1px solid color-mix(in srgb,var(--green) 45%,transparent)',background:'color-mix(in srgb,var(--green) 12%,transparent)',color:'var(--green)'}},'➕ Добавить выходные')):null);
}
function HrDrivers({drivers,vacations,onAdd,onUpd,onDel,onImport}){
  const [q,setQ]=useState('');
  const list=drivers.filter(function(d){ var s=(q||'').toLowerCase(); return !s||((d.name||'')+' '+(d.plate||'')).toLowerCase().indexOf(s)>=0; })
    .sort(function(a,b){ var x=workedDays(a,vacations),y=workedDays(b,vacations); return (y==null?-1:y)-(x==null?-1:x); });
  return ce('div',null,
    ce('div',{style:{display:'flex',gap:9,marginBottom:12,flexWrap:'wrap'}},
      ce('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Поиск по имени или машине',
        style:{flex:1,minWidth:200,background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:'10px 12px',color:'var(--text)',fontSize:13.5,fontFamily:'inherit'}}),
      ce('button',{className:'fl-press',onClick:onImport,style:{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--accent) 50%,transparent)',background:'color-mix(in srgb,var(--accent) 14%,transparent)',color:'var(--accent)',fontWeight:800,fontSize:12.5}},'⇩ Взять из парка'),
      ce('span',{style:{fontSize:11,color:'var(--text3)',alignSelf:'center'}},'только свои машины'),
      ce('button',{className:'fl-press',onClick:function(){ var n=window.prompt('ФИО водителя:'); if(n&&n.trim()){ var p=window.prompt('Гос.номер машины (можно пропустить):')||''; onAdd(n.trim(),p.trim()); } },
        style:{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12.5}},'➕ Добавить')),
    list.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Список пуст. Нажмите «Взять из парка» — водители подтянутся из карточек машин.'):
    ce('div',{style:{display:'grid',gap:8}},
      list.map(function(d){ return ce(HrDriverRow,{key:d.id,d:d,vacations:vacations,onUpd:onUpd,onDel:onDel}); })));
}
function VacEditor({v,drivers,onSave,onCancel}){
  v=v||{};
  const [driverName,setDriverName]=useState(v.driverName||'');
  const [type,setType]=useState(v.type||'отпуск');
  const [from,setFrom]=useState(v.from||today());
  const [to,setTo]=useState(v.to||today());
  const [note,setNote]=useState(v.note||'');
  const bad=!driverName||!from||!to||(dOnly(to)<dOnly(from));
  return ce(Modal,{title:v.id?'✎ Изменить период':'➕ Новый период',onClose:onCancel},
    ce('div',{style:{display:'grid',gap:10}},
      fld('Водитель',ce('select',{value:driverName,onChange:e=>setDriverName(e.target.value),style:mecInp},
        ce('option',{value:''},'— выберите —'),
        drivers.map(function(d){ return ce('option',{key:d.id,value:d.name},(d.name||'—')+(d.plate?(' · '+d.plate):'')); }))),
      fld('Тип',ce('select',{value:type,onChange:e=>setType(e.target.value),style:mecInp},
        VAC_TYPES.map(function(t){ return ce('option',{key:t,value:t},t); }))),
      ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
        fld('С',ce('input',{type:'date',value:from,onChange:e=>setFrom(e.target.value),style:mecInp})),
        fld('По',ce('input',{type:'date',value:to,onChange:e=>setTo(e.target.value),style:mecInp}))),
      fld('Заметка',ce('input',{value:note,onChange:e=>setNote(e.target.value),style:mecInp})),
      (dOnly(to)<dOnly(from))?ce('div',{style:{color:'var(--red)',fontSize:12,fontWeight:700}},'Дата «по» раньше даты «с»'):null),
    ce('div',{style:{display:'flex',gap:9,marginTop:16}},
      ce(Btn,{onClick:onCancel,color:'var(--text3)',wide:true},'Отмена'),
      ce('button',{onClick:function(){ if(!bad) onSave(Object.assign({},v,{driverName,type,from,to,note})); },disabled:bad,className:'fl-press',
        style:{flex:1,padding:'12px',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:bad?'default':'pointer',
        background:bad?'var(--bg3)':'linear-gradient(135deg,var(--accent),var(--accent2))',opacity:bad?0.5:1}},'Сохранить')));
}
function HrVacationsView({vacations,drivers,onSave,onDel}){
  const now=new Date();
  const [ym,setYm]=useState({y:now.getFullYear(),m:now.getMonth()});
  const [edit,setEdit]=useState(null);
  const [adding,setAdding]=useState(false);
  const dim=new Date(ym.y,ym.m+1,0).getDate();
  const days=[]; for(var i=1;i<=dim;i++) days.push(i);
  const dayTime=d=>new Date(ym.y,ym.m,d).setHours(0,0,0,0);
  const covers=(v,d)=>{ var a=dOnly(v.from),b=dOnly(v.to),t=dayTime(d); return a!=null&&b!=null&&a<=t&&t<=b; };
  const rows=drivers.filter(function(d){ return vacations.some(function(v){ return v.driverName===d.name && days.some(function(dd){ return covers(v,dd); }); }); });
  const absentOn=d=>vacations.filter(function(v){ return covers(v,d); });
  const trucksOut=d=>{ var names=absentOn(d).map(function(v){return v.driverName;});
    return drivers.filter(function(dr){ return names.indexOf(dr.name)>=0 && dr.plate; }).map(function(dr){ return dr.plate; }); };
  const cellW=26;
  const isToday=d=>{ var t=new Date(); return t.getFullYear()===ym.y&&t.getMonth()===ym.m&&t.getDate()===d; };
  const isWeekend=d=>{ var w=new Date(ym.y,ym.m,d).getDay(); return w===0||w===6; };
  const shift=n=>{ var m=ym.m+n,y=ym.y; if(m<0){m=11;y--;} if(m>11){m=0;y++;} setYm({y:y,m:m}); };
  const listMonth=vacations.filter(function(v){ return days.some(function(d){ return covers(v,d); }); })
    .sort(function(a,b){ return (dOnly(a.from)||0)-(dOnly(b.from)||0); });
  return ce('div',null,
    adding?ce(VacEditor,{drivers:drivers,onSave:function(v){ onSave(v); setAdding(false); },onCancel:function(){setAdding(false);}}):null,
    edit?ce(VacEditor,{v:edit,drivers:drivers,onSave:function(v){ onSave(v); setEdit(null); },onCancel:function(){setEdit(null);}}):null,
    ce('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}},
      ce('button',{className:'fl-press',onClick:()=>shift(-1),style:{width:34,height:34,borderRadius:9,border:'1px solid var(--border2)',background:'var(--bg2)',color:'var(--text)',cursor:'pointer',fontSize:15}},'‹'),
      ce('div',{style:{fontWeight:800,fontSize:15,minWidth:150,textAlign:'center'}},MONTHS_RU[ym.m]+' '+ym.y),
      ce('button',{className:'fl-press',onClick:()=>shift(1),style:{width:34,height:34,borderRadius:9,border:'1px solid var(--border2)',background:'var(--bg2)',color:'var(--text)',cursor:'pointer',fontSize:15}},'›'),
      ce('div',{style:{display:'flex',gap:10,marginLeft:12,flexWrap:'wrap'}},
        VAC_TYPES.map(function(t){ return ce('span',{key:t,style:{display:'inline-flex',alignItems:'center',gap:5,fontSize:11.5,color:'var(--text3)'}},
          ce('span',{style:{width:10,height:10,borderRadius:3,background:VAC_COLOR[t]}}),t); })),
      ce('button',{className:'fl-press',onClick:function(){setAdding(true);},style:{marginLeft:'auto',padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
        border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12.5}},'➕ Отметить период')),
    ce('div',{style:{overflowX:'auto',border:'1px solid var(--border)',borderRadius:12,marginBottom:16}},
      ce('div',{style:{minWidth:200+dim*cellW}},
        ce('div',{style:{display:'flex',borderBottom:'1px solid var(--border)',background:'var(--bg2)'}},
          ce('div',{style:{width:200,flexShrink:0,padding:'8px 10px',fontSize:11,fontWeight:800,color:'var(--text3)'}},'ВОДИТЕЛЬ'),
          days.map(function(d){ return ce('div',{key:d,style:{width:cellW,flexShrink:0,textAlign:'center',padding:'8px 0',fontSize:10.5,fontWeight:700,
            color:isToday(d)?'var(--accent)':(isWeekend(d)?'var(--text3)':'var(--text2)'),background:isToday(d)?'color-mix(in srgb,var(--accent) 14%,transparent)':'transparent'}},d); })),
        rows.length===0?ce('div',{style:{padding:'22px 12px',color:'var(--text3)',fontSize:13}},'В этом месяце отметок нет.'):
        rows.map(function(dr,ri){ return ce('div',{key:dr.id,style:{display:'flex',borderBottom:ri<rows.length-1?'1px solid var(--border)':'none'}},
          ce('div',{style:{width:200,flexShrink:0,padding:'7px 10px',fontSize:12.5,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},
            dr.name,dr.plate?ce('span',{style:{color:'var(--text3)',fontWeight:600}},' · '+dr.plate):null),
          days.map(function(d){ var v=vacations.find(function(x){ return x.driverName===dr.name && covers(x,d); });
            return ce('div',{key:d,onClick:v?function(){setEdit(v);}:null,title:v?(v.type+': '+fmtD(v.from)+' — '+fmtD(v.to)):'',
              style:{width:cellW,flexShrink:0,height:30,cursor:v?'pointer':'default',
              background:v?(VAC_COLOR[v.type]||'var(--violet)'):(isWeekend(d)?'color-mix(in srgb,var(--text3) 6%,transparent)':'transparent'),
              borderLeft:'1px solid var(--border)'}}); })); }),
        ce('div',{style:{display:'flex',borderTop:'1px solid var(--border)',background:'var(--bg2)'}},
          ce('div',{style:{width:200,flexShrink:0,padding:'7px 10px',fontSize:11,fontWeight:800,color:'var(--text3)'}},'МАШИН БЕЗ ВОДИТЕЛЯ'),
          days.map(function(d){ var n=trucksOut(d).length;
            return ce('div',{key:d,title:n?trucksOut(d).join(', '):'',style:{width:cellW,flexShrink:0,textAlign:'center',padding:'7px 0',fontSize:11,fontWeight:800,
              color:n>=3?'var(--red)':(n>0?'var(--amber)':'var(--text3)'),borderLeft:'1px solid var(--border)'}},n||'·'); })))),
    ce('div',{style:{fontWeight:800,fontSize:13.5,marginBottom:8}},'Периоды в этом месяце'),
    listMonth.length===0?ce('div',{style:{color:'var(--text3)',fontSize:13,padding:'10px 2px'}},'Нет.'):
    ce('div',{style:{display:'grid',gap:7}},
      listMonth.map(function(v){ var dr=drivers.find(function(x){return x.name===v.driverName;});
        var clash=listMonth.filter(function(o){ return o.id!==v.id && overlapDays(o,v); });
        return ce('div',{key:v.id,style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:'9px 12px',fontSize:12.5}},
          ce('span',{style:{width:10,height:10,borderRadius:3,background:VAC_COLOR[v.type]||'var(--violet)',flexShrink:0}}),
          ce('span',{style:{fontWeight:800,minWidth:170}},v.driverName||'—'),
          ce('span',{style:{color:'var(--text3)',minWidth:80}},(dr&&dr.plate)||''),
          ce('span',{style:{fontWeight:700}},v.type),
          ce('span',{style:{color:'var(--text2)'}},fmtD(v.from)+' — '+fmtD(v.to)),
          v.note?ce('span',{style:{color:'var(--text3)'}},'· '+v.note):null,
          clash.length?ce('span',{style:{color:'var(--amber)',fontWeight:700,fontSize:11.5}},'⚠ пересекается с: '+clash.map(function(c){return c.driverName;}).join(', ')):null,
          ce('button',{onClick:function(){setEdit(v);},className:'fl-press',style:{marginLeft:'auto',width:28,height:28,borderRadius:7,border:'1px solid var(--border2)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer'}},'✎'),
          ce('button',{onClick:function(){ if(window.confirm('Удалить период?')) onDel(v.id); },className:'fl-press',style:{width:28,height:28,borderRadius:7,border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer'}},'🗑')); })));
}
function HrWaybills({drivers,history,waybills,onSave,onDel}){
  const [showAll,setShowAll]=useState(false);
  // сколько рейсов сделал водитель ПОСЛЕ выдачи путевого — по журналу отправок
  const tripsSince=function(name,sinceISO){
    var since=dOnly(sinceISO)||0;
    return (history||[]).filter(function(e){ return e&&e.action==='dispatch'&&(e.driver||'').trim()===(name||'').trim()
      && (dOnly(e.ts)==null || dOnly(e.ts)>=since); }).length;
  };
  const wbOf=function(name){ return (waybills||[]).find(function(w){ return (w.driverName||'').trim()===(name||'').trim(); }); };
  // строим по каждому водителю его путевой (создаём запись при первой отправке)
  const rows=(drivers||[]).map(function(d){
    var w=wbOf(d.name);
    var issued=(w&&w.issued)||d.workStart||'';
    var auto=tripsSince(d.name,issued);
    var manual=w?Number(w.tripsManual):NaN;
    var trips=isNaN(manual)?auto:manual;
    return {d:d,w:w,issued:issued,auto:auto,trips:trips};
  }).filter(function(r){ return showAll || r.trips>0 || r.w; })
    .sort(function(a,b){ return (b.trips||0)-(a.trips||0); });
  const replace=function(r){
    var base=r.w||{driverName:r.d.name,plate:r.d.plate||'',num:''};
    var num=window.prompt('Новый путевой для '+r.d.name+'. Номер листа:',''); if(num===null) return;
    onSave(Object.assign({},base,{driverName:r.d.name,plate:r.d.plate||base.plate||'',num:(num||'').trim(),issued:today(),tripsManual:null}));
  };
  const setNum=function(r,num){ var base=r.w||{driverName:r.d.name,plate:r.d.plate||'',issued:r.issued}; onSave(Object.assign({},base,{driverName:r.d.name,num:num,tripsManual:null})); };
  return ce('div',null,
    ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:10,lineHeight:1.6}},
      'Счётчик рейсов ведётся автоматически: когда логист отправляет водителя в рейс — +1. Порог: 2 зелёный, 3 оранжевый, 4 и больше — красный, пора менять лист. После замены нажмите «🔄 Заменён» — счётчик обнулится с новой даты.'),
    ce('div',{style:{display:'flex',alignItems:'center',gap:12,marginBottom:12}},
      ce('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text3)',cursor:'pointer'}},
        ce('input',{type:'checkbox',checked:showAll,onChange:function(e){setShowAll(e.target.checked);}}),'показать всех водителей')),
    rows.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Пока никто не отправлен в рейс. Как логист отправит — здесь появится путевой со счётчиком. (Или включите «показать всех».)'):
    ce('div',{style:{display:'grid',gap:8}},
      rows.map(function(r){ var s=waybillStatus(r.trips);
        return ce('div',{key:r.d.id,style:{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',
          background:'var(--bg2)',border:'1px solid '+(s.st==='red'?'color-mix(in srgb,var(--red) 45%,transparent)':'var(--border)'),borderRadius:12,padding:'10px 12px'}},
          ce('div',{style:{minWidth:180}},
            ce('div',{style:{fontWeight:800,fontSize:13.5}},r.d.name||'—'),
            ce('div',{style:{fontSize:11.5,color:'var(--text3)'}},r.d.plate||'')),
          ce('div',{style:{display:'flex',flexDirection:'column',gap:2}},
            ce('span',{style:{fontSize:9.5,color:'var(--text3)',fontWeight:700}},'ПУТЕВОЙ №'),
            ce('input',{defaultValue:(r.w&&r.w.num)||'',placeholder:'номер',onBlur:function(e){ setNum(r,e.target.value.trim()); },style:Object.assign({},mecInp,{width:100,fontWeight:800})})),
          ce('div',{style:{display:'flex',flexDirection:'column',gap:2}},
            ce('span',{style:{fontSize:9.5,color:'var(--text3)',fontWeight:700}},'ВЫДАН'),
            ce('span',{style:{fontSize:12.5,color:'var(--text2)',padding:'6px 0'}},r.issued?fmtD(r.issued):'—')),
          ce('div',{style:{minWidth:130,textAlign:'center'}},ce(StatusPill,{s:s,label:'Рейсов по листу'})),
          ce('button',{className:'fl-press',onClick:function(){replace(r);},title:'Заменён новый путевой лист — счётчик обнулится с сегодня',
            style:{marginLeft:'auto',padding:'8px 13px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:800,
            border:'1px solid color-mix(in srgb,var(--accent) 45%,transparent)',background:'color-mix(in srgb,var(--accent) 10%,transparent)',color:'var(--accent)'}},'🔄 Заменён'),
          r.w?ce('button',{onClick:function(){ if(window.confirm('Убрать путевой для '+(r.d.name||'')+'? Счётчик начнёт считать заново.')) onDel(r.w.id); },className:'fl-press',
            style:{width:30,height:30,borderRadius:8,border:'1px solid color-mix(in srgb,var(--red) 40%,transparent)',background:'transparent',color:'var(--red)',cursor:'pointer'}},'🗑'):null); })));
}
function HrBase({trucks,waybills,history,drivers}){
  const moving=(trucks||[]).filter(function(t){ return MOVING.includes(t.status); });
  const tripsFor=function(t){
    var d=(drivers||[]).find(function(x){ return normPlate(x.plate)===normPlate(t.plate)||(x.name||'').trim()===(t.driver||'').trim(); });
    var name=(t.driver||(d&&d.name)||'').trim();
    var w=(waybills||[]).find(function(x){ return (x.driverName||'').trim()===name; });
    var issued=(w&&w.issued)||(d&&d.workStart)||'';
    var since=dOnly(issued)||0;
    var n=(history||[]).filter(function(e){ return e&&e.action==='dispatch'&&(e.driver||'').trim()===name&&(dOnly(e.ts)==null||dOnly(e.ts)>=since); }).length;
    return {n:n,num:w&&w.num};
  };
  const rows=moving.map(function(t){ var wb=tripsFor(t); return {t:t,wb:wb,s:waybillStatus(wb.n),ft:t.freeAt?new Date(t.freeAt).getTime():null}; })
    .sort(function(a,b){ if(a.ft==null) return 1; if(b.ft==null) return -1; return a.ft-b.ft; });
  return ce('div',null,
    ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:12,lineHeight:1.6}},
      'Машины в рейсе, отсортированы по времени освобождения — кто раньше вернётся на базу, тот выше. Если у машины путевой лист «оранжевый» или «красный» — готовьте замену к её приезду.'),
    rows.length===0?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'Сейчас нет машин в рейсе.'):
    ce('div',{style:{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}},
      rows.map(function(r,i){ var t=r.t;
        return ce('div',{key:t.id,style:{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',flexWrap:'wrap',
          borderBottom:i<rows.length-1?'1px solid var(--border)':'none',
          background:(r.s&&r.s.st==='red')?'color-mix(in srgb,var(--red) 7%,transparent)':'transparent'}},
          ce('span',{style:{fontWeight:800,minWidth:100}},t.plate||'—'),
          ce('span',{style:{color:'var(--text2)',minWidth:170}},t.driver||'—'),
          ce('span',{style:{color:'var(--text3)',fontSize:12.5,flex:1,minWidth:200}},
            (t.loadAddr||'—')+' → '+(t.unloadAddr||'—')),
          ce('div',{style:{display:'flex',flexDirection:'column',gap:1,minWidth:130}},
            ce('span',{style:{fontSize:9.5,color:'var(--text3)',fontWeight:700}},'ОСВОБОДИТСЯ'),
            ce('span',{style:{fontSize:12.5,fontWeight:800,color:r.ft&&r.ft<Date.now()?'var(--amber)':'var(--text)'}},t.freeAt?fmtDT(t.freeAt):'—')),
          r.wb&&r.wb.n>0?ce(StatusPill,{s:r.s,label:'Путевой'+(r.wb.num?(' №'+r.wb.num):'')}):ce('span',{style:{fontSize:11.5,color:'var(--text3)'}},'рейсов пока нет')); })));
}
function HrTab(props){
  const [view,setView]=useState('dash');
  const tabs=[['dash','📊 Сводка'],['drivers','🧑‍✈️ Водители ('+props.drivers.length+')'],['vac','📅 Отпуска'],['waybills','📋 Путевые'],['base','🚚 На базу']];
  return ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
    ce('div',{style:{display:'inline-flex',gap:3,marginBottom:16,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:3,flexWrap:'wrap'}},
      tabs.map(function(v){ var on=view===v[0];
        return ce('button',{key:v[0],className:'fl-press',onClick:function(){setView(v[0]);},style:{padding:'8px 16px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:800,border:'none',
          background:on?'linear-gradient(135deg,var(--violet),var(--accent))':'transparent',color:on?'#fff':'var(--text3)'}},v[1]); })),
    view==='dash'&&ce(HrDash,{drivers:props.drivers,vacations:props.vacations,waybills:props.waybills,history:props.history,trucks:props.trucks,onJump:setView}),
    view==='drivers'&&ce(HrDrivers,{drivers:props.drivers,vacations:props.vacations,onAdd:props.onAddDriver,onUpd:props.onUpdDriver,onDel:props.onDelDriver,onImport:props.onImportDrivers}),
    view==='vac'&&ce(HrVacationsView,{vacations:props.vacations,drivers:props.drivers,onSave:props.onSaveVacation,onDel:props.onDelVacation}),
    view==='waybills'&&ce(HrWaybills,{waybills:props.waybills,drivers:props.drivers,history:props.history,onSave:props.onSaveWaybill,onDel:props.onDelWaybill}),
    view==='base'&&ce(HrBase,{trucks:props.trucks,waybills:props.waybills,history:props.history,drivers:props.drivers}));
}
function App() {
  const [auth,setAuth] = useState(()=>new URLSearchParams(window.location.search).has('pin'));
  const [trucks,setTrucks] = useState([]);
  const [clients,setClients] = useState([]);
  const [orders,setOrders] = useState([]);
  const [plans,setPlans] = useState([]);
  const [loaded,setLoaded] = useState(false);
  const cloudOrdersRef = useRef(false);
  const cloudPlansRef = useRef(false);
  const [routeDay,setRouteDay] = useState(today());
  const [theme,setTheme] = useState('dark');
  const [lang,setLang] = useState('ru');
  window._lang = lang;
  const [tab,setTab] = useState(()=>{ try{ var _r=localStorage.getItem('egida_role'); return _r==='Механик'?'mechanic':(_r==='Кадры'?'hr':(_r==='Руководитель'?'boss':'park')); }catch(e){ return 'park'; } });
  const [search,setSearch] = useState('');
  const [stFilter,setStFilter] = useState('ALL');
  const [toast,setToast] = useState('');
  const [logDate,setLogDate] = useState(today());
  const [driverPageId,setDriverPageId] = useState(null);
  const [modal,setModal] = useState(null);
  const [movingModal,setMovingModal] = useState(null);
  const [role,setRole] = useState(()=>{ try{return localStorage.getItem('egida_role')||null;}catch(e){return null;} });
  const [settings,setSettings] = useState({});
  const [history,setHistory] = useState([]);
  const [logists,setLogists] = useState(DEFAULT_LOGISTS);
  const [mecTractors,setMecTractors] = useState([]);
  const [mecTrailers,setMecTrailers] = useState([]);
  const [mecActs,setMecActs] = useState([]);
  const [mecTires,setMecTires] = useState([]);
  const [mecBags,setMecBags] = useState([]);
  const [mecAkb,setMecAkb] = useState([]);
  const [mecKasko,setMecKasko] = useState([]);
  const [hrDrivers,setHrDrivers] = useState([]);
  const [hrVacations,setHrVacations] = useState([]);
  const [hrWaybills,setHrWaybills] = useState([]);
  applyLogists(logists);
  const [chatLast,setChatLast]=useState(null);
  const [chatSeen,setChatSeen]=useState(()=>{ try{return localStorage.getItem('chat_seen_office')||'';}catch(e){return '';} });
  const chatUnread = !!(chatLast && chatLast.from==='driver' && (chatLast.ts||'')>(chatSeen||''));
  const markChatSeen = (ts)=>{ if(ts&&ts>(chatSeen||'')){ setChatSeen(ts); try{localStorage.setItem('chat_seen_office',ts);}catch(e){} } };
  const isBoss = role==='Руководитель';
  const isMech = role==='Механик';
  const isHr = role==='Кадры';
  useEffect(()=>{ if(role==='Руководитель') setTab('boss'); },[role]);
  const [managerView,setManagerView]=useState('board');
  const pickRole = (r)=>{ setRole(r); try{localStorage.setItem('egida_role',r);}catch(e){}
    setTab(r==='Механик'?'mechanic':(r==='Кадры'?'hr':(r==='Руководитель'?'boss':'park')));
    setModal(null); setDriverPageId(null); };
  const saveLogists = (newList)=>{ var oldN=(logists||[]).map(function(l){return l.name;}); var newN=newList.map(function(l){return l.name;}); var removed=oldN.filter(function(n){return newN.indexOf(n)<0;}); if(removed.length){ trucks.forEach(function(t){ if(removed.indexOf(t.logist)>=0) updTruck(t.id,{logist:null}); }); } setLogists(newList); saveOr('/settings/logists',newList,'Список логистов обновлён'); };
  const saveTpl = (o)=>{ var dt={fwd:o.fwd,back:o.back}; setSettings(p=>Object.assign({},p,{driverTpl:dt,groupWa:o.groupWa||'',groupMax:o.groupMax||''}));
    dbPut('/settings/driverTpl',dt); dbPut('/settings/groupWa',o.groupWa||''); dbPut('/settings/groupMax',o.groupMax||''); setModal(null); tShow('Настройки сохранены'); };

  const tShow = msg=>{ setToast(msg); setTimeout(()=>setToast(''),2400); };
  const tErr = msg=>{ setToast('ERR:'+msg); setTimeout(()=>setToast(''),7000); };
  const saveOr = (path,val,okMsg)=>{ dbSave(path,val).then(function(r){ if(r.ok){ if(okMsg) tShow(okMsg); } else { tErr('НЕ СОХРАНЕНО в базу: '+r.err); } }); };
  useEffect(()=>{ dbGet('/settings').then(function(x){ if(x&&typeof x==='object') setSettings(x); }).catch(function(){}); },[]);
  useEffect(()=>{ var f=function(){ dbGet('/history').then(function(o){ if(o&&typeof o==='object') setHistory(Object.keys(o).map(function(k){return o[k];}).filter(Boolean)); }).catch(function(){}); }; f(); var iv=setInterval(f,60000); return function(){ clearInterval(iv); }; },[]);
  const [dbHealth,setDbHealth] = useState(null);
  useEffect(()=>{ dbSave('/_health',{ts:Date.now()}).then(function(r){
    if(!r.ok){ setDbHealth(r.err||'запись отклонена'); }
    else { setDbHealth('ok'); }
  }); },[]);
  useEffect(()=>{ dbFetch('/settings/logists').then(function(r){
    if(!r.ok){ tErr('Не удалось прочитать базу ('+r.err+'). Показаны логисты по умолчанию.'); return; }
    var a=normLogists(r.val); if(a&&a.length) setLogists(a);
  }); },[]);
  useEffect(()=>{ var f=function(){
    dbFetch('/mechanic/tractors').then(function(r){ if(r.ok){ var v=mapVals(r.val); setMecTractors(v); cacheSet('mec_tractors',v); } else { var c=cacheGet('mec_tractors'); if(c&&c.length) setMecTractors(function(p){ return p.length?p:c; }); } });
    dbFetch('/mechanic/trailers').then(function(r){ if(r.ok){ var v=mapVals(r.val); setMecTrailers(v); cacheSet('mec_trailers',v); } else { var c=cacheGet('mec_trailers'); if(c&&c.length) setMecTrailers(function(p){ return p.length?p:c; }); } });
    dbFetch('/mechanic/acts').then(function(r){ if(r.ok){ var v=mapVals(r.val); setMecActs(v); cacheSet('mec_acts',v); } else { var c=cacheGet('mec_acts'); if(c&&c.length) setMecActs(function(p){ return p.length?p:c; }); } });
    dbFetch('/mechanic/stock_tires').then(function(r){ if(r.ok){ var v=mapVals(r.val); setMecTires(v); cacheSet('mec_tires',v); } else { var c=cacheGet('mec_tires'); if(c&&c.length) setMecTires(function(p){ return p.length?p:c; }); } });
    dbFetch('/mechanic/stock_bags').then(function(r){ if(r.ok){ var v=mapVals(r.val); setMecBags(v); cacheSet('mec_bags',v); } else { var c=cacheGet('mec_bags'); if(c&&c.length) setMecBags(function(p){ return p.length?p:c; }); } });
    dbFetch('/mechanic/stock_akb').then(function(r){ if(r.ok){ var v=mapVals(r.val); setMecAkb(v); cacheSet('mec_akb',v); } else { var c=cacheGet('mec_akb'); if(c&&c.length) setMecAkb(function(p){ return p.length?p:c; }); } });
    dbFetch('/mechanic/kasko').then(function(r){ if(r.ok){ var v=mapVals(r.val); setMecKasko(v); cacheSet('mec_kasko',v); } else { var c=cacheGet('mec_kasko'); if(c&&c.length) setMecKasko(function(p){ return p.length?p:c; }); } });
    dbFetch('/hr/drivers').then(function(r){ if(r.ok){ var v=mapVals(r.val); setHrDrivers(v); cacheSet('hr_drivers',v); } else { var c=cacheGet('hr_drivers'); if(c&&c.length) setHrDrivers(function(p){ return p.length?p:c; }); } });
    dbFetch('/hr/vacations').then(function(r){ if(r.ok){ var v=mapVals(r.val); setHrVacations(v); cacheSet('hr_vac',v); } else { var c=cacheGet('hr_vac'); if(c&&c.length) setHrVacations(function(p){ return p.length?p:c; }); } });
    dbFetch('/hr/waybills').then(function(r){ if(r.ok){ var v=mapVals(r.val); setHrWaybills(v); cacheSet('hr_wb',v); } else { var c=cacheGet('hr_wb'); if(c&&c.length) setHrWaybills(function(p){ return p.length?p:c; }); } });
  }; f(); var iv=setInterval(f,45000); return function(){ clearInterval(iv); }; },[]);
  useEffect(()=>{ var g=function(){ dbGet('/chat/last').then(function(x){ if(x) setChatLast(x); }).catch(function(){}); }; g(); var iv2=setInterval(g,12000); return function(){ clearInterval(iv2); }; },[]);
  useEffect(()=>{ document.documentElement.setAttribute('data-theme',theme); },[theme]);
  // ── initial load from Firebase ──
  useEffect(()=>{
    let alive=true;
    Promise.all([dbGet('/trucks'),dbGet('/clients'),dbGet('/orders'),dbGet('/plans')]).then(function(r){
      if(!alive) return;
      var tk=mapVals(r[0]), cl=mapVals(r[1]), od=mapVals(r[2]), pl=mapVals(r[3]);
      if(tk.length) setTrucks(tk);
      if(cl.length) setClients(cl);
      if(r[2]!=null){ cloudOrdersRef.current=true; setOrders(od.map(normOrder)); }
      if(r[3]!=null){ cloudPlansRef.current=true; setPlans(pl); }
      setLoaded(true);
    }).catch(function(){ if(alive) setLoaded(true); });
    return function(){ alive=false; };
  },[]);
  // ── light cross-device sync (never overwrites local with empty) ──
  useEffect(()=>{
    if(!loaded) return;
    var iv=setInterval(function(){
      Promise.all([dbGet('/trucks'),dbGet('/clients'),dbGet('/orders'),dbGet('/plans')]).then(function(r){
        var tk=mapVals(r[0]),cl=mapVals(r[1]),od=mapVals(r[2]),pl=mapVals(r[3]);
        if(tk.length) setTrucks(function(p){var s=JSON.stringify(tk);return s!==JSON.stringify(p)?tk:p;});
        if(cl.length) setClients(function(p){var s=JSON.stringify(cl);return s!==JSON.stringify(p)?cl:p;});
        if(od.length){var n=od.map(normOrder);setOrders(function(p){var s=JSON.stringify(n);return s!==JSON.stringify(p)?n:p;});}
        if(pl.length) setPlans(function(p){var s=JSON.stringify(pl);return s!==JSON.stringify(p)?pl:p;});
      }).catch(function(){});
    },10000);
    return function(){ clearInterval(iv); };
  },[loaded]);
  useEffect(()=>{
    const pin=new URLSearchParams(window.location.search).get('pin');
    if(pin){ const t=trucks.find(x=>String(x.pin)===String(pin)); if(t){ setAuth(true); setDriverPageId(t.id);} }
  },[]);

  const updTruck = (id,patch)=>{ setTrucks(prev=>prev.map(t=>{ if(t.id!==id) return t; var m=Object.assign({},t,patch);
    if(patch&&patch.status==='FORWARD' && t.status!=='FORWARD' && (m.driver||'').trim()){
      var _hid='disp_'+Date.now()+Math.random().toString(36).slice(2,5);
      var _ev={}; _ev[_hid]={ts:nowLocalISO(),plate:m.plate||'',driver:(m.driver||'').trim(),logist:m.logist||'',action:'dispatch',label:'Отправлен в рейс',ref:String(id)};
      dbPatch('/history',_ev);
      setHistory(function(h){ return (h||[]).concat([_ev[_hid]]); });
    }
    dbPut('/trucks/'+id,m); return m; })); tShow(T('saved')); };
  // Откат: логист снял рейс/обратку — убираем последнее событие отправки этой машины
  const undoDispatch = (id)=>{
    var arr=(history||[]).filter(function(e){ return e&&e.action==='dispatch'&&String(e.ref)===String(id); })
      .sort(function(a,b){ return (a.ts||'')<(b.ts||'')?1:-1; });
    if(!arr.length) return;
    var last=arr[0];
    dbGet('/history').then(function(o){ if(!o) return; var key=Object.keys(o).find(function(k){ return o[k]&&o[k].action==='dispatch'&&String(o[k].ref)===String(id)&&o[k].ts===last.ts; });
      if(key){ dbPut('/history/'+key,null); } });
    setHistory(function(h){ var removed=false; return (h||[]).filter(function(e){ if(!removed&&e.action==='dispatch'&&String(e.ref)===String(id)&&e.ts===last.ts){ removed=true; return false; } return true; }); });
  };
  const delTruck = (id)=>{ setTrucks(prev=>prev.filter(function(t){return t.id!==id;})); dbPut('/trucks/'+id,null); tShow('Машина удалена из парка'); };
  const updMecTractor = (id,patch)=>{ setMecTractors(prev=>{ var n=prev.map(x=>{ if(x.id!==id) return x; var m=Object.assign({},x,patch); saveOr('/mechanic/tractors/'+id,m,T('saved')); return m; }); cacheSet('mec_tractors',n); return n; }); };
  const addMecTractor = (plate)=>{ var id='mt_'+Date.now(); var obj={id,plate:(plate||'').trim(),odometer:'',toMileage:'',tireSteer:'',tireDrive:'',techInsp:'',tachograph:'',pass:'',insurance:'',kasko:'',akbDate:'',note:''}; setMecTractors(prev=>{ var n=prev.concat([obj]); cacheSet('mec_tractors',n); return n; }); saveOr('/mechanic/tractors/'+id,obj,'Тягач добавлен'); };
  const delMecTractor = (id)=>{ setMecTractors(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('mec_tractors',n); return n; }); saveOr('/mechanic/tractors/'+id,null,'Тягач удалён'); };
  const bulkSetOdometer = (pairs)=>{
    var map={}; pairs.forEach(function(p){ map[p.id]=p.km; });
    var next=mecTractors.map(function(x){ return map[x.id]!=null?Object.assign({},x,{odometer:String(map[x.id])}):x; });
    setMecTractors(next); cacheSet('mec_tractors',next);
    var changed=next.filter(function(x){ return map[x.id]!=null; });
    Promise.all(changed.map(function(x){ return dbSave('/mechanic/tractors/'+x.id,x); })).then(function(rs){
      var bad=rs.filter(function(r){ return !r.ok; });
      if(bad.length) tErr('Пробеги обновлены на экране, но '+bad.length+' не сохранились в базу: '+bad[0].err);
      else tShow('Пробеги обновлены: '+changed.length+' машин');
    });
  };
  const bulkCreateTractors = (items)=>{
    var base=Date.now(); var objs=items.map(function(it,i){
      return {id:'mt_'+(base+i),plate:it.plate,odometer:String(it.km),toMileage:'',tireSteer:'',tireDrive:'',techInsp:'',tachograph:'',pass:'',insurance:'',kasko:'',akbDate:'',note:''}; });
    setMecTractors(function(prev){ var n=prev.concat(objs); cacheSet('mec_tractors',n); return n; });
    Promise.all(objs.map(function(o){ return dbSave('/mechanic/tractors/'+o.id,o); })).then(function(rs){
      var bad=rs.filter(function(r){ return !r.ok; });
      if(bad.length) tErr('Карточки созданы на экране, но '+bad.length+' не сохранились в базу: '+bad[0].err);
      else tShow('Создано карточек: '+objs.length);
    });
  };
  const updMecTrailer = (id,patch)=>{ setMecTrailers(prev=>{ var n=prev.map(x=>{ if(x.id!==id) return x; var m=Object.assign({},x,patch); saveOr('/mechanic/trailers/'+id,m,T('saved')); return m; }); cacheSet('mec_trailers',n); return n; }); };
  const addMecTrailer = (plate)=>{ var id='mp_'+Date.now(); var obj={id,plate:(plate||'').trim(),econ:'',pairedTractor:'',toMileage:'',tireAxle1:'',tireAxle2:'',tireAxle3:'',techInsp:'',frc:'',unitType:'',unitService:'',unitFullService:'',insurance:'',kasko:'',akbDate:'',note:''}; setMecTrailers(prev=>{ var n=prev.concat([obj]); cacheSet('mec_trailers',n); return n; }); saveOr('/mechanic/trailers/'+id,obj,'Прицеп добавлен'); };
  const delMecTrailer = (id)=>{ setMecTrailers(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('mec_trailers',n); return n; }); saveOr('/mechanic/trailers/'+id,null,'Прицеп удалён'); };
  const saveMecAct = (act)=>{ var id=act.id||('ma_'+Date.now()); var obj=Object.assign({},act,{id}); setMecActs(prev=>{ var ex=prev.some(a=>a.id===id); var n=ex?prev.map(a=>a.id===id?obj:a):prev.concat([obj]); cacheSet('mec_acts',n); return n; }); saveOr('/mechanic/acts/'+id,obj,'Акт сохранён'); };
  const delMecAct = (id)=>{ setMecActs(prev=>{ var n=prev.filter(a=>a.id!==id); cacheSet('mec_acts',n); return n; }); saveOr('/mechanic/acts/'+id,null,'Акт удалён'); };
  const addTire = ()=>{ var id='ti_'+Date.now(); var obj={id,size:'',brand:'',qty:'',axle:'',cond:'новые',note:''}; setMecTires(prev=>{ var n=prev.concat([obj]); cacheSet('mec_tires',n); return n; }); saveOr('/mechanic/stock_tires/'+id,obj,'Позиция добавлена'); };
  const updTire = (id,patch)=>{ setMecTires(prev=>{ var n=prev.map(x=>{ if(x.id!==id) return x; var m=Object.assign({},x,patch); saveOr('/mechanic/stock_tires/'+id,m,T('saved')); return m; }); cacheSet('mec_tires',n); return n; }); };
  const delTire = (id)=>{ setMecTires(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('mec_tires',n); return n; }); saveOr('/mechanic/stock_tires/'+id,null,'Удалено'); };
  const addBag = ()=>{ var id='bg_'+Date.now(); var obj={id,plate:'',qty:'',kind:'',note:''}; setMecBags(prev=>{ var n=prev.concat([obj]); cacheSet('mec_bags',n); return n; }); saveOr('/mechanic/stock_bags/'+id,obj,'Позиция добавлена'); };
  const updBag = (id,patch)=>{ setMecBags(prev=>{ var n=prev.map(x=>{ if(x.id!==id) return x; var m=Object.assign({},x,patch); saveOr('/mechanic/stock_bags/'+id,m,T('saved')); return m; }); cacheSet('mec_bags',n); return n; }); };
  const delBag = (id)=>{ setMecBags(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('mec_bags',n); return n; }); saveOr('/mechanic/stock_bags/'+id,null,'Удалено'); };
  const addAkb = ()=>{ var id='ak_'+Date.now(); var obj={id,brand:'',cap:'',qty:'',cond:'новые',note:''}; setMecAkb(prev=>{ var n=prev.concat([obj]); cacheSet('mec_akb',n); return n; }); saveOr('/mechanic/stock_akb/'+id,obj,'Позиция добавлена'); };
  const updAkb = (id,patch)=>{ setMecAkb(prev=>{ var n=prev.map(x=>{ if(x.id!==id) return x; var m=Object.assign({},x,patch); saveOr('/mechanic/stock_akb/'+id,m,T('saved')); return m; }); cacheSet('mec_akb',n); return n; }); };
  const delAkb = (id)=>{ setMecAkb(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('mec_akb',n); return n; }); saveOr('/mechanic/stock_akb/'+id,null,'Удалено'); };
  const addKasko = ()=>{ var id='ks_'+Date.now(); var obj={id,kind:'tractor',plate:'',date:today(),claimNo:'',status:'заявлено',what:'',note:''}; setMecKasko(prev=>{ var n=prev.concat([obj]); cacheSet('mec_kasko',n); return n; }); saveOr('/mechanic/kasko/'+id,obj,'Запись добавлена'); };
  const updKasko = (id,patch)=>{ setMecKasko(prev=>{ var n=prev.map(x=>{ if(x.id!==id) return x; var m=Object.assign({},x,patch); saveOr('/mechanic/kasko/'+id,m,T('saved')); return m; }); cacheSet('mec_kasko',n); return n; }); };
  const delKasko = (id)=>{ setMecKasko(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('mec_kasko',n); return n; }); saveOr('/mechanic/kasko/'+id,null,'Удалено'); };
  const addHrDriver = (name,plate)=>{ var id='hd_'+Date.now(); var obj={id,name:(name||'').trim(),plate:(plate||'').trim(),workStart:'',status:'work',note:''}; setHrDrivers(prev=>{ var n=prev.concat([obj]); cacheSet('hr_drivers',n); return n; }); saveOr('/hr/drivers/'+id,obj,'Водитель добавлен'); };
  const updHrDriver = (id,patch)=>{ setHrDrivers(prev=>{ var n=prev.map(x=>{ if(x.id!==id) return x; var m=Object.assign({},x,patch); saveOr('/hr/drivers/'+id,m,T('saved')); return m; }); cacheSet('hr_drivers',n); return n; }); };
  const delHrDriver = (id)=>{ setHrDrivers(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('hr_drivers',n); return n; }); saveOr('/hr/drivers/'+id,null,'Удалён'); };
  const importHrDrivers = ()=>{
    var have={}; hrDrivers.forEach(function(d){ have[(d.name||'').trim().toLowerCase()]=true; });
    var skipped=0;
    var add=[]; trucks.forEach(function(t){ if(t.isHired){ if((t.driver||'').trim()) skipped++; return; } var nm=(t.driver||'').trim(); if(!nm||have[nm.toLowerCase()]) return; have[nm.toLowerCase()]=true;
      add.push({id:'hd_'+Date.now()+'_'+add.length,name:nm,plate:t.plate||'',workStart:'',status:'work',note:''}); });
    if(!add.length){ tShow('Новых водителей не найдено'+(skipped?(' (привлечённых пропущено: '+skipped+')'):'')); return; }
    setHrDrivers(prev=>{ var n=prev.concat(add); cacheSet('hr_drivers',n); return n; });
    Promise.all(add.map(function(o){ return dbSave('/hr/drivers/'+o.id,o); })).then(function(rs){
      var bad=rs.filter(function(r){ return !r.ok; });
      if(bad.length) tErr('Добавлены на экране, но '+bad.length+' не сохранились: '+bad[0].err); else tShow('Добавлено водителей: '+add.length+(skipped?(' · привлечённых пропущено: '+skipped):''));
    });
  };
  const saveHrVacation = (v)=>{ var id=v.id||('hv_'+Date.now()); var obj=Object.assign({},v,{id}); setHrVacations(prev=>{ var ex=prev.some(x=>x.id===id); var n=ex?prev.map(x=>x.id===id?obj:x):prev.concat([obj]); cacheSet('hr_vac',n); return n; }); saveOr('/hr/vacations/'+id,obj,'Сохранено'); };
  const delHrVacation = (id)=>{ setHrVacations(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('hr_vac',n); return n; }); saveOr('/hr/vacations/'+id,null,'Удалено'); };
  const saveHrWaybill = (w)=>{ var id=w.id||('hw_'+Date.now()); var obj=Object.assign({},w,{id}); setHrWaybills(prev=>{ var ex=prev.some(x=>x.id===id); var n=ex?prev.map(x=>x.id===id?obj:x):prev.concat([obj]); cacheSet('hr_wb',n); return n; }); saveOr('/hr/waybills/'+id,obj,'Сохранено'); };
  const delHrWaybill = (id)=>{ setHrWaybills(prev=>{ var n=prev.filter(x=>x.id!==id); cacheSet('hr_wb',n); return n; }); saveOr('/hr/waybills/'+id,null,'Удалено'); };
  const swapDrivers = (idA,idB)=>{
    setTrucks(prev=>{
      const a=prev.find(x=>x.id===idA), b=prev.find(x=>x.id===idB);
      if(!a||!b) return prev;
      var na=Object.assign({},a,{driver:b.driver,phone:b.phone||'',pin:b.pin||a.pin});
      var nb=Object.assign({},b,{driver:a.driver,phone:a.phone||'',pin:a.pin||b.pin});
      dbPut('/trucks/'+idA,na); dbPut('/trucks/'+idB,nb);
      return prev.map(t=> t.id===idA?na : t.id===idB?nb : t);
    });
    tShow(T('t_swap_done')); setModal(null);
  };

  // assign a free truck to an order (also pull in new client if order created one)
  const assignTruckToOrder = (truckId,order)=>{
    const cl = clients.find(c=>c.id===order.cid);
    const rh = (cl&&cl.routeHours)||20;
    const la=nowLocalISO(), fa=addH(nowLocalISO(),rh);
    setTrucks(prev=>prev.map(t=>{ if(t.id!==truckId) return t;
      var m=Object.assign({},t,{
        status:'FORWARD',clientId:order.cid,clientName:order.client,loadAddr:order.from,unloadAddr:order.to,
        loadAt:la,freeAt:fa,driverMsg:order.text||t.driverMsg||'',
        trips:(t.trips||[]).concat([{id:uid(),dir:'forward',clientId:order.cid,clientName:order.client,
          from:order.from,to:order.to,loadAt:la,freeAt:fa,date:today(),wb:false}])});
      dbPut('/trucks/'+truckId,m); return m; }));
    setOrders(prev=>prev.map(x=>{ if(x.id!==order.id) return x; var o=Object.assign({},x,{assigned:truckId}); dbPut('/orders/'+o.id,o); return o; }));
    tShow(T('t_assigned'));
  };
  const assignTruckToClient = (truckId,cl)=>{
    const rh=cl.routeHours||20, to=(cl.unloadOptions&&cl.unloadOptions[0]&&cl.unloadOptions[0].addr)||'';
    const la=nowLocalISO(), fa=addH(nowLocalISO(),rh);
    setTrucks(prev=>prev.map(t=>{ if(t.id!==truckId) return t;
      var m=Object.assign({},t,{
        status:'FORWARD',clientId:cl.id,clientName:cl.name,loadAddr:cl.loadAddr,unloadAddr:to,
        loadAt:la,freeAt:fa,
        trips:(t.trips||[]).concat([{id:uid(),dir:'forward',clientId:cl.id,clientName:cl.name,
          from:cl.loadAddr,to:to,loadAt:la,freeAt:fa,date:today(),wb:false}])});
      dbPut('/trucks/'+truckId,m); return m; }));
    tShow(T('t_assigned'));
  };
  // save order (creating a brand-new client if needed)
  const saveOrder = (o,isEdit)=>{
    if(o.newClient){ var nc=o.newClient; dbPut('/clients/'+nc.id,nc); setClients(prev=> prev.find(c=>c.id===nc.id)?prev:prev.concat([nc])); }
    var ord=Object.assign({},o); delete ord.newClient;
    dbPut('/orders/'+ord.id,ord);
    if(isEdit) setOrders(prev=>prev.map(x=>x.id===ord.id?ord:x));
    else setOrders(prev=>prev.concat([ord]));
    setModal(null); tShow(isEdit?T('t_order_upd'):T('t_order_add'));
  };

  const stats = useMemo(()=>({
    free:trucks.filter(t=>t.status==='FREE').length,
    moving:trucks.filter(t=>MOVING.includes(t.status)).length,
    problems:trucks.filter(t=>t.problem||t.status==='PROBLEM').length,
  }),[trucks]);

  const FILTERS=[['ALL',T('flt_all')],['FREE',T('flt_free')],['FORWARD',T('flt_moving')],
    ['BACK',T('flt_back')],['PROBLEM',T('flt_problem')],['SERVICE',T('flt_service')],
    ['NEED',T('flt_need')],['DOCS',T('flt_docs')]];

  const filtered = useMemo(()=>{
    const s=search.toLowerCase();
    return trucks.filter(t=>{
      if(!isBoss && t.logist!==role) return false;
      if(stFilter==='FREE'&&t.status!=='FREE') return false;
      if(stFilter==='FORWARD'&&!['FORWARD','LOADED','AT_LOAD','ARRIVED_LOAD','LOADING','AT_UNLOAD','ARRIVED_UNLOAD','UNLOADED','BACK_GO'].includes(t.status)) return false;
      if(stFilter==='BACK'&&t.status!=='BACK') return false;
      if(stFilter==='PROBLEM'&&!(t.problem||t.status==='PROBLEM')) return false;
      if(stFilter==='SERVICE'&&t.status!=='SERVICE'&&!t.onService) return false;
      if(stFilter==='NEED'&&!t.needService) return false;
      if(stFilter==='DOCS'&&t.status!=='DOCS') return false;
      if(s&&!t.plate.toLowerCase().includes(s)&&!t.driver.toLowerCase().includes(s)) return false;
      return true;
    });
  },[trucks,stFilter,search,role,isBoss]);

  const movingTrucks = useMemo(()=>trucks.filter(t=>MOVING.includes(t.status)&&(isBoss||t.logist===role)),[trucks,isBoss,role]);

  let TABS=[
    ['park',T('tab_park')+' ('+trucks.length+')'],
    ['moving',T('tab_moving')+' ('+stats.moving+')'],
    ['clients',T('tab_clients')+' ('+clients.length+')'],
    ['orders',T('tab_orders')+(orders.length?' ('+orders.length+')':'')],
    ['future',T('tab_plan')+(plans.length?' ('+plans.length+')':'')],
    ['log',T('tab_log')],
  ].concat((isMech||isBoss)?[['mechanic','🔧 Механик']]:[]).concat((isHr||isBoss)?[['hr','🗂 Кадры']]:[]);
  TABS=TABS.concat(isHr?[]:[['temp','🌡 Температура']]);
  if(isMech||isHr) TABS=TABS.filter(function(x){ return ['clients','orders','future','log'].indexOf(x[0])<0; });
  if(isBoss) TABS=[];

  if(!auth) return ce(Login,{onOk:()=>setAuth(true)});
  if(driverPageId){
    const dt=trucks.find(t=>t.id===driverPageId);
    if(dt) return ce(DriverPage,{truck:dt,clients,orders,onUpdate:p=>updTruck(dt.id,p),onClose:()=>setDriverPageId(null)});
  }
  if(!role) return ce(RolePicker,{onPick:pickRole,logists,trucks,onSaveLogists:saveLogists});

  const headBtn={padding:'7px 12px',borderRadius:9,background:'var(--bg3)',color:'var(--text2)',
    fontWeight:700,fontSize:12.5,border:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit'};

  return ce('div',{style:{minHeight:'100vh',color:'var(--text)'}},
    (dbHealth&&dbHealth!=='ok')?(function(){ var kind=dbErrKind(dbHealth);
      var msg = kind==='perm'
        ? 'База отклоняет запись — нет прав ('+dbHealth+'). Проверьте правила доступа: Firebase → Realtime Database → Rules.'
        : kind==='net'
          ? 'Нет связи с базой данных ('+dbHealth+'). Запрос не доходит до сервера. Данные на экране могут быть неполными, а изменения НЕ сохраняются. Проверьте: интернет, блокировщик рекламы / расширения Safari, и существует ли база (откройте '+DB_URL+'/trucks.json в новой вкладке).'
          : 'Проблема с базой данных ('+dbHealth+'). Изменения могут не сохраняться.';
      return ce('div',{style:{background:'color-mix(in srgb,var(--red) 16%,transparent)',
        borderBottom:'1px solid color-mix(in srgb,var(--red) 45%,transparent)',color:'var(--red)',
        padding:'10px 16px',fontSize:12.5,fontWeight:700,textAlign:'center',lineHeight:1.5}}, '⚠ '+msg); })():null,
    toast&&(function(){ var isErr=String(toast).indexOf('ERR:')===0; var txt=isErr?String(toast).slice(4):toast; var col=isErr?'var(--red)':'var(--green)';
      return ce('div',{className:'fl-modal-overlay',style:{position:'fixed',top:16,right:16,zIndex:999,maxWidth:420,
        background:'var(--bg2)',border:'1px solid color-mix(in srgb,'+col+' 40%,transparent)',borderRadius:11,
        padding:'9px 17px',fontSize:13,fontWeight:700,color:col,boxShadow:'var(--shadow-lg)',animation:'fl-toast .25s ease both'}},
        (isErr?'⚠ ':'')+txt); })(),

    // Header
    ce('div',{style:{background:'color-mix(in srgb,var(--bg2) 88%,transparent)',backdropFilter:'blur(10px)',
      borderBottom:'1px solid var(--border)',padding:'0 16px',position:'sticky',top:0,zIndex:100}},
      ce('div',{style:{maxWidth:1700,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:60,gap:14}},
        ce('div',{style:{display:'flex',alignItems:'center',gap:11,flexShrink:0}},
          ce('div',{style:{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,var(--accent),var(--accent2))',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}},'🚛'),
          ce('div',null,
            ce('div',{style:{fontWeight:800,fontSize:16,color:'var(--text)',fontFamily:'Plus Jakarta Sans,sans-serif',lineHeight:1.1}},
              'Fle',ce('span',{style:{color:'var(--accent)'}},'tera')),
            ce('div',{style:{fontSize:10,color:'var(--text3)',letterSpacing:'.5px'}},'by Egida-Trans · '+trucks.length+' '+T('unit_trucks')))),
        TABS.length>0&&ce('nav',{style:{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center',flex:1}},
          TABS.map(([id,label])=>ce('button',{key:id,className:'fl-tab',onClick:()=>setTab(id),style:{
            padding:'7px 13px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,fontFamily:'inherit',
            background:tab===id?'color-mix(in srgb,var(--accent) 16%,transparent)':'transparent',
            color:tab===id?'var(--accent)':'var(--text3)'}},label))),
        ce('div',{style:{display:'flex',gap:11,alignItems:'center',flexShrink:0}},
          ce('div',{style:{display:'flex',gap:13}},
            ce('div',{style:{textAlign:'center'}},
              ce('div',{style:{fontWeight:800,fontSize:17,color:'var(--green)',lineHeight:1}},stats.free),
              ce('div',{style:{fontSize:9.5,color:'var(--text3)'}},T('hdr_free'))),
            ce('div',{style:{textAlign:'center'}},
              ce('div',{style:{fontWeight:800,fontSize:17,color:'var(--accent)',lineHeight:1}},stats.moving),
              ce('div',{style:{fontSize:9.5,color:'var(--text3)'}},T('hdr_route'))),
            stats.problems>0&&ce('div',{style:{textAlign:'center'}},
              ce('div',{style:{fontWeight:800,fontSize:17,color:'var(--red)',lineHeight:1}},stats.problems),
              ce('div',{style:{fontSize:9.5,color:'var(--text3)'}},T('hdr_issues')))),
          ce('button',{className:'fl-press',onClick:()=>setTheme(x=>x==='dark'?'light':'dark'),style:headBtn},
            theme==='dark'?'☀️ '+T('th_light'):'🌙 '+T('th_dark')),
          ce('button',{className:'fl-press',onClick:()=>setModal('chat'),style:Object.assign({},headBtn,{position:'relative',color:'var(--cyan)',borderColor:'color-mix(in srgb,var(--cyan) 40%,transparent)'})},'💬 Чат',
            chatUnread?ce('span',{style:{position:'absolute',top:-3,right:-3,width:9,height:9,borderRadius:9,background:'var(--red)',border:'2px solid var(--bg)'}}):null),
          (!isMech&&!isHr)&&ce('button',{className:'fl-press',onClick:()=>setModal('logists'),style:Object.assign({},headBtn,{color:'var(--amber)',borderColor:'color-mix(in srgb,var(--amber) 40%,transparent)'})},'👥 Логисты'),
          ce('button',{className:'fl-press',onClick:()=>{ try{localStorage.removeItem('egida_role');}catch(e){} setRole(null); },
            style:Object.assign({},headBtn,{color:isBoss?'var(--green)':(LOGIST_COLOR[role]||'var(--accent)'),fontWeight:800,
              borderColor:'color-mix(in srgb,'+(isBoss?'var(--green)':'var(--accent)')+' 45%,transparent)'})},(isBoss?'👔 ':'👤 ')+role+' ▾'),
          ce('button',{className:'fl-press',onClick:()=>{
            const pin=prompt(T('drv_pin_prompt')); if(!pin) return;
            const t=trucks.find(x=>String(x.pin)===String(pin.trim()));
            if(t) setDriverPageId(t.id); else alert(T('drv_pin_bad'));
          },style:Object.assign({},headBtn,{color:'var(--amber)',borderColor:'color-mix(in srgb,var(--amber) 40%,transparent)',background:'color-mix(in srgb,var(--amber) 10%,transparent)'})},
            '📱 '+T('btn_driver')))
      )),

    // ── PARK TAB ──
    tab==='park'&&ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
      (!isBoss)&&ce('div',{style:{display:'flex',gap:7,marginBottom:14,flexWrap:'wrap',alignItems:'center'}},
        ce('input',{placeholder:T('search_ph'),value:search,onChange:e=>setSearch(e.target.value),
          style:{background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:9,padding:'7px 12px',
            color:'var(--text)',fontSize:13,width:210,fontFamily:'inherit'}}),
        FILTERS.map(([id,label])=>{
          const fc=SC[id]||'var(--accent)';
          const active=stFilter===id;
          return ce('button',{key:id,className:'fl-press',onClick:()=>setStFilter(id),style:{
            padding:'6px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',
            border:`1px solid ${active?fc:'var(--border)'}`,
            background:active?`color-mix(in srgb,${fc} 16%,transparent)`:'transparent',
            color:active?fc:'var(--text3)',fontWeight:700,fontSize:12}},label);}),
        ce('button',{className:'fl-press',onClick:()=>setModal('addtruck'),style:{marginLeft:'auto',
          padding:'7px 14px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',
          border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',
          background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)',fontWeight:800,fontSize:12.5}},T('add_truck'))),
      isBoss&&managerView==='board'&&ce('div',{style:{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginBottom:13,padding:'11px 13px',
        background:'color-mix(in srgb,var(--green) 7%,transparent)',border:'1px solid color-mix(in srgb,var(--green) 25%,transparent)',borderRadius:11,fontSize:12.5}},
        ce('span',{style:{fontWeight:800,color:'var(--green)'}},'👔 Руководитель'),
        ce('span',{style:{color:'var(--text2)'}},'Свободно: ',ce('b',{style:{color:'var(--green)'}},stats.free)),
        ce('span',{style:{color:'var(--text2)'}},'В рейсе: ',ce('b',{style:{color:'var(--accent)'}},stats.moving)),
        stats.problems>0?ce('span',{style:{color:'var(--text2)'}},'Проблемы: ',ce('b',{style:{color:'var(--red)'}},stats.problems)):null,
        ce('span',{style:{color:'var(--border2)'}},'|'),
        LOGISTS.map(function(lg){ return ce('span',{key:lg,style:{color:LOGIST_COLOR[lg],fontWeight:700}},lg+': '+trucks.filter(t=>t.logist===lg).length); }),
        ce('span',{style:{color:'var(--text3)'}},'Без логиста: '+trucks.filter(t=>!t.logist).length)),
      (!isBoss)&&ce('div',{style:{display:'flex',alignItems:'center',gap:11,marginBottom:13}},
        ce('button',{className:'fl-press',onClick:()=>setModal('assignlogist'),style:{padding:'9px 15px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
          border:'1px solid color-mix(in srgb,var(--accent) 45%,transparent)',background:'color-mix(in srgb,var(--accent) 12%,transparent)',color:'var(--accent)',fontWeight:800,fontSize:12.5}},'➕ Добавить машину под себя'),
        ce('span',{style:{fontSize:12,color:'var(--text3)'}},'Ваших машин: '+trucks.filter(t=>t.logist===role).length)),
      isBoss&&ce('div',null,
        ce('div',{style:{display:'inline-flex',gap:3,marginBottom:14,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:11,padding:3,flexWrap:'wrap'}},
          [['board','📋 Доска'],['kpi','📊 KPI и аналитика']].map(function(v){ var on=managerView===v[0];
            return ce('button',{key:v[0],className:'fl-press',onClick:()=>setManagerView(v[0]),style:{padding:'8px 16px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:800,border:'none',
              background:on?'linear-gradient(135deg,var(--accent),var(--accent2))':'transparent',color:on?'#fff':'var(--text3)'}},v[1]); })),
        managerView==='kpi'?ce(ManagerKPI,{trucks,orders,history}):ce(ManagerBoard,{trucks,onUpdate:updTruck,search,setSearch})),
      (!isBoss)&&ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))',gap:12}},
        filtered.map(t=>ce(TruckCard,{key:t.id,truck:t,clients,orders,settings,role,isBoss,onUpdate:updTruck,
          onSwapRequest:tk=>setModal({type:'swap',truck:tk}),onOpenDriver:id=>setDriverPageId(id),onDelete:delTruck,onUndoDispatch:undoDispatch}))),
      (!isBoss)&&filtered.length===0&&ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},T('none_found'))),

    // ── MOVING TAB (календарь по дням) ──
    tab==='moving'&&(function(){
      var todayStr=today();
      var wd=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      var base=new Date(); base.setHours(0,0,0,0);
      var days=[]; for(var i=-3;i<14;i++){ days.push(new Date(base.getTime()+i*864e5)); }
      function ds(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
      // Машина показывается в дне СВОЕЙ ЗАГРУЗКИ (а не весь период рейса)
      function loadKeys(t){
        var out=[];
        var push=function(v){ if(!v) return; var d=new Date(v); if(!isNaN(d.getTime())) out.push(ds(d)); };
        push(t.loadAt);
        (t.trips||[]).forEach(function(tr){ if(tr) push(tr.loadAt); });
        return out;
      }
      function onRoute(t,key){ if(!MOVING.includes(t.status)) return false;
        var ks=loadKeys(t);
        if(!ks.length) return key===todayStr;
        return ks.indexOf(key)>=0; }
      function planOn(p,key){ var sd=p.loadDate||p.date; return !!sd && sd===key; }
      var dayTrucks=trucks.filter(function(t){return onRoute(t,routeDay)&&(isBoss||t.logist===role);});
      var dayPlans=(plans||[]).filter(function(p){return planOn(p,routeDay);});
      return ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
        ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,gap:10,flexWrap:'wrap'}},
          ce('div',null,
            ce('h2',{style:{margin:0,fontWeight:800,color:'var(--text)',fontSize:20}},T('moving_title')),
            ce('div',{style:{fontSize:12.5,color:'var(--text3)',marginTop:3}},'Машина показана в дне своей загрузки. Выбери день — кто грузится и какие планы на этот день.')),
          ce('button',{className:'fl-press',onClick:()=>setModal('plantrip'),style:{padding:'8px 15px',borderRadius:9,
            border:'1px solid color-mix(in srgb,var(--violet) 50%,transparent)',background:'color-mix(in srgb,var(--violet) 14%,transparent)',
            color:'var(--violet)',fontWeight:800,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}},'📅 Запланировать рейс')),
        ce('div',{style:{display:'flex',gap:7,overflowX:'auto',paddingBottom:8,marginBottom:14}},
          days.map(function(d){ var key=ds(d); var act=key===routeDay;
            var cnt=trucks.filter(function(t){return onRoute(t,key)&&(isBoss||t.logist===role);}).length+(plans||[]).filter(function(p){return planOn(p,key);}).length;
            var past=key<todayStr;
            return ce('button',{key:key,className:'fl-press',onClick:()=>setRouteDay(key),style:{
              flexShrink:0,minWidth:66,padding:'8px 10px',borderRadius:11,cursor:'pointer',fontFamily:'inherit',textAlign:'center',
              border:'1px solid '+(act?'var(--accent)':'var(--border)'),opacity:(past&&!act)?0.5:1,
              background:act?'color-mix(in srgb,var(--accent) 16%,transparent)':'var(--bg2)',color:act?'var(--accent)':'var(--text3)'}},
              ce('div',{style:{fontSize:11,fontWeight:700}},wd[d.getDay()]+(key===todayStr?' •':'')),
              ce('div',{style:{fontSize:13,fontWeight:800,marginTop:2}},String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')),
              ce('div',{style:{fontSize:10,marginTop:2}},cnt?cnt+' маш.':'—')); })),
        ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:10}},'Загрузка в этот день: '+dayTrucks.length+(dayPlans.length?(' · план: '+dayPlans.length):'')),
        ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:12}},
          dayTrucks.map(tr=>ce(MovingCard,{key:tr.id,tr,clients,orders,settings,onUpdate:updTruck,modal:movingModal,setModal:setMovingModal})),
          dayPlans.map(function(p){ return ce('div',{key:'plan_'+p.id,className:'fl-card',style:{background:'var(--bg2)',
            border:'1px dashed color-mix(in srgb,var(--violet) 50%,transparent)',borderRadius:14,padding:'14px 15px',boxShadow:'var(--shadow)'}},
            ce('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:6}},
              ce('div',{style:{fontWeight:800,fontSize:13.5,color:'var(--text)'}},p.truckPlate||'—'),
              ce('span',{style:{fontSize:10.5,padding:'2px 9px',borderRadius:999,background:'color-mix(in srgb,var(--violet) 16%,transparent)',color:'var(--violet)',fontWeight:700}},'ПЛАН')),
            ce('div',{style:{fontSize:12.5,color:'var(--text2)',fontWeight:600,marginBottom:3}},'👤 '+(p.truckDriver||'—')),
            (p.from||p.to)?ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:3}},(p.from||'')+' → '+(p.to||'')):null,
            ce('div',{style:{fontSize:11.5,color:'var(--violet)',fontWeight:700,marginBottom:3}},'📅 '+(p.loadDate||p.date||'')+(p.unloadDate?(' → '+p.unloadDate):'')),
            p.clientName?ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:3}},'🏢 '+p.clientName):null,
            p.note?ce('div',{style:{padding:'6px 9px',background:'var(--bg3)',borderRadius:8,fontSize:11.5,color:'var(--text2)',marginTop:5}},'📝 '+p.note):null,
            ce('div',{style:{marginTop:9,display:'flex',gap:6}},
              ce(Btn,{onClick:()=>{ if(confirm(T('confirm_del_plan'))){ dbPut('/plans/'+p.id,null); setPlans(x=>x.filter(y=>y.id!==p.id)); } },color:'var(--red)',sm:true},T('btn_delete')))); })),
        (dayTrucks.length===0&&dayPlans.length===0)?ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},'На этот день нет машин в рейсе и планов.'):null);
    })(),

    // ── CLIENTS TAB ──
    tab==='clients'&&ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
      ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}},
        ce('h2',{style:{margin:0,fontWeight:800,color:'var(--text)',fontSize:20}},T('clients_title')),
        ce('button',{className:'fl-press',onClick:()=>setModal('addclient'),style:{padding:'7px 15px',borderRadius:9,cursor:'pointer',
          fontFamily:'inherit',fontWeight:800,fontSize:12.5,border:'1px solid color-mix(in srgb,var(--accent) 45%,transparent)',
          background:'color-mix(in srgb,var(--accent) 12%,transparent)',color:'var(--accent)'}},T('add_client'))),
      ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}},
        clients.map(c=>{
          const act=trucks.filter(t=>t.clientId===c.id&&MOVING.includes(t.status));
          return ce('div',{key:c.id,className:'fl-card fl-row-hover',style:{background:'var(--bg2)',border:'1px solid var(--border)',
            borderRadius:14,padding:'14px 15px',borderTop:`3px solid ${c.color}`,boxShadow:'var(--shadow)'}},
            ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:7}},
              ce('div',{style:{fontWeight:800,fontSize:14.5,color:'var(--text)',fontFamily:'Plus Jakarta Sans,sans-serif'}},c.name),
              ce('button',{className:'fl-press',onClick:()=>setModal({type:'editclient',cid:c.id}),style:{color:'var(--text3)',fontSize:15,width:26,height:26}},'✏️')),
            ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:3}},'📍 ',ce('span',{style:{color:'var(--text2)'}},c.loadCity+': '+c.loadAddr)),
            (c.unloadOptions||[]).map(u=>ce('div',{key:u.addr,style:{fontSize:11.5,color:'var(--text3)',marginBottom:3}},'🎯 ',ce('span',{style:{color:'var(--text2)'}},u.addr))),
            ce('div',{style:{display:'flex',gap:12,marginTop:7,fontSize:11.5,color:'var(--text3)',flexWrap:'wrap'}},
              ce('span',null,T('lbl_route_h')+': ',ce('b',{style:{color:c.color}},c.routeHours+' ч')),
              c.temp&&ce('span',null,'🌡 '+c.temp+'°C'),
              ce('span',null,T('cl_active')+': ',ce('b',{style:{color:'var(--green)'}},act.length))),
            c.note&&ce('div',{style:{marginTop:8,padding:'7px 9px',background:'var(--bg3)',borderRadius:8,fontSize:11.5,
              color:'var(--text2)',borderLeft:'3px solid '+c.color,lineHeight:1.45}},'📝 '+c.note),
            ce('div',{style:{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}},
              ce(Btn,{onClick:()=>setModal({type:'assignclient',cid:c.id}),color:'var(--accent)'},'+ '+T('cl_assign_truck')),
              ce(Btn,{onClick:()=>setModal({type:'editclient',cid:c.id}),color:'var(--violet)',sm:true},'✏️ '+T('cl_edit'))));
        }))),

    // ── ORDERS TAB ──
    tab==='orders'&&ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
      ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}},
        ce('h2',{style:{margin:0,fontWeight:800,color:'var(--text)',fontSize:20}},T('orders_title')),
        ce('button',{className:'fl-press',onClick:()=>setModal('addorder'),style:{padding:'7px 15px',borderRadius:9,
          border:'1px solid color-mix(in srgb,var(--green) 50%,transparent)',background:'color-mix(in srgb,var(--green) 14%,transparent)',
          color:'var(--green)',fontWeight:800,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}},T('add_order'))),
      ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}},
        orders.map(o=>{
          const cl=clients.find(c=>c.id===o.cid); const col=(cl&&cl.color)||'var(--text3)';
          const atruck=o.assigned?trucks.find(t=>t.id===o.assigned):null;
          const freeTrucks=(typeof bestTrucksForOrder==='function'?bestTrucksForOrder(trucks,o):trucks.filter(t=>t.status==='FREE')).slice(0,3);
          return ce('div',{key:o.id,className:'fl-card fl-row-hover',style:{background:'var(--bg2)',border:'1px solid var(--border)',
            borderTop:`3px solid ${col}`,borderRadius:14,padding:'14px 15px',boxShadow:'var(--shadow)'}},
            ce('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:5}},
              ce('div',null,
                ce('div',{style:{fontSize:10.5,color:'var(--text3)'}},'#'+o.id+' · '+o.date),
                ce('div',{style:{fontSize:14.5,fontWeight:800,color:col,fontFamily:'Plus Jakarta Sans,sans-serif'}},o.client)),
              ce('div',{style:{display:'flex',gap:6,alignItems:'center'}},
                ce('div',{style:{fontSize:14,fontWeight:700,color:'var(--green)'}},o.rate?(o.rate.toLocaleString()+' '+T('cur_rub')):''),
                ce('button',{className:'fl-press',onClick:()=>setModal({type:'editorder',oid:o.id}),style:{color:'var(--text3)',fontSize:14,width:24,height:24}},'✏️'))),
            ce('div',{style:{fontSize:12.5,color:'var(--text2)',marginBottom:3}},'📦 '+o.cargo+' · '+o.cnt+' шт'),
            ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:o.note?7:9}},o.from+' → '+o.to),
            o.note&&ce('div',{style:{marginBottom:8,padding:'7px 9px',background:'var(--bg3)',borderRadius:8,
              fontSize:11.5,color:'var(--text2)',borderLeft:`3px solid ${col}`,lineHeight:1.45}},'📝 '+o.note),
            ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:9}},
              o.temp&&ce('span',{style:{fontSize:10.5,padding:'3px 9px',borderRadius:999,
                background:'color-mix(in srgb,var(--accent) 12%,transparent)',color:'var(--accent)'}},'🌡 '+o.temp+'°C'),
              atruck
                ? ce('span',{style:{fontSize:10.5,padding:'3px 9px',borderRadius:999,background:'color-mix(in srgb,var(--green) 14%,transparent)',color:'var(--green)'}},'✓ '+atruck.plate)
                : ce('span',{style:{fontSize:10.5,padding:'3px 9px',borderRadius:999,background:'color-mix(in srgb,var(--amber) 14%,transparent)',color:'var(--amber)'}},'⏳ '+T('ord_need_truck'))),
            !atruck&&freeTrucks.length>0&&ce('div',{style:{background:'color-mix(in srgb,var(--green) 8%,transparent)',
              border:'1px solid color-mix(in srgb,var(--green) 22%,transparent)',borderRadius:9,padding:'8px 10px',marginBottom:9,fontSize:11.5}},
              ce('div',{style:{color:'var(--green)',fontWeight:700,marginBottom:5}},'🤖 '+T('ord_ai')),
              freeTrucks.map(t=>ce('div',{key:t.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'4px 0',borderBottom:'1px solid var(--border)',gap:8}},
                ce('span',{style:{color:'var(--text2)',fontSize:11}},t.plate+' · '+(t.location||'—')+(t._km!=null?' · ~'+t._km+' км':'')+(t._verdict?' · '+t._verdict:'')),
                ce(Btn,{onClick:()=>assignTruckToOrder(t.id,o),color:t._color||'var(--accent)',sm:true},T('ord_take'))))),
            ce('div',{style:{display:'flex',gap:6}},
              !atruck&&ce(Btn,{onClick:()=>setModal({type:'assignorder',oid:o.id}),color:'var(--accent)'},'🚛 '+T('ord_assign')),
              ce(Btn,{onClick:()=>setModal({type:'editorder',oid:o.id}),color:'var(--violet)',sm:true},'✏️'),
              ce(Btn,{onClick:()=>{ if(confirm(T('confirm_del_order'))){ dbPut('/orders/'+o.id,null); setOrders(p=>p.filter(x=>x.id!==o.id)); } },color:'var(--red)',sm:true},'✕')),
            modal&&modal.type==='editorder'&&modal.oid===o.id&&ce(OrderModal,{clients,maxId:maxId(orders),editOrder:o,
              onSave:upd=>saveOrder(upd,true),onClose:()=>setModal(null)}));
        }))),

    // ── FUTURE / PLANNING TAB ──
    tab==='future'&&ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
      ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}},
        ce('h2',{style:{margin:0,fontWeight:800,color:'var(--text)',fontSize:20}},T('plan_title')),
        ce('button',{className:'fl-press',onClick:()=>setModal('addplan'),style:{padding:'7px 15px',borderRadius:9,
          border:'1px solid color-mix(in srgb,var(--violet) 50%,transparent)',background:'color-mix(in srgb,var(--violet) 14%,transparent)',
          color:'var(--violet)',fontWeight:800,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}},'📅 '+T('add_plan'))),
      plans.length===0&&ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},T('plan_empty')),
      ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}},
        plans.map(p=>ce('div',{key:p.id,className:'fl-card fl-row-hover',style:{background:'var(--bg2)',border:'1px solid var(--border)',
          borderTop:'3px solid var(--violet)',borderRadius:14,padding:'14px 15px',boxShadow:'var(--shadow)'}},
          ce('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:7}},
            ce('div',{style:{fontWeight:800,fontSize:13.5,color:'var(--text)'}},p.truckPlate),
            ce('div',{style:{fontSize:12,color:'var(--violet)',fontWeight:700}},p.date)),
          ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:3}},'👤 ',ce('span',{style:{color:'var(--text2)'}},p.truckDriver)),
          ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:3}},'🏢 ',ce('span',{style:{color:'var(--text2)'}},p.clientName)),
          ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:7}},'📍 ',ce('span',{style:{color:'var(--text2)'}},p.loadAddr)),
          p.note&&ce('div',{style:{padding:'6px 9px',background:'var(--bg3)',borderRadius:8,fontSize:11.5,color:'var(--text2)',marginBottom:8}},'📝 '+p.note),
          ce(Btn,{onClick:()=>{ if(confirm(T('confirm_del_plan'))){ dbPut('/plans/'+p.id,null); setPlans(x=>x.filter(y=>y.id!==p.id)); } },color:'var(--red)',sm:true},T('btn_delete')))))),

    // ── LOG TAB ──
    tab==='log'&&ce(LogTab,{trucks,logDate,setLogDate}),
    tab==='temp'&&ce(TempTab,{trucks:trucks,clients:clients}),
    tab==='boss'&&ce(BossPanel,{trucks:trucks,clients:clients,plans:plans,orders:orders,history:history,onUpdate:updTruck,search:search,setSearch:setSearch,
      tractors:mecTractors,trailers:mecTrailers,acts:mecActs,tires:mecTires,bags:mecBags,akb:mecAkb,kasko:mecKasko,
      hrDrivers:hrDrivers,hrVacations:hrVacations,hrWaybills:hrWaybills}),
    tab==='hr'&&ce(HrTab,{drivers:hrDrivers,vacations:hrVacations,waybills:hrWaybills,history:history,trucks:trucks.filter(function(t){return !t.isHired;}),
      onAddDriver:addHrDriver,onUpdDriver:updHrDriver,onDelDriver:delHrDriver,onImportDrivers:importHrDrivers,
      onSaveVacation:saveHrVacation,onDelVacation:delHrVacation,
      onSaveWaybill:saveHrWaybill,onDelWaybill:delHrWaybill}),
    tab==='mechanic'&&ce(MechanicTab,{trucks:trucks.filter(function(t){return !t.isHired;}),tractors:mecTractors,trailers:mecTrailers,acts:mecActs,
      onAddTractor:addMecTractor,onUpdTractor:updMecTractor,onDelTractor:delMecTractor,onBulkOdometer:bulkSetOdometer,onBulkCreate:bulkCreateTractors,
      onAddTrailer:addMecTrailer,onUpdTrailer:updMecTrailer,onDelTrailer:delMecTrailer,
      onSaveAct:saveMecAct,onDelAct:delMecAct,
      tires:mecTires,bags:mecBags,akb:mecAkb,onAddTire:addTire,onUpdTire:updTire,onDelTire:delTire,onAddBag:addBag,onUpdBag:updBag,onDelBag:delBag,
      onAddAkb:addAkb,onUpdAkb:updAkb,onDelAkb:delAkb,
      kasko:mecKasko,onAddKasko:addKasko,onUpdKasko:updKasko,onDelKasko:delKasko}),

    // ── GLOBAL MODALS ──
    modal&&modal.type==='swap'&&modal.truck&&ce(SwapModal,{truck:modal.truck,trucks,onSwap:swapDrivers,onClose:()=>setModal(null)}),
    modal==='chat'&&ce(ChatModal,{role,onClose:()=>setModal(null),onSeen:markChatSeen}),
    modal==='template'&&ce(TemplateModal,{settings,onSave:saveTpl,onClose:()=>setModal(null)}),
    modal==='logists'&&ce(LogistsModal,{logists,trucks,onSave:saveLogists,onClose:()=>setModal(null)}),
    modal==='assignlogist'&&ce(AssignLogistModal,{role,trucks,onAssign:id=>{updTruck(id,{logist:role});setModal(null);},onClose:()=>setModal(null)}),
    modal==='addtruck'&&ce(AddTruckModal,{maxId:maxId(trucks),
      onSave:t=>{dbPut('/trucks/'+t.id,t);setTrucks(p=>p.concat([t]));setModal(null);tShow(T('t_truck_add'));},onClose:()=>setModal(null)}),
    modal==='addclient'&&ce(AddClientModal,{
      onSave:c=>{dbPut('/clients/'+c.id,c);setClients(p=>p.concat([c]));setModal(null);tShow(T('t_client_add'));},onClose:()=>setModal(null)}),
    modal==='addorder'&&ce(OrderModal,{clients,maxId:maxId(orders),
      onSave:o=>saveOrder(o,false),onClose:()=>setModal(null)}),
    modal==='addplan'&&ce(PlanModal,{clients,trucks,orders,
      onSave:p=>{var pl=Object.assign({id:(p&&p.id)||uid()},p);dbPut('/plans/'+pl.id,pl);setPlans(prev=>prev.concat([pl]));setModal(null);tShow(T('t_planned'));},onClose:()=>setModal(null)}),
    modal==='plantrip'&&ce(PlanTripModal,{trucks,clients,
      onSave:p=>{dbPut('/plans/'+p.id,p);setPlans(prev=>prev.concat([p]));setModal(null);tShow(T('t_planned'));},onClose:()=>setModal(null)}),
    modal&&modal.type==='editclient'&&(function(){
      const cl=clients.find(c=>c.id===modal.cid); if(!cl) return null;
      return ce(EditClientModal,{client:cl,
        onSave:u=>{dbPut('/clients/'+u.id,u);setClients(p=>p.map(c=>c.id===u.id?u:c));setModal(null);tShow(T('t_client_upd'));},onClose:()=>setModal(null)});
    })(),
    modal&&modal.type==='assignorder'&&(function(){
      const o=orders.find(x=>x.id===modal.oid); if(!o) return null;
      const free=trucks.filter(t=>t.status==='FREE');
      return ce(AssignModal,{title:T('m_assign_truck'),fieldLabel:o.cargo+' · '+o.client,free,order:o,
        onAssign:id=>{assignTruckToOrder(id,o);setModal(null);},onClose:()=>setModal(null)});
    })(),
    modal&&modal.type==='assignclient'&&(function(){
      const cl=clients.find(c=>c.id===modal.cid); if(!cl) return null;
      const free=trucks.filter(t=>t.status==='FREE');
      return ce(AssignModal,{title:T('m_assign_for')+' '+cl.name,fieldLabel:cl.loadAddr,free,
        onAssign:id=>{assignTruckToClient(id,cl);setModal(null);},onClose:()=>setModal(null)});
    })()
  );
}

// ── Error boundary ────────────────────────────────────────────
// ── Edit truck / driver card ──────────────────────────────────
function EditTruckModal({truck,onSave,onClose,onDelete}){
  const [plate,setPlate]=useState(truck.plate||'');
  const [driver,setDriver]=useState(truck.driver||'');
  const [phone,setPhone]=useState(truck.phone||'');
  const [pin,setPin]=useState(truck.pin||'');
  const [hired,setHired]=useState(!!truck.isHired);
  const [carrier,setCarrier]=useState(truck.carrier||'');
  const [logist,setLogist]=useState(truck.logist||'');
  const [note,setNote]=useState(truck.note||'');
  const [freeAt,setFreeAt]=useState(truck.freeAt||'');
  var ok=plate&&driver;
  function save(){ if(!ok) return; onSave({plate:plate,driver:driver,phone:phone,pin:pin,isHired:hired,carrier:hired?carrier:'',logist:logist,note:note,freeAt:freeAt}); }
  var tchip=function(active){ return {flex:1,padding:'9px',borderRadius:9,fontSize:12.5,fontWeight:700,cursor:'pointer',
    background:active?'color-mix(in srgb,var(--accent) 18%,transparent)':'var(--bg3)',
    border:'1px solid '+(active?'var(--accent)':'var(--border)'),color:active?'var(--accent)':'var(--text3)'}; };
  return ce(Modal,{title:'✏️ '+T('cl_edit')+' — '+(truck.plate||''),onClose,wide:true},
    ce(Field,{label:T('plate')},ce(Input,{value:plate,onChange:setPlate,placeholder:'AA 0000-7',autoFocus:true})),
    ce(Field,{label:T('driver')},ce(Input,{value:driver,onChange:setDriver,placeholder:'Иванов Иван Иванович'})),
    ce(Field,{label:T('phone')},ce(Input,{value:phone,onChange:setPhone,placeholder:'+375...'})),
    ce(Field,{label:'PIN (для ссылки водителю)'},ce(Input,{value:pin,onChange:setPin,placeholder:'напр. 1234'})),
    ce(Field,{label:T('type_word')},
      ce('div',{style:{display:'flex',gap:7}},
        [[false,T('t_own')],[true,T('t_hired')]].map(function(pair){ return ce('button',{key:pair[1],className:'fl-press',onClick:()=>setHired(pair[0]),style:tchip(hired===pair[0])},pair[1]); }))),
    hired&&ce(Field,{label:T('carrier')},ce(Input,{value:carrier,onChange:setCarrier,placeholder:'ИП Иванов / ООО Транс'})),
    ce(Field,{label:'Логист (кто контролирует)'},
      ce('select',{value:logist,onChange:e=>setLogist(e.target.value),style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:'10px 12px',color:'var(--text)',fontSize:14,fontFamily:'inherit'}},
        ce('option',{value:''},'— не назначен —'),
        LOGISTS.map(lg=>ce('option',{key:lg,value:lg},lg)))),
    ce(Field,{label:'🕓 Примерное освобождение авто'},ce('input',{type:'datetime-local',value:freeAt,onChange:e=>setFreeAt(e.target.value),style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:'10px 12px',color:'var(--text)',fontSize:14,fontFamily:'inherit'}})),
    ce(Field,{label:'📝 Заметка логиста'},ce('textarea',{value:note,onChange:e=>setNote(e.target.value),rows:3,placeholder:'Важная информация…',style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:11,color:'var(--text)',fontSize:14,fontFamily:'inherit',lineHeight:1.5}})),
    onDelete&&ce('button',{onClick:function(){ if(window.confirm('Удалить машину '+(truck.plate||'')+' из парка? Это действие необратимо — вся информация по машине будет удалена.')){ onDelete(truck.id); onClose(); } },className:'fl-press',style:{width:'100%',marginTop:2,marginBottom:2,padding:'10px',background:'transparent',border:'1px solid color-mix(in srgb,var(--red) 45%,transparent)',borderRadius:11,color:'var(--red)',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}},'🗑 Удалить машину из парка'),
    ce('div',{style:{display:'flex',gap:9,marginTop:6}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:save,className:'fl-press',disabled:!ok,style:{flex:1,padding:'11px',
        background:ok?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--border2)',border:'none',
        borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,cursor:ok?'pointer':'not-allowed',opacity:ok?1:.6}},'Сохранить'))
  );
}

// ── Plan a future trip per driver ─────────────────────────────
function PlanTripModal({trucks,clients,onSave,onClose}){
  const [q,setQ]=useState('');
  const [tid,setTid]=useState('');
  const [cid,setCid]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [ld,setLd]=useState(today());
  const [ud,setUd]=useState(today());
  const [note,setNote]=useState('');
  var ql=q.trim().toLowerCase();
  var shown=(trucks||[]).filter(function(t){ return !ql || ((t.plate||'')+' '+(t.driver||'')).toLowerCase().indexOf(ql)>=0; });
  var tr=(trucks||[]).find(function(t){return String(t.id)===String(tid);});
  var cl=(clients||[]).find(function(c){return c.id===cid;});
  var box={background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:11,padding:'11px 12px',marginBottom:10};
  var lbl={fontSize:10,fontWeight:800,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--text3)',marginBottom:7};
  var inp={width:'100%',background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:9,padding:'9px 11px',color:'var(--text)',fontSize:13,fontFamily:'inherit'};
  var dinp={width:'100%',background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:9,padding:'9px 11px',color:'var(--text)',fontSize:14,fontFamily:'inherit'};
  var chip=function(active,col){ col=col||'var(--accent)'; return {padding:'6px 11px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',background:active?'color-mix(in srgb,'+col+' 18%,transparent)':'var(--bg2)',border:'1px solid '+(active?col:'var(--border)'),color:active?col:'var(--text3)'}; };
  function save(){ if(!tr) return;
    onSave({id:uid(),truckId:tr.id,truckPlate:tr.plate,truckDriver:tr.driver,
      clientName:(cl&&cl.name)||'', from:from||((cl&&cl.loadAddr)||''), to:to||'',
      loadAddr:from||((cl&&cl.loadAddr)||''), loadDate:ld, unloadDate:ud, date:ld, note:note}); }
  return ce(Modal,{title:'📅 Запланировать рейс',onClose,wide:true},
    ce('div',{style:box},
      ce('div',{style:lbl},'Водитель / машина'),
      ce('input',{placeholder:T('search_ph'),value:q,onChange:e=>setQ(e.target.value),style:Object.assign({marginBottom:8},inp)}),
      ce('div',{style:{maxHeight:200,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}},
        shown.length===0
          ? ce('div',{style:{fontSize:12.5,color:'var(--text3)',padding:10,textAlign:'center'}},'Не найдено')
          : shown.map(function(t){ return ce('div',{key:t.id,className:'fl-press',onClick:()=>setTid(String(t.id)),style:{
              padding:'8px 11px',borderRadius:9,cursor:'pointer',
              background:String(tid)===String(t.id)?'color-mix(in srgb,var(--accent) 14%,transparent)':'var(--bg2)',
              border:'1px solid '+(String(tid)===String(t.id)?'var(--accent)':'var(--border)')}},
              ce('div',{style:{fontWeight:800,fontSize:13,color:'var(--text)'}},t.plate),
              ce('div',{style:{fontSize:11.5,color:'var(--text2)'}},t.driver)); }))),
    ce('div',{style:box},
      ce('div',{style:lbl},'Клиент (необязательно)'),
      ce('div',{style:{display:'flex',gap:6,flexWrap:'wrap',maxHeight:120,overflowY:'auto'}},
        (clients||[]).map(function(c){ return ce('button',{key:c.id,className:'fl-press',onClick:()=>{ if(c.id===cid){setCid('');} else {setCid(c.id); if(!from) setFrom(c.loadAddr||'');} },style:chip(cid===c.id,c.color)},c.name); }))),
    ce(Field,{label:'Откуда (загрузка)'},ce(Input,{value:from,onChange:setFrom,placeholder:'г. ...'})),
    ce(Field,{label:'Куда (выгрузка)'},ce(Input,{value:to,onChange:setTo,placeholder:'г. ...'})),
    ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
      ce(Field,{label:'Дата загрузки'},ce('input',{type:'date',value:ld,onChange:e=>setLd(e.target.value),style:dinp})),
      ce(Field,{label:'Дата выгрузки'},ce('input',{type:'date',value:ud,onChange:e=>setUd(e.target.value),style:dinp}))),
    ce(Field,{label:'Примечание'},ce(Textarea,{value:note,onChange:setNote,placeholder:'Напр.: в субботу поедет дальше'})),
    ce('div',{style:{display:'flex',gap:9,marginTop:6}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},T('btn_cancel')),
      ce('button',{onClick:save,className:'fl-press',disabled:!tr,style:{flex:1,padding:'11px',border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:800,
        background:tr?'linear-gradient(135deg,var(--violet),var(--accent))':'var(--border2)',cursor:tr?'pointer':'not-allowed',opacity:tr?1:.6}},'Запланировать'))
  );
}

class ErrorBoundary extends React.Component {
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return {err:e};}
  componentDidCatch(e,i){console.error('[Fletera]',e,i);}
  render(){
    if(this.state.err){
      return ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',
        flexDirection:'column',gap:16,padding:24,textAlign:'center'}},
        ce('div',{style:{fontSize:40}},'⚠️'),
        ce('div',{style:{color:'var(--text)',fontWeight:800,fontSize:18}},'Fletera — ошибка'),
        ce('div',{style:{color:'var(--text3)',fontSize:12,maxWidth:520,background:'var(--bg3)',padding:'12px',
          borderRadius:10,textAlign:'left',fontFamily:'monospace',whiteSpace:'pre-wrap',wordBreak:'break-all'}},
          (this.state.err.stack||this.state.err.message||String(this.state.err))),
        ce('button',{onClick:()=>window.location.reload(),style:{marginTop:8,padding:'9px 22px',borderRadius:10,
          background:'var(--accent)',border:'none',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:14}},'Перезагрузить'));
    }
    return this.props.children;
  }
}

// ── Boot ──────────────────────────────────────────────────────
(function(){
  function mount(){
    var el=document.getElementById('root');
    if(!el||el._mounted) return;
    el._mounted=true;
    try{ ReactDOM.createRoot(el).render(ce(ErrorBoundary,null,ce(App))); }
    catch(e){ el.innerHTML='<pre style="color:#f87171;padding:20px;white-space:pre-wrap">'+(e.stack||e.message)+'</pre>'; }
  }
  if(document.readyState!=='loading') mount();
  else document.addEventListener('DOMContentLoaded',mount);
})();
