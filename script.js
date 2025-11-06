// ===== 건물별 특성(주요 학과, 대표 수업) 추출 및 표시 =====
function renderBuildingFeatureInfo() {
    // 이 함수는 이제 renderBuildingCongestionRanking에서 함께 처리됩니다.
    // 개별 호출이 필요 없어졌으므로 비워두거나 삭제할 수 있습니다.
}

// ===== 현재 시간 기준 TOP3 붐비는/한산한 건물 표시 =====
// 혼잡도 랭킹 카드 렌더링
function renderBuildingCongestionRanking() {
    const now = new Date();
    const { congestion } = calculateBuildingStatsForTime(now);
    const sorted = congestion.sort((a, b) => b[1] - a[1]);
    
    // 실시간 기준 시각 업데이트
    const timestampEl = document.getElementById('ranking-timestamp');
    if (timestampEl) {
        timestampEl.textContent = `(${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} 기준)`;
    }

    const top = sorted.slice(0, 3);
    const bottom = sorted.length > 3 ? sorted.slice(-3).reverse() : [];
    const rankingDiv = document.getElementById('building-congestion-ranking');
    if (!rankingDiv) return;

    if (sorted.length === 0) {
        rankingDiv.innerHTML = '<div class="example-notice">현재 시간에 진행 중인 수업이 없습니다.<br>예시: <b>평일 10:00</b>에 확인해보세요!</div>';
        return;
    }

    rankingDiv.innerHTML = `
        <div class="congestion-ranking-wrap">
            <div class="ranking-block">
                <div class="ranking-title">🔥 혼잡 TOP 3</div>
                ${top.map(([building, count], i) => {
                    const level = getCongestionLevel(count);
                    return `<div class="congestion-card" data-building="${building}" style="border-left-color:${level.color};">
                        <span class="rank-badge" style="background-color:${level.color};">${i + 1}</span>
                        <span class="building-name">${building}</span>
                        <span class="student-count">${count}명</span>
                        <span class="congestion-badge" style="color:${level.color};">${level.emoji} ${level.level}</span>
                    </div>`;
                }).join('')}
            </div>
            ${bottom.length > 0 ? `
            <div class="ranking-block">
                <div class="ranking-title">🟢 여유 TOP 3</div>
                ${bottom.map(([building, count], i) => {
                    const level = getCongestionLevel(count);
                    const rank = sorted.length - bottom.length + i + 1;
                    return `<div class="congestion-card" data-building="${building}" style="border-left-color:${level.color};">
                        <span class="rank-badge" style="background-color:${level.color};">${rank}</span>
                        <span class="building-name">${building}</span>
                        <span class="student-count">${count}명</span>
                        <span class="congestion-badge" style="color:${level.color};">${level.emoji} ${level.level}</span>
                    </div>`;
                }).join('')}
            </div>
            ` : ''}
        </div>
    `;
}

// 건물별 특성 정보 렌더링
function renderBuildingFeatureInfo(buildingName) {
    const now = new Date();
    const { features } = calculateBuildingStatsForTime(now);
    const infoDiv = document.getElementById('building-feature-info');
    if (!infoDiv) return;
    if (!features[buildingName]) {
        infoDiv.innerHTML = '<div class="example-notice">이 시간에 해당 건물에서 진행 중인 수업이 없습니다.</div>';
        return;
    }
    const deptEntries = Object.entries(features[buildingName].dept).sort((a, b) => b[1] - a[1]);
    const subjectEntries = Object.entries(features[buildingName].subject).sort((a, b) => b[1] - a[1]);
    infoDiv.innerHTML = `
        <div class="feature-info-wrap">
            <div class="feature-card">
                <div class="feature-title">주요 개설 학과</div>
                <div class="feature-list">${deptEntries.length ? deptEntries.map(([d, n]) => `<span>${d} (${n})</span>`).join(', ') : '-'}</div>
            </div>
            <div class="feature-card">
                <div class="feature-title">주요 개설 과목</div>
                <div class="feature-list">${subjectEntries.length ? subjectEntries.slice(0, 5).map(([s, n]) => `<span>${s} (${n})</span>`).join(', ') : '-'}</div>
            </div>
        </div>
    `;
}

