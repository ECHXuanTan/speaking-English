// Student exam functionality - Handle exam taking process

let socket = null;
let examData = null;
let participantId = null;
let currentQuestion = null; // Thông tin đề thi đã được random
let currentPhase = 'loading'; // loading, exam_info, preparation, recording, submitting, completed
let countdownInterval = null;
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let examStartTime = null;
let preparationStartTime = null;
let recordingStartTime = null;
let isEarlyStart = false;
let remainingTotalTime = null;

// Waveform visualization variables
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let waveBars = [];
let animationId = null;

// Phase elements
let loadingPhase, examInfoPhase, preparationPhase, recordingPhase, submittingPhase, completedPhase;
let confirmModal, navigationWarning;

// Timer elements
let currentPhaseElement;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!Auth.isAuthenticated()) {
        window.location.href = '/student/login.html';
        return;
    }

    // Initialize exam page
    initializeElements();
    initializeSocket();
    initializeNavigation();
    
    // Get participant ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    participantId = urlParams.get('participant');
    
    if (!participantId) {
        Utils.showAlert('Không tìm thấy thông tin kỳ thi', 'error');
        setTimeout(() => {
            window.location.href = '/student/dashboard.html';
        }, 2000);
        return;
    }

    // Load exam data
    await loadExamData();
});

function initializeElements() {
    // Phase containers
    loadingPhase = document.getElementById('loadingPhase');
    examInfoPhase = document.getElementById('examInfoPhase');
    preparationPhase = document.getElementById('preparationPhase');
    recordingPhase = document.getElementById('recordingPhase');
    submittingPhase = document.getElementById('submittingPhase');
    completedPhase = document.getElementById('completedPhase');
    
    // Modals
    confirmModal = document.getElementById('confirmModal');
    navigationWarning = document.getElementById('navigationWarning');
    
    // Timer elements
    currentPhaseElement = document.getElementById('currentPhase');
}

function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('authenticate', { token: Auth.getToken() });
    });
    
    socket.on('authenticated', (data) => {
        if (data.success) {
            console.log('Socket authenticated');
            if (participantId) {
                socket.emit('join_exam', { participantId: parseInt(participantId) });
            }
        }
    });
    
    socket.on('exam_status_update', (data) => {
        console.log('Exam status update:', data);
        handleExamStatusUpdate(data);
    });
    
    socket.on('time_warning', (data) => {
        console.log('Time warning:', data);
        handleTimeWarning(data);
    });
    
    socket.on('auto_submit', (data) => {
        console.log('Auto submit triggered:', data);
        handleAutoSubmit();
    });
}

function initializeNavigation() {
    // Prevent back navigation
    window.addEventListener('beforeunload', (e) => {
        if (currentPhase === 'preparation' || currentPhase === 'recording') {
            e.preventDefault();
            e.returnValue = 'Bạn đang trong quá trình làm bài thi. Rời khỏi trang sẽ làm mất dữ liệu.';
        }
    });
    
    // Prevent back button
    window.addEventListener('popstate', (e) => {
        if (currentPhase === 'preparation' || currentPhase === 'recording') {
            showNavigationWarning();
            history.pushState(null, null, location.href);
        }
    });
    
    // Push initial state to prevent back navigation
    history.pushState(null, null, location.href);
}

