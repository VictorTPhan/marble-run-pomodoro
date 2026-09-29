(function (global) {
  'use strict';

  var T = global.Tiles;

  var SPEED = { curve: 1, straight: 1, spring: 2.1, chute: 1.6, cross: 1, spawn: 1.35 };
  var MARBLE_COLORS = ['#ff4d5e', '#4d9bff', '#ffd028', '#a06bff', '#2ee07a', '#ff7a1a'];
  var MAX_BALLS = 10;
  var BASE = 175;
  var SPAWN_EVERY = 60;

  function shade(hex, amt) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function marbleBg(color) {
    return 'radial-gradient(circle at 32% 30%, #fff 0%, ' + color + ' 36%, ' + shade(color, -26) + ' 82%)';
  }

  function MarbleRun(runEl) {
    this.runEl = runEl;
    this.cols = 12;
    this.rows = 7;
    this.loop = [];
    this.loopKeys = {};
    this.spawn = null;
    this.balls = [];
    this.running = false;
    this.paused = false;
    this.idle = true;
    this.spawnTimer = 0;
    this.ballCounter = 0;
    this._raf = 0;
    this._last = 0;
    this.hud = {};
  }

  MarbleRun.prototype.configureHud = function (hud) {
    this.hud = hud || {};
  };

  MarbleRun.prototype.generate = function () {
    var gen = global.MarbleGen.generate(this.cols, this.rows);
    this.loop = gen.cells;
    this.loopKeys = {};
    for (var i = 0; i < this.loop.length; i++) {
      this.loopKeys[this.loop[i].x + ',' + this.loop[i].y] = this.loop[i];
    }
    this.spawn = gen.spawn;
  };

  MarbleRun.prototype.renderCells = function (cells) {
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var el = document.createElement('div');
      el.className = 'tile' + (cell.active ? ' active' : ' inactive');
      el.style.setProperty('--tile', cell.active ? T.TYPES[cell.type].color : '#aeb9c3');
      el.innerHTML = T.tileSVG(cell);
      this.runEl.appendChild(el);
      if (cell.active) {
        cell.el = el;
        var track = el.querySelector('.track');
        cell.pathEl = track;
        cell.pathLen = track ? track.getTotalLength() : 100;
      }
    }
  };

  MarbleRun.prototype.build = function () {
    this.generate();
    this.runEl.innerHTML = '';
    this.runEl.style.gridTemplateColumns = 'repeat(' + this.cols + ', 1fr)';
    this.runEl.style.aspectRatio = this.cols + ' / ' + this.rows;

    var cells = [];
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        var k = x + ',' + y;
        if (this.loopKeys[k]) {
          cells.push(this.loopKeys[k]);
        } else {
          var entry = T.DIRS[Math.floor(Math.random() * 4)];
          var exit = T.DIRS[Math.floor(Math.random() * 4)];
          if (exit === entry) exit = T.opposite(entry);
          var type = T.DECOR_TYPES[Math.floor(Math.random() * T.DECOR_TYPES.length)];
          cells.push({ x: x, y: y, entry: entry, exit: exit, type: type, active: false });
        }
      }
    }
    this.renderCells(cells);
  };

  MarbleRun.prototype.buildDecor = function () {
    this.runEl.innerHTML = '';
    this.runEl.style.gridTemplateColumns = 'repeat(' + this.cols + ', 1fr)';
    this.runEl.style.aspectRatio = this.cols + ' / ' + this.rows;
    var cells = [];
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        var entry = T.DIRS[Math.floor(Math.random() * 4)];
        var exit = T.DIRS[Math.floor(Math.random() * 4)];
        if (exit === entry) exit = T.opposite(entry);
        var type = T.DECOR_TYPES[Math.floor(Math.random() * T.DECOR_TYPES.length)];
        cells.push({ x: x, y: y, entry: entry, exit: exit, type: type, active: false });
      }
    }
    this.renderCells(cells);
  };

  MarbleRun.prototype.start = function () {
    this.idle = false;
    this.build();
    this.spawnTimer = 0;
    this.running = true;
    this.paused = false;
    this.spawnBall();
    this._last = performance.now();
    this._frame();
    this._emitHud();
  };

  MarbleRun.prototype.restart = function () {
    this.start();
  };

  MarbleRun.prototype.pause = function () {
    this.paused = true;
    this._emitHud();
  };

  MarbleRun.prototype.resume = function () {
    this.paused = false;
    this._last = performance.now();
    this._frame();
    this._emitHud();
  };

  MarbleRun.prototype.destroy = function () {
    cancelAnimationFrame(this._raf);
  };

  MarbleRun.prototype.stop = function () {
    this.destroy();
    this.running = false;
    this.balls = [];
    this.idle = true;
    this.buildDecor();
    this._emitHud();
  };

  MarbleRun.prototype.spawnBall = function () {
    if (this.balls.length >= MAX_BALLS) return null;
    var tile = this.spawn;
    var el = document.createElement('div');
    el.className = 'ball entering';
    var color = MARBLE_COLORS[this.ballCounter % MARBLE_COLORS.length];
    el.style.background = marbleBg(color);
    el.style.width = ((100 / this.cols) * 0.62) + '%';
    el.style.height = ((100 / this.rows) * 0.62) + '%';
    this.runEl.appendChild(el);

    var ball = {
      el: el,
      idx: 0,
      dist: tile.pathLen * 0.5,
      pathEl: tile.pathEl,
      len: tile.pathLen,
      speed: BASE * (SPEED[tile.type] || 1)
    };
    this.balls.push(ball);
    this.ballCounter++;
    requestAnimationFrame(function () { el.classList.remove('entering'); });
    return ball;
  };

  MarbleRun.prototype._frame = function () {
    if (!this.running || this.paused) return;
    var self = this;
    this._raf = requestAnimationFrame(function (now) {
      var dt = Math.min(0.05, Math.max(0, (now - self._last) / 1000));
      self._last = now;
      self._step(dt);
      self._frame();
    });
  };

  MarbleRun.prototype._step = function (dt) {
    var L = this.loop.length;
    for (var i = 0; i < this.balls.length; i++) {
      var b = this.balls[i];
      b.dist += b.speed * dt;
      while (b.dist >= b.len && L > 0) {
        b.dist -= b.len;
        b.idx = (b.idx + 1) % L;
        var t = this.loop[b.idx];
        b.pathEl = t.pathEl;
        b.len = t.pathLen || 100;
        b.speed = BASE * (SPEED[t.type] || 1);
      }
      var pt = b.pathEl.getPointAtLength(b.dist);
      var ct = this.loop[b.idx];
      b.el.style.left = ((ct.x * 100 + pt.x) / this.cols) + '%';
      b.el.style.top = ((ct.y * 100 + pt.y) / this.rows) + '%';
    }

    if (this.balls.length < MAX_BALLS) {
      this.spawnTimer += dt * 1000;
      if (this.spawnTimer >= SPAWN_EVERY * 1000) {
        this.spawnTimer -= SPAWN_EVERY * 1000;
        this.spawnBall();
      }
    }
    this._emitHud();
  };

  MarbleRun.prototype._emitHud = function () {
    if (!this.hud.balls || !this.hud.next || !this.hud.state) return;
    var state = this.idle ? 'idle' : (this.paused ? 'paused' : 'running');
    this.hud.state.setAttribute('data-state', state);
    if (this.idle) {
      this.hud.balls.textContent = 'Marbles: 0';
      this.hud.next.textContent = 'Next marble in: --:--';
      return;
    }
    var remaining = Math.max(0, SPAWN_EVERY - this.spawnTimer / 1000);
    var mm = Math.floor(remaining / 60);
    var ss = Math.floor(remaining % 60);
    this.hud.balls.textContent = 'Marbles: ' + this.balls.length + ' / ' + MAX_BALLS;
    this.hud.next.textContent = 'Next marble in: ' + mm + (ss < 10 ? ':0' : ':') + ss;
  };

  global.MarbleRun = MarbleRun;
  global.MarbleRunConsts = { SPAWN_EVERY: SPAWN_EVERY, MAX_BALLS: MAX_BALLS };
})(window);