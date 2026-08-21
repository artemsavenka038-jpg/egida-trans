/* Fletera by Egida-Trans — data layer (Firebase) + smart matching */
var DB_URL = "https://egida-transapp-default-rtdb.europe-west1.firebasedatabase.app";

function dbGet(path){ return fetch(DB_URL+path+".json").then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
function dbPut(path,val){ return fetch(DB_URL+path+".json",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(val)}).catch(function(){}); }
function dbPatch(path,val){ return fetch(DB_URL+path+".json",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(val)}).catch(function(){}); }

/* Надёжные обёртки: сообщают об успехе/ошибке, а не молчат */
function dbFetch(path){
  return fetch(DB_URL+path+".json").then(function(r){
    if(!r.ok) throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(v){ return {ok:true,val:v}; })
  .catch(function(e){ return {ok:false,err:String((e&&e.message)||e)}; });
}
function dbSave(path,val){
  return fetch(DB_URL+path+".json",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(val)})
  .then(function(r){
    if(!r.ok) return r.text().then(function(t){ return {ok:false,err:"HTTP "+r.status+" "+String(t).slice(0,120)}; });
    return {ok:true};
  }).catch(function(e){ return {ok:false,err:String((e&&e.message)||e)}; });
}

/* Что именно сломалось: сеть или права */
function dbErrKind(err){
  var e=String(err||"");
  if(/HTTP\s*40[13]|permission|denied|unauthor/i.test(e)) return "perm";
  if(/Load failed|Failed to fetch|NetworkError|ERR_|TypeError/i.test(e)) return "net";
  return "other";
}
/* ── CapNavi (геолокация/датчики) через наш прокси на Vercel ── */
var CAP_HOMO={'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','Y':'У','I':'І'};
function capNorm(s){
  if(!s) return '';
  var x=String(s).toUpperCase().trim();
  x=x.replace(/[-–—]\s*\d\s*$/,'');            // отрезать регион "-7"
  x=x.replace(/[^А-ЯЁA-Z0-9]/g,'');
  return x.replace(/[A-Z]/g,function(c){ return CAP_HOMO[c]||c; });
}
/* Разбирает строку name из CAP: "0464 DAF AT 4774-7 Волчок" -> {plate:'АТ4774',kind:'tractor'} */
function capParseName(name){
  if(!name) return {plate:'',digits:'',kind:'?',driver:''};
  var s=String(name).toUpperCase();
  s=s.replace(/^\s*\d{3,4}\s+/,'');
  s=s.replace(/\b(DAF|ДАФ|SCHMITZ|ШМИТЦ|KRONE|КРОНЕ)\b/g,' ');
  var mt=s.match(/([А-ЯЁA-Z]{2})\s*(\d{4})(?!\s*[А-ЯЁA-Z])/);
  if(mt) return {plate:capNorm(mt[1]+mt[2]), digits:mt[2], kind:'tractor'};
  var mp=s.match(/([А-ЯЁA-Z])\s*(\d{4})\s*([А-ЯЁA-Z])(?![А-ЯЁA-Z0-9])/);
  if(mp) return {plate:capNorm(mp[1]+mp[2]+mp[3]), digits:mp[2], kind:'trailer'};
  return {plate:'',digits:'',kind:'?'};
}
/* Номер машины в Fletera хранится как "АХ 4000-7 / А9473 Е-7" */
function splitFleteraPlate(s){
  var p=String(s||'').split('/');
  return {tractor:capNorm(p[0]||''), trailer:capNorm(p.length>1?p[1]:'')};
}
/* Требуемая температура клиента: "+1/-3", "-18", "+4/+2" -> {min,max} */
function parseTempRange(s){
  if(s==null||s==='') return null;
  var m=String(s).replace(/[°CС\s]/g,'').match(/-?\d+(?:[.,]\d+)?/g);
  if(!m||!m.length) return null;
  var nums=m.map(function(x){ return parseFloat(String(x).replace(',','.')); }).filter(function(x){ return !isNaN(x); });
  if(!nums.length) return null;
  return {min:Math.min.apply(null,nums), max:Math.max.apply(null,nums)};
}
function capFetch(path,params){
  var qs='path='+encodeURIComponent(path);
  if(params) Object.keys(params).forEach(function(k){ if(params[k]!=null&&params[k]!=='') qs+='&'+k+'='+encodeURIComponent(params[k]); });
  return fetch('/api/cap?'+qs).then(function(r){
    return r.text().then(function(t){
      var j=null; try{ j=JSON.parse(t); }catch(e){}
      if(!r.ok) return {ok:false,err:(j&&(j.message||j.error))||('HTTP '+r.status)};
      return {ok:true,val:j};
    });
  }).catch(function(e){ return {ok:false,err:String((e&&e.message)||e)}; });
}

