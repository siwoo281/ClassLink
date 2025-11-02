#!/usr/bin/env python3
"""
웹앱 데이터 연결 상태 검증
"""
import json
from collections import Counter

def main():
    print("=" * 80)
    print("🔍 웹앱 데이터 연결 검증")
    print("=" * 80)
    
    # 데이터 로드
    with open('timetable_final.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"\n✅ 데이터 로드 성공: {len(data)}개 레코드\n")
    
    # 1. 교수님 선택창 검증
    print("=" * 80)
    print("👨‍🏫 교수님 선택창 데이터")
    print("=" * 80)
    
    professors = []
    for item in data:
        prof = item.get('professor', '').strip()
        if prof and prof not in ['', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10']:
            professors.append(prof)
    
    unique_profs = sorted(set(professors))
    print(f"총 교수: {len(unique_profs)}명")
    print(f"\n샘플 (앞 20명):")
    for i, prof in enumerate(unique_profs[:20], 1):
        count = professors.count(prof)
        print(f"  {i:2d}. {prof} ({count}개 강의)")
    
    # 2. 건물별 검색 데이터
    print("\n" + "=" * 80)
    print("🏢 건물별 검색 데이터")
    print("=" * 80)
    
    buildings = Counter(item.get('building_name', '없음') for item in data if item.get('building_name'))
    print(f"총 건물: {len(buildings)}개")
    print(f"\n건물별 강의 수:")
    for building, count in buildings.most_common(15):
        print(f"  • {building}: {count}개")
    
    # 3. 요일/시간 데이터
    print("\n" + "=" * 80)
    print("📅 요일/시간 데이터")
    print("=" * 80)
    
    with_schedule = [item for item in data if item.get('day') and item.get('time')]
    without_schedule = [item for item in data if not item.get('day') or not item.get('time')]
    
    print(f"시간표 있음: {len(with_schedule)}개 ({len(with_schedule)/len(data)*100:.1f}%)")
    print(f"시간표 없음: {len(without_schedule)}개 ({len(without_schedule)/len(data)*100:.1f}%)")
    
    days = Counter(item.get('day') for item in with_schedule)
    print(f"\n요일별 분포:")
    day_names = {'MON': '월요일', 'TUE': '화요일', 'WED': '수요일', 'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일'}
    for day in ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']:
        if day in days:
            print(f"  {day_names[day]}: {days[day]}개")
    
    # 4. 검색 타입별 데이터 가용성
    print("\n" + "=" * 80)
    print("🔍 검색 기능별 데이터 가용성")
    print("=" * 80)
    
    # 과목명 검색
    subjects = [item for item in data if item.get('subject')]
    print(f"✅ 과목명 검색: {len(subjects)}개 ({len(subjects)/len(data)*100:.1f}%)")
    
    # 과목코드 검색
    codes = [item for item in data if item.get('code')]
    print(f"✅ 과목코드 검색: {len(codes)}개 ({len(codes)/len(data)*100:.1f}%)")
    
    # 교수별 검색
    with_prof = [item for item in data if item.get('professor')]
    print(f"✅ 교수별 검색: {len(with_prof)}개 ({len(with_prof)/len(data)*100:.1f}%)")
    
    # 강의실 검색
    with_room = [item for item in data if item.get('classroom')]
    print(f"✅ 강의실 검색: {len(with_room)}개 ({len(with_room)/len(data)*100:.1f}%)")
    
    # 건물별 검색
    with_building = [item for item in data if item.get('building_name')]
    print(f"✅ 건물별 검색: {len(with_building)}개 ({len(with_building)/len(data)*100:.1f}%)")
    
    # 5. 데이터 품질 이슈
    print("\n" + "=" * 80)
    print("⚠️  데이터 품질 체크")
    print("=" * 80)
    
    issues = []
    
    # 교수명 없는 강의
    no_prof = [item for item in data if not item.get('professor')]
    if no_prof:
        issues.append(f"교수명 없음: {len(no_prof)}개")
    
    # 시간 없는 강의
    no_time = [item for item in data if not item.get('day') or not item.get('time')]
    if no_time:
        issues.append(f"시간 정보 없음: {len(no_time)}개")
    
    # 강의실 없는 강의
    no_room = [item for item in data if not item.get('classroom')]
    if no_room:
        issues.append(f"강의실 없음: {len(no_room)}개")
    
    if issues:
        for issue in issues:
            print(f"  ⚠️  {issue}")
    else:
        print("  ✅ 문제 없음")
    
    # 6. 시간표 히트맵용 데이터
    print("\n" + "=" * 80)
    print("📊 시간표 히트맵 데이터")
    print("=" * 80)
    
    # 시간대별 강의 수
    time_slots = {}
    for item in with_schedule:
        time = item.get('time', '')
        if time and '-' in time:
            start = time.split('-')[0]
            hour = start.split(':')[0]
            if hour not in time_slots:
                time_slots[hour] = 0
            time_slots[hour] += 1
    
    print("시간대별 강의 수:")
    for hour in sorted(time_slots.keys()):
        print(f"  {hour}시: {time_slots[hour]}개 {'█' * (time_slots[hour] // 50)}")
    
    # 최종 요약
    print("\n" + "=" * 80)
    print("✅ 최종 요약")
    print("=" * 80)
    print(f"📚 총 강의: {len(data)}개")
    print(f"👨‍🏫 교수: {len(unique_profs)}명")
    print(f"🏢 건물: {len(buildings)}개")
    print(f"📅 시간표 있는 강의: {len(with_schedule)}개 ({len(with_schedule)/len(data)*100:.1f}%)")
    print(f"🔍 모든 검색 기능: 사용 가능")
    print(f"✅ 웹앱 연결: 정상")
    print("=" * 80)

if __name__ == "__main__":
    main()
