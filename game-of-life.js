// Hours: 11

// --------------------------
// Main
// --------------------------

// (function() {

    var gol = new GameOfLife();

    // --------------------------
    // Config
    // --------------------------

    // Pixel rendering sizes + padding:
    var PT_SIZE = 10;
    var PADDING = 1;

    var zoomLevel = 1;
    var translation = { x: 0, y: 0 };

    // Zoom constraints
    var MAX_ZOOM_LEVEL = 10
    var MIN_ZOOM_LEVEL = 0.05

    // How far to move while translating
    var TRANSLATION_STEP = 10

    // Duration of fade animation
    var FADE_DURATION = 400

    // How far to move while translating
    var SIM_SPEEDS = [
        Infinity,
        2000,
        500,
        250,
        30,
        0,
    ]

    var DEFAULT_SIM_SPEED = 3;
    var simInterval = SIM_SPEEDS[0]

    // Stamp using this pattern
    var stampPattern = [ [0,0] ];
    renderStampSelector(stampPattern);


    // Prune the 'alive' set
    var GC_ITERATIONS = 1000;

    // --------------------------
    // Rendering
    // --------------------------
    var canvas = document.querySelector('canvas')
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    window.addEventListener('resize', function() {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
    });
    var ctx = canvas.getContext('2d');


    // When to tick the sim and prevTS to ensure max fps
    var prevTS = 0;
    var prevTickTS = 0
    var prevMetaTS = -Infinity
    var metaUpdateFreq = 300;
    var renderTimes = [];
    var render = function(ts) {
        if (prevTS && (ts - prevTS) < 16) {
            raf();
            return;
        }
        // console.log(prevTS, ts);
        prevTS = ts;
        var renderStart = new Date().getTime();

        ctx.save()

        // Clear the canvas
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Move to 0,0
        ctx.translate(ctx.canvas.width/2, ctx.canvas.height/2)

        // Zoom
        ctx.scale(zoomLevel, zoomLevel)

        // Move to translation
        ctx.translate(translation.x, translation.y)

        // Draw the values
        ctx.fillStyle = 'white';
        renderGoL(ctx, gol, ts)

        ctx.restore();

        if (ts - prevTickTS > simInterval) {
            gol.tick(ts)
            prevTickTS = ts;
        }
        if (gol._iterationNumber % GC_ITERATIONS == 0) {
            gol.gc();
        }

        if (ts - prevMetaTS > metaUpdateFreq) {
            renderTimes.push(new Date().getTime() - renderStart);
            if (renderTimes.length > 10) {
                renderTimes.shift();
            }
            renderMetadata()
            prevMetaTS = ts
        }

        raf()
    }

    function raf() {
        window.requestAnimationFrame(render)
    }
    raf();


    function renderGoL(ctx, gol, ts) {
        _.forEach(gol._alive, function(rowPts, y) {
            _.forEach(rowPts, function(aliveTS, x) {
                if (ts > aliveTS + FADE_DURATION) {
                    ctx.globalAlpha = 1
                } else {
                    var alpha = (ts - aliveTS) / FADE_DURATION; // linear-ize
                    alpha = Math.sin(Math.PI/2 * alpha); // smooth
                    alpha = Math.min(alpha + 0.1, 1); // ensure min
                    ctx.globalAlpha = alpha;
                }
                ctx.fillRect(x*PT_SIZE+PADDING, y*PT_SIZE+PADDING, PT_SIZE-2*PADDING, PT_SIZE-2*PADDING);
            })
        });
    }

    function renderMetadata() {
        var msStr = `${simInterval}ms`
        if (simInterval == Infinity) {
            msStr = 'PAUSED';
        }

        var renderTime = (_.sum(renderTimes) / renderTimes.length) || 0;
        document.getElementById('metadata').innerHTML = `x: ${_.round(translation.x, 2)} y: ${_.round(translation.y, 2)} z: ${_.round(zoomLevel,2)}
Update frequency: ${msStr}
Iteration: ${gol._iterationNumber}
Render time: ${_.round(renderTime,2)}ms (${_.round(1000/(renderTime || 1),2)}fps)
        `
    }




    // --------------------------
    // Movement
    // --------------------------
    function node2pt(ev) {
        var x = Math.floor(((ev.clientX - ctx.canvas.width/2)/zoomLevel - translation.x) / PT_SIZE)
        var y = Math.floor(((ev.clientY - ctx.canvas.height/2)/zoomLevel - translation.y) / PT_SIZE)

        return { x: x, y: y }
    }

    var hadMM = false;
    var prevXY = null
    canvas.addEventListener('mousemove', function(ev) {
        if (ev.which != 1) {
            return;
        }
        if (ev.shiftKey) {
            return;
        }

        hadMM = true;
        if (!prevXY) {
            prevXY = {
                x: ev.clientX,
                y: ev.clientY,
            }
        }
        translation.x += (ev.clientX - prevXY.x) / zoomLevel
        translation.y += (ev.clientY - prevXY.y) / zoomLevel
        prevXY.x = ev.clientX
        prevXY.y = ev.clientY
    })
    canvas.addEventListener('mouseup', function(ev) {
        prevXY = null
    })

    canvas.addEventListener('mousewheel', function(ev) {
        var direction = ev.deltaY > 0 ? 1 : -1;
        var val = Math.log(Math.abs(ev.deltaY));
        val *= direction;

        var scale = 50/(50 + val);
        scale = Math.max(scale, 0);
        scale = Math.min(scale, 2.5);

        zoomLevel *= scale
        zoomLevel = Math.min(zoomLevel, MAX_ZOOM_LEVEL)
        zoomLevel = Math.max(zoomLevel, MIN_ZOOM_LEVEL)
    })


    // --------------------------
    // Paint and stamp
    // --------------------------
    canvas.addEventListener('mousemove', function(ev) {
        if (ev.which != 1) {
            return;
        }

        if (!ev.shiftKey) {
            return;
        }
        var pt = node2pt(ev);
        gol.makeAlive(pt.x, pt.y, prevTS);
    });

    canvas.addEventListener('click', function(ev) {
        if (hadMM) {
            hadMM = false;
            return;
        }

        var pt = node2pt(ev);

        // Draw a pattern
        if (ev.metaKey || ev.ctrlKey) {
            var pattern = stampPattern
            gol.makeAlivePattern(pattern, pt.x, pt.y, prevTS);
            return
        }

        // Toggle alive/dead
        if (gol.isAlive(pt.x, pt.y)) {
            gol.kill(pt.x, pt.y);
        } else {
            gol.makeAlive(pt.x, pt.y, prevTS);
        }
    })




    // Load inputFiles and then render the first file.
    // These input files will also be used as "stamps"
    var inputFiles = [
        'patterns/gol.riot',
        'patterns/butterfly.riot',
        'patterns/butterfly_106.lif',
        'patterns/random_105.lif',
        'patterns/p69060p5h2v0gun.rle',
        'patterns/bunnies.rle',
        'patterns/bunnies10.rle',
        'patterns/iwona.rle',
    ]
    var lastLoadedInput2d = []
    Promise.all(inputFiles.map(function(filename) {
        return $.ajax({
          url: filename,
          dataType: "text"
        })
        .then(function(text) {
            if (/\.riot$/.test(filename)) {
                return GameOfLife.riotStr2arrays(text);
            } else if (/_106\.lif$/.test(filename)) {
                return GameOfLife.lif106Str2arrays(text);
            } else if (/_105\.lif$/.test(filename)) {
                return GameOfLife.lif105Str2arrays(text);
            } else if (/\.rle$/.test(filename)) {
                return GameOfLife.rleStr2arrays(text);
            }
        })
    }))
    .then(function(convertedInputs) {
        if (_.size(gol._alive) == 0) {
            var urlParams = window.location.search
            .replace(/^\?/, '')
            .split('&')
            .reduce(function(accum, v) {
                var kv = v.split('=');
                accum[kv[0]] = kv[1];
                return accum;
            }, {});
            var index = Math.max(inputFiles.indexOf(urlParams.pattern || ''), 0);
            lastLoadedInput2d = convertedInputs[index];
            gol.reset(lastLoadedInput2d);

            var maxX = Math.max.apply(Math, _.map(lastLoadedInput2d, function(p) { return p[0] }))
            var minX = Math.min.apply(Math, _.map(lastLoadedInput2d, function(p) { return p[0] }))
            var maxY = Math.max.apply(Math, _.map(lastLoadedInput2d, function(p) { return p[1] }))
            var minY = Math.min.apply(Math, _.map(lastLoadedInput2d, function(p) { return p[1] }))

            var cluster = gol.findCluster(gol.getPoints()[0]);
            translation = { // world space
                x: -cluster.center.x*PT_SIZE,
                y: -cluster.center.y*PT_SIZE,
            }
        }

        for (var i = 0; i < convertedInputs.length; ++i) {
            renderStampSelector(convertedInputs[i], inputFiles[i]);
        }
    })

    function renderStampSelector(pattern, name) {
        name = name || ''
        var minX = Math.min.apply(Math, pattern.map(function(p) { return p[0] }));
        var minY = Math.min.apply(Math, pattern.map(function(p) { return p[1] }));

        var maxX = Math.max.apply(Math, pattern.map(function(p) { return p[0] }));
        var maxY = Math.max.apply(Math, pattern.map(function(p) { return p[1] }));

        var center = {
            x: Math.floor((minX+maxX)/2),
            y: Math.floor((minY+maxY)/2),
        }
        var centeredPattern = pattern.map(function(p) { return [p[0]-center.x, p[1]-center.y] }) // Normalize to 0,0

        var can = document.createElement('canvas');
        can.width = _.clamp((maxX-minX)+10, 5, 50) * PT_SIZE
        can.height = _.clamp((maxY-minY)+10, 5, 50) * PT_SIZE
        can.width = Math.min(can.width, can.height)
        can.height = Math.min(can.width, can.height)
        var ctx = can.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, can.width, can.height);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.translate(can.width/2, can.height/2)
        var board = new GameOfLife();
        board.reset(centeredPattern)
        renderGoL(ctx, board, Infinity);

        var image = new Image();
        image.src = can.toDataURL(); // "image/jpeg", 0.5);
        image.className = `stamp ${stampPattern == pattern ? 'selected' : ''}`
        image.title = name;
        image.addEventListener('click', function() {
            stampPattern = centeredPattern;
            document.querySelector('.stamps .stamp.selected').className = 'stamp'
            image.className = 'stamp selected'
        })

        document.querySelector('.stamps').appendChild(image)
        return centeredPattern;
    }

    // --------------------------
    // Speed control
    // --------------------------

    // Once, on init
    var simSpeedSlider = document.getElementById('simSpeed')
    simSpeedSlider.value = _.indexOf(SIM_SPEEDS, simInterval);

    simSpeedSlider.addEventListener('input', function(ev) {
        simInterval = SIM_SPEEDS[simSpeedSlider.value]
    })

    document.body.addEventListener('keydown', function(ev) {
        switch (ev.keyCode) {
        case 32:
            // space
            if (Number(simSpeedSlider.value) > 0) {
                // pause and record the last used speed
                simSpeedSlider.prevValue = simSpeedSlider.value
                simSpeedSlider.value = 0;
            } else {
                simSpeedSlider.value = simSpeedSlider.prevValue || DEFAULT_SIM_SPEED;
            }
            simInterval = SIM_SPEEDS[simSpeedSlider.value]
            break;
        case 187:
        case 221:
            // =]
            simSpeedSlider.value = Number(simSpeedSlider.value) + 1;
            simSpeedSlider.value = Math.min(simSpeedSlider.value, simSpeedSlider.max);
            simInterval = SIM_SPEEDS[simSpeedSlider.value]
            break;
        case 189:
        case 219:
            // -[
            simSpeedSlider.value = Number(simSpeedSlider.value) - 1;
            simSpeedSlider.value = Math.max(simSpeedSlider.value, simSpeedSlider.min);
            simInterval = SIM_SPEEDS[simSpeedSlider.value]
            break;
        case 68:
            // d
            translation.x -= TRANSLATION_STEP
            break;
        case 65:
            // a
            translation.x += TRANSLATION_STEP
            break;
        case 83:
            // s
            translation.y -= TRANSLATION_STEP
            break;
        case 87:
            // w
            translation.y += TRANSLATION_STEP
            break;
        case 190:
            // .
            gol.tick(prevTS);
            break;
        default:
            return;
        }
    })


    // --------------------------
    // Board-level controls
    // --------------------------

    document.getElementById('clear').addEventListener('click', function(ev) {
        gol.reset();
    })
    document.getElementById('reset').addEventListener('click', function(ev) {
        gol.reset(lastLoadedInput2d);
    })
    document.getElementById('random').addEventListener('click', function(ev) {
        function randomOffset(n) {
            var accum = 0;
            for (var c = 0; c < n; ++c) {
                accum += _.random(1)
            }

            return accum - n/2;
        }

        lastLoadedInput2d = [];
        // Create a random number of clusters
        var numClusters = _.random(5) + 1;
        for (var cluster = 0; cluster < numClusters; ++cluster) {
            var clusterCenter = {
                x: _.random(100000) - 50000,
                y: _.random(100000) - 50000,
            }

            for (var numPoints = _.random(30) + 10; numPoints >= 0; --numPoints) {
                lastLoadedInput2d.push([
                    clusterCenter.x + randomOffset(30),
                    clusterCenter.y + randomOffset(30),
                ])
            }
        }

        translation.x = -lastLoadedInput2d[0][0]*PT_SIZE
        translation.y = -lastLoadedInput2d[0][1]*PT_SIZE

        gol.reset(lastLoadedInput2d);
    })

    document.getElementById('jump').addEventListener('click', function(ev) {
        var pt = gol.getPoints()[0];

        var cluster = gol.findCluster(pt);

        translation.x = -cluster.center.x*PT_SIZE
        translation.y = -cluster.center.y*PT_SIZE
    })

    document.getElementById('print').addEventListener('click', function(ev) {
        var points = gol.getPoints();
        console.log(
            points.map(function(pt) {
                return `(${pt[0]}, ${pt[1]})`;
            }).join('\n')
        );
    })

// })()
