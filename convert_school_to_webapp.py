#!/usr/bin/env python3
"""
개설강좌 리스트.json을 웹앱 형식(timetable_project.json)으로 변환
 - 오프라인 강의: 요일/시간/강의실 포함
 - 온라인/미정 강의: day="ONLINE", type="Online" 플래그로 표시
 - 모든 오프라인 강의에는 start/end 필드를 포함
"""
import json
import re

def parse_time_slot(time_str):
    """
    강의실/강의시간 문자열 파싱
    예: "W310(수7)" -> day="WED", time="12:00-12:30", classroom="W310"
    예: "P509(화A)" -> day="TUE", time="09:00-09:50", classroom="P509"
    """
    if not time_str or time_str == '(?)' or '온라인' in time_str:
        return []
    
    # 여러 강의실/시간이 있을 수 있음: "W310(수7), W310(금7)"
    slots = []
    
    # 패턴: 강의실(요일시간) - 건물코드는 알파벳 or 숫자-숫자
    pattern = r'([A-Z0-9가-힣-]+)\(([^)]+)\)'
    matches = re.findall(pattern, time_str)
    
    day_map = {
        '월': 'MON', '화': 'TUE', '수': 'WED',
        '목': 'THU', '금': 'FRI', '토': 'SAT'
    }
    
    # 숫자 교시 -> 시작 시간 (30분 단위)
    time_map_num = {
        '1': ('09:00', '09:30'), '2': ('09:30', '10:00'), '3': ('10:00', '10:30'), '4': ('10:30', '11:00'),
        '5': ('11:00', '11:30'), '6': ('11:30', '12:00'), '7': ('12:00', '12:30'), '8': ('12:30', '13:00'),
        '9': ('13:00', '13:30'), '10': ('13:30', '14:00'), '11': ('14:00', '14:30'), '12': ('14:30', '15:00'),
        '13': ('15:00', '15:30'), '14': ('15:30', '16:00'), '15': ('16:00', '16:30'), '16': ('16:30', '17:00'),
        '17': ('17:00', '17:30'), '18': ('17:30', '18:00'), '19': ('18:00', '18:30'), '20': ('18:30', '19:00'),
        '21': ('19:00', '19:30'), '22': ('19:30', '20:00')
    }
    
    # 알파벳 교시 -> 시작 시간 (50분 단위)
    time_map_alpha = {
        'A': ('09:00', '09:50'), 'B': ('10:00', '10:50'), 'C': ('11:00', '11:50'),
        'D': ('13:00', '13:50'), 'E': ('14:00', '14:50'), 'F': ('15:00', '15:50'),
        'G': ('16:00', '16:50'), 'H': ('17:00', '17:50'), 'I': ('18:00', '18:50'),
        'J': ('19:00', '19:50'), 'K': ('20:00', '20:50')
    }
    
    for classroom, time_info in matches:
        # 요일과 교시 파싱: "수7" or "화A"
        parts = re.findall(r'([월화수목금토])([0-9A-Z]+)', time_info)
        
        for day_kr, period in parts:
            day = day_map.get(day_kr)
            if not day:
                continue
            
            # 교시가 숫자인지 알파벳인지 확인
            if period.isdigit():
                time_range = time_map_num.get(period)
            elif period.isalpha() and len(period) == 1:
                time_range = time_map_alpha.get(period)
            else:
                # 복수 교시: "67" or "ABC"
                if period[0].isdigit():
                    # 연속된 숫자 교시
                    start_time = time_map_num.get(period[0], ('09:00', '09:30'))[0]
                    end_time = time_map_num.get(period[-1], ('18:00', '18:30'))[1]
                    time_range = (start_time, end_time)
                else:
                    # 연속된 알파벳 교시
                    start_time = time_map_alpha.get(period[0], ('09:00', '09:50'))[0]
                    end_time = time_map_alpha.get(period[-1], ('18:00', '18:50'))[1]
                    time_range = (start_time, end_time)
            
            if not time_range:
                continue
            
            start, end = time_range
            time_str_val = f"{start}-{end}"

            slots.append({
                'day': day,
                'time': time_str_val,
                'start': start,
                'end': end,
                'classroom': classroom
            })
    
    return slots

def get_building_code(classroom):
    """강의실에서 건물 코드 추출"""
    if not classroom:
        return ''
    
    # 알파벳으로 시작하는 경우
    match = re.match(r'^([A-Z]+)', classroom)
    if match:
        return match.group(1)
    
    # 숫자로 시작하는 경우 (예: "505-1")
    match = re.match(r'^(\d+)', classroom)
    if match:
        return match.group(1)
    
    # 한글 건물명인 경우
    match = re.match(r'^([가-힣]+)', classroom)
    if match:
        return match.group(1)
    
    return ''

