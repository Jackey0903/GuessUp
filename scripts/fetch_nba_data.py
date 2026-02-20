import requests
import json
import time

# ESPN API Endpoints
TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams"
ROSTER_URL_TEMPLATE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{}/roster"

# Mappings
TEAM_MAP = {
    'ATL': '老鹰', 'BOS': '凯尔特人', 'BKN': '篮网', 'CHA': '黄蜂', 'CHI': '公牛',
    'CLE': '骑士', 'DAL': '独行侠', 'DEN': '掘金', 'DET': '活塞', 'GSW': '勇士', 'GS': '勇士',
    'HOU': '火箭', 'IND': '步行者', 'LAC': '快船', 'LAL': '湖人', 'MEM': '灰熊',
    'MIA': '热火', 'MIL': '雄鹿', 'MIN': '森林狼', 'NOP': '鹈鹕', 'NO': '鹈鹕', 'NYK': '尼克斯', 'NY': '尼克斯',
    'OKC': '雷霆', 'ORL': '魔术', 'PHI': '76人', 'PHX': '太阳', 'POR': '开拓者',
    'SAC': '国王', 'SAS': '马刺', 'SA': '马刺', 'TOR': '猛龙', 'UTA': '爵士', 'UTAH': '爵士', 'WAS': '奇才', 'WSH': '奇才'
}

POS_MAP = {
    'G': '后卫', 'F': '前锋', 'C': '中锋', 
    'Point Guard': '后卫', 'Shooting Guard': '后卫', 
    'Small Forward': '前锋', 'Power Forward': '前锋', 'Center': '中锋'
}

CONF_MAP = {
    'Eastern': '东部', 'Western': '西部'
}

DIV_MAP = {
    'Atlantic': '大西洋', 'Central': '中部', 'Southeast': '东南',
    'Northwest': '西北', 'Pacific': '太平洋', 'Southwest': '西南'
}

def parse_height(height_str):
    # "6' 9"" -> 206
    try:
        if not height_str: return 0
        clean = height_str.replace('"', '')
        parts = clean.split("'")
        feet = int(parts[0])
        inches = int(parts[1]) if len(parts) > 1 else 0
        cm = (feet * 12 + inches) * 2.54
        return int(round(cm))
    except:
        return 0

def fetch_teams():
    print("Fetching teams...")
    response = requests.get(TEAMS_URL)
    data = response.json()
    teams = []
    
    for sport in data['sports']:
        for league in sport['leagues']:
            for team_entry in league['teams']:
                team = team_entry['team']
                
                # Fetch deeper team info for Conf/Div if stored locally or rely on manual map?
                # ESPN 'teams' endpoint usually has detailed info.
                # Let's check grouping. Actually ESPN structure is a bit nested.
                # We can manually map ID/Abbrev to Conf/Div if API is lacking, 
                # OR we can assume later we just look it up.
                # For this script, let's just grab basic info and map Conf/Div manually if possible or fetch from team detail.
                # Actually, simply looping them:
                
                teams.append({
                    'id': team['id'],
                    'name': team['name'],       # "Lakers"
                    'abbreviation': team['abbreviation'], # "LAL"
                    'displayName': team['displayName']
                })
    return teams

def fetch_roster(team_id):
    url = ROSTER_URL_TEMPLATE.format(team_id)
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"  Retry {attempt+1}/3 for team {team_id}: {e}")
            time.sleep(2)
    return {}

def process_players():
    teams = fetch_teams()
    all_players = []
    
    print(f"Found {len(teams)} teams. Fetching rosters...")
    
    for team in teams:
        abbr = team['abbreviation']
        team_cn = TEAM_MAP.get(abbr, abbr)
        print(f"Fetching roster for {team['displayName']} ({team_cn})...")
        
        roster_data = fetch_roster(team['id'])
        team_entry_info = roster_data.get('team', {})
        
        # ESPN Roster endpoint might not give Conf/Div directly. 
        # We might need a manual map for Conf/Div based on Team Abbr to ensure accuracy for "Sigdle" logic.
        # Let's hardcode Conf/Div mapping for the 30 teams to be safe/fast.
        
        team_conf = "Unknown"
        team_div = "Unknown"
        
        # Hardcoded logic for MVP accuracy
        if abbr in ['BOS', 'BKN', 'NYK', 'NY', 'PHI', 'TOR']: 
            team_conf, team_div = 'Eastern', 'Atlantic'
        elif abbr in ['CHI', 'CLE', 'DET', 'IND', 'MIL']:
            team_conf, team_div = 'Eastern', 'Central'
        elif abbr in ['ATL', 'CHA', 'MIA', 'ORL', 'WAS', 'WSH']:
            team_conf, team_div = 'Eastern', 'Southeast'
        elif abbr in ['DEN', 'MIN', 'OKC', 'POR', 'UTA', 'UTAH']:
            team_conf, team_div = 'Western', 'Northwest'
        elif abbr in ['GSW', 'GS', 'LAC', 'LAL', 'PHX', 'SAC']:
            team_conf, team_div = 'Western', 'Pacific'
        elif abbr in ['DAL', 'HOU', 'MEM', 'NOP', 'NO', 'SAS', 'SA']:
            team_conf, team_div = 'Western', 'Southwest'

        team_athletes = roster_data.get('athletes', [])
        for athlete in team_athletes:
            try:
                # Basic
                display_height = athlete.get('displayHeight', '')
                height_cm = parse_height(display_height)
                age = int(athlete.get('age', 0))
                jersey = athlete.get('jersey', '0')
                
                # Pos
                pos_abbr = athlete.get('position', {}).get('abbreviation', 'N/A')
                pos_cn = POS_MAP.get(pos_abbr, pos_abbr)
                
                # Name
                name_en = athlete['displayName']
                # For now, no auto-translation for 500 names. 
                # We will rely on our manual top-50 alias list merging.
                
                player_entry = {
                    'id': athlete['id'],
                    'name': name_en,
                    'team': abbr,
                    'team_cn': team_cn,
                    'conf': team_conf, 
                    'conf_cn': CONF_MAP.get(team_conf, team_conf),
                    'div': team_div,
                    'div_cn': DIV_MAP.get(team_div, team_div),
                    'pos': pos_abbr,
                    'pos_cn': pos_cn,
                    'height': display_height,
                    'height_cm': height_cm,
                    'age': age,
                    'number': jersey,
                    'aliases': [name_en.lower()]
                }
                
                all_players.append(player_entry)
            except Exception as e:
                print(f"Skipping athlete: {e}")
                
        time.sleep(0.1)

    print(f"Processed {len(all_players)} players.")
    
    js_content = f"const players = {json.dumps(all_players, indent=2, ensure_ascii=False)};\n\nmodule.exports = {{ players: players }};\n"
    
    with open("utils/players_full.js", "w", encoding='utf-8') as f:
        f.write(js_content)
    
    print("Saved to utils/players_full.js")

if __name__ == "__main__":
    process_players()
