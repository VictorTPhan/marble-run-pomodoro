(function () {
  'use strict';

  var RING_C = 540.35;

  function byId(id) { return document.getElementById(id); }

  var runEl = byId('run');
  var timeEl = byId('time');
  var timeCaptionEl = byId('timeCaption');
  var ringFg = byId('ringFg');
  var card = byId('timerCard');
  var startBtn = byId('startBtn');
  var resetBtn = byId('resetBtn');
  var skipBtn = byId('skipBtn');
  var sessionsWrap = byId('sessions');
  var autoStartChk = byId('autoStart');

  var inFocus = byId('inFocus');
  var inShort = byId('inShort');
  var inLong = byId('inLong');
  var inRounds = byId('inRounds');

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));

  var run = new window.MarbleRun(runEl);
  run.configureHud({
    balls: byId('ballsHud'),
    next: byId('nextHud'),
    state: byId('stateTag')
  });

  var pom = new window.Pomodoro();

  var active = false;

  function fmt(s) {
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function clampInput(input, min, max, def) {
    var v = parseInt(input.value, 10);
    if (isNaN(v)) v = def;
    v = Math.max(min, Math.min(max, v));
    input.value = v;
    return v;
  }

  function paintSessions() {
    var done = pom.sessions % pom.config.rounds;
    var html = '';
    for (var i = 0; i < pom.config.rounds; i++) {
      html += '<span class="dot' + (i < done ? ' done' : '') + '"></span>';
    }
    sessionsWrap.innerHTML = html;
  }

  function paintTick(remaining, duration) {
    timeEl.textContent = fmt(remaining);
    timeCaptionEl.textContent = window.PomodoroInfo.NAMES[pom.mode];
    var frac = duration > 0 ? remaining / duration : 0;
    ringFg.style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(1);
    document.title = fmt(remaining) + ' \u00b7 ' + window.PomodoroInfo.NAMES[pom.mode];
  }

  function applyMode(mode) {
    card.className = 'card timer-card mode-' + mode;
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.mode === mode);
    }
  }

  function startSession() {
    if (!active) {
      active = true;
      run.start();
    } else {
      run.resume();
    }
    startBtn.textContent = 'Pause';
  }

  function stopSession() {
    active = false;
    run.stop();
    startBtn.textContent = 'Start';
  }

  pom.on('start', startSession);
  pom.on('pause', function () {
    run.pause();
    startBtn.textContent = 'Resume';
  });
  pom.on('reset', function () {
    stopSession();
  });
  pom.on('mode', function (mode) {
    applyMode(mode);
    paintSessions();
  });
  pom.on('tick', paintTick);
  pom.on('complete', function () {
    chime();
    stopSession();
  });

  function commitConfig() {
    pom.config.focus = clampInput(inFocus, 1, 120, 25);
    pom.config.short = clampInput(inShort, 1, 60, 5);
    pom.config.long = clampInput(inLong, 1, 120, 15);
    pom.config.rounds = clampInput(inRounds, 1, 12, 4);
    if (!pom.running && !active) {
      pom.remaining = pom.durationOf(pom.mode);
      paintTick(pom.remaining, pom.durationOf(pom.mode));
    }
    paintSessions();
  }

  startBtn.addEventListener('click', function () { pom.toggle(); });
  resetBtn.addEventListener('click', function () { pom.reset(); });
  skipBtn.addEventListener('click', function () { pom.skip(); });

  for (var t = 0; t < tabs.length; t++) {
    (function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.dataset.mode;
        if (pom.mode === target && !pom.running) return;
        pom.reset();
        pom.switchMode(target);
      });
    })(tabs[t]);
  }

  autoStartChk.addEventListener('change', function () { pom.autoStart = autoStartChk.checked; });

  [inFocus, inShort, inLong, inRounds].forEach(function (input) {
    input.addEventListener('change', commitConfig);
    input.addEventListener('blur', function () { if (!input.value) commitConfig(); });
  });

  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      pom.toggle();
    } else if (e.key === 'r' || e.key === 'R') {
      pom.reset();
    } else if (e.key === 's' || e.key === 'S') {
      pom.skip();
    }
  });

  function chime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!window.__ctx) window.__ctx = new Ctx();
      var ctx = window.__ctx;
      var notes = [523.25, 659.25, 783.99];
      for (var i = 0; i < notes.length; i++) {
        var t = ctx.currentTime + i * 0.16;
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = notes[i];
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.6);
      }
    } catch (err) {
      /* audio unavailable */
    }
  }

  paintSessions();
  applyMode(pom.mode);
  paintTick(pom.remaining, pom.durationOf(pom.mode));
  run.stop();
})();