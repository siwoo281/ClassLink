// ===== 전역 데이터 정의 =====
let timetableData = [];
let professorsList = [];
let classroomsList = [];

// ===== 상수 정의 =====
const DAY_NAMES_ENG = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NAMES_KOR = { 
    'SUN': '일', 'MON': '월', 'TUE': '화', 
    'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토' 
};
const DAY_NAME_MAP_SHORT = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토' };

// 타이밍 상수
const ROULETTE_DELAY_MS = 1500;
const REALTIME_UPDATE_INTERVAL_MS = 60000;  // 1분
const RESIZE_DEBOUNCE_MS = 150;

// 임계값
const LARGE_CLASS_THRESHOLD = 100;  // 대형 강의 기준 (명)

// ===== 데이터 로드 =====
async function loadTimetableData() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.classList.add('loading-visible');
    }
    try {
        
        // 모든 데이터를 병렬로 비동기 로드
        const v = new Date().getTime();
        const [timetableRes, professorsRes, classroomsRes] = await Promise.all([
            fetch(`timetable.json?v=${v}`),
            fetch(`professors.json?v=${v}`),
            fetch(`classrooms.json?v=${v}`)
        ]);

        if (!timetableRes.ok || !professorsRes.ok || !classroomsRes.ok) {
            throw new Error(`HTTP error! Status: ${timetableRes.status}, ${professorsRes.status}, ${classroomsRes.status}`);
        }

        timetableData = await timetableRes.json();
        professorsList = await professorsRes.json();
        classroomsList = await classroomsRes.json();
        
        processLoadedData();

    } catch (error) {
        console.error('데이터 로드 실패:', error);
        handleDataLoadError();
    } finally {
        if (loadingIndicator) {
            loadingIndicator.classList.remove('loading-visible');
        }
    }
}
function processLoadedData() {
    if (!timetableData || timetableData.length === 0) {
        console.log('처리할 데이터가 없습니다.');
        return;
    }

    // 드롭다운 채우기
    populateDropdown('professor-select', professorsList, { placeholder: '교수님을 선택하세요' });
    populateDropdown('classroom-select', classroomsList, { placeholder: '전체 강의실', isClassroom: true });
    populateDropdown('schedule-classroom-select', classroomsList, { placeholder: '강의실을 선택하세요', isClassroom: true });

    console.log(`데이터 처리 완료: ${timetableData.length}개 강의, ${professorsList.length}명 교수, ${classroomsList.length}개 강의실`);
    
    const activeNavLink = document.querySelector('.nav-link.active');
    if (activeNavLink) {
        const currentSection = activeNavLink.getAttribute('data-target');
        initializeSection(currentSection);
    } else {
        const homeLink = document.querySelector('[data-target="home"]');
        if (homeLink) {
            homeLink.classList.add('active');
            document.getElementById('home').classList.remove('section-hidden');
        }
        initializeSection('home');
    }
}

function handleDataLoadError() {
    timetableData = [];
    const statsContainer = document.getElementById('current-stats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">⚠️</div>
                <div class="stat-label">데이터 로드 실패</div>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadTimetableData();

    const navLinks = document.querySelectorAll('[data-target]');
    const sections = document.querySelectorAll('section');
    const nav = document.querySelector('nav');

    function setActiveSection(targetId) {
        if (!targetId) targetId = 'home';
        
        sections.forEach(section => section.classList.add('section-hidden'));
        navLinks.forEach(navLink => navLink.classList.remove('active'));

        const targetSection = document.getElementById(targetId);
        const targetLink = document.querySelector(`[data-target="${targetId}"]`);

        if (targetSection) targetSection.classList.remove('section-hidden');
        if (targetLink) targetLink.classList.add('active');
        
        window.location.hash = targetId;
        initializeSection(targetId);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            if (nav) {
                nav.classList.remove('nav-open');
                if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
            }
            setActiveSection(targetId);
        });
    });

    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            const isOpen = nav.classList.toggle('nav-open');
            menuToggle.setAttribute('aria-expanded', isOpen);
        });
    }

    // 네비게이션 브랜드 클릭 시 홈으로 이동
    const navBrand = document.querySelector('.nav-brand');
    if (navBrand) {
        navBrand.addEventListener('click', function() {
            if (nav) {
                nav.classList.remove('nav-open');
                if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
            }
            setActiveSection('home');
        });
    }


    // 해시 기반 진입 및 해시 변경 시 섹션 자동 활성화
    function setActiveSectionFromHash() {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            setActiveSection(hash);
        } else {
            setActiveSection('home');
        }
    }
    setActiveSectionFromHash();
    window.addEventListener('hashchange', setActiveSectionFromHash);

    // --- 이벤트 리스너 단일 등록 ---
    initializeRealTimeSection();
    initializeSearchSection();
    initializeScheduleSection();
    initializeRouletteSection();
});

