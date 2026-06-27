/* Fletera by Egida-Trans — data layer (Firebase) + smart matching */
var DB_URL = "https://egida-transapp-default-rtdb.europe-west1.firebasedatabase.app";

function dbGet(path){ return fetch(DB_URL+path+".json").then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
function dbPut(path,val){ return fetch(DB_URL+path+".json",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(val)}).catch(function(){}); }
function dbPatch(path,val){ return fetch(DB_URL+path+".json",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(val)}).catch(function(){}); }

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
 "тверь":[56.8587,35.9176],"калуга":[54.5293,36.2754],"тула":[54.1931,37.6173],"вязьма":[55.2118,34.2967],"орша":[54.5081,30.4172]
};
function detectCity(s){ if(!s) return null; s=(""+s).toLowerCase();
  for(var k in CITY_COORD){ if(s.indexOf(k)>=0) return k; } return null; }
function coordFromAddr(s){
  var m=(""+s).match(/(5[0-9]\.\d{3,})\s*,\s*((?:2[0-9]|3[0-9])\.\d{3,})/);
  if(m) return [parseFloat(m[1]),parseFloat(m[2])];
  var c=detectCity(s); if(c) return CITY_COORD[c];
  return CITY_COORD["минск"];
}
function distSimple(a,b){ if(!a||!b) return 0;
  var R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;
  var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return Math.round(2*R*Math.asin(Math.min(1,Math.sqrt(s)))); }
function currentTruckPoint(t){
  if(!t) return CITY_COORD["минск"];
  if(t.unloadAddr) return coordFromAddr(t.unloadAddr);
  if(t.location)   return coordFromAddr(t.location);
  var tr=(t.trips||[]); if(tr.length){ var last=tr[tr.length-1]; if(last && last.to) return coordFromAddr(last.to); }
  return CITY_COORD["минск"];
}
var BYN_PER_EXTRA_KM=2.2;
// score a return cargo / order for a truck: deadhead (крюк) + profit (BYN, if rate present)
function scoreOrderForTruck(t,o){
  var from=o.loadAddr||o.from||o.to||"";
  var km=distSimple(currentTruckPoint(t), coordFromAddr(from));
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