# 건물 코드 -> 건물 이름 매핑
BUILDING_MAP = {
    '505': '505관',
    'A': '아펜젤러관',
    'AM': '아펜젤러기념관',
    'AU': 'AU관',
    'B': '백산관',
    'C': 'C관',
    'DC': '대덕산학협력관',
    'DS': '대덕산학협력관',
    'E': '정보과학관',
    'F': '서재필관',
    'G': '자연과학관',
    'H': '하워드관',
    'HM': '하워드기념관',
    'I': '국제교류관',
    'J': 'J관',
    'JU': 'J관지하',
    'K': '김옥균관',
    'M': 'M동',
    'MC': 'M동',
    'P': '21세기관',
    'PAU': '국제언어생활관지하',
    'PU': '21세기관지하',
    'S': '소월관',
    'SP': 'SMART배재관',
    'T': '예술관',
    'W': '우남관',
    'Y': 'Y관',
    'ZY': 'ZY관'
}

def main():
    print("개설강좌 리스트.json을 웹앱 형식으로 변환 중...")
    
    # 원본 데이터 로드
    with open('개설강좌 리스트.json', 'r', encoding='utf-8') as f:
        school_data = json.load(f)
    
    # 헤더 행 제외
    school_data = [item for item in school_data if item.get('과목코드')]
    
    print(f"원본 데이터: {len(school_data)}개 과목")
    
    # 변환
    converted = []
    skipped = 0
    
    for item in school_data:
        code = item.get('과목코드', '').strip()
        subject = item.get('과목명', '').strip()
        section = item.get('분반', '').strip()
        professor = item.get('담당교수', '').strip()
        credit = item.get('학점', '').strip()
        classroom_time = item.get('강의실/강의시간', '').strip()
        
        try:
            student_count = int(item.get('수강\n인원', '0').strip())
        except (ValueError, TypeError):
            student_count = 0
        
        if not code or not subject:
            skipped += 1
            continue
        
        # 강의실/시간 파싱
        time_slots = parse_time_slot(classroom_time)
        
        if not time_slots:
            # 시간/강의실 정보가 없으면 온라인/비대면/미정으로 간주
            converted.append({
                'code': code,
                'subject': subject,
                'section': section,
                'professor': professor,
                'credit': credit,
                'day': 'ONLINE',
                'time': '',
                'start': '',
                'end': '',
                'type': 'Online',
                'classroom': '',
                'building_code': '',
                'building_name': '',
                'department': '',  # 개설강좌 리스트에는 학과 정보 없음
                'student_count': student_count
            })
        else:
            # 각 시간 슬롯마다 별도 레코드 생성
            for slot in time_slots:
                building_code = get_building_code(slot['classroom'])
                building_name = BUILDING_MAP.get(building_code, building_code)
                
                converted.append({
                    'code': code,
                    'subject': subject,
                    'section': section,
                    'professor': professor,
                    'credit': credit,
                    'day': slot['day'],
                    'time': slot['time'],
                    'start': slot['start'],
                    'end': slot['end'],
                    'classroom': slot['classroom'],
                    'building_code': building_code,
                    'building_name': building_name,
                    'department': '',
                    'student_count': student_count
                })
    
    print(f"변환 완료: {len(converted)}개 레코드")
    print(f"스킵: {skipped}개")
    
    # 저장
    with open('timetable_flat.json', 'w', encoding='utf-8') as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ timetable_flat.json 생성 완료!")
    
    # 통계
    from collections import Counter
    
    professors = [item['professor'] for item in converted if item['professor']]
    buildings = [item['building_name'] for item in converted if item['building_name']]
    days = [item['day'] for item in converted if item['day']]
    
    print(f"\n📊 통계:")
    print(f"  총 레코드: {len(converted)}개")
    print(f"  고유 교수: {len(set(professors))}명")
    print(f"  고유 건물: {len(set(buildings))}개")
    print(f"  요일별 분포:")
    for day, count in Counter(days).most_common():
        print(f"    {day}: {count}개")
    
    print(f"\n🏢 건물별 분포 (Top 10):")
    for building, count in Counter(buildings).most_common(10):
        print(f"  {building}: {count}개")
    
    print(f"\n👨‍🏫 교수별 강의 수 (Top 10):")
    for prof, count in Counter(professors).most_common(10):
        print(f"  {prof}: {count}개")

if __name__ == "__main__":
    main()