function initializeScheduleSection() {
    const scheduleType = document.getElementById('schedule-type');
    const searchInput = document.getElementById('schedule-query');
    const professorSelect = document.getElementById('professor-select');
    const classroomSelect = document.getElementById('schedule-classroom-select');
    const dayFilter = document.getElementById('schedule-day-filter');
    const searchButton = document.getElementById('schedule-search-button');
    const resultsContainer = document.getElementById('schedule-results');
    const onlineCoursesContainer = document.getElementById('online-courses-list');
    
    const searchInputGroup = document.getElementById('search-input-group');
    const professorSelectGroup = document.getElementById('professor-select-group');
    const classroomSelectGroup = document.getElementById('schedule-classroom-select-group');

    function performScheduleSearch() {
        const type = scheduleType.value;
        const day = dayFilter.value;
        let query = '';

        switch (type) {
            case 'professor':
                query = professorSelect.value;
                break;
            case 'classroom':
                query = classroomSelect.value;
                break;
            default:
                query = searchInput.value.trim().toLowerCase();
                break;
        }

        if (!query) {
            resultsContainer.innerHTML = `
                <div class="search-info">
                    <p><strong>💡 검색 안내</strong></p>
                    <p style="margin-bottom: 15px; color: #555;">원하는 검색 유형을 선택하고 정보를 확인하세요!</p>
                    
                    <p><strong>📚 과목명 검색</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        과목 이름을 입력하면 <span style="color: #667eea;">강의 시간, 교수님, 강의실, 학점</span> 등 모든 정보를 확인할 수 있습니다.<br>
                        예: "프로그래밍", "영어", "수학"
                    </p>
                    
                    <p><strong>👨‍🏫 교수명 검색</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        교수님을 선택하면 <span style="color: #667eea;">해당 교수님의 전체 강의 시간표</span>를 한눈에 볼 수 있습니다.<br>
                        수업 시간, 강의실, 요일별 스케줄이 표시됩니다.
                    </p>
                    
                    <p><strong>🏛️ 강의실 검색</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        강의실을 선택하면 <span style="color: #667eea;">그 강의실에서 진행되는 모든 수업</span>을 확인할 수 있습니다.<br>
                        언제, 어떤 과목이 진행되는지 알 수 있습니다.
                    </p>
                    
                    <p style="margin-top: 15px; padding: 10px; background: #f0f4ff; border-radius: 8px; color: #667eea;">
                        <strong>💡 팁:</strong> 요일 필터를 함께 사용하면 특정 요일의 강의만 볼 수 있어요!
                    </p>
                </div>
            `;
            onlineCoursesContainer.innerHTML = '';
            return;
        }

        let filteredResults = timetableData.filter(item => {
            if (day && item.day !== day) {
                return false;
            }

            switch (type) {
                case 'subject':
                    return (item.subject || '').toLowerCase().includes(query);
                case 'professor':
                    // 여러 교수 처리 (쉼표로 구분)
                    const professors = (item.professor || '').split(',').map(p => p.trim());
                    return professors.includes(query);
                case 'classroom':
                    const [building, room] = query.split('-');
                    return item.building_name === building && item.classroom === room;
                default:
                    return false;
            }
        });

        renderScheduleResults(filteredResults, type);
    }

    function renderScheduleResults(results, searchType) {
        const onlineCourses = results.filter(item => item.day === 'ONLINE');
        const offlineCourses = results.filter(item => item.day !== 'ONLINE');


        if (offlineCourses.length > 0) {
            const dayOrder = { 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6 };
            offlineCourses.sort((a, b) => {
                const dayCompare = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
                if (dayCompare !== 0) return dayCompare;
                return (a.start || '').localeCompare(b.start || '');
            });

            let html = `<div class="results-summary">총 ${offlineCourses.length}개의 오프라인 강의가 검색되었습니다.</div>`;

            // 시각적 시간표 먼저 추가
            html += `<div id="schedule-visual-timetable"></div>`;

            // 교수명 검색 시 통계 정보 추가
            if (searchType === 'professor' && offlineCourses.length > 0) {
                const professorName = getProfessorDisplay(offlineCourses[0]);
                const amClasses = offlineCourses.filter(c => c.start < '12:00').length;
                const pmClasses = offlineCourses.filter(c => c.start >= '12:00').length;
                const dayCounts = offlineCourses.reduce((acc, c) => {
                    acc[c.day] = (acc[c.day] || 0) + 1; return acc;
                }, {});
                const classroomCounts = offlineCourses.reduce((acc, c) => {
                    const room = getRoomDisplay(c);
                    if (room !== '온라인' && room !== '-') {
                        acc[room] = (acc[room] || 0) + 1;
                    }
                    return acc;
                }, {});
                // 주요 활동 건물 계산
                const buildingCounts = offlineCourses.reduce((acc, c) => {
                    if (c.building_name) {
                        acc[c.building_name] = (acc[c.building_name] || 0) + 1;
                    }
                    return acc;
                }, {});
                let mainBuilding = '없음', maxBuildingCount = 0;
                Object.entries(buildingCounts).forEach(([building, count]) => {
                    if (count > maxBuildingCount) {
                        maxBuildingCount = count;
                        mainBuilding = building;
                    }
                });

                html += `
                    <div class="timetable-stats">
                        <div class="timetable-stat"><div class="stat-icon">📚</div><div class="timetable-stat-number">${offlineCourses.length}</div><div class="timetable-stat-label">총 강의 수</div></div>
                        <div class="timetable-stat"><div class="stat-icon">⏳</div><div class="timetable-stat-number">${amClasses} / ${pmClasses}</div><div class="timetable-stat-label">오전 / 오후</div></div>
                    </div>
                `;

                // 교수님 활동 패턴 카드 생성
                const busiestDayRaw = Object.keys(dayCounts).length > 0 ? Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b) : null;
                let residentTimeInfo = '';
                if (busiestDayRaw) {
                const busiestDayClasses = offlineCourses.filter(c => c.day === busiestDayRaw);
                const amCount = busiestDayClasses.filter(c => c.start < '12:00').length;
                const pmCount = busiestDayClasses.length - amCount;
                let timeFocus = '';
                if (amCount > pmCount) timeFocus = '오전에';
                else if (pmCount > amCount) timeFocus = '오후에';
                else timeFocus = '오전/오후에 걸쳐';
                
                residentTimeInfo = `, 특히 <b>${DAY_NAME_MAP_SHORT[busiestDayRaw]}요일 ${timeFocus}</b> 수업이 집중되어 있습니다.`;
                }

                if (mainBuilding !== '없음') {
                    html += `
                        <div class="card analysis-card">
                            <div class="card-title">👨‍🏫 교수님 활동 패턴</div>
                            <div class="card-content">
                                <p style="text-align: center; line-height: 1.6;">
                                    주로 <b>${mainBuilding}</b>에서 활동하시며${residentTimeInfo}
                                </p>
                            </div>
                        </div>
                    `;
                }
            }

            // 카드형 강의 목록
            html += `<div class="card-grid schedule-grid">
                ${offlineCourses.map(item => {
                    const professor = item.professor;
                    const professorDisplay = getProfessorDisplay(item);
                    const professorHtml = (professor && professor !== '미지정' && !professor.includes(',')) 
                        ? `<a href=\"#\" class=\"search-link\" data-type=\"professor\" data-value=\"${professor}\">${professorDisplay}</a>`
                        : professorDisplay;

                    const roomDisplay = getRoomDisplay(item);
                    const roomValue = (item.building_name && item.classroom) ? `${item.building_name}-${item.classroom}` : '';
                    const roomHtml = (roomValue && roomDisplay !== '온라인')
                        ? `<a href=\"#\" class=\"search-link\" data-type=\"classroom\" data-value=\"${roomValue}\">${roomDisplay}</a>`
                        : roomDisplay;

                    return `
                    <div class=\"card schedule-card\">
                        <div class=\"card-title\">${item.subject}</div>
                        <div class=\"card-content\">
                            <div class=\"schedule-info\"><b>교수:</b> ${professorHtml}</div>
                            <div class=\"schedule-info\"><b>시간:</b> ${DAY_NAME_MAP_SHORT[item.day] || item.day} ${item.start}~${item.end}</div>
                            <div class=\"schedule-info\"><b>강의실:</b> ${roomHtml}</div>
                            <div class=\"schedule-info\"><b>이수:</b> ${item.department || '-'} / <b>학점:</b> ${item.credits || '-'}</div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>`;

            resultsContainer.innerHTML = html;
            // 시간표 렌더링
            const timetableDiv = document.getElementById('schedule-visual-timetable');
            if (timetableDiv) {
                const title = searchType === 'professor' ? `${getProfessorDisplay(offlineCourses[0])} 교수님 시간표` : '검색 결과 시간표';
                timetableDiv.innerHTML = generateVisualTimetable(offlineCourses, title);
                applyAllTimetablesScale();
            }
        } else {
            resultsContainer.innerHTML = getNoResultsMessage('오프라인 강의 결과가 없습니다.');
        }

        if (onlineCourses.length > 0) {
            onlineCoursesContainer.innerHTML = `
                <h2 class="section-subtitle">온라인 강의 (${onlineCourses.length}개)</h2>
                <div class="card-grid schedule-grid">
                    ${onlineCourses.map(item => `
                        <div class="card schedule-card online">
                            <div class="card-title">${item.subject}</div>
                            <div class="card-content">
                                <div class="schedule-info"><b>교수:</b> ${getProfessorDisplay(item)}</div>
                                <div class="schedule-info"><b>이수:</b> ${item.department || '-'} / <b>학점:</b> ${item.credits || '-'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            onlineCoursesContainer.innerHTML = '';
        }
    }

    scheduleType.addEventListener('change', function() {
        searchInputGroup.style.display = 'none';
        professorSelectGroup.style.display = 'none';
        classroomSelectGroup.style.display = 'none';
        searchInput.value = '';

        switch (this.value) {
            case 'professor':
                professorSelectGroup.style.display = 'block';
                break;
            case 'classroom':
                classroomSelectGroup.style.display = 'block';
                break;
            default:
                searchInputGroup.style.display = 'block';
                break;
        }
        resultsContainer.innerHTML = '';
        onlineCoursesContainer.innerHTML = '';
    });

    searchButton.addEventListener('click', performScheduleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performScheduleSearch();
    });
    dayFilter.addEventListener('change', performScheduleSearch);

    resultsContainer.addEventListener('click', (e) => {
        const link = e.target.closest('.search-link');
        if (!link) return;

        e.preventDefault();

        const type = link.dataset.type;
        const value = link.dataset.value;

        if (!type || !value) return;

        scheduleType.value = type;
        scheduleType.dispatchEvent(new Event('change'));

        if (type === 'professor') {
            professorSelect.value = value;
        } else if (type === 'classroom') {
            classroomSelect.value = value;
        }
        
        document.getElementById('schedule').scrollIntoView({ behavior: 'smooth' });

        performScheduleSearch();
    });
}

