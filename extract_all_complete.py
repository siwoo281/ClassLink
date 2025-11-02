import pdfplumber
import re
import json
import os

# 완전한 PDF 추출을 위한 향상된 스크립트
PDF_FILE_PATH = "붙임5 2025-2학기 강의시간 편람_250808_1600.pdf"
START_PAGE = 112
OUTPUT_JSON_FILE = "timetable_final.json"

# 시간표 매핑
TIME_MAP = {
    "Z": {"start": "08:10", "end": "09:25"}, "A": {"start": "09:30", "end": "10:45"},
    "B": {"start": "11:00", "end": "12:15"}, "C": {"start": "13:30", "end": "14:45"},
    "D": {"start": "15:00", "end": "16:15"}, "E": {"start": "16:30", "end": "17:45"},
    "F": {"start": "18:00", "end": "19:15"}, "G": {"start": "19:30", "end": "20:45"},
    "H": {"start": "21:00", "end": "22:15"},
    "0": {"start": "08:00", "end": "08:50"}, "1": {"start": "09:00", "end": "09:50"},
    "2": {"start": "10:00", "end": "10:50"}, "3": {"start": "11:00", "end": "11:50"},
    "4": {"start": "12:00", "end": "12:50"}, "5": {"start": "13:00", "end": "13:50"},
    "6": {"start": "14:00", "end": "14:50"}, "7": {"start": "15:00", "end": "15:50"},
    "8": {"start": "16:00", "end": "16:50"}, "9": {"start": "17:00", "end": "17:50"},
    "10": {"start": "18:00", "end": "18:50"}, "11": {"start": "19:00", "end": "19:50"},
    "12": {"start": "20:00", "end": "20:50"}, "13": {"start": "21:00", "end": "21:50"}
}

DAY_MAP = {"월": "MON", "화": "TUE", "수": "WED", "목": "THU", "금": "FRI", "토": "SAT"}

BUILDING_MAP = {
    "P": "배재관", "H": "현덕관", "E": "예지관", "D": "대동관", "A": "아펜젤러관",
    "R": "라이어관", "S": "학생회관", "G": "체육관", "C": "창조관", "M": "멀티미디어관",
    "K": "생명관", "B": "바이오관", "L": "학송관", "V": "생활관", "F": "예지터",
    "J": "창의관", "T": "함덕관", "Q": "생활관B동", "O": "생활관C동"
}

def parse_time_string(time_str):
    """시간 문자열 파싱"""
    if not time_str or time_str.strip() == "":
        return []
    
    schedules = []
    time_parts = [part.strip() for part in str(time_str).replace(' ', '').split(',') if part]
    
    for part in time_parts:
        if not part:
            continue
            
        day_time_match = re.match(r'([월화수목금토])([A-Z0-9]+)', part)
        if day_time_match:
            day_kr = day_time_match.group(1)
            time_codes = day_time_match.group(2)
            
            if day_kr in DAY_MAP:
                day_en = DAY_MAP[day_kr]
                
                i = 0
                while i < len(time_codes):
                    code = time_codes[i]
                    
                    if code.isdigit() and i + 1 < len(time_codes) and time_codes[i + 1].isdigit():
                        code = time_codes[i:i+2]
                        i += 2
                    else:
                        i += 1
                    
                    if code in TIME_MAP:
                        schedules.append({
                            "day": day_en,
                            "start": TIME_MAP[code]["start"],
                            "end": TIME_MAP[code]["end"]
                        })
    
    return schedules

def get_building_info(classroom_str):
    """건물 정보 추출"""
    if not classroom_str:
        return None, None
        
    building_match = re.match(r'([A-Z])', classroom_str)
    if building_match:
        building_code = building_match.group(1)
        building_name = BUILDING_MAP.get(building_code, f"{building_code}동")
        return building_code, building_name
    
    return None, None