// 피크타임 정보 렌더링
function renderPeakTimeInfo() {
    const infoDiv = document.getElementById('heatmap-info-summary');
    if (!infoDiv) return;
    // 시간대별 전체 학생 수 집계
    const timeBuckets = {};
    timetableData.forEach(item => {
        if (!item.start || !item.end || !item.day || !item.student_count) return;
        const startHour = parseInt(item.start.split(':')[0]);
        const endHour = parseInt(item.end.split(':')[0]);
        for (let h = startHour; h < endHour; h++) {
            const key = `${item.day}_${h}`;
            timeBuckets[key] = (timeBuckets[key] || 0) + item.student_count;
        }
    });
    // 피크타임 찾기
    let peakKey = null, peakValue = 0;
    Object.entries(timeBuckets).forEach(([k, v]) => {
        if (v > peakValue) {
            peakValue = v;
            peakKey = k;
        }
    });
    if (!peakKey) {
        infoDiv.innerHTML = '<div class="peak-time-info">피크타임 정보 없음</div>';
        return;
    }
    const [peakDay, peakHour] = peakKey.split('_');
    const dayKor = dayNameMap[peakDay] || peakDay;
    infoDiv.innerHTML = `<div class="peak-time-info">가장 붐비는 시간: <b>${dayKor}요일 ${peakHour}:00</b> (${peakValue}명)</div>`;
}

// 혼잡도, 특성, 피크타임 등 heatmap 섹션 초기화
function initializeHeatmapFeatures() {
    renderBuildingCongestionRanking();
    renderPeakTimeInfo();

    const rankingDiv = document.getElementById('building-congestion-ranking');
    if (rankingDiv) {
        rankingDiv.onclick = function(e) {
            const card = e.target.closest('.congestion-card');
            if (card) {
                const building = card.dataset.building;
                
                // 모든 카드에서 'selected' 클래스 제거
                rankingDiv.querySelectorAll('.congestion-card').forEach(c => c.classList.remove('selected'));
                // 클릭된 카드에 'selected' 클래스 추가
                card.classList.add('selected');

                // 건물별 특성 정보 렌더링
                renderBuildingFeatureInfo(building);

                // 히트맵 건물 필터 업데이트 및 차트 다시 그리기
                const buildingSelect = document.getElementById('heatmap-building-select');
                if (buildingSelect) {
                    buildingSelect.value = building;
                    renderHeatmapChart();
                }
            }
        };
    }

    const deptSelect = document.getElementById('heatmap-dept-select');
    if (deptSelect) {
        deptSelect.onchange = function() {
            renderHeatmapChart();
        };
    }
    
    const buildingSelect = document.getElementById('heatmap-building-select');
    if(buildingSelect) {
        buildingSelect.onchange = () => {
            // 필터 변경 시, 랭킹 카드 선택 상태 초기화
            if (rankingDiv) {
                 rankingDiv.querySelectorAll('.congestion-card').forEach(c => c.classList.remove('selected'));
            }
            document.getElementById('building-feature-info').innerHTML = '<div class="example-notice">랭킹 카드를 클릭하여 건물별 특성을 확인하세요.</div>';
            renderHeatmapChart();
        };
    }
}

// 혼잡도 등급 산정 및 매핑 함수
function getCongestionLevel(studentCount) {
    if (studentCount <= 50) {
        return { level: '여유', emoji: '🟢', color: '#38a169', desc: '여유' };
    } else if (studentCount <= 150) {
        return { level: '보통', emoji: '🟡', color: '#ecc94b', desc: '보통' };
    } else if (studentCount <= 300) {
        return { level: '혼잡', emoji: '🟠', color: '#ed8936', desc: '혼잡' };
    } else {
        return { level: '매우 혼잡', emoji: '🔴', color: '#e53e3e', desc: '매우 혼잡' };
    }
}

