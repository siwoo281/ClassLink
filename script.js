// ===== 데이터 정의 =====
// 배재대학교 2025학년도 2학기 실제 강의 시간표 데이터
let timetableData = [];
let professorsList = [];

        // 건물 코드 → 표준 건물명 매핑 (개설강좌 리스트 기준)
const BUILDING_NAME_MAP = {
            "505": "505관",
            "A": "아펜젤러관",
            "AM": "아펜젤러기념관",
            "AU": "AU관",
            "B": "백산관",
            "C": "C관",
            "DC": "대덕산학협력관",
            "DS": "대덕산학협력관",
            "F": "서재필관",
            "G": "국제교류관",
            "H": "하워드관",
            "HM": "하워드기념관",
            "J": "J관",
            "JU": "J관지하",
            "K": "김옥균관",
            "MC": "M동",
            "P": "21세기관",
            "PAU": "국제언어생활관지하",
            "PU": "21세기관지하",
            "S": "소월관",
            "SP": "SMART배재관",
            "W": "우남관",
            "Y": "Y관",
            "ZY": "ZY관"
        };

        // 표시용: 교수명 배열 필드가 있으면 우선 사용
function getProfessorDisplay(item) {
            if (Array.isArray(item.professors) && item.professors.length > 0) {
                return item.professors.join(', ');
            }
            return item.professor || '';
        }

function getRoomDisplay(item) {
            if (item.day === 'ONLINE' || String(item.type||'').toLowerCase() === 'online') {
                return '온라인';
            }
            const b = (item.building_name || '').trim();
            const r = (item.classroom || '').trim();
            if (b && r) return `${b} ${r}`;
            if (b) return b;
            if (r) return r;
            return '-';
        }

    // JSON 파일에서 데이터 로드
