(function (global) {
  'use strict';

  var T = global.Tiles;

  var MIN_TRACK_FRACTION = 0.7;

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function key(x, y) { return x + ',' + y; }

  function removeOne(arr, v) {
    var i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
  }

  function addOne(arr, v) {
    if (arr.indexOf(v) < 0) arr.push(v);
  }

  function hasEdge(adj, p, q) {
    var kp = key(p[0], p[1]);
    return adj[kp] && adj[kp].indexOf(key(q[0], q[1])) >= 0;
  }

  function addEdge(adj, p, q) {
    var kp = key(p[0], p[1]), kq = key(q[0], q[1]);
    (adj[kp] = adj[kp] || []).push(kq);
    (adj[kq] = adj[kq] || []).push(kp);
  }

  function removeEdge(adj, p, q) {
    var kp = key(p[0], p[1]), kq = key(q[0], q[1]);
    removeOne(adj[kp], kq);
    removeOne(adj[kq], kp);
  }

  // 2-wide strip: unique Hamiltonian cycle (down the right column, back up the left).
  function ladder2Path(h, x0, y0) {
    var pts = [];
    var y;
    for (y = 0; y < h; y++) pts.push([x0 + 1, y0 + y]);
    for (y = h - 1; y >= 0; y--) pts.push([x0, y0 + y]);
    return pts;
  }

  function adjFromPath(path) {
    var adj = {};
    for (var i = 0; i < path.length; i++) {
      var a = path[i], b = path[(i + 1) % path.length];
      var ka = key(a[0], a[1]), kb = key(b[0], b[1]);
      (adj[ka] = adj[ka] || []).push(kb);
      (adj[kb] = adj[kb] || []).push(ka);
    }
    return adj;
  }

  // Splice two disjoint cycles that share a full side into a single cycle.
  // Removes a vertical edge from each cycle on the shared boundary and
  // re-connects the two cut paths cross-wise.
  function spliceAdj(adjA, adjB, b, y0, h) {
    var t = randInt(0, h - 2);
    if (!hasEdge(adjA, [b, y0 + t], [b, y0 + t + 1]) ||
        !hasEdge(adjB, [b + 1, y0 + t], [b + 1, y0 + t + 1])) t = 0;

    removeEdge(adjA, [b, y0 + t], [b, y0 + t + 1]);
    removeEdge(adjB, [b + 1, y0 + t], [b + 1, y0 + t + 1]);
    addEdge(adjB, [b, y0 + t], [b + 1, y0 + t]);
    addEdge(adjB, [b, y0 + t + 1], [b + 1, y0 + t + 1]);

    for (var k in adjB) {
      if (!adjA[k]) adjA[k] = adjB[k];
      else if (adjB[k].length) {
        // merge neighbor lists (already includes cross edges added above)
        for (var i = 0; i < adjB[k].length; i++) addOne(adjA[k], adjB[k][i]);
      }
    }
    return adjA;
  }

  // Recursive Hamiltonian cycle for a tw x th rectangle (tw even, tw*th even).
  // Splits the width into two even sub-rectangles and splices their cycles.
  function cycleRectAdj(x0, y0, tw, th) {
    if (tw === 2) return adjFromPath(ladder2Path(th, x0, y0));
    var maxLeft = tw - 2;
    var left = 2 + 2 * randInt(0, (maxLeft - 2) / 2);
    var adjA = cycleRectAdj(x0, y0, left, th);
    var adjB = cycleRectAdj(x0 + left, y0, tw - left, th);
    return spliceAdj(adjA, adjB, x0 + left - 1, y0, th);
  }

  function pathFromAdj(adj, n) {
    var startKey = Object.keys(adj)[0];
    var order = [];
    var cur = startKey;
    var prev = null;
    while (order.length < n) {
      order.push(cur);
      var ns = adj[cur];
      var nxt = null;
      for (var i = 0; i < ns.length; i++) {
        if (ns[i] !== prev) { nxt = ns[i]; break; }
      }
      if (!nxt) break;
      prev = cur;
      cur = nxt;
    }
    return order.map(function (k) {
      var p = k.split(',');
      return { x: +p[0], y: +p[1] };
    });
  }

  function buildTrack(cols, rows, minArea) {
    var candidates = [];
    for (var tw = cols; tw >= 2; tw -= 2) {
      for (var th = rows; th >= 2; th--) {
        if ((tw * th) % 2 === 1) continue;
        if (tw * th < minArea) continue;
        candidates.push([tw, th]);
      }
    }
    var pick = candidates[randInt(0, candidates.length - 1)];
    var tw = pick[0], th = pick[1];
    var ox = randInt(0, cols - tw);
    var oy = randInt(0, rows - th);

    return pathFromAdj(cycleRectAdj(ox, oy, tw, th), tw * th);
  }

  function pickType(isTurn) {
    var pool = isTurn
      ? ['curve', 'curve', 'curve', 'curve', 'curve', 'spring', 'spring', 'cross']
      : ['straight', 'straight', 'straight', 'straight', 'spring', 'chute'];
    return pool[randInt(0, pool.length - 1)];
  }

  function buildLoopCells(path) {
    var L = path.length;
    var cells = [];
    for (var i = 0; i < L; i++) {
      var cur = path[i];
      var prev = path[(i + L - 1) % L];
      var nxt = path[(i + 1) % L];
      var entry = T.opposite(T.dirFrom(prev, cur));
      var exit = T.dirFrom(cur, nxt);
      var isSpawn = i === 0;
      var type = isSpawn ? 'spawn' : pickType(!T.isStraight(entry, exit));
      cells.push({ x: cur.x, y: cur.y, type: type, entry: entry, exit: exit, active: true, index: i });
    }
    return cells;
  }

  function fixVariety(cells) {
    var hasSpring = cells.some(function (c) { return c.type === 'spring'; });
    var hasChute = cells.some(function (c) { return c.type === 'chute'; });

    var straights = function () {
      return cells.filter(function (c) { return c.type !== 'spawn' && T.isStraight(c.entry, c.exit); });
    };

    if (!hasSpring) {
      var s1 = straights();
      if (s1.length) s1[randInt(0, s1.length - 1)].type = 'spring';
    }
    if (!hasChute) {
      var s2 = straights().filter(function (c) { return c.type !== 'spring'; });
      if (s2.length) s2[randInt(0, s2.length - 1)].type = 'chute';
    }
    return cells;
  }

  global.MarbleGen = {
    MIN_TRACK_FRACTION: MIN_TRACK_FRACTION,
    generate: function (cols, rows) {
      var minArea = Math.max(4, Math.ceil(cols * rows * MIN_TRACK_FRACTION));
      var path = buildTrack(cols, rows, minArea);
      var cells = fixVariety(buildLoopCells(path));
      return { cells: cells, spawn: cells[0], length: cells.length };
    }
  };
})(window);