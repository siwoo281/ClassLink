import json
from collections import defaultdict

def deep_dive():
    try:
        with open('timetable.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"파일을 읽는 중 오류 발생: {e}")
        return

    # --- 권인선 교수님 (강의 시간/슬롯 기준 1위) ---
    print("--- 권인선 교수님 상세 분석 (강의 시간/슬롯 기준) ---")
    kwon_classes = [item for item in data if item.get('professor') == '권인선']
    
    if not kwon_classes:
        print("권인선 교수님의 데이터를 찾을 수 없습니다.")
    else:
        print(f"총 강의 슬롯 수: {len(kwon_classes)}개")
        print("과목별 강의 횟수:")
        subjects = defaultdict(int)
        for item in kwon_classes:
            subjects[item.get('subject')] += 1
        
        for subject, count in sorted(subjects.items(), key=lambda x: x[1], reverse=True):
            print(f"- {subject}: {count}회")
    print("-" * 40)

    # --- 이창훈 교수님 (고유 과목 수 기준 1위) ---
    print("\\n--- 이창훈 교수님 상세 분석 (고유 과목 수 기준) ---")
    lee_classes = [item for item in data if item.get('professor') == '이창훈']
    
    if not lee_classes:
        print("이창훈 교수님의 데이터를 찾을 수 없습니다.")
    else:
        unique_courses = defaultdict(list)
        for item in lee_classes:
            course_id = (item.get('code'), item.get('subject'), item.get('class_number'))
            time_info = f"{item.get('day')} {item.get('start')}-{item.get('end')}"
            if time_info not in unique_courses[course_id]:
                unique_courses[course_id].append(time_info)

        print(f"총 고유 과목 수: {len(unique_courses)}개")
        print("과목 목록 (과목코드, 과목명, 분반):")
        for (code, subject, class_num), times in unique_courses.items():
            print(f"- {subject} ({code}, {class_num}분반)")
    print("-" * 40)

if __name__ == "__main__":
    deep_dive()
