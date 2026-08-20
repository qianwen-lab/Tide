const STORAGE_KEY = 'tide.v1';
const VERSION = '5.0.0';
const SCHEMA_VERSION = 5;

const COLORS = { cream:'#FFF6E6', blue:'#174A8B', sky:'#2BA3D9', coral:'#FF7A59', green:'#22C55E', ink:'#1F2937' };
const iso = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const today = () => iso(new Date());
const addDays = (s,n) => { const d=new Date(`${s}T12:00:00`); d.setDate(d.getDate()+n); return iso(d); };
const parseDate = s => new Date(`${s}T12:00:00`);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const avg = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
const fmt = x => x==null || Number.isNaN(+x) ? '—' : Number(x).toFixed(1);
const fmtDate = (s, lang='zh') => {
  const d=parseDate(s);
  return lang==='zh' ? `${d.getMonth()+1}月${d.getDate()}日` : d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
};
const escapeHtml = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const defaults = {
  schemaVersion:SCHEMA_VERSION,
  version:SCHEMA_VERSION,
  language:'zh',
  goal:{name:'Back to 50',start:today(),end:addDays(today(),31),startWeight:52.7,target:50,status:'active'},
  days:{},
  plan:{veg:3,fruit:2,noSnack:true,stop:'18:00',satiety:7,water:2,stepsTarget:10000,stepsDays:5,stretchDays:5,cardio:90,strength:60},
  goals:[]
};

let db = loadDB();
let view = 'today';
let selected = today();
let calendarMonth = today().slice(0,7) + '-01';
let range = '30';
let flash = '';

function fresh(){ return JSON.parse(JSON.stringify(defaults)); }
function mergeDay(x={}){
  return {
    date:x.date||today(), weight:x.weight??null, sleep:x.sleep??null,
    events:Array.isArray(x.events)?x.events.filter(e=>!String(e).toLowerCase().includes('period')).map(e=>({'Dinner out':'dinner','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Sick':'sick'}[e]||e)):[],
    planMode:x.planMode||'default', plannedSleep:x.plannedSleep??null,
    customPlan:{
      veg:x.customPlan?.veg??null, fruit:x.customPlan?.fruit??null, noSnack:x.customPlan?.noSnack??null,
      stop:x.customPlan?.stop??null, satiety:x.customPlan?.satiety??null, water:x.customPlan?.water??null,
      steps:x.customPlan?.steps??null, stretch:x.customPlan?.stretch??null, cardio:x.customPlan?.cardio??null, strength:x.customPlan?.strength??null
    },
    plannedMove:{steps:x.plannedMove?.steps??null,stretch:x.plannedMove?.stretch??null,cardio:x.plannedMove?.cardio??null,strength:x.plannedMove?.strength??null},
    food:{veg:x.food?.veg??null,fruit:x.food?.fruit??null,noSnack:x.food?.noSnack??null,stop6:x.food?.stop6??null,water:x.food?.water??null,satiety:x.food?.satiety??null},
    move:{steps:x.move?.steps??null,stretch:x.move?.stretch??null,cardio:x.move?.cardio??null,strength:x.move?.strength??null},
    close:x.close??null,note:x.note??''
  };
}
function migrate(raw){
  const out=fresh();
  if(!raw || typeof raw!=='object') return out;
  out.language='zh';
  out.goal={...out.goal,...(raw.goal||{})};
  out.plan={...out.plan,...(raw.plan||{}),stepsTarget:10000};
  out.goals=Array.isArray(raw.goals)?raw.goals.map(g=>({...g,snapshot:true})):[];
  out.days={};
  Object.entries(raw.days||{}).forEach(([k,v])=>out.days[k]=mergeDay({...v,date:k}));
  out.schemaVersion=SCHEMA_VERSION; out.version=SCHEMA_VERSION;
  return out;
}
function loadDB(){
  try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}
  catch{return fresh();}
}
function persist(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(db)); }
function save(message=''){ persist(); if(message) flash=message; render(); }
function day(s){ if(!db.days[s]) db.days[s]=mergeDay({date:s}); else db.days[s]=mergeDay(db.days[s]); return db.days[s]; }

const T = {
  zh:{today:'今天',calendar:'日历',change:'变化',goals:'目标',settings:'设置',save:'保存',saved:'已保存',currentGoal:'当前目标',day:'第',days:'天',currentWeight:'当前体重',goal:'目标',morning:'早晨记录',fastingWeight:'起床空腹体重',sleep:'昨晚睡眠',hours:'小时',todayPlan:'今日计划',fromGoal:'来自当前目标的默认计划',todayActual:'今日实际',editable:'随时可以回来修改',veg:'蔬菜',fruit:'水果',noSnack:'不吃零食',after6:'6点后不吃',satiety:'分饱',water:'水',movement:'运动',steps:'步数',stretch:'Stretch',cardio:'Cardio',strength:'Strength',minutes:'分钟',todayNote:'今日提示',thisWeek:'本周运动',openDay:'查看 / 编辑这一天',food:'饮食',special:'特殊安排',noRecord:'没有记录',futurePlan:'未来计划',pastEdit:'补录 / 修改',defaultPlan:'默认计划',flexible:'灵活日',custom:'自定义',lifeEvents:'特殊安排',actualRecord:'实际记录',notes:'备注',done:'完成',weightChange:'体重变化',actualWeight:'空腹体重',sevenAvg:'7日平均',goalLine:'目标',recentDays:'最近几天',goalJourney:'当前目标',pastGoals:'过去的目标',reached:'达成',close:'接近目标',ended:'已结束',active:'进行中',newGoal:'新目标',archive:'结束并归档',start:'开始',target:'目标',language:'语言 / Language',export:'导出备份',import:'导入备份',about:'关于 Tide',version:'版本',defaultFood:'默认饮食规则',weeklyMove:'每周运动目标',localFirst:'数据保存在当前设备浏览器，并可导出 JSON 备份。',month:['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']},
  en:{today:'Today',calendar:'Calendar',change:'Change',goals:'Goals',settings:'Settings',save:'Save',saved:'Saved',currentGoal:'Current goal',day:'Day',days:'days',currentWeight:'Current weight',goal:'Goal',morning:'Morning log',fastingWeight:'Morning fasting weight',sleep:'Last night sleep',hours:'hours',todayPlan:"Today's plan",fromGoal:'From your current goal',todayActual:"Today's actual",editable:'Come back and edit anytime',veg:'Vegetables',fruit:'Fruit',noSnack:'No snacks',after6:'No food after 6 PM',satiety:'full',water:'Water',movement:'Movement',steps:'Steps',stretch:'Stretch',cardio:'Cardio',strength:'Strength',minutes:'min',todayNote:"Today's note",thisWeek:'This week',openDay:'View / edit this day',food:'Food',special:'Special',noRecord:'No record',futurePlan:'Future plan',pastEdit:'Edit past day',defaultPlan:'Default',flexible:'Flexible',custom:'Custom',lifeEvents:'Life events',actualRecord:'Actual record',notes:'Notes',done:'Done',weightChange:'Weight change',actualWeight:'Fasting weight',sevenAvg:'7-day avg',goalLine:'Goal',recentDays:'Recent days',goalJourney:'Current goal',pastGoals:'Past goals',reached:'Reached',close:'Close',ended:'Ended',active:'Active',newGoal:'New goal',archive:'End & archive',start:'Start',target:'Target',language:'Language / 语言',export:'Export backup',import:'Import backup',about:'About Tide',version:'Version',defaultFood:'Default food rules',weeklyMove:'Weekly movement goals',localFirst:'Data stays in this browser and can be exported as a JSON backup.',month:['January','February','March','April','May','June','July','August','September','October','November','December']}
};
const tr = k => T.zh[k] ?? k;

