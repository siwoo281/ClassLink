import json
import re

def verify_timetable_times():
    """
    Verifies that the start/end times in timetable.json correctly match
    the period codes in the original '개설강좌 리스트.json' based on
    the conversion rules in converter.py.
    """
    
    # --- Conversion Rules (from converter.py) ---
    DAY_MAP = {'월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU', '금': 'FRI', '토': 'SAT'}
    PERIOD_MAP = {
        '0': {'start': '08:00', 'duration': 50}, '1': {'start': '09:00', 'duration': 50},
        '2': {'start': '10:00', 'duration': 50}, '3': {'start': '11:00', 'duration': 50},
        '4': {'start': '12:00', 'duration': 50}, '5': {'start': '13:00', 'duration': 50},
        '6': {'start': '14:00', 'duration': 50}, '7': {'start': '15:00', 'duration': 50},
        '8': {'start': '16:00', 'duration': 50}, '9': {'start': '17:00', 'duration': 50},
        '10': {'start': '18:00', 'duration': 50}, '11': {'start': '19:00', 'duration': 50},
        '12': {'start': '20:00', 'duration': 50}, '13': {'start': '21:00', 'duration': 50},
        'Z': {'start': '08:10', 'duration': 75}, 'A': {'start': '09:30', 'duration': 75},
        'B': {'start': '11:00', 'duration': 75}, 'C': {'start': '13:30', 'duration': 75},
        'D': {'start': '15:00', 'duration': 75}, 'E': {'start': '16:30', 'duration': 75},
        'F': {'start': '18:00', 'duration': 75}, 'G': {'start': '19:30', 'duration': 75},
        'H': {'start': '21:00', 'duration': 75},
    }

    def calculate_end_time(start_time, duration):
        if not start_time: return ''
        h, m = map(int, start_time.split(':'))
        total_minutes = h * 60 + m + duration
        end_h, end_m = divmod(total_minutes, 60)
        return f"{end_h:02d}:{end_m:02d}"

    # --- Load Data ---
    try:
        with open('개설강좌 리스트.json', 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        with open('timetable.json', 'r', encoding='utf-8') as f:
            converted_data = json.load(f)
    except FileNotFoundError as e:
        print(f"오류: 파일을 찾을 수 없습니다 - {e.filename}")
        return

    # Create a quick lookup map from the converted data
    converted_map = {}
    for item in converted_data:
        key = (item['code'], item['class_number'], item['day'])
        converted_map[key] = {'start': item['start'], 'end': item['end']}

    # --- Verification Logic ---
    mismatches = []
    total_checks = 0

    for record in raw_data:
        time_str = record.get("강의실/강의시간", "")
        if not time_str or time_str.strip() in ['(?)', '(), ()', '']:
            continue

        base_key_tuple = (record.get("과목코드", "").strip(), record.get("분반", "").strip())
        
        parts = time_str.split(',')
        for part in parts:
            part = part.strip()
            # Regex patterns from converter.py
            match1 = re.match(r'([\w.-]+)\s*\(([\uac00-\ud7a3])([A-Z\d])\)', part)
            match2 = re.match(r'([\uac00-\ud7a3])\s+([A-Z\d,]+)\(([\w.-]+)\)', part)
            match3 = re.match(r'([\uac00-\ud7a3])([A-Z\d])\(([\w.-]+)\)', part) # Added in previous fix

            if not (match1 or match2 or match3):
                continue

            if match1:
                _, day_kor, period = match1.groups()
            elif match2:
                day_kor, period, _ = match2.groups()
            elif match3:
                day_kor, period, _ = match3.groups()

            day_eng = DAY_MAP.get(day_kor)
            time_info = PERIOD_MAP.get(period.upper())

            if day_eng and time_info:
                total_checks += 1
                expected_start = time_info['start']
                expected_end = calculate_end_time(expected_start, time_info['duration'])
                
                # Find in converted data
                lookup_key = (*base_key_tuple, day_eng)
                actual_times = converted_map.get(lookup_key)

                if not actual_times:
                    mismatches.append(f"누락: {lookup_key} 과목이 timetable.json에 없습니다.")
                elif actual_times['start'] != expected_start or actual_times['end'] != expected_end:
                    mismatches.append(
                        f"불일치: {lookup_key} | "
                        f"예상: {expected_start}-{expected_end} | "
                        f"실제: {actual_times['start']}-{actual_times['end']}"
                    )

    # --- Report Results ---
    print("--- 시간표 시간대 정확성 검증 결과 ---")
    print(f"총 {total_checks}개의 시간 데이터를 검증했습니다.")
    if not mismatches:
        print("✅ 모든 시간대가 정확하게 변환되었습니다.")
    else:
        print(f"🚨 총 {len(mismatches)}개의 불일치 항목을 발견했습니다:")
        for mismatch in mismatches[:20]: # Show up to 20 mismatches
            print(f"- {mismatch}")
        if len(mismatches) > 20:
            print(f"... 외 {len(mismatches) - 20}개 더 있습니다.")
    print("------------------------------------")


if __name__ == "__main__":
    verify_timetable_times()