async function loadExamData() {
    try {
        showPhase('loading');
        
        // Reset early start variables
        isEarlyStart = false;
        remainingTotalTime = null;
        
        const response = await fetch(`/api/student/exam/${participantId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Không thể tải thông tin kỳ thi');
        }
        
        examData = result.data.exam;
        updateExamInfo();
        
        // Determine current phase based on exam status
        switch (examData.status) {
            case 'waiting':
                if (examData.question) {
                    // Đã có đề thi (từ dashboard), tự động bắt đầu thi ngay
                    Utils.showAlert('Đang bắt đầu bài thi...', 'info');
                    await startExam();
                } else {
                    // Chưa có đề, hiển thị trang exam_info để random đề
                    showPhase('exam_info');
                }
                break;
            case 'in_progress':
                // Calculate if we're in preparation or recording phase
                await handleInProgressExam();
                break;
            case 'completed':
                showPhase('completed');
                updateCompletedInfo();
                break;
            default:
                throw new Error('Trạng thái kỳ thi không hợp lệ');
        }
        
    } catch (error) {
        console.error('Load exam data error:', error);
        Utils.showAlert(error.message, 'error');
        setTimeout(() => {
            window.location.href = '/student/dashboard.html';
        }, 3000);
    }
}

function updateExamInfo() {
    const userInfo = Auth.getUserInfo();

    // Update header
    document.getElementById('examTitle').textContent = examData.exam_name;

    // Check if userInfo exists and has required fields
    if (userInfo && userInfo.fullName && userInfo.studentCode) {
        document.getElementById('studentInfo').textContent = `Học sinh: ${userInfo.fullName} (${userInfo.studentCode})`;
    } else {
        // Fallback if userInfo is missing or incomplete
        document.getElementById('studentInfo').textContent = 'Học sinh: --';
    }

    // Update exam info phase
    document.getElementById('examName').textContent = examData.exam_name;
    document.getElementById('preparationTime').textContent = Math.floor(examData.preparation_time / 60);
    document.getElementById('examDuration').textContent = Math.floor(examData.exam_duration / 60);
    document.getElementById('prepTimeText').textContent = Math.floor(examData.preparation_time / 60);
    document.getElementById('examTimeText').textContent = Math.floor(examData.exam_duration / 60);

    // Update question info if already has question
    if (examData.question) {
        currentQuestion = examData.question;
        updateQuestionDisplay();

        // Disable random button since question already exists
        const randomBtn = document.getElementById('randomQuestionBtn');
        randomBtn.disabled = true;
        randomBtn.innerHTML = '<i class="fas fa-check"></i> Đã Random Đề Thi';

        // Enable start button if question already exists and status is waiting
        if (examData.status === 'waiting') {
            document.getElementById('startExamBtn').disabled = false;
            document.querySelector('#startExamBtn + small').textContent = 'Sẵn sàng để bắt đầu làm bài';
        }
    }
}

function updateQuestionDisplay() {
    if (!currentQuestion) return;

    const questionCode = currentQuestion.question_code;
    const pdfUrl = currentQuestion.pdf_drive_url;

    // Update all question code displays
    document.getElementById('questionCode').textContent = questionCode;
    document.getElementById('prepQuestionCode').textContent = questionCode;
    document.getElementById('recordQuestionCode').textContent = questionCode;
    document.getElementById('completedQuestionCode').textContent = questionCode;

    // Only update PDF viewers if not in exam_info phase
    // PDF should only be shown after student clicks "Start Exam"
    if (pdfUrl && currentPhase !== 'exam_info') {
        document.getElementById('prepPdfViewer').src = pdfUrl;
        document.getElementById('recordPdfViewer').src = pdfUrl;
    }

    // Show question info section
    document.getElementById('questionInfoSection').classList.remove('hidden');
}

async function handleInProgressExam() {
    if (!examData.start_time) {
        throw new Error('Thông tin thời gian bắt đầu không hợp lệ');
    }
    
    const startTime = new Date(examData.start_time).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    
    // Tính tổng thời gian exam (preparation + recording)
    const totalExamTime = examData.preparation_time + examData.exam_duration;
    
    if (elapsed < examData.preparation_time) {
        // Still in preparation phase
        showPhase('preparation');
        startPreparationCountdown(examData.preparation_time - elapsed);
    } else if (elapsed < totalExamTime) {
        // In recording phase
        showPhase('recording');
        await startRecording();
        const remainingRecordingTime = totalExamTime - elapsed;
        startRecordingCountdown(remainingRecordingTime);
    } else {
        // Time exceeded, should auto-submit
        Utils.showAlert('Thời gian làm bài đã hết, đang tự động nộp bài...', 'warning');
        await handleAutoSubmit();
    }
}

function showPhase(phase) {
    // Hide all phases
    [loadingPhase, examInfoPhase, preparationPhase, recordingPhase, submittingPhase, completedPhase].forEach(el => {
        if (el) el.classList.add('hidden');
    });
    
    // Show current phase
    currentPhase = phase;
    
    switch (phase) {
        case 'loading':
            loadingPhase?.classList.remove('hidden');
            currentPhaseElement.textContent = 'Đang tải';
            currentPhaseElement.className = 'badge badge-info';
            break;
        case 'exam_info':
            examInfoPhase?.classList.remove('hidden');
            currentPhaseElement.textContent = 'Chuẩn bị';
            currentPhaseElement.className = 'badge badge-info';
            break;
        case 'preparation':
            preparationPhase?.classList.remove('hidden');
            currentPhaseElement.textContent = 'Chuẩn bị';
            currentPhaseElement.className = 'badge badge-warning';
            break;
        case 'recording':
            recordingPhase?.classList.remove('hidden');
            currentPhaseElement.textContent = 'Đang thi';
            currentPhaseElement.className = 'badge badge-danger';
            break;
        case 'submitting':
            submittingPhase?.classList.remove('hidden');
            currentPhaseElement.textContent = 'Nộp bài';
            currentPhaseElement.className = 'badge badge-info';
            break;
        case 'completed':
            completedPhase?.classList.remove('hidden');
            currentPhaseElement.textContent = 'Hoàn thành';
            currentPhaseElement.className = 'badge badge-success';
            break;
    }
}

// Random Question Function
async function randomQuestion() {
    const randomBtn = document.getElementById('randomQuestionBtn');
    let success = false;

    try {
        Utils.showLoading(randomBtn, 'Đang random...');

        const response = await fetch(`/api/student/exam/${participantId}/random-question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Không thể random đề thi');
        }

        currentQuestion = result.data.question;
        updateQuestionDisplay();

        Utils.showAlert(`Đã random đề thi: ${currentQuestion.question_code}`, 'success');

        // Enable start exam button after random
        document.getElementById('startExamBtn').disabled = false;
        document.querySelector('#startExamBtn + small').textContent = 'Sẵn sàng để bắt đầu làm bài';

        // Disable random button after successfully randomizing
        randomBtn.disabled = true;
        randomBtn.innerHTML = '<i class="fas fa-check"></i> Đã Random Đề Thi';

        success = true;

    } catch (error) {
        console.error('Random question error:', error);
        Utils.showAlert(error.message, 'error');
        // Only restore button if failed
        if (!success) {
            Utils.hideLoading(randomBtn, '<i class="fas fa-random"></i> Random Đề Thi');
        }
    }
}