// 시간별 건물 혼잡도 및 특성 계산
function calculateBuildingStatsForTime(targetDate) {
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = dayNames[targetDate.getDay()];
    const currentTimeInMinutes = timeStringToMinutes(targetDate.getHours().toString().padStart(2, '0') + ':' + targetDate.getMinutes().toString().padStart(2, '0'));

    const buildingStats = {}; // 혼잡도 계산용
    const buildingInfo = {};  // 특성 정보 계산용

    timetableData.forEach(item => {
        if (item.day !== currentDay || !item.start || !item.end || !item.building_name) return;
        const startMinutes = timeStringToMinutes(item.start);
        const endMinutes = timeStringToMinutes(item.end);

        if (currentTimeInMinutes >= startMinutes && currentTimeInMinutes < endMinutes) {
            // 혼잡도 계산
            if (!buildingStats[item.building_name]) buildingStats[item.building_name] = 0;
            buildingStats[item.building_name] += (item.student_count || 0);

            // 특성 정보 계산
            if (!buildingInfo[item.building_name]) {
                buildingInfo[item.building_name] = { dept: {}, subject: {} };
            }
            if (item.department) {
                buildingInfo[item.building_name].dept[item.department] = (buildingInfo[item.building_name].dept[item.department] || 0) + 1;
            }
            if (item.subject) {
                buildingInfo[item.building_name].subject[item.subject] = (buildingInfo[item.building_name].subject[item.subject] || 0) + 1;
            }
        }
    });

    return {
        congestion: Object.entries(buildingStats),
        features: buildingInfo
    };
}

// ===== 데이터 정의 =====
let timetableData = [];
let professorsList = [];
let classroomsList = [];
const dayNameMap = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토' };

