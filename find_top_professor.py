import json
from collections import Counter

try:
    with open('timetable.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    professors = [item.get('professor') for item in data if item.get('professor')]
    
    if not professors:
        print("강의 데이터에서 교수님 정보를 찾을 수 없습니다.")
    else:
        professor_counts = Counter(professors)
        most_common_professor = professor_counts.most_common(1)[0]
        
        print(f"강의가 가장 많은 교수님은 '{most_common_professor[0]}'님이며, 총 {most_common_professor[1]}개의 강의를 담당하고 있습니다.")

except FileNotFoundError:
    print("timetable.json 파일을 찾을 수 없습니다.")
except Exception as e:
    print(f"데이터를 분석하는 중 오류가 발생했습니다: {e}")