/* Авто-освобождение: машина считается свободной, если статус FREE
   ИЛИ время «освободится» (freeAt) уже прошло. Статус в базе не меняем —
   просто везде показываем и считаем её свободной. */
/* Подменный водитель — не машина. В поле plate стоит «ПОДМЕННЫЙ» (с разными опечатками).
   Такие не считаются свободным транспортом и не показываются в подборе. */
/* Геолокация машин из CAP (/odometer теперь отдаёт latitude/longitude/speed).
   Строим карту: нормализованная плита тягача -> {lat, lon, speed, at, moving}. */
/* Разбор координат, вставленных из Google Maps: "54.0482, 28.2055" -> {lat,lon}.
   Принимает запятую/пробел/точку с запятой как разделитель. Возвращает null если не разобрал. */
/* Доля пройденного маршрута по GPS (0..1) для движущейся фуры на полосе.
   from/to — координаты загрузки/выгрузки, geo — текущая точка машины.
   Возвращает {frac, dir} где dir: 'there'|'back'|'idle'. */
function routeProgress(truck, geo, clients, orders){
  if(!geo||geo.lat==null) return null;
  var from=null,to=null,dir='there';
  var back=truck.backCargo;
  var goingBack=['BACK','BACK_GO','BACK_MOVING'].indexOf(truck.status)>=0;
  if(goingBack && back){ from=normGeo(back.fromGeo); to=normGeo(back.toGeo); dir='back'; }
  else {
    var cl=(clients||[]).find(function(c){ return c.id===truck.clientId||c.name===truck.clientName; });
    if(cl){ from=normGeo(cl.loadGeo); to=normGeo(cl.unloadGeo); }
    var ord=(orders||[]).find(function(o){ return o.assigned===truck.id; });
    if(ord){ if(ord.fromGeo) from=normGeo(ord.fromGeo); if(ord.toGeo) to=normGeo(ord.toGeo); }
  }
  if(!from||!to) return {frac:null,dir:dir,moving:geo.state==='moving'};
  var total=geoDistKm(from.lat,from.lon,to.lat,to.lon);
  var done=geoDistKm(from.lat,from.lon,geo.lat,geo.lon);
  if(total==null||done==null||total<1) return {frac:null,dir:dir,moving:geo.state==='moving'};
  var frac=done/total; if(frac<0) frac=0; if(frac>1) frac=1;
  return {frac:frac,dir:dir,moving:geo.state==='moving'};
}
function routeProgress_END(){}
function normGeo(s){
  if(!s) return null;
  if(typeof s==='object'&&s.lat!=null&&s.lon!=null) return s;
  var m=String(s).replace(/[^0-9.,;\-\s]/g,'').split(/[,;\s]+/).filter(Boolean);
  if(m.length<2) return null;
  var lat=parseFloat(m[0]), lon=parseFloat(m[1]);
  if(isNaN(lat)||isNaN(lon)) return null;
  if(lat<-90||lat>90||lon<-180||lon>180) return null;
  return {lat:lat,lon:lon};
}
function capGeoState(speed){
  var s=Number(speed);
  if(isNaN(s)) return 'unknown';
  return s>5 ? 'moving' : 'stopped';   // >5 км/ч считаем «едет»
}
function buildGeoIndex(odoData){
  var idx={};
  (odoData||[]).forEach(function(r){
    if(r.latitude==null||r.longitude==null) return;
    var p=capParseName(r.name||'');
    if(!p.plate) return;
    idx[p.plate]={lat:Number(r.latitude),lon:Number(r.longitude),
      speed:Number(r.speed),at:r.measured_at,state:capGeoState(r.speed)};
  });
  return idx;
}
function geoAgeMin(at){
  if(!at) return null;
  var d=new Date(at); if(isNaN(d.getTime())) return null;
  return Math.floor((Date.now()-d.getTime())/60000);
}
/* Расстояние между двумя точками в км (гаверсинус) — понадобится для автостатусов */
function geoDistKm(lat1,lon1,lat2,lon2){
  if([lat1,lon1,lat2,lon2].some(function(x){return x==null||isNaN(x);})) return null;
  var R=6371, rad=Math.PI/180;
  var dLat=(lat2-lat1)*rad, dLon=(lon2-lon1)*rad;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return 2*R*Math.asin(Math.sqrt(a));
}
/* Автостатус по геолокации — с учётом направления рейса.
   Машина «туда»: сравниваем с координатами загрузки/выгрузки клиента.
   Машина с обраткой (backCargo): сравниваем с координатами обратного груза.
   Возвращает: {st:'at_load'|'at_unload'|'moving'|'unknown', color, label, dir}
   Радиус «на точке» ~2 км, «едет» если скорость>5. */
