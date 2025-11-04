// ===== 데이터 정의 =====
let timetableData = [];
let professorsList = [];
let classroomsList = [];

// ===== 데이터 로드 =====
async function loadTimetableData() {
    const loadingIndicator = document.getElementById('loading-indicator');
    try {
        loadingIndicator.classList.add('loading-visible');
        const response = await fetch('timetable.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        timetableData = await response.json();
        processLoadedData();
    } catch (error) {
        console.error('시간표 데이터 로드 실패:', error);
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
    const professorsSet = new Set();
    timetableData.forEach(item => {
        const single = (item.professor || '').trim();
        if (single && !['01','02','03','04','05','06','07','08','09','10'].includes(single)) {
            single.split(/[,\/&]|\s{2,}/).forEach(name => {
                const n = name.trim();
                if (n) professorsSet.add(n);
            });
        }
    });
    professorsList = Array.from(professorsSet).sort();

    const classroomsSet = new Map();
    timetableData.forEach(item => {
        const building = (item.building_name || '').trim();
        const room = (item.classroom || '').trim();
        if (building && room) {
            const key = `${building}-${room}`;
            if (!classroomsSet.has(key)) {
                classroomsSet.set(key, { building, room });
            }
        }
    });
    classroomsList = Array.from(classroomsSet.values()).sort((a, b) => {
        if (a.building < b.building) return -1;
        if (a.building > b.building) return 1;
        return a.room.localeCompare(b.room, undefined, { numeric: true });
    });

    populateProfessorDropdown();
    populateClassroomDropdown();
    populateScheduleClassroomDropdown();

    const onlineCount = timetableData.filter(i => i.day === 'ONLINE').length;
    console.log(`시간표 데이터 처리 완료: ${timetableData.length}개 강의, ${professorsList.length}명 교수 (온라인 ${onlineCount}개)`);

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

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            if (nav) nav.classList.remove('nav-open');
            sections.forEach(section => section.classList.add('section-hidden'));
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.remove('section-hidden');
            this.classList.add('active');
            initializeSection(targetId);
        });
    });

    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('nav-open');
        });
    }

    initializeSearchSection();
    initializeScheduleSection();
    initializeRouletteSection();
});

