#!/usr/bin/env node

global._ = require('lodash')
var FS = require('fs');

var args = require('minimist')(process.argv.slice(2), {
    string: ['pattern'],
});

// TODO(kwyee): use module.exports in game-of-life-logic.js instead of this hack
eval(FS.readFileSync('./game-of-life-logic.js')+'');

var filename = args.pattern
var text = FS.readFileSync(filename);
text = text + '';

var points = []
if (/\.riot$/.test(filename)) {
    points = GameOfLife.riotStr2arrays(text);
} else if (/_106\.lif$/.test(filename)) {
    points = GameOfLife.lif106Str2arrays(text);
} else if (/_105\.lif$/.test(filename)) {
    points = GameOfLife.lif105Str2arrays(text);
} else if (/\.rle$/.test(filename)) {
    points = GameOfLife.rleStr2arrays(text);
} else {
    throw new Error(`Unknown file format: ${filename}`);
}

console.log(
    points.map(function(pt) {
        return `${pt[0]} ${pt[1]}`;
    }).join('\n')
);