/* «Где сейчас» для карточки: расстояние до целевой точки (выгрузка) и примерное время.
   Цель — координаты выгрузки: обратки (если едет назад) или клиента (туда). */
function geoWhereNow(truck, geo, clients, orders){
  if(!geo||geo.lat==null) return null;
  var target=null, targetName='', dir='туда';
  var back=truck.backCargo;
  // машина едет ОБРАТНО, если: есть обратный груз ИЛИ статус обратного рейса
  var goingBack = ['BACK','BACK_GO','BACK_MOVING'].indexOf(truck.status)>=0;  // только по статусу водителя, не по наличию обратки
  if(goingBack){
    dir='обратно';
    // цель обратки — её точка выгрузки, если координаты заданы
    if(back && back.toGeo){ target=normGeo(back.toGeo); targetName=(back.to||'дом'); }
    else { targetName=(back&&back.to)||'обратно домой'; }  // координат нет — покажем направление без км
  } else {
    var cl=(clients||[]).find(function(c){ return c.id===truck.clientId||c.name===truck.clientName; });
    if(cl && cl.unloadGeo){ target=normGeo(cl.unloadGeo); targetName=(cl.name||'выгрузка'); }
    var ord=(orders||[]).find(function(o){ return o.assigned===truck.id; });
    if(ord && ord.toGeo){ target=normGeo(ord.toGeo); targetName=(ord.to||ord.client||'выгрузка'); }
  }
  var moving=geo.state==='moving';
  var res={moving:moving,speed:Math.round(geo.speed||0),ageMin:geoAgeMin(geo.at),lat:geo.lat,lon:geo.lon,dir:dir,goingBack:goingBack};
  if(target){
    var dist=geoDistKm(geo.lat,geo.lon,target.lat,target.lon);
    if(dist!=null){
      res.distKm=Math.round(dist);
      res.targetName=targetName;
      var sp=moving&&geo.speed>10?geo.speed:60;
      res.etaH=dist/sp;
    }
  } else if(goingBack){
    res.targetName=targetName;  // направление есть, км нет (координаты обратки не заданы)
  }
  return res;
}
function autoGeoStatus(truck, geo, clients, orders){
  if(!geo||geo.lat==null) return null;
  var RAD=2; // км — радиус попадания на склад
  var back=truck.backCargo;
  var goingBack = ['BACK','BACK_GO','BACK_MOVING'].indexOf(truck.status)>=0;  // только по статусу водителя, не по наличию обратки
  var loadGeo=null, unloadGeo=null, dir='туда';
  if(goingBack){
    dir='обратно';
    // едет обратно — цель это выгрузка обратки; загрузку НЕ проверяем (уже загрузился)
    if(back){ unloadGeo=normGeo(back.toGeo); }
  } else {
    var cl=(clients||[]).find(function(c){ return c.id===truck.clientId||c.name===truck.clientName; });
    if(cl){ loadGeo=normGeo(cl.loadGeo); unloadGeo=normGeo(cl.unloadGeo); }
    var ord=(orders||[]).find(function(o){ return o.assigned===truck.id||String(o.cid)===String(truck.clientId); });
    if(ord){ if(ord.fromGeo) loadGeo=normGeo(ord.fromGeo); if(ord.toGeo) unloadGeo=normGeo(ord.toGeo); }
  }
  var moving=geo.state==='moving';
  var dLoad=loadGeo?geoDistKm(geo.lat,geo.lon,loadGeo.lat,loadGeo.lon):null;
  var dUnload=unloadGeo?geoDistKm(geo.lat,geo.lon,unloadGeo.lat,unloadGeo.lon):null;
  var suf=goingBack?' (обратно)':'';
  // стоит у точки
  if(!moving && dLoad!=null && dLoad<=RAD)
    return {st:'at_load',color:'var(--green)',label:'🟢 на загрузке'+suf,dir:dir,distKm:0};
  if(!moving && dUnload!=null && dUnload<=RAD)
    return {st:'at_unload',color:'var(--red)',label:'🔴 на выгрузке'+suf,dir:dir,distKm:0};
  // едет — покажем сколько до цели (выгрузка)
  if(moving){
    var dTarget=dUnload!=null?dUnload:dLoad;
    return {st:'moving',color:'var(--cyan)',label:'🔵 в пути'+(goingBack?' назад':''),dir:dir,distKm:dTarget!=null?Math.round(dTarget):null};
  }
  if(dLoad==null && dUnload==null) return null;
  // стоит не у точки — покажем до ближайшей цели
  var dNear=dUnload!=null?dUnload:dLoad;
  return {st:'stopped',color:'var(--text3)',label:'⏸ стоит',dir:dir,distKm:dNear!=null?Math.round(dNear):null};
}
function autoGeoStatusFree(truck, geo){
  // свободная машина без рейса — серый
  if(!MOVING_STATUSES.includes(truck.status)) return {st:'free',color:'var(--text3)',label:'⚪ свободна'};
  return null;
}
/* Автоопределение направления по ФАКТУ прохождения точки выгрузки (когда водитель молчит).
   Возвращает {atUnload, goingBack, reached}:
   - atUnload: сейчас стоит у выгрузки (в радиусе)
   - goingBack: побывал у выгрузки И теперь удалился И движется -> едет назад
   - reached: нужно запомнить «побывал у выгрузки» (машина впервые в радиусе) */
