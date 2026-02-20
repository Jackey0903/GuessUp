const fs = require('fs');
const path = require('path');

// Paths relative to this script file
const manualPath = path.join(__dirname, '../utils/players.js');
const fullPath = path.join(__dirname, '../utils/players_full.js');
const transPath = path.join(__dirname, '../data/player_translations.json');

console.log("Loading players from:");
console.log("Manual:", manualPath);
console.log("Full:", fullPath);
console.log("Translations:", transPath);

try {
    const manualPlayers = require(manualPath).players;
    const fullPlayers = require(fullPath).players;
    let translations = {};
    if (fs.existsSync(transPath)) {
        translations = require(transPath);
    }

    console.log(`Loaded ${manualPlayers.length} manual players.`);
    console.log(`Loaded ${fullPlayers.length} full players.`);
    console.log(`Loaded ${Object.keys(translations).length} translations.`);

    // Create a map of Manual Players by Name (English)
    const manualMap = {};
    manualPlayers.forEach(p => {
        if (p.name) manualMap[p.name.toLowerCase()] = p;
    });

    // Merge
    let mergedCount = 0;
    let transCount = 0;
    fullPlayers.forEach(p => {
        const key = p.name ? p.name.toLowerCase() : "";

        // 1. Merge Manual Aliases
        if (manualMap[key]) {
            if (manualMap[key].aliases) {
                const newAliases = manualMap[key].aliases;
                const existing = new Set(p.aliases || []);
                newAliases.forEach(a => existing.add(a));
                p.aliases = Array.from(existing);
                mergedCount++;
            }
        }

        // 2. Apply Translations (Name CN)
        // Check exact match first, then maybe partial?
        if (translations[p.name]) {
            p.name_cn = translations[p.name];
            transCount++;
        } else {
            // Fallback: Check if manual map had a chinese alias that looks like a name?
            // Actually, for now, just leave it undefined if no translation.
            // But we can verify coverage later.
        }
    });

    console.log(`Merged aliases for ${mergedCount} players.`);
    console.log(`Applied translations for ${transCount} players.`);

    // Output back to `utils/players.js`
    const outputContent = `const players = ${JSON.stringify(fullPlayers, null, 2)};\n\nmodule.exports = { players: players };\n`;

    fs.writeFileSync(manualPath, outputContent, 'utf8');
    console.log("Successfully merged and overwrote utils/players.js!");

} catch (error) {
    console.error("Error during merge:", error);
    process.exit(1);
}
