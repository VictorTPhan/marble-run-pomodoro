(function (global) {
  'use strict';

  var NAMES = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
  var COLORS = { focus: '#ff3b5c', short: '#2ee07a', long: '#38a1ff' };

  function Pomodoro() {
    this.config = { focus: 25, short: 5, long: 15, rounds: 4 };
    this.mode = 'focus';
    this.sessions = 0;
    this.remaining = this.config.focus * 60;
    this.running = false;
    this.endAt = 0;
    this.autoStart = true;
    this._iv = null;
    this.hooks = { tick: null, start: null, pause: null, reset: null, complete: null, mode: null };
  }

  Pomodoro.prototype.on = function (name, fn) {
    this.hooks[name] = fn;
  };

  Pomodoro.prototype.durationOf = function (mode) {
    return this.config[mode] * 60;
  };

  Pomodoro.prototype._fire = function (name) {
    if (this.hooks[name]) this.hooks[name].apply(this, Array.prototype.slice.call(arguments, 1));
  };

  Pomodoro.prototype.switchMode = function (mode) {
    this.mode = mode;
    this.running = false;
    if (this._iv) { clearInterval(this._iv); this._iv = null; }
    this.remaining = this.durationOf(mode);
    this._fire('mode', mode);
    this._fire('tick', this.remaining, this.durationOf(mode));
  };

  Pomodoro.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.endAt = Date.now() + this.remaining * 1000;
    this._fire('start');
    var self = this;
    this._iv = setInterval(function () { self._tick(); }, 200);
    this._tick();
  };

  Pomodoro.prototype._tick = function () {
    this.remaining = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
    this._fire('tick', this.remaining, this.durationOf(this.mode));
    if (this.remaining <= 0) {
      this.pause();
      this._complete();
    }
  };

  Pomodoro.prototype.pause = function () {
    this.running = false;
    if (this._iv) { clearInterval(this._iv); this._iv = null; }
    this._fire('pause');
  };

  Pomodoro.prototype.toggle = function () {
    if (this.running) this.pause();
    else this.start();
  };

  Pomodoro.prototype.reset = function () {
    this.pause();
    this.remaining = this.durationOf(this.mode);
    this._fire('reset');
    this._fire('tick', this.remaining, this.durationOf(this.mode));
  };

  Pomodoro.prototype.skip = function () {
    if (this.running) this.pause();
    this._complete();
  };

  Pomodoro.prototype._complete = function () {
    var prev = this.mode;
    if (prev === 'focus') {
      this.sessions++;
      this.switchMode(this.sessions % this.config.rounds === 0 ? 'long' : 'short');
    } else {
      this.switchMode('focus');
    }
    this._fire('complete', prev, this.mode);
    if (this.autoStart) this.start();
  };

  global.Pomodoro = Pomodoro;
  global.PomodoroInfo = { NAMES: NAMES, COLORS: COLORS };
})(window);