function latestWeights(until=today()){
  return Object.values(db.days).filter(x=>x.weight!=null && x.date<=until).sort((a,b)=>a.date.localeCompare(b.date));
}
function latestWeight(until=today()){ const a=latestWeights(until); return a.length?a[a.length-1]:null; }
function movingAverage(date, window=7){ const a=latestWeights(date).slice(-window).map(x=>+x.weight); return avg(a); }
function activeGoalStartWeight(){ const rec=db.days[db.goal.start]; return rec?.weight!=null ? +rec.weight : +db.goal.startWeight; }
function dayPlan(d){
  const base={veg:db.plan.veg,fruit:db.plan.fruit,noSnack:db.plan.noSnack,stop:db.plan.stop,satiety:db.plan.satiety,water:db.plan.water,steps:10000,stretch:null,cardio:null,strength:null};
  if(d.planMode==='flexible') return {...base,stop:null};
  if(d.planMode==='custom') return {...base,...Object.fromEntries(Object.entries(d.customPlan||{}).filter(([,v])=>v!==null&&v!==''))};
  return base;
}
function dayIndexInGoal(s){ return Math.max(1,Math.floor((parseDate(s)-parseDate(db.goal.start))/86400000)+1); }
function goalDuration(){ return Math.max(1,Math.floor((parseDate(db.goal.end)-parseDate(db.goal.start))/86400000)+1); }
function goalProgress(weight){
  if(weight==null) return 0;
  const start=activeGoalStartWeight(); const total=start-db.goal.target;
  if(total<=0) return 0;
  return clamp((start-weight)/total*100,0,100);
}
function weightChange(s){
  const w=day(s).weight; if(w==null)return null;
  const prev=latestWeights(addDays(s,-1)); if(!prev.length)return null;
  return +w - +prev[prev.length-1].weight;
}
function foodStatus(d){
  const f=d.food, p=dayPlan(d);
  const core=[f.veg,f.fruit,f.noSnack,f.stop6,f.satiety];
  const recorded=core.filter(v=>v!==null&&v!=='').length;
  if(!recorded) return {recorded:0,score:null,enough:false,calendarPass:false,label:'没有记录'};
  let pass=0, denom=0;
  if(f.veg!=null){denom++; if(+f.veg>=+p.veg)pass++;}
  if(f.fruit!=null){denom++; if(+f.fruit<=+p.fruit)pass++;}
  if(f.noSnack!=null){denom++; if(p.noSnack===false || f.noSnack===true)pass++;}
  if(p.stop==null){ /* planned exception */ } else if(f.stop6!=null){denom++; if(f.stop6===true)pass++;}
  if(f.satiety!=null){denom++; if(+f.satiety<=+p.satiety)pass++;}
  const score=denom?pass/denom:null;
  const enough=denom>=4;
  const calendarPass=enough && pass>=4 && score>=.8;
  return {recorded,score,enough,calendarPass,label:calendarPass?'饮食达标':enough?(score>=.6?'基本达标':'偏离计划'):'记录不完整'};
}
function moveStatus(d){
  const m=d.move; const meaningful=(+m.steps||0)>=10000 || (+m.cardio||0)>0 || (+m.strength||0)>0;
  const any=(+m.steps||0)>0 || m.stretch===true || (+m.cardio||0)>0 || (+m.strength||0)>0;
  if(!any) return {done:false,calendarPass:false,label:'没有记录'};
  const pieces=[];
  if(+m.steps>=10000) pieces.push('10k步');
  if(+m.cardio>0) pieces.push(`Cardio ${m.cardio}分`);
  if(+m.strength>0) pieces.push(`Strength ${m.strength}分`);
  if(!pieces.length&&m.stretch) pieces.push('Stretch');
  return {done:any,calendarPass:meaningful,label:pieces.slice(0,2).join(' · ')};
}
function plannedMoveStatus(d){
  const m=d.plannedMove||{}; const any=(+m.steps||0)>0 || m.stretch===true || (+m.cardio||0)>0 || (+m.strength||0)>0;
  if(!any) return {planned:false,label:tr('noRecord')};
  const pieces=[];
  if(+m.steps>0) pieces.push(`${m.steps}${db.language==='zh'?'步':' steps'}`);
  if(m.stretch) pieces.push('Stretch');
  if(+m.cardio>0) pieces.push(`${m.cardio}${db.language==='zh'?'分有氧':'m cardio'}`);
  if(+m.strength>0) pieces.push(`${m.strength}${db.language==='zh'?'分力量':'m strength'}`);
  return {planned:true,calendarPass:(+m.steps||0)>=10000 || (+m.cardio||0)>0 || (+m.strength||0)>0,label:pieces.slice(0,2).join(' · ')};
}
function plannedMoveControls(d){
  const m=d.plannedMove||{};
  return `<div class="two"><label>${tr('steps')}<input data-day-field="plannedMove.steps" inputmode="numeric" type="number" min="0" value="${m.steps??''}" placeholder="10000"></label><label>${tr('cardio')} · ${tr('minutes')}<input data-day-field="plannedMove.cardio" inputmode="numeric" type="number" min="0" value="${m.cardio??''}" placeholder="0"></label><label>${tr('strength')} · ${tr('minutes')}<input data-day-field="plannedMove.strength" inputmode="numeric" type="number" min="0" value="${m.strength??''}" placeholder="0"></label><div style="padding-top:26px"><div class="switch-row"><span style="font-size:14px">${tr('stretch')}</span><button class="toggle ${m.stretch===true?'on':''}" data-toggle-planned-move="stretch"></button></div></div></div>`;
}
function dynamicInsight(){
  const tw=latestWeight(today());
  const prev=latestWeight(addDays(today(),-1));
  const a=movingAverage(today()), ay=movingAverage(addDays(today(),-1));
  const f=foodStatus(day(today()));
  const events=day(today()).events.length;
  const options=[];
  if(tw!=null && prev!=null && tw-prev>=.5 && a!=null && ay!=null && a<=ay+.15) options.push(db.language==='zh'?'今天数字跳了一点，但7日平均体重几乎没变。先照原计划吃，不需要补偿。':'Today jumped a little, but the 7-day average barely moved. Keep the plan; no compensation needed.');
  if(a!=null && ay!=null && a<ay-.05) options.push(db.language==='zh'?'7日平均体重继续往下。现在最有价值的不是再减更多，而是把今天照常做好。':'Your 7-day average is still moving down. The best move is simply to repeat the plan today.');
  if(events) options.push(db.language==='zh'?'今天有特殊安排。它已经是计划的一部分，不需要把这一天当成“破功”。':'You have a special plan today. It is part of the plan, not a broken day.');
  if(f.score!=null && f.score>=.8) options.push(db.language==='zh'?'今天执行得很稳。保持这种普通、可重复的一天，比“完美一天”更重要。':'Today is steady and repeatable. That matters more than a perfect day.');
  if(!options.length) options.push(db.language==='zh'?'今天只看执行，不追着秤改计划。把这一天做好就够了。':'Focus on execution, not reacting to the scale. One solid day is enough.');
  const idx=(new Date().getDate()+latestWeights().length)%options.length;
  return options[idx];
}

