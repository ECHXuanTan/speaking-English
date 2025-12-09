// Student dashboard functionality

let socket = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!Auth.isAuthenticated()) {
        window.location.href = '/student/login.html';
        return;
    }

    // Initialize dashboard
    await initializeDashboard();
    initializeSocket();
    loadExams();
    
    // Initialize microphone test
    initMicrophoneTest();
});

async function initializeDashboard() {
    const userInfo = Auth.getUserInfo();
    if (userInfo) {
        // Removed studentName element reference
        document.getElementById('profileName').textContent = userInfo.fullName;
        document.getElementById('profileCode').textContent = `Mã học sinh: ${userInfo.studentCode}`;
    }

    // Microphone permission status will be handled by MicrophoneTest class

    // Dashboard initialized
}

function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        // Authenticate socket connection
        const userInfo = Auth.getUserInfo();
        if (userInfo) {
            socket.emit('authenticate', {
                userId: userInfo.id,
                role: 'student'
            });
        }
    });

    socket.on('authenticated', (data) => {
        console.log('Socket authenticated:', data);
    });

    socket.on('exam_status_update', (data) => {
        console.log('Exam status update:', data);
        loadExams(); // Refresh exam list
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

async function loadExams() {
    const examsList = document.getElementById('examsList');
    
    try {
        const response = await Utils.apiRequest('/api/student/exams');
        
        if (response.success && response.data && response.data.exams) {
            displayExams(response.data.exams);
        } else {
            examsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>Chưa có kỳ thi nào</h3>
                    <p>Hiện tại bạn chưa được phân công tham gia kỳ thi nào.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading exams:', error);
        examsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Lỗi tải dữ liệu</h3>
                <p>Không thể tải danh sách kỳ thi. Vui lòng thử lại.</p>
                <button class="btn btn-primary" onclick="loadExams()">
                    <i class="fas fa-sync-alt"></i>
                    Thử Lại
                </button>
            </div>
        `;
    }
}

function displayExams(exams) {
    const examsList = document.getElementById('examsList');
    
    if (!exams || exams.length === 0) {
        examsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>Chưa có kỳ thi nào</h3>
                <p>Hiện tại bạn chưa được phân công tham gia kỳ thi nào.</p>
            </div>
        `;
        return;
    }

    examsList.innerHTML = exams.map(exam => `
        <div class="exam-card ${getExamStatusClass(exam.status)}">
            <div class="exam-header">
                <h3>${exam.exam_name}</h3>
                <span class="status-badge ${getExamStatusClass(exam.status)}">
                    ${getExamStatusText(exam.status)}
                </span>
            </div>
            <div class="exam-details">
                <div class="exam-info">
                    <div class="info-item">
                        <i class="fas fa-list-ol"></i>
                        <span>Số đề: ${exam.question_number ? exam.question_number : 'Chưa bốc đề'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-clock"></i>
                        <span>Thời gian chuẩn bị: ${Math.floor(exam.preparation_time / 60)} phút</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-hourglass-half"></i>
                        <span>Thời gian thi: ${Math.floor(exam.exam_duration / 60)} phút</span>
                    </div>
                    ${exam.start_time ? `
                        <div class="info-item">
                            <i class="fas fa-calendar"></i>
                            <span>Bắt đầu: ${new Date(exam.start_time).toLocaleString('vi-VN')}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="exam-actions">
                    ${getExamActions(exam)}
                </div>
            </div>
        </div>
    `).join('');
}

function getExamStatusClass(status) {
    const statusClasses = {
        'waiting': 'status-waiting',
        'in_progress': 'status-progress',
        'completed': 'status-completed'
    };
    return statusClasses[status] || 'status-waiting';
}

function getExamStatusText(status) {
    const statusTexts = {
        'waiting': 'Chờ làm bài',
        'in_progress': 'Đang làm bài',
        'completed': 'Đã hoàn thành'
    };
    return statusTexts[status] || 'Không xác định';
}

function getExamActions(exam) {
    switch (exam.status) {
        case 'waiting':
            if (!exam.question_number) {
                // Chưa random đề
                return `
                    <button class="btn btn-info" onclick="randomQuestion(${exam.participant_id})">
                        <i class="fas fa-random"></i>
                        Bốc thăm Đề thi
                    </button>
                `;
            } else {
                // Đã có đề, chỉ có thể bắt đầu thi (không cho random lại)
                return `
                    <button class="btn btn-primary" onclick="startExam(${exam.participant_id})">
                        <i class="fas fa-play"></i>
                        Bắt Đầu Thi
                    </button>
                `;
            }
        case 'in_progress':
            return `
                <button class="btn btn-warning" onclick="continueExam(${exam.participant_id})">
                    <i class="fas fa-play-circle"></i>
                    Tiếp Tục Thi
                </button>
            `;
        case 'completed':
            return `
                <div class="completed-info">
                    <i class="fas fa-check-circle"></i>
                    <span>Đã nộp bài thành công</span>
                    ${exam.submit_time ? `
                        <small>Nộp lúc: ${new Date(exam.submit_time).toLocaleString('vi-VN')}</small>
                    ` : ''}
                </div>
            `;
        default:
            return '';
    }
}

async function randomQuestion(participantId) {
    try {
        const response = await Utils.apiRequest(`/api/student/exam/${participantId}/random-question`, {
            method: 'POST'
        });
        
        if (response.success) {
            Utils.showAlert(`Đã random thành công! Số đề: ${response.data.question_number}`, 'success');
            loadExams(); // Refresh exam list to show new question number
        } else {
            Utils.showAlert(response.error || 'Lỗi random đề thi', 'error');
        }
    } catch (error) {
        console.error('Error randomizing question:', error);
        Utils.showAlert('Lỗi kết nối. Vui lòng thử lại.', 'error');
    }
}

async function startExam(participantId) {
    // Check microphone first
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) {
        Utils.showAlert('Vui lòng cấp quyền sử dụng microphone và test microphone trước khi thi', 'warning');
        return;
    }

    if (confirm('Bạn có chắc chắn muốn bắt đầu làm bài thi? Sau khi bắt đầu, bạn không thể thoát khỏi trang thi.')) {
        window.location.href = `/student/exam.html?participant=${participantId}`;
    }
}

async function continueExam(participantId) {
    window.location.href = `/student/exam.html?participant=${participantId}`;
}

async function checkMicrophonePermission() {
    try {
        const support = getMediaDevicesSupport();
        
        if (support.type === 'none') {
            return false;
        }
        
        let stream;
        if (support.type === 'modern') {
            stream = await support.api({ audio: true });
        } else {
            stream = await new Promise((resolve, reject) => {
                support.api({ audio: true }, resolve, reject);
            });
        }
        
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        return false;
    }
}

// Initialize microphone test when dashboard loads
function initMicrophoneTest() {
    micTest = new MicrophoneTest();
}

// Helper function to check MediaDevices support
function getMediaDevicesSupport() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return {
            type: 'modern',
            api: navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        };
    }
    
    const getUserMedia = navigator.getUserMedia || 
                        navigator.webkitGetUserMedia || 
                        navigator.mozGetUserMedia ||
                        navigator.msGetUserMedia;
    
    if (getUserMedia) {
        return {
            type: 'legacy',
            api: getUserMedia.bind(navigator)
        };
    }
    
    return {
        type: 'none',
        api: null
    };
}

// Microphone test functionality
class MicrophoneTest {
    constructor() {
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.isRecording = false;
        this.isTestingMic = false;
        this.recordings = [];
        this.recordingStartTime = null;
        this.recordingInterval = null;
        this.animationId = null;
        
        this.initializeElements();
        this.checkInitialPermissions();
    }

    initializeElements() {
        this.micIcon = document.getElementById('micIcon');
        this.micStatus = document.getElementById('micStatus');
        this.waveform = document.getElementById('waveform');
        this.audioStatus = document.getElementById('audioStatus');
        this.startRecordBtn = document.getElementById('startRecordBtn');
        this.stopRecordBtn = document.getElementById('stopRecordBtn');
        this.recordingsList = document.getElementById('recordingsList');
        this.permissionWarning = document.getElementById('permissionWarning');
        
        this.initializeWaveform();
    }

    async checkInitialPermissions() {
        try {
            // Check if permissions API is available
            if (navigator.permissions && navigator.permissions.query) {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                this.updatePermissionStatus(permissionStatus.state);
                
                permissionStatus.addEventListener('change', () => {
                    this.updatePermissionStatus(permissionStatus.state);
                });
            } else {
                // Fallback: check MediaDevices support
                const support = getMediaDevicesSupport();
                
                if (support.type === 'none') {
                    this.updatePermissionStatus('denied');
                    Utils.showAlert('Trình duyệt không hỗ trợ ghi âm. Vui lòng cập nhật trình duyệt hoặc sử dụng HTTPS.', 'error');
                } else {
                    this.updatePermissionStatus('prompt');
                }
            }
        } catch (error) {
            console.log('Error checking permissions:', error);
            this.updatePermissionStatus('prompt');
        }
    }

    updatePermissionStatus(state) {
    const statusMap = {
            'granted': {
                icon: 'fas fa-check-circle',
                text: '🎙️ Microphone đã sẵn sàng',
                class: 'status-ready',
                micClass: 'ready'
            },
            'denied': {
                icon: 'fas fa-exclamation-triangle',
                text: '❌ Microphone bị từ chối',
                class: 'status-inactive',
                micClass: 'inactive'
            },
            'prompt': {
                icon: 'fas fa-info-circle',
                text: '⚠️ Cần cấp quyền microphone',
                class: 'status-inactive',
                micClass: 'inactive'
            }
    };
    
    const status = statusMap[state] || statusMap['prompt'];
        
        this.micStatus.innerHTML = `
        <i class="${status.icon}"></i>
        <span>${status.text}</span>
    `;
        this.micStatus.className = `status-indicator ${status.class}`;
        
        this.micIcon.className = `fas fa-microphone mic-icon ${status.micClass}`;
        
        // Show/hide permission warning
        if (state === 'denied' || state === 'prompt') {
            this.permissionWarning.classList.remove('hidden');
            this.startRecordBtn.disabled = true;
        } else {
            this.permissionWarning.classList.add('hidden');
            this.startRecordBtn.disabled = false;
            this.startWaveformVisualization();
        }
    }

    async requestMicPermission() {
        try {
            // Check MediaDevices support
            const support = getMediaDevicesSupport();
            
            if (support.type === 'none') {
                throw new Error('MediaDevices API not supported');
            }
            
            // Stop existing stream if any
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }

            const audioConfig = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            if (support.type === 'modern') {
                // Use modern MediaDevices API
                this.mediaStream = await support.api(audioConfig);
            } else {
                // Use legacy callback-based API
                this.mediaStream = await new Promise((resolve, reject) => {
                    support.api(audioConfig, resolve, reject);
                });
            }

            this.updatePermissionStatus('granted');
            await this.setupAudioContext();
            
        } catch (error) {
            console.error('Error requesting microphone permission:', error);
            let errorMessage = 'Không thể truy cập microphone. ';
            
            if (error.message === 'MediaDevices API not supported') {
                errorMessage += 'Trình duyệt không hỗ trợ ghi âm. Vui lòng cập nhật trình duyệt hoặc sử dụng HTTPS.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'Không tìm thấy thiết bị microphone.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage += 'Quyền truy cập bị từ chối.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Microphone đang được sử dụng bởi ứng dụng khác.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'Trình duyệt không hỗ trợ các tùy chọn âm thanh được yêu cầu.';
            } else {
                errorMessage += 'Vui lòng kiểm tra thiết bị và thử lại.';
            }
            
            Utils.showAlert(errorMessage, 'error');
            this.updatePermissionStatus('denied');
            throw error;
        }
    }

    async setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.microphone.connect(this.analyser);
            
            console.log('Audio context setup successful');
        } catch (error) {
            console.error('Error setting up audio context:', error);
        }
    }

    initializeWaveform() {
        // Adjust number of bars based on screen size
        let numBars = 50;
        if (window.innerWidth <= 480) {
            numBars = 35;
        } else if (window.innerWidth <= 768) {
            numBars = 40;
        }
        
        this.waveform.innerHTML = '';
        this.waveBars = [];
        
        for (let i = 0; i < numBars; i++) {
            const bar = document.createElement('div');
            bar.className = 'wave-bar';
            this.waveform.appendChild(bar);
            this.waveBars.push(bar);
        }
    }

    startWaveformVisualization() {
        if (!this.analyser || !this.dataArray) return;

        const updateWaveform = () => {
            if (!this.isRecording) {
                this.animationId = requestAnimationFrame(updateWaveform);
                return;
            }

            this.analyser.getByteFrequencyData(this.dataArray);
            
            const barCount = this.waveBars.length;
            const dataPerBar = Math.floor(this.dataArray.length / barCount);
            
            for (let i = 0; i < barCount; i++) {
                const start = i * dataPerBar;
                const end = start + dataPerBar;
                
                let sum = 0;
                for (let j = start; j < end && j < this.dataArray.length; j++) {
                    sum += this.dataArray[j];
                }
                const average = sum / dataPerBar;
                
                const height = Math.max(4, (average / 255) * 40);
                this.waveBars[i].style.height = height + 'px';
                
                if (average > 10) {
                    this.waveBars[i].classList.add('active');
                } else {
                    this.waveBars[i].classList.remove('active');
                }
            }

            const totalVolume = this.dataArray.reduce((sum, val) => sum + val, 0) / this.dataArray.length;
            
            if (this.isRecording) {
                this.audioStatus.textContent = `🔴 Đang ghi âm`;
            } else {
                this.audioStatus.textContent = totalVolume > 12 ? `🎵 Phát hiện âm thanh` : '🔇 Chưa có tín hiệu âm thanh';
            }

            this.animationId = requestAnimationFrame(updateWaveform);
        };

        updateWaveform();
    }

    stopWaveformVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.waveBars.forEach(bar => {
            bar.style.height = '4px';
            bar.classList.remove('active');
        });
        
        this.audioStatus.textContent = '🔇 Chưa có tín hiệu âm thanh';
    }

    async startRecording() {
        try {
            if (!this.mediaStream) {
                await this.requestMicPermission();
                if (!this.mediaStream) {
                    return;
                }
            }

            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            };

            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/mp4';
            }

            this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingComplete();
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Update UI
            this.startRecordBtn.classList.add('hidden');
            this.stopRecordBtn.classList.remove('hidden');
            this.stopRecordBtn.disabled = false;

            this.micIcon.className = 'fas fa-microphone mic-icon recording';
            this.micStatus.innerHTML = `
                <i class="fas fa-record-vinyl"></i>
                <span>🔴 Đang ghi âm...</span>
            `;
            this.micStatus.className = 'status-indicator status-recording';

            this.startWaveformVisualization();
            this.startRecordingTimer();

            Utils.showAlert('Đã bắt đầu ghi âm!', 'success');

        } catch (error) {
            console.error('Error starting recording:', error);
            Utils.showAlert('Lỗi bắt đầu ghi âm: ' + error.message, 'error');
            this.resetRecordingState();
        }
    }

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;

        try {
            this.mediaRecorder.stop();
            this.isRecording = false;

            if (this.recordingInterval) {
                clearInterval(this.recordingInterval);
                this.recordingInterval = null;
            }

            this.stopWaveformVisualization();
            this.resetRecordingState();

        } catch (error) {
            console.error('Error stopping recording:', error);
            Utils.showAlert('Lỗi dừng ghi âm: ' + error.message, 'error');
        }
    }

    startRecordingTimer() {
        let seconds = 0;
        this.recordingInterval = setInterval(() => {
            seconds++;
            const timeText = Utils.formatTime(seconds);
            this.micStatus.innerHTML = `
                <i class="fas fa-record-vinyl"></i>
                <span>🔴 Đang ghi âm... (${timeText})</span>
            `;
        }, 1000);
    }

    resetRecordingState() {
        this.startRecordBtn.classList.remove('hidden');
        this.stopRecordBtn.classList.add('hidden');
        this.stopRecordBtn.disabled = true;

        this.micIcon.className = 'fas fa-microphone mic-icon ready';
        this.micStatus.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>🎙️ Microphone đã sẵn sàng</span>
        `;
        this.micStatus.className = 'status-indicator status-ready';
    }

    handleRecordingComplete() {
        if (this.recordedChunks.length === 0) {
            Utils.showAlert('Không có dữ liệu âm thanh được ghi!', 'warning');
            return;
        }

        const recordingDuration = Date.now() - this.recordingStartTime;
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);

        const recording = {
            id: Date.now(),
            blob: blob,
            url: audioUrl,
            duration: Math.round(recordingDuration / 1000),
            timestamp: new Date().toLocaleString('vi-VN'),
            size: this.formatFileSize(blob.size)
        };

        this.recordings.push(recording);
        this.displayRecordings();

        Utils.showAlert(`Đã lưu bản ghi (${recording.duration}s)!`, 'success');
    }

    displayRecordings() {
        if (this.recordings.length === 0) {
            this.recordingsList.innerHTML = '<p class="text-center text-secondary">Chưa có bản ghi nào. Hãy bắt đầu test microphone!</p>';
            return;
        }

        this.recordingsList.innerHTML = this.recordings.map((recording, index) => `
            <div class="recording-item" data-id="${recording.id}">
                <div class="recording-info">
                    <i class="fas fa-volume-up"></i>
                    <div>
                        <strong>Bản ghi ${index + 1}</strong>
                        <div class="text-secondary">
                            ${recording.timestamp}
                        </div>
                    </div>
                </div>
                <div class="recording-controls">
                    <audio controls class="audio-player" preload="none">
                        <source src="${recording.url}" type="audio/webm">
                        Trình duyệt không hỗ trợ phát audio.
                    </audio>
                    <button class="btn btn-danger btn-sm" onclick="micTest.deleteRecording(${recording.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    deleteRecording(recordingId) {
        if (!confirm('Bạn có chắc muốn xóa bản ghi này?')) return;

        const recordingIndex = this.recordings.findIndex(r => r.id === recordingId);
        if (recordingIndex === -1) return;

        const recording = this.recordings[recordingIndex];
        URL.revokeObjectURL(recording.url);
        this.recordings.splice(recordingIndex, 1);
        this.displayRecordings();

        Utils.showAlert('Đã xóa bản ghi!', 'success');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    cleanup() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
        }

        this.recordings.forEach(recording => {
            URL.revokeObjectURL(recording.url);
        });
    }
}

// Global variables and functions for microphone test
let micTest;

function requestMicPermission() {
    micTest.requestMicPermission();
}

function startRecording() {
    micTest.startRecording();
}

function stopRecording() {
    micTest.stopRecording();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (micTest) {
        micTest.cleanup();
    }
});