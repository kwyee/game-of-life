function GameOfLife() {
    this._iterationNumber = 0;
    this._alive = {};
}

GameOfLife.prototype.tick = function(ts) {
    var me = this;
    this._iterationNumber++;

    // If an "alive" cell had less than 2 or more than 3 alive neighbors (in any of the 8 surrounding cells), it becomes dead.
    // If a "dead" cell had *exactly* 3 alive neighbors, it becomes alive.
    var neighborCounts = {}
    _.forEach(me._alive, function(rowPts, y) {
        _.forEach(rowPts, function(v, x) {
            GameOfLife._countUp(neighborCounts, x, y);
        })
    })

    _.forEach(me._alive, function(rowPts, y) {
        _.forEach(rowPts, function(v, x) {
            var nv = (neighborCounts[y] || {})[x] || 0
            if (nv < 2 || nv > 3) {
                me.kill(x,y)
            }
        })
    })
    _.forEach(neighborCounts, function(rowPts, y) {
        _.forEach(rowPts, function(v, x) {
            if (neighborCounts[y][x] == 3) {
                me.makeAlive(x, y, ts)
            }
        })
    })
}

GameOfLife.prototype.makeAlive = function(x, y, ts) {
    ts = ts || 1;
    this._alive[y] = this._alive[y] || {}
    if (!this._alive[y][x]) {
        // Don't change the ts value if this guy was previously alive
        this._alive[y][x] = ts;
    }
}

GameOfLife.prototype.makeAlivePattern = function(pattern, x, y, ts) {
    for (var i = 0; i < pattern.length; ++i) {
        var patterPt = pattern[i];
        this.makeAlive(x + patterPt[0], y + patterPt[1], ts);
    }
}

GameOfLife.prototype.kill = function(x, y) {
    if (this._alive[y]) {
        delete this._alive[y][x]
    }
}

GameOfLife.prototype.reset = function(input2d) {
    this._alive = {};
    this._iterationNumber = 0;
    // convert input2d to our internal format
    _.forEach(input2d, function(xy) {
        this.makeAlive(xy[0], xy[1]);
    }.bind(this))
}

GameOfLife.prototype.getPoints = function() {
    var output = []
    _.forEach(this._alive, function(rowPts, y) {
        _.forEach(rowPts, function(v, x) {
            output.push([Number(x),Number(y)]);
        })
    })
    return output;
}

GameOfLife.prototype.gc = function() {
    _(this._alive)
    .keys()
    .filter(function(k) {
        return _.size(this._alive[k]) == 0
    }.bind(this))
    .forEach(function(k) {
        delete this._alive[k];
    }.bind(this))
}

GameOfLife.prototype.isAlive = function(x, y) {
    if (!this._alive[y]) {
        return false;
    }
    return !!this._alive[y][x];
}

GameOfLife.prototype.findCluster = function(xy, clusterLax) {
    clusterLax = clusterLax || 3; // Furthest distance from other points to be considered a cluster

    var bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        update: function(x, y) {
            this.minX = Math.min(this.minX, x);
            this.minY = Math.min(this.minY, y);

            this.maxX = Math.max(this.maxX, x);
            this.maxY = Math.max(this.maxY, y);
        },
    }
    if (!xy || !xy.length) {
        return { center: { x: 0, y: 0 }, size: { width: 0, height: 0 } };
    }

    var ring = 1;

    var ringsWithoutPoint = clusterLax;
    while (ringsWithoutPoint > 0 && ring < 100) {
        var ringHadPoint = false;

        var startX = xy[0] - ring
        var startY = xy[1] - ring

        for (var xOffset = 0; xOffset <= ring; ++xOffset) {
            var x = startX + xOffset;
            var y = startY;
            // console.log('  r looking at ', x,y);

            if (this.isAlive(x,y)) {
                bounds.update(x, y)
                ringHadPoint = true;
            }
        }

        for (var yOffset = 0; yOffset <= ring; ++yOffset) {
            var x = startX + ring + 1;
            var y = startY + yOffset;
            // console.log('  d looking at ', x,y);
            if (this.isAlive(x,y)) {
                bounds.update(x, y)
                ringHadPoint = true;
            }
        }

        for (var xOffset = 0; xOffset <= ring; ++xOffset) {
            var x = startX + xOffset + ring;
            var y = startY + ring + 1;
            // console.log('  l looking at ', x,y);
            if (this.isAlive(x,y)) {
                bounds.update(x, y)
                ringHadPoint = true;
            }
        }

        for (var yOffset = 0; yOffset <= ring; ++yOffset) {
            var x = startX;
            var y = startY + yOffset + ring;
            // console.log('  u looking at ', x,y);
            if (this.isAlive(x,y)) {
                bounds.update(x, y)
                ringHadPoint = true;
            }
        }

        if (ringHadPoint) {
            ringsWithoutPoint = clusterLax; // Reset the countdown
        } else {
            ringsWithoutPoint--;
        }

        ring += 1;
    }

    return {
        center: {
            x: (bounds.maxX + bounds.minX) / 2,
            y: (bounds.maxY + bounds.minY) / 2,
        },
        size: {
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY,
        },
    }
}