function initializeRouletteSection() {
    const rouletteButton = document.getElementById('roulette-button');
    const rouletteResult = document.getElementById('roulette-result');
    
    const menuOptions = [
        "뼈해장국", "돈까스", "제육볶음", "서브웨이", "짜장면", "햄버거",
        "순대국밥", "김치찌개", "초밥", "파스타", "쌀국수", "마라탕", "부대찌개"
    ];

    rouletteButton.addEventListener('click', () => {
        rouletteResult.innerHTML = `
            <div class="roulette-thinking">
                <div class="spinner"></div>
                <p>메뉴를 고르는 중...</p>
            </div>
        `;
        rouletteButton.disabled = true;

        setTimeout(() => {
            const randomIndex = Math.floor(Math.random() * menuOptions.length);
            const selectedMenu = menuOptions[randomIndex];
            
            rouletteResult.innerHTML = `
                <div class="roulette-final-result">
                    <p>오늘의 추천 메뉴는?</p>
                    <h2 class="selected-menu">${selectedMenu}!</h2>
                </div>
            `;
            rouletteButton.disabled = false;
        }, ROULETTE_DELAY_MS); // 1.5초 후 결과 표시
    });
}

function initializeRealTimeSection() {
    const roomsContainer = document.getElementById('current-rooms');
    if (!roomsContainer) return;

    roomsContainer.addEventListener('click', function(e) {
        const buildingCard = e.target.closest('.building-card');
        if (buildingCard) {
            const building = buildingCard.dataset.building;
            const detailsDiv = document.getElementById(`details-${building}`);
            const arrow = buildingCard.querySelector('.arrow');
            const isHidden = detailsDiv.style.display === 'none';

            if (isHidden) {
                // --- 온디맨드 렌더링 ---
                const now = new Date();
                const currentDay = DAY_NAMES_ENG[now.getDay()];
                const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                const currentTimeInMinutes = timeStringToMinutes(currentTime);

                const occupiedRooms = timetableData.filter(item => {
                    if (item.building_name !== building || item.day !== currentDay || !item.start || !item.end) {
                        return false;
                    }
                    const startMinutes = timeStringToMinutes(item.start);
                    const endMinutes = timeStringToMinutes(item.end);
                    return currentTimeInMinutes >= startMinutes && currentTimeInMinutes < endMinutes;
                });

                const allBuildingRooms = classroomsList.filter(r => r.building === building).map(r => r.room);
                const occupiedBuildingRooms = new Set(occupiedRooms.map(r => r.classroom));
                const emptyRooms = allBuildingRooms.filter(room => !occupiedBuildingRooms.has(room));

                let detailsHtml = '';
                if (occupiedRooms.length > 0) {
                    detailsHtml += `
                        <h4 class="details-subtitle">사용 중인 강의실</h4>
                        <div class="card-grid occupied-grid">
                            ${occupiedRooms.map(item => `
                                <div class="card occupied-room-card">
                                    <div class="card-title">${item.classroom}</div>
                                    <div class="card-content">
                                        <div class="subject"><b>${item.subject}</b></div>
                                        <div class="professor">${getProfessorDisplay(item)}</div>
                                        <div class="time">${item.start} ~ ${item.end}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
                if (emptyRooms.length > 0) {
                    detailsHtml += `
                        <h4 class="details-subtitle">빈 강의실</h4>
                        <div class="card-grid empty-grid">
                            ${emptyRooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(room => `
                                <div class="card empty-room-card" data-building="${building}" data-room="${room}">
                                    <div class="card-title">${room}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
                detailsDiv.innerHTML = detailsHtml || '<div class="card"><div class="card-content">정보가 없습니다.</div></div>';
            }

            detailsDiv.style.display = isHidden ? 'block' : 'none';
            arrow.textContent = isHidden ? '▲' : '▼';
            buildingCard.classList.toggle('open', isHidden);
            return;
        }

        const emptyRoomCard = e.target.closest('.empty-room-card');
        if (emptyRoomCard) {
            const building = emptyRoomCard.dataset.building;
            const room = emptyRoomCard.dataset.room;
            showEmptyRoomScheduleModal(building, room);
        }
    });
}

function showEmptyRoomScheduleModal(building, room) {
    const now = new Date();
    const currentDay = DAY_NAMES_ENG[now.getDay()];
    const currentTimeInMinutes = timeStringToMinutes(now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'));

    const upcomingClasses = timetableData
        .filter(item =>
            item.building_name === building &&
            item.classroom === room &&
            item.day === currentDay &&
            timeStringToMinutes(item.start) >= currentTimeInMinutes
        )
        .sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));

    let modal = document.getElementById('room-detail-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'room-detail-modal';
    modal.className = 'modal-overlay';
    
    let contentHtml = '';
    if (upcomingClasses.length > 0) {
        contentHtml = `
            <h4 class="details-subtitle" style="margin-top:0;">오늘 남은 강의</h4>
            <div class="card-grid" style="grid-template-columns: 1fr; gap: 10px;">
            ${upcomingClasses.map(item => `
                <div class="card">
                    <div class="card-content">
                        <div><b>${item.subject}</b></div>
                        <div class="class-prof" style="color: #555;">${getProfessorDisplay(item)}</div>
                        <div class="time">${item.start} ~ ${item.end}</div>
                    </div>
                </div>
            `).join('')}
            </div>
        `;
    } else {
        contentHtml = '<div class="card"><div class="card-content" style="color:#38a169; font-weight:600;">오늘 남은 강의가 없습니다.</div></div>';
    }

    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" id="close-room-modal" aria-label="모달 닫기">✖️</button>
            <h2 class="modal-title">${building} ${room}</h2>
            ${contentHtml}
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    // 포커스 트랩 설정
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // 첫 번째 요소에 포커스
    if (firstFocusable) firstFocusable.focus();

    const trapFocus = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    };

    const closeModal = () => {
        modal.removeEventListener('keydown', trapFocus);
        modal.remove();
        document.body.classList.remove('modal-open');
    };

    modal.addEventListener('keydown', trapFocus);
    modal.querySelector('#close-room-modal').onclick = closeModal;
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeModal();
        }
    };
}