function autoDirection(truck, geo, clients, orders){
  if(!geo||geo.lat==null) return null;
  // цель — выгрузка клиента или заказа
  var unloadGeo=null;
  var cl=(clients||[]).find(function(c){ return c.id===truck.clientId||c.name===truck.clientName; });
  if(cl) unloadGeo=normGeo(cl.unloadGeo);
  var ord=(orders||[]).find(function(o){ return o.assigned===truck.id||String(o.cid)===String(truck.clientId); });
  if(ord && ord.toGeo) unloadGeo=normGeo(ord.toGeo);
  if(!unloadGeo) return null;   // нет координат выгрузки — определить не можем
  var RAD=3; // км
  var d=geoDistKm(geo.lat,geo.lon,unloadGeo.lat,unloadGeo.lon);
  if(d==null) return null;
  var inZone=d<=RAD;
  var wasThere=!!truck.reachedUnload;
  var moving=geo.state==='moving';
  return {
    atUnload:inZone,
    reached:(inZone && !wasThere),               // впервые заехал в зону — запомнить
    goingBack:(wasThere && !inZone && moving),   // был там, уехал, движется -> назад
    distKm:Math.round(d)
  };
}
function isSpareDriver(t){
  if(!t) return false;
  var p=String(t.plate||'').toUpperCase().replace(/[^А-ЯЁA-Z]/g,'');
  return p.indexOf('ПОДМЕН')>=0 || p.indexOf('PODMEN')>=0;
}
function truckFreeAtPassed(t){
  if(!t||!t.freeAt) return false;
  var d=new Date(t.freeAt); return !isNaN(d.getTime())&&d.getTime()<=Date.now();
}
function isFreeTruck(t){
  if(!t) return false;
  if(isSpareDriver(t)) return false;                 // подменный — не машина
  if(t.status==='SERVICE'||t.onService) return false;
  if(t.status==='FREE') return true;
  if(MOVING_STATUSES.indexOf(t.status)>=0 && truckFreeAtPassed(t)) return true;  // время вышло
  return false;
}
function effMoving(t){
  if(!t) return false;
  return MOVING_STATUSES.indexOf(t.status)>=0 && !truckFreeAtPassed(t);
}
var MOVING_STATUSES=['FORWARD','LOADED','BACK','AT_LOAD','ARRIVED_LOAD','LOADING','AT_UNLOAD','ARRIVED_UNLOAD','UNLOADED','BACK_GO'];