function confirmStartExam() {
    // Check if question has been randomized
    if (!currentQuestion) {
        Utils.showAlert('Vui lòng random đề thi trước khi bắt đầu!', 'warning');
        return;
    }

    showConfirmModal(
        'Xác nhận bắt đầu thi',
        'Bạn có chắc chắn muốn bắt đầu làm bài thi? Sau khi bắt đầu, bạn không thể thoát khỏi trang thi.',
        async () => {
            await startExam();
        }
    );
}

async function startExam() {
    try {
        // Close modal if it was opened
        if (confirmModal && !confirmModal.classList.contains('hidden')) {
            closeConfirmModal();
        }

        // Reset early start variables
        isEarlyStart = false;
        remainingTotalTime = null;

        // Clear any existing countdown
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        const response = await fetch(`/api/student/exam/${participantId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Không thể bắt đầu bài thi');
        }

        examStartTime = new Date(result.data.start_time).getTime();
        examData.status = 'in_progress';
        examData.start_time = result.data.start_time;

        showPhase('preparation');

        // Load PDF into preparation and recording phases
        if (currentQuestion && currentQuestion.pdf_drive_url) {
            document.getElementById('prepPdfViewer').src = currentQuestion.pdf_drive_url;
            document.getElementById('recordPdfViewer').src = currentQuestion.pdf_drive_url;
        }

        startPreparationCountdown(examData.preparation_time);

        Utils.showAlert('Bài thi đã bắt đầu. Thời gian chuẩn bị: ' + Math.floor(examData.preparation_time / 60) + ' phút', 'success');

    } catch (error) {
        console.error('Start exam error:', error);
        Utils.showAlert(error.message, 'error');
    }
}

function startPreparationCountdown(initialSeconds) {
    let remainingSeconds = initialSeconds;
    
    updateCountdownDisplay('preparationCountdown', remainingSeconds);
    
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        updateCountdownDisplay('preparationCountdown', remainingSeconds);
        
        if (remainingSeconds <= 30) {
            document.getElementById('preparationCountdown').classList.add('warning');
        }
        
        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            transitionToRecording();
        }
    }, 1000);
}

async function transitionToRecording() {
    try {
        showPhase('recording');
        await startRecording();
        
        // Sử dụng thời gian recording bình thường nếu không bắt đầu sớm
        const recordingTime = isEarlyStart ? remainingTotalTime : examData.exam_duration;
        startRecordingCountdown(recordingTime);
        
        Utils.showAlert('Bắt đầu ghi âm bài làm!', 'info');
        
    } catch (error) {
        console.error('Transition to recording error:', error);
        Utils.showAlert('Lỗi bắt đầu ghi âm: ' + error.message, 'error');
    }
}

function confirmEarlyStart() {
    showConfirmModal(
        'Xác nhận bắt đầu sớm',
        'Bạn có chắc chắn muốn bắt đầu ghi âm ngay bây giờ?',
        async () => {
            await startEarlyRecording();
        }
    );
}

async function startEarlyRecording() {
    try {
        closeConfirmModal();
        isEarlyStart = true;
        
        // Sử dụng thời gian ghi âm đúng theo API (không cộng thêm thời gian chuẩn bị)
        remainingTotalTime = examData.exam_duration;
        
        // Dừng countdown chuẩn bị
        clearInterval(countdownInterval);
        
        // Chuyển sang giai đoạn ghi âm
        showPhase('recording');
        await startRecording();
        startRecordingCountdown(remainingTotalTime);
        
        Utils.showAlert('Bắt đầu ghi âm sớm! Thời gian ghi âm: ' + Math.floor(remainingTotalTime / 60) + ' phút', 'success');
        
    } catch (error) {
        console.error('Start early recording error:', error);
        Utils.showAlert('Lỗi bắt đầu ghi âm sớm: ' + error.message, 'error');
    }
}

function startRecordingCountdown(initialSeconds) {
    let remainingSeconds = initialSeconds;
    
    updateCountdownDisplay('recordingCountdown', remainingSeconds);
    
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        updateCountdownDisplay('recordingCountdown', remainingSeconds);
        
        if (remainingSeconds <= 30) {
            document.getElementById('recordingCountdown').classList.add('warning');
        }
        
        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            handleAutoSubmit();
        }
    }, 1000);
}

async function startRecording() {
    try {
        // Request microphone permission
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        recordedChunks = [];
        
        const options = {
            mimeType: 'audio/webm;codecs=opus'
        };
        
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'audio/webm';
        }
        
        mediaRecorder = new MediaRecorder(mediaStream, options);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('Recording stopped');
            stopWaveformVisualization();
        };
        
        mediaRecorder.start();
        recordingStartTime = Date.now();
        
        // Setup audio visualization
        await setupAudioVisualization();
        
        console.log('Recording started');
        
    } catch (error) {
        throw new Error('Không thể bắt đầu ghi âm: ' + error.message);
    }
}

function stopRecording() {
    return new Promise((resolve) => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.onstop = () => {
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
                resolve();
            };
            mediaRecorder.stop();
        } else {
            resolve();
        }
    });
}

function confirmEarlySubmit() {
    showConfirmModal(
        'Xác nhận nộp bài sớm',
        'Bạn có chắc chắn muốn nộp bài ngay bây giờ? Bạn sẽ không thể tiếp tục làm bài sau khi nộp.',
        async () => {
            await submitExam();
        }
    );
}

async function submitExam() {
    try {
        closeConfirmModal();
        clearInterval(countdownInterval);
        
        showPhase('submitting');
        
        await stopRecording();
        
        if (recordedChunks.length === 0) {
            throw new Error('Không có dữ liệu âm thanh để nộp');
        }
        
        // Create audio blob
        const audioBlob = new Blob(recordedChunks, { 
            type: 'audio/webm'
        });
        
        // Create form data
        const formData = new FormData();
        formData.append('audio', audioBlob, `exam_${participantId}_${Date.now()}.webm`);
        
        const response = await fetch(`/api/student/exam/${participantId}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Không thể nộp bài');
        }
        
        examData.status = 'completed';
        examData.submit_time = result.data.submit_time;
        
        showPhase('completed');
        updateCompletedInfo();
        
        Utils.showAlert('Nộp bài thành công!', 'success');
        
    } catch (error) {
        console.error('Submit exam error:', error);
        Utils.showAlert('Lỗi nộp bài: ' + error.message, 'error');
        
        // Return to recording phase if submit failed
        if (currentPhase === 'submitting') {
            showPhase('recording');
        }
    }
}

