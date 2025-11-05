import json
from collections import defaultdict

with open('timetable.json', encoding='utf-8') as f:
    data = json.load(f)

rooms = set()
for item in data:
    building = (item.get('building_name') or '').strip()
    room = (item.get('classroom') or '').strip()
    if building and room:
        rooms.add((building, room))

room_list = [
    {"building": b, "room": r} for b, r in sorted(rooms)
]

with open('classrooms.json', 'w', encoding='utf-8') as f:
    json.dump(room_list, f, ensure_ascii=False, indent=2)
