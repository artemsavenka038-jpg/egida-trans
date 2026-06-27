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
const uid   = () => Math.floor(Date.now()/1000) + Math.floor(Math.random()*1000);
const maxId = (arr) => arr.length ? Math.max.apply(null, arr.map(x=>Number(x.id)||0)) : 0;

// ── Status keys ───────────────────────────────────────────────
const MOVING = ['FORWARD','LOADED','BACK','AT_LOAD','ARRIVED_LOAD','LOADING','AT_UNLOAD','ARRIVED_UNLOAD','UNLOADED','BACK_GO'];
// ── Roles / logists ───────────────────────────────────────────
const LOGISTS = ['Анна','Милана','Кристина'];
const ROLES = LOGISTS.concat(['Руководитель']);
const LOGIST_COLOR = {'Анна':'#f59e0b','Милана':'#a78bfa','Кристина':'#22d3ee'};
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
    loadTime: truck.loadAt?fmtDT(truck.loadAt):'', temp: (cl&&cl.temp)?(cl.temp+'°C'):'', note: notes||'',
    cargo: (bc&&bc.cargo)||'', backFrom: (bc&&bc.from)||'', backTo: (bc&&bc.to)||'',
    departAt: (bc&&bc.departAt)?fmtDT(bc.departAt):'', backNote: (bc&&(bc.text||bc.note))||''
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
      if(tr.note) lines.push('📝 '+tr.note);
      else if(tc&&tc.note) lines.push('📝 '+tc.note);
      lines.push('');
    });
    fwdMsg=lines.join(String.fromCharCode(10));
  } else {
    fwdMsg=applyTpl(getTpl(settings,'fwd'), _v);
  }
  const backMsg = bc ? applyTpl(getTpl(settings,'back'), _v) : null;

  const driverLink = DRIVER_URL+'?pin='+truck.pin;
  const activeMsg = msgType==='forward'?fwdMsg:(backMsg||fwdMsg);
  const activeNote = msgType==='forward' ? notes : ((bc&&(bc.text||bc.note))||'');
  const phoneDigits = (truck.phone||'').replace(/[^0-9]/g,'');

  const copy = (txt)=>{ try{navigator.clipboard&&navigator.clipboard.writeText(txt);}catch(e){} };
  const openWA = (txt)=>{ if(phoneDigits) window.open('https://wa.me/'+phoneDigits+'?text='+encodeURIComponent(txt),'_blank'); copy(txt); };
  const openTG = (txt)=>{ window.open('https://t.me/share/url?url=&text='+encodeURIComponent(txt),'_blank'); copy(txt); };

  const tabChip=(active,col)=>({flex:1,textAlign:'center',padding:'8px',borderRadius:9,fontSize:12.5,fontWeight:700,cursor:'pointer',
    background:active?`color-mix(in srgb,${col} 18%,transparent)`:'var(--bg3)',
    border:`1px solid ${active?col:'var(--border)'}`,color:active?col:'var(--text3)'});
  const linkBtn=(col)=>({flex:1,padding:'9px',borderRadius:9,fontWeight:700,fontSize:12,cursor:'pointer',
    background:`color-mix(in srgb,${col} 14%,transparent)`,border:`1px solid color-mix(in srgb,${col} 35%,transparent)`,color:col});

  return ce(Modal,{title:'👤 '+truck.driver,onClose,wide:true},
    ce('div',{style:{display:'flex',gap:7,marginBottom:11}},
      ce('button',{className:'fl-press',onClick:()=>setMsgType('forward'),style:tabChip(msgType==='forward','var(--accent)')},'→ '+T('msg_forward')),
      bc&&ce('button',{className:'fl-press',onClick:()=>setMsgType('back'),style:tabChip(msgType==='back','var(--cyan)')},'↩ '+T('msg_back'))),
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
function TruckCard({truck,clients,orders,settings,role,isBoss,onUpdate,onSwapRequest,onOpenDriver}) {
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
      ce(Btn,{onClick:()=>window.open(DRIVER_URL+'?pin='+(truck.pin||''),'_blank'),color:'var(--text3)',sm:true},'📱')),

    modal==='forward'&&ce(ForwardModal,{truck,clients,onSave:upd,onClose:()=>setModal(null)}),
    modal==='back'&&ce(BackModal,{truck,orders,clients,onSave:upd,onClose:()=>setModal(null)}),
    modal==='msg'&&ce(MsgModal,{truck,clients,orders,settings,onClose:()=>setModal(null)}),
    modal==='note'&&ce(NoteModal,{truck,onSave:upd,onClose:()=>setModal(null)}),
    modal==='edittruck'&&ce(EditTruckModal,{truck,onSave:upd,onClose:()=>setModal(null)})
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
function RolePicker({onPick}){
  return ce('div',{style:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20,color:'var(--text)'}},
    ce('div',{style:{width:'100%',maxWidth:420}},
      ce('div',{style:{textAlign:'center',marginBottom:22}},
        ce('div',{style:{fontWeight:800,fontSize:24,fontFamily:'Plus Jakarta Sans,sans-serif'}},'Fle',ce('span',{style:{color:'var(--accent)'}},'tera')),
        ce('div',{style:{fontSize:13.5,color:'var(--text3)',marginTop:5}},'Кто работает? Выберите себя')),
      ROLES.map(function(r){ var isBoss=r==='Руководитель'; var col=isBoss?'var(--green)':(LOGIST_COLOR[r]||'var(--accent)');
        return ce('button',{key:r,className:'fl-press',onClick:()=>onPick(r),style:{width:'100%',marginBottom:11,padding:'16px 18px',
          borderRadius:14,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:13,
          background:`color-mix(in srgb,${col} 12%,transparent)`,border:`1px solid color-mix(in srgb,${col} 40%,transparent)`,color:col,fontWeight:800,fontSize:17}},
          ce('span',{style:{fontSize:23}},isBoss?'👔':'👤'), r,
          isBoss?ce('span',{style:{marginLeft:'auto',fontSize:11,color:'var(--text3)',fontWeight:600}},'видит всех'):null); })));
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
  var ta={width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:10,padding:11,color:'var(--text)',fontSize:13,fontFamily:'inherit',lineHeight:1.5};
  return ce(Modal,{title:'⚙ Шаблон сообщения водителю',onClose,wide:true},
    ce('div',{style:{fontSize:11.5,color:'var(--text3)',marginBottom:10,lineHeight:1.7}},'Переменные подставляются сами. Туда: ',
      ce('span',{style:{color:'var(--accent)'}},'{client} {loadAddr} {unloadAddr} {loadTime} {temp} {note}'),'. Обратка: ',
      ce('span',{style:{color:'var(--cyan)'}},'{cargo} {backFrom} {backTo} {departAt} {backNote}'),'. Пустые строки убираются автоматически.'),
    ce(Field,{label:'Шаблон «туда»'},ce('textarea',{value:fwd,onChange:e=>setFwd(e.target.value),rows:7,style:ta})),
    ce(Field,{label:'Шаблон «обратка»'},ce('textarea',{value:back,onChange:e=>setBack(e.target.value),rows:6,style:ta})),
    ce('div',{style:{display:'flex',gap:9,marginTop:6}},
      ce(Btn,{onClick:onClose,color:'var(--text3)',wide:true},'Отмена'),
      ce('button',{onClick:()=>onSave({fwd:fwd,back:back}),className:'fl-press',style:{flex:1,padding:'11px',
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
  const [tab,setTab] = useState('park');
  const [search,setSearch] = useState('');
  const [stFilter,setStFilter] = useState('ALL');
  const [toast,setToast] = useState('');
  const [logDate,setLogDate] = useState(today());
  const [driverPageId,setDriverPageId] = useState(null);
  const [modal,setModal] = useState(null);
  const [movingModal,setMovingModal] = useState(null);
  const [role,setRole] = useState(()=>{ try{return localStorage.getItem('egida_role')||null;}catch(e){return null;} });
  const [settings,setSettings] = useState({});
  const isBoss = role==='Руководитель';
  const pickRole = (r)=>{ setRole(r); try{localStorage.setItem('egida_role',r);}catch(e){} };
  const saveTpl = (tpl)=>{ setSettings(p=>Object.assign({},p,{driverTpl:tpl})); dbPut('/settings/driverTpl',tpl); setModal(null); tShow('Шаблон сохранён'); };

  const tShow = msg=>{ setToast(msg); setTimeout(()=>setToast(''),2400); };
  useEffect(()=>{ dbGet('/settings').then(function(x){ if(x&&typeof x==='object') setSettings(x); }).catch(function(){}); },[]);
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

  const updTruck = (id,patch)=>{ setTrucks(prev=>prev.map(t=>{ if(t.id!==id) return t; var m=Object.assign({},t,patch); dbPut('/trucks/'+id,m); return m; })); tShow(T('saved')); };
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

  const TABS=[
    ['park',T('tab_park')+' ('+trucks.length+')'],
    ['moving',T('tab_moving')+' ('+stats.moving+')'],
    ['clients',T('tab_clients')+' ('+clients.length+')'],
    ['orders',T('tab_orders')+(orders.length?' ('+orders.length+')':'')],
    ['future',T('tab_plan')+(plans.length?' ('+plans.length+')':'')],
    ['log',T('tab_log')],
  ];

  if(!auth) return ce(Login,{onOk:()=>setAuth(true)});
  if(driverPageId){
    const dt=trucks.find(t=>t.id===driverPageId);
    if(dt) return ce(DriverPage,{truck:dt,clients,orders,onUpdate:p=>updTruck(dt.id,p),onClose:()=>setDriverPageId(null)});
  }
  if(!role) return ce(RolePicker,{onPick:pickRole});

  const headBtn={padding:'7px 12px',borderRadius:9,background:'var(--bg3)',color:'var(--text2)',
    fontWeight:700,fontSize:12.5,border:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit'};

  return ce('div',{style:{minHeight:'100vh',color:'var(--text)'}},
    toast&&ce('div',{className:'fl-modal-overlay',style:{position:'fixed',top:16,right:16,zIndex:999,
      background:'var(--bg2)',border:'1px solid color-mix(in srgb,var(--green) 40%,transparent)',borderRadius:11,
      padding:'9px 17px',fontSize:13,fontWeight:700,color:'var(--green)',boxShadow:'var(--shadow-lg)',animation:'fl-toast .25s ease both'}},toast),

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
        ce('nav',{style:{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center',flex:1}},
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
          ce('button',{className:'fl-press',onClick:()=>{const nl=lang==='ru'?'en':'ru';setLang(nl);window._lang=nl;},
            style:Object.assign({},headBtn,{color:lang==='en'?'var(--accent)':'var(--text2)',
              borderColor:lang==='en'?'var(--accent)':'var(--border)'})},lang==='ru'?'🇬🇧 EN':'🇷🇺 RU'),
          ce('button',{className:'fl-press',onClick:()=>setModal('template'),style:Object.assign({},headBtn,{color:'var(--violet)',borderColor:'color-mix(in srgb,var(--violet) 40%,transparent)'})},'⚙ Шаблон'),
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
      ce('div',{style:{display:'flex',gap:7,marginBottom:14,flexWrap:'wrap',alignItems:'center'}},
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
      isBoss&&ce('div',{style:{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginBottom:13,padding:'11px 13px',
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
      ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))',gap:12}},
        filtered.map(t=>ce(TruckCard,{key:t.id,truck:t,clients,orders,settings,role,isBoss,onUpdate:updTruck,
          onSwapRequest:tk=>setModal({type:'swap',truck:tk}),onOpenDriver:id=>setDriverPageId(id)}))),
      filtered.length===0&&ce('div',{style:{textAlign:'center',padding:50,color:'var(--text3)'}},T('none_found'))),

    // ── MOVING TAB (календарь по дням) ──
    tab==='moving'&&(function(){
      var todayStr=today();
      var wd=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      var base=new Date(); base.setHours(0,0,0,0);
      var days=[]; for(var i=0;i<14;i++){ days.push(new Date(base.getTime()+i*864e5)); }
      function ds(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
      function onRoute(t,key){ if(!MOVING.includes(t.status)) return false;
        var sN=t.loadAt||((t.trips&&t.trips[0])?t.trips[0].loadAt:null);
        var eN=t.freeAt||((t.trips&&t.trips.length)?t.trips[t.trips.length-1].freeAt:null);
        if(!sN&&!eN) return key===todayStr;
        if(!sN) return false;
        var s2=new Date(key+'T00:00:00'), e2=new Date(key+'T23:59:59');
        var ss=new Date(sN), ee=eN?new Date(eN):ss;
        return ss<=e2 && ee>=s2; }
      function planOn(p,key){ var sd=p.loadDate||p.date; var ed=p.unloadDate||p.loadDate||p.date; return !!sd && sd<=key && key<=(ed||sd); }
      var dayTrucks=trucks.filter(function(t){return onRoute(t,routeDay)&&(isBoss||t.logist===role);});
      var dayPlans=(plans||[]).filter(function(p){return planOn(p,routeDay);});
      return ce('div',{style:{padding:'16px',maxWidth:1700,margin:'0 auto'}},
        ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,gap:10,flexWrap:'wrap'}},
          ce('div',null,
            ce('h2',{style:{margin:0,fontWeight:800,color:'var(--text)',fontSize:20}},T('moving_title')),
            ce('div',{style:{fontSize:12.5,color:'var(--text3)',marginTop:3}},'Выбери день — кто в рейсе и какие планы на этот день.')),
          ce('button',{className:'fl-press',onClick:()=>setModal('plantrip'),style:{padding:'8px 15px',borderRadius:9,
            border:'1px solid color-mix(in srgb,var(--violet) 50%,transparent)',background:'color-mix(in srgb,var(--violet) 14%,transparent)',
            color:'var(--violet)',fontWeight:800,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}},'📅 Запланировать рейс')),
        ce('div',{style:{display:'flex',gap:7,overflowX:'auto',paddingBottom:8,marginBottom:14}},
          days.map(function(d){ var key=ds(d); var act=key===routeDay;
            var cnt=trucks.filter(function(t){return onRoute(t,key)&&(isBoss||t.logist===role);}).length+(plans||[]).filter(function(p){return planOn(p,key);}).length;
            return ce('button',{key:key,className:'fl-press',onClick:()=>setRouteDay(key),style:{
              flexShrink:0,minWidth:66,padding:'8px 10px',borderRadius:11,cursor:'pointer',fontFamily:'inherit',textAlign:'center',
              border:'1px solid '+(act?'var(--accent)':'var(--border)'),
              background:act?'color-mix(in srgb,var(--accent) 16%,transparent)':'var(--bg2)',color:act?'var(--accent)':'var(--text3)'}},
              ce('div',{style:{fontSize:11,fontWeight:700}},wd[d.getDay()]+(key===todayStr?' •':'')),
              ce('div',{style:{fontSize:13,fontWeight:800,marginTop:2}},String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')),
              ce('div',{style:{fontSize:10,marginTop:2}},cnt?cnt+' маш.':'—')); })),
        ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:10}},'В рейсе: '+dayTrucks.length+(dayPlans.length?(' · план: '+dayPlans.length):'')),
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

    // ── GLOBAL MODALS ──
    modal&&modal.type==='swap'&&modal.truck&&ce(SwapModal,{truck:modal.truck,trucks,onSwap:swapDrivers,onClose:()=>setModal(null)}),
    modal==='template'&&ce(TemplateModal,{settings,onSave:saveTpl,onClose:()=>setModal(null)}),
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
function EditTruckModal({truck,onSave,onClose}){
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