function showEmptyRoomScheduleModalForSearch(building, room, selectedDay) {
    const allClasses = timetableData
        .filter(item =>
            item.building_name === building &&
            item.classroom === room &&
            item.day === selectedDay
        )
        .sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));

    let modal = document.getElementById('room-detail-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'room-detail-modal';
    modal.className = 'modal-overlay';
    
    let contentHtml = '';
    if (allClasses.length > 0) {
        contentHtml = `
            <h4 class="details-subtitle" style="margin-top:0;">${DAY_NAMES_KOR[selectedDay]}요일 강의</h4>
            <div class="card-grid" style="grid-template-columns: 1fr; gap: 10px;">
            ${allClasses.map(item => `
                <div class="card">
                    <div class="card-content">
                        <div><b>${item.subject}</b></div>
                        <div class="class-prof" style="color: #555;">${getProfessorDisplay(item)}</div>
                        <div class="time">${item.start} ~ ${item.end}</div>
                    </div>
                </div>
            `).join('')}
            </div>
        `;
    } else {
        contentHtml = '<div class="card"><div class="card-content" style="color:#38a169; font-weight:600;">이 날은 강의가 없습니다.</div></div>';
    }

    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" id="close-room-modal" aria-label="모달 닫기">✖️</button>
            <h2 class="modal-title">${building} ${room}</h2>
            ${contentHtml}
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    // 포커스 트랩 설정
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // 첫 번째 요소에 포커스
    if (firstFocusable) firstFocusable.focus();

    const trapFocus = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    };

    const closeModal = () => {
        modal.removeEventListener('keydown', trapFocus);
        modal.remove();
        document.body.classList.remove('modal-open');
    };

    modal.addEventListener('keydown', trapFocus);
    modal.querySelector('#close-room-modal').onclick = closeModal;
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeModal();
        }
    };
}

