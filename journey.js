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
  const choices=modern?[[true,'No extra snacks'],[false,'Had extra snacks'],[null,'Not logged']]:[[true,'No snacks'],[false,'Had snacks'],[null,'Not logged']];
  return `<div class="actual-row tracker-row"><div class="actual-label">${modern?'Extra snacks':'Snacks · original rule'}</div>${modern?'<p class="small">Planned evening food is part of the plan.</p>':''}<div class="snack-choices" role="group" aria-label="Snacks on this date">${choices.map(([v,label])=>`<button type="button" class="snack-choice ${value===v?'on':''}" data-no-snack="${v===null?'null':v}" aria-pressed="${value===v}">${label}</button>`).join('')}</div></div>`;
}
function eveningFoodCard(d) {
  if (!usesEveningPlan(d.date)) return '';
  const plan=eveningPlanFor(d.date);
  return `<section class="card evening-card"><div class="row between"><div class="eyebrow">Planned evening food</div><button class="quiet-link" data-action="editEvening" data-evening-date="${d.date}">Edit</button></div><p class="evening-plan">${escapeHtml(plan || 'Choose what works for your evening')}</p><p class="small">Optional, and part of your plan. Adjust the food and portions to suit you.</p>${d.date<=today()?`<div class="chip-row" role="group" aria-label="Evening food">${[['had','Had it'],['not-needed','Didn’t need it'],['','Not logged']].map(([v,label])=>`<button class="pill ${d.eveningFood===(v||null)?'on':''}" data-action="logEvening" data-evening-date="${d.date}" data-value="${v}" aria-pressed="${d.eveningFood===(v||null)}">${label}</button>`).join('')}</div>`:''}</section>`;
}
function returnCard(d) {
  const value=snackValue(d), planned=returnFor(d.date), tomorrow=addDays(d.date,1), next=returnFor(tomorrow);
  if (d.date!==today()) return '';
  if (planned && value===true) return `<section class="card return-card returned" role="status"><div class="return-check" aria-hidden="true">✓</div><b>You came back. ✓</b><p>You returned to your plan today. That counts.</p><div class="small">${returnCount()} recorded return${returnCount()===1?'':'s'} · your history stays with you.</div></section>`;
  if (value===false) return `<section class="card return-card"><b>One day is part of the story.</b><p>Tomorrow can be an ordinary day: regular meals and your planned evening food.</p>${next?'<div class="return-commitment" role="status">Tomorrow’s return is planned. ✓</div><button class="quiet-link" data-action="undoReturn">Undo</button>':'<button class="btn sky full" data-action="planReturn">Back to my plan tomorrow</button>'}<div class="small plan-helper">No skipped meals or extra exercise to make up for today.</div></section>`;
  if (planned) return `<section class="card return-card"><div class="eyebrow">A fresh step</div><b>Today is a return day.</b><p>Regular meals. Your planned evening food is welcome. Log extra snacks when you know how the day went.</p><div class="small">Nothing is marked complete until you record it.</div></section>`;
  return '';
}
function eveningEditPage() {
  const date=eveningEditDate||today();
  return `${topbar('Evening food',fmtDate(date),'<button class="btn ghost" data-action="cancelEvening">Cancel</button>')}<section class="card"><label for="eveningText">Food and portions</label><textarea id="eveningText" rows="3" maxlength="240" placeholder="e.g. 2 eggs + 1 fruit">${escapeHtml(eveningPlanFor(date))}</textarea><label for="eveningScope">Apply to</label><select id="eveningScope"><option value="day">Only ${date===today()?'today':fmtDate(date)}</option>${date>=today()?'<option value="default">This date and future days</option>':''}</select><p class="small">Past plans and recorded meals keep their original wording. A future day with its own plan keeps that override.</p><button class="btn sky full" data-action="saveEvening">Save evening food</button></section>`;
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
  const e=goalEvidence(g), modern=g.start>=db.journey.effectiveFrom;
  const signed=v=>`${v>0?'+':''}${fmt(v)}`;
  const weight=e.last?`${fmt(g.startWeight)} → ${fmt(e.last.weight)} kg · ${signed(e.delta)} kg from the saved start weight. Latest reading ${fmtDate(e.last.date)}.`:'No weigh-ins recorded within this goal.';
  const warning=e.discrepancy?`Archived end weight ${fmt(g.endWeight)} kg differs from the latest dated reading in this goal. Both original values are preserved.`:e.stale?'The last reading is more than 3 days before the review date; the end result is uncertain.':'';
  const hunger=Object.values(db.days).filter(d=>d.date>=g.start&&d.date<=e.through&&d.food.bedtimeHunger>=4&&!d.skips?.bedtimeHunger).length;
  const next=hunger>=2?'High bedtime hunger was logged more than once. Review whether meals and evening food are satisfying enough.':e.logged<3?'A few more ordinary-day logs will make the next review more useful.':e.met<e.logged?'Keep the next step small: return to regular meals and an evening plan that works for you.':'Keep the parts of your routine that feel repeatable. Review how you feel as well as the trend.';
  return `<section class="card local-review"><div class="row between"><b>${escapeHtml(e.outcome)}</b><span class="small">${g.snapshot?'Archived review':'Review to date'}</span></div><p>${escapeHtml(weight)}</p>${warning?`<p class="data-note">${escapeHtml(warning)}</p>`:''}${!compact?`<div class="review-facts"><div><b>7-day average</b><span>${e.endTrend.value==null?'Needs 3 readings':`${fmt(e.endTrend.value)} kg`} · ${e.endTrend.count} readings in the 7 days ending ${fmtShortDate(e.through)}${e.trendDelta==null?'':` · ${signed(e.trendDelta)} kg vs start window`}</span></div><div><b>${modern?'Extra snacks':'Snack records · rules at the time'}</b><span>${e.met} / ${e.logged} logged days with ${modern?'no extra snacks':'no snacks'} · ${Math.max(0,e.total-e.logged)} unknown or N/A</span></div><div><b>Next step</b><span>${escapeHtml(next)}</span></div></div>`:''}</section>`;
}
function nextStepChoices() {
  return `<section class="card next-step-card"><b>What would help next?</b><p class="small">Keep your history. Choose the next direction yourself.</p><div class="next-step-grid"><button class="btn secondary" data-action="nextGoal" data-mode="continue">Continue target</button><button class="btn secondary" data-action="nextGoal" data-mode="adjust">Adjust plan</button><button class="btn secondary" data-action="nextGoal" data-mode="maintain">Maintain</button><button class="btn ghost" data-action="nextGoal" data-mode="record">Just record</button></div></section>`;
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
  else if(action==='logEvening') { const d=day(button.dataset.eveningDate);snapshotEveningPlan(d);d.eveningFood=button.dataset.value||null;save(); }
  else if(action==='nextGoal') beginNextGoal(button.dataset.mode);
  else if(action==='cancelGoalEdit') cancelGoalEdit();
  else if(action==='toggleForecast') { showForecast=!showForecast;render(); }
  else return false;
  return true;
}
function journeyTodayPage() {
  const d=day(today()), lw=latestWeight(), g=db.goal, t=trendStats(today());
  return `${topbar(`Today · ${fmtDate(today())}`)}${flashHtml()}${endGoalTodayEntry()}${returnCard(d)}
    <section class="card focus-card"><div class="eyebrow">Today’s focus</div><h2>A day you can return to.</h2>${snackControls(d)}</section>
    ${eveningFoodCard(d)}
    <button class="quick-weight-card ${d.weight==null?'empty-weight':''}" data-action="quickWeight"><div><div class="quick-weight-label">Morning weight</div><div class="quick-weight-value">${d.weight==null?'Log morning weight':`${fmt(d.weight)} <span>kg</span>`}</div></div><div class="quick-weight-action">${d.weight==null?'Log now':'Edit'} ›</div></button>
    <section class="today-goal-card"><div class="row between"><div><div class="eyebrow">${g.mode==='record'?'Your rhythm':'Current chapter'}</div><div class="today-goal-name">${escapeHtml(g.name)}</div></div><span class="status active">${journeyGoalState()}</span></div><p class="small">${lw?`Latest ${fmt(lw.weight)} kg · ${fmtDate(lw.date)}`:'No weight logged yet'}${t.value!=null?` · 7-day average ${fmt(t.value)} kg (${t.count} readings)`:''}</p>${g.status!=='idle'&&g.mode!=='record'?`<div class="small">${g.mode==='maintain'?'Maintenance direction':'Weight direction'} ${fmt(g.target)} kg · Review ${fmtDate(g.end)}</div>`:''}<button class="review-inline-link" ${g.status==='idle'?'data-view="goals"':`data-review-goal="${escapeHtml(g.id)}"`}>${g.status==='idle'?'Choose next step':'Review this chapter'} →</button></section>
    ${g.status!=='idle'&&g.end<today()?localGoalReview(g,true):''}${todayGoalLearning()}<button class="today-edit-button" data-action="editToday">Other logs / edit today</button>${dailyThoughtBlock()}`;
}