// ===== 데이터 로드 =====
async function loadTimetableData() {
    const loadingIndicator = document.getElementById('loading-indicator');
    try {
        loadingIndicator.classList.add('loading-visible');
        
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
        // heatmap 섹션이 이미 보이면 강제로 한 번 더 렌더링
        if (document.getElementById('heatmap') && !document.getElementById('heatmap').classList.contains('section-hidden')) {
            renderHeatmapChart();
        }

    } catch (error) {
        console.error('데이터 로드 실패:', error);
        handleDataLoadError();
    } finally {
        loadingIndicator.classList.remove('loading-visible');
    }
}
function processLoadedData() {
    if (!timetableData || timetableData.length === 0) {
        console.log('처리할 데이터가 없습니다.');
        return;
    }

    // 드롭다운 채우기
    populateDropdown('professor-main-select', professorsList, { placeholder: '교수님을 선택하세요' });
    populateDropdown('professor-select', professorsList, { placeholder: '교수님을 선택하세요' });
    populateDropdown('classroom-select', classroomsList, { placeholder: '전체 강의실', isClassroom: true });
    populateDropdown('schedule-classroom-select', classroomsList, { placeholder: '강의실을 선택하세요', isClassroom: true });

    // Heatmap building select population
    const buildingSelect = document.getElementById('heatmap-building-select');
    if (buildingSelect) {
        const buildings = [...new Set(classroomsList.map(c => c.building))].sort();
        buildingSelect.innerHTML += buildings.map(b => `<option value="${b}">${b}</option>`).join('');
        buildingSelect.addEventListener('change', () => renderHeatmapChart());
    }

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
    // heatmap 섹션이 보이면 강제 렌더링
    if (document.getElementById('heatmap') && !document.getElementById('heatmap').classList.contains('section-hidden')) {
        renderHeatmapChart();
    }

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
            if (nav) nav.classList.remove('nav-open');
            setActiveSection(targetId);
        });
    });

    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('nav-open');
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

        // 1. 검색 유형에 따라 검색어(query) 설정
        switch (type) {
            case 'professor':
                query = professorSelect.value;
                break;
            case 'classroom':
                query = classroomSelect.value;
                break;
            case 'missing-professor':
                query = '미지정'; // 교수명이 비어있는 경우를 찾기 위함
                break;
            default:
                query = searchInput.value.trim().toLowerCase();
                break;
        }

        if (type !== 'missing-professor' && !query) {
            resultsContainer.innerHTML = getNoResultsMessage('검색어를 입력하거나 선택해주세요.');
            onlineCoursesContainer.innerHTML = '';
            return;
        }

        // 2. 데이터 필터링
        let filteredResults = timetableData.filter(item => {
            // 요일 필터
            if (day && item.day !== day) {
                return false;
            }

            // 검색 유형별 필터
            switch (type) {
                case 'subject':
                    return (item.subject || '').toLowerCase().includes(query);
                case 'professor':
                    return (item.professor || '') === query;
                case 'department':
                    return (item.department || '').toLowerCase().includes(query);
                case 'classroom':
                    const [building, room] = query.split('-');
                    return item.building_name === building && item.classroom === room;
                case 'missing-professor':
                    return !item.professor || item.professor === '미지정';
                default:
                    return false;
            }
        });

        // 3. 결과 렌더링
        renderScheduleResults(filteredResults);
    }

    function renderScheduleResults(results) {
        const onlineCourses = results.filter(item => item.day === 'ONLINE');
        const offlineCourses = results.filter(item => item.day !== 'ONLINE');

        // 오프라인 강의 결과 표시
        if (offlineCourses.length > 0) {
            // 결과를 요일 순, 시작 시간 순으로 정렬
            const dayOrder = { 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6 };
            offlineCourses.sort((a, b) => {
                const dayCompare = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
                if (dayCompare !== 0) return dayCompare;
                return (a.start || '').localeCompare(b.start || '');
            });

            resultsContainer.innerHTML = `
                <div class="results-summary">총 ${offlineCourses.length}개의 오프라인 강의가 검색되었습니다.</div>
                <div class="card-grid schedule-grid">
                    ${offlineCourses.map(item => `
                        <div class="card schedule-card">
                            <div class="card-title">${item.subject}</div>
                            <div class="card-content">
                                <div class="schedule-info"><b>교수:</b> ${getProfessorDisplay(item)}</div>
                                <div class="schedule-info"><b>시간:</b> ${dayNameMap[item.day] || item.day} ${item.start}~${item.end}</div>
                                <div class="schedule-info"><b>강의실:</b> ${getRoomDisplay(item)}</div>
                                <div class="schedule-info"><b>이수:</b> ${item.department || '-'} / <b>학점:</b> ${item.credits || '-'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            resultsContainer.innerHTML = getNoResultsMessage('오프라인 강의 결과가 없습니다.');
        }

        // 온라인 강의 결과 표시
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

    // 이벤트 리스너 연결
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
            case 'missing-professor':
                // 이 옵션은 입력 필드가 필요 없음
                break;
            default:
                searchInputGroup.style.display = 'block';
                break;
        }
        // 유형 변경 시 이전 결과 초기화
        resultsContainer.innerHTML = '';
        onlineCoursesContainer.innerHTML = '';
    });

    searchButton.addEventListener('click', performScheduleSearch);
    // Enter 키로도 검색 가능하게
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performScheduleSearch();
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
        }, 1500); // 1.5초 후 결과 표시
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
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const currentDay = dayNames[now.getDay()];
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
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = dayNames[now.getDay()];
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
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.35)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
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
        <div style="background:white;padding:30px 20px;border-radius:16px;max-width:350px;width:90vw;box-shadow:0 8px 30px rgba(0,0,0,0.18);position:relative;">
            <button id="close-room-modal" style="position:absolute;top:10px;right:10px;font-size:1.3rem;background:none;border:none;cursor:pointer;">✖️</button>
            <h2 style="margin-bottom:18px;font-size:1.2rem;">${building} ${room}</h2>
            ${contentHtml}
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const closeModal = () => {
        modal.remove();
        document.body.classList.remove('modal-open');
    };

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
            realTimeIntervalId = setInterval(updateRealTimeStatus, 60000); // 1분마다 새로고침
            break;
        case 'heatmap':
            initializeHeatmapFeatures();
            renderHeatmapChart();
            break;
        case 'professor-timetable':
            initializeProfessorSection();
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
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = dayNames[now.getDay()];

    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const currentTimeInMinutes = timeStringToMinutes(currentTime);

    // 1. 현재 사용 중인 강의실 정보 필터링
    const occupiedRooms = timetableData.filter(item => {
        if (item.day !== currentDay || !item.start || !item.end) return false;
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
        <div class="baseline-time">기준 시각: ${currentDay} ${currentTime}</div>
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
    const resultsContainer = document.getElementById('search-results');
    const timeButtons = document.querySelectorAll('.time-btn');

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
            resultsContainer.innerHTML = getNoResultsMessage('요일과 시간을 모두 선택해주세요.');
            return;
        }

        // 1. 해당 요일, 시간에 사용 중인 강의실 목록 생성
        const occupiedRooms = new Set(
            timetableData
                .filter(item => 
                    item.day === day &&
                    item.start && item.end &&
                    time >= item.start && time < item.end
                )
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
                            <div class="card empty-room-card">
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

    // 모달 생성 함수
    function showRoomDetailModal(building, room, used, day, time) {
        let modal = document.getElementById('room-detail-modal');
        if (modal) modal.remove(); // 이전 모달 제거

        modal = document.createElement('div');
        modal.id = 'room-detail-modal';
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.35)';
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        modal.innerHTML = `<div style="background:white;padding:30px 20px;border-radius:16px;max-width:350px;width:90vw;box-shadow:0 8px 30px rgba(0,0,0,0.18);position:relative;">
            <button id="close-room-modal" style="position:absolute;top:10px;right:10px;font-size:1.3rem;background:none;border:none;cursor:pointer;">✖️</button>
            <h2 style="margin-bottom:18px;font-size:1.2rem;">${building} ${room} 상세 내역</h2>
            <div style="margin-bottom:10px;font-size:0.98rem;color:#555;">${day ? day+'요일 ' : ''}${time ? time+'시' : ''}</div>
            ${used.length ? `<div style="margin-bottom:10px;">해당 시간에 사용 중인 강의가 있습니다:</div>` + used.map(item =>
                `<div style="background:#f8f9fa;padding:10px;border-radius:8px;margin-bottom:8px;">
                    <b>${item.subject}</b> (${item.code})<br>
                    교수: ${getProfessorDisplay(item)}<br>
                    시간: ${item.day} ${item.start}~${item.end}
                </div>`
            ).join('') : '<div style="color:#667eea;font-weight:600;">해당 시간에 사용 내역 없음 (빈 강의실)</div>'}
        </div>`;
        
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        const closeModal = () => {
            modal.remove();
            document.body.classList.remove('modal-open');
        };

        modal.querySelector('#close-room-modal').onclick = closeModal;
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
    }
}

