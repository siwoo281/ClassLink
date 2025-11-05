import json
from collections import Counter, defaultdict

def analyze_by_session():
    try:
        with open('timetable.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"파일을 읽는 중 오류 발생: {e}")
        return

    # '주간 수업 세션'을 기준으로 교수별 강의 수 집계
    # (교수, 과목코드, 분반, 요일)을 하나의 세션으로 간주
    sessions_by_prof = defaultdict(set)
    for item in data:
        prof = item.get('professor')
        # 온라인 강의나 교수 정보가 없는 경우는 제외
        if not prof or item.get('day') == 'ONLINE':
            continue
        
        # 고유한 세션을 식별하기 위한 키 생성
        session_key = (
            item.get('code'), 
            item.get('class_number'), 
            item.get('day')
        )
        sessions_by_prof[prof].add(session_key)

    # 세션 수 계산 및 정렬
    session_counts = {prof: len(sessions) for prof, sessions in sessions_by_prof.items()}
    sorted_counts = sorted(session_counts.items(), key=lambda x: x[1], reverse=True)

    print("--- '주간 수업 세션' 기준 TOP 5 ---")
    print(" (하루에 한 과목 수업은 1개로 계산)")
    for i, (prof, count) in enumerate(sorted_counts[:5], 1):
        print(f"{i}위: {prof} 교수님 ({count}개 세션)")
    print("-" * 35)

if __name__ == "__main__":
    analyze_by_session()
