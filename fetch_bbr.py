import requests
import json
from bs4 import BeautifulSoup
import time
import unicodedata
import re

import sys

def normalize(name):
    s = ''.join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')
    s = s.lower()
    s = re.sub(r'[^a-z0-9 ]', '', s)
    return s.strip()

def fetch_bbr_rosters():
    teams = ['ATL', 'BOS', 'BRK', 'CHO', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 
             'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 
             'OKC', 'ORL', 'PHI', 'PHO', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS']
             
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    player_positions = {}
    
    for team in teams:
        url = f"https://www.basketball-reference.com/teams/{team}/2024.html"
        try:
            res = requests.get(url, headers=headers)
            soup = BeautifulSoup(res.text, 'html.parser')
            roster_table = soup.find('table', id='roster')
            if roster_table:
                tbody = roster_table.find('tbody')
                for row in tbody.find_all('tr'):
                    td_name = row.find('td', {'data-stat': 'player'})
                    td_pos = row.find('td', {'data-stat': 'pos'})
                    if td_name and td_pos:
                        name = td_name.text.strip()
                        pos = td_pos.text.strip()
                        # split hyphenated pos like PG-SG to just PG
                        if '-' in pos:
                            pos = pos.split('-')[0]
                        player_positions[normalize(name)] = pos
        except Exception as e:
            pass            
        time.sleep(2)
    return player_positions

if __name__ == "__main__":
    positions = fetch_bbr_rosters()
    print(f"Found {len(positions)} positions from BBR.")
    
    with open('utils/players.js', 'r', encoding='utf-8') as f:
        content = f.read()
    js_code = content.split('const players = ')[1].split(';\n\nmodule.exports')[0]
    players = json.loads(js_code)
    
    matched = 0
    for p in players:
        name = normalize(p['name'])
        if name in positions:
            p['pos'] = positions[name]
            p['pos_cn'] = positions[name]
            matched += 1
        elif len(p.get('aliases', [])) > 0 and normalize(p['aliases'][0]) in positions:
            p['pos'] = positions[normalize(p['aliases'][0])]
            p['pos_cn'] = positions[normalize(p['aliases'][0])]
            matched += 1
        else:
            # Fallback for remaining
            if p['pos'] == 'G' or p['pos_cn'] == 'G': p['pos'] = 'PG'; p['pos_cn'] = 'PG'
            elif p['pos'] == 'F' or p['pos_cn'] == 'F': p['pos'] = 'PF'; p['pos_cn'] = 'PF'
            elif p['pos'] == 'C' or p['pos_cn'] == 'C': p['pos'] = 'C'; p['pos_cn'] = 'C'
            
    print(f"Matched {matched} out of {len(players)}")
    out = "const players = " + json.dumps(players, indent=2, ensure_ascii=False) + ";\n\nmodule.exports = { players: players };\n"
    with open('utils/players.js', 'w', encoding='utf-8') as f:
        f.write(out)