async function loadTimetableData() {
            try {
                // 공식 데이터 소스: timetable_project.json 사용
                const response = await fetch('timetable_project.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const raw = await response.json();

                // 정규화 및 건물명 교체: building_code 기준으로 표준 건물명 적용
                timetableData = raw.map(item => {
                    const code = (item.building_code || '').trim();
                    const correctedName = BUILDING_NAME_MAP[code] || (item.building_name || '').trim();
                    // start/end 없고 time만 있는 레코드는 분리
                    let start = item.start, end = item.end;
                    if ((!start || !end) && item.time && item.time.includes('-')) {
                        const [s, e] = item.time.split('-');
                        start = (s || '').trim();
                        end = (e || '').trim();
                    }
                    return { ...item, building_name: correctedName, start, end };
                });
                
                // 교수님 목록 생성 (이름이 있는 경우만)
                const professorsSet = new Set();
                let missingProfessorCount = 0;
                
                timetableData.forEach(item => {
                    const single = (item.professor || '').trim();
                    const multi = Array.isArray(item.professors) ? item.professors : [];
                    
                    // professors 배열이 있으면 우선 사용
                    if (multi.length > 0) {
                        multi.forEach(name => {
                            const n = String(name || '').trim();
                            if (n && !['01','02','03','04','05','06','07','08','09','10'].includes(n)) {
                                professorsSet.add(n);
                            }
                        });
                    }
                    // single professor 필드 사용 (분반 번호 제외)
                    if (single && !['','01','02','03','04','05','06','07','08','09','10'].includes(single)) {
                        professorsSet.add(single);
                    }
                    
                    // 둘 다 없으면 누락
                    if (!single && multi.length === 0) {
                        missingProfessorCount++;
                    }
                });
                professorsList = Array.from(professorsSet).sort();
                
                console.log(`교수님 이름 누락된 강의: ${missingProfessorCount}개`);
                
                // 교수님 드롭다운 채우기
                populateProfessorDropdown();
                
                const onlineCount = timetableData.filter(i => i.day === 'ONLINE' || (i.type || '').toLowerCase() === 'online').length;
                console.log(`시간표 데이터 로드 완료: ${timetableData.length}개 강의, ${professorsList.length}명 교수 (온라인 ${onlineCount}개)`);
                
                // 데이터 로드 후 현재 섹션 다시 초기화
                const activeNavLink = document.querySelector('.nav-link.active');
                if (activeNavLink) {
                    const currentSection = activeNavLink.getAttribute('data-target');
                    initializeSection(currentSection);
                }
            } catch (error) {
                console.error('시간표 데이터 로드 실패:', error);
                // 에러 발생 시 빈 배열로 설정 및 화면 안내
                timetableData = [];

                const statsContainer = document.getElementById('current-stats');
                const roomsContainer = document.getElementById('current-rooms');
                if (statsContainer) {
                    statsContainer.innerHTML = `
                        <div class="stat-card">
                            <div class="stat-number">⚠️</div>
                            <div class="stat-label">데이터 로드 실패</div>
                        </div>
                    `;
                }
                if (roomsContainer) {
                    roomsContainer.innerHTML = `
                        <div class="card">
                            <div class="card-title">데이터를 불러오지 못했습니다</div>
                            <div class="card-content">네트워크 상태를 확인한 후 새로고침하거나, 잠시 후 다시 시도해주세요.</div>
                        </div>
                    `;
                }
                const scheduleResults = document.getElementById('schedule-results');
                if (scheduleResults) {
                    scheduleResults.innerHTML = `
                        <div class="card">
                            <div class="card-title">데이터 로드 실패</div>
                            <div class="card-content">시간표 데이터를 불러오지 못했습니다. 오프라인 강의 검색 기능이 제한될 수 있습니다.</div>
                        </div>
                    `;
                }
            }
        }

        // 배재대학교 주변 맛집 데이터 (예시)
        const restaurantsData = [
            { "name": "배재학식당", "category": "한식", "menu": "김치찌개, 된장찌개, 불고기정식" },
            { "name": "대전 명동칼국수", "category": "한식", "menu": "칼국수, 만두, 비빔국수" },
            { "name": "청춘반점", "category": "중식", "menu": "짜장면, 짬뽕, 탕수육" },
            { "name": "홍콩반점", "category": "중식", "menu": "볶음밥, 깐풍기, 유린기" },
            { "name": "돈까스 명가", "category": "일식", "menu": "등심돈까스, 치즈돈까스, 우동" },
            { "name": "초밥의달인", "category": "일식", "menu": "모듬초밥, 연어초밥, 회덮밥" },
            { "name": "맘스터치 배재대점", "category": "패스트푸드", "menu": "싸이버거, 치킨버거, 감자튀김" },
            { "name": "맥도날드 대전용문점", "category": "패스트푸드", "menu": "빅맥, 새우버거, 맥너겟" },
            { "name": "커피베네 배재대점", "category": "카페", "menu": "아메리카노, 카페라떼, 샌드위치" },
            { "name": "스타벅스 대전용문점", "category": "카페", "menu": "아메리카노, 프라푸치노, 머핀" },
            { "name": "교촌치킨 용문점", "category": "치킨", "menu": "허니콤보, 레드콤보, 간장치킨" },
            { "name": "네네치킨 대전용문점", "category": "치킨", "menu": "양념치킨, 후라이드, 반반치킨" },
            { "name": "피자헛 대전용문점", "category": "피자", "menu": "슈퍼슈프림, 불고기피자, 콤비네이션" },
            { "name": "도미노피자 용문점", "category": "피자", "menu": "페퍼로니, 포테이토, 치즈피자" },
            { "name": "국밥천국", "category": "한식", "menu": "순대국밥, 돼지국밥, 내장국밥" },
            { "name": "용문갈비집", "category": "한식", "menu": "갈비탕, 갈비구이, 냉면" },
            { "name": "분식천국", "category": "분식", "menu": "떡볶이, 김밥, 순대" },
            { "name": "24시간 김밥천국", "category": "분식", "menu": "참치김밥, 제육김밥, 라면" },
            { "name": "파스타클럽", "category": "양식", "menu": "크림파스타, 토마토파스타, 리조또" },
            { "name": "쉐프의정원", "category": "양식", "menu": "스테이크, 파스타, 샐러드" }
        ];

        // ===== 3.1. SPA 내비게이션 로직 =====
document.addEventListener('DOMContentLoaded', async function() {
            // JSON 데이터 먼저 로드
            await loadTimetableData();
            
            // 햄버거 메뉴 토글
            const menuToggle = document.getElementById('menu-toggle');
            const nav = document.querySelector('nav');
            
            if (menuToggle) {
                menuToggle.addEventListener('click', function() {
                    nav.classList.toggle('nav-open');
                });
            }
            
            // 로고 클릭 시 홈으로 이동
            const navBrand = document.querySelector('.nav-brand');
            if (navBrand) {
                navBrand.addEventListener('click', function() {
                    // 홈 링크 찾아서 클릭 이벤트 트리거
                    const homeLink = document.querySelector('[data-target="home"]');
                    if (homeLink && homeLink.classList.contains('nav-link')) {
                        homeLink.click();
                    }
                });
            }
            
            // 내비게이션 링크 이벤트 리스너
            const navLinks = document.querySelectorAll('[data-target]');
            const sections = document.querySelectorAll('section');

            navLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetId = this.getAttribute('data-target');

                    // 모바일: 메뉴 닫기
                    if (nav) {
                        nav.classList.remove('nav-open');
                    }

                    // 모든 섹션 숨기기
                    sections.forEach(section => {
                        section.classList.add('section-hidden');
                    });

                    // 모든 링크에서 active 클래스 제거
                    navLinks.forEach(navLink => {
                        navLink.classList.remove('active');
                    });

                    // 선택된 섹션 보이기
                    const targetSection = document.getElementById(targetId);
                    if (targetSection) {
                        targetSection.classList.remove('section-hidden');
                    }

                    // 선택된 링크에 active 클래스 추가
                    this.classList.add('active');

                    // 섹션별 초기화 함수 호출
                    initializeSection(targetId);
                });
            });

            // 초기 로드 시 홈 섹션 초기화
            initializeSection('home');
            initializeSearchSection();
            initializeScheduleSection();
            initializeRouletteSection();
        });

        // ===== 3.2. 기능 1: 실시간 현황 (Home) =====
