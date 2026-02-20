import json
import requests
import time

custom_headers = {
    'Host': 'stats.nba.com',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
}

def get_positions():
    url = "https://stats.nba.com/stats/leaguedashplayerbiostats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&Season=2023-24&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight="
    response = requests.get(url, headers=custom_headers, timeout=10)
    data = response.json()
    headers = data['resultSets'][0]['headers']
    rows = data['resultSets'][0]['rowSet']
    
    player_positions = {}
    
    name_idx = headers.index('PLAYER_NAME')
    pos_idx = headers.index('PLAYER_POSITION')
    team_idx = headers.index('TEAM_ABBREVIATION')
    
    for row in rows:
        name = row[name_idx]
        pos = row[pos_idx]
        player_positions[name.lower()] = pos
        
    return player_positions

try:
    positions = get_positions()
    print(f"Fetched {len(positions)} player positions.")
    
    with open('utils/players.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # parse the javascript to extract JSON
    json_str = content.split('const players = ')[1].split(';\n\nmodule.exports')[0]
    players = json.loads(json_str)
    
    missing_count = 0
    updated_count = 0
    for p in players:
        # User requested positions to be PF, SG, etc.
        # Check against stats array
        lower_name = p['name'].lower()
        if lower_name in positions:
            p['pos_cn'] = positions[lower_name]
            p['pos'] = positions[lower_name]
            updated_count += 1
        elif len(p.get('aliases', [])) > 0 and p['aliases'][0].lower() in positions:
            p['pos_cn'] = positions[p['aliases'][0].lower()]
            p['pos'] = positions[p['aliases'][0].lower()]
            updated_count += 1
        else:
            missing_count += 1
            # Fallback english for existing generic G, F, C
            if p['pos_cn'] == '前锋' or p['pos'] == 'F':
                p['pos_cn'] = 'F'
                p['pos'] = 'F'
            elif p['pos_cn'] == '后卫' or p['pos'] == 'G':
                p['pos_cn'] = 'G'
                p['pos'] = 'G'
            elif p['pos_cn'] == '中锋' or p['pos'] == 'C':
                p['pos_cn'] = 'C'
                p['pos'] = 'C'
            
    print(f"Updated {updated_count} players. Kept fallback for {missing_count} players.")
    
    out_content = "const players = " + json.dumps(players, indent=2, ensure_ascii=False) + ";\n\nmodule.exports = { players: players };\n"
    
    with open('utils/players.js', 'w', encoding='utf-8') as f:
        f.write(out_content)
        
except Exception as e:
    print(e)