function initializeProfessorSection() {
    const select = document.getElementById('professor-main-select');
    const resultsDiv = document.getElementById('professor-main-results');
    if (!select || !resultsDiv) return;

    select.onchange = function() {
        const name = select.value;
        if (!name) {
            resultsDiv.innerHTML = '';
            return;
        }

    const classes = timetableData.filter(item => (item.professor || '').includes(name));
        if (classes.length === 0) {
            resultsDiv.innerHTML = '<div class="card"><div class="card-content">해당 교수님의 강의 정보가 없습니다.</div></div>';
            return;
        }

        // 교수님 통계 계산
        const totalCredits = classes.reduce((sum, c) => sum + (c.credit || 0), 0);
        const teachingDays = [...new Set(classes.map(c => c.day))].filter(d => d !== 'ONLINE');
        const mainBuilding = [...new Set(classes.map(c => c.building_name))].filter(b => b).join(', ');

        // --- 추가 통계 계산 ---
        // 오전/오후 강의 비율
        const amClasses = classes.filter(c => c.start < '12:00' && c.day !== 'ONLINE').length;
        const pmClasses = classes.filter(c => c.start >= '12:00' && c.day !== 'ONLINE').length;

        // 가장 바쁜 요일
        const dayCounts = classes.reduce((acc, c) => {
            if (c.day !== 'ONLINE') {
                acc[c.day] = (acc[c.day] || 0) + 1;
            }
            return acc;
        }, {});
        let busiestDay = '없음';
        let maxCount = 0;
        Object.entries(dayCounts).forEach(([day, count]) => {
            if (count > maxCount) {
                maxCount = count;
                busiestDay = `${dayNameMap[day]}요일 (${count}개)`;
            }
        });

        // 주요 강의실
        const classroomCounts = classes.reduce((acc, c) => {
            const room = getRoomDisplay(c);
            if (room !== '온라인' && room !== '-') {
                acc[room] = (acc[room] || 0) + 1;
            }
            return acc;
        }, {});
        let topClassroom = '없음';
        let maxRoomCount = 0;
        for (const room in classroomCounts) {
            if (classroomCounts[room] > maxRoomCount) {
                maxRoomCount = classroomCounts[room];
                topClassroom = room;
            }
        }

        // 통계 및 시간표 템플릿
        resultsDiv.innerHTML = `
            <div class="timetable-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                <div class="timetable-stat">
                    <div class="stat-icon">📚</div>
                    <div class="timetable-stat-number">${classes.length}</div>
                    <div class="timetable-stat-label">총 강의 수</div>
                </div>
                <div class="timetable-stat">
                    <div class="stat-icon">⏳</div>
                    <div class="timetable-stat-number">${amClasses} / ${pmClasses}</div>
                    <div class="timetable-stat-label">오전 / 오후</div>
                </div>
                <div class="timetable-stat">
                    <div class="stat-icon">🔥</div>
                    <div class="timetable-stat-number">${busiestDay}</div>
                    <div class="timetable-stat-label">가장 바쁜 요일</div>
                </div>
                <div class="timetable-stat">
                    <div class="stat-icon">📍</div>
                    <div class="timetable-stat-number">${topClassroom}</div>
                    <div class="timetable-stat-label">주요 강의실</div>
                </div>
                <div class="timetable-stat">
                    <div class="stat-icon">🗓️</div>
                    <div class="timetable-stat-number">${teachingDays.length}일</div>
                    <div class="timetable-stat-label">강의하는 날</div>
                </div>
                <div class="timetable-stat">
                    <div class="stat-icon">🏢</div>
                    <div class="timetable-stat-number">${mainBuilding || '없음'}</div>
                    <div class="timetable-stat-label">활동 건물</div>
                </div>
            </div>
            <div id="professor-visual-timetable"></div>
        `;

        // 시각적 시간표 생성 및 삽입
        const timetableContainer = document.getElementById('professor-visual-timetable');
        // generateVisualTimetable 함수가 이미 있다고 가정하고 호출
        // 이 함수는 script.js의 다른 부분에 정의되어 있어야 합니다.
        const visualTimetableHTML = generateVisualTimetable(classes, `${name} 교수님 시간표`);
        timetableContainer.innerHTML = visualTimetableHTML;
        
        // 생성된 시간표에 자동 스케일링 적용
        applyAllTimetablesScale();
    };
}