let realTimeIntervalId = null;

function initializeSection(sectionId) {
    if (realTimeIntervalId) {
        clearInterval(realTimeIntervalId);
        realTimeIntervalId = null;
    }

    switch(sectionId) {
        case 'home':
            updateRealTimeStatus();
            realTimeIntervalId = setInterval(updateRealTimeStatus, REALTIME_UPDATE_INTERVAL_MS);
            break;
    }
}

function getRoomDisplay(item) {
    if (item.day === 'ONLINE' || String(item.type||'').toLowerCase() === 'online') return '온라인';
    const b = (item.building_name || '').trim();
    const r = (item.classroom || '').trim();
    if (b && r) return `${b} ${r}`;
    if (b) return b;
    if (r) return r;
    return '-';
}

function getProfessorDisplay(item) {
    if (Array.isArray(item.professors) && item.professors.length > 0) return item.professors.join(', ');
    return item.professor || '미지정';
}

function timeStringToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.trim().split(':').map(Number);
    return hours * 60 + minutes;
}

function updateRealTimeStatus() {
    if (!timetableData || timetableData.length === 0) return;

    const now = new Date();
    const currentDay = DAY_NAMES_ENG[now.getDay()];

    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const currentTimeInMinutes = timeStringToMinutes(currentTime);

    // 1. 현재 사용 중인 강의실 정보 필터링 (대형 강의 제외)
    const occupiedRooms = timetableData.filter(item => {
        // 기본 조건 체크
        if (item.day !== currentDay || !item.start || !item.end) {
            return false;
        }
        // 대형 강의 제외 (수강인원 기준)
        if (item.student_count && item.student_count >= LARGE_CLASS_THRESHOLD) {
            return false;
        }
        const startMinutes = timeStringToMinutes(item.start);
        const endMinutes = timeStringToMinutes(item.end);
        return currentTimeInMinutes >= startMinutes && currentTimeInMinutes < endMinutes;
    });

    const occupiedRoomKeys = new Set(occupiedRooms.map(item => `${(item.building_name||'').trim()}-${(item.classroom||'').trim()}`));

    // 2. 온라인 강의를 제외한 모든 물리적 강의실 목록 생성
    const allRoomKeys = [...new Set(timetableData
        .filter(item => item.day !== 'ONLINE' && item.building_name && item.classroom)
        .map(item => `${item.building_name.trim()}-${item.classroom.trim()}`)
    )];

    // 3. 상단 통계 카드 업데이트
    const emptyRoomsCount = allRoomKeys.length - occupiedRoomKeys.size;
    const statsContainer = document.getElementById('current-stats');
    statsContainer.innerHTML = `
        <div class="stats-container">
            <div class="stat-card">
                <div class="stat-icon">🔴</div>
                <div class="stat-number">${occupiedRoomKeys.size}</div>
                <div class="stat-label">사용 중</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🟢</div>
                <div class="stat-number">${emptyRoomsCount}</div>
                <div class="stat-label">빈 강의실</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🏢</div>
                <div class="stat-number">${allRoomKeys.length}</div>
                <div class="stat-label">전체</div>
            </div>
        </div>
        <div class="baseline-time">기준 시각: ${DAY_NAMES_KOR[currentDay]}요일 ${currentTime}</div>
    `;

    // 4. 모든 강의실을 건물별로 그룹화 (사용 중/빈 강의실)
    const roomsByBuilding = {};
    allRoomKeys.forEach(key => {
        const [building, room] = key.split('-');
        if (!roomsByBuilding[building]) {
            roomsByBuilding[building] = { occupied: [], empty: [] };
        }
        if (occupiedRoomKeys.has(key)) {
            const classDetails = occupiedRooms.find(item => `${item.building_name.trim()}-${item.classroom.trim()}` === key);
            if(classDetails) roomsByBuilding[building].occupied.push(classDetails);
        } else {
            roomsByBuilding[building].empty.push(room);
        }
    });

    // 5. 건물별 카드 HTML 생성
    const roomsContainer = document.getElementById('current-rooms');
    const buildings = Object.keys(roomsByBuilding).sort();
    
    roomsContainer.innerHTML = buildings.map(building => {
        const data = roomsByBuilding[building];
        const occupiedCount = data.occupied.length;
        const emptyCount = data.empty.length;

        return `
            <div class="building-group">
                <div class="building-title building-card" data-building="${building}">
                    <span class="building-name">${building}</span>
                    <div class="building-summary">
                        <span class="summary-occupied">사용 ${occupiedCount}</span>
                        <span class="summary-empty">비어있음 ${emptyCount}</span>
                    </div>
                    <span class="arrow">▼</span>
                </div>
                <div class="building-details" id="details-${building}" style="display:none;"><!-- Content will be generated on click --></div>
            </div>
        `;
    }).join('');
}

