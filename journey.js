// Journey helpers are loaded before app.js. They only access app state when called.
// New meanings have their own fields; legacy food.noSnack/stop6 remain untouched.
function migrateJourney(out, raw) {
  if (raw?.journey?.effectiveFrom) {
    out.journey = JSON.parse(JSON.stringify(raw.journey));
    out.journey.returns ||= [];
    out.journey.eveningPlans ||= [];
    return out;
  }
  const from = today();
  const beforeGoal = JSON.parse(JSON.stringify(out.goal)), beforePlan = {...out.plan};
  out.journey = {effectiveFrom:from, eveningPlans:[{effectiveFrom:from, text:'2 eggs + 1 fruit'}], returns:[]};
  out.plan.stop = null;
  out.goal.trackers.stop6 = {...out.goal.trackers.stop6, role:'track', roleAuto:false};
  if (!out.calendarRuleHistory.length) out.calendarRuleHistory.push({effectiveFrom:'0001-01-01',goal:beforeGoal,plan:beforePlan});
  const scheduled=out.calendarRuleHistory.filter(r=>r.effectiveFrom>from).map(r=>({
    ...r,plan:{...r.plan,stop:null},goal:{...r.goal,trackers:{...r.goal.trackers,stop6:{...r.goal.trackers?.stop6,role:'track',roleAuto:false}}}
  }));
  out.calendarRuleHistory = out.calendarRuleHistory.filter(r=>r.effectiveFrom<from);
  out.calendarRuleHistory.push({effectiveFrom:from,goal:JSON.parse(JSON.stringify(out.goal)),plan:{...out.plan}},...scheduled);
  return out;
}
function usesEveningPlan(date) { return date >= db.journey.effectiveFrom; }
function snackValue(d) {
  if (d.skips?.noSnack) return null;
  if (!usesEveningPlan(d.date)) return d.food.noSnack;
  return typeof d.food.extraSnacks === 'boolean' ? !d.food.extraSnacks : null;
}
function eveningPlanFor(date) {
  const override = db.days[date]?.eveningPlan;
  if (typeof override === 'string') return override;
  return db.journey.eveningPlans.filter(p=>p.effectiveFrom<=date).at(-1)?.text || '';
}
function snapshotEveningPlan(d) { if (d.eveningPlan == null) d.eveningPlan = eveningPlanFor(d.date); }
function returnFor(date) { return db.journey.returns.find(r=>r.date===date); }
function returnedOn(date) { return !!returnFor(date) && snackValue(readDay(date))===true; }
function returnCount() { return db.journey.returns.filter(r=>r.date<=today() && returnedOn(r.date)).length; }
function snackControls(d) {
  const modern=usesEveningPlan(d.date), value=snackValue(d);
  const choices=modern?[[true,'No extras'],[false,'Had extras'],[null,'Not logged']]:[[true,'No snacks'],[false,'Had snacks'],[null,'Not logged']];
  return `<div class="actual-row tracker-row snack-log"><div class="actual-label">${modern?'Snacks':'Snacks · original rule'}</div><div class="snack-choices" role="group" aria-label="Snacks on this date">${choices.map(([v,label])=>`<button type="button" class="snack-choice ${value===v?'on':''}" data-no-snack="${v===null?'null':v}" aria-pressed="${value===v}">${label}</button>`).join('')}</div></div>`;
}

function eveningFoodCard(d) {
  if (!usesEveningPlan(d.date)) return '';
  const plan=eveningPlanFor(d.date), out=d.eveningOut===true;
  return `<div class="evening-inline"><details class="evening-details"><summary><span>Evening</span><b>${escapeHtml(out?'Dinner out':plan||'Optional snack')}</b></summary><div class="evening-options"><div class="row between"><span class="small">${out?'Dinner is your evening plan.':'Planned food doesn’t count as extras.'}</span><button class="quiet-link" data-action="editEvening" data-evening-date="${d.date}">Edit</button></div>${d.date<=today()?`<div class="chip-row" role="group" aria-label="Evening food">${[['had','Had it'],['not-needed','Not needed'],['','Not logged']].map(([v,label])=>`<button class="pill ${d.eveningFood===(v||null)?'on':''}" data-action="logEvening" data-evening-date="${d.date}" data-value="${v}" aria-pressed="${d.eveningFood===(v||null)}">${label}</button>`).join('')}</div>`:''}${out?'<p class="small">Still hungry? Your usual snack is optional.</p>':''}</div></details><button class="dinner-toggle ${out?'on':''}" data-action="toggleDinnerOut" data-evening-date="${d.date}" aria-pressed="${out}">Dinner out${out?' ✓':''}</button></div>`;
}

