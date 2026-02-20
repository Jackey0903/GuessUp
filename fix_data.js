const fs = require('fs');
const path = require('path');

const playersPath = path.join(__dirname, 'utils', 'players.js');
let rawData = fs.readFileSync(playersPath, 'utf8');

// Parse the raw JS to extract the array
const jsonStr = rawData.split('const players = ')[1].split(';\n\nmodule.exports')[0];
let players = JSON.parse(jsonStr);

let removed = 0;
let updatedPos = 0;

players = players.filter(p => {
    // 1. Remove truly incomplete ones (no name, no height, no number, no team)
    if (!p.name || !p.height || p.height_cm === 0 || !p.number || p.number === "" || p.pos === "N/A" || !p.team || !p.conf_cn || !p.div_cn) {
        if (p.number === "0" || p.number === "00") {
            // 0 and 00 are valid numbers in NBA
        } else {
            console.log("Removing incomplete player:", p.name);
            removed++;
            return false;
        }
    }
    return true;
});

players.forEach(p => {
    // 2. Change pos_cn to english (so Chinese like '前锋', '中锋' becomes 'F', 'C')
    if (p.pos_cn === '后卫') p.pos_cn = 'G';
    else if (p.pos_cn === '前锋') p.pos_cn = 'F';
    else if (p.pos_cn === '中锋') p.pos_cn = 'C';
    else if (p.pos_cn === 'N/A' || !p.pos_cn) p.pos_cn = p.pos;

    // ensure pos equals pos_cn just in case
    p.pos_cn = p.pos;
    updatedPos++;
});

console.log(`Cleaned up data. Removed ${removed} incomplete players.`);
console.log(`Updated ${updatedPos} players to use English positions.`);

const output = `const players = ${JSON.stringify(players, null, 2)};\n\nmodule.exports = { players: players };\n`;
fs.writeFileSync(playersPath, output, 'utf8');
