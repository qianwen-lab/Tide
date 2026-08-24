const STORAGE_KEY = 'tide.v1';
const VERSION = '7.7.0';
const SCHEMA_VERSION = 9;

const COLORS = { sage:'#5E836F', sageDeep:'#244C3E', pink:'#C98994', pinkSoft:'#EBCFD4', blue:'#8C918D', ink:'#1F2823' };
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
const fmtDate = (s, lang='en') => {
  const d=parseDate(s);
  return lang==='zh' ? `${d.getMonth()+1}月${d.getDate()}日` : d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
};
const fmtShortDate = s => { const d=parseDate(s); return `${d.getMonth()+1}/${d.getDate()}`; };
const escapeHtml = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const blankReview = () => ({summary:'',learnings:[],actionItems:[],nextExperiment:'',updatedAt:null}); // legacy v7.4 shape
const normalizeReview = r => ({
  summary:String(r?.summary||''),
  learnings:Array.isArray(r?.learnings)?r.learnings.map(x=>String(x)).filter(Boolean):[],
  actionItems:Array.isArray(r?.actionItems)?r.actionItems.map(x=>String(x)).filter(Boolean):[],
  nextExperiment:String(r?.nextExperiment||''),
  updatedAt:r?.updatedAt||null
});
const asList = v => Array.isArray(v) ? v.map(x=>String(x).trim()).filter(Boolean) : (v==null||v===''?[]:[String(v).trim()]);
const hasLegacyReview = r => !!(r && (String(r.summary||'').trim() || asList(r.learnings).length || asList(r.actionItems).length || String(r.nextExperiment||'').trim()));
function normalizeCheckpoint(r={}, goalStart=''){
  const next=asList(r.next??r.actionItems);
  if(r.nextExperiment && !next.includes(String(r.nextExperiment).trim())) next.push(String(r.nextExperiment).trim());
  const date=String(r.date||r.reviewedAt||r.updatedAt||today()).slice(0,10);
  const dayNum=goalStart ? Math.max(1,Math.floor((parseDate(date)-parseDate(goalStart))/86400000)+1) : (r.day??null);
  return {id:r.id||`review-${date}-${Math.random().toString(36).slice(2,8)}`,date,day:r.day??dayNum,summary:String(r.summary||'').trim(),learnings:asList(r.learnings),next,createdAt:r.createdAt||r.updatedAt||new Date().toISOString()};
}
function normalizeReviews(g={}){
  let rows=Array.isArray(g.reviews)?g.reviews.map(r=>normalizeCheckpoint(r,g.start)):[];
  if(!rows.length && hasLegacyReview(g.review)) rows=[normalizeCheckpoint(g.review,g.start)];
  return rows.filter(r=>r.summary||r.learnings.length||r.next.length).sort((a,b)=>String(a.createdAt||a.date).localeCompare(String(b.createdAt||b.date)));
}
function latestReview(g){ const rows=normalizeReviews(g); return rows.length?rows[rows.length-1]:null; }
const stableGoalId = (g={}, suffix='') => g.id || `goal-${g.start||'na'}-${g.end||'na'}-${String(g.name||'goal').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}${suffix}`;
const newGoalId = () => `goal-${today()}-${Date.now().toString(36)}`;