def extract_from_text_lines(text, current_college, current_department):
    """텍스트 라인에서 직접 강의 정보 추출 (테이블 파싱 실패 시 백업)"""
    sessions = []
    lines = text.split('\n')
    
    # 패턴 완화: 과목코드, 과목명, 교수, 시간, (선택)강의실을 느슨하게 매칭
    code_re = re.compile(r'([A-Z]{3,}[0-9]{4,})')
    time_re = re.compile(r'([월화수목금토][A-Z0-9]{1,2}(?:,[월화수목금토]?[A-Z0-9]{1,2})*)')
    room_re = re.compile(r'\b([A-Z][0-9]{3,4})(?:,\s*[A-Z][0-9]{3,4})*\b')
    
    for line in lines:
        # 과목코드 필수
        code_m = code_re.search(line)
        if not code_m:
            continue
        code = code_m.group(1)

        # 시간(필수)과 강의실(선택)
        time_m = time_re.search(line)
        if not time_m:
            continue
        time_str = time_m.group(1)

        room_m = room_re.search(line)
        classroom = room_m.group(1) if room_m else ""

        # 온라인 제외 (강의실 문구 또는 라인에 온라인 포함)
        if "온라인" in line or "온라인" in classroom:
            continue

        # 과목명과 교수명 추정: 코드 이후~시간 이전 텍스트를 분해
        mid = line[line.find(code) + len(code):]
        if room_m:
            mid = mid[:mid.find(time_str)] if time_str in mid else mid
        else:
            mid = mid[:mid.find(time_str)] if time_str in mid else mid
        mid = mid.strip()

        # 교수명은 공백 없는 한글 2~4자일 가능성 높음: 마지막 토큰 후보
        tokens = [t for t in re.split(r'\s+', mid) if t]
        professor = ""
        subject = mid
        if tokens:
            # 마지막 토큰을 교수로 가정해보고, 한글 이름 패턴이면 분리
            name_cand = tokens[-1]
            if re.fullmatch(r'[가-힣]{2,4}', name_cand):
                professor = name_cand
                subject = mid[:mid.rfind(name_cand)].strip()

        # 시간 파싱
        schedules = parse_time_string(time_str)
        if not schedules:
            continue

        # 건물 정보 (없어도 진행)
        bcode, bname = get_building_info(classroom) if classroom else (None, None)

        for sched in schedules:
            sessions.append({
                "code": code,
                "subject": subject,
                "professor": professor,
                "classroom": classroom,
                "building_code": bcode or "",
                "building_name": bname or "",
                "day": sched["day"],
                "start": sched["start"],
                "end": sched["end"],
                "department": current_department,
                "college": current_college
            })
    
    return sessions