function icons(name){
  const map={
    today:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
    change:'<svg viewBox="0 0 24 24"><path d="M4 17l5-6 4 3 7-8"/><path d="M19 6h1v5"/></svg>',
    goals:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.8a7 7 0 0 0-.8-1.8l.9-2-2.1-2.1-2 .9a7 7 0 0 0-1.8-.8l-.7-2h-3l-.8 2a7 7 0 0 0-1.8.8l-2-.9-2.1 2.1.9 2a7 7 0 0 0-.8 1.8l-2 .8v3l2 .8a7 7 0 0 0 .8 1.8l-.9 2 2.1 2.1 2-.9a7 7 0 0 0 1.8.8l.8 2h3l.7-2a7 7 0 0 0 1.8-.8l2 .9 2.1-2.1-.9-2a7 7 0 0 0 .8-1.8z"/></svg>'
  };
  return map[name]||'';
}
function nav(){
  const items=[['today',tr('today')],['calendar',tr('calendar')],['change',tr('change')],['goals',tr('goals')],['settings',tr('settings')]];
  return `<nav class="nav">${items.map(([k,label])=>`<button data-view="${k}" class="${view===k?'active':''}">${icons(k)}${label}</button>`).join('')}</nav>`;
}
function topbar(title, kicker='', actions=''){
  return `<div class="topbar"><div>${kicker?`<div class="kicker">${kicker}</div>`:''}<h1 class="page-title">${title}</h1></div><div>${actions}</div></div>`;
}
function flashHtml(){ if(!flash)return ''; const s=flash; flash=''; return `<div class="insight" style="margin-bottom:10px">${escapeHtml(s)}</div>`; }

function todayPage(){
  const d=day(today()), lw=latestWeight(today()), ma=movingAverage(today());
  const startW=activeGoalStartWeight(), progress=goalProgress(lw?.weight??startW), dayNum=dayIndexInGoal(today()), total=goalDuration();
  const week=weekStats();
  return `${topbar(`今天 · ${fmtDate(today())}`,'Tide')}
  ${flashHtml()}
  <section class="goal-compact">
    <div class="row between"><div><b>${escapeHtml(db.goal.name)}</b><span class="small"> · ${dayNum}/${total}天</span></div><span class="status active">进行中</span></div>
    <div class="goal-numbers"><span><b>${fmt(lw?.weight??startW)}</b> kg</span><span class="goal-arrow">→</span><span><b>${fmt(db.goal.target)}</b> kg · ${fmtDate(db.goal.end)}</span></div>
    <div class="progress compact"><i style="width:${progress}%"></i></div>
    <div class="morning-inline"><span>今早 <b>${fmt(d.weight)}</b> kg</span><span>睡眠 <b>${fmt(d.sleep)}</b> h</span><button class="text-btn" data-action="editToday">编辑</button></div>
  </section>
  <div class="insight priority"><b>🌊 今日提醒</b><br>${dynamicInsight()}</div>

  <div class="section-title compact-title">今日计划 <button class="text-btn" data-action="editToday">调整今天</button></div>
  <section class="plan-strip">${todayPlanChips(d)}</section>

  <div class="section-title compact-title">今日记录</div>
  <section class="card compact-card">${actualFoodControls(d)}<hr class="sep"><div class="actual-label">运动</div>${movementControls(d)}</section>

  <div class="section-title compact-title">本周</div>
  <section class="card compact-card"><div class="week-bars">${weekBars(week)}</div></section>`;
}
function todayPlanChips(d){
  const p=dayPlan(d); const chips=[`🥬 蔬菜 ≥ ${p.veg}`,`🍎 水果 ≤ ${p.fruit}`,p.noSnack===false?'零食可安排':'不吃零食',p.stop==null?'6点规则暂停':'6点后不吃',`${p.satiety}分饱`,`水 ≥ ${p.water}L`];
  return `<div class="rule-grid compact-rules">${chips.map(x=>`<div class="rule">${x}</div>`).join('')}</div>${d.events.length?`<div class="life-events compact-events">${d.events.map(e=>`<span class="event-chip on">${escapeHtml(eventLabel(e))}</span>`).join('')}</div>`:''}`;
}
function actualFoodControls(d){
  const veg=[0,1,2,3,4], fruit=[0,1,2,3], sat=[5,6,7,8,9,10];
  return `
  <div class="actual-row"><div class="actual-label">${tr('veg')}</div><div class="chip-row">${veg.map(v=>`<button class="pill ${d.food.veg!==null && +d.food.veg===v?'on':''}" data-set-food="veg" data-value="${v}">${v===4?'4+':v}</button>`).join('')}</div></div>
  <div class="actual-row"><div class="actual-label">${tr('fruit')}</div><div class="chip-row">${fruit.map(v=>`<button class="pill ${d.food.fruit!==null && +d.food.fruit===v?'on':''}" data-set-food="fruit" data-value="${v}">${v===3?'3+':v}</button>`).join('')}</div></div>
  <div class="actual-row"><div class="switch-row"><div><div class="actual-label" style="margin:0">${tr('noSnack')}</div></div><button class="toggle ${d.food.noSnack===true?'on':''}" data-toggle-food="noSnack" aria-label="${tr('noSnack')}"></button></div></div>
  <div class="actual-row"><div class="switch-row"><div><div class="actual-label" style="margin:0">${tr('after6')}</div></div><button class="toggle ${d.food.stop6===true?'on':''}" data-toggle-food="stop6" aria-label="${tr('after6')}"></button></div></div>
  <div class="actual-row"><div class="actual-label">${db.language==='zh'?'今天吃到几分饱？':'How full did you eat today?'}</div><div class="chip-row">${sat.map(v=>`<button class="pill ${d.food.satiety!==null && +d.food.satiety===v?'on':''}" data-set-food="satiety" data-value="${v}">${v}</button>`).join('')}</div></div>
  <div class="actual-row"><div class="actual-label">${tr('water')}</div><div class="chip-row">${[1,1.5,2,2.5,3].map(v=>`<button class="pill ${d.food.water!==null && +d.food.water===v?'on':''}" data-set-food="water" data-value="${v}">${v}L</button>`).join('')}</div></div>`;
}
function movementControls(d){
  return `<div class="two"><label>${tr('steps')}<input data-day-field="move.steps" inputmode="numeric" type="number" min="0" value="${d.move.steps??''}" placeholder="10000"></label><label>${tr('cardio')} · ${tr('minutes')}<input data-day-field="move.cardio" inputmode="numeric" type="number" min="0" value="${d.move.cardio??''}" placeholder="0"></label><label>${tr('strength')} · ${tr('minutes')}<input data-day-field="move.strength" inputmode="numeric" type="number" min="0" value="${d.move.strength??''}" placeholder="0"></label><div style="padding-top:26px"><div class="switch-row"><span style="font-size:14px">${tr('stretch')}</span><button class="toggle ${d.move.stretch===true?'on':''}" data-toggle-move="stretch"></button></div></div></div>`;
}

