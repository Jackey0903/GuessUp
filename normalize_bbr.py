import json
import unicodedata
import re

def normalize(name):
    # strip accents
    s = ''.join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')
    # to lower
    s = s.lower()
    # remove punctuation
    s = re.sub(r'[^a-z0-9 ]', '', s)
    return s.strip()

with open('utils/players.js', 'r', encoding='utf-8') as f:
    content = f.read()

js_code = content.split('const players = ')[1].split(';\n\nmodule.exports')[0]
players = json.loads(js_code)

# We still have the positions from fetch_bbr in memory if we re-run it, 
# but let's just use what was already applied for the 341, and try to fix the remaining ones.
# Wait, fetch_bbr ran and we lost the dictionary. Let's just re-run the matching or just read the fetch_bbr script?
# Actually, BBR page is simple, let's just re-fetch it and use normalization.
