/* GTA VI / Leonida trophy guide.
   Classic script, no modules, no fetch: everything it needs is in window.GTA6, written by
   data/data.js, so the app works both from disk and over a static server. */

(function () {
  'use strict';

  var DATA = window.GTA6 || { meta: {}, trophies: [], roadmap: { stages: [] }, missables: { entries: [] } };
  var META = DATA.meta || {};
  var TROPHIES = DATA.trophies.slice();
  var ROADMAP = DATA.roadmap || { stages: [] };
  var MISSABLES = DATA.missables || { entries: [] };

  var KEY = 'gta6-tg-v1';
  var GRADE_LETTER = { platinum: 'P', gold: 'G', silver: 'S', bronze: 'B' };
  var GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

  /* ---------- state ---------- */
  var store = load();

  var state = {
    view: 'checklist',
    grade: 'all',
    missableOnly: false,
    chapter: 'all',
    difficulty: 'all',
    q: '',
    sort: 'order',
    selected: null,
    missSelected: null,
    spoilers: !!store.spoilers,
    openStage: null
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { done: [], spoilers: false };
      var parsed = JSON.parse(raw);
      return { done: Array.isArray(parsed.done) ? parsed.done : [], spoilers: !!parsed.spoilers };
    } catch (e) {
      return { done: [], spoilers: false };
    }
  }

  var demoMode = false;

  function save() {
    if (demoMode) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ done: Array.from(done), spoilers: state.spoilers }));
    } catch (e) { /* private mode, file:// restrictions: the guide still works */ }
  }

  var done = new Set(store.done.map(Number));

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtMinutes(m) {
    m = Number(m) || 0;
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    var r = m % 60;
    return r ? h + 'h ' + r + 'm' : h + 'h';
  }

  function shortMinutes(m) {
    m = Number(m) || 0;
    if (m < 60) return m + 'm';
    var h = Math.floor(m / 60);
    var r = m % 60;
    return r ? h + 'h' + r : h + 'h';
  }

  function shortChapter(ch) {
    if (!ch) return '';
    if (ch.indexOf('Chapter') === 0) {
      var parts = ch.split(' -- ');
      var num = parts[0].replace('Chapter ', 'Ch ');
      return num;
    }
    return ch.split(' -- ')[0];
  }

  function chapterLabel(ch) {
    return ch ? ch.replace(' -- ', ', ') : '';
  }

  function dots(n) {
    var out = '<span class="dots">';
    for (var i = 1; i <= 5; i++) out += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return out + '</span>';
  }

  function isSpoilerBlurred(t) {
    return state.spoilers && !!t.spoiler;
  }

  var byId = {};
  TROPHIES.forEach(function (t) { byId[t.id] = t; });

  /* ---------- filtering ---------- */
  function matches(t) {
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (state.missableOnly && !t.missable) return false;
    if (state.chapter !== 'all' && String(t.chapterIndex) !== String(state.chapter)) return false;
    if (state.difficulty !== 'all' && String(t.difficulty) !== String(state.difficulty)) return false;
    if (state.q) {
      var needle = state.q.toLowerCase();
      var hay = [t.name, t.description, t.hint, t.where, t.chapter, t.guide, (t.sources || []).join(' ')].join(' ').toLowerCase();
      if (hay.indexOf(needle) === -1) return false;
    }
    return true;
  }

  function sortFn(a, b) {
    if (state.sort === 'difficulty') {
      if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;
      return a.order - b.order;
    }
    if (state.sort === 'time') {
      if (b.minutes !== a.minutes) return b.minutes - a.minutes;
      return a.order - b.order;
    }
    if (state.sort === 'chapter') {
      if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex - b.chapterIndex;
      return a.order - b.order;
    }
    return a.order - b.order;
  }

  function visible() {
    return TROPHIES.filter(matches).sort(sortFn);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var total = TROPHIES.length;
    var n = done.size;
    document.getElementById('doneCount').textContent = String(n);
    document.getElementById('doneBar').style.width = (total ? (n / total) * 100 : 0).toFixed(1) + '%';

    var counts = { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [0, 0] };
    TROPHIES.forEach(function (t) {
      var c = counts[t.grade];
      if (!c) return;
      c[1] += 1;
      if (done.has(t.id)) c[0] += 1;
    });
    document.getElementById('gradeBreak').innerHTML = GRADE_ORDER.map(function (g) {
      return '<span class="bg-' + g + '">' + GRADE_LETTER[g] + '</span> <b>' + counts[g][0] + '</b>/' + counts[g][1];
    }).join('');
  }

  /* ---------- filters ---------- */
  function buildFilters() {
    var chapterSel = document.getElementById('chapterSel');
    var chapters = META.chapters || [];
    var opts = ['<option value="all">Chapter: all</option>'];
    chapters.forEach(function (ch, i) {
      opts.push('<option value="' + i + '">' + esc(ch.replace(' -- ', ', ')) + '</option>');
    });
    chapterSel.innerHTML = opts.join('');

    var diffSel = document.getElementById('diffSel');
    var dlabels = ['Difficulty: any', 'Difficulty: 1', 'Difficulty: 2', 'Difficulty: 3', 'Difficulty: 4', 'Difficulty: 5'];
    diffSel.innerHTML = dlabels.map(function (l, i) {
      return '<option value="' + (i === 0 ? 'all' : i) + '">' + l + '</option>';
    }).join('');

    var sortSel = document.getElementById('sortSel');
    sortSel.innerHTML = [
      '<option value="order">Recommended order</option>',
      '<option value="difficulty">Hardest first</option>',
      '<option value="time">Quickest first</option>',
      '<option value="chapter">Chapter order</option>'
    ].join('');

    document.getElementById('gradeChips').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-grade]');
      if (!btn) return;
      state.grade = btn.getAttribute('data-grade');
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b === btn);
      });
      renderList();
    });

    var mchip = document.getElementById('missableChip');
    mchip.addEventListener('click', function () {
      state.missableOnly = !state.missableOnly;
      mchip.classList.toggle('on', state.missableOnly);
      mchip.setAttribute('aria-pressed', String(state.missableOnly));
      renderList();
    });

    chapterSel.addEventListener('change', function () { state.chapter = this.value; renderList(); });
    diffSel.addEventListener('change', function () { state.difficulty = this.value; renderList(); });
    sortSel.addEventListener('change', function () { state.sort = this.value; renderList(); });

    var q = document.getElementById('q');
    q.addEventListener('input', function () { state.q = this.value.trim(); renderList(); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { this.value = ''; state.q = ''; renderList(); } });

    var sp = document.getElementById('spoilers');
    sp.addEventListener('change', function () {
      state.spoilers = this.checked;
      save();
      renderDetail();
      renderMissDetail();
      document.body.classList.toggle('spoilers-on', state.spoilers);
    });
  }

  function syncFilterControls() {
    document.getElementById('chapterSel').value = String(state.chapter);
    document.getElementById('diffSel').value = String(state.difficulty);
    document.getElementById('sortSel').value = state.sort;
    document.getElementById('spoilers').checked = state.spoilers;
    document.getElementById('missableChip').classList.toggle('on', state.missableOnly);
    document.getElementById('q').value = state.q;
    Array.prototype.forEach.call(document.querySelectorAll('#gradeChips button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-grade') === state.grade);
    });
  }

  /* ---------- checklist ---------- */
  function renderList() {
    var list = document.getElementById('list');
    var rows = visible();
    var capped = rows.slice(0, 400);

    if (!rows.length) {
      list.innerHTML = '<li class="empty">No trophy matches those filters. Clear the search or set grade back to All 55.</li>';
    } else {
      list.innerHTML = capped.map(rowHtml).join('');
    }

    document.getElementById('shownCount').innerHTML = '<b>' + rows.length + '</b> of ' + TROPHIES.length + ' shown';
    document.getElementById('listHeadLabel').textContent = rows.length === TROPHIES.length ? 'All ' + TROPHIES.length + ' trophies' : 'Filtered trophies';
    document.getElementById('listHeadCount').textContent = done.size + ' ticked';

    if (!state.selected || !byId[state.selected] || !rows.some(function (t) { return t.id === state.selected; })) {
      state.selected = rows.length ? rows[0].id : null;
    }
    renderDetail();

    // a deep link can select a trophy that sits below the fold: bring it into view once
    if (state.focusSel) {
      state.focusSel = false;
      var sel = list.querySelector('.row.sel');
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'center' });
    }

    renderHeader();
  }

  function rowHtml(t) {
    var isDone = done.has(t.id);
    return '' +
      '<li class="row' + (isDone ? ' done' : '') + (t.id === state.selected ? ' sel' : '') + '" data-id="' + t.id + '">' +
        '<button class="tick" aria-label="Tick ' + esc(t.name) + '" aria-pressed="' + isDone + '"></button>' +
        '<span class="badge ' + t.grade + '" title="' + t.grade + '">' + GRADE_LETTER[t.grade] + '</span>' +
        '<div class="rtext">' +
          '<div class="rname">' + esc(t.name) + '</div>' +
          '<div class="rhint">' + esc(t.hint || t.description) + '</div>' +
        '</div>' +
        '<div class="rmeta">' +
          '<span class="ch">' + esc(shortChapter(t.chapter)) + '</span>' +
          '<span class="d">' + dots(t.difficulty) + '</span>' +
          '<span>' + shortMinutes(t.minutes) + '</span>' +
          (t.missable ? '<span class="flag">MISS</span>' : '') +
        '</div>' +
      '</li>';
  }

  function renderDetail() {
    var host = document.getElementById('detail');
    var t = byId[state.selected];
    if (!t) {
      host.innerHTML = '<p class="empty">Pick a trophy on the left.</p>';
      return;
    }
    var blurred = isSpoilerBlurred(t);
    var spClass = 'spoiler' + (blurred ? ' blur' : '');

    var html = '' +
      '<div class="d-top">' +
        '<span class="badge lg ' + t.grade + '">' + GRADE_LETTER[t.grade] + '</span>' +
        '<span class="gword">' + t.grade + '</span>' +
        '<span class="ctag">' + esc(chapterLabel(t.chapter)) + '</span>' +
      '</div>' +
      '<h2 class="d-name">' + esc(t.name) + (t.spoiler ? '<span class="sptag">spoiler</span>' : '') + '</h2>' +
      '<p class="d-desc">' + esc(t.description) + '</p>' +
      '<dl class="d-stats">' +
        '<div><dt>Chapter</dt><dd>' + esc(shortChapter(t.chapter)) + '</dd></div>' +
        '<div><dt>Where</dt><dd>' + esc(t.where || 'Statewide') + '</dd></div>' +
        '<div><dt>Difficulty</dt><dd>' + dots(t.difficulty) + '</dd></div>' +
        '<div><dt>Time</dt><dd>' + fmtMinutes(t.minutes) + '</dd></div>' +
      '</dl>';

    if (t.missable) {
      html += '<div class="d-warn"><span><b>Missable</b>' + esc(t.missableNote || 'This one can be lost.') + '</span></div>';
    }

    html += '<h4 class="d-sec">Walkthrough' + (blurred ? ' -- click to read' : '') + '</h4>' +
      '<div class="' + spClass + '" data-spoiler="1">' +
        '<ol class="steps">' + t.steps.map(function (s, i) {
          return '<li><span class="n">' + (i + 1) + '</span><span>' + esc(s) + '</span></li>';
        }).join('') + '</ol>' +
      '</div>';

    html += '<div class="d-src"><h4 class="d-sec">Verify in game</h4><ul>' +
      t.sources.map(function (s) { return '<li><span>' + esc(s) + '</span></li>'; }).join('') +
      '</ul></div>';

    html += '<p class="d-note">' + esc(t.type || 'trophy') + ' -- roadmap ' + esc(t.stageName || '') +
      ' -- recommended position ' + t.order + ' of ' + TROPHIES.length +
      (t.missable ? ' -- keep a manual save before the lock' : '') + '</p>';

    host.innerHTML = html;
  }

  function toggleDone(id) {
    if (done.has(id)) done.delete(id); else done.add(id);
    save();
    var row = document.querySelector('.row[data-id="' + id + '"]');
    if (row) {
      row.classList.toggle('done', done.has(id));
      var tick = row.querySelector('.tick');
      if (tick) tick.setAttribute('aria-pressed', String(done.has(id)));
    }
    renderHeader();
    document.getElementById('listHeadCount').textContent = done.size + ' ticked';
  }

  /* ---------- roadmap ---------- */
  function renderRoadmap() {
    var left = document.getElementById('rmLeft');
    var right = document.getElementById('rmRight');
    var first = ROADMAP.first || { title: 'Do this first', items: [] };
    var stages = ROADMAP.stages || [];

    left.innerHTML = '' +
      '<div class="card first">' +
        '<h2>' + esc(first.title) + '</h2>' +
        '<p class="lead">' + esc(first.lead) + '</p>' +
        '<ol>' + (first.items || []).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ol>' +
      '</div>' +
      '<div class="card hours-card">' +
        '<div class="big">' + esc(String(ROADMAP.totalHours || '')) + '</div>' +
        '<div><div class="lbl">hours to platinum</div>' +
        '<div class="sub">' + stages.length + ' stages, one playthrough. A second run to recover a missable adds about 20 hours.</div></div>' +
      '</div>' +
      '<div class="card">' +
        '<h2>Ground rules</h2>' +
        '<ul class="grule">' + (ROADMAP.assumptions || []).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
      '</div>';

    right.innerHTML = stages.map(function (st) {
      var pct = ROADMAP.totalHours ? Math.round((st.hours / ROADMAP.totalHours) * 100) : 0;
      var open = state.openStage === st.id;
      var got = (st.trophies || []).filter(function (id) { return done.has(id); }).length;
      return '' +
        '<article class="stage' + (st.missable && st.missable.length ? ' lock' : '') + (open ? ' open' : '') + '" data-stage="' + st.id + '">' +
          '<div>' +
            '<h3 class="sname">' + esc(st.name) + '</h3>' +
            '<p class="ssum">' + esc(st.todo && st.todo.length && open ? st.summary : st.short || st.summary) + '</p>' +
            (open
              ? '<ul class="stodo">' + st.todo.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
              : '') +
            '<div class="smeta">' +
              '<span><b>' + st.count + '</b> trophies</span>' +
              (got ? '<span class="sgot">' + got + ' ticked</span>' : '') +
              '<span>' + esc(st.window) + '</span>' +
              (st.missable && st.missable.length ? '<span class="lockflag">' + st.missable.length + ' missable lock' + (st.missable.length > 1 ? 's' : '') + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="hcol">' +
            '<div class="h">' + esc(String(st.hours)) + '</div>' +
            '<div class="u">hours</div>' +
            '<div class="t">' + pct + '% of run</div>' +
          '</div>' +
        '</article>';
    }).join('') + '<div class="rm-foot"><b>Hours check:</b> ' + esc(ROADMAP.hoursNote || '') + '</div>';
  }

  /* ---------- missables ---------- */
  function renderMissables() {
    var entries = MISSABLES.entries || [];
    document.getElementById('missHeadCount').textContent = done.size + ' ticked';

    var list = document.getElementById('mlist');
    list.innerHTML = entries.slice().sort(function (a, b) { return a.order - b.order; }).map(function (e) {
      var t = byId[e.id] || {};
      return '' +
        '<li class="mrow' + (e.id === state.missSelected ? ' sel' : '') + '" data-mid="' + e.id + '">' +
          '<span class="badge ' + (t.grade || 'bronze') + '">' + (GRADE_LETTER[t.grade] || 'B') + '</span>' +
          '<div style="min-width:0">' +
            '<div class="mname">' + esc(e.name) + '</div>' +
            '<div class="mlock">' + esc(e.lockPoint) + '</div>' +
          '</div>' +
          '<span class="mflag">' + esc(e.flag) + '</span>' +
        '</li>';
    }).join('');

    if (!state.missSelected || !entries.some(function (e) { return e.id === state.missSelected; })) {
      state.missSelected = entries.length ? entries[0].id : null;
    }
    var foot = document.getElementById('missFoot');
    if (foot) foot.textContent = MISSABLES.footNote || '';
    renderMissDetail();
  }

  function renderMissDetail() {
    var host = document.getElementById('mdetail');
    var e = (MISSABLES.entries || []).filter(function (x) { return x.id === state.missSelected; })[0];
    if (!e) { host.innerHTML = '<p class="empty">No missable trophies.</p>'; return; }
    var t = byId[e.id] || {};
    var blurred = state.spoilers;
    var spClass = 'spoiler' + (blurred ? ' blur' : '');

    host.innerHTML = '' +
      '<div class="mbanner">' +
        '<span class="badge lg ' + (t.grade || 'bronze') + '">' + (GRADE_LETTER[t.grade] || 'B') + '</span>' +
        '<span class="gword">' + esc((t.grade || 'bronze') + ' -- missable') + '</span>' +
        '<span class="ctag">' + esc(chapterLabel(t.chapter || '')) + '</span>' +
      '</div>' +
      '<h2>' + esc(e.name) + '</h2>' +
      '<div class="mgrp"><h4>Locks</h4><p><span class="sev">' + esc(e.severity) + '</span> -- ' + esc(e.lockPoint) + '</p></div>' +
      '<div class="mgrp"><h4>What happens' + (blurred ? '<span class="rhr">click to reveal</span>' : '') + '</h4><p class="' + spClass + '" data-spoiler="1">' + esc(e.lockDetail) + '</p></div>' +
      '<div class="mgrp"><h4>Before the lock</h4><p class="act">' + esc(e.action) + '</p></div>' +
      '<div class="mgrp"><h4>If you already crossed it</h4><p>' + esc(e.recovery) + '</p></div>' +
      (t.sources && t.sources.length
        ? '<div class="mgrp"><h4>Check it in game</h4><ul class="msrc">' + t.sources.map(function (s) {
            return '<li>' + esc(s) + '</li>';
          }).join('') + '</ul></div>'
        : '') +
      '<p class="mhint">' + esc(MISSABLES.checkpointAdvice || '') + '</p>' +
      '<p class="mhint">Trophy detail: ' + esc((t.hint || t.description || '').replace(/\.\s*$/, '')) + ' -- ' + fmtMinutes(t.minutes || 0) + ', difficulty ' + esc(String(t.difficulty || '')) + ' of 5.</p>';
  }

  /* ---------- views ---------- */
  function setView(view) {
    state.view = view;
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
      v.classList.toggle('on', v.id === 'view-' + view);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      var on = b.getAttribute('data-view') === view;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    document.getElementById('filters').style.display = view === 'checklist' ? 'flex' : 'none';
    if (view === 'roadmap') renderRoadmap();
    if (view === 'missables') renderMissables();
  }

  /* ---------- wiring ---------- */
  function wire() {
    document.getElementById('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-view]');
      if (b) setView(b.getAttribute('data-view'));
    });

    document.getElementById('list').addEventListener('click', function (e) {
      var row = e.target.closest('.row');
      if (!row) return;
      var id = Number(row.getAttribute('data-id'));
      if (e.target.closest('.tick')) { toggleDone(id); return; }
      state.selected = id;
      Array.prototype.forEach.call(this.querySelectorAll('.row'), function (r) {
        r.classList.toggle('sel', Number(r.getAttribute('data-id')) === id);
      });
      renderDetail();
    });

    document.getElementById('mlist').addEventListener('click', function (e) {
      var row = e.target.closest('.mrow');
      if (!row) return;
      state.missSelected = Number(row.getAttribute('data-mid'));
      Array.prototype.forEach.call(this.querySelectorAll('.mrow'), function (r) {
        r.classList.toggle('sel', Number(r.getAttribute('data-mid')) === state.missSelected);
      });
      renderMissDetail();
    });

    document.getElementById('rmRight').addEventListener('click', function (e) {
      var st = e.target.closest('.stage');
      if (!st) return;
      var id = st.getAttribute('data-stage');
      state.openStage = state.openStage === id ? null : id;
      renderRoadmap();
    });

    // spoilers: click a blurred block to read it
    document.addEventListener('click', function (e) {
      var sp = e.target.closest('.spoiler.blur');
      if (!sp) return;
      sp.classList.remove('blur');
      sp.classList.add('revealed');
      e.stopPropagation();
    });
  }

  /* ---------- boot ---------- */
  function applyUrl() {
    var q = new URLSearchParams(location.search);
    var hash = location.hash.replace('#', '');
    if (hash) {
      var hp = new URLSearchParams(hash);
      q.forEach(function (v, k) { if (!hp.has(k)) hp.set(k, v); });
      q = hp;
    }
    if (q.get('view')) state.view = q.get('view');
    if (q.get('spoilers')) state.spoilers = q.get('spoilers') !== '0' && q.get('spoilers') !== 'false';
    if (q.get('grade')) state.grade = q.get('grade');
    if (q.get('sort')) state.sort = q.get('sort');
    if (q.get('q')) state.q = q.get('q');
    if (q.get('done')) {
      var n = Math.max(0, Math.min(TROPHIES.length, parseInt(q.get('done'), 10) || 0));
      TROPHIES.slice().sort(function (a, b) { return a.order - b.order; }).slice(0, n).forEach(function (t) {
        done.add(t.id);
      });
    }
    if (q.get('t')) {
      state.selected = Number(q.get('t'));
      state.focusSel = true;
    }
    if (q.get('m')) state.missSelected = Number(q.get('m'));
    state.urlDone = !!q.get('done');
  }

  function init() {
    document.title = 'GTA VI Trophy Guide -- ' + TROPHIES.length + ' trophies, ' + (ROADMAP.headline || 'one playthrough');
    buildFilters();
    wire();
    applyUrl();
    if (state.urlDone) {
      // demo ticks supplied by a link: shown, but never written over the player's own progress
      demoMode = true;
    }
    syncFilterControls();
    setView(state.view);
    renderList();
    renderHeader();
    document.body.classList.toggle('spoilers-on', state.spoilers);
    window.__ready = true;
    document.documentElement.setAttribute('data-ready', '1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
