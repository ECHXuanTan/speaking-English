// Supervisor dashboard functionality with integrated monitoring

// Monitoring variables
let currentExamId = null;
let participants = [];
let monitoringInterval = null;
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!Auth.isAuthenticated()) {
        window.location.href = '/supervisor/login.html';
        return;
    }

    const userInfo = Auth.getUserInfo();
    if (!userInfo || userInfo.role !== 'supervisor') {
        window.location.href = '/supervisor/login.html';
        return;
    }

    // Initialize dashboard
    initializeDashboard();
    loadExams();
    setupEventListeners();
    
    // Check for exam parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const examParam = urlParams.get('exam');
    if (examParam) {
        setTimeout(() => {
            document.getElementById('examSelector').value = examParam;
            selectExam(examParam);
        }, 1000);
    }
});

function initializeDashboard() {
    const userInfo = Auth.getUserInfo();
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (userInfo && userInfo.full_name) {
        welcomeMessage.textContent = `Chào mừng, ${userInfo.full_name}!`;
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Monitoring controls
    document.getElementById('examSelector').addEventListener('change', handleExamSelection);
    document.getElementById('exportCurrentBtn').addEventListener('click', exportCurrentExam);

    // Search
    document.getElementById('participantSearchInput').addEventListener('input', filterParticipants);

    // Audio modal
    document.getElementById('closeAudioModalBtn').addEventListener('click', closeAudioModal);
    document.getElementById('closeAudioBtn').addEventListener('click', closeAudioModal);
    document.getElementById('downloadAudioBtn').addEventListener('click', downloadCurrentAudio);
    document.getElementById('playFromStartBtn').addEventListener('click', playFromStart);

    // Reset modal
    document.getElementById('closeResetModalBtn').addEventListener('click', closeResetModal);
    document.getElementById('cancelResetBtn').addEventListener('click', closeResetModal);
    document.getElementById('confirmResetBtn').addEventListener('click', confirmResetParticipant);

    // Window events
    window.addEventListener('beforeunload', cleanup);
}

async function loadExams() {
    try {
        const response = await Utils.apiRequest('/api/supervisor/exams');
        
        if (response.success) {
            const examSelector = document.getElementById('examSelector');
            examSelector.innerHTML = '<option value="">Chọn kỳ thi để giám sát...</option>';
            
            response.data.items.forEach(exam => {
                const option = document.createElement('option');
                option.value = exam.id;
                option.textContent = `${exam.exam_name}`;
                examSelector.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading exams:', error);
        Utils.showAlert('Lỗi tải danh sách kỳ thi', 'error');
    }
}

async function handleLogout() {
    try {
        cleanup();
        
        const response = await Utils.apiRequest('/api/auth/logout', {
            method: 'POST'
        });

        if (response.success) {
            Auth.clearAuth();
            Utils.showAlert('Đăng xuất thành công!', 'success');
            
            setTimeout(() => {
                window.location.href = '/supervisor/login.html';
            }, 1500);
        } else {
            Utils.showAlert(response.message || 'Đăng xuất thất bại', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Force logout on client side even if server call fails
        Auth.clearAuth();
        window.location.href = '/supervisor/login.html';
    }
}

// ===== MONITORING FUNCTIONS =====

function handleExamSelection() {
    const examId = document.getElementById('examSelector').value;
    if (examId) {
        selectExam(examId);
    } else {
        hideMonitoring();
    }
}

async function selectExam(examId) {
    currentExamId = examId;
    
    try {
        // Load participants and exam info together
        await loadParticipants();
        
        // Show monitoring interface
        showMonitoring();
        
        // Start real-time updates
        startRealTimeUpdates();
        
        // Initialize Socket.IO connection
        initializeSocket();
        
    } catch (error) {
        console.error('Error selecting exam:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

function updateExamInfo(exam) {
    document.getElementById('examTitle').textContent = exam.exam_name;
    document.getElementById('examStatus').textContent = getStatusText(exam.status || 'draft');
    document.getElementById('examStatus').className = `exam-status ${exam.status || 'draft'}`;
    
    document.getElementById('totalQuestions').textContent = exam.total_questions;
    document.getElementById('preparationTime').textContent = `${exam.preparation_time}s`;
    document.getElementById('examDuration').textContent = `${exam.exam_duration}s`;
}

async function loadParticipants() {
    try {
        const response = await Utils.apiRequest(`/api/supervisor/exams/${currentExamId}/monitoring`);
        
        if (response.success) {
            participants = response.data.participants || [];
            
            // Update exam info if available
            if (response.data.exam) {
                updateExamInfo(response.data.exam);
            }
            
            updateRealTimeStats();
            renderParticipantsTable();
            document.getElementById('exportCurrentBtn').disabled = false;
        } else {
            Utils.showAlert('Lỗi tải danh sách thí sinh', 'error');
        }
    } catch (error) {
        console.error('Error loading participants:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

function updateRealTimeStats() {
    const waiting = participants.filter(p => p.status === 'waiting').length;
    const inProgress = participants.filter(p => p.status === 'in_progress').length;
    const completed = participants.filter(p => p.status === 'completed').length;
    const total = participants.length;

    document.getElementById('waitingCount').textContent = waiting;
    document.getElementById('inProgressCount').textContent = inProgress;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('totalCount').textContent = total;
    
    
}

function renderParticipantsTable() {
    const tbody = document.getElementById('participantsTableBody');
    const searchTerm = document.getElementById('participantSearchInput').value.toLowerCase();

    // Filter participants
    let filteredParticipants = participants.filter(participant => {
        const matchesSearch = !searchTerm || 
            participant.student.full_name.toLowerCase().includes(searchTerm) ||
            participant.student.student_code.toLowerCase().includes(searchTerm);

        return matchesSearch;
    });

    // Update participant count
    document.getElementById('participantCount').textContent = filteredParticipants.length;

    // Render table rows
    tbody.innerHTML = '';
    
    if (filteredParticipants.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-user-graduate"></i>
                        <p>Không có thí sinh nào</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    filteredParticipants.forEach(participant => {
        const row = document.createElement('tr');
        row.className = `participant-row status-${participant.status}`;
        
        row.innerHTML = `
            <td>
                <div class="participant-info">
                    <div class="participant-name">${participant.student.full_name}</div>
                </div>
            </td>
            <td class="font-weight-bold">${participant.student.student_code}</td>
            <td>
                <span class="question-badge">${participant.question_number ? `Đề ${participant.question_number}` : 'Chưa tạo'}</span>
            </td>
            <td>
                <span class="status-badge ${participant.status}">
                    ${getStatusText(participant.status)}
                    ${participant.status === 'in_progress' ? '<i class="fas fa-spinner fa-spin"></i>' : ''}
                </span>
            </td>
            <td>${participant.start_time ? Utils.formatDateTime(participant.start_time) : '--'}</td>
            <td>${participant.submit_time ? Utils.formatDateTime(participant.submit_time) : '--'}</td>
            <td>
                <div class="action-buttons">
                    ${participant.audio_file_path ? `
                        <button class="btn btn-sm btn-info" onclick="previewAudio(${participant.id})" title="Nghe bài thi">
                            <i class="fas fa-headphones"></i>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="downloadAudio(${participant.id})" title="Tải về">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                    ${participant.status !== 'in_progress' ? `
                        <button class="btn btn-sm btn-warning" onclick="resetParticipant(${participant.id})" title="Reset lần làm bài">
                            <i class="fas fa-redo-alt"></i>
                        </button>
                    ` : ''}

                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getStatusText(status) {
    switch (status) {
        case 'waiting': return 'Chờ thi';
        case 'in_progress': return 'Đang thi';
        case 'completed': return 'Hoàn thành';
        case 'active': return 'Đang diễn ra';
        case 'draft': return 'Nháp';
        default: return status;
    }
}

function filterParticipants() {
    renderParticipantsTable();
}



function showMonitoring() {
    document.getElementById('examInfoPanel').style.display = 'block';
    document.getElementById('monitoringControls').style.display = 'block';
    document.getElementById('participantsTable').style.display = 'block';
}

function hideMonitoring() {
    document.getElementById('examInfoPanel').style.display = 'none';
    document.getElementById('monitoringControls').style.display = 'none';
    document.getElementById('participantsTable').style.display = 'none';
    document.getElementById('exportCurrentBtn').disabled = true;
    
    cleanup();
}

function startRealTimeUpdates() {
    // Clear existing interval
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    // Update every 10 seconds
    monitoringInterval = setInterval(async () => {
        if (currentExamId) {
            await loadParticipants();
        }
    }, 10000);
}

function initializeSocket() {
    if (typeof io === 'undefined') {
        console.log('Socket.IO not available');
        return;
    }
    
    if (socket) {
        socket.disconnect();
    }

    // Initialize Socket.IO connection
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to monitoring socket');
        // Join exam room for real-time updates
        socket.emit('join_exam_monitoring', { exam_id: currentExamId });
    });

    socket.on('exam_status_update', (data) => {
        if (data.exam_id == currentExamId) {
            // Update specific participant
            const participantIndex = participants.findIndex(p => p.id === data.participant_id);
            if (participantIndex !== -1) {
                participants[participantIndex] = { ...participants[participantIndex], ...data.updates };
                updateRealTimeStats();
                renderParticipantsTable();
            }
        }
    });

    socket.on('student_joined', (data) => {
        console.log('Student joined exam:', data);
        loadParticipants(); // Refresh the whole list
    });

    socket.on('recording_started', (data) => {
        console.log('Recording started:', data);
        if (data.exam_id == currentExamId) {
            loadParticipants();
        }
    });

    socket.on('exam_submitted', (data) => {
        console.log('Exam submitted:', data);
        if (data.exam_id == currentExamId) {
            loadParticipants();
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from monitoring socket');
    });
}



// ===== AUDIO FUNCTIONS =====
async function previewAudio(participantId) {
    const participant = participants.find(p => p.id === participantId);
    if (!participant || !participant.audio_file_path) return;

    try {
        // Update modal info
        document.getElementById('audioModalTitle').textContent = 'Nghe Bài Thi';
        document.getElementById('audioStudentName').textContent = participant.student.full_name;
        document.getElementById('audioStudentCode').textContent = participant.student.student_code;
        document.getElementById('audioQuestionNumber').innerHTML = `Đề số: <strong>${participant.question_number}</strong>`;
        document.getElementById('audioSubmitTime').textContent = participant.submit_time ? 
            Utils.formatDateTime(participant.submit_time) : '--';
        // Luôn hiển thị extension .mp3 bất kể định dạng file gốc
        const originalFileName = participant.audio_file_path.split('/').pop();
        const fileNameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "");
        document.getElementById('audioFileName').textContent = fileNameWithoutExt + '.mp3';

        // Set audio source
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.src = `/api/supervisor/exams/${currentExamId}/audio/${participantId}`;
        
        // Add error handler for authentication issues
        audioPlayer.onerror = function() {
            // Check if error is likely due to authentication
            fetch(audioPlayer.src, { method: 'HEAD' })
                .then(response => {
                    if (response.status === 401 || response.status === 403) {
                        Auth.clearAuth();
                        sessionStorage.setItem('auth_message', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
                        window.location.href = '/supervisor/login.html';
                    } else {
                        Utils.showAlert('Lỗi tải file audio', 'error');
                    }
                })
                .catch(() => {
                    Utils.showAlert('Lỗi tải file audio', 'error');
                });
        };
        
        // Store current participant for download
        audioPlayer.setAttribute('data-participant-id', participantId);
        
        // Show modal
        document.getElementById('audioModal').style.display = 'flex';

    } catch (error) {
        console.error('Error previewing audio:', error);
        Utils.showAlert('Lỗi phát audio', 'error');
    }
}

function closeAudioModal() {
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.pause();
    audioPlayer.src = '';
    document.getElementById('audioModal').style.display = 'none';
}

async function downloadAudio(participantId) {
    try {
        const participant = participants.find(p => p.id === participantId);
        const filename = `${participant.student.student_code}.mp3`;
        
        const success = await Utils.downloadFile(`/api/supervisor/exams/${currentExamId}/audio/${participantId}`, filename);
        
        if (success) {
            Utils.showAlert('Tải file thành công!', 'success');
        }

    } catch (error) {
        console.error('Error downloading audio:', error);
        Utils.showAlert('Lỗi tải file audio', 'error');
    }
}

function downloadCurrentAudio() {
    const audioPlayer = document.getElementById('audioPlayer');
    const participantId = audioPlayer.getAttribute('data-participant-id');
    if (participantId) {
        downloadAudio(parseInt(participantId));
    }
}

function playFromStart() {
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.currentTime = 0;
    audioPlayer.play();
}

async function exportCurrentExam() {
    if (!currentExamId) return;

    try {
        Utils.showLoading(document.getElementById('exportCurrentBtn'), 'Đang tải audio...');
        
        const filename = `audio_exam_${currentExamId}_${new Date().toISOString().split('T')[0]}.zip`;
        const success = await Utils.downloadFile(`/api/supervisor/exams/${currentExamId}/export`, filename);
        
        if (success) {
            Utils.showAlert('Tải file audio thành công!', 'success');
        }

    } catch (error) {
        console.error('Error exporting audio files:', error);
        Utils.showAlert('Lỗi tải file audio', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('exportCurrentBtn'), '<i class="fas fa-download"></i> Tải file audio');
    }
}

function cleanup() {
    // Clear monitoring interval
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    // Disconnect socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// ===== RESET FUNCTIONS =====
function resetParticipant(participantId) {
    const participant = participants.find(p => p.id === participantId);
    if (!participant) return;

    // Kiểm tra trạng thái
    if (participant.status === 'in_progress') {
        Utils.showAlert('Không thể reset khi học sinh đang thi!', 'warning');
        return;
    }

    // Update modal info
    document.getElementById('resetStudentName').textContent = participant.student.full_name;
    document.getElementById('resetStudentCode').textContent = participant.student.student_code;
    document.getElementById('resetQuestionNumber').innerHTML = `Đề số hiện tại: <strong>${participant.question_number || 'Chưa có'}</strong>`;
    document.getElementById('resetCurrentStatus').innerHTML = `Trạng thái: <strong>${getStatusText(participant.status)}</strong>`;
    
    // Store participant ID for confirmation
    document.getElementById('confirmResetBtn').setAttribute('data-participant-id', participantId);
    
    // Show modal
    document.getElementById('resetModal').style.display = 'flex';
}

function closeResetModal() {
    document.getElementById('resetModal').style.display = 'none';
}

async function confirmResetParticipant() {
    const confirmBtn = document.getElementById('confirmResetBtn');
    const participantId = parseInt(confirmBtn.getAttribute('data-participant-id'));
    
    if (!participantId) return;

    try {
        Utils.showLoading(confirmBtn, 'Đang reset...');
        
        const url = `/api/supervisor/participants/${participantId}/reset`;
        const response = await Utils.apiRequest(url, {
            method: 'DELETE'
        });

        if (response.success) {
            Utils.showAlert(response.message, 'success');
            closeResetModal();
            // Refresh participants table
            await loadParticipants();
        } else {
            Utils.showAlert(response.message || 'Lỗi reset lần làm bài', 'error');
        }
    } catch (error) {
        console.error('Error resetting participant:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(confirmBtn, '<i class="fas fa-redo-alt"></i> Xác nhận Reset');
    }
}

// Make functions globally available for onclick handlers
window.previewAudio = previewAudio;
window.downloadAudio = downloadAudio;
window.resetParticipant = resetParticipant;