function populateDropdown(selectId, data, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    let optionsHtml = `<option value="">${options.placeholder}</option>`;
    
    if (options.isClassroom) {
        optionsHtml += data.map(({ building, room }) => `<option value="${building}-${room}">${building} ${room}</option>`).join('');
    } else {
        optionsHtml += data.map(item => `<option value="${item}">${item}</option>`).join('');
    }
    
    select.innerHTML = optionsHtml;
}

function initializeSearchSection() {
    const daySelect = document.getElementById('day-select');
    const timeSelect = document.getElementById('time-select');
    const classroomSelect = document.getElementById('classroom-select');
    const searchButton = document.getElementById('search-button');
    const searchNowButton = document.getElementById('search-now-button');
    const resultsContainer = document.getElementById('search-results');
    const timeButtons = document.querySelectorAll('.time-btn');

    // '지금 바로 검색' 버튼 이벤트
    if (searchNowButton) {
        searchNowButton.addEventListener('click', () => {
            const now = new Date();
            const currentDay = DAY_NAMES_ENG[now.getDay()];
            const currentHour = now.getHours();

            // 주말 체크
            if (currentDay === 'SUN' || currentDay === 'SAT') {
                resultsContainer.innerHTML = getNoResultsMessage('주말에는 수업이 없습니다.');
                daySelect.value = '';
                timeSelect.value = '';
                return;
            }

            // 수업 시간 범위 체크 (8시~22시)
            if (currentHour < 8 || currentHour >= 22) {
                resultsContainer.innerHTML = getNoResultsMessage('현재는 수업이 없는 시간입니다.');
                daySelect.value = '';
                timeSelect.value = '';
                return;
            }

            daySelect.value = currentDay;
            timeSelect.value = `${currentHour.toString().padStart(2, '0')}:00`;
            
            // 시간 버튼 활성화 상태 업데이트
            timeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.time === timeSelect.value);
            });

            performSearch();
        });
    }

    // 시간 버튼 클릭 시 time-select 값 변경 및 스타일 업데이트
    timeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const selectedTime = this.dataset.time;
            timeSelect.value = selectedTime;
            
            timeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 시간 선택 후 자동으로 검색 실행
            performSearch();
        });
    });
    
    // 검색 로직
    function performSearch() {
        const day = daySelect.value;
        const time = timeSelect.value;
        const classroomFilter = classroomSelect.value;

        if (!day || !time) {
            resultsContainer.innerHTML = `
                <div class="search-info">
                    <p><strong>💡 사용 방법</strong></p>
                    <p>1. 요일을 선택하세요 (월~토)</p>
                    <p>2. 시간을 선택하세요 (09:00~21:00)</p>
                    <p>3. 필요시 특정 강의실을 선택하세요 (선택사항)</p>
                    <p style="margin-top: 10px;">또는 <strong>📍 지금 바로 검색</strong> 버튼을 눌러 현재 시간의 빈 강의실을 확인하세요!</p>
                </div>
            `;
            return;
        }

        // 1. 해당 요일, 시간에 사용 중인 강의실 목록 생성
        const timeMinutes = timeStringToMinutes(time);
        const occupiedRooms = new Set(
            timetableData
                .filter(item => {
                    if (item.day !== day || !item.start || !item.end) return false;
                    const startMinutes = timeStringToMinutes(item.start);
                    const endMinutes = timeStringToMinutes(item.end);
                    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
                })
                .map(item => `${item.building_name}-${item.classroom}`)
        );

        // 2. 전체 강의실 목록에서 사용 중인 강의실을 제외하여 빈 강의실 목록 생성
        let emptyRooms = classroomsList.filter(room => {
            const roomKey = `${room.building}-${room.room}`;
            return !occupiedRooms.has(roomKey);
        });

        // 3. 추가 필터링 (특정 강의실 선택 시)
        if (classroomFilter) {
            const [building, room] = classroomFilter.split('-');
            emptyRooms = emptyRooms.filter(r => r.building === building && r.room === room);
        }
        
        // 4. 결과를 건물별로 그룹화
        const groupedByBuilding = emptyRooms.reduce((acc, room) => {
            if (!acc[room.building]) {
                acc[room.building] = [];
            }
            acc[room.building].push(room.room);
            return acc;
        }, {});

        // 5. 결과 HTML 렌더링
        if (emptyRooms.length > 0) {
            let html = Object.keys(groupedByBuilding).sort().map(building => `
                <div class="building-group">
                    <div class="building-title">${building} (${groupedByBuilding[building].length}개)</div>
                    <div class="card-grid empty-grid">
                        ${groupedByBuilding[building].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(room => `
                            <div class="card empty-room-card" data-building="${building}" data-room="${room}">
                                <div class="card-title">${room}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            resultsContainer.innerHTML = html;
        } else {
            resultsContainer.innerHTML = getNoResultsMessage('해당 조건에 맞는 빈 강의실이 없습니다.');
        }
    }

    // 이벤트 리스너 연결
    searchButton.addEventListener('click', performSearch);
    daySelect.addEventListener('change', performSearch);
    timeSelect.addEventListener('change', () => {
        // 드롭다운 변경 시 시간 버튼 스타일도 업데이트
        const selectedTime = timeSelect.value;
        timeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.time === selectedTime);
        });
        performSearch();
    });
    classroomSelect.addEventListener('change', performSearch);

    // 검색 결과 빈 강의실 클릭 이벤트 (이벤트 위임)
    resultsContainer.addEventListener('click', (e) => {
        const emptyRoomCard = e.target.closest('.empty-room-card');
        if (emptyRoomCard) {
            const building = emptyRoomCard.dataset.building;
            const room = emptyRoomCard.dataset.room;
            if (building && room) {
                showEmptyRoomScheduleModalForSearch(building, room, daySelect.value);
            }
        }
    });
}

