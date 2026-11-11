// Plays the JavaScript version with the balance bot and prints every year's
// numbers as JSON, so bot_test.gd can check that the Godot port matches.
// Run: node tests/js_dump.js <years> <profile> <seed,seed,...>
const path = require('path');
const { loadGame, play } = require(path.join(__dirname, '../../../lab/kis-uykusu-oteli/src/test/bot.js'));
const PLAYERS = require('./players.json');
const A = loadGame();
const years = +(process.argv[2] || 10);
const name = process.argv[3] || 'kid';
const seeds = (process.argv[4] || '1,2,3').split(',').map(Number);
const out = {};
for (const s of seeds) out[s] = play(A, PLAYERS[name], years, s);
console.log(JSON.stringify(out));
