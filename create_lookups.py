import json

def create_lookup_files():
    try:
        with open('timetable.json', 'r', encoding='utf-8') as f:
            timetable_data = json.load(f)

        # 교수 목록 생성
        professors_set = set()
        for item in timetable_data:
            single = (item.get('professor') or '').strip()
            if single and not single.isdigit():
                for name in single.split(','):
                    professors_set.add(name.strip())
        
        professors_list = sorted(list(professors_set))
        with open('professors.json', 'w', encoding='utf-8') as f:
            json.dump(professors_list, f, ensure_ascii=False, indent=2)
        print(f"✅ professors.json 생성 완료 ({len(professors_list)}명)")

        # 강의실 목록 생성
        classrooms_set = set()
        for item in timetable_data:
            building = (item.get('building_name') or '').strip()
            room = (item.get('classroom') or '').strip()
            if building and room:
                classrooms_set.add(f"{building}-{room}")

        classrooms_list = sorted(list(classrooms_set))
        
        # 정렬을 위해 분리 후 재조합
        temp_list = [item.split('-') for item in classrooms_list]
        temp_list.sort(key=lambda x: (x[0], int(''.join(filter(str.isdigit, x[1])) or 0)))
        
        final_classrooms = [{'building': item[0], 'room': item[1]} for item in temp_list]

        with open('classrooms.json', 'w', encoding='utf-8') as f:
            json.dump(final_classrooms, f, ensure_ascii=False, indent=2)
        print(f"✅ classrooms.json 생성 완료 ({len(final_classrooms)}개)")

    except FileNotFoundError:
        print("🔴 timetable.json 파일을 찾을 수 없습니다. converter.py를 먼저 실행해주세요.")
    except Exception as e:
        print(f"🔴 오류 발생: {e}")

if __name__ == '__main__':
    # 이 스크립트는 converter.py가 실행된 후에 별도로 실행해야 합니다.
    # 지금은 create_file 도구를 통해 직접 생성하지만,
    # 실제로는 사용자가 터미널에서 `python create_lookups.py`를 실행해야 합니다.
    pass