def process_pdf_comprehensive(pdf_path):
    """PDF 완전 처리 - 테이블과 텍스트 모두 활용"""
    
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {pdf_path}")
    
    all_sessions = []
    
    # 정규표현식
    COLLEGE_REGEX = re.compile(r'■\s*([^■]+?)대학', re.MULTILINE)
    DEPT_REGEX = re.compile(r'●\s*([^●]+?)(?:학과|학부|전공)', re.MULTILINE)
    
    current_college = "교양"
    current_department = "교양"
    
    print(f"'{pdf_path}' 완전 처리 시작...")
    
    with pdfplumber.open(pdf_path) as pdf:
        pages = pdf.pages[START_PAGE:]
        
        for i, page in enumerate(pages):
            page_num = START_PAGE + i + 1
            print(f"Processing Page {page_num}/{len(pdf.pages)}...")
            
            text = page.extract_text(x_tolerance=1, y_tolerance=1)
            if not text:
                continue
            
            # 1. 단과대학/학과 정보 업데이트
            college_match = COLLEGE_REGEX.search(text)
            if college_match:
                current_college = college_match.group(1).strip()
                print(f"  [College: {current_college}]")
            
            dept_match = DEPT_REGEX.search(text)
            if dept_match:
                current_department = dept_match.group(1).strip()
                if "교양" in current_department:
                    current_department = "교양"
                print(f"  [Department: {current_department}]")
            
            # 2. 다양한 테이블 추출 시도
            table_settings = [
                {"vertical_strategy": "lines", "horizontal_strategy": "text"},
                {"vertical_strategy": "text", "horizontal_strategy": "lines"},
                {"vertical_strategy": "text", "horizontal_strategy": "text"},
                {"vertical_strategy": "explicit", "horizontal_strategy": "explicit"},
            ]
            
            page_sessions = []
            
            # 테이블 방식으로 추출 시도
            for setting in table_settings:
                try:
                    tables = page.extract_tables(table_settings=setting)
                    if not tables:
                        continue
                    
                    for table in tables:
                        if not table or len(table) < 2:
                            continue
                        
                        # 테이블별 학과 헤더에서 학과명 보강
                        try:
                            header_row = table[0]
                            if header_row:
                                joined_header = " ".join([str(c) for c in header_row if c])
                                if '<' in joined_header and '>' in joined_header and '학과' in joined_header:
                                    # 예: '<간호학과-간호학>' 형태 처리
                                    header_text = joined_header[joined_header.find('<')+1: joined_header.find('>')]
                                    dept_name = header_text.split('-')[0].strip()
                                    if dept_name:
                                        current_department = dept_name
                        except Exception:
                            pass
                        
                        # 헤더 인덱스 매핑 시도
                        header_index = 0
                        code_idx = subject_idx = professor_idx = time_idx = room_idx = None
                        for hi, hrow in enumerate(table[:3]):  # 처음 3행 중에서 헤더 탐색
                            if not hrow:
                                continue
                            labels = [str(x) if x else '' for x in hrow]
                            if any('교과목코드' in x for x in labels):
                                header_index = hi
                                # 각 컬럼 인덱스 찾기
                                for idx, label in enumerate(labels):
                                    if '교과목코드' in label:
                                        code_idx = idx
                                    elif '교과목명' in label:
                                        subject_idx = idx
                                    elif '담당교수' in label:
                                        professor_idx = idx
                                    elif '강의시간' in label:
                                        time_idx = idx
                                    elif '강의실' in label:
                                        room_idx = idx
                                break
                        
                        # 다양한 컬럼 구조 대응
                        for row in table[header_index+1:]:  # 헤더 다음부터
                            if not row or len(row) < 8:
                                continue
                            
                            # 과목 코드 및 다른 컬럼 찾기
                            _code_idx = code_idx
                            if _code_idx is None:
                                for idx, cell in enumerate(row):
                                    if cell and re.search(r'[A-Z]{3,}[0-9]{4,}', str(cell)):
                                        _code_idx = idx
                                        break
                            if _code_idx is None:
                                continue
                            
                            try:
                                # 컬럼 구조 추정: 헤더 매핑 우선, 실패 시 상대 오프셋
                                code = str(row[_code_idx]).strip()
                                subject = str(row[subject_idx] if subject_idx is not None and subject_idx < len(row) else (row[_code_idx + 1] if _code_idx + 1 < len(row) else "")).strip()
                                professor = str(row[professor_idx] if professor_idx is not None and professor_idx < len(row) else (row[_code_idx + 4] if _code_idx + 4 < len(row) else "")).strip()
                                time_str = str(row[time_idx] if time_idx is not None and time_idx < len(row) else (row[_code_idx + 5] if _code_idx + 5 < len(row) else "")).strip()
                                room_str = str(row[room_idx] if room_idx is not None and room_idx < len(row) else (row[_code_idx + 6] if _code_idx + 6 < len(row) else "")).strip()
                                
                                # 기본 검증
                                if not re.search(r'[A-Z]{3,}[0-9]{4,}', code):
                                    continue
                                
                                # 온라인만 제외, 강의실 누락은 허용
                                if "온라인" in room_str:
                                    continue
                                
                                if not professor:
                                    professor = ""
                                
                                # 시간 파싱
                                schedules = parse_time_string(time_str)
                                if not schedules:
                                    continue
                                
                                # 건물 정보 (없어도 진행)
                                building_code, building_name = get_building_info(room_str) if room_str else ("", "")
                                
                                # 세션 생성
                                for sched in schedules:
                                    session = {
                                        "code": code,
                                        "subject": subject,
                                        "professor": professor,
                                        "classroom": room_str.split(',')[0].strip() if room_str else "",
                                        "building_code": building_code,
                                        "building_name": building_name,
                                        "day": sched["day"],
                                        "start": sched["start"],
                                        "end": sched["end"],
                                        "department": current_department,
                                        "college": current_college
                                    }
                                    page_sessions.append(session)
                            
                            except (IndexError, ValueError):
                                continue
                    
                    if page_sessions:  # 테이블에서 성공하면 다른 설정 시도 안함
                        break
                        
                except Exception as e:
                    continue
            
            # 3. 텍스트 방식으로 추가 추출 (테이블 방식 보완)
            text_sessions = extract_from_text_lines(text, current_college, current_department)
            
            # 4. 중복 제거하고 병합
            existing_codes = set((s['code'], s['day'], s['start']) for s in page_sessions)
            for session in text_sessions:
                key = (session['code'], session['day'], session['start'])
                if key not in existing_codes:
                    page_sessions.append(session)
            
            all_sessions.extend(page_sessions)
            
            if page_sessions:
                print(f"  -> {len(page_sessions)}개 강의 추출")
    
    print(f"\n--- 처리 완료 ---")
    print(f"✅ 총 {len(all_sessions)}개 강의 추출")
    
    return all_sessions

def main():
    try:
        # PDF 완전 처리
        sessions = process_pdf_comprehensive(PDF_FILE_PATH)
        
        # JSON 저장
        with open(OUTPUT_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(sessions, f, ensure_ascii=False, indent=2)
        
        print(f"✅ '{OUTPUT_JSON_FILE}' 저장 완료")
        
        # 통계
        professors = set(s['professor'] for s in sessions if s['professor'])
        departments = set(s['department'] for s in sessions)
        buildings = set(s['building_name'] for s in sessions)
        
        print(f"📊 최종 통계:")
        print(f"  - 총 강의: {len(sessions)}개")
        print(f"  - 교수: {len(professors)}명")
        print(f"  - 학과: {len(departments)}개")
        print(f"  - 건물: {len(buildings)}개")
        
        # 박준용 교수님 확인
        park_classes = [s for s in sessions if s['professor'] == '박준용']
        if park_classes:
            print(f"\n🎯 박준용 교수님: {len(park_classes)}개 강의")
            for cls in park_classes:
                print(f"  - {cls['subject']} ({cls['day']} {cls['start']}-{cls['end']})")
        
    except Exception as e:
        print(f"❌ 오류: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()