import json

with open('timetable.json', encoding='utf-8') as f:
    data = json.load(f)

professors = set()
for item in data:
    # 교수명은 'professor' 필드에 있음
    name = (item.get('professor') or '').strip()
    if name:
        professors.add(name)

professor_list = sorted(professors)

with open('professors.json', 'w', encoding='utf-8') as f:
    json.dump(professor_list, f, ensure_ascii=False, indent=2)
