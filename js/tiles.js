(function (global) {
  'use strict';

  var DIRS = ['up', 'right', 'down', 'left'];
  var DIRV = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  var OPP = { up: 'down', right: 'left', down: 'up', left: 'right' };

  var TYPES = {
    curve:    { name: 'Curve',    color: '#ff3b5c', light: '#ffe9ee', dark: '#d61a47' },
    straight: { name: 'Straight', color: '#ffc300', light: '#fff6d6', dark: '#d99a00' },
    spring:   { name: 'Spring',   color: '#2ee06a', light: '#dcfce7', dark: '#159a44' },
    chute:    { name: 'Chute',    color: '#38a1ff', light: '#dcf0ff', dark: '#1e6fd0' },
    cross:    { name: 'Crossing', color: '#9b5cff', light: '#ece4ff', dark: '#5f25c9' },
    spawn:    { name: 'Spawn',    color: '#ff7a1a', light: '#ffead6', dark: '#c9520c' }
  };

  var NEUTRAL = { light: '#eef3f6', color: '#c2cdd6', dark: '#9aa8b4' };

  var DECOR_TYPES = Object.keys(TYPES).filter(function (t) { return t !== 'spawn'; });

  function edgeCenter(d) {
    var m = { up: [50, 0], right: [100, 50], down: [50, 100], left: [0, 50] };
    return { x: m[d][0], y: m[d][1] };
  }

  function inward(d) {
    return { up: [0, 1], right: [-1, 0], down: [0, -1], left: [1, 0] }[d];
  }

  function dirFrom(a, b) {
    if (b.x === a.x) return b.y > a.y ? 'down' : 'up';
    return b.x > a.x ? 'right' : 'left';
  }

  function controlsFor(entry, exit) {
    var pe = edgeCenter(entry), px = edgeCenter(exit);
    var ie = inward(entry), ix = inward(exit);
    return {
      pe: pe,
      px: px,
      c1: { x: pe.x + ie[0] * 30, y: pe.y + ie[1] * 30 },
      c2: { x: px.x + ix[0] * 30, y: px.y + ix[1] * 30 }
    };
  }

  function pipeD(entry, exit) {
    var c = controlsFor(entry, exit);
    return 'M ' + c.pe.x + ' ' + c.pe.y +
      ' C ' + c.c1.x + ' ' + c.c1.y + ', ' + c.c2.x + ' ' + c.c2.y + ', ' + c.px.x + ' ' + c.px.y;
  }

  function bez(p0, c1, c2, p3, t) {
    var u = 1 - t, uu = u * u, tt = t * t;
    return {
      x: uu * u * p0.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + tt * t * p3.x,
      y: uu * u * p0.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + tt * t * p3.y
    };
  }

  function bezT(p0, c1, c2, p3, t) {
    var u = 1 - t;
    return {
      x: 3 * u * u * (c1.x - p0.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p3.x - c2.x),
      y: 3 * u * u * (c1.y - p0.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p3.y - c2.y)
    };
  }

  function tileSVG(cell) {
    var active = cell.active;
    var type = cell.type;
    var c = active ? TYPES[type] : NEUTRAL;
    var d = pipeD(cell.entry, cell.exit);
    var ctrl = controlsFor(cell.entry, cell.exit);
    var s = '';

    s += '<svg viewBox="0 0 100 100" class="tile-svg" aria-hidden="true">';
    s += '<rect x="4" y="4" width="92" height="92" rx="16" fill="' + c.light + '"/>';

    if (type === 'cross') {
      s += '<path class="track" d="' + d + '" fill="none" stroke="transparent"/>';
      s += '<path d="M 50 6 L 50 50 M 50 50 L 94 50 M 50 94 L 50 50 M 50 50 L 6 50" ' +
        'stroke="' + c.color + '" stroke-width="15" fill="none" stroke-linecap="round"/>';
      s += '<circle cx="50" cy="50" r="10" fill="' + c.dark + '"/>';
      s += '<circle cx="50" cy="50" r="4.5" fill="#fff"/>';
    } else {
      s += '<path class="track" d="' + d + '" stroke="' + c.dark + '" stroke-width="26" fill="none" stroke-linecap="round"/>';
      s += '<path class="track" d="' + d + '" stroke="' + c.color + '" stroke-width="22" fill="none" stroke-linecap="round"/>';
      s += '<path d="' + d + '" stroke="rgba(255,255,255,0.5)" stroke-width="7" fill="none" stroke-linecap="round" transform="translate(0,-3)"/>';
      s += '<circle cx="' + ctrl.pe.x + '" cy="' + ctrl.pe.y + '" r="9" fill="' + c.dark + '"/>';
      s += '<circle cx="' + ctrl.px.x + '" cy="' + ctrl.px.y + '" r="9" fill="' + c.dark + '"/>';
    }

    if (type === 'spring') {
      var pts = [];
      var N = 7;
      for (var i = 0; i <= N; i++) {
        var t = 0.5 - 0.26 + (0.52 * i) / N;
        var p = bez(ctrl.pe, ctrl.c1, ctrl.c2, ctrl.px, t);
        var tg = bezT(ctrl.pe, ctrl.c1, ctrl.c2, ctrl.px, t);
        var m = Math.hypot(tg.x, tg.y) || 1;
        var nx = -tg.y / m, ny = tg.x / m;
        var off = i % 2 === 0 ? 7 : -7;
        pts.push((p.x + nx * off).toFixed(1) + ',' + (p.y + ny * off).toFixed(1));
      }
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + c.dark + '" stroke-width="3.5" stroke-linejoin="round"/>';
      s += '<circle cx="' + ctrl.pe.x + '" cy="' + ctrl.pe.y + '" r="4" fill="#fff"/>';
    }

    if (type === 'chute') {
      var times = [0.32, 0.5, 0.68];
      for (var j = 0; j < times.length; j++) {
        var tt = times[j];
        var pp = bez(ctrl.pe, ctrl.c1, ctrl.c2, ctrl.px, tt);
        var gg = bezT(ctrl.pe, ctrl.c1, ctrl.c2, ctrl.px, tt);
        var len = Math.hypot(gg.x, gg.y) || 1;
        var dx = gg.x / len, dy = gg.y / len;
        var hnx = -dy, hny = dx;
        var tip = { x: pp.x + dx * 11, y: pp.y + dy * 11 };
        var tail = { x: pp.x - dx * 7, y: pp.y - dy * 7 };
        s += '<path d="M ' + (tail.x + hnx * 6).toFixed(1) + ' ' + (tail.y + hny * 6).toFixed(1) +
          ' L ' + tip.x.toFixed(1) + ' ' + tip.y.toFixed(1) +
          ' L ' + (tail.x - hnx * 6).toFixed(1) + ' ' + (tail.y - hny * 6).toFixed(1) +
          '" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
      }
    }

    if (type === 'spawn') {
      var ex = edgeCenter(cell.exit);
      var exd = Math.hypot(ex.x - 50, ex.y - 50) || 1;
      var sx = (ex.x - 50) / exd, sy = (ex.y - 50) / exd;
      var a = { x: 50 + sx * 22, y: 50 + sy * 22 };
      var h = { x: 50 + sx * 36, y: 50 + sy * 36 };
      var pnx = -sy * 7, pny = sx * 7;
      s += '<circle class="pulse-ring" cx="50" cy="50" r="15" fill="none" stroke="' + c.dark + '" stroke-width="3"/>';
      s += '<path d="M 50 50 L ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + '" stroke="' + c.dark + '" stroke-width="4" stroke-linecap="round"/>';
      s += '<path d="M ' + h.x.toFixed(1) + ' ' + h.y.toFixed(1) +
        ' L ' + (a.x + pnx).toFixed(1) + ' ' + (a.y + pny).toFixed(1) +
        ' L ' + (a.x - pnx).toFixed(1) + ' ' + (a.y - pny).toFixed(1) + ' Z" fill="' + c.dark + '"/>';
    }

    s += '</svg>';
    return s;
  }

  global.Tiles = {
    DIRS: DIRS,
    DIRV: DIRV,
    TYPES: TYPES,
    NEUTRAL: NEUTRAL,
    DECOR_TYPES: DECOR_TYPES,
    dirFrom: dirFrom,
    opposite: function (d) { return OPP[d]; },
    isStraight: function (entry, exit) { return entry !== exit && exit === OPP[entry]; },
    pipeD: pipeD,
    tileSVG: tileSVG,
    edgeCenter: edgeCenter,
    controlsFor: controlsFor
  };
})(window);