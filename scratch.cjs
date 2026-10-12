const fs = require('fs');
let code = fs.readFileSync('src/context/GameContext.tsx', 'utf8');

code = code.replace(/soundboard\.playGong\(\)/g, '/* disabled auto gong */');
code = code.replace(/soundboard\.playWolfHowl\(\)/g, '/* disabled auto wolf howl */');
code = code.replace(/soundboard\.playDeathBell\(\)/g, '/* disabled auto death bell */');
code = code.replace(/soundboard\.playGunshot\(\)/g, '/* disabled auto gunshot */');
code = code.replace(/soundboard\.playRoosterCrow\(\)/g, '/* disabled auto rooster crow */');

fs.writeFileSync('src/context/GameContext.tsx', code);