// (This is a simplified representation)

function generateVisualTimetable(classes, titleName) {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const timeSlots = 26; // 9:00 ~ 21:30 (30분 단위)

    let tableHtml = `
        <div class="timetable-container">
            <div class="timetable-header"><h3>${titleName}</h3></div>
            <div class="timetable-scale-wrap">
                <div class="timetable-grid-30">
    `;

    // 1. 헤더 행 (요일)
    tableHtml += `<div class="timetable-header-cell" style="grid-column: 1; grid-row: 1;"></div>`;
    days.forEach((day, index) => {
        tableHtml += `<div class="timetable-header-cell" style="grid-column: ${index + 2}; grid-row: 1;">${day}</div>`;
    });

    // 2. 시간 레이블 열
    for (let i = 0; i < timeSlots; i++) {
        if (i % 2 === 0) {
            const hour = 9 + Math.floor(i / 2);
            const row = i + 2;
            tableHtml += `<div class="time-label" style="grid-column: 1; grid-row: ${row} / span 2;">${hour}:00</div>`;
        }
    }

    // 3. 배경 '공강' 블록
    for (let d = 0; d < days.length; d++) {
        for (let t = 0; t < timeSlots; t++) {
            tableHtml += `<div class="empty-slot-block" style="grid-column: ${d + 2}; grid-row: ${t + 2};"><span class="empty-slot-text">공강</span></div>`;
        }
    }

    // 4. 강의 블록 생성 전 데이터 처리: 연속된 강의 병합
    const processedClasses = [];
    const sortedClasses = classes
        .filter(c => c.day && c.start && c.end && days.includes(c.day)) // 유효하고, 표시될 요일 데이터만 필터링
        .sort((a, b) => {
            const dayCompare = days.indexOf(a.day) - days.indexOf(b.day);
            if (dayCompare !== 0) return dayCompare;
            return a.start.localeCompare(b.start);
        });

    if (sortedClasses.length > 0) {
        let currentClass = { ...sortedClasses[0] };

        for (let i = 1; i < sortedClasses.length; i++) {
            const nextClass = sortedClasses[i];
            const isSameClass = currentClass.subject === nextClass.subject &&
                                currentClass.day === nextClass.day &&
                                getRoomDisplay(currentClass) === getRoomDisplay(nextClass) &&
                                getProfessorDisplay(currentClass) === getProfessorDisplay(nextClass);

            if (isSameClass && currentClass.end === nextClass.start) {
                currentClass.end = nextClass.end; // 연속되면 end 시간만 업데이트
            } else {
                processedClasses.push(currentClass);
                currentClass = { ...nextClass };
            }
        }
        processedClasses.push(currentClass); // 마지막 강의 추가
    }

    // 5. 병합된 강의 블록 렌더링
    processedClasses.forEach(c => {
        const dayIndex = days.indexOf(c.day);
        if (dayIndex === -1) return;

        const start = new Date(`1970-01-01T${c.start}:00`);
        const end = new Date(`1970-01-01T${c.end}:00`);
        const durationMinutes = (end - start) / 60000;

        if (isNaN(durationMinutes) || durationMinutes <= 0) return;

        const startRow = ((start.getHours() - 9) * 2) + (start.getMinutes() / 30) + 2;
        const rowSpan = Math.round(durationMinutes / 30);

        if (rowSpan > 0) {
            tableHtml += `
                <div class="class-block" style="grid-column: ${dayIndex + 2}; grid-row: ${startRow} / span ${rowSpan}; z-index: 10;">
                    <div class="class-subject">${c.subject}</div>
                    <div class="class-room">${getRoomDisplay(c)}</div>
                    <div class="class-prof">${getProfessorDisplay(c)}</div>
                </div>
            `;
        }
    });

    tableHtml += '</div></div></div>';
    return tableHtml;
}