async function handleAutoSubmit() {
    Utils.showAlert('Hết thời gian! Đang tự động nộp bài...', 'warning');
    await submitExam();
}

function updateCompletedInfo() {
    if (examData.submit_time) {
        document.getElementById('submitTime').textContent = new Date(examData.submit_time).toLocaleString('vi-VN');
    }
}

function updateCountdownDisplay(elementId, seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = display;
    }
}





function returnToDashboard() {
    window.location.href = '/student/dashboard.html';
}

// Modal functions
function showConfirmModal(title, message, confirmCallback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmBtn').onclick = confirmCallback;
    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    confirmModal.classList.add('hidden');
}

function executeConfirmedAction() {
    // This will be overridden by the onclick in showConfirmModal
}

function showNavigationWarning() {
    navigationWarning.classList.remove('hidden');
}

function closeNavigationWarning() {
    navigationWarning.classList.add('hidden');
}

// Socket event handlers
function handleExamStatusUpdate(data) {
    if (data.participant_id === parseInt(participantId)) {
        examData = { ...examData, ...data };
        
        switch (data.status) {
            case 'completed':
                if (currentPhase !== 'completed') {
                    showPhase('completed');
                    updateCompletedInfo();
                }
                break;
        }
    }
}

function handleTimeWarning(data) {
    if (data.participant_id === parseInt(participantId)) {
        Utils.showAlert(`Còn ${data.remaining_minutes} phút!`, 'warning');
    }
}