function returnCard(d) {
  if (d.date!==today()) return '';
  const value=snackValue(d), planned=returnFor(d.date), next=returnFor(addDays(d.date,1));
  if(planned&&value===true) return '<div class="return-strip returned" role="status"><b>Back on plan ✓</b></div>';
  if(value===false) return next?'<div class="return-strip"><span>Tomorrow planned ✓</span><button class="quiet-link" data-action="undoReturn">Undo</button></div>':'<div class="return-strip"><button class="quiet-link" data-action="planReturn">Back to my plan tomorrow →</button></div>';
  return planned?'<div class="return-strip"><b>Back to plan today</b></div>':'';
}

function eveningEditPage() {
  const date=eveningEditDate||today();
  return `${topbar('Evening food',fmtDate(date),'<button class="btn ghost" data-action="cancelEvening">Cancel</button>')}<section class="card"><label for="eveningText">Food and portions</label><textarea id="eveningText" rows="3" maxlength="240" placeholder="e.g. 2 eggs + 1 fruit">${escapeHtml(eveningPlanFor(date))}</textarea><label for="eveningScope">Apply to</label><select id="eveningScope"><option value="day">Only ${date===today()?'today':fmtDate(date)}</option>${date>=today()?'<option value="default">This date and future days</option>':''}</select><p class="small">Earlier days stay unchanged.</p><button class="btn sky full" data-action="saveEvening">Save evening food</button></section>`;
}
function saveEveningPlan() {
  const date=eveningEditDate||today(), text=document.getElementById('eveningText').value.trim().slice(0,240);
  if (!text) { alert('Add food and portions, or write “Decide on the day”.'); return; }
  if (document.getElementById('eveningScope').value==='default' && date>=today()) {
    db.journey.eveningPlans=db.journey.eveningPlans.filter(p=>p.effectiveFrom<date);
    db.journey.eveningPlans.push({effectiveFrom:date,text});
  }
  day(date).eveningPlan=text;
  view=eveningReturnView; save('Evening food updated.');
}
function journeyGoalState(g=db.goal) {
  if (g.status==='idle') return 'Choose next step';
  if (g.mode==='record') return 'Just recording';
  if (g.end<today()) return 'Ready to review';
  if (g.start>today()) return 'Upcoming';
  return g.mode==='maintain'?'Maintaining':'Active';
}
function trendStats(date, window=7) {
  const rows=latestWeights(date).filter(r=>r.date>=addDays(date,1-window));
  return {count:rows.length, value:rows.length>=3?avg(rows.map(r=>+r.weight)):null};
}
function goalEvidence(g) {
  const through=[g.ended||g.end,g.end,today()].sort()[0];
  const rows=latestWeights(through).filter(r=>r.date>=g.start), last=rows.at(-1)||null;
  const delta=last?+last.weight-(+g.startWeight):null;
  const stale=!!last && parseDate(through)-parseDate(last.date)>3*86400000;
  const discrepancy=!!g.snapshot && g.endWeight!=null && last && Math.abs(+g.endWeight-(+last.weight))>.05;
  const endTrend=trendStats(through), startTrend=trendStats(g.start);
  const trendDelta=endTrend.value!=null&&startTrend.value!=null ? endTrend.value-startTrend.value : null;
  let logged=0,met=0,total=0;
  for(let s=g.start;s<=through;s=addDays(s,1)) { total++;const v=snackValue(readDay(s));if(v!=null){logged++;if(v)met++;} }
  let outcome='More data needed';
  if(last && !stale) {
    if(g.mode==='record') outcome='Recorded';
    else if(g.mode==='maintain') outcome=Math.abs(+last.weight-(+g.target))<=.5?'Near maintenance target':'Review maintenance plan';
    else if(+last.weight<=+g.target+.1) outcome='Target observed';
    else if(delta<-.1) outcome='Progress made';
    else if(delta>.1) outcome='Weight increased';
    else outcome='Little change';
  }
  return {through,rows,last,delta,stale,discrepancy,endTrend,startTrend,trendDelta,logged,met,total,outcome};
}
function localGoalReview(g, compact=false) {
  const e=goalEvidence(g), digest=reviewDigest(g), theme=goalTheme(g);
  const warning=e.discrepancy?'Saved end weight differs from dated logs.':e.stale?'Latest weight is out of date.':'';
  return `<section class="card local-review review-${theme.tone}"><div class="digest-row"><span>Trend</span><b>${escapeHtml(digest.trend)}</b></div>${!compact?`<div class="digest-row"><span>Pattern</span><b>${escapeHtml(digest.pattern)}</b></div><div class="digest-row next"><span>Next</span><b>${escapeHtml(digest.next)}</b></div>`:''}${warning?`<p class="data-note">${warning}</p>`:''}${!compact?`<details class="review-details"><summary>Data</summary><div class="small">${e.last?`${fmt(e.last.weight)} kg · ${fmtDate(e.last.date)}`:'No weigh-ins'}${e.endTrend.value==null?'':` · average ${fmt(e.endTrend.value)} kg`}<br>${e.met} / ${e.logged} snack logs on plan · ${Math.max(0,e.total-e.logged)} unknown or N/A<br>Pattern window: ${fmtDate(digest.from)}–${fmtDate(e.through)}${e.discrepancy?`<br>Saved end: ${fmt(g.endWeight)} kg. Original values preserved.`:''}</div></details>`:''}</section>`;
}