const defaults = {
  schemaVersion:SCHEMA_VERSION,
  version:SCHEMA_VERSION,
  language:'en',
  goal:{id:`goal-${today()}-active`,name:'Back to 50',start:today(),end:addDays(today(),31),startWeight:52.7,target:50,status:'active',review:blankReview(),reviews:[]},
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
let quickWeightOpen = false;
let reviewGoalId = null;
let reviewDraft = null;

function fresh(){ return JSON.parse(JSON.stringify(defaults)); }
function mergeDay(x={}){
  return {
    date:x.date||today(), weight:x.weight??null, sleep:x.sleep??null,
    events:Array.isArray(x.events)?x.events.filter(e=>!String(e).toLowerCase().includes('period')).map(e=>({'Dinner out':'eating_out','Eating out':'eating_out','dinner':'eating_out','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Sick':'sick'}[e]||e)).filter(e=>e!=='flight'):[],
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
  out.language='en';
  out.goal={...out.goal,...(raw.goal||{})};
  out.goal.id=stableGoalId(out.goal,'-active'); out.goal.review=normalizeReview(out.goal.review); out.goal.reviews=normalizeReviews(out.goal);
  out.plan={...out.plan,...(raw.plan||{}),stepsTarget:10000};
  out.goals=Array.isArray(raw.goals)?raw.goals.map((g,i)=>{const x={...g,id:stableGoalId(g,`-${i}`),review:normalizeReview(g.review),planSnapshot:g.planSnapshot?{...g.planSnapshot}:null,snapshot:true};x.reviews=normalizeReviews(x);return x;}):[];
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
  en:{today:'Today',calendar:'Calendar',change:'Progress',goals:'Goals',settings:'Settings',save:'Save',saved:'Saved',currentGoal:'Current goal',day:'Day',days:'days',currentWeight:'Current weight',goal:'Goal',morning:'Morning log',fastingWeight:'Weight',sleep:'Last night sleep',hours:'hours',todayPlan:"Today's plan",fromGoal:'From your current goal',todayActual:"Today's actual",editable:'Come back and edit anytime',veg:'Vegetables',fruit:'Fruit',noSnack:'No snacks',after6:'No food after 6 PM',satiety:'full',water:'Water',movement:'Exercise',steps:'Steps',stretch:'Stretch',cardio:'Cardio',strength:'Strength',minutes:'min',todayNote:"Today's note",thisWeek:'This week',openDay:'View / edit this day',food:'Food',special:'Special',noRecord:'No record',futurePlan:'Future plan',pastEdit:'Edit past day',defaultPlan:'Default',flexible:'Flexible',custom:'Custom',lifeEvents:'Life events',actualRecord:'Actual record',notes:'Notes',done:'Done',weightChange:'Progress',actualWeight:'Weight',sevenAvg:'7-day avg',goalLine:'Target',recentDays:'Recent days',goalJourney:'Current goal',pastGoals:'Archived goals',reached:'Reached',close:'Nearly reached',ended:'Ended',active:'Active',newGoal:'New goal',archive:'End & archive',start:'Start',target:'Target',language:'Language / 语言',export:'Export backup',import:'Import backup',about:'About Tide',version:'Version',defaultFood:'Default food rules',weeklyMove:'Weekly exercise goals',localFirst:'Data stays in this browser and can be exported as a JSON backup.',month:['January','February','March','April','May','June','July','August','September','October','November','December']}
};
const tr = k => T.en[k] ?? k;

function latestWeights(until=today()){
  return Object.values(db.days).filter(x=>x.weight!=null && x.date<=until).sort((a,b)=>a.date.localeCompare(b.date));
}
function latestWeight(until=today()){ const a=latestWeights(until); return a.length?a[a.length-1]:null; }
function movingAverage(date, window=7){ const from=addDays(date,-(window-1)); const a=latestWeights(date).filter(x=>x.date>=from).map(x=>+x.weight); return avg(a); }
function goalMovingAverage(date, window=7){ const from=addDays(date,-(window-1)); const start=from>db.goal.start?from:db.goal.start; const a=latestWeights(date).filter(x=>x.date>=start && x.date<=date).map(x=>+x.weight); return avg(a); }
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
  if(!recorded) return {recorded:0,score:null,enough:false,calendarPass:false,label:'No record'};
  let pass=0, denom=0;
  if(f.veg!=null){denom++; if(+f.veg>=+p.veg)pass++;}
  if(f.fruit!=null){denom++; if(+f.fruit<=+p.fruit)pass++;}
  if(f.noSnack!=null){denom++; if(p.noSnack===false || f.noSnack===true)pass++;}
  if(p.stop==null){ /* planned exception */ } else if(f.stop6!=null){denom++; if(f.stop6===true)pass++;}
  if(f.satiety!=null){denom++; if(+f.satiety<=+p.satiety)pass++;}
  const score=denom?pass/denom:null;
  const enough=denom>=4;
  const calendarPass=enough && pass>=4 && score>=.8;
  return {recorded,score,enough,calendarPass,label:calendarPass?'Food goal met':enough?(score>=.6?'Mostly on plan':'Off plan'):'Incomplete'};
}
function moveStatus(d){
  const m=d.move; const meaningful=(+m.steps||0)>=10000 || (+m.cardio||0)>0 || (+m.strength||0)>0;
  const any=(+m.steps||0)>0 || m.stretch===true || (+m.cardio||0)>0 || (+m.strength||0)>0;
  if(!any) return {done:false,calendarPass:false,label:'No record'};
  const pieces=[];
  if(+m.steps>=10000) pieces.push('10k steps');
  if(+m.cardio>0) pieces.push(`Cardio ${m.cardio} min`);
  if(+m.strength>0) pieces.push(`Strength ${m.strength} min`);
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
  const pool=[];
  if(tw && prev && (+tw.weight-+prev.weight)>=.5 && a!=null && ay!=null && a<=ay+.15){
    pool.push("The scale jumped. Your plan doesn't need to.","One noisy weigh-in is not a new trend. Stay with the plan.");
  }
  if(a!=null && ay!=null && a<ay-.05){
    pool.push("It's moving down. Don't eat the progress back.","Your trend is moving down. Keep doing the boring things that work.");
  }
  if(events){
    pool.push("Real life is allowed. Turning one event into a whole-day free-for-all is optional.","Eating out is a plan change, not a plan collapse.");
  }
  if(f.score!=null && f.score>=.8){
    pool.push("Good day. You don't need a reward snack for following your own plan.","This is what progress usually looks like: ordinary and consistent.");
  }
  if(!pool.length){
    pool.push("Waiting won't make this easier. Do today's part.","You know how to lose it. The question is whether you'll follow through today.","Future you still has to deal with what today-you postpones.","Less negotiating. More follow-through.","Time keeps moving. Make the trend move with it.");
  }
  return pool[(new Date().getDate()+latestWeights().length)%pool.length];
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
  const d=day(today()), lw=latestWeight(today());
  const startW=activeGoalStartWeight(), current=lw?.weight??startW, progress=goalProgress(current), dayNum=dayIndexInGoal(today()), total=goalDuration();
  const food=foodStatus(d), move=moveStatus(d), events=d.events.length;
  const remaining=Math.max(0,(+current)-(+db.goal.target));
  const daysLeft=Math.max(0,Math.ceil((parseDate(db.goal.end)-parseDate(today()))/86400000));
  const foodDone=food.calendarPass, moveDone=move.calendarPass;
  const lifeDone=events>0;
  return `${topbar(`Today · ${fmtDate(today(),'en')}`)}
  ${flashHtml()}
  <section class="today-goal-card">
    <div class="row between"><div><div class="eyebrow">Current goal</div><div class="today-goal-name">${escapeHtml(db.goal.name)}</div></div><span class="status active">Active</span></div>
    <div class="today-goal-line"><i style="width:${progress}%"></i></div>
    <div class="today-goal-metrics"><div><span>Current</span><b>${fmt(current)}</b><em>kg</em></div><div><span>Target</span><b>${fmt(db.goal.target)}</b><em>kg</em></div><div><span>Goal date</span><b class="date-value">${fmtDate(db.goal.end)}</b></div></div>
  </section>
  <button class="quick-weight-card ${d.weight==null?'empty-weight':''}" data-action="quickWeight">
    <div><div class="quick-weight-label">Morning weight</div><div class="quick-weight-value">${d.weight==null?'Log morning weight':`${fmt(d.weight)} <span>kg</span>`}</div></div>
    <div class="quick-weight-action">${d.weight==null?'Log now':'Edit'} ›</div>
  </button>
  <section class="today-reminder"><div class="reminder-label">Today's note</div><div class="reminder-copy">${dynamicInsight()}</div></section>
  <section class="today-summary-grid">
    <button class="summary-tile green" data-action="editToday"><div class="summary-label">Food</div><div class="summary-value">${foodDone?'On plan':food.recorded?'In progress':'Not logged'}</div><span class="summary-dot ${foodDone?'done':''}"></span></button>
    <button class="summary-tile pink" data-action="editToday"><div class="summary-label">Exercise</div><div class="summary-value">${moveDone?'Goal met':move.done?'Logged':'Not logged'}</div><span class="summary-dot ${moveDone?'done':''}"></span></button>
    <button class="summary-tile green-soft" data-action="editToday"><div class="summary-label">Life</div><div class="summary-value">${events?`${events} event${events>1?'s':''}`:'No special events'}</div><span class="summary-dot ${lifeDone?'done':''}"></span></button>
  </section>
  <section class="today-progress-card">
    <div class="progress-stat"><div class="big-stat">${(startW-current)>=0?'-':''}${Math.abs(startW-current).toFixed(1)}</div><div class="stat-caption">kg lost</div></div>
    <div class="goal-ring" style="--p:${progress}"><div><b>${Math.round(progress)}%</b><span>complete</span></div></div>
    <div class="progress-stat right"><div class="big-stat">${daysLeft}</div><div class="stat-caption">days left</div><div class="tiny-remaining">${remaining.toFixed(1)} kg to go</div></div>
  </section>
  <button class="today-edit-button" data-action="editToday">View / edit today</button>`;
}
function todayPlanChips(d){
  const p=dayPlan(d); const chips=[`Vegetables ≥ ${p.veg}`,`Fruit ≤ ${p.fruit}`,p.noSnack===false?'Snacks allowed':'No snacks',p.stop==null?'Eating cutoff paused':'No food after 6 PM',`Satiety ≤ ${p.satiety}/10`,`Water ≥ ${p.water}L`];
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
  {id:'eating_out',zh:'Eating out',en:'Eating out'},
  {id:'travel',zh:'Travel',en:'Travel'},
  {id:'party',zh:'Party',en:'Party'},
  {id:'vacation',zh:'Vacation',en:'Vacation'},
  {id:'poor_sleep',zh:'Poor sleep',en:'Poor sleep'},
  {id:'sick',zh:'Sick',en:'Sick'}
];
const LEGACY_EVENT_TO_ID={
  'Dinner out':'eating_out','Eating out':'eating_out','dinner':'eating_out','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Sick':'sick'
};
function eventId(v){return LEGACY_EVENT_TO_ID[v]||v;}
function eventLabel(v){const id=eventId(v);const e=EVENTS.find(x=>x.id===id);return e?(db.language==='zh'?e.zh:e.en):v;}
function dayPage(){
  const d=day(selected), future=selected>today();
  const title=fmtDate(selected,'en'), sub=future?'Future plan':selected===today()?'Today':'Edit past day';
  let main='';
  if(future){
    main=`<section class="card"><div class="actual-label">Day plan</div>${futurePlanSummary(d)}${d.planMode==='custom'?'':`<hr class="sep"><div class="actual-label">Exercise plan (optional)</div>${plannedMoveControls(d)}`}</section>`;
  }else{
    main=`<section class="card blue-soft"><div class="actual-label">Morning log</div><div class="two"><label>Weight · kg<input data-day-field="weight" type="number" step="0.1" inputmode="decimal" value="${d.weight??''}"></label><label>Last night's sleep · hours<input data-day-field="sleep" type="number" step="0.1" inputmode="decimal" value="${d.sleep??''}"></label></div></section><section class="card"><div class="actual-label">Actual</div>${actualFoodControls(d)}${plannedMoveStatus(d).planned?`<div class="planned-reference">Planned: ${escapeHtml(plannedMoveStatus(d).label)}</div>`:''}<hr class="sep"><div class="actual-label">Exercise</div>${movementControls(d)}</section>`;
  }
  return `${topbar(title,sub,`<button class="btn sky save-top" data-action="saveDay">Save</button>`)}
    <section class="card soft"><div class="actual-label">Plan type</div><div class="plan-mode">${[['default','Default'],['flexible','Flexible'],['custom','Custom']].map(([k,l])=>`<button class="${d.planMode===k?'on':''}" data-plan-mode="${k}">${l}</button>`).join('')}</div></section>
    <section class="card"><div class="actual-label">Life events</div><div class="life-events">${EVENTS.map(e=>`<button class="event-chip ${d.events.includes(e.id)?'on':''}" data-event="${e.id}">${e.en}</button>`).join('')}</div><label>Custom event</label><div class="row"><input id="customEvent" placeholder="e.g. Eating out with friends"><button class="btn secondary" data-action="addEvent">Add</button></div></section>
    ${d.planMode==='custom'&&!future?`<section class="card"><div class="actual-label">Custom goals for this day</div>${customPlanControls(d)}</section>`:''}
    ${main}
    <section class="card"><label>Notes</label><textarea data-day-field="note" rows="3" placeholder="Optional">${escapeHtml(d.note)}</textarea></section>
    <button class="btn sky full" data-action="saveDayBottom">Done</button>`;
}
function futurePlanSummary(d){
  if(d.planMode==='custom') return customPlanControls(d);
  const p=dayPlan(d);
  return `<div class="rule-grid"><div class="rule">Vegetables ≥ ${p.veg}</div><div class="rule">Fruit ≤ ${p.fruit}</div><div class="rule">${p.noSnack===false?'Snacks allowed':'No snacks'}</div><div class="rule ${p.stop==null?'rule-exception':''}">${p.stop==null?'Eating cutoff paused':'No food after 6 PM'}</div><div class="rule">Satiety ≤ ${p.satiety}/10</div><div class="rule">Water ≥ ${p.water}L</div></div>${d.planMode==='flexible'?`<div class="insight" style="margin-top:12px">Flexible day: the exception is already part of the plan. It is not a failed day.</div>`:''}`;
}
function customPlanControls(d){const p=d.customPlan||{};return `<div class="custom-plan"><div class="actual-label">Custom food goals</div><div class="two"><label>Vegetables ≥<input data-day-field="customPlan.veg" type="number" value="${p.veg??db.plan.veg}"></label><label>Fruit ≤<input data-day-field="customPlan.fruit" type="number" value="${p.fruit??db.plan.fruit}"></label><label>Satiety ≤<input data-day-field="customPlan.satiety" type="number" value="${p.satiety??db.plan.satiety}"></label><label>Water ≥ L<input data-day-field="customPlan.water" type="number" step="0.1" value="${p.water??db.plan.water}"></label></div><div class="switch-row actual-row"><span>Allow snacks</span><button class="toggle ${p.noSnack===false?'on':''}" data-toggle-custom="allowSnack"></button></div><label>Stop eating time (blank = no cutoff)<input data-day-field="customPlan.stop" type="time" value="${p.stop??db.plan.stop}"></label><hr class="sep"><div class="actual-label">Custom exercise</div><div class="two"><label>Steps<input data-day-field="customPlan.steps" type="number" value="${p.steps??''}" placeholder="10000"></label><label>Cardio · min<input data-day-field="customPlan.cardio" type="number" value="${p.cardio??''}"></label><label>Strength · min<input data-day-field="customPlan.strength" type="number" value="${p.strength??''}"></label><div style="padding-top:26px"><div class="switch-row"><span>Stretch</span><button class="toggle ${p.stretch===true?'on':''}" data-toggle-custom="stretch"></button></div></div></div></div>`; }

function goalForecast(){
  const records=latestWeights(db.goal.end).filter(x=>x.date>=db.goal.start && x.date<=today());
  if(records.length<4) return {ready:false,reason:'Log at least 4 weights before forecasting begins.'};

  // INTERNAL smoothing only: use a calendar-based 7-day mean so one noisy weigh-in does not drive the projection.
  // It is no longer shown as a separate chart line.
  let trend=records.map(r=>({date:r.date,value:goalMovingAverage(r.date)??+r.weight}));
  if(trend[0].date>db.goal.start){
    trend.unshift({date:db.goal.start,value:activeGoalStartWeight()});
  } else if(trend[0].date===db.goal.start){
    trend[0].value=activeGoalStartWeight();
  }
  const last=trend[trend.length-1];

  // Estimate the CURRENT pace from the recent smoothed trajectory, not raw daily weight.
  const recentStart=addDays(last.date,-14);
  let usable=trend.filter(r=>r.date>=recentStart);
  if(usable.length<4) usable=trend.slice(-8);
  if(usable.length<4) return {ready:false,reason:'The data window is still too short. Keep logging for a few more days.'};
  const x0=parseDate(usable[0].date);
  const xs=usable.map(r=>(parseDate(r.date)-x0)/86400000);
  const ys=usable.map(r=>+r.value);
  const mx=avg(xs), my=avg(ys), denom=xs.reduce((a,x)=>a+(x-mx)**2,0);
  if(!denom) return {ready:false,reason:'The data window is still too short. Keep logging for a few more days.'};
  let slope=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/denom;
  slope=clamp(slope,-0.18,0.10);

  // Future projection is anchored to today's smoothed trajectory and lets the current pace fade over time.
  // This prevents an unrealistically straight, indefinitely fast weight-loss line.
  const current=+last.value;
  const startValue=activeGoalStartWeight();
  const elapsed=Math.max(1,Math.round((parseDate(last.date)-parseDate(db.goal.start))/86400000));
  const overallSlope=(current-startValue)/elapsed;
  const daysToEnd=Math.max(0,Math.round((parseDate(db.goal.end)-parseDate(last.date))/86400000));
  const damping=0.035;
  const forecastValue=(days)=>current + slope*(1-Math.exp(-damping*Math.max(0,days)))/damping;
  const projectedEnd=forecastValue(daysToEnd);

  // Back-trace for the DISPLAYED pink trajectory: a cubic Hermite curve anchored to the
  // actual goal-start weight and today's smoothed state, with today's recent slope as the end tangent.
  // This makes the past and future one continuous arc without exposing the 7-day-average line itself.
  const backcastValue=(daysFromStart)=>{
    const u=clamp(daysFromStart/elapsed,0,1), u2=u*u, u3=u2*u;
    const h00=2*u3-3*u2+1, h10=u3-2*u2+u, h01=-2*u3+3*u2, h11=u3-u2;
    return h00*startValue + h10*elapsed*overallSlope + h01*current + h11*elapsed*slope;
  };

  let targetDate=null, deltaDays=null;
  if(current<=+db.goal.target){
    targetDate=last.date;
  } else if(slope<-.005){
    for(let d=1;d<=365;d++){
      if(forecastValue(d)<=+db.goal.target){ targetDate=addDays(last.date,d); break; }
    }
  }
  if(targetDate) deltaDays=Math.round((parseDate(targetDate)-parseDate(db.goal.end))/86400000);
  return {ready:true,slope,current,startValue,elapsed,lastDate:last.date,projectedEnd,targetDate,deltaDays,damping,forecastValue,backcastValue,trendWindowStart:usable[0].date,trendPoints:usable.length};
}
function forecastMessage(f){
  if(!f.ready) return f.reason;
  if(f.targetDate){
    if(f.deltaDays<=-1) return `${Math.abs(f.deltaDays)} days ahead of pace.`;
    if(f.deltaDays>=1) return `${f.deltaDays} days behind pace.`;
    return 'Right on pace.';
  }
  if(f.slope>=-.005) return 'Goal date is still unclear. Keep logging.';
  return 'A few more weigh-ins will steady the forecast.';
}

function changePage(){
  const series=chartData();
  const lw=latestWeight(today()); const f=goalForecast();
  const desc=lw?`${tr('actualWeight')} ${fmt(lw.weight)} kg`:tr('noRecord');
  const w=weekStats();
  return `${topbar(tr('weightChange'))}
    <section class="card change-goal-card">
      <div class="row between"><div><b>${escapeHtml(db.goal.name)}</b><div class="small">${fmtDate(db.goal.start)} → ${fmtDate(db.goal.end)}</div></div><div class="small">${tr('goalLine')} ${fmt(db.goal.target)} kg</div></div>
      <div class="small" style="margin-top:8px">${desc}</div>
      <div class="legend" style="justify-content:flex-start;margin-top:13px"><span><span class="legend-line actual-line"></span>${tr('actualWeight')}</span><span><span class="legend-line goal-line"></span>${tr('goalLine')}</span><span><span class="legend-line forecast-line"></span>Forecast</span></div>
      <div class="chart-wrap">${renderChart(series,f)}</div>
    </section>
    <section class="forecast-grid compact-forecast">
      <div class="forecast-card pink"><div class="small">By ${fmtDate(db.goal.end,'en')}</div><div class="forecast-value">${f.ready?fmt(f.projectedEnd):'—'} <span>kg</span></div></div>
      <div class="forecast-card green"><div class="small">Reach ${fmt(db.goal.target)}</div><div class="forecast-text">${f.ready&&f.targetDate?fmtDate(f.targetDate,'en'):'Keep logging'}</div></div>
    </section>
    <div class="insight forecast-insight">${forecastMessage(f)}</div>
    <div class="section-title">${tr('todayNote')}</div>
    <div class="insight">${dynamicInsight()}</div>
    <div class="section-title">${db.language==='zh'?'本周回顾':'Weekly review'}</div>
    <section class="card"><div class="week-bars">${weekBars(w)}</div><hr class="sep"><div class="small" style="line-height:1.55">${weeklyReviewText()}</div></section>`;
}
function chartData(){
  // Change is a goal-centric view: existing data begins at goal start and the chart always ends at goal end.
  return latestWeights(db.goal.end).filter(x=>x.date>=db.goal.start && x.date<=today()).map(x=>({date:x.date,weight:+x.weight,avg:goalMovingAverage(x.date)}));
}
function smoothSvgPath(points){
  if(!points.length) return '';
  if(points.length===1) return `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  if(points.length===2) return `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} L ${points[1][0].toFixed(1)} ${points[1][1].toFixed(1)}`;
  let d=`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  const tension=.16;
  for(let i=0;i<points.length-1;i++){
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
    const c1=[p1[0]+(p2[0]-p0[0])*tension,p1[1]+(p2[1]-p0[1])*tension];
    const c2=[p2[0]-(p3[0]-p1[0])*tension,p2[1]-(p3[1]-p1[1])*tension];
    d+=` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function renderChart(data,forecast){
  if(data.length<2) return `<div class="empty">Log at least two weights to see the chart.</div>`;
  const W=340,H=238,L=48,R=12,Tp=25,B=37;
  const last=data[data.length-1], lastDate=last.date;
  const vals=data.map(d=>d.weight).filter(v=>v!=null); vals.push(+db.goal.target);
  if(forecast?.ready){
    vals.push(forecast.projectedEnd);
    const pastSamples=Math.min(20,Math.max(6,forecast.elapsed+1));
    for(let i=0;i<pastSamples;i++) vals.push(forecast.backcastValue(forecast.elapsed*i/(pastSamples-1)));
  }
  let min=Math.floor(Math.min(...vals)-.35), max=Math.ceil(Math.max(...vals)+.35); if(max-min<3){min-=1;max+=1;}
  const span=max-min, tickStep=span<=6?1:2;
  const startD=parseDate(db.goal.start), endD=parseDate(db.goal.end), totalDays=Math.max(1,(endD-startD)/86400000);
  const xDate=date=>L+clamp((parseDate(date)-startD)/86400000/totalDays,0,1)*(W-L-R);
  const y=v=>Tp+(max-v)/(max-min)*(H-Tp-B);
  let grid='';
  for(let v=Math.ceil(min/tickStep)*tickStep;v<=max+.001;v+=tickStep){const yy=y(v);grid+=`<line class="grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><line class="tick" x1="${L-4}" y1="${yy}" x2="${L}" y2="${yy}"/><text class="y-label" x="${L-9}" y="${yy+3}" text-anchor="end">${v}</text>`;}
  const labelCount=Math.min(7,Math.max(5,Math.ceil(totalDays/6)+1));
  const xDates=[]; for(let i=0;i<labelCount;i++){const off=Math.round(totalDays*i/(labelCount-1));const ds=addDays(db.goal.start,off);if(!xDates.includes(ds))xDates.push(ds);}
  const xLabels=xDates.map((s,i)=>`<text x="${xDate(s)}" y="${H-9}" text-anchor="${i===0?'start':i===xDates.length-1?'end':'middle'}">${fmtShortDate(s)}</text>`).join('');
  const actualPath=data.map((d,i)=>`${i?'L':'M'} ${xDate(d.date).toFixed(1)} ${y(d.weight).toFixed(1)}`).join(' ');
  const goalY=y(+db.goal.target);
  const points=data.map((d,i)=>`<circle class="point" data-chart-index="${i}" cx="${xDate(d.date)}" cy="${y(d.weight)}" r="2"></circle>`).join('');

  // One pink trajectory from goal start through today and on to goal end.
  // Historical section uses the internal smoothed trend; future section uses the damped projection.
  let projectionPath='';
  if(forecast?.ready){
    const trajectory=[];
    const anchorDate=forecast.lastDate;
    const pastCount=Math.min(20,Math.max(6,forecast.elapsed+1));
    for(let i=0;i<pastCount;i++){
      const d=Math.round(forecast.elapsed*i/(pastCount-1));
      trajectory.push({date:addDays(db.goal.start,d),value:forecast.backcastValue(d)});
    }
    const horizon=Math.max(0,Math.round((parseDate(db.goal.end)-parseDate(anchorDate))/86400000));
    const step=Math.max(1,Math.round(horizon/14));
    for(let d=step;d<=horizon;d+=step) trajectory.push({date:addDays(anchorDate,d),value:forecast.forecastValue(d)});
    if(horizon>0 && trajectory[trajectory.length-1]?.date!==db.goal.end) trajectory.push({date:db.goal.end,value:forecast.projectedEnd});
    const pts=trajectory.filter((p,i,a)=>i===0||p.date!==a[i-1].date).map(p=>[xDate(p.date),y(p.value)]);
    projectionPath=`<path class="forecast" d="${smoothSvgPath(pts)}"/>`;
  }
  const guideX=xDate(lastDate);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Current goal weight chart"><text x="4" y="13" class="axis-unit">kg</text>${grid}<line class="axis" x1="${L}" y1="${Tp}" x2="${L}" y2="${H-B}"/><line class="axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/><line class="goal" x1="${L}" y1="${goalY}" x2="${W-R}" y2="${goalY}"/><line id="chartGuide" class="guide" x1="${guideX}" y1="${Tp}" x2="${guideX}" y2="${H-B}"/>${projectionPath}<path class="actual" d="${actualPath}"/>${points}${xLabels}</svg><div id="chartTip" class="tooltip">${chartTipHtml(last)}</div>`;
}
function chartTipHtml(d){
  if(!d) return '';
  return `<b>${fmtShortDate(d.date)}</b><span>${fmt(d.weight)} kg</span>`;
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

function reviewCarryCard(){
  let source=db.goal, r=latestReview(db.goal), active=true;
  if(!r){
    const g=[...db.goals].reverse().find(x=>latestReview(x));
    if(g){source=g;r=latestReview(g);active=false;}
  }
  if(!r) return '';
  const learn=r.learnings.slice(0,2), next=r.next.slice(0,2);
  return `<section class="card review-carry"><div class="row between"><div class="actual-label">${active?'Latest checkpoint':'From your last goal'}</div><div class="small">${fmtShortDate(r.date)}${r.day?` · Day ${r.day}`:''}</div></div>${r.summary?`<div class="review-mini-summary">${escapeHtml(r.summary)}</div>`:''}${learn.length?`<div class="review-mini-block"><b>Learning</b><ul>${learn.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}${next.length?`<div class="review-mini-block"><b>Next</b><ul>${next.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}</section>`;
}
function activeGoalLearning(){
  const r=latestReview(db.goal); if(!r) return '';
  const learning=r.learnings[0]||r.summary||'', next=r.next[0]||'';
  if(!learning&&!next) return '';
  return `<div class="active-learning"><div class="row between"><b>Latest learning</b><span class="small">${fmtShortDate(r.date)}${r.day?` · Day ${r.day}`:''}</span></div>${learning?`<div class="active-learning-text">${escapeHtml(learning)}</div>`:''}${next?`<div class="active-next"><span>Next</span>${escapeHtml(next)}</div>`:''}</div>`;
}

function goalsPage(){
  const lw=latestWeight(today());
  return `${topbar(tr('goals'))}
    ${flashHtml()}
    <div class="section-title" style="margin-top:2px">${tr('goalJourney')}</div>
    <section class="card soft">
      <div class="row between"><div><div class="brand" style="font-size:18px;letter-spacing:0">${escapeHtml(db.goal.name)}</div><div class="small">${db.goal.start} → ${db.goal.end}</div></div><span class="status active">${tr('active')}</span></div>
      <div class="metric-row" style="margin-top:10px"><div class="metric"><div class="label">${tr('start')}</div><div class="value">${fmt(activeGoalStartWeight())} <span class="small">kg</span></div></div><div class="metric" style="text-align:right"><div class="label">${tr('target')}</div><div class="value">${fmt(db.goal.target)} <span class="small">kg</span></div></div></div>
      <div class="progress"><i style="width:${goalProgress(lw?.weight??db.goal.startWeight)}%"></i></div>
      <div class="goal-actions"><button class="btn secondary" data-action="editGoal">Edit goal</button><button class="btn ghost" data-review-goal="${escapeHtml(db.goal.id)}">Review goal</button></div>
      ${activeGoalLearning()}
    </section>
    <div class="section-title">${tr('pastGoals')}</div>
    <section class="card"><div class="goal-list">${db.goals.length?db.goals.slice().reverse().map(goalHistoryItem).join(''):`<div class="empty">No past goals yet.</div>`}</div></section>`;
}
function goalHistoryItem(g){
  const end=g.endWeight??null; const status=goalStatus(g,end); const labels={reached:tr('reached'),close:tr('close'),ended:tr('ended')};
  const lost=end==null?null:g.startWeight-end;
  const total=g.startWeight-g.target; const achieved=(end!=null&&total>0)?clamp((g.startWeight-end)/total*100,0,100):null;
  const process=[];
  if(g.planDays!=null) process.push(`Food on plan ${g.planDays} days`);
  if(g.strengthMinutes!=null) process.push(`${tr('strength')} ${g.strengthMinutes}${tr('minutes')}`);
  if(g.cardioMinutes!=null) process.push(`${tr('cardio')} ${g.cardioMinutes}${tr('minutes')}`);
  if(g.eventCount) process.push(`${g.eventCount} life events`);
  const reviewCount=normalizeReviews(g).length;
  return `<div class="goal-item"><div class="row between"><div class="name">${escapeHtml(g.name)}</div><span class="status ${status==='reached'?'done':status==='close'?'close':'ended'}">${labels[status]}</span></div><div class="numbers">${fmt(g.startWeight)} → ${fmt(end)} kg <span class="muted">· target ${fmt(g.target)}</span></div>${achieved!=null?`<div class="progress compact"><i style="width:${achieved}%"></i></div><div class="small">${Math.round(achieved)}% of target change</div>`:''}<div class="meta">${g.start} → ${g.ended||g.end}${lost==null?'':` · ${lost>=0?'-':'+'}${Math.abs(lost).toFixed(1)} kg`}${process.length?`<br>${process.join(' · ')}`:''}</div><button class="review-link" data-review-goal="${escapeHtml(g.id)}">${reviewCount?`Review history · ${reviewCount}`:'Goal review'}</button></div>`;
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
    <section class="card"><div class="actual-label">Food goals</div>${planInputsFood()}</section>
    <section class="card"><div class="actual-label">Weekly exercise goals</div>${planInputsMove()}</section>
    <button class="btn ghost danger full" data-action="archiveGoal">${tr('archive')}</button>`;
}
function planInputsFood(){return `<div class="two"><label>${tr('veg')} ≥<input data-plan="veg" type="number" value="${db.plan.veg}"></label><label>${tr('fruit')} ≤<input data-plan="fruit" type="number" value="${db.plan.fruit}"></label><label>${tr('water')} ≥ L<input data-plan="water" type="number" step="0.1" value="${db.plan.water}"></label><label>${db.language==='zh'?'目标饱腹度':'Satiety target'}<input data-plan="satiety" type="number" value="${db.plan.satiety}"></label></div><label>${db.language==='zh'?'停止进食时间':'Stop eating time'}<input data-plan="stop" type="time" value="${db.plan.stop}"></label>`;}
function planInputsMove(){return `<div class="two"><label>10k-step days / week<input data-plan="stepsDays" type="number" value="${db.plan.stepsDays}"></label><label>Stretch days / week<input data-plan="stretchDays" type="number" value="${db.plan.stretchDays}"></label><label>Cardio · min/week<input data-plan="cardio" type="number" value="${db.plan.cardio}"></label><label>Strength · min/week<input data-plan="strength" type="number" value="${db.plan.strength}"></label></div>`;}


function findGoalById(id){
  if(db.goal?.id===id) return db.goal;
  return db.goals.find(g=>g.id===id)||null;
}
function goalAverageFor(g,date,window=7){
  const rows=latestWeights(date).filter(x=>x.date>=g.start && x.date<=date).slice(-window).map(x=>+x.weight);
  return avg(rows);
}
function goalReviewPack(g){
  const active=g===db.goal || !g.snapshot;
  const through=active ? (today()<g.end?today():g.end) : (g.ended||g.end);
  const records=[];
  for(let s=g.start;s<=through;s=addDays(s,1)){
    const rec=day(s), fs=foodStatus(rec);
    const hasData=rec.weight!=null || rec.sleep!=null || fs.recorded>0 || Object.values(rec.move||{}).some(v=>v!==null&&v!==false) || rec.events.length || rec.note;
    if(!hasData) continue;
    records.push({date:s,weight:rec.weight,sevenDayAverage:goalAverageFor(g,s),sleepHours:rec.sleep,food:{...rec.food},exercise:{...rec.move},lifeEvents:rec.events.map(eventLabel),note:rec.note||''});
  }
  const endWeight=active ? latestWeight(through)?.weight??null : g.endWeight??null;
  const startWeight=active ? activeGoalStartWeight() : +g.startWeight;
  return {
    tideGoalReviewVersion:2,
    goalId:g.id,
    exportedAt:new Date().toISOString(),
    goal:{name:g.name,start:g.start,end:g.end,startWeight,targetWeight:+g.target,currentOrEndWeight:endWeight,status:active?'active':goalStatus(g,endWeight)},
    plan:{...(g.planSnapshot||db.plan)},
    planWasFrozenAtArchive:!!g.planSnapshot,
    summary:{daysCovered:records.length,weightChange:endWeight==null?null:+(endWeight-startWeight).toFixed(2),targetChange:+(+g.target-startWeight).toFixed(2)},
    reviewHistory:normalizeReviews(g),
    daily:records,
    recommendedPrompt:'Review this Tide goal briefly and practically. Focus on the most useful patterns, including lagged/multi-day patterns rather than blaming a morning weight on an event from the same day. Keep it concise. Reply directly in chat with ONE JSON code block that I can copy and paste into Tide; do not create a downloadable file. Use goalId, summary, learnings (1-3 short items), and next (1-3 specific actions). You may add extra concise fields if something important stands out; Tide will ignore fields it does not use.',
    chatgptReturnExample:{goalId:g.id,summary:'1-3 concise sentences',learnings:['short learning 1','short learning 2'],next:['specific next action 1','specific next action 2']}
  };
}
function downloadJSON(obj,name){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportGoalReviewData(g){
  if(!g) return;
  downloadJSON(goalReviewPack(g),`tide-goal-${String(g.name||'goal').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${g.start}.json`);
}
function checkpointHtml(r){
  return `<div class="checkpoint"><div class="row between"><b>${fmtShortDate(r.date)}</b><span class="small">${r.day?`Day ${r.day}`:''}</span></div>${r.summary?`<p>${escapeHtml(r.summary)}</p>`:''}${r.learnings.length?`<div class="checkpoint-block"><span>Learnings</span><ul>${r.learnings.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}${r.next.length?`<div class="checkpoint-block"><span>Next</span><ul>${r.next.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}</div>`;
}
function goalReviewPage(){
  const g=findGoalById(reviewGoalId); if(!g) return `${topbar('Goal Review','',`<button class="btn ghost" data-action="backGoals">Done</button>`)}<div class="empty">Goal not found.</div>`;
  const active=g===db.goal || !g.snapshot, end=active?(latestWeight(today())?.weight??activeGoalStartWeight()):(g.endWeight??null), start=active?activeGoalStartWeight():+g.startWeight;
  const status=active?'Active':({reached:'Reached',close:'Nearly reached',ended:'Ended'}[goalStatus(g,end)]||'Ended');
  const rows=normalizeReviews(g).slice().reverse();
  const draft=reviewDraft?.goalId===g.id?reviewDraft:null;
  return `${topbar('Goal Review','',`<button class="btn ghost" data-action="backGoals">Done</button>`)}
    ${flashHtml()}
    <section class="card soft review-summary"><div class="row between"><div><b>${escapeHtml(g.name)}</b><div class="small">${fmtShortDate(g.start)} → ${fmtShortDate(active?g.end:(g.ended||g.end))}</div></div><span class="status ${active?'active':goalStatus(g,end)==='reached'?'done':goalStatus(g,end)==='close'?'close':'ended'}">${status}</span></div><div class="review-metrics"><div><span>Start</span><b>${fmt(start)} kg</b></div><div><span>${active?'Current':'End'}</span><b>${fmt(end)} kg</b></div><div><span>Target</span><b>${fmt(g.target)} kg</b></div></div></section>
    <section class="card"><div class="actual-label">ChatGPT check-in</div><p class="small review-copy"><b>1.</b> Export goal data and upload it to ChatGPT. <b>2.</b> Ask ChatGPT to follow the prompt inside the file. <b>3.</b> Copy its JSON code block and paste it here.</p><div class="review-actions"><button class="btn secondary" data-action="exportReviewGoal">Export Goal Data</button></div><label class="review-paste-label">Paste review<textarea id="reviewPaste" rows="6" placeholder='{"summary":"...","learnings":["..."],"next":["..."]}'>${escapeHtml(draft?.rawText||'')}</textarea></label><button class="btn secondary full" data-action="previewGoalReview">Preview review</button></section>
    ${draft?`<section class="card review-preview"><div class="row between"><div class="actual-label" style="margin:0">Ready to save</div><span class="small">Review the result first</span></div>${draft.checkpoint.summary?`<p>${escapeHtml(draft.checkpoint.summary)}</p>`:''}${draft.checkpoint.learnings.length?`<div class="checkpoint-block"><span>Learnings</span><ul>${draft.checkpoint.learnings.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}${draft.checkpoint.next.length?`<div class="checkpoint-block"><span>Next</span><ul>${draft.checkpoint.next.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}<button class="btn sky full review-save-final" data-action="saveGoalReviewDraft">Save Review</button></section>`:''}
    <div class="section-title">Review history</div>
    <section class="card review-history">${rows.length?rows.map(checkpointHtml).join(''):'<div class="empty">No check-ins yet.</div>'}</section>
    <button class="btn ghost full" data-action="backGoals">Back to Goals</button>`;
}
function parseReviewJSON(text){
  let cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
  const first=cleaned.indexOf('{'), last=cleaned.lastIndexOf('}'); if(first>=0&&last>first) cleaned=cleaned.slice(first,last+1);
  return JSON.parse(cleaned);
}
function makeCheckpoint(raw,g){
  const root=raw?.review||raw||{};
  const summary=String(root.summary||'').trim(), learnings=asList(root.learnings), next=asList(root.next??root.actionItems);
  if(root.nextExperiment && !next.includes(String(root.nextExperiment).trim())) next.push(String(root.nextExperiment).trim());
  if(!summary && !learnings.length && !next.length) throw new Error('Empty review');
  const date=today();
  return {id:`review-${date}-${Date.now().toString(36)}`,date,day:Math.max(1,Math.floor((parseDate(date)-parseDate(g.start))/86400000)+1),summary,learnings:learnings.slice(0,5),next:next.slice(0,5),createdAt:new Date().toISOString()};
}
function addGoalCheckpoint(g,raw){
  if(!g) throw new Error('Goal not found');
  g.reviews=normalizeReviews(g); g.reviews.push(makeCheckpoint(raw,g)); g.review=blankReview();
}
function importGoalReview(file){
  if(!file)return; const r=new FileReader(); r.onload=()=>{try{
    const raw=parseReviewJSON(r.result), g=findGoalById(raw.goalId||reviewGoalId); if(!g) throw new Error('Goal not found');
    addGoalCheckpoint(g,raw); reviewGoalId=g.id; persist(); flash='Goal review added.'; render();
  }catch(e){alert('This review could not be imported.');}}; r.readAsText(file);
}
function previewGoalReview(){
  try{
    const rawText=document.getElementById('reviewPaste')?.value||'';
    const raw=parseReviewJSON(rawText),g=findGoalById(raw.goalId||reviewGoalId);if(!g)throw new Error('Goal not found');
    reviewGoalId=g.id;
    reviewDraft={goalId:g.id,rawText,raw,checkpoint:makeCheckpoint(raw,g)};
    flash='Review loaded. Check it below before saving.';
    render();
  }catch(e){alert('Paste the complete JSON code block returned by ChatGPT.');}
}
function saveGoalReviewDraft(){
  try{
    const g=findGoalById(reviewDraft?.goalId||reviewGoalId);if(!g||!reviewDraft)throw new Error('No review loaded');
    g.reviews=normalizeReviews(g); g.reviews.push(reviewDraft.checkpoint); g.review=blankReview();
    reviewDraft=null;persist();flash='Review saved.';view='goals';render();
  }catch(e){alert('Preview a review before saving it.');}
}
function pasteGoalReview(){ previewGoalReview(); }
function lastReviewedGoal(){ return [...db.goals].reverse().find(g=>latestReview(g)); }

function settingsPage(){
  return `${topbar('Settings')}
    <section class="settings-list"><button class="setting-row" data-action="editPlan" style="width:100%;border:0;background:#fff;text-align:left"><span>Default Plan</span><span class="right">›</span></button><button class="setting-row" data-action="export"><span>Export Data</span><span class="right">JSON ›</span></button><label class="setting-row" style="margin:0"><span>Import Data</span><span class="right">JSON ›</span><input id="importFile" type="file" accept="application/json" style="display:none"></label><div class="setting-row"><span>About Tide</span><span class="right">Version ${VERSION}</span></div></section>
    <div class="insight" style="margin-top:16px">Your data stays on this device. Tide upgrades migrate existing data automatically; export a JSON backup anytime for extra safety.</div>`;
}

function planEditPage(){
  return `${topbar('Default Plan','',`<button class="btn sky save-top" data-action="savePlan">${tr('save')}</button>`)}<section class="card"><div class="actual-label">Food goals</div>${planInputsFood()}</section><section class="card"><div class="actual-label">Weekly exercise goals</div>${planInputsMove()}</section><button class="btn sky full" data-action="savePlanBottom">${tr('done')}</button>`;
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
  const rows=[['10k-step days',w.steps,db.plan.stepsDays],[tr('stretch'),w.stretch,db.plan.stretchDays],[tr('cardio'),w.cardio,db.plan.cardio],[tr('strength'),w.strength,db.plan.strength]];
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
  const snapshot={...db.goal,id:db.goal.id||newGoalId(),review:blankReview(),reviews:normalizeReviews(db.goal),planSnapshot:{...db.plan},startWeight:startSnapshot,ended:today(),endWeight:end,resultStatus:status,planDays,strengthMinutes,cardioMinutes,eventCount,snapshot:true,schemaVersion:SCHEMA_VERSION}; db.goals.push(snapshot);
  db.goal={id:newGoalId(),name:'New goal',start:today(),end:addDays(today(),30),startWeight:end??db.goal.target,target:Math.max(35,(end??db.goal.target)-2),status:'active',review:blankReview(),reviews:[]};
  view='goals'; save(db.language==='zh'?'当前目标已归档。':'Goal archived.');
}
function exportData(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tide-backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importData(file){
  if(!file)return; const r=new FileReader(); r.onload=()=>{try{db=migrate(JSON.parse(r.result)); persist(); view='today'; flash=db.language==='zh'?'备份已恢复。':'Backup restored.'; render();}catch{alert(db.language==='zh'?'这个备份无法读取。':'This backup could not be read.')}}; r.readAsText(file);
}


function quickWeightModal(){
  if(!quickWeightOpen) return '';
  const d=day(today());
  return `<div class="modal-backdrop" data-action="closeQuickWeight">
    <div class="weight-modal" role="dialog" aria-modal="true" aria-label="Log morning weight">
      <div class="weight-modal-handle"></div>
      <div class="weight-modal-title">Log morning weight</div>
      <div class="weight-modal-sub">Weight</div>
      <div class="weight-input-wrap"><input id="quickWeightInput" type="number" inputmode="decimal" step="0.1" min="30" max="150" value="${d.weight??''}" placeholder="52.7"><span>kg</span></div>
      <button class="weight-save" data-action="saveQuickWeight">Save</button>
      <button class="weight-cancel" data-action="closeQuickWeight">Cancel</button>
    </div>
  </div>`;
}
function bind(){
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view; render();}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.action;
    if(a==='saveToday'||a==='saveTodayBottom'){saveInputsFromDOM();save(tr('saved'));}
    if(a==='editToday'){selected=today();view='day';render();}
    if(a==='quickWeight'){quickWeightOpen=true;render();setTimeout(()=>document.getElementById('quickWeightInput')?.focus(),30);}
    if(a==='closeQuickWeight'){quickWeightOpen=false;render();}
    if(a==='saveQuickWeight'){const el=document.getElementById('quickWeightInput');const v=el?.value===''?null:+el.value;if(v!=null&&Number.isFinite(v)){day(today()).weight=v;persist();quickWeightOpen=false;flash='Morning weight saved.';render();}}
    if(a==='openSelected'){view='day';render();}
    if(a==='saveDay'||a==='saveDayBottom'){saveInputsFromDOM();view='calendar';save(tr('saved'));}
    if(a==='addEvent'){const el=document.getElementById('customEvent');const v=el?.value.trim();if(v){day(selected).events.push(v);save();}}
    if(a==='editGoal'){view='goalEdit';render();}
    if(a==='saveGoal'){saveGoalForm();view='goals';save(tr('saved'));}
    if(a==='archiveGoal'){if(confirm(db.language==='zh'?'结束并归档当前目标？':'End and archive current goal?')) archiveGoal();}
    if(a==='editPlan'){view='planEdit';render();}
    if(a==='savePlan'||a==='savePlanBottom'){saveInputsFromDOM();view='settings';save(tr('saved'));}
    if(a==='export')exportData();
    if(a==='exportReviewGoal')exportGoalReviewData(findGoalById(reviewGoalId));
    if(a==='pasteGoalReview')pasteGoalReview();
    if(a==='previewGoalReview')previewGoalReview();
    if(a==='saveGoalReviewDraft')saveGoalReviewDraft();
    if(a==='backGoals'){reviewDraft=null;view='goals';render();}
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
  document.querySelectorAll('[data-review-goal]').forEach(b=>b.addEventListener('click',()=>{reviewGoalId=b.dataset.reviewGoal;reviewDraft=null;view='goalReview';render();}));
  document.querySelectorAll('[data-chart-index]').forEach(p=>{
    const update=()=>{const data=chartData(),i=+p.dataset.chartIndex,d=data[i],tip=document.getElementById('chartTip'),guide=document.getElementById('chartGuide');if(tip&&d)tip.innerHTML=chartTipHtml(d);if(guide){const x=p.getAttribute('cx');guide.setAttribute('x1',x);guide.setAttribute('x2',x);}};
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
  else if(view==='goalReview')content=goalReviewPage();
  else if(view==='settings')content=settingsPage();
  else if(view==='planEdit')content=planEditPage();
  document.getElementById('app').innerHTML=`<main class="shell">${content}${['today','calendar','change','goals','settings'].includes(view)?nav():''}</main>${quickWeightModal()}`;
  bind();
  document.querySelector('.weight-modal')?.addEventListener('click',e=>e.stopPropagation());
  const q=document.getElementById('quickWeightInput'); if(q) q.addEventListener('keydown',e=>{if(e.key==='Enter')document.querySelector('[data-action=\"saveQuickWeight\"]')?.click();});
}

document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{}); }
render();