// Audio Visualization Functions
async function setupAudioVisualization() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        microphone = audioContext.createMediaStreamSource(mediaStream);
        microphone.connect(analyser);
        
        initializeWaveform();
        startWaveformVisualization();
        
        console.log('Audio visualization setup successful');
    } catch (error) {
        console.error('Error setting up audio visualization:', error);
    }
}

function initializeWaveform() {
    const waveform = document.getElementById('examWaveform');
    if (!waveform) return;
    
    // Adjust number of bars based on screen size
    let numBars = 40;
    if (window.innerWidth <= 480) {
        numBars = 25;
    } else if (window.innerWidth <= 768) {
        numBars = 30;
    }
    
    waveform.innerHTML = '';
    waveBars = [];
    
    for (let i = 0; i < numBars; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        waveform.appendChild(bar);
        waveBars.push(bar);
    }
}

function startWaveformVisualization() {
    if (!analyser || !dataArray) return;

    const updateWaveform = () => {
        if (currentPhase !== 'recording') {
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        
        const barCount = waveBars.length;
        const dataPerBar = Math.floor(dataArray.length / barCount);
        
        for (let i = 0; i < barCount; i++) {
            const start = i * dataPerBar;
            const end = start + dataPerBar;
            
            let sum = 0;
            for (let j = start; j < end && j < dataArray.length; j++) {
                sum += dataArray[j];
            }
            const average = sum / dataPerBar;
            
            const height = Math.max(4, (average / 255) * 40);
            waveBars[i].style.height = height + 'px';
            
            if (average > 10) {
                waveBars[i].classList.add('active');
            } else {
                waveBars[i].classList.remove('active');
            }
        }

        const totalVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const audioStatusElement = document.getElementById('examAudioStatus');
        
        if (audioStatusElement) {
            if (totalVolume > 12) {
                audioStatusElement.textContent = `Đang ghi âm...`;
            } else {
                audioStatusElement.textContent = 'Chưa có tín hiệu âm thanh';
            }
        }

        animationId = requestAnimationFrame(updateWaveform);
    };

    updateWaveform();
}

function stopWaveformVisualization() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (waveBars) {
        waveBars.forEach(bar => {
            bar.style.height = '4px';
            bar.classList.remove('active');
        });
    }
    
    const audioStatusElement = document.getElementById('examAudioStatus');
    if (audioStatusElement) {
        audioStatusElement.textContent = 'Chưa có tín hiệu âm thanh';
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (socket) {
        socket.disconnect();
    }
});