function nextStepChoices() {
  return `<section class="card next-step-card"><b>Next goal</b><div class="next-step-grid"><button class="btn secondary" data-action="nextGoal" data-mode="continue">Continue target</button><button class="btn secondary" data-action="nextGoal" data-mode="adjust">Adjust plan</button><button class="btn secondary" data-action="nextGoal" data-mode="maintain">Maintain</button><button class="btn ghost" data-action="nextGoal" data-mode="record">Just record</button></div></section>`;
}
function beginNextGoal(mode) {
  if (db.goal.status!=='idle') return;
  beginGoalEdit();
  const previous=db.goals.at(-1), weight=latestWeight()?.weight??db.goal.startWeight;
  db.goal={...db.goal,id:newGoalId(),status:'active',mode:mode==='maintain'?'maintain':mode==='record'?'record':'lose',name:mode==='maintain'?'Maintain a comfortable routine':mode==='record'?'Just recording':previous?.name||'My next chapter',start:today(),end:addDays(today(),28),startWeight:weight,target:mode==='maintain'?weight:previous?.target??db.goal.target,trackers:normalizeTrackers({...db.goal,trackers:defaultTrackersForFocus(db.goal.focus,today())}),reviews:[],review:blankReview()};
  db.goal.trackers.stop6={role:'track',activeFrom:today(),roleAuto:false};
  // The saved configuration carries forward; choosing a new chapter never lowers a target automatically.
  if (previous?.trackers) db.goal.trackers=Object.fromEntries(Object.entries(previous.trackers).map(([id,c])=>[id,{...c,activeFrom:today(),...(id==='stop6'?{role:'track'}:{})}]));
  view='goalEdit'; render();
}
function beginGoalEdit() { if (!goalEditSnapshot) goalEditSnapshot=JSON.parse(JSON.stringify({goal:db.goal,plan:db.plan,calendarRuleHistory:db.calendarRuleHistory})); }
function cancelGoalEdit() { if(goalEditSnapshot) Object.assign(db,goalEditSnapshot);goalEditSnapshot=null;view='goals';render(); }
function finishGoalEdit() { goalEditSnapshot=null;persist(); }
function validateGoalForm() {
  const start=document.getElementById('goalStart')?.value, end=document.getElementById('goalEnd')?.value;
  const initial=document.getElementById('goalStartWeight')?.value, target=document.getElementById('goalTarget')?.value;
  const weightsInvalid=db.goal.mode!=='record'&&(!initial || !target || !Number.isFinite(+initial) || !Number.isFinite(+target) || +initial<=0 || +target<=0);
  if(!start || !end || end<start || weightsInvalid) {
    alert('Add positive weights and a review date on or after the start date.');return false;
  }
  return true;
}
function handleJourneyAction(action, button) {
  if(action==='planReturn') { const date=addDays(today(),1);if(!returnFor(date))db.journey.returns.push({from:today(),date,createdAt:new Date().toISOString()});save(); }
  else if(action==='undoReturn') { db.journey.returns=db.journey.returns.filter(r=>r.date!==addDays(today(),1));save(); }
  else if(action==='editEvening') { if(view==='goalEdit')saveGoalForm();eveningReturnView=view;eveningEditDate=button.dataset.eveningDate||today();view='eveningEdit';render(); }
  else if(action==='cancelEvening') { view=eveningReturnView;render(); }
  else if(action==='saveEvening') saveEveningPlan();
  else if(action==='toggleDinnerOut') { const d=day(button.dataset.eveningDate);d.eveningOut=!d.eveningOut;save(); }
  else if(action==='logEvening') { const d=day(button.dataset.eveningDate);snapshotEveningPlan(d);d.eveningFood=button.dataset.value||null;save(); }
  else if(action==='nextGoal') beginNextGoal(button.dataset.mode);
  else if(action==='cancelGoalEdit') cancelGoalEdit();
  else if(action==='toggleForecast') { showForecast=!showForecast;render(); }
  else return false;
  return true;
}
function journeyTodayPage() {
  const d=day(today());
  return `${topbar(`Today · ${fmtDate(today())}`)}${flashHtml()}${endGoalTodayEntry()}${todayGoalCard()}
    <button class="quick-weight-card ${d.weight==null?'empty-weight':''}" data-action="quickWeight"><div><div class="quick-weight-label">Morning weight</div><div class="quick-weight-value">${d.weight==null?'Log weight':`${fmt(d.weight)} <span>kg</span>`}</div></div><div class="quick-weight-action">${d.weight==null?'Add':'Edit'} ›</div></button>
    <section class="card today-food">${snackControls(d)}${eveningFoodCard(d)}${returnCard(d)}</section>
    <button class="today-edit-button" data-action="editToday">Log today →</button>${dailyThoughtBlock()}`;
}