/* Локальный кэш — чтобы данные не исчезали с экрана при обрыве связи */
function cacheSet(key,val){ try{ localStorage.setItem("fletera_cache_"+key, JSON.stringify(val)); }catch(e){} }
function cacheGet(key){ try{ var s=localStorage.getItem("fletera_cache_"+key); return s?JSON.parse(s):null; }catch(e){ return null; } }

function mapVals(o){
  if(o==null) return [];
  if(Array.isArray(o)) return o.filter(function(x){return x!=null;});
  if(typeof o==="object") return Object.keys(o).map(function(k){return o[k];}).filter(function(x){return x!=null;});
  return [];
}
// imported order (title/dir/loadAddr/unloadAddr/text...) -> fields the UI expects
function normOrder(o){
  o=Object.assign({},o);
  if(o.client==null) o.client=o.title||o.cargo||"Заказ";
  if(o.from==null)   o.from=o.loadAddr||"";
  if(o.to==null)     o.to=o.unloadAddr||"";
  if(o.cid==null)    o.cid=o.clientId||"";
  o.rate=Number(o.rate)||0; o.cnt=o.cnt||1; o.temp=o.temp||""; o.note=o.note||"";
  o.date=o.date||o.loadDate||""; if(o.assigned===undefined) o.assigned=null;
  return o;
}

