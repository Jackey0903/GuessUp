from nba_api.stats.endpoints import leaguedashplayerbiostats
import json

try:
    stats = leaguedashplayerbiostats.LeagueDashPlayerBioStats()
    res = stats.get_dict()['resultSets'][0]
    headers = res['headers']
    # Find which index is PLAYER_NAME, TEAM_ABBREVIATION, PLAYER_HEIGHT_INCHES, PLAYER_POS, etc.
    # Actually let's just use get_normalized_dict
    players = stats.get_normalized_dict()
    print("Found", len(players), "players.")
    if len(players) > 0:
        print("First player:", players[0])
except Exception as e:
    print("Error:", e)