function calendarPage(){
  const base=parseDate(calendarMonth), y=base.getFullYear(), m=base.getMonth();
  const title=db.language==='zh'?`${y}年${m+1}月`:`${T.en.month[m]} ${y}`;
  const first=new Date(y,m,1,12), mondayOffset=(first.getDay()+6)%7;
  const start=new Date(first); start.setDate(first.getDate()-mondayOffset);
  const cells=[];
  for(let i=0;i<42;i++){
    const dt=new Date(start); dt.setDate(start.getDate()+i); const s=iso(dt), d=day(s), food=foodStatus(d), mv=moveStatus(d), pm=plannedMoveStatus(d);
    const current=dt.getMonth()===m; const dots=[];
    if(food.calendarPass) dots.push('<i class="dot food"></i>');
    if(mv.calendarPass) dots.push('<i class="dot move"></i>'); else if(s>today()&&pm.calendarPass) dots.push('<i class="dot move-outline"></i>');
    if(d.events.length) dots.push('<i class="dot event"></i>');
    cells.push(`<button class="day-cell ${!current?'out':''} ${s===selected?'selected':''} ${s===today()?'today':''}" data-date="${s}"><span class="day-number">${dt.getDate()}</span><span class="dots">${dots.join('')}</span></button>`);
  }
  const d=day(selected), food=foodStatus(d), mv=moveStatus(d), pm=plannedMoveStatus(d), wc=weightChange(selected);
  return `${topbar(tr('calendar'))}
    <div class="calendar-head"><button class="month-btn" data-month="-1">‹</button><div class="calendar-title">${title}</div><button class="month-btn" data-month="1">›</button></div>
    <div class="weekdays">${(db.language==='zh'?['一','二','三','四','五','六','日']:['M','T','W','T','F','S','S']).map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="calendar-grid">${cells.join('')}</div>
    <div class="legend"><span><i class="dot food"></i>${tr('food')}</span><span><i class="dot move"></i>${tr('movement')}</span><span><i class="dot event"></i>${tr('special')}</span></div>
    <section class="card soft day-summary">
      <div class="row between"><div><b>${fmtDate(selected)}${selected===today()?(db.language==='zh'?' · 今天':' · Today'):''}</b><div class="small" style="margin-top:3px">${selected>today()?tr('futurePlan'):selected<today()?tr('pastEdit'):tr('today')}</div></div><button class="btn secondary" data-action="openSelected">${tr('openDay')}</button></div>
      <div class="summary-grid" style="margin-top:12px">
        <div class="mini-state"><i class="dot food ${food.calendarPass?'':'outline'}"></i><b>${tr('food')}</b><span>${food.label}</span></div>
        <div class="mini-state"><i class="dot ${selected>today()&&pm.planned?'move-outline':'move'}"></i><b>${tr('movement')}</b><span>${selected>today()&&pm.planned?pm.label:mv.label}</span></div>
        <div class="mini-state"><i class="dot event"></i><b>${tr('special')}</b><span>${d.events.length?escapeHtml(eventLabel(d.events[0])):tr('noRecord')}</span></div>
      </div>
      ${d.weight!=null?`<div class="small" style="margin-top:10px">${tr('fastingWeight')} ${fmt(d.weight)} kg${wc==null?'':` · ${wc>0?'+':''}${wc.toFixed(1)} kg`}</div>`:''}
    </section>`;
}