function initializeSection(sectionId) {
    switch(sectionId) {
        case 'home':
            updateRealTimeStatus();
            break;
        case 'heatmap':
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

function updateRealTimeStatus() {
    if (!timetableData || timetableData.length === 0) return;

    const now = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    // 1. 현재 사용 중인 강의실 정보 필터링
    const occupiedRooms = timetableData.filter(item => {
        return item.day === currentDay && item.start && item.end && currentTime >= item.start && currentTime < item.end;
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
                <div class="stat-number">${occupiedRoomKeys.size}</div>
                <div class="stat-label">사용 중</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${emptyRoomsCount}</div>
                <div class="stat-label">빈 강의실</div>
            </div>
            <div class="stat-card">
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
                <div class="building-details" id="details-${building}" style="display:none;">
                    ${occupiedCount > 0 ? `
                        <h4 class="details-subtitle">사용 중인 강의실</h4>
                        <div class="card-grid occupied-grid">
                            ${data.occupied.map(item => `
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
                    ` : ''}
                    ${emptyCount > 0 ? `
                        <h4 class="details-subtitle">빈 강의실</h4>
                        <div class="card-grid empty-grid">
                            ${data.empty.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(room => `
                                <div class="card empty-room-card" data-building="${building}" data-room="${room}">
                                    <div class="card-title">${room}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // 6. 생성된 건물 카드에 클릭 이벤트 리스너 추가
    document.querySelectorAll('.building-card').forEach(card => {
        card.onclick = function() {
            const building = card.dataset.building;
            const detailsDiv = document.getElementById(`details-${building}`);
            const arrow = card.querySelector('.arrow');
            const isHidden = detailsDiv.style.display === 'none';
            
            detailsDiv.style.display = isHidden ? 'block' : 'none';
            arrow.textContent = isHidden ? '▲' : '▼';
            card.classList.toggle('open', isHidden);
        };
    });
}

function populateProfessorDropdown() {
    const select = document.getElementById('professor-main-select');
    if (select) {
        select.innerHTML = '<option value="">교수님을 선택하세요</option>';
        professorsList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
    }
    const searchSelect = document.getElementById('professor-select');
    if (searchSelect) {
        searchSelect.innerHTML = '<option value="">교수님을 선택하세요</option>';
        professorsList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            searchSelect.appendChild(opt);
        });
    }
}

function populateClassroomDropdown() {
    const select = document.getElementById('classroom-select');
    if (select) {
        select.innerHTML = '<option value="">전체 강의실</option>';
        classroomsList.forEach(({building, room}) => {
            const opt = document.createElement('option');
            opt.value = `${building}-${room}`;
            opt.textContent = `${building} ${room}`;
            select.appendChild(opt);
        });
    }
}

function populateScheduleClassroomDropdown() {
    const select = document.getElementById('schedule-classroom-select');
    if (select) {
        select.innerHTML = '<option value="">강의실을 선택하세요</option>';
        classroomsList.forEach(({building, room}) => {
            const opt = document.createElement('option');
            opt.value = `${building}-${room}`;
            opt.textContent = `${building} ${room}`;
            select.appendChild(opt);
        });
    }
}

function initializeSearchSection() {
    const searchBtn = document.getElementById('search-button');
    if (!searchBtn) return;
    // 시간 버튼 클릭 시 select에 반영
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.onclick = function() {
            document.getElementById('time-select').value = btn.dataset.time;
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
    searchBtn.onclick = function() {
        const day = document.getElementById('day-select').value;
        const time = document.getElementById('time-select').value;
        const roomKey = document.getElementById('classroom-select').value;
        // 전체 강의실 목록 생성
        const allRoomKeys = classroomsList.map(({building, room}) => `${building}-${room}`);
        // 해당 시간에 사용 중인 강의실 목록
        let occupiedRoomKeys = timetableData.filter(item => {
            if (day && item.day !== day) return false;
            if (time && !(item.start <= time && time < item.end)) return false;
            if (roomKey && `${item.building_name}-${item.classroom}` !== roomKey) return false;
            return item.day !== 'ONLINE';
        }).map(item => `${item.building_name}-${item.classroom}`);
        // 빈 강의실 목록
        let emptyRooms = allRoomKeys.filter(key => !occupiedRoomKeys.includes(key));
        // 건물별 그룹화
        const grouped = {};
        emptyRooms.forEach(key => {
            const [building, room] = key.split('-');
            if (!grouped[building]) grouped[building] = [];
            grouped[building].push(room);
        });
        const container = document.getElementById('search-results');
        if (emptyRooms.length) {
            container.innerHTML = `<h3>빈 강의실 (${emptyRooms.length}개)</h3>` +
                Object.keys(grouped).map(building =>
                    `<div class="building-group">
                        <div class="building-title">${building}</div>
                        <div class="card-grid">
                            ${grouped[building].map(room =>
                                `<div class="card empty-room-card" data-building="${building}" data-room="${room}">
                                    <div class="card-title">${building} ${room}</div>
                                </div>`
                            ).join('')}
                        </div>
                    </div>`
                ).join('');
        } else {
            container.innerHTML = '<div class="card">검색 결과 없음</div>';
        }
        // 빈 강의실 카드 클릭 시 상세 팝업
        document.querySelectorAll('.empty-room-card').forEach(card => {
            card.onclick = function() {
                const building = card.dataset.building;
                const room = card.dataset.room;
                const timeVal = time;
                const dayVal = day;
                // 해당 강의실의 해당 시간대 사용 내역
                const used = timetableData.filter(item =>
                    item.building_name === building && item.classroom === room &&
                    (!dayVal || item.day === dayVal) && (!timeVal || (item.start <= timeVal && timeVal < item.end))
                );
                showRoomDetailModal(building, room, used, dayVal, timeVal);
            };
        });
    };

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

function initializeScheduleSection() {
    const typeSelect = document.getElementById('schedule-type');
    const queryInput = document.getElementById('schedule-query');
    const profSelect = document.getElementById('professor-select');
    const roomSelect = document.getElementById('schedule-classroom-select');
    const daySelect = document.getElementById('schedule-day-filter');
    const searchBtn = document.getElementById('schedule-search-button');
    const inputGroup = document.getElementById('search-input-group');
    const profGroup = document.getElementById('professor-select-group');
    const roomGroup = document.getElementById('schedule-classroom-select-group');
    const resultsContainer = document.getElementById('schedule-results');
    const onlineContainer = document.getElementById('online-courses-list');

    // 검색 유형에 따라 입력 필드 전환 및 placeholder 변경
    function updateInputFields() {
        const type = typeSelect.value;
        inputGroup.style.display = (type === 'subject' || type === 'professor' || type === 'department') ? '' : 'none';
        profGroup.style.display = (type === 'professor-timetable') ? '' : 'none';
        roomGroup.style.display = (type === 'classroom') ? '' : 'none';
        if (type === 'subject') queryInput.placeholder = '과목명을 입력하세요';
        else if (type === 'professor') queryInput.placeholder = '교수명을 입력하세요';
        else if (type === 'department') queryInput.placeholder = '학과/단과대명을 입력하세요';
        else queryInput.placeholder = '검색어 입력';
        // 모바일 UX: 입력 필드 focus 시 키보드 자동 활성화
        if(window.innerWidth < 768) {
            queryInput.setAttribute('inputmode','text');
            queryInput.setAttribute('autocomplete','on');
        }
    }
    typeSelect.onchange = updateInputFields;
    updateInputFields();

    // 검색 실행 함수
    function doSearch() {
        const type = typeSelect.value;
        const query = queryInput.value.trim();
        const prof = profSelect.value;
        const roomKey = roomSelect.value;
        const day = daySelect.value;
        let results = timetableData.filter(item => {
            if (type === 'subject' && query && !item.subject.includes(query)) return false;
            if (type === 'professor' && query && !item.professor.includes(query)) return false;
            if (type === 'department' && query && !item.department.includes(query)) return false;
            if (type === 'classroom' && roomKey && `${item.building_name}-${item.classroom}` !== roomKey) return false;
            if (type === 'professor-timetable' && prof && item.professor !== prof) return false;
            if (type === 'missing-professor' && item.professor) return false;
            if (day && item.day !== day) return false;
            return true;
        });

        // 결과 그룹화: 요일별 그룹
        if (results.length > 10) {
            const grouped = {};
            results.forEach(item => {
                if (!grouped[item.day]) grouped[item.day] = [];
                grouped[item.day].push(item);
            });
            resultsContainer.innerHTML = Object.keys(grouped).map(day =>
                `<div class="building-group">
                    <div class="building-title">${day}요일</div>
                    <div class="card-grid">
                        ${grouped[day].map(item =>
                            `<div class="card">
                                <div class="card-title">${item.subject} (${item.code})</div>
                                <div class="card-content">
                                    <b>교수:</b> ${getProfessorDisplay(item)}<br>
                                    <b>시간:</b> ${item.day} ${item.start}~${item.end}<br>
                                    <b>강의실:</b> ${getRoomDisplay(item)}<br>
                                    <b>학과:</b> ${item.department || '-'}
                                </div>
                            </div>`
                        ).join('')}
                    </div>
                </div>`
            ).join('');
        } else {
            resultsContainer.innerHTML = results.length ? results.map(item =>
                `<div class="card">
                    <div class="card-title">${item.subject} (${item.code})</div>
                    <div class="card-content">
                        <b>교수:</b> ${getProfessorDisplay(item)}<br>
                        <b>시간:</b> ${item.day} ${item.start}~${item.end}<br>
                        <b>강의실:</b> ${getRoomDisplay(item)}<br>
                        <b>학과:</b> ${item.department || '-'}
                    </div>
                </div>`
            ).join('') : '<div class="card">검색 결과 없음</div>';
        }

        // 온라인 강의 별도 표시
        const onlineList = timetableData.filter(i => i.day === 'ONLINE');
        onlineContainer.innerHTML = onlineList.length ?
            `<h3>온라인 강의</h3>` + onlineList.map(item =>
                `<div class="card">
                    <div class="card-title">${item.subject} (${item.code})</div>
                    <div class="card-content">
                        <b>교수:</b> ${getProfessorDisplay(item)}<br>
                        <b>강의실:</b> 온라인
                    </div>
                </div>`
            ).join('') : '';

        // 리셋 버튼 추가
        if (results.length === 0) {
            resultsContainer.innerHTML += '<button class="btn" id="schedule-reset-btn">리셋</button>';
            const resetBtn = document.getElementById('schedule-reset-btn');
            if (resetBtn) {
                resetBtn.onclick = function() {
                    queryInput.value = '';
                    profSelect.value = '';
                    roomSelect.value = '';
                    daySelect.value = '';
                    doSearch();
                };
            }
        }
    }

    // 검색 버튼, 엔터키 이벤트
    searchBtn.onclick = doSearch;
    queryInput.onkeydown = function(e) { if (e.key === 'Enter') doSearch(); };
    profSelect.onchange = doSearch;
    roomSelect.onchange = doSearch;
    daySelect.onchange = doSearch;
}

function initializeRouletteSection() {
    const btn = document.getElementById('roulette-button');
    if (!btn) return;
    btn.onclick = function() {
        const lunchList = [
            '김치찌개', '돈까스', '라면', '비빔밥', '제육볶음', '샐러드', '햄버거', '파스타', '우동', '초밥', '치킨', '피자', '떡볶이', '쌀국수', '카레', '냉면', '순두부찌개', '불고기', '샌드위치', '짜장면'
        ];
        const pick = lunchList[Math.floor(Math.random() * lunchList.length)];
        document.getElementById('roulette-result').innerHTML = `<div class="card"><div class="card-title">오늘의 점심 추천</div><div class="card-content">${pick}</div></div>`;
    };
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
        const teachingDays = [...new Set(classes.map(c => c.day))].filter(d => d !== 'ONLINE').join(', ');
        const mainBuilding = [...new Set(classes.map(c => c.building_name))].filter(b => b).join(', ');

        // 통계 및 시간표 템플릿
        resultsDiv.innerHTML = `
            <div class="timetable-stats">
                <div class="timetable-stat">
                    <div class="timetable-stat-number">${classes.length}</div>
                    <div class="timetable-stat-label">총 강의 수</div>
                </div>
                <div class="timetable-stat">
                    <div class="timetable-stat-number">${totalCredits}</div>
                    <div class="timetable-stat-label">총 학점</div>
                </div>
                <div class="timetable-stat">
                    <div class="timetable-stat-number">${teachingDays || '온라인'}</div>
                    <div class="timetable-stat-label">강의 요일</div>
                </div>
                <div class="timetable-stat">
                    <div class="timetable-stat-number">${mainBuilding || '없음'}</div>
                    <div class="timetable-stat-label">주 강의 건물</div>
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

function renderHeatmapChart() {
    const ctx = document.getElementById('heatmap-chart');
    if (!ctx) return;
    if (window.myHeatmapChart) {
        window.myHeatmapChart.destroy();
    }

    const days = ['월', '화', '수', '목', '금', '토'];
    const timeLabels = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
    const data = [];

    timeLabels.forEach((time, tIndex) => {
        days.forEach((day, dIndex) => {
            const dayKey = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dIndex];
            const count = timetableData.filter(item => {
                if (!item.start || !item.end) return false;
                const itemStartTime = parseInt(item.start.split(':')[0]);
                const itemEndTime = parseInt(item.end.split(':')[0]);
                return item.day === dayKey && 
                       itemStartTime <= parseInt(time) && 
                       parseInt(time) < itemEndTime;
            }).length;
            
            data.push({
                x: time + '시',
                y: day,
                v: count
            });
        });
    });

    window.myHeatmapChart = new Chart(ctx.getContext('2d'), {
        type: 'matrix',
        data: {
            datasets: [{
                label: '강의 수',
                data: data,
                backgroundColor(ctx) {
                    const value = ctx.dataset.data[ctx.dataIndex].v;
                    if (value === 0) return 'rgba(245, 245, 245, 0.8)';
                    const alpha = Math.min(0.2 + (value / 20), 1); // 20개 이상이면 최대 농도
                    return `rgba(102, 126, 234, ${alpha})`;
                },
                borderColor(ctx) {
                    const value = ctx.dataset.data[ctx.dataIndex].v;
                    const alpha = Math.min(0.4 + (value / 20), 1);
                    return `rgba(102, 126, 234, ${alpha})`;
                },
                borderWidth: 1,
                width: ({chart}) => (chart.chartArea || {}).width / timeLabels.length - 1,
                height: ({chart}) => (chart.chartArea || {}).height / days.length - 1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                            const item = context.dataset.data[context.dataIndex];
                            return `${item.y}요일 ${item.x}: ${item.v}개 강의`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: timeLabels.map(t => t + '시'),
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: days,
                    offset: true,
                    grid: { display: false }
                }
            }
        }
    });
}

// (This is a simplified representation)

function generateVisualTimetable(classes, titleName) {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const timeSlots = 18; // 9:00 ~ 17:30 (30분 단위)

    let tableHtml = `
        <div class="timetable-container">
            <div class="timetable-header"><h3>${titleName}</h3></div>
            <div class="timetable-scale-wrap">
                <div class="timetable-grid-30">
    `;

    // 1. 헤더 행 (요일) - 위치 명시
    tableHtml += `<div class="timetable-header-cell" style="grid-column: 1; grid-row: 1;"></div>`;
    days.forEach((day, index) => {
        tableHtml += `<div class="timetable-header-cell" style="grid-column: ${index + 2}; grid-row: 1;">${day}</div>`;
    });

    // 2. 시간 레이블 열 - 위치 명시
    for (let i = 0; i < timeSlots; i++) {
        if (i % 2 === 0) { // 매 시간 정각마다
            const hour = 9 + Math.floor(i / 2);
            const row = i + 2;
            tableHtml += `<div class="time-label" style="grid-column: 1; grid-row: ${row} / span 2;">${hour}:00</div>`;
        }
    }

    // 3. 배경 '공강' 블록 - 위치 명시
    for (let d = 0; d < days.length; d++) {
        for (let t = 0; t < timeSlots; t++) {
            tableHtml += `
                <div class="empty-slot-block" style="grid-column: ${d + 2}; grid-row: ${t + 2};">
                    <span class="empty-slot-text">공강</span>
                </div>
            `;
        }
    }

    // 4. 강의 블록 (덮어쓰기) - 위치 명시
    classes.forEach(c => {
        const dayIndex = days.indexOf(c.day);
        if (dayIndex === -1) return;

        const start = new Date(`1970-01-01T${c.start}:00`);
        const end = new Date(`1970-01-01T${c.end}:00`);
        const durationMinutes = (end - start) / 60000;

        if (isNaN(durationMinutes) || durationMinutes <= 0) return; // 유효하지 않은 시간 데이터 예외 처리

        const startRow = ((start.getHours() - 9) * 2) + (start.getMinutes() / 30) + 2;
        const rowSpan = Math.round(durationMinutes / 30);

        tableHtml += `
            <div class="class-block" style="grid-column: ${dayIndex + 2}; grid-row: ${startRow} / span ${rowSpan}; z-index: 10;">
                <div class="class-subject">${c.subject}</div>
                <div class="class-room">${getRoomDisplay(c)}</div>
            </div>
        `;
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

            // 잠시 후 계산하여 렌더링 시간을 확보
            setTimeout(() => {
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
            }, 50); // 50ms 딜레이로 안정성 확보
        }
    });
}

// 창 크기 변경 시 시간표 스케일 재조정
window.addEventListener('resize', applyAllTimetablesScale);