function initializeSection(sectionId) {
            switch(sectionId) {
                case 'home':
                    updateRealTimeStatus();
                    break;
                case 'heatmap':
                    renderHeatmapChart();
                    break;
            }
        }

function updateRealTimeStatus() {
            // 데이터가 아직 로드되지 않았으면 로딩 표시
            if (!timetableData || timetableData.length === 0) {
                const statsContainer = document.getElementById('current-stats');
                const roomsContainer = document.getElementById('current-rooms');
                
                statsContainer.innerHTML = `
                    <div class="stat-card">
                        <div class="stat-number">⏳</div>
                        <div class="stat-label">데이터 로딩 중...</div>
                    </div>
                `;
                
                roomsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">📊 데이터를 불러오는 중입니다</div>
                        <div class="card-content">잠시만 기다려주세요...</div>
                    </div>
                `;
                return;
            }

            const now = new Date();
            const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const currentDay = dayNames[now.getDay()];
            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                               now.getMinutes().toString().padStart(2, '0');

            // 기준 시각 표시 (중복 생성 방지)
            const homeSection = document.getElementById('home');
            let baseline = document.getElementById('baseline-time');
            if (homeSection) {
                if (!baseline) {
                    baseline = document.createElement('div');
                    baseline.id = 'baseline-time';
                    baseline.className = 'baseline-time';
                    const titleEl = homeSection.querySelector('.section-title');
                    if (titleEl) {
                        titleEl.insertAdjacentElement('afterend', baseline);
                    } else {
                        homeSection.prepend(baseline);
                    }
                }
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                baseline.textContent = `기준 시각: ${y}-${m}-${d} ${currentTime}`;
            }

            // 현재 사용 중인 강의실 계산
            const occupiedRooms = timetableData.filter(item => {
                return item.day === currentDay && 
                       currentTime >= item.start && 
                       currentTime < item.end;
            });

            // 전체 강의실 목록
            const allRooms = [...new Set(timetableData
                .map(item => `${(item.building_name||'').trim()}-${(item.classroom||'').trim()}`)
                .filter(key => key !== '-')
            )];

            // 빈 강의실 계산
            const occupiedRoomKeys = occupiedRooms.map(item => 
                `${(item.building_name||'').trim()}-${(item.classroom||'').trim()}`
            );
            const emptyRoomsCount = allRooms.length - occupiedRoomKeys.length;

            // 통계 카드 렌더링
            const statsContainer = document.getElementById('current-stats');
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-number">${occupiedRooms.length}</div>
                    <div class="stat-label">사용 중인 강의실</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${emptyRoomsCount}</div>
                    <div class="stat-label">빈 강의실</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${allRooms.length}</div>
                    <div class="stat-label">전체 강의실</div>
                </div>
            `;

            // 현재 진행 중인 강의 카드 렌더링
            const roomsContainer = document.getElementById('current-rooms');
            if (occupiedRooms.length > 0) {
                const roomCards = occupiedRooms.map(room => `
                    <div class="card">
                        <div class="card-title">🏛️ ${getRoomDisplay(room)}</div>
                        <div class="card-content">
                            <strong>${room.subject}</strong><br>
                            👨‍🏫 ${getProfessorDisplay(room)}<br>
                            🏫 ${room.department}<br>
                            ⏰ ${room.start} - ${room.end}
                        </div>
                    </div>
                `).join('');
                roomsContainer.innerHTML = roomCards;
            } else {
                roomsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">😴 현재 진행 중인 강의가 없습니다</div>
                        <div class="card-content">
                            현재 시간에는 모든 강의실이 비어있습니다.
                        </div>
                    </div>
                `;
            }
        }

        // ===== 3.3. 기능 2: 빈 강의실 검색 (Search) =====
function initializeSearchSection() {
            const searchButton = document.getElementById('search-button');
            const timeButtons = document.querySelectorAll('.time-btn');
            const timeSelect = document.getElementById('time-select');

            // 시간 버튼 이벤트
            timeButtons.forEach(button => {
                button.addEventListener('click', function() {
                    timeButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    timeSelect.value = this.dataset.time;
                });
            });

            // 검색 버튼 이벤트
            searchButton.addEventListener('click', function() {
                const selectedDay = document.getElementById('day-select').value;
                const selectedTime = timeSelect.value;

                if (!selectedDay) {
                    alert('요일을 선택해주세요.');
                    return;
                }

                if (!selectedTime) {
                    alert('시간을 선택해주세요.');
                    return;
                }

                searchEmptyClassrooms(selectedDay, selectedTime);
            });
        }

function searchEmptyClassrooms(selectedDay, selectedTime) {
            // 데이터가 아직 로드되지 않았으면 경고
            if (!timetableData || timetableData.length === 0) {
                const resultsContainer = document.getElementById('search-results');
                resultsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">⏳ 데이터를 불러오는 중입니다</div>
                        <div class="card-content">잠시 후 다시 시도해주세요.</div>
                    </div>
                `;
                return;
            }

            // 선택된 시간에 사용 중인 강의실
            const occupiedRooms = timetableData.filter(item => {
                return item.day === selectedDay && 
                       selectedTime >= item.start && 
                       selectedTime < item.end;
            });

            const occupiedRoomKeys = occupiedRooms.map(item => 
                `${(item.building_name||'').trim()}-${(item.classroom||'').trim()}`
            );

            // 전체 강의실에서 사용 중인 강의실 제외
            const allRoomsData = timetableData.reduce((acc, item) => {
                const key = `${(item.building_name||'').trim()}-${(item.classroom||'').trim()}`;
                if (!acc[key]) {
                    acc[key] = {
                        classroom: item.classroom,
                        building_name: item.building_name
                    };
                }
                return acc;
            }, {});

            const emptyRooms = Object.entries(allRoomsData)
                .filter(([key]) => !occupiedRoomKeys.includes(key))
                .map(([key, data]) => data);

            // 결과 렌더링
            const resultsContainer = document.getElementById('search-results');
            const dayNames = {
                'MON': '월요일', 'TUE': '화요일', 'WED': '수요일',
                'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일'
            };

            if (emptyRooms.length > 0) {
                const roomCards = emptyRooms.map(room => `
                    <div class="card">
                        <div class="card-title">🏛️ ${getRoomDisplay(room)}</div>
                        <div class="card-content">
                            ⏰ ${dayNames[selectedDay]} ${selectedTime}
                        </div>
                    </div>
                `).join('');
                resultsContainer.innerHTML = roomCards;
            } else {
                resultsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">😔 빈 강의실이 없습니다</div>
                        <div class="card-content">
                            해당 시간에는 모든 강의실이 사용 중입니다.
                        </div>
                    </div>
                `;
            }
        }

        // 교수님 드롭다운 채우기
function populateProfessorDropdown() {
            const professorSelect = document.getElementById('professor-select');
            if (!professorSelect || professorsList.length === 0) return;
            
            // 기존 옵션들 제거 (첫 번째 기본 옵션 제외)
            professorSelect.innerHTML = '<option value="">교수님을 선택하세요</option>';
            
            // 교수님들을 드롭다운에 추가
            professorsList.forEach(professor => {
                const option = document.createElement('option');
                option.value = professor;
                option.textContent = professor;
                professorSelect.appendChild(option);
            });
        }

        // 검색 타입에 따라 UI 토글
function toggleSearchUI() {
            const searchType = document.getElementById('schedule-type').value;
            const searchInputGroup = document.getElementById('search-input-group');
            const professorSelectGroup = document.getElementById('professor-select-group');
            
            if (searchType === 'professor-timetable') {
                searchInputGroup.style.display = 'none';
                professorSelectGroup.style.display = 'block';
            } else if (searchType === 'missing-professor') {
                // 교수명 누락 강의는 검색어 입력 불필요
                searchInputGroup.style.display = 'none';
                professorSelectGroup.style.display = 'none';
            } else {
                searchInputGroup.style.display = 'block';
                professorSelectGroup.style.display = 'none';
            }
        }

        // ===== 3.4. 기능 3: 스케줄 조회 (Schedule) =====
function initializeScheduleSection() {
            const searchButton = document.getElementById('schedule-search-button');
            const searchQuery = document.getElementById('schedule-query');
            const searchType = document.getElementById('schedule-type');
            
            function performSearch() {
                const type = searchType.value;
                if (type === 'professor-timetable') {
                    const selectedProfessor = document.getElementById('professor-select').value;
                    if (selectedProfessor) {
                        showProfessorTimetable(selectedProfessor);
                    }
                } else if (type === 'missing-professor') {
                    // 교수명 누락 강의는 검색어 없이 바로 검색
                    searchSchedule(type, '');
                } else {
                    const query = searchQuery.value.trim();
                    searchSchedule(type, query);
                }
            }
            
            searchButton.addEventListener('click', performSearch);
            
            // Enter 키로 검색 실행
            searchQuery.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
            
            // 검색 타입 변경 시 UI 토글
            searchType.addEventListener('change', toggleSearchUI);
            
            // 초기 UI 설정
            toggleSearchUI();
        }

        // 교수님 시간표 표시
function showProfessorTimetable(professorName) {
            if (!timetableData || timetableData.length === 0) {
                const resultsContainer = document.getElementById('schedule-results');
                resultsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">⏳ 데이터를 불러오는 중입니다</div>
                        <div class="card-content">잠시 후 다시 시도해주세요.</div>
                    </div>
                `;
                return;
            }

            // 해당 교수님의 강의 필터링 (교수님 이름이 정확히 일치하는 경우만)
            const professorClasses = timetableData.filter(item => {
                const p = item.professor && item.professor.trim();
                const ps = Array.isArray(item.professors) ? item.professors.map(x => (x || '').trim()).filter(Boolean) : [];
                return (p && p === professorName) || ps.includes(professorName);
            });

            if (professorClasses.length === 0) {
                const resultsContainer = document.getElementById('schedule-results');
                resultsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">📋 강의 정보가 없습니다</div>
                        <div class="card-content">${professorName} 교수님의 강의 정보를 찾을 수 없습니다.</div>
                    </div>
                `;
                return;
            }

            // 온라인/오프라인 분리
            const isOnline = (it) => it.day === 'ONLINE' || (String(it.type||'').toLowerCase() === 'online') || (!it.day && !it.time);
            const offlineClasses = professorClasses.filter(it => !isOnline(it) && ['MON','TUE','WED','THU','FRI','SAT'].includes(it.day));
            const onlineClasses = professorClasses.filter(isOnline);

            // 시간표 그리드 생성 (30분 단위 비율 기반)
            const baseStart = '09:00';
            const baseEnd = '18:00';
            const slotMinutes = 30;
            const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
            const dayNames = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금' };

            // 유틸: HH:MM -> 총 분, 분 -> HH:MM
            const toMinutes = (hhmm) => {
                const [h, m] = hhmm.split(':').map(Number);
                return h * 60 + m;
            };
            const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
            const baseStartMin = toMinutes(baseStart);
            const baseEndMin = toMinutes(baseEnd);

            const rowIndexFor = (hhmm) => {
                const mins = clamp(toMinutes(hhmm), baseStartMin, baseEndMin);
                const steps = Math.floor((mins - baseStartMin) / slotMinutes);
                return 2 + steps; // 1행은 헤더, 실제 타임라인은 2행부터 시작
            };
            const spanRowsFor = (start, end) => {
                const s = clamp(toMinutes(start), baseStartMin, baseEndMin);
                const e = clamp(toMinutes(end), baseStartMin, baseEndMin);
                const duration = Math.max(0, e - s);
                return Math.max(1, Math.ceil(duration / slotMinutes));
            };

            // 통계 계산
            const totalSubjects = new Set(professorClasses.map(c => c.subject)).size;
            const totalClasses = professorClasses.length;
            const buildings = new Set(offlineClasses.map(c => c.building_name)).size;

            let timetableHTML = `
                <div class="timetable-container">
                    <div class="timetable-header">
                        <h3>👨‍🏫 ${professorName} 교수님 시간표</h3>
                    </div>
                    
                    <div class="timetable-stats">
                        <div class="timetable-stat">
                            <div class="timetable-stat-number">${totalSubjects}</div>
                            <div class="timetable-stat-label">담당 과목</div>
                        </div>
                        <div class="timetable-stat">
                            <div class="timetable-stat-number">${totalClasses}</div>
                            <div class="timetable-stat-label">총 강의</div>
                        </div>
                        <div class="timetable-stat">
                            <div class="timetable-stat-number">${buildings}</div>
                            <div class="timetable-stat-label">사용 건물</div>
                        </div>
                    </div>

                    <div class="timetable-scale-wrap">
                    <div class="timetable-grid-30">
                        <div class="timetable-header-cell" style="grid-column: 1; grid-row: 1;">시간</div>
                        <div class="timetable-header-cell" style="grid-column: 2; grid-row: 1;">${dayNames['MON']}</div>
                        <div class="timetable-header-cell" style="grid-column: 3; grid-row: 1;">${dayNames['TUE']}</div>
                        <div class="timetable-header-cell" style="grid-column: 4; grid-row: 1;">${dayNames['WED']}</div>
                        <div class="timetable-header-cell" style="grid-column: 5; grid-row: 1;">${dayNames['THU']}</div>
                        <div class="timetable-header-cell" style="grid-column: 6; grid-row: 1;">${dayNames['FRI']}</div>
            `;

            // 시간 라벨 (정각만 표시) - 18:00은 그리드 경계를 넘지 않도록 제외
            for (let mins = toMinutes(baseStart); mins < toMinutes(baseEnd); mins += 60) {
                const h = String(Math.floor(mins / 60)).padStart(2, '0');
                const m = String(mins % 60).padStart(2, '0');
                const time = `${h}:${m}`;
                const row = rowIndexFor(time);
                timetableHTML += `<div class="time-label" style="grid-column: 1; grid-row: ${row};">${time}</div>`;
            }

            // 강의 블록 배치
            const dayToCol = { 'MON': 2, 'TUE': 3, 'WED': 4, 'THU': 5, 'FRI': 6 };
            
            // 모바일용: 요일별로 그룹화하고 시간순 정렬
            const classByDay = {};
            days.forEach(d => { classByDay[d] = []; });
            offlineClasses.forEach(cls => {
                if (days.includes(cls.day)) {
                    classByDay[cls.day].push(cls);
                }
            });
            Object.keys(classByDay).forEach(day => {
                classByDay[day].sort((a, b) => a.start.localeCompare(b.start));
            });

            // 블록 렌더링 (모바일: data-day/data-time 속성 추가, 데스크톱: grid 위치)
            days.forEach(day => {
                classByDay[day].forEach(cls => {
                    const col = dayToCol[cls.day];
                    const rowStart = rowIndexFor(cls.start.substring(0,5));
                    const rowSpan = spanRowsFor(cls.start.substring(0,5), cls.end.substring(0,5));
                    const room = getRoomDisplay(cls);
                    const title = `${cls.subject} - ${room}`;
                    const dayLabel = dayNames[day];
                    const timeRange = `${cls.start.substring(0,5)}~${cls.end.substring(0,5)}`;
                    
                    timetableHTML += `
                        <div class="class-block" 
                             title="${title}"
                             data-day="${dayLabel}"
                             data-time="${timeRange}"
                             style="grid-column: ${col}; grid-row: ${rowStart} / span ${rowSpan};">
                            <div class="class-subject">${cls.subject}</div>
                            <div class="class-room">${room} · ${timeRange}</div>
                        </div>
                    `;
                });
            });

            timetableHTML += `</div></div>`;

            timetableHTML += `</div>`;

            // 메인 결과 컨테이너에 시간표 렌더

            const resultsContainer = document.getElementById('schedule-results');
            resultsContainer.innerHTML = timetableHTML;

            // 온라인 강의 목록 렌더링 (있을 경우 별도 영역)
            const onlineContainer = document.getElementById('online-courses-list');
            if (onlineContainer) {
                if (onlineClasses.length > 0) {
                    const onlineCards = `
                        <div class="card">
                            <div class="card-title">🌐 온라인 강의 (${onlineClasses.length}개)</div>
                            <div class="card-content">
                                <ul style="padding-left:18px;">
                                    ${onlineClasses.map(item => `
                                        <li><strong>${item.subject}</strong>${item.professor ? ` – ${getProfessorDisplay(item)}` : ''}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>`;
                    onlineContainer.innerHTML = onlineCards;
                } else {
                    onlineContainer.innerHTML = '';
                }
            }

            // 방금 삽입한 시간표 컨테이너를 정확히 찾아 즉시 스케일 적용
            const newTimetableContainer = resultsContainer.querySelector('.timetable-container');
            if (newTimetableContainer) {
                // 즉시 1회 적용
                applyTimetableAutoScale(newTimetableContainer);
                // 다음 프레임에서 한 번 더 적용 (레이아웃 계산 안정화)
                requestAnimationFrame(() => applyTimetableAutoScale(newTimetableContainer));
                // 매우 짧은 지연 후 재적용 (일부 브라우저 안전망)
                setTimeout(() => applyTimetableAutoScale(newTimetableContainer), 0);
            }
        }

function searchSchedule(searchType, query) {
            // 데이터가 아직 로드되지 않았으면 경고
            if (!timetableData || timetableData.length === 0) {
                const resultsContainer = document.getElementById('schedule-results');
                resultsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">⏳ 데이터를 불러오는 중입니다</div>
                        <div class="card-content">잠시 후 다시 시도해주세요.</div>
                    </div>
                `;
                return;
            }

            // 검색어가 비어있으면 경고
            if (!query.trim()) {
                const resultsContainer = document.getElementById('schedule-results');
                resultsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">⚠️ 검색어를 입력해주세요</div>
                        <div class="card-content">검색어를 입력한 후 검색 버튼을 눌러주세요.</div>
                    </div>
                `;
                return;
            }

            // 교수 시간표가 아닌 일반 검색에서는 온라인 영역 초기화
            const onlineContainer = document.getElementById('online-courses-list');
            if (onlineContainer) onlineContainer.innerHTML = '';

            let results = [];
            const searchQuery = query.toLowerCase().trim();
            const dayFilter = document.getElementById('schedule-day-filter').value;

            switch(searchType) {
                case 'department':
                    results = timetableData.filter(item => 
                        item.department.toLowerCase().includes(searchQuery) || 
                        item.college.toLowerCase().includes(searchQuery)
                    );
                    break;
                case 'professor':
                    results = timetableData.filter(item => {
                        const single = item.professor ? item.professor.toLowerCase() : '';
                        const anyMulti = Array.isArray(item.professors) && item.professors.some(n => (n || '').toLowerCase().includes(searchQuery));
                        return (single.includes(searchQuery)) || anyMulti;
                    });
                    break;
                case 'classroom':
                    results = timetableData.filter(item => 
                        item.classroom.toLowerCase().includes(searchQuery) || 
                        item.building_name.toLowerCase().includes(searchQuery)
                    );
                    break;
                case 'subject':
                    results = timetableData.filter(item => 
                        item.subject.toLowerCase().includes(searchQuery)
                    );
                    break;
                case 'missing-professor':
                    results = timetableData.filter(item => {
                        const hasSingle = item.professor && item.professor.trim() !== '';
                        const hasMulti = Array.isArray(item.professors) && item.professors.length > 0;
                        return !(hasSingle || hasMulti);
                    });
                    break;
            }

            // 요일 필터 적용
            if (dayFilter) {
                results = results.filter(item => item.day === dayFilter);
            }

            // 결과를 시간순으로 정렬 (온라인은 마지막)
            results.sort((a, b) => {
                const dayOrder = { 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6, 'ONLINE': 99 };
                if (dayOrder[a.day] !== dayOrder[b.day]) {
                    return dayOrder[a.day] - dayOrder[b.day];
                }
                const sa = a.start || '';
                const sb = b.start || '';
                return sa.localeCompare(sb);
            });

            // 결과 렌더링
            const resultsContainer = document.getElementById('schedule-results');
            const dayNames = {
                'MON': '월요일', 'TUE': '화요일', 'WED': '수요일',
                'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일', 'ONLINE': '온라인'
            };

            if (results.length > 0) {
                // 결과가 너무 많으면 제한
                const maxResults = 50;
                const displayResults = results.slice(0, maxResults);
                const hasMore = results.length > maxResults;

                const scheduleCards = displayResults.map(item => {
                    const isOnline = item.day === 'ONLINE' || (String(item.type||'').toLowerCase() === 'online');
                    if (isOnline) {
                        return `
                        <div class="card">
                            <div class="card-title">📚 ${item.subject} <span class="badge" style="margin-left:6px;">온라인</span></div>
                            <div class="card-content">
                                ${item.professor ? `👨‍🏫 ${getProfessorDisplay(item)}<br>` : ''}
                                📋 ${item.code}
                            </div>
                        </div>`;
                    }
                    return `
                    <div class="card">
                        <div class="card-title">📚 ${item.subject}</div>
                        <div class="card-content">
                            👨‍🏫 ${getProfessorDisplay(item)}<br>
                            🏛️ ${item.classroom} (${item.building_name})<br>
                            📅 ${dayNames[item.day]} ${item.start}-${item.end}<br>
                            🏫 ${item.department}<br>
                            📋 ${item.code}
                        </div>
                    </div>`;
                }).join('');

                let resultHtml = `
                    <div class="search-info">
                        <p>🔍 검색 결과: <strong>${results.length}개</strong> 발견</p>
                        ${hasMore ? `<p>⚠️ 처음 ${maxResults}개만 표시됩니다. 더 구체적인 검색어를 사용해보세요.</p>` : ''}
                    </div>
                ` + scheduleCards;

                resultsContainer.innerHTML = resultHtml;
            } else {
                resultsContainer.innerHTML = `
                    <div class="card">
                        <div class="card-title">🔍 검색 결과가 없습니다</div>
                        <div class="card-content">
                            다른 검색어로 시도해보세요.
                        </div>
                    </div>
                `;
            }
        }

        // ===== 3.5. 기능 4: 캠퍼스 혼잡도 (Heatmap) =====
function renderHeatmapChart() {
            // 데이터가 아직 로드되지 않았으면 대기
            if (!timetableData || timetableData.length === 0) {
                setTimeout(renderHeatmapChart, 1000); // 1초 후 다시 시도
                return;
            }

            const ctx = document.getElementById('heatmap-chart').getContext('2d');

            // 건물별 강의 수 집계
            const buildingData = {};
            timetableData.forEach(item => {
                if (!buildingData[item.building_name]) {
                    buildingData[item.building_name] = 0;
                }
                buildingData[item.building_name]++;
            });

            const buildings = Object.keys(buildingData);
            const counts = Object.values(buildingData);

            // 모바일 감지 (768px 미만)
            const isMobile = window.innerWidth < 768;
            const chartType = 'bar'; // Chart.js v3+에서는 'bar' 사용
            const indexAxis = isMobile ? 'y' : 'x'; // 모바일: 가로, 데스크톱: 세로

            new Chart(ctx, {
                type: chartType,
                data: {
                    labels: buildings,
                    datasets: [{
                        label: '강의 수',
                        data: counts,
                        backgroundColor: [
                            'rgba(102, 126, 234, 0.8)',
                            'rgba(118, 75, 162, 0.8)',
                            'rgba(255, 107, 107, 0.8)',
                            'rgba(52, 152, 219, 0.8)',
                            'rgba(46, 204, 113, 0.8)',
                            'rgba(241, 196, 15, 0.8)',
                            'rgba(230, 126, 34, 0.8)',
                            'rgba(149, 165, 166, 0.8)',
                            'rgba(155, 89, 182, 0.8)',
                            'rgba(26, 188, 156, 0.8)'
                        ],
                        borderColor: [
                            'rgba(102, 126, 234, 1)',
                            'rgba(118, 75, 162, 1)',
                            'rgba(255, 107, 107, 1)',
                            'rgba(52, 152, 219, 1)',
                            'rgba(46, 204, 113, 1)',
                            'rgba(241, 196, 15, 1)',
                            'rgba(230, 126, 34, 1)',
                            'rgba(149, 165, 166, 1)',
                            'rgba(155, 89, 182, 1)',
                            'rgba(26, 188, 156, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    indexAxis: indexAxis, // 모바일: 'y' (가로), 데스크톱: 'x' (세로)
                    responsive: true,
                    maintainAspectRatio: false, // 컨테이너에 맞게 크기 조정
                    plugins: {
                        title: {
                            display: true,
                            text: '건물별 강의 개설 현황',
                            font: {
                                size: isMobile ? 14 : 16,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                font: {
                                    size: isMobile ? 10 : 12
                                }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                font: {
                                    size: isMobile ? 10 : 12
                                }
                            }
                        }
                    }
                }
            });
        }

        // ===== 3.6. 기능 5: 점심 룰렛 (Roulette) =====
function initializeRouletteSection() {
            const rouletteButton = document.getElementById('roulette-button');
            
            rouletteButton.addEventListener('click', function() {
                spinRoulette();
            });
        }

function spinRoulette() {
            const button = document.getElementById('roulette-button');
            const resultContainer = document.getElementById('roulette-result');

            // 버튼 비활성화 및 로딩 표시
            button.disabled = true;
            button.textContent = '🎰 돌리는 중...';

            // 애니메이션 효과를 위한 딜레이
            setTimeout(() => {
                const randomIndex = Math.floor(Math.random() * restaurantsData.length);
                const selectedRestaurant = restaurantsData[randomIndex];

                // 결과 표시
                resultContainer.innerHTML = `
                    <div class="roulette-result">
                        <h3>🎉 오늘의 추천 맛집!</h3>
                        <h2>${selectedRestaurant.name}</h2>
                        <p>분류: ${selectedRestaurant.category}</p>
                        <p>추천 메뉴: ${selectedRestaurant.menu}</p>
                    </div>
                `;

                // 버튼 복원
                button.disabled = false;
                button.textContent = '🎰 다시 돌리기';
            }, 1500);
        }
// 시간표 자동 스케일링: 모바일(<768px)에서 컨테이너 너비에 맞춰 그리드를 축소
function applyTimetableAutoScale(container) {
            if (!container) return;
            const wrap = container.querySelector('.timetable-scale-wrap');
            const grid = container.querySelector('.timetable-grid-30');
            if (!wrap || !grid) return;

            // 초기화
            grid.style.transform = 'none';

            const isMobile = window.innerWidth < 768;
            // 기본적으로 데스크톱은 스케일 1 유지
            let scale = 1;
            if (isMobile) {
                const cw = container.clientWidth; // 패딩을 포함한 가용 너비
                const gw = grid.scrollWidth;     // 그리드 원본 너비
                if (gw > 0 && cw > 0 && gw > cw) {
                    scale = cw / gw; // 컨테이너에 맞추도록 축소
                }
                // 모바일에서는 가로 스크롤 제거
                container.style.overflowX = 'hidden';
            } else {
                // 데스크톱에서는 기존 동작 유지 (필요시 가로 스크롤 허용)
                container.style.overflowX = 'auto';
            }

            grid.style.transformOrigin = 'top left';
            grid.style.transform = `scale(${scale})`;

            // 스케일된 높이를 래퍼에 반영해 레이아웃 붕괴 방지
            const gridHeight = grid.offsetHeight; // 비스케일 높이
            wrap.style.height = (gridHeight * scale) + 'px';
}

function applyAllTimetablesScale() {
    document.querySelectorAll('.timetable-container').forEach(container => {
        applyTimetableAutoScale(container);
    });
}

// 리사이즈/방향 전환 시 재계산
window.addEventListener('resize', applyAllTimetablesScale);
window.addEventListener('orientationchange', applyAllTimetablesScale);