function estimateConsultationTimes(professorName, day) {
    const classes = timetableData
        .filter(item => (item.professor || '').includes(professorName) && item.day === day)
        .sort((a, b) => a.start.localeCompare(b.start));

    const freeSlots = [];
    let currentTime = '09:00';
    const endOfDay = '18:00';

    classes.forEach(c => {
        if (currentTime < c.start) {
            freeSlots.push({ start: currentTime, end: c.start });
        }
        currentTime = c.end;
    });

    if (currentTime < endOfDay) {
        freeSlots.push({ start: currentTime, end: endOfDay });
    }

    return freeSlots;
}

// 히트맵 차트 렌더링 (기존 함수 확장)
function renderHeatmapChart() {
    const ctx = document.getElementById('heatmap-chart');
    if (!ctx) return;
    if (window.myHeatmapChart) {
        window.myHeatmapChart.destroy();
    }
    // 혼잡도 랭킹 카드 표시
    if (document.getElementById('building-congestion-ranking')) {
        renderBuildingCongestionRanking();
    }

    const buildingSelect = document.getElementById('heatmap-building-select');
    const selectedBuilding = buildingSelect ? buildingSelect.value : '';
    const deptSelect = document.getElementById('heatmap-dept-select');
    const selectedDept = deptSelect ? deptSelect.value : '';

    const days = ['월', '화', '수', '목', '금', '토'];
    const timeLabels = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
    const data = [];

    let filteredData = timetableData;
    if (selectedBuilding) {
        filteredData = filteredData.filter(item => item.building_name === selectedBuilding);
    }
    if (selectedDept) {
        filteredData = filteredData.filter(item => item.department === selectedDept);
    }

    timeLabels.forEach((time, tIndex) => {
        days.forEach((day, dIndex) => {
            const dayKey = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dIndex];
            const totalStudents = filteredData
                .filter(item => {
                    if (!item.start || !item.end) return false;
                    const itemStartTime = parseInt(item.start.split(':')[0]);
                    const itemEndTime = parseInt(item.end.split(':')[0]);
                    return item.day === dayKey &&
                           itemStartTime <= parseInt(time) &&
                           parseInt(time) < itemEndTime;
                })
                .reduce((sum, item) => sum + (item.student_count || 0), 0);
            data.push({
                x: time + '시',
                y: day,
                v: totalStudents
            });
        });
    });

    window.myHeatmapChart = new Chart(ctx.getContext('2d'), {
        type: 'matrix',
        data: {
            datasets: [{
                label: '총 수강 인원',
                data: data,
                backgroundColor(ctx) {
                    const value = ctx.dataset.data[ctx.dataIndex].v;
                    if (value === 0) return 'rgba(245, 245, 245, 0.8)';
                    // Adjust alpha based on student count. Max alpha at ~300 students.
                    const alpha = Math.min(0.2 + (value / 300), 1); 
                    return `rgba(102, 126, 234, ${alpha})`;
                },
                borderColor(ctx) {
                    const value = ctx.dataset.data[ctx.dataIndex].v;
                    if (value === 0) return 'rgba(200,200,200,0.5)';
                    return 'rgba(102, 126, 234, 0.7)';
                },
                borderWidth: 1,
                width: ({chart}) => (chart.chartArea || {}).width / timeLabels.length - 2,
                height: ({chart}) => (chart.chartArea || {}).height / days.length - 2,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.raw.y} ${context.raw.x}: ${context.raw.v}명`;
                        }
                    }
                }
            },
            scales: {
                x: { type: 'category', title: { display: true, text: '시간' } },
                y: { type: 'category', title: { display: true, text: '요일' } }
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
window.addEventListener('resize', debounce(applyAllTimetablesScale, 150));

function getNoResultsMessage(message) {
    return `
        <div class="no-results">
            <div class="no-results-icon">🤷</div>
            <p>${message}</p>
        </div>
    `;
}
