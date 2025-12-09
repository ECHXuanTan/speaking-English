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
        this.completeTestBtn = document.getElementById('completeTestBtn');
        this.recordingsList = document.getElementById('recordingsList');
        this.permissionWarning = document.getElementById('permissionWarning');
        
        this.initializeWaveform();
    }

    async checkInitialPermissions() {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            this.updatePermissionStatus(permissionStatus.state);
            
            permissionStatus.addEventListener('change', () => {
                this.updatePermissionStatus(permissionStatus.state);
            });
        } catch (error) {
            console.log('Permission API not supported, will try getUserMedia directly');
            this.updatePermissionStatus('prompt');
        }
    }

    updatePermissionStatus(state) {
        const statusMap = {
            'granted': {
                icon: 'fas fa-check-circle',
                text: 'Microphone đã sẵn sàng',
                class: 'status-ready',
                micClass: 'ready'
            },
            'denied': {
                icon: 'fas fa-times-circle',
                text: 'Microphone bị từ chối',
                class: 'status-inactive',
                micClass: 'inactive'
            },
            'prompt': {
                icon: 'fas fa-question-circle',
                text: 'Cần cấp quyền microphone',
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
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }

            this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });

            this.updatePermissionStatus('granted');
            await this.setupAudioContext();
            
        } catch (error) {
            console.error('Error requesting microphone permission:', error);
            let errorMessage = 'Không thể truy cập microphone. ';
            
            if (error.name === 'NotFoundError') {
                errorMessage += 'Không tìm thấy thiết bị microphone.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage += 'Quyền truy cập bị từ chối.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Microphone đang được sử dụng bởi ứng dụng khác.';
            } else {
                errorMessage += 'Vui lòng kiểm tra thiết bị và thử lại.';
            }
            
            Utils.showAlert(errorMessage, 'error');
            this.updatePermissionStatus('denied');
            throw error; // Re-throw để startRecording có thể handle
        }
    }

    async setupAudioContext() {
        try {
            // Create audio context for volume analysis
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
        // Create waveform bars
        const numBars = 40;
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
            
            // Update waveform bars based on frequency data
            const barCount = this.waveBars.length;
            const dataPerBar = Math.floor(this.dataArray.length / barCount);
            
            for (let i = 0; i < barCount; i++) {
                const start = i * dataPerBar;
                const end = start + dataPerBar;
                
                // Calculate average for this bar
                let sum = 0;
                for (let j = start; j < end && j < this.dataArray.length; j++) {
                    sum += this.dataArray[j];
                }
                const average = sum / dataPerBar;
                
                // Convert to height (4px min, 60px max)
                const height = Math.max(4, (average / 255) * 60);
                this.waveBars[i].style.height = height + 'px';
                
                // Add active class for visual effect
                if (average > 10) {
                    this.waveBars[i].classList.add('active');
                } else {
                    this.waveBars[i].classList.remove('active');
                }
            }

            // Update audio status
            const totalVolume = this.dataArray.reduce((sum, val) => sum + val, 0) / this.dataArray.length;
            const volumePercent = Math.round((totalVolume / 255) * 100);
            
            if (this.isRecording) {
                this.audioStatus.textContent = `Đang ghi âm - Mức âm thanh: ${volumePercent}%`;
            } else {
                this.audioStatus.textContent = volumePercent > 5 ? `Phát hiện âm thanh: ${volumePercent}%` : 'Chưa có tín hiệu âm thanh';
            }

            // Continue monitoring
            this.animationId = requestAnimationFrame(updateWaveform);
        };

        updateWaveform();
    }

    stopWaveformVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset all bars to minimum height
        this.waveBars.forEach(bar => {
            bar.style.height = '4px';
            bar.classList.remove('active');
        });
        
        this.audioStatus.textContent = 'Chưa có tín hiệu âm thanh';
    }

    async startRecording() {
        try {
            // Request permission if not available
            if (!this.mediaStream) {
                await this.requestMicPermission();
                // If still no stream after requesting permission, return
                if (!this.mediaStream) {
                    return;
                }
            }

            // Setup MediaRecorder
            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            };

            // Fallback for browsers that don't support webm
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

            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Update UI
            this.startRecordBtn.classList.add('hidden');
            this.stopRecordBtn.classList.remove('hidden');
            this.stopRecordBtn.disabled = false;

            this.micIcon.className = 'fas fa-microphone mic-icon recording';
            this.micStatus.innerHTML = `
                <i class="fas fa-record-vinyl"></i>
                <span>Đang ghi âm...</span>
            `;
            this.micStatus.className = 'status-indicator status-recording';

            // Start waveform visualization and timer
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

            // Stop timer
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
                <span>Đang ghi âm... (${timeText})</span>
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
            <span>Microphone đã sẵn sàng</span>
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
        
        // Enable complete test button if we have recordings
        this.completeTestBtn.disabled = false;

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
                            ${recording.timestamp} • ${recording.duration}s • ${recording.size}
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

        if (this.recordings.length === 0) {
            this.completeTestBtn.disabled = true;
        }

        Utils.showAlert('Đã xóa bản ghi!', 'success');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async completeTest() {
        if (this.recordings.length === 0) {
            Utils.showAlert('Vui lòng ghi ít nhất một bản âm thanh thử nghiệm!', 'warning');
            return;
        }

        // Save test completion status
        sessionStorage.setItem('microphoneTestCompleted', 'true');
        sessionStorage.setItem('microphoneTestTime', new Date().toISOString());

        Utils.showAlert('Test microphone hoàn thành! Bạn đã sẵn sàng làm bài thi.', 'success');
        
        setTimeout(() => {
            window.location.href = '/student/dashboard.html';
        }, 2000);
    }

    cleanup() {
        // Stop all streams and clean up resources
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

        // Revoke all blob URLs to free memory
        this.recordings.forEach(recording => {
            URL.revokeObjectURL(recording.url);
        });
    }
}

// Global functions for HTML onclick events
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

function completeTest() {
    micTest.completeTest();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!Auth.isAuthenticated()) {
        window.location.href = '/student/login.html';
        return;
    }

    micTest = new MicrophoneTest();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (micTest) {
        micTest.cleanup();
    }
});

// Prevent accidental page refresh during recording
window.addEventListener('beforeunload', (event) => {
    if (micTest && micTest.isRecording) {
        event.preventDefault();
        event.returnValue = 'Bạn đang ghi âm. Bạn có chắc muốn rời khỏi trang?';
        return event.returnValue;
    }
});