const EVENTS=[
  {id:'dinner',zh:'Dinner out',en:'Dinner out'},
  {id:'travel',zh:'Travel',en:'Travel'},
  {id:'party',zh:'Party',en:'Party'},
  {id:'flight',zh:'长途飞行',en:'Long flight'},
  {id:'vacation',zh:'度假',en:'Vacation'},
  {id:'poor_sleep',zh:'睡眠不足',en:'Poor sleep'},
  {id:'sick',zh:'身体不适',en:'Sick'}
];
const LEGACY_EVENT_TO_ID={
  'Dinner out':'dinner','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Sick':'sick'
};
function eventId(v){return LEGACY_EVENT_TO_ID[v]||v;}
function eventLabel(v){const id=eventId(v);const e=EVENTS.find(x=>x.id===id);return e?(db.language==='zh'?e.zh:e.en):v;}
function dayPage(){
  const d=day(selected), future=selected>today();
  const title=fmtDate(selected), sub=future?'未来计划':selected===today()?'今天':'补录 / 修改';
  let main='';
  if(future){
    main=`<section class="card"><div class="actual-label">当天计划</div>${futurePlanSummary(d)}${d.planMode==='custom'?'':`<hr class="sep"><div class="actual-label">运动计划（可选）</div>${plannedMoveControls(d)}`}</section>`;
  }else{
    main=`<section class="card blue-soft"><div class="actual-label">早晨记录</div><div class="two"><label>起床空腹体重 · kg<input data-day-field="weight" type="number" step="0.1" inputmode="decimal" value="${d.weight??''}"></label><label>昨晚睡眠 · 小时<input data-day-field="sleep" type="number" step="0.1" inputmode="decimal" value="${d.sleep??''}"></label></div></section><section class="card"><div class="actual-label">实际记录</div>${actualFoodControls(d)}${plannedMoveStatus(d).planned?`<div class="planned-reference">原计划：${escapeHtml(plannedMoveStatus(d).label)}</div>`:''}<hr class="sep"><div class="actual-label">运动</div>${movementControls(d)}</section>`;
  }
  return `${topbar(title,sub,`<button class="btn sky save-top" data-action="saveDay">保存</button>`)}
    <section class="card soft"><div class="actual-label">当天计划类型</div><div class="plan-mode">${[['default','默认'],['flexible','Flexible'],['custom','自定义']].map(([k,l])=>`<button class="${d.planMode===k?'on':''}" data-plan-mode="${k}">${l}</button>`).join('')}</div></section>
    <section class="card"><div class="actual-label">特殊安排</div><div class="life-events">${EVENTS.map(e=>`<button class="event-chip ${d.events.includes(e.id)?'on':''}" data-event="${e.id}">${e.zh}</button>`).join('')}</div><label>自定义安排</label><div class="row"><input id="customEvent" placeholder="例如：朋友晚餐"><button class="btn secondary" data-action="addEvent">添加</button></div></section>
    ${d.planMode==='custom'&&!future?`<section class="card"><div class="actual-label">当天自定义目标</div>${customPlanControls(d)}</section>`:''}
    ${main}
    <section class="card"><label>备注</label><textarea data-day-field="note" rows="3" placeholder="可选">${escapeHtml(d.note)}</textarea></section>
    <button class="btn sky full" data-action="saveDayBottom">完成</button>`;
}
function futurePlanSummary(d){
  if(d.planMode==='custom') return customPlanControls(d);
  const p=dayPlan(d);
  return `<div class="rule-grid"><div class="rule">🥬 蔬菜 ≥ ${p.veg}</div><div class="rule">🍎 水果 ≤ ${p.fruit}</div><div class="rule">${p.noSnack===false?'零食可安排':'不吃零食'}</div><div class="rule ${p.stop==null?'rule-exception':''}">${p.stop==null?'6点规则 · 今日例外':'6点后不吃'}</div><div class="rule">${p.satiety}分饱</div><div class="rule">水 ≥ ${p.water}L</div></div>${d.planMode==='flexible'?`<div class="insight" style="margin-top:12px">Flexible day：特殊安排已经算进计划，不把这一天当成“破功”。</div>`:''}`;
}
function customPlanControls(d){const p=d.customPlan||{};return `<div class="custom-plan"><div class="actual-label">自定义饮食</div><div class="two"><label>蔬菜 ≥<input data-day-field="customPlan.veg" type="number" value="${p.veg??db.plan.veg}"></label><label>水果 ≤<input data-day-field="customPlan.fruit" type="number" value="${p.fruit??db.plan.fruit}"></label><label>饱腹度 ≤<input data-day-field="customPlan.satiety" type="number" value="${p.satiety??db.plan.satiety}"></label><label>水 ≥ L<input data-day-field="customPlan.water" type="number" step="0.1" value="${p.water??db.plan.water}"></label></div><div class="switch-row actual-row"><span>允许零食</span><button class="toggle ${p.noSnack===false?'on':''}" data-toggle-custom="allowSnack"></button></div><label>停止进食时间（留空=不限制）<input data-day-field="customPlan.stop" type="time" value="${p.stop??db.plan.stop}"></label><hr class="sep"><div class="actual-label">自定义运动</div><div class="two"><label>步数<input data-day-field="customPlan.steps" type="number" value="${p.steps??''}" placeholder="10000"></label><label>Cardio · 分钟<input data-day-field="customPlan.cardio" type="number" value="${p.cardio??''}"></label><label>Strength · 分钟<input data-day-field="customPlan.strength" type="number" value="${p.strength??''}"></label><div style="padding-top:26px"><div class="switch-row"><span>Stretch</span><button class="toggle ${p.stretch===true?'on':''}" data-toggle-custom="stretch"></button></div></div></div></div>`; }

