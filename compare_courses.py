import json
from collections import defaultdict

# 파일 경로
ORIGINAL_PATH = '개설강좌 리스트.json'
CONVERTED_PATH = 'timetable.json'

# 주요 비교 필드 정의 (필요시 수정)
ORIGINAL_CODE_FIELD = 'Column2'  # 예시: 과목코드
ORIGINAL_NAME_FIELD = 'Column3'  # 예시: 과목명
ORIGINAL_PROF_FIELD = 'Column8'  # 예시: 교수명
CONVERTED_CODE_FIELD = 'code'
CONVERTED_NAME_FIELD = 'subject'
CONVERTED_PROF_FIELD = 'professor'

# 파일 로드 함수
def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

# 원본 데이터 로드
original = load_json(ORIGINAL_PATH)
converted = load_json(CONVERTED_PATH)

# 원본: 과목코드 기준 dict
orig_dict = defaultdict(list)
for item in original:
    code = str(item.get(ORIGINAL_CODE_FIELD, '')).strip()
    if code:
        orig_dict[code].append(item)

# 변환본: 과목코드 기준 dict
conv_dict = defaultdict(list)
for item in converted:
    code = str(item.get(CONVERTED_CODE_FIELD, '')).strip()
    if code:
        conv_dict[code].append(item)

# 검증 결과 저장
missing_in_converted = []
missing_in_original = []
diff_items = []

# 원본 기준 검증
for code, orig_items in orig_dict.items():
    if code not in conv_dict:
        missing_in_converted.append(code)
    else:
        # 각 필드 비교 (과목명, 교수명 등)
        for o in orig_items:
            found = False
            for c in conv_dict[code]:
                if (str(o.get(ORIGINAL_NAME_FIELD, '')).strip() == str(c.get(CONVERTED_NAME_FIELD, '')).strip() and
                    str(o.get(ORIGINAL_PROF_FIELD, '')).strip() == str(c.get(CONVERTED_PROF_FIELD, '')).strip()):
                    found = True
                    break
            if not found:
                diff_items.append({'code': code, 'original': o, 'converted': conv_dict[code]})

# 변환본 기준 검증 (추가된 항목)
for code in conv_dict:
    if code not in orig_dict:
        missing_in_original.append(code)

# 결과 출력
print('원본에만 있고 변환본에 없는 과목코드:', missing_in_converted)
print('변환본에만 있고 원본에 없는 과목코드:', missing_in_original)
print('필드 불일치 항목:', diff_items)
print(f'원본 강좌 수: {len(original)}, 변환 강좌 수: {len(converted)}')