function applyAllTimetablesScale() {
    document.querySelectorAll('.timetable-scale-wrap').forEach(container => {
        // 컨테이너가 화면에 보일 때만 크기 조절 실행
        if (container.offsetParent === null) {
            return;
        }

        const timetable = container.querySelector('.timetable-grid-30');
        if (timetable) {
            // 스케일링 전 원래 스타일로 초기화
            timetable.style.transform = 'none';
            container.style.height = 'auto';

            const containerWidth = container.offsetWidth;
            const timetableWidth = timetable.offsetWidth;
            
            if (timetableWidth > containerWidth) {
                const scale = containerWidth / timetableWidth;
                timetable.style.transform = `scale(${scale})`;
                container.style.height = `${timetable.offsetHeight * scale}px`;
            } else {
                // 컨테이너보다 작거나 같으면 원래 크기대로
                timetable.style.transform = 'none';
                container.style.height = `${timetable.offsetHeight}px`;
            }
        }
    });
}

// Debounce 함수: 이벤트가 멈춘 후 일정 시간이 지나면 함수를 실행
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 창 크기 변경 시 시간표 스케일 재조정 (Debounce 적용으로 성능 최적화)
window.addEventListener('resize', debounce(applyAllTimetablesScale, RESIZE_DEBOUNCE_MS));

function getNoResultsMessage(message) {
    return `
        <div class="no-results">
            <div class="no-results-icon">🤷</div>
            <p>${message}</p>
        </div>
    `;
}