function changePage(){
  const series=chartData();
  const ma=movingAverage(today()); const lw=latestWeight(today());
  const desc=lw?`${tr('actualWeight')} ${fmt(lw.weight)} kg · ${tr('sevenAvg')} ${fmt(ma)} kg`:tr('noRecord');
  const w=weekStats();
  return `${topbar(tr('weightChange'))}
    <section class="card">
      <div class="row between"><div><div class="small">${desc}</div></div><div class="small">${tr('goalLine')} ${fmt(db.goal.target)} kg</div></div>
      <div class="legend" style="justify-content:flex-start;margin-top:14px"><span><span style="display:inline-block;width:18px;border-top:2px solid var(--sky);vertical-align:middle;margin-right:6px"></span>${tr('actualWeight')}</span><span><span style="display:inline-block;width:18px;border-top:2px dashed var(--deep);vertical-align:middle;margin-right:6px"></span>${tr('sevenAvg')}</span><span><span style="display:inline-block;width:18px;border-top:1px dashed var(--tan);vertical-align:middle;margin-right:6px"></span>${tr('goalLine')}</span></div>
      <div class="chart-wrap">${renderChart(series)}</div>
      <div class="range-tabs">${[['7','7天'],['30','30天'],['90','90天'],['goal',db.language==='zh'?'当前目标':'Goal']].map(([k,l])=>`<button class="${range===k?'on':''}" data-range="${k}">${l}</button>`).join('')}</div>
    </section>
    <div class="section-title">${tr('todayNote')}</div>
    <div class="insight">${dynamicInsight()}</div>
    <div class="section-title">${db.language==='zh'?'最近变化':'Recent change'}</div>
    <section class="card">${changeSummary()}</section>
    <div class="section-title">${db.language==='zh'?'本周回顾':'Weekly review'}</div>
    <section class="card">
      <div class="week-bars">${weekBars(w)}</div>
      <hr class="sep">
      <div class="small" style="line-height:1.55">${weeklyReviewText()}</div>
    </section>`;
}
function chartData(){
  let a=latestWeights();
  if(range==='7') a=a.slice(-7); else if(range==='30') a=a.slice(-30); else if(range==='90') a=a.slice(-90); else if(range==='goal') a=a.filter(x=>x.date>=db.goal.start && x.date<=db.goal.end);
  return a.map(x=>({date:x.date,weight:+x.weight,avg:movingAverage(x.date)}));
}
function renderChart(data){
  if(data.length<2) return `<div class="empty">${db.language==='zh'?'至少记录两次起床空腹体重后，这里会出现图表。':'Add at least two morning weights to see the chart.'}</div>`;
  const W=340,H=230,L=62,R=12,Tp=28,B=36;
  const vals=data.flatMap(d=>[d.weight,d.avg]).filter(v=>v!=null); vals.push(+db.goal.target);
  let min=Math.floor((Math.min(...vals)-.35)*2)/2, max=Math.ceil((Math.max(...vals)+.35)*2)/2; if(max-min<2){max=min+2;}
  const x=i=>L+(i/(data.length-1))*(W-L-R); const y=v=>Tp+(max-v)/(max-min)*(H-Tp-B);
  const yTicks=5; let grid=''; for(let i=0;i<yTicks;i++){const v=max-i*(max-min)/(yTicks-1), yy=y(v);grid+=`<line class="grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text x="18" y="${yy+3}">${v.toFixed(1)}</text>`;}
  const labelCount=Math.min(4,data.length); let xLabels=''; for(let i=0;i<labelCount;i++){const idx=Math.round(i*(data.length-1)/(labelCount-1||1));xLabels+=`<text x="${x(idx)-10}" y="${H-9}">${fmtDate(data[idx].date,db.language).replace('月','/').replace('日','')}</text>`;}
  const path=k=>data.map((d,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(' ');
  const goalY=y(db.goal.target);
  const points=data.map((d,i)=>`<circle class="point" data-chart-index="${i}" cx="${x(i)}" cy="${y(d.weight)}" r="4.8"></circle>`).join('');
  const last=data[data.length-1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight chart"><text x="4" y="13" class="axis-unit">kg</text>${grid}<line class="axis" x1="${L}" y1="${Tp}" x2="${L}" y2="${H-B}"/><line class="axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/><line class="goal" x1="${L}" y1="${goalY}" x2="${W-R}" y2="${goalY}"/><rect x="${W-79}" y="${goalY-17}" width="68" height="15" rx="7" fill="var(--paper)" opacity=".94"></rect><text x="${W-74}" y="${goalY-6}" style="fill:${COLORS.coral}">${tr('goalLine')} ${fmt(db.goal.target)}</text><path class="actual" d="${path('weight')}"/><path class="smooth" d="${path('avg')}"/>${points}${xLabels}</svg><div id="chartTip" class="tooltip">${chartTipHtml(last)}</div>`;
}
function chartTipHtml(d){
  if(!d) return '';
  const rec=day(d.date); const parts=[];
  if(rec.events.length) parts.push(rec.events.map(eventLabel).join(' · '));
  if(+rec.move.strength>0) parts.push(`${tr('strength')} ${rec.move.strength}${tr('minutes')}`);
  if(+rec.move.cardio>0) parts.push(`${tr('cardio')} ${rec.move.cardio}${tr('minutes')}`);
  if(+rec.move.steps>=db.plan.stepsTarget) parts.push(`${db.plan.stepsTarget.toLocaleString()} ${db.language==='zh'?'步':'steps'}`);
  return `<b>${fmtDate(d.date)}</b><span>${fmt(d.weight)} kg</span><span>${tr('sevenAvg')} ${fmt(d.avg)} kg</span>${parts.length?`<span class="tip-context">${escapeHtml(parts.join(' · '))}</span>`:''}`;
}
function weeklyReviewText(){
  const now=parseDate(today()), offset=(now.getDay()+6)%7, monday=addDays(today(),-offset); const records=[];
  for(let s=monday;s<=today();s=addDays(s,1)) records.push(day(s));
  const logged=records.filter(d=>foodStatus(d).recorded>0); const good=logged.filter(d=>{const f=foodStatus(d);return f.enough&&f.score>=.8;}).length;
  const events=records.reduce((n,d)=>n+d.events.length,0);
  const a=latestWeights(today()).filter(x=>x.date>=monday); const delta=a.length>=2?(a[a.length-1].weight-a[0].weight):null;
  if(db.language==='zh') return `${logged.length?`饮食记录 ${logged.length} 天，其中 ${good} 天整体按计划。`:'本周还没有足够的饮食记录。'} ${events?`有 ${events} 个特殊安排。`:''} ${delta!=null?`本周秤重变化 ${delta>0?'+':''}${delta.toFixed(1)} kg。`:''}先看一周整体，再决定是否调整。`;
  return `${logged.length?`${logged.length} food days logged; ${good} were mostly on plan.`:'Not enough food logs yet.'} ${events?`${events} life event${events>1?'s':''}.`:''} ${delta!=null?`Scale change this week: ${delta>0?'+':''}${delta.toFixed(1)} kg.`:''} Review the whole week before changing the plan.`;
}

function changeSummary(){
  const a=latestWeights(); if(a.length<2)return `<div class="small">${tr('noRecord')}</div>`;
  const last=a[a.length-1], week=a.find(x=>x.date>=addDays(last.date,-7))||a[0]; const diff=last.weight-week.weight;
  const avgNow=movingAverage(last.date), avgOld=movingAverage(addDays(last.date,-7)); const md=(avgNow!=null&&avgOld!=null)?avgNow-avgOld:null;
  return `<div class="metric-row"><div class="metric"><div class="label">${db.language==='zh'?'7天秤重变化':'7-day scale change'}</div><div class="value">${diff>0?'+':''}${diff.toFixed(1)} <span class="small">kg</span></div></div><div class="metric"><div class="label">${db.language==='zh'?'7日平均变化':'7-day avg change'}</div><div class="value">${md==null?'—':`${md>0?'+':''}${md.toFixed(1)}`} <span class="small">kg</span></div></div></div>`;
}

function goalsPage(){
  const lw=latestWeight(today());
  return `${topbar(tr('goals'))}
    <div class="section-title" style="margin-top:2px">${tr('goalJourney')}</div>
    <section class="card soft">
      <div class="row between"><div><div class="brand" style="font-size:18px;letter-spacing:0">${escapeHtml(db.goal.name)}</div><div class="small">${db.goal.start} → ${db.goal.end}</div></div><span class="status active">${tr('active')}</span></div>
      <div class="metric-row" style="margin-top:10px"><div class="metric"><div class="label">${tr('start')}</div><div class="value">${fmt(activeGoalStartWeight())} <span class="small">kg</span></div></div><div class="metric" style="text-align:right"><div class="label">${tr('target')}</div><div class="value">${fmt(db.goal.target)} <span class="small">kg</span></div></div></div>
      <div class="progress"><i style="width:${goalProgress(lw?.weight??db.goal.startWeight)}%"></i></div>
      <button class="btn secondary full" data-action="editGoal">${db.language==='zh'?'编辑当前目标':'Edit current goal'}</button>
    </section>
    <div class="section-title">${tr('pastGoals')}</div>
    <section class="card"><div class="goal-list">${db.goals.length?db.goals.slice().reverse().map(goalHistoryItem).join(''):`<div class="empty">${db.language==='zh'?'还没有过去的目标。':'No past goals yet.'}</div>`}</div></section>`;
}
function goalHistoryItem(g){
  const end=g.endWeight??null; const status=goalStatus(g,end); const labels={reached:tr('reached'),close:tr('close'),ended:tr('ended')};
  const lost=end==null?null:g.startWeight-end;
  const total=g.startWeight-g.target; const achieved=(end!=null&&total>0)?clamp((g.startWeight-end)/total*100,0,100):null;
  const process=[];
  if(g.planDays!=null) process.push(`${db.language==='zh'?'饮食执行':'Food on plan'} ${g.planDays}${db.language==='zh'?'天':' days'}`);
  if(g.strengthMinutes!=null) process.push(`${tr('strength')} ${g.strengthMinutes}${tr('minutes')}`);
  if(g.cardioMinutes!=null) process.push(`${tr('cardio')} ${g.cardioMinutes}${tr('minutes')}`);
  if(g.eventCount) process.push(`${g.eventCount}${db.language==='zh'?'个特殊安排':' life events'}`);
  return `<div class="goal-item"><div class="row between"><div class="name">${escapeHtml(g.name)}</div><span class="status ${status==='reached'?'done':status==='close'?'close':'ended'}">${labels[status]}</span></div><div class="numbers">${fmt(g.startWeight)} → ${fmt(end)} kg <span class="muted">· ${tr('target')} ${fmt(g.target)}</span></div>${achieved!=null?`<div class="progress compact"><i style="width:${achieved}%"></i></div><div class="small">${db.language==='zh'?`完成目标的 ${Math.round(achieved)}%`:`${Math.round(achieved)}% of target change`}</div>`:''}<div class="meta">${g.start} → ${g.ended||g.end}${lost==null?'':` · ${lost>=0?'-':'+'}${Math.abs(lost).toFixed(1)} kg`}${process.length?`<br>${process.join(' · ')}`:''}</div></div>`;
}
function goalStatus(g,end){
  if(g.resultStatus) return g.resultStatus;
  if(end==null) return 'ended';
  if(end<=g.target+.1) return 'reached';
  const start=(g===db.goal||!g.snapshot)?activeGoalStartWeight():+g.startWeight;
  const total=start-g.target, progress=total>0?(start-end)/total:0;
  return progress>=.75?'close':'ended';
}

function goalEditPage(){
  const g=db.goal;
  return `${topbar(db.language==='zh'?'编辑目标':'Edit goal','',`<button class="btn sky save-top" data-action="saveGoal">${tr('save')}</button>`)}
    <section class="card"><label>${db.language==='zh'?'目标名字':'Goal name'}</label><input id="goalName" value="${escapeHtml(g.name)}"><div class="two"><label>${tr('start')} kg<input id="goalStartWeight" type="number" step="0.1" value="${activeGoalStartWeight()}"></label><label>${tr('target')} kg<input id="goalTarget" type="number" step="0.1" value="${g.target}"></label></div><div class="two"><label>${tr('start')}<input id="goalStart" type="date" value="${g.start}"></label><label>${db.language==='zh'?'截止日期':'End date'}<input id="goalEnd" type="date" value="${g.end}"></label></div></section>
    <section class="card"><div class="actual-label">饮食目标</div>${planInputsFood()}</section>
    <section class="card"><div class="actual-label">每周运动目标</div>${planInputsMove()}</section>
    <button class="btn ghost danger full" data-action="archiveGoal">${tr('archive')}</button>`;
}
function planInputsFood(){return `<div class="two"><label>${tr('veg')} ≥<input data-plan="veg" type="number" value="${db.plan.veg}"></label><label>${tr('fruit')} ≤<input data-plan="fruit" type="number" value="${db.plan.fruit}"></label><label>${tr('water')} ≥ L<input data-plan="water" type="number" step="0.1" value="${db.plan.water}"></label><label>${db.language==='zh'?'目标饱腹度':'Satiety target'}<input data-plan="satiety" type="number" value="${db.plan.satiety}"></label></div><label>${db.language==='zh'?'停止进食时间':'Stop eating time'}<input data-plan="stop" type="time" value="${db.plan.stop}"></label>`;}
function planInputsMove(){return `<div class="two"><label>每周1万步达标天数<input data-plan="stepsDays" type="number" value="${db.plan.stepsDays}"></label><label>Stretch 天数<input data-plan="stretchDays" type="number" value="${db.plan.stretchDays}"></label><label>Cardio · 分钟/周<input data-plan="cardio" type="number" value="${db.plan.cardio}"></label><label>Strength · 分钟/周<input data-plan="strength" type="number" value="${db.plan.strength}"></label></div>`;}

function settingsPage(){
  return `${topbar('设置')}
    <section class="settings-list"><button class="setting-row" data-action="editPlan" style="width:100%;border:0;background:#fff;text-align:left"><span>默认目标</span><span class="right">›</span></button><button class="setting-row" data-action="export"><span>导出数据</span><span class="right">JSON ›</span></button><label class="setting-row" style="margin:0"><span>导入数据</span><span class="right">JSON ›</span><input id="importFile" type="file" accept="application/json" style="display:none"></label><div class="setting-row"><span>关于 Tide</span><span class="right">版本 ${VERSION}</span></div></section>
    <div class="insight" style="margin-top:16px">数据保存在这台设备的浏览器中。以后 Tide 升级会自动迁移旧数据；你也可以随时导出 JSON 作为额外备份。</div>`;
}

function planEditPage(){
  return `${topbar('默认目标','',`<button class="btn sky save-top" data-action="savePlan">${tr('save')}</button>`)}<section class="card"><div class="actual-label">饮食目标</div>${planInputsFood()}</section><section class="card"><div class="actual-label">每周运动目标</div>${planInputsMove()}</section><button class="btn sky full" data-action="savePlanBottom">${tr('done')}</button>`;
}

function weekStats(){
  const now=parseDate(today());
  const offset=(now.getDay()+6)%7;
  const monday=addDays(today(),-offset);
  const days=[];
  for(let s=monday;s<=today();s=addDays(s,1)) days.push(day(s));
  return {steps:days.filter(d=>+d.move.steps>=db.plan.stepsTarget).length,stretch:days.filter(d=>d.move.stretch===true).length,cardio:days.reduce((sum,d)=>sum+(+d.move.cardio||0),0),strength:days.reduce((sum,d)=>sum+(+d.move.strength||0),0)};
}
function weekBars(w){
  const rows=[['1万步达标天数',w.steps,db.plan.stepsDays],[tr('stretch'),w.stretch,db.plan.stretchDays],[tr('cardio'),w.cardio,db.plan.cardio],[tr('strength'),w.strength,db.plan.strength]];
  return rows.map(([l,a,b])=>`<div class="week-row"><div class="label-line"><span>${l}</span><b>${a}/${b}</b></div><div class="bar"><i style="width:${clamp((a/(b||1))*100,0,100)}%"></i></div></div>`).join('');
}

function saveInputsFromDOM(){
  const targetDate=view==='today'?today():selected;
  document.querySelectorAll('[data-day-field]').forEach(el=>{
    const path=el.dataset.dayField.split('.'); let obj=day(targetDate);
    for(let i=0;i<path.length-1;i++) obj=obj[path[i]];
    const key=path[path.length-1]; let val=el.value;
    if(el.type==='number') val=val===''?null:+val;
    obj[key]=val;
  });
  document.querySelectorAll('[data-plan]').forEach(el=>{
    let val=el.value; if(el.type==='number')val=val===''?0:+val; db.plan[el.dataset.plan]=val;
  });
}
function setFood(key,val){ day(view==='day'?selected:today()).food[key]=val; save(); }
function toggleFood(key){ const d=day(view==='day'?selected:today()); d.food[key]=d.food[key]===true?false:true; save(); }
function toggleMove(key){ const d=day(view==='day'?selected:today()); d.move[key]=d.move[key]===true?false:true; save(); }
function toggleCustom(key){ const d=day(selected); if(key==='allowSnack') d.customPlan.noSnack=d.customPlan.noSnack===false?true:false; else d.customPlan[key]=d.customPlan[key]===true?false:true; save(); }
function togglePlannedMove(key){ const d=day(selected); d.plannedMove[key]=d.plannedMove[key]===true?false:true; save(); }
function toggleEvent(e){ const d=day(selected); d.events=d.events.includes(e)?d.events.filter(x=>x!==e):[...d.events,e]; save(); }
function shiftMonth(n){ const d=parseDate(calendarMonth); d.setMonth(d.getMonth()+n); calendarMonth=iso(new Date(d.getFullYear(),d.getMonth(),1,12)); selected=calendarMonth; render(); }
function saveGoalForm(){
  const oldStart=db.goal.start;
  const newStart=document.getElementById('goalStart')?.value||db.goal.start;
  db.goal.name=document.getElementById('goalName')?.value.trim()||db.goal.name;
  db.goal.target=+(document.getElementById('goalTarget')?.value||db.goal.target);
  db.goal.start=newStart; db.goal.end=document.getElementById('goalEnd')?.value||db.goal.end;
  const entered=document.getElementById('goalStartWeight')?.value;
  if(entered!==undefined&&entered!=='') { db.goal.startWeight=+entered; day(newStart).weight=+entered; }
  saveInputsFromDOM();
}
function archiveGoal(){
  saveGoalForm();
  const end=latestWeight(today())?.weight??null; const startSnapshot=activeGoalStartWeight(); const status=goalStatus({...db.goal,startWeight:startSnapshot,snapshot:true},end);
  let planDays=0, strengthMinutes=0, cardioMinutes=0, eventCount=0;
  for(let s=db.goal.start;s<=today()&&s<=db.goal.end;s=addDays(s,1)){
    const rec=day(s), fs=foodStatus(rec);
    if(fs.enough&&fs.score>=.8) planDays++;
    strengthMinutes+=(+rec.move.strength||0); cardioMinutes+=(+rec.move.cardio||0); eventCount+=rec.events.length;
  }
  const snapshot={...db.goal,startWeight:startSnapshot,ended:today(),endWeight:end,resultStatus:status,planDays,strengthMinutes,cardioMinutes,eventCount,snapshot:true,schemaVersion:SCHEMA_VERSION}; db.goals.push(snapshot);
  db.goal={name:db.language==='zh'?'新目标':'New goal',start:today(),end:addDays(today(),30),startWeight:end??db.goal.target,target:Math.max(35,(end??db.goal.target)-2),status:'active'};
  view='goals'; save(db.language==='zh'?'当前目标已归档。':'Goal archived.');
}
function exportData(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tide-backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importData(file){
  if(!file)return; const r=new FileReader(); r.onload=()=>{try{db=migrate(JSON.parse(r.result)); persist(); view='today'; flash=db.language==='zh'?'备份已恢复。':'Backup restored.'; render();}catch{alert(db.language==='zh'?'这个备份无法读取。':'This backup could not be read.')}}; r.readAsText(file);
}

function bind(){
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view; render();}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.action;
    if(a==='saveToday'||a==='saveTodayBottom'){saveInputsFromDOM();save(tr('saved'));}
    if(a==='editToday'){selected=today();view='day';render();}
    if(a==='openSelected'){view='day';render();}
    if(a==='saveDay'||a==='saveDayBottom'){saveInputsFromDOM();view='calendar';save(tr('saved'));}
    if(a==='addEvent'){const el=document.getElementById('customEvent');const v=el?.value.trim();if(v){day(selected).events.push(v);save();}}
    if(a==='editGoal'){view='goalEdit';render();}
    if(a==='saveGoal'){saveGoalForm();view='goals';save(tr('saved'));}
    if(a==='archiveGoal'){if(confirm(db.language==='zh'?'结束并归档当前目标？':'End and archive current goal?')) archiveGoal();}
    if(a==='editPlan'){view='planEdit';render();}
    if(a==='savePlan'||a==='savePlanBottom'){saveInputsFromDOM();view='settings';save(tr('saved'));}
    if(a==='export')exportData();
  }));
  document.querySelectorAll('[data-set-food]').forEach(b=>b.addEventListener('click',()=>setFood(b.dataset.setFood,+b.dataset.value)));
  document.querySelectorAll('[data-toggle-food]').forEach(b=>b.addEventListener('click',()=>toggleFood(b.dataset.toggleFood)));
  document.querySelectorAll('[data-toggle-move]').forEach(b=>b.addEventListener('click',()=>toggleMove(b.dataset.toggleMove)));
  document.querySelectorAll('[data-toggle-custom]').forEach(b=>b.addEventListener('click',()=>toggleCustom(b.dataset.toggleCustom)));
  document.querySelectorAll('[data-toggle-planned-move]').forEach(b=>b.addEventListener('click',()=>togglePlannedMove(b.dataset.togglePlannedMove)));
  document.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.date;render();}));
  document.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>shiftMonth(+b.dataset.month)));
  document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>toggleEvent(b.dataset.event)));
  document.querySelectorAll('[data-plan-mode]').forEach(b=>b.addEventListener('click',()=>{day(selected).planMode=b.dataset.planMode;save();}));
  document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=b.dataset.range;render();}));
  document.querySelectorAll('[data-day-field]').forEach(el=>el.addEventListener('change',()=>{saveInputsFromDOM();persist();}));
  document.querySelectorAll('[data-plan]').forEach(el=>el.addEventListener('change',()=>{saveInputsFromDOM();persist();}));
  const f=document.getElementById('importFile'); if(f) f.addEventListener('change',()=>importData(f.files[0]));
  document.querySelectorAll('[data-chart-index]').forEach(p=>{
    const update=()=>{const data=chartData(),i=+p.dataset.chartIndex,d=data[i],tip=document.getElementById('chartTip');if(tip&&d)tip.innerHTML=chartTipHtml(d);};
    p.addEventListener('click',update); p.addEventListener('mouseenter',update); p.addEventListener('touchstart',update,{passive:true});
  });
}

function render(){
  let content='';
  if(view==='today')content=todayPage();
  else if(view==='calendar')content=calendarPage();
  else if(view==='day')content=dayPage();
  else if(view==='change')content=changePage();
  else if(view==='goals')content=goalsPage();
  else if(view==='goalEdit')content=goalEditPage();
  else if(view==='settings')content=settingsPage();
  else if(view==='planEdit')content=planEditPage();
  document.getElementById('app').innerHTML=`<main class="shell">${content}${['today','calendar','change','goals','settings'].includes(view)?nav():''}</main>`;
  bind();
}

document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{}); }
render();