/* ── Geo / matching (Минск–Москва corridor + extras) ── */
var CITY_COORD={
 "минск":[53.9,27.5667],"москва":[55.751,37.618],"брест":[52.0976,23.7341],
 "смолевичи":[54.0297,28.0844],"барановичи":[53.1327,26.0139],"гомель":[52.4345,30.9754],
 "витебск":[55.1904,30.2049],"гродно":[53.6694,23.8131],"могилев":[53.9007,30.3314],"могилёв":[53.9007,30.3314],
 "бобруйск":[53.1384,29.2214],"борисов":[54.2278,28.5053],"жодино":[54.0969,28.3389],"молодечно":[54.3,26.85],
 "пинск":[52.1229,26.0951],"полоцк":[55.4859,28.7861],"лида":[53.8869,25.3,],"слуцк":[53.0274,27.5526],
 "смоленск":[54.782,32.0453],"подольск":[55.4312,37.5457],"химки":[55.8893,37.445],"люберцы":[55.6758,37.8939],
 "мытищи":[55.9105,37.7368],"балашиха":[55.7969,37.9381],"домодедово":[55.4406,37.7597],"котельники":[55.658,37.858],
 "красногорск":[55.8317,37.3306],"одинцово":[55.6739,37.2818],"ногинск":[55.8537,38.4443],"реутов":[55.7587,37.8569],
 "видное":[55.5503,37.7065],"долгопрудный":[55.9388,37.5028],"дзержинский":[55.6266,37.8537],
 "санкт-петербург":[59.9311,30.3609],"петербург":[59.9311,30.3609],"питер":[59.9311,30.3609],
 "тверь":[56.8587,35.9176],"калуга":[54.5293,36.2754],"тула":[54.1931,37.6173],"вязьма":[55.2118,34.2967],"орша":[54.5081,30.4172],
 "московск":[55.751,37.618],"подмосков":[55.751,37.618],"гроднен":[53.6694,23.8131],"пушкино":[56.0105,37.8471],"чехов":[55.1477,37.4772]
};
function detectCity(s){ if(!s) return null; s=(""+s).toLowerCase();
  for(var k in CITY_COORD){ if(s.indexOf(k)>=0) return k; } return null; }
function coordFromAddr(s){
  var m=(""+s).match(/(5[0-9]\.\d{3,})\s*,\s*((?:2[0-9]|3[0-9])\.\d{3,})/);
  if(m) return [parseFloat(m[1]),parseFloat(m[2])];
  var c=detectCity(s); if(c) return CITY_COORD[c];
  return null;
}
function distSimple(a,b){ if(!a||!b) return 0;
  var R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;
  var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return Math.round(2*R*Math.asin(Math.min(1,Math.sqrt(s)))); }
function currentTruckPoint(t){
  if(!t) return null;
  if(t.status==='FREE' && t.location) return coordFromAddr(t.location);
  if(t.unloadAddr) return coordFromAddr(t.unloadAddr);
  if(t.location)   return coordFromAddr(t.location);
  var tr=(t.trips||[]); if(tr.length){ var last=tr[tr.length-1]; if(last && last.to) return coordFromAddr(last.to); }
  return null;
}
var BYN_PER_EXTRA_KM=2.2;
// score a return cargo / order for a truck: deadhead (крюк) + profit (BYN, if rate present)
function scoreOrderForTruck(t,o){
  var from=o.loadAddr||o.from||o.to||"";
  var _a=currentTruckPoint(t), _b=coordFromAddr(from);
  if(!_a||!_b){ return {km:null,score:-1,verdict:"расстояние неизвестно",color:"var(--text3)",profit:0}; }
  var km=distSimple(_a, _b);
  var rate=Number(o.rate)||0;
  var risk = km>200?300 : km>120?180 : km>60?80 : 0;
  var profit = rate - km*BYN_PER_EXTRA_KM - risk;
  var kmScore = Math.max(0, 50 - km/2);
  var profScore = rate>0 ? Math.max(0, Math.min(60, profit/rate*60)) : 30;
  var score = Math.round(Math.max(0, Math.min(100, profScore + kmScore)));
  var verdict = score>=70?"брать первым" : score>=50?"хороший" : score>=30?"слабый" : "если нет лучше";
  var color = score>=70?"var(--green)" : score>=50?"var(--accent)" : score>=30?"var(--amber)" : "var(--text3)";
  return {km:km,score:score,verdict:verdict,color:color,profit:Math.round(profit)};
}
function bestTrucksForOrder(trucks,o){
  return (trucks||[]).filter(function(t){return t.status==='FREE';}).map(function(t){
    var s=scoreOrderForTruck(t,o);
    return Object.assign({},t,{_km:s.km,_score:s.score,_verdict:s.verdict,_color:s.color});
  }).sort(function(a,b){return b._score-a._score;});
}

// External driver app (responses sync via the same Firebase base)
var DRIVER_URL = "https://artemsavenka038-jpg.github.io/egida-driver/";
