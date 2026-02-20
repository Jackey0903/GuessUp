from nba_api.stats.endpoints import playerindex
import json

try:
    idx = playerindex.PlayerIndex(season="2023-24")
    res = idx.get_dict()['resultSets'][0]
    headers = res['headers']
    players = res['rowSet']
    print("Headers:", headers)
    if len(players) > 0:
        print("First player:", players[0])
except Exception as e:
    print("Error:", e)