function todayGoalCard() {
  const g=db.goal, last=latestWeight(), current=last?.weight??null;
  if(g.status==='idle') return '<section class="card"><div class="row between"><b>No active goal</b><button class="quiet-link" data-view="goals">Choose next →</button></div></section>';
  const progress=current==null?null:goalProgress(current), weightGoal=g.mode!=='record';
  return `<section class="card goal-overview"><div class="goal-overview-main"><div class="goal-overview-copy"><div class="eyebrow">${journeyGoalState(g)}</div><h2>${escapeHtml(g.name)}</h2>${weightGoal?`<div class="goal-pair"><div><span>Latest</span><b>${fmt(current)}</b></div><div><span>${g.mode==='maintain'?'Maintain':'Target'}</span><b>${fmt(g.target)}</b></div></div>`:''}</div>${weightGoal&&g.mode!=='maintain'?`<div class="goal-ring" style="--p:${progress??0}" role="img" aria-label="${progress==null?'No current weight':`${Math.round(progress)} percent of goal change`}"><div><b>${progress==null?'—':Math.round(progress)+'%'}</b><span>of goal</span></div></div>`:''}</div><div class="goal-overview-foot"><span>${fmtDate(g.start)}–${fmtDate(g.end)}</span><button class="quiet-link" data-view="change">Progress →</button></div>${last&&last.date!==today()?`<div class="small latest-date">Last weighed ${fmtDate(last.date)}</div>`:''}</section>`;
}
function chartWindowStart() {
  if(range==='all')return '0001-01-01';
  if(range==='goal'&&db.goal.status!=='idle')return addDays(db.goal.start,-7);
  return addDays(today(),-(Number(range)||30)+1);
}
function chartBounds(data, forecastReady=false) {
  const first=data[0]?.date||today(), last=data.at(-1)?.date||today();
  const goalRange=range==='goal'&&db.goal.status!=='idle';
  let start=goalRange&&db.goal.start<first?db.goal.start:first;
  let end=goalRange&&db.goal.end>last?db.goal.end:last;
  if(forecastReady&&addDays(last,14)>end)end=addDays(last,14);
  if(start===end){start=addDays(start,-1);end=addDays(end,1);}
  return {start,end};
}
function goalTheme(g) {
  const e=goalEvidence(g);
  if(!e.last||e.stale||e.discrepancy)return {tone:'muted',symbol:'○',label:e.discrepancy?'Check data':'Incomplete'};
  if(g.mode==='record')return {tone:'muted',symbol:'○',label:'Recorded'};
  if(g.mode==='maintain')return Math.abs(+e.last.weight-(+g.target))<=.5?{tone:'green',symbol:'✓',label:'Maintained'}:{tone:'amber',symbol:'~',label:'Review'};
  if(+e.last.weight<=+g.target+.1)return {tone:'green',symbol:'✓',label:'At target'};
  if(e.delta<-.1)return {tone:'green',symbol:'↓',label:'Progress made'};
  if(e.delta>.1)return {tone:'rose',symbol:'↑',label:'Weight up'};
  return {tone:'amber',symbol:'→',label:'Steady'};
}
function goalMiniChart(g) {
  const rows=goalEvidence(g).rows;
  if(rows.length<2)return '<div class="history-spark-empty">—</div>';
  const lo=Math.min(...rows.map(r=>+r.weight))-.1, hi=Math.max(...rows.map(r=>+r.weight))+.1;
  const span=Math.max(86400000,parseDate(rows.at(-1).date)-parseDate(rows[0].date));
  const xy=r=>[3+110*(parseDate(r.date)-parseDate(rows[0].date))/span,3+28*(hi-r.weight)/(hi-lo)];
  const path=rows.map((r,i)=>`${i&&parseDate(r.date)-parseDate(rows[i-1].date)<=3*86400000?'L':'M'} ${xy(r).map(v=>v.toFixed(1)).join(' ')}`).join(' ');
  return `<svg class="history-spark" viewBox="0 0 116 34" aria-hidden="true"><path d="${path}"/>${rows.map(r=>`<circle cx="${xy(r)[0]}" cy="${xy(r)[1]}" r="1.2"/>`).join('')}</svg>`;
}
function reviewDigest(g) {
  const e=goalEvidence(g), from=g.snapshot&&g.start>addDays(e.through,-13)?g.start:addDays(e.through,-13);
  const days=Object.values(db.days).filter(d=>d.date>=from&&d.date<=e.through);
  const recent=days.filter(d=>d.date>=addDays(e.through,-6)), previous=days.filter(d=>d.date<addDays(e.through,-6));
  const logs=days.filter(d=>snackValue(d)!=null), snackDays=logs.filter(d=>snackValue(d)===false);
  const hunger=days.filter(d=>d.food.bedtimeHunger!=null&&!d.skips?.bedtimeHunger), hungry=hunger.filter(d=>d.food.bedtimeHunger>=4);
  const overlap=snackDays.filter(d=>d.food.bedtimeHunger>=4&&!d.skips?.bedtimeHunger);
  const out=logs.filter(d=>d.eveningOut||d.events.includes('eating_out'));
  const before=trendStats(addDays(e.through,-7)), after=e.endTrend;
  let trend='Too early to tell.';
  if(e.discrepancy)trend='Check the saved end weight.';
  else if(e.stale||!e.last)trend='A recent weigh-in is needed.';
  else if(before.value!=null&&after.value!=null){
    const delta=after.value-before.value;
    trend=delta<-.15?'Trending down.':delta>.15?(e.delta<-.1?'Lower overall; up this week.':'Trending up.'):'Holding steady.';
  }else if(e.rows.length>=3&&parseDate(e.last.date)-parseDate(e.rows[0].date)>=7*86400000){
    const change=e.last.weight-e.rows[0].weight;
    trend=change<-.2?'Lower than the first reading.':change>.2?'Higher than the first reading.':'Little change so far.';
  }
  let pattern='Food logs are too sparse.', next='Log snacks and evening hunger.';
  const rate=rows=>{const logged=rows.filter(d=>snackValue(d)!=null);return {n:logged.length,rate:logged.length?logged.filter(d=>snackValue(d)===false).length/logged.length:null};};
  const old=rate(previous), now=rate(recent);
  if(overlap.length>=3){pattern='Snacking and high hunger overlap.';next='Adjust the evening food plan.';}
  else if(hungry.length>=3&&hungry.length/hunger.length>=.5){pattern='High evening hunger keeps returning.';next='Try a more satisfying evening plan.';}
  else if(old.n>=3&&now.n>=3&&now.rate<=old.rate-.25){pattern='Fewer snack days lately.';next='Keep the current evening routine.';}
  else if(snackDays.length>=3&&snackDays.length/logs.length>=.5){pattern='Snack days are frequent.';next='Plan tomorrow’s evening food.';}
  else if(out.length>=3&&out.filter(d=>snackValue(d)===true).length/out.length>=.75){pattern='Eating out often stayed on plan.';next='Keep dinner separate from extras.';}
  else if(logs.length>=4&&snackDays.length/logs.length<=.25){pattern='Snack habits look consistent.';next='Keep the routine; watch the trend.';}
  else if(logs.length>=4){pattern='Some days return to extra snacks.';next='Choose one easy plan for tomorrow.';}
  if(e.discrepancy){next='Check the dated weight logs.';}
  else if(e.stale||!e.last){next='Log a current weight first.';}
  return {trend,pattern,next,from};
}
function weekGridHeader() {
  return '<div class="behavior-row week-labels"><span></span><div class="seven-grid">'+['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')+'</div></div>';
}
function otherSignals(g) {
  const dates=weekDates(), activeDates=dates.filter(date=>date<=today());
  const ids=TRACKER_IDS.filter(id=>id!=='stop6'&&trackerRole(g,id)!=='goal');
  const value=(id,d)=>{
    if(d.skips?.[id])return null;
    if(id==='sleep')return d.sleep;
    if(id==='noSnack')return snackValue(d);
    return (TRACKER_DEFS[id]?.group==='diet'?d.food:d.move)[id];
  };
  const shown=['sleep',...ids.filter(id=>id==='bedtimeHunger'||activeDates.some(date=>value(id,readDay(date))!=null))];
  const label=id=>id==='sleep'?'Sleep · h':id==='bedtimeHunger'?'Hunger · /5':id==='water'?'Water · L':id==='cardio'||id==='strength'?`${TRACKER_DEFS[id].label} · min`:TRACKER_DEFS[id].label;
  const rows=shown.map(id=>`<div class="behavior-row signal-row" data-signal="${id}"><div class="behavior-label">${label(id)}${id!=='sleep'&&trackerRole(g,id)==='bonus'?'<small>Bonus</small>':''}</div><div class="seven-grid">${dates.map(date=>{
    const v=date<=today()?value(id,readDay(date)):null;
    const text=v==null?'–':typeof v==='boolean'?(v?'✓':'·'):id==='steps'&&+v>=1000?`${(+v/1000).toFixed(0)}k`:Number(v).toLocaleString('en-US',{maximumFractionDigits:1});
    return `<span class="signal-cell ${v==null?'unlogged':'logged'}" title="${fmtShortDate(date)} · ${v==null?'Not logged':typeof v==='boolean'?(v?'Yes':'No'):escapeHtml(String(v))}">${text}</span>`;
  }).join('')}</div></div>`).join('');
  return `<div class="row between behavior-heading"><b>Other signals</b><span class="small">Not scored</span></div>${weekGridHeader()}${rows}`;
}
