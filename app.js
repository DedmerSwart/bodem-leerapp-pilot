(() => {
  'use strict';
  const endpoint = 'https://gxhcsgjbcxgrloxbnexn.supabase.co/functions/v1/bodem-api';
  const sessionKey = 'bodem.phase6.student.session';
  let curriculum = [];
  let byId = new Map();
  const main = document.getElementById('main'), notice = document.getElementById('notice'), account = document.getElementById('account');
  let token = '', overview = null, detail = null, currentId = '', selected = null, busy = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const count = answers => answers.filter(value => value !== null).length;
  const statusClass = status => status === 'Doorlopen' ? 'done' : status === 'Bezig' ? 'busy' : '';
  const button = (action, label, primary=false, extra='') => `<button type="button" data-action="${action}" ${primary?'class="primary"':''} ${extra}>${label}</button>`;
  const questionTable = table => {
    if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) return '';
    return `<div class="question-table" role="region" aria-label="${esc(table.caption)}" tabindex="0"><table><caption>${esc(table.caption)}</caption><thead><tr>${table.headers.map(header => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map((cell,index) => index === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  function message(text='') { notice.textContent = text; notice.hidden = !text; }
  function lock(on) { busy = on; main.setAttribute('aria-busy', String(on)); document.querySelectorAll('button,input').forEach(element => { if (on) { element.dataset.wasDisabled = String(element.disabled); element.disabled = true; } else if (element.dataset.wasDisabled !== undefined) { element.disabled = element.dataset.wasDisabled === 'true'; delete element.dataset.wasDisabled; } }); }
  function forget() { token = ''; overview = null; detail = null; currentId = ''; try { sessionStorage.removeItem(sessionKey); } catch {} }
  async function api(body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:JSON.stringify(body), signal:controller.signal});
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'De aanvraag is niet gelukt.'); error.status = response.status; error.data = data; throw error; }
      return data;
    } catch (error) {
      if (!error.status) throw new Error('Geen bevestiging ontvangen. Controleer je verbinding en probeer opnieuw.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function loginView() {
    document.getElementById('logout').hidden = true; account.textContent = '';
    main.innerHTML = `<section class="panel login"><p class="kicker">Bodem · Complete testversie</p><h1>Welkom bij Bodem</h1><p>Leer zelfstandig over bodem en oefen met vragen. Je voortgang blijft bewaard.</p><form id="login-form"><label for="code">Persoonlijke studentcode</label><input id="code" type="password" autocomplete="current-password" required maxlength="128" spellcheck="false"><div class="actions"><button class="primary" type="submit">Inloggen</button><button type="button" data-action="show-code">Code tonen</button></div></form><p class="muted">Deze testomgeving bevat uitsluitend fictieve studenten.</p></section>`;
  }
  function acceptOverview(data) {
    if (!Array.isArray(data.curriculum) || data.curriculum.length !== 31) throw new Error('De lesinhoud kon niet volledig worden geladen. Probeer opnieuw.');
    curriculum = data.curriculum;
    byId = new Map(curriculum.map(lesson => [lesson.id, lesson]));
    overview = data; detail = null; currentId = '';
    account.textContent = `${data.student.name} · ${data.student.className}`;
    document.getElementById('logout').hidden = false;
  }
  async function login(code) {
    code = code.trim().replace(/^[`"']+|[`"']+$/g,'').replace(/[\s\u200B-\u200D\uFEFF\-\u2010-\u2015\u2212]/g,'').toUpperCase();
    if (!/^[A-F0-9]{32}$/.test(code)) { message('De code is niet volledig. Kopieer alleen de acht groepjes van vier tekens.'); return; }
    lock(true); message('Inloggen…');
    try { const data = await api({action:'login',code}); token = data.token; try { sessionStorage.setItem(sessionKey, token); } catch {} acceptOverview(data); message(); renderDashboard(); }
    catch (error) { message(error.message); }
    finally { lock(false); }
  }
  async function load() {
    lock(true); message('Voortgang laden…');
    try { acceptOverview(await api({action:'load'})); message(); renderDashboard(false); }
    catch (error) { if (error.status === 401) { forget(); loginView(); } message(error.message); }
    finally { lock(false); }
  }
  async function logout() {
    if (busy) return; lock(true);
    try { await api({action:'logout'}); forget(); account.textContent=''; message('Je bent uitgelogd.'); loginView(); }
    catch (error) { if (error.status === 401) { forget(); loginView(); message('Je bent uitgelogd.'); } else message(error.message); }
    finally { lock(false); }
  }
  function renderDashboard(focus=true) {
    if (!overview) { loginView(); return; }
    const done = overview.lessons.filter(lesson => lesson.status === 'Doorlopen').length;
    const answered = overview.lessons.reduce((total, lesson) => total + (lesson.answered || 0), 0);
    const blocks = ['LDV111','LDV112','LDV141'];
    main.innerHTML = `<p class="kicker">Mijn lessen</p><h1>Verder leren over bodem</h1><section class="hero hero-grid"><div><h2>Welkom, ${esc(overview.student.name)}</h2><p>Kies een les. Je kunt altijd stoppen en later verdergaan waar je gebleven bent.</p></div><div class="hero-stats"><div><strong>${done} / 31</strong><span>Lessen doorlopen</span></div><div><strong>${answered} / 186</strong><span>Vragen beantwoord</span></div></div></section>` + blocks.map(block => {
      const lessons = curriculum.filter(lesson => lesson.block === block);
      const blockDone = lessons.filter(lesson => overview.lessons.find(item => item.id === lesson.id)?.status === 'Doorlopen').length;
      return `<section class="block"><div class="block-head"><div><p class="kicker">${block}</p><h2>${block === 'LDV111' ? 'Bodem en landschap' : block === 'LDV112' ? 'Bodemprocessen en klimaat' : 'Bodem, bemesting, leven en water'}</h2></div><p class="muted">${blockDone} van ${lessons.length} doorlopen</p></div><div class="lesson-grid">${lessons.map(lesson => {
        const progress = overview.lessons.find(item => item.id === lesson.id);
        const answeredCount = progress?.answered || 0;
        return `<button class="lesson-card" data-action="open-lesson" data-id="${lesson.id}"><span class="lesson-top"><span class="kicker">${lesson.id} · circa ${lesson.minutes} min.</span><span class="status ${statusClass(progress.status)}">${esc(progress.status)}</span></span><strong>${esc(lesson.title)}</strong><small>${answeredCount} van 6 vragen · ${progress.score === null ? 'nog geen eerste score' : progress.score + ' punt' + (progress.score === 1 ? '' : 'en')}</small><span class="mini-progress"><span style="width:${answeredCount / 6 * 100}%"></span></span></button>`;
      }).join('')}</div></section>`;
    }).join('');
    if (focus) { main.focus(); main.scrollIntoView({block:'start'}); }
  }
  async function openLesson(id) {
    if (busy || !byId.has(id)) return; currentId = id; selected = null; lock(true); message('Les laden…');
    try { detail = await api({action:'lesson',lessonId:id}); message(); renderLesson(); }
    catch (error) { if (error.status === 401) { forget(); loginView(); } else message(error.message); }
    finally { lock(false); }
  }
  function lessonHeader(lesson, state) {
    return `<div class="lesson-top"><div><p class="kicker">${lesson.block} · ${lesson.id}</p><span class="badge">Circa ${lesson.minutes} minuten</span></div>${button('dashboard','Terug naar mijn lessen')}</div><h1>${esc(lesson.title)}</h1><p>${esc(lesson.goal)}</p><div class="statusline"><span>Theorie ${state.read?'gelezen':'nog niet afgerond'}</span><span>${count(state.first)} van 6 vragen beantwoord</span></div><div class="progress" aria-label="Voortgang in deze les"><span style="width:${(state.read?50:state.step/2*45) + count(state.first)/6*50}%"></span></div>`;
  }
  function renderLesson(focus=true) {
    const lesson = byId.get(currentId), state = detail.state;
    let html = lessonHeader(lesson,state) + '<section class="panel">';
    if (state.view === 'home') {
      html += `<p class="kicker">Start van de les</p><h2>Drie stukken theorie, daarna zes vragen</h2><p>Na elke vraag krijg je direct uitleg. Je eerste antwoord wordt bewaard voor je eerste score.</p><div class="actions">${button('resume','Start deze les',true)}</div>`;
    } else if (state.view === 'theory') {
      const card = lesson.theory[state.step];
      html += `<ol class="steps" aria-label="Theoriestappen">${lesson.theory.map((_,index) => `<li class="${index === state.step?'current':index < state.step?'finished':''}">Deel ${index+1}</li>`).join('')}</ol><p class="kicker">Theorie ${state.step+1} van 3</p><h2>${esc(card.title)}</h2><p>${esc(card.body)}</p><div class="actions">${button('prev','Vorige',false,`data-step="${state.step}" ${state.step===0?'disabled':''}`)}${state.step < 2 ? button('step','Volgende theorie',true,`data-step="${state.step}"`) : button('read',state.read?'Verder met de vragen':'Theorie gelezen · Start vragen',true)}</div>`;
      if (state.read) html += `<div class="actions">${button('back-quiz', count(state.round) === 6 ? 'Bekijk resultaat' : 'Terug naar de vragen')}</div>`;
    } else if (state.view === 'quiz') {
      const question = lesson.questions[state.question], answer = state.round[state.question], feedback = detail.feedback[state.question];
      html += `<p class="kicker">Vraag ${state.question+1} van 6</p><form id="answer-form"><fieldset ${answer!==null?'disabled':''}><legend>${esc(question.q)}</legend>${questionTable(question.table)}<div class="options">${question.options.map((option,index) => `<label class="option ${answer!==null?'locked':''}"><input type="radio" name="answer" value="${index}" ${answer===index?'checked':''} required><span class="letter">${'ABC'[index]}.</span><span>${esc(option)}</span></label>`).join('')}</div></fieldset>${answer===null?'<div class="actions"><button class="primary" type="submit" disabled>Bevestig antwoord</button></div>':''}</form>`;
      if (answer !== null && feedback) html += `<div class="feedback ${answer===feedback.correct?'':'wrong'}" role="status"><h3>${answer===feedback.correct?'Goed beantwoord.':'Nog niet goed.'} Het juiste antwoord is ${'ABC'[feedback.correct]}.</h3><p>${esc(feedback.explanation)}</p></div><div class="actions">${button('next',state.question===5?'Bekijk resultaat':'Volgende vraag',true,`data-question="${state.question}" data-round="${state.roundId}"`)}</div>`;
      html += `<div class="actions">${button('theory','Theorie teruglezen')}</div>`;
    } else {
      html += `<p class="kicker">Les doorlopen</p><h2>Je hebt alle onderdelen afgerond</h2><p class="score">${detail.firstScore} <small>van 6 punten bij de eerste poging</small></p><div class="result-grid"><div><strong>${detail.roundScore} / 6</strong><br><span>Score in deze oefenronde</span></div><div><strong>Doorlopen</strong><br><span>Theorie gelezen en alle vragen beantwoord</span></div></div><p>Er is geen slaaggrens. Opnieuw oefenen verandert je eerste score niet.</p><div class="actions">${button('repeat','Vragen opnieuw oefenen',true)}${button('theory','Theorie teruglezen')}${nextLessonButton()}</div><div class="review-list"><h3>Antwoorden van deze ronde</h3>${lesson.questions.map((question,index) => { const answer=state.round[index], feedback=detail.feedback[index]; return `<article class="review"><strong>Vraag ${index+1}: ${answer===feedback?.correct?'goed':'nog niet goed'}</strong><p>${esc(feedback?.explanation || '')}</p></article>`; }).join('')}</div>`;
    }
    main.innerHTML = html + '</section>';
    if (focus) { main.focus(); main.scrollIntoView({block:'start'}); }
  }
  function nextLessonButton() { const index = curriculum.findIndex(lesson => lesson.id === currentId); return index >= 0 && index < curriculum.length-1 ? button('next-lesson','Naar de volgende les',false,`data-id="${curriculum[index+1].id}"`) : ''; }
  async function dispatch(event, focus=true) {
    if (busy) return; lock(true); message('Voortgang opslaan…');
    try { detail = await api({action:'event',lessonId:currentId,revision:detail.revision,event}); selected=null; message(); renderLesson(focus); }
    catch (error) { if (error.status === 409 && error.data?.state) { detail=error.data; selected=null; renderLesson(); } else if (error.status === 401) { forget(); loginView(); } message(error.message); }
    finally { lock(false); }
  }
  document.addEventListener('submit', event => {
    if (event.target.id === 'login-form') { event.preventDefault(); login(document.getElementById('code').value); return; }
    if (event.target.id !== 'answer-form') return; event.preventDefault();
    if (![0,1,2].includes(selected)) return;
    dispatch({type:'answer',value:selected,question:detail.state.question,roundId:detail.state.roundId},false);
  });
  document.addEventListener('change', event => { if (event.target.matches('input[name=answer]')) { selected=Number(event.target.value); main.querySelector('button[type=submit]').disabled=false; } });
  document.addEventListener('click', event => {
    if (event.detail > 1 && event.target.closest('button,input,label')) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const element = event.target.closest('[data-action]'); if (!element) return; event.preventDefault(); const action=element.dataset.action;
    if (action === 'show-code') { const input=document.getElementById('code'),show=input.type==='password'; input.type=show?'text':'password'; element.textContent=show?'Code verbergen':'Code tonen'; return; }
    if (action === 'help') { document.getElementById('help-dialog').showModal(); return; }
    if (action === 'close-help') { document.getElementById('help-dialog').close(); return; }
    if (action === 'privacy') { document.getElementById('privacy-dialog').showModal(); return; }
    if (action === 'close-privacy') { document.getElementById('privacy-dialog').close(); return; }
    if (action === 'logout') { logout(); return; }
    if (action === 'dashboard') { if (token) load(); return; }
    if (action === 'open-lesson') { openLesson(element.dataset.id); return; }
    if (action === 'next-lesson') { load().then(() => openLesson(element.dataset.id)); return; }
    if (!detail) return;
    if (action === 'step' || action === 'prev') { dispatch({type:'step',delta:action==='step'?1:-1,step:Number(element.dataset.step)}); return; }
    if (action === 'next') { dispatch({type:'next',question:Number(element.dataset.question),roundId:Number(element.dataset.round)}); return; }
    dispatch({type:action});
  });
  try { token = sessionStorage.getItem(sessionKey) || ''; } catch {}
  if (token) { main.innerHTML='<p>Je opgeslagen voortgang laden…</p>'; load(); } else loginView();
})();
