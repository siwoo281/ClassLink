import json
import re
import os

def convert_timetable_data():
    """
    Converts the raw '개설강좌 리스트.json' to a web-app friendly format,
    with robust parsing for various time/classroom formats.
    """
    
    DAY_MAP = {'월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU', '금': 'FRI', '토': 'SAT'}
    
    BUILDING_MAP = {
        "A": "아펜젤러관", "H": "하워드관", "B": "백산관",
        "C": "정보과학관", "J": "자연과학관", "G": "국제교류관",
        "P": "21세기관", "JU": "자연과학관지하", "S": "소월관",
        "PU": "21세기관지하", "PAU": "국제언어생활관지하", "Y": "예술관",
        "MC": "미래창조관", "AM": "아펜젤러기념관", "F": "서재필관",
        "W": "우남관", "DC": "대덕산학협력관", "DS": "대덕산학협력관", "K": "김옥균관(학군단)",
        "SP": "SMART배재관", "HM": "하워드기념관"
    }

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

    def get_building_name(classroom_str):
        if not classroom_str: return ""
        # Match building codes like 'W404', 'MC207', '505-1'
        match = re.match(r"([a-zA-Z]+|505)", classroom_str)
        if match:
            code = match.group(1).upper()
            return BUILDING_MAP.get(code, code)
        return ""

    def parse_time_slots(time_str):
        slots = []
        # If no time string or it's a placeholder, return empty list -> will be marked as ONLINE
        if not time_str or time_str.strip() in ['(?)', '(), ()', '']:
            return slots

        # Split by comma to handle multiple class times, e.g., "J202(목A), J202(목B)"
        parts = time_str.split(',')

        for part in parts:
            part = part.strip()
            if not part:
                continue

            # Try to match format: "J202(목A)"
            match1 = re.match(r'([\w.-]+)\s*\(([\uac00-\ud7a3])([A-Z\d])\)', part)
            if match1:
                classroom, day_kor, period = match1.groups()
                day_eng = DAY_MAP.get(day_kor)
                time_info = PERIOD_MAP.get(period.upper())
                if day_eng and time_info:
                    slots.append({
                        "day": day_eng,
                        "start": time_info["start"],
                        "end": calculate_end_time(time_info["start"], time_info["duration"]),
                        "classroom": classroom,
                        "building_name": get_building_name(classroom)
                    })
                continue

            # Try to match format: "화E(P203)"
            match3 = re.match(r'([\uac00-\ud7a3])([A-Z\d])\(([\w.-]+)\)', part)
            if match3:
                day_kor, period, classroom = match3.groups()
                day_eng = DAY_MAP.get(day_kor)
                time_info = PERIOD_MAP.get(period.upper())
                if day_eng and time_info:
                    slots.append({
                        "day": day_eng,
                        "start": time_info["start"],
                        "end": calculate_end_time(time_info["start"], time_info["duration"]),
                        "classroom": classroom,
                        "building_name": get_building_name(classroom)
                    })
                continue

            # Try to match format: "목 A,B(J202)" (Note: comma inside is handled by splitting periods)
            match2 = re.match(r'([\uac00-\ud7a3])\s+([A-Z\d,]+)\(([\w.-]+)\)', part)
            if match2:
                day_kor, periods_str, classroom = match2.groups()
                day_eng = DAY_MAP.get(day_kor)
                if day_eng:
                    for period in periods_str.split(','):
                        period = period.strip().upper()
                        time_info = PERIOD_MAP.get(period)
                        if time_info:
                            slots.append({
                                "day": day_eng,
                                "start": time_info["start"],
                                "end": calculate_end_time(time_info["start"], time_info["duration"]),
                                "classroom": classroom,
                                "building_name": get_building_name(classroom)
                            })
        return slots

    source_file = '개설강좌 리스트.json'
    if not os.path.exists(source_file):
        print(f"Error: Source file {source_file} not found.")
        return

    with open(source_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # Skip header row if it exists
    if raw_data and '강의시수' in raw_data[0] and 'Column9' in raw_data[0]:
        raw_data = raw_data[1:]

    converted_data = []
    for record in raw_data:
        base_info = {
            "code": record.get("과목코드", "").strip(),
            "subject": record.get("과목명", "").strip(),
            "professor": record.get("담당교수", "").strip(),
            "credits": record.get("학점", "0").strip(),
            "department": record.get("이수\n구분", "").strip(),
            "class_number": record.get("분반", "").strip()
        }

        time_slots_str = record.get("강의실/강의시간", "")
        remarks = record.get("비고", "")
        
        time_slots = parse_time_slots(time_slots_str)

        # Mark as ONLINE if no valid classroom/time info is found, or if explicitly stated in remarks
        if not time_slots or "온라인" in remarks:
            new_record = base_info.copy()
            new_record.update({
                "day": "ONLINE", "start": "", "end": "", "classroom": "",
                "building_name": "", "type": "online"
            })
            converted_data.append(new_record)
        else:
            for slot in time_slots:
                new_record = base_info.copy()
                new_record.update(slot)
                new_record["type"] = "" # Not an online class
                converted_data.append(new_record)

    with open('timetable.json', 'w', encoding='utf-8') as f:
        json.dump(converted_data, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully converted {len(raw_data)} records from '{source_file}' into {len(converted_data)} web-app friendly records.")
    print("New data written to timetable.json")

if __name__ == "__main__":
    convert_timetable_data()
