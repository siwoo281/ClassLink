import json
import re
from collections import Counter

INPUT = "timetable.json"
OUTPUT = "timetable_flat.json"

code_title_pattern = re.compile(r"^(?P<code>[A-Z]{3}\d{5})\s+(?P<title>.+)$")
subject_tail_pattern = re.compile(r"^(?P<title>.+?)\s+(?P<credit>\d+(?:\.\d+)?)\s+(?P<grade>\d+)\s+(?P<classno>\d{2})$")


def clean_text(s):
    if s is None:
        return ""
    return str(s).strip()


def normalize_record(rec: dict) -> dict:
    rec = rec.copy()
    code = clean_text(rec.get("code", ""))
    subject = clean_text(rec.get("subject", ""))
    professor = clean_text(rec.get("professor", ""))

    # 1) If code contains both code and title (e.g., "GEN22102 채플2"), split.
    m = code_title_pattern.match(code)
    if m:
        code_only = m.group("code").strip()
        title_from_code = m.group("title").strip()
        # If subject is missing or looks like a credit-only value, use title from code
        if subject == "" or re.fullmatch(r"\d+(?:\.\d+)?", subject):
            subject = title_from_code
        code = code_only

    # 2) If subject includes credit/grade/class tail, strip it to keep only the title
    m2 = subject_tail_pattern.match(subject)
    if m2:
        subject = m2.group("title").strip()

    # Whitespace normalize professor
    professor = professor.replace("  ", " ")

    rec["code"] = code
    rec["subject"] = subject
    rec["professor"] = professor

    # Normalize classroom/building fields to empty string if None
    for k in ["classroom", "building_code", "building_name", "department", "college", "day", "start", "end"]:
        if rec.get(k) is None:
            rec[k] = ""
        else:
            rec[k] = clean_text(rec[k])

    return rec


def main():
    with open(INPUT, "r", encoding="utf-8") as f:
        data = json.load(f)

    total = len(data)
    fixed_code_title = 0
    fixed_subject_tail = 0
    numeric_subject_fixed = 0

    normalized = []
    for rec in data:
        before_code = rec.get("code")
        before_subject = rec.get("subject")

        new_rec = normalize_record(rec)

        # Counters (approximate):
        if before_code and isinstance(before_code, str) and code_title_pattern.match(before_code):
            fixed_code_title += 1
        if before_subject and isinstance(before_subject, str) and subject_tail_pattern.match(before_subject):
            fixed_subject_tail += 1
        if before_subject and isinstance(before_subject, str) and re.fullmatch(r"\d+(?:\.\d+)?", before_subject):
            numeric_subject_fixed += 1

        normalized.append(new_rec)

    # Stats
    profs = sorted(set([clean_text(r.get("professor", "")) for r in normalized if clean_text(r.get("professor", ""))]))

    print("--- Normalize Timetable ---")
    print(f"Input: {INPUT}")
    print(f"Output: {OUTPUT}")
    print(f"총 {total}개 → 정규화 완료")
    print(f"코드+과목명 결합 분리 건수: ~{fixed_code_title}건")
    print(f"과목명의 꼬리(학점/학년/분반) 제거 건수: ~{fixed_subject_tail}건")
    print(f"숫자만 있는 과목명 보정 건수: ~{numeric_subject_fixed}건")
    print(f"교수 수: {len(profs)}명")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(normalized, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
