import json
from collections import Counter, defaultdict

def analyze_professors():
    try:
        with open('timetable.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("오류: timetable.json 파일을 찾을 수 없습니다.")
        return
    except json.JSONDecodeError:
        print("오류: timetable.json 파일의 형식이 올바르지 않습니다.")
        return

    # 1. 강의 시간(슬롯) 기준 분석 (단순 출현 횟수)
    slot_professors = [item.get('professor') for item in data if item.get('professor')]
    if not slot_professors:
        print("분석할 교수 데이터가 없습니다.")
        return
        
    slot_counts = Counter(slot_professors)
    
    print("--- 강의 시간(슬롯) 기준 TOP 5 ---")
    print(" (한 과목이 주 2회 수업이면 2개로 계산)")
    for i, (prof, count) in enumerate(slot_counts.most_common(5), 1):
        print(f"{i}위: {prof} 교수님 ({count}개)")
    print("-" * 30)

    # 2. 고유 과목 기준 분석 (과목코드 + 분반)
    unique_courses = defaultdict(set)
    for item in data:
        prof = item.get('professor')
        course_id = (item.get('code'), item.get('class_number'))
        if prof and all(course_id):
            unique_courses[prof].add(course_id)
            
    unique_counts = {prof: len(courses) for prof, courses in unique_courses.items()}
    # Counter를 사용해 정렬
    unique_counts_sorted = Counter(unique_counts).most_common(5)

    print("--- 고유 과목 수 기준 TOP 5 ---")
    print(" (한 과목이 주 2회 수업이어도 1개로 계산)")
    for i, (prof, count) in enumerate(unique_counts_sorted, 1):
        print(f"{i}위: {prof} 교수님 ({count}개)")
    print("-" * 30)

if __name__ == "__main__":
    analyze_professors()