GameOfLife._countUp = function(hash, x, y) {
    x = Number(x)
    y = Number(y)
    for (var xOffset = -1; xOffset <= 1; ++xOffset) {
        for (var yOffset = -1; yOffset <= 1; ++yOffset) {
            if (xOffset == 0 && yOffset == 0) {
                continue;
            }
            var x1 = x+xOffset
            var y1 = y+yOffset
            hash[y1] = hash[y1] || {};
            hash[y1][x1] = hash[y1][x1] || 0;
            hash[y1][x1]++
        }
    }
}









// Convert a string to a 2d array of inputs2d
GameOfLife.lif105Str2arrays = function(str) {
    return _(str.split('\n'))
    .map(function(l, row) {
        var rval = l.trim()
        return rval[0] == '#' || rval[0] == '!' ? '' : rval;
    })
    .filter()
    .map(function(l, row) {
        return _(l.split(''))
        .map(function(c, col) {
            if (c == '*') {
                return [col, row]
            }
        })
        .filter()
        .value()
    })
    .flatten()
    .value()
}

GameOfLife.lif106Str2arrays = function(str) {
    return _(str.split('\n'))
    .map(function(l, row) {
        var rval = l.trim()
        return rval[0] == '#' ? '' : rval;
    })
    .filter()
    .map(function(l) {
        return l.split(' ').map(Number);
    })
    .value()
}

GameOfLife.riotStr2arrays = function(str) {
    return _(str.split('\n'))
    .map(function(l, row) {
        var rval = l.trim().replace(/[()]/g, '');
        return rval[0] == '#' ? '' : rval;
    })
    .filter()
    .map(function(l) {
        return l.split(/, */).map(Number);
    })
    .value()
}

GameOfLife.rleStr2arrays = function(str) {
    // http://www.conwaylife.com/wiki/Run_Length_Encoded

    var result = [];

    // Remove headers, comments, etc.
    str = _(str.split('\n'))
    .map(function(l, lineI) {
        var rval = l.trim()
        return rval[0] == '#' ? '' : rval;
    })
    .filter()
    .slice(1) // remove the header line
    .join('');

    var currentRow = 0;

    _(str.split('$'))
    .map(function(numAndStates) {
        currentRow ++;
        var currentCol = 0;
        _(numAndStates.split(/([0-9]*(?:o|b))/))
        .filter()
        .map(function(numAndState) {
            var state = _.last(numAndState);
            var num = Number(numAndState.substring(0, numAndState.length - 1)) || 1;

            if (state == 'b') {
                // dead run
                currentCol += num
                return;
            } else if (state == 'o') {
                for (var i = 0; i < num; ++i) {
                    result.push([currentCol + i, currentRow])
                }
                currentCol += num;
            } else if (Number(state)) {
                currentRow += Number(state) - 1;
            }
        })
        .value()
    })
    .value()

    return result;

}
