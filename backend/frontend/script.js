// ========== 小智机器人前端脚本 ==========

// 状态变量
let studyStartTime = Date.now();
let lastDetectedObjects = [];
let cameraActive = false;
let pollingInterval = null;
let distanceCheckInterval = null;
let distanceWarningActive = false;

// ========== 语音对话录音相关 ==========
let isRecording = false;
let currentRecognition = null;

// ========== 全局语音队列管理 ==========
let speechQueue = [];
let isProcessingQueue = false;
let currentSpeechRequest = null;

// ========== 持续距离检测（独立于摄像头，一直运行） ==========
let continuousDistanceInterval = null;
let lastDistanceWarningTime = 0;

// 停止当前语音并清空队列
function stopAllSpeech() {
    // 清空队列
    speechQueue = [];
    isProcessingQueue = false;
    
    // 发送停止信号到后端
    fetch('/api/stop_speak', { method: 'POST' }).catch(e => console.log('停止语音失败:', e));
    console.log('🛑 已停止所有语音');
}

// 添加语音到队列（会打断当前播放）
function speakMessage(text) {
    if (!text || text.trim() === '') return;
    
    // 停止当前播放并清空队列
    stopAllSpeech();
    
    // 新语音加入队列并立即播放
    speechQueue.push(text);
    processSpeechQueue();
}

// 处理语音队列
function processSpeechQueue() {
    if (isProcessingQueue) return;
    if (speechQueue.length === 0) return;
    
    isProcessingQueue = true;
    const text = speechQueue.shift();
    
    // 估算语音时长（每个字约0.3秒）
    const estimatedDuration = Math.max(800, text.length * 200);
    
    fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    }).then(() => {
        // 等待语音播放完成再播放下一条
        setTimeout(() => {
            isProcessingQueue = false;
            processSpeechQueue();
        }, estimatedDuration);
    }).catch(e => {
        console.log('语音请求失败:', e);
        isProcessingQueue = false;
        processSpeechQueue();
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    addMessage('robot', '你好呀！我是小智，让我陪你一起学习吧~');
    speakMessage('你好呀！我是小智，让我陪你一起学习吧~');
    
    // ========== 启动持续距离检测（独立于摄像头） ==========
    startContinuousDistanceCheck();
});

// ========== 暖光护眼模式 ==========
function toggleWarmLight() {
    const warmLightEnabled = document.getElementById('warm-toggle').textContent === '☀️';
    const overlay = document.getElementById('warm-overlay');
    const btn = document.getElementById('warm-toggle');
    
    if (warmLightEnabled) {
        if (overlay) overlay.style.opacity = '0';
        btn.textContent = '🌙';
        btn.style.background = '#E8D5B7';
        addMessage('robot', '已关闭护眼模式');
    } else {
        if (overlay) overlay.style.opacity = '1';
        btn.textContent = '☀️';
        btn.style.background = '#E8A735';
        addMessage('robot', '已开启护眼模式，屏幕变得更柔和啦');
    }
}

// ========== 摄像头控制（拍照模式） ==========
let videoFeed = null;
let isPhotoMode = true;

function startCamera() {
    if (cameraActive) return;
    
    cameraActive = true;
    const cameraContainer = document.getElementById('camera-container');
    if (cameraContainer) cameraContainer.style.display = 'block';
    
    // 获取视频元素
    videoFeed = document.getElementById('video-feed');
    if (videoFeed) {
        videoFeed.src = '/video_feed';
    }
    
    // 更新按钮文字
    const learnBtn = document.querySelector('.btn-secondary[onclick="learnObject()"]');
    if (learnBtn) {
        learnBtn.innerHTML = '<span class="btn-icon">📷</span> 开始识别';
    }
    
    addMessage('robot', '摄像头已开启，把物品放在摄像头前面');
    speakMessage('摄像头已开启，把物品放在摄像头前面');
}

function stopCamera() {
    if (!cameraActive) return;
    
    cameraActive = false;
    const videoFeed = document.getElementById('video-feed');
    if (videoFeed) videoFeed.src = '';
    
    const cameraContainer = document.getElementById('camera-container');
    if (cameraContainer) cameraContainer.style.display = 'none';
    
    const detectedText = document.getElementById('detected-text');
    if (detectedText) detectedText.innerHTML = '等待识别...';
    
    // 恢复按钮文字
    const learnBtn = document.querySelector('.btn-secondary[onclick="learnObject()"]');
    if (learnBtn) {
        learnBtn.innerHTML = '<span class="btn-icon">🔍</span> 认识物品';
    }
}

// ========== 拍照识别物品 ==========
async function takePhotoAndRecognize() {
    const videoFeed = document.getElementById('video-feed');
    if (!videoFeed || !videoFeed.src) {
        addMessage('robot', '请先开启摄像头');
        speakMessage('请先开启摄像头');
        return;
    }
    
    addMessage('robot', '📸 正在拍照识别...');
    speakMessage('正在拍照识别');
    
    // 修改按钮状态
    const recognizeBtn = document.querySelector('.btn-secondary[onclick="learnObject()"]');
    if (recognizeBtn) {
        recognizeBtn.innerHTML = '<span class="btn-icon">⏳</span> 识别中...';
        recognizeBtn.disabled = true;
    }
    
    try {
        // 创建一个临时的canvas来捕获视频帧
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // 等待视频元素加载完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 绘制当前视频帧
        ctx.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);
        
        // 转换为base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // 发送到后端识别
        const response = await fetch('/api/detect_from_frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });
        
        const data = await response.json();
        
        if (data.objects && data.objects.length > 0) {
            const objectsList = data.objects.slice(0, 3).join('、');
            addMessage('robot', `🔍 我识别到了：${objectsList}！`);
            speakMessage(`我识别到了：${objectsList}`);
            
            // 更新显示
            const detectedText = document.getElementById('detected-text');
            if (detectedText) detectedText.innerHTML = `🔍 识别到：${objectsList}`;
        } else {
            addMessage('robot', '没有识别到物品，请把物品放在摄像头正前方');
            speakMessage('没有识别到物品，请把物品放在摄像头正前方');
        }
        
    } catch (error) {
        console.error('识别失败:', error);
        addMessage('robot', '识别失败，请重试');
        speakMessage('识别失败，请重试');
    } finally {
        // 恢复按钮（保持"开始识别"状态，因为摄像头还开着）
        if (recognizeBtn) {
            recognizeBtn.innerHTML = '<span class="btn-icon">📷</span> 开始识别';
            recognizeBtn.disabled = false;
        }
    }
}

// ========== 认识物品（拍照模式） ==========
function learnObject() {
    // 获取按钮元素
    const learnBtn = document.querySelector('.btn-secondary[onclick="learnObject()"]');
    
    if (!cameraActive) {
        // 摄像头未开启，开启摄像头
        startCamera();
    } else {
        // 摄像头已开启，点击开始识别
        takePhotoAndRecognize();
    }
}

// 重置识别按钮状态（用于重置功能）
function resetLearnButton() {
    const learnBtn = document.querySelector('.btn-secondary[onclick="learnObject()"]');
    if (learnBtn) {
        if (cameraActive) {
            learnBtn.innerHTML = '<span class="btn-icon">📷</span> 开始识别';
        } else {
            learnBtn.innerHTML = '<span class="btn-icon">🔍</span> 认识物品';
        }
        learnBtn.disabled = false;
    }
}

// ========== 持续距离检测（独立于摄像头，一直运行） ==========
function startContinuousDistanceCheck() {
    if (continuousDistanceInterval) clearInterval(continuousDistanceInterval);
    
    continuousDistanceInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/get_distance');
            const data = await response.json();
            
            console.log('持续距离检测:', data.status, '人脸大小:', data.face_size);
            
            const now = Date.now();
            // 每8秒最多警告一次，避免频繁弹窗
            if (data.status === 'too_close' && now - lastDistanceWarningTime > 8000) {
                lastDistanceWarningTime = now;
                showContinuousDistanceWarning('too_close');
            } else if (data.status === 'close' && now - lastDistanceWarningTime > 8000) {
                lastDistanceWarningTime = now;
                showContinuousDistanceWarning('close');
            } else if (data.status === 'normal') {
                closeContinuousDistanceWarning();
            }
        } catch(e) {
            console.log('持续距离检测失败:', e);
        }
    }, 3000);  // 每3秒检测一次
}

function showContinuousDistanceWarning(level) {
    // 先关闭已有的弹窗
    closeContinuousDistanceWarning();
    
    // 创建弹窗
    const modal = document.createElement('div');
    modal.id = 'continuous-distance-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1002;
    `;
    
    let message = '';
    if (level === 'too_close') {
        message = '⚠️ 你离屏幕太近啦！请后退一点，保护小眼睛~';
    } else {
        message = '👀 请离屏幕远一点，保持距离对眼睛好哦~';
    }
    
    modal.innerHTML = `
        <div style="background: #FFF8F0; border-radius: 30px; padding: 30px; max-width: 320px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="font-size: 60px; margin-bottom: 15px;">👀</div>
            <h2 style="color: #E8A735; margin-bottom: 15px;">离屏幕太近啦！</h2>
            <p style="color: #6B5B4F; margin-bottom: 20px; font-size: 16px; line-height: 1.5;">${message}</p>
            <button id="close-continuous-modal" style="background: #E8A735; color: white; border: none; padding: 10px 25px; border-radius: 50px; font-size: 15px; cursor: pointer; font-weight: bold;">知道啦</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 语音提醒（不要过于频繁，只在太近时提醒）
    if (level === 'too_close') {
        speakMessage('你离屏幕太近啦，请后退一点保护眼睛');
    }
    
    // 关闭按钮
    document.getElementById('close-continuous-modal').onclick = () => {
        closeContinuousDistanceWarning();
    };
    
    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeContinuousDistanceWarning();
        }
    };
    
    // 5秒后自动关闭
    setTimeout(() => {
        closeContinuousDistanceWarning();
    }, 5000);
}

function closeContinuousDistanceWarning() {
    const modal = document.getElementById('continuous-distance-modal');
    if (modal) {
        modal.remove();
    }
}

// ========== 原有距离检测（依赖摄像头开启时使用） ==========
function startDistanceCheck() {
    if (distanceCheckInterval) clearInterval(distanceCheckInterval);
    
    distanceCheckInterval = setInterval(async () => {
        if (!cameraActive) return;
        
        try {
            const response = await fetch('/api/get_distance');
            const data = await response.json();
            
            console.log('距离状态:', data.status, '人脸大小:', data.face_size);
            
            if (data.status === 'too_close' && !distanceWarningActive) {
                showDistanceWarning('too_close');
            } else if (data.status === 'close' && !distanceWarningActive) {
                showDistanceWarning('close');
            } else if (data.status === 'normal') {
                closeDistanceWarning();
            }
        } catch(e) {
            console.log('距离检测失败:', e);
        }
    }, 2000);
}

function showDistanceWarning(level) {
    if (distanceWarningActive) return;
    distanceWarningActive = true;
    
    const modal = document.getElementById('distance-modal');
    const modalText = document.getElementById('distance-modal-text');
    
    if (level === 'too_close') {
        if (modalText) modalText.textContent = '你离屏幕太近啦！请后退一点，保护小眼睛~';
        speakMessage('你离屏幕太近啦，请后退一点');
    } else {
        if (modalText) modalText.textContent = '请离屏幕远一点，保持距离对眼睛好哦~';
        speakMessage('请离屏幕远一点');
    }
    
    if (modal) modal.style.display = 'flex';
}

function closeDistanceWarning() {
    const modal = document.getElementById('distance-modal');
    if (modal) modal.style.display = 'none';
    distanceWarningActive = false;
}

// ========== 语音对话（录音模式） ==========
function speak() {
    // 如果正在录音，则停止录音并处理
    if (isRecording) {
        stopRecordingAndProcess();
        return;
    }
    
    // 如果摄像头开着，关闭摄像头
    if (cameraActive) {
        stopCamera();
    }
    
    // 停止所有正在播放的语音
    stopAllSpeech();
    
    // 开始录音
    startRecording();
}

function startRecording() {
    // 检查浏览器支持
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addMessage('robot', '您的浏览器不支持语音识别，请使用Chrome浏览器');
        speakMessage('您的浏览器不支持语音识别，请使用Chrome浏览器');
        return;
    }
    
    isRecording = true;
    currentRecognition = new SpeechRecognition();
    currentRecognition.lang = 'zh-CN';
    currentRecognition.interimResults = false;
    currentRecognition.continuous = false;
    
    // 修改按钮文字和样式
    const speakBtn = document.querySelector('.btn-primary');
    if (speakBtn) {
        speakBtn.innerHTML = '<span class="btn-icon">⏹️</span> 停止录音';
        speakBtn.style.background = '#FF6B6B';
        speakBtn.style.boxShadow = '0 4px 0 #CC5555';
    }
    
    addMessage('user', '🎤 正在录音，请说话...');
    
    currentRecognition.onstart = () => {
        console.log('开始录音');
    };
    
    currentRecognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        addMessage('user', text);
        processVoiceCommand(text);
        stopRecording();
    };
    
    currentRecognition.onerror = (event) => {
        console.log('识别错误:', event.error);
        addMessage('robot', '没听清楚，能再说一遍吗？');
        speakMessage('没听清楚，能再说一遍吗？');
        stopRecording();
    };
    
    currentRecognition.onend = () => {
        // 如果用户没有说话就结束，自动停止录音状态
        if (isRecording) {
            stopRecording();
            addMessage('robot', '没有检测到语音，请重试');
            speakMessage('没有检测到语音，请重试');
        }
    };
    
    currentRecognition.start();
    
    // 设置超时（15秒自动停止）
    setTimeout(() => {
        if (isRecording && currentRecognition) {
            currentRecognition.stop();
            addMessage('robot', '录音超时，请重试');
            speakMessage('录音超时，请重试');
            stopRecording();
        }
    }, 15000);
}

function stopRecording() {
    if (currentRecognition) {
        try {
            currentRecognition.stop();
        } catch(e) {}
        currentRecognition = null;
    }
    isRecording = false;
    
    // 恢复按钮
    const speakBtn = document.querySelector('.btn-primary');
    if (speakBtn) {
        speakBtn.innerHTML = '<span class="btn-icon">🎤</span> 语音对话';
        speakBtn.style.background = '#E8A735';
        speakBtn.style.boxShadow = '0 4px 0 #B8860B';
    }
}

function stopRecordingAndProcess() {
    if (currentRecognition) {
        try {
            currentRecognition.stop();
        } catch(e) {}
        currentRecognition = null;
    }
    isRecording = false;
    
    // 恢复按钮
    const speakBtn = document.querySelector('.btn-primary');
    if (speakBtn) {
        speakBtn.innerHTML = '<span class="btn-icon">🎤</span> 语音对话';
        speakBtn.style.background = '#E8A735';
        speakBtn.style.boxShadow = '0 4px 0 #B8860B';
    }
}

function processVoiceCommand(text) {
    if (text.includes('你好') || text.includes('嗨')) {
        const replies = ['你好呀！我是小智', '嗨！今天想学什么呀', '你好，我们一起玩吧'];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        addMessage('robot', reply);
        speakMessage(reply);
    }
    else if (text.includes('名字')) {
        addMessage('robot', '我叫小智，是你的启蒙小伙伴！');
        speakMessage('我叫小智，是你的启蒙小伙伴！');
    }
    else if (text.includes('故事')) {
        tellStory();
    }
    else if (text.includes('游戏') || text.includes('谜语')) {
        playGame();
    }
    else if (text.includes('物品') || text.includes('认识')) {
        learnObject();
    }
    else if (text.includes('谢谢')) {
        addMessage('robot', '不客气！能帮到你真开心');
        speakMessage('不客气！能帮到你真开心');
    }
    else if (text.includes('关闭摄像头') || text.includes('关掉摄像头')) {
        stopCamera();
        addMessage('robot', '摄像头已关闭');
        speakMessage('摄像头已关闭');
    }
    else {
        const replies = ['原来是这样！', '真有趣，然后呢？', '我记住了', '嗯嗯'];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        addMessage('robot', reply);
        speakMessage(reply);
    }
}

// ========== 讲故事（使用全局语音队列） ==========
function tellStory() {
    if (cameraActive) {
        stopCamera();
    }
    
    // 检查故事库是否存在
    if (typeof storyLibrary === 'undefined' || storyLibrary.length === 0) {
        addMessage('robot', '故事库还在加载中，请稍后再试~');
        speakMessage('故事库还在加载中，请稍后再试');
        return;
    }
    
    // 随机选择一个故事
    const story = getRandomStory();
    
    if (!story) {
        addMessage('robot', '暂时没有故事，稍后再来听吧~');
        speakMessage('暂时没有故事，稍后再来听吧');
        return;
    }
    
    addMessage('robot', `我来给你讲《${story.title}》的故事吧`);
    speakMessage(`我来给你讲《${story.title}》的故事吧`);
    
    setTimeout(() => {
        addMessage('robot', story.content);
        speakMessage(story.content);
    }, 1000);
}

// ========== 猜谜语（弹窗显示答案） ==========
let currentRiddle = null;

function playGame() {
    if (cameraActive) {
        stopCamera();
    }
    
    // 检查谜语库是否存在
    if (typeof riddleLibrary === 'undefined' || riddleLibrary.length === 0) {
        addMessage('robot', '谜语库还在加载中，请稍后再试~');
        speakMessage('谜语库还在加载中，请稍后再试');
        return;
    }
    
    // 随机选择一个谜语
    const riddle = getRandomRiddle();
    
    if (!riddle) {
        addMessage('robot', '暂时没有谜语，稍后再来玩吧~');
        speakMessage('暂时没有谜语，稍后再来玩吧');
        return;
    }
    
    // 保存当前谜语
    currentRiddle = riddle;
    
    // 显示谜语
    addMessage('robot', `🤔 猜谜语：${riddle.question}`);
    speakMessage(`猜谜语：${riddle.question}`);
    
    // 显示弹窗询问是否查看答案
    setTimeout(() => {
        showAnswerModal(riddle);
    }, 1000);
}

function showAnswerModal(riddle) {
    // 创建弹窗
    const modal = document.createElement('div');
    modal.id = 'answer-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1001;
    `;
    
    modal.innerHTML = `
        <div style="background: #FFF8F0; border-radius: 30px; padding: 30px; max-width: 320px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="font-size: 60px; margin-bottom: 15px;">🤔</div>
            <h2 style="color: #E8A735; margin-bottom: 10px;">猜谜语</h2>
            <p style="color: #6B5B4F; margin-bottom: 20px; font-size: 16px; line-height: 1.5;">${riddle.question}</p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="show-answer-btn" style="background: #E8A735; color: white; border: none; padding: 10px 20px; border-radius: 50px; font-size: 15px; cursor: pointer; font-weight: bold;">📖 查看答案</button>
                <button id="close-modal-btn" style="background: #E8D5B7; color: #4A3728; border: none; padding: 10px 20px; border-radius: 50px; font-size: 15px; cursor: pointer;">❌ 关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 查看答案按钮
    document.getElementById('show-answer-btn').onclick = () => {
        addMessage('robot', `答案是：${riddle.answer}！你猜对了吗？`);
        speakMessage(`答案是：${riddle.answer}！你猜对了吗？`);
        modal.remove();
    };
    
    // 关闭按钮
    document.getElementById('close-modal-btn').onclick = () => {
        modal.remove();
        addMessage('robot', '下次再猜吧~');
        speakMessage('下次再猜吧');
    };
    
    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

// ========== 辅助函数 ==========
function addMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
}

// 页面关闭时清理
window.addEventListener('beforeunload', () => {
    if (pollingInterval) clearInterval(pollingInterval);
    if (distanceCheckInterval) clearInterval(distanceCheckInterval);
    if (continuousDistanceInterval) clearInterval(continuousDistanceInterval);
    if (currentRecognition) {
        try {
            currentRecognition.stop();
        } catch(e) {}
    }
    stopAllSpeech();
});

// ========== 重置所有状态 ==========
function resetAll() {
    // 0. 停止录音（如果正在录音）
    if (isRecording && currentRecognition) {
        try {
            currentRecognition.stop();
        } catch(e) {}
        isRecording = false;
        currentRecognition = null;
        // 恢复按钮
        const speakBtn = document.querySelector('.btn-primary');
        if (speakBtn) {
            speakBtn.innerHTML = '<span class="btn-icon">🎤</span> 语音对话';
            speakBtn.style.background = '#E8A735';
            speakBtn.style.boxShadow = '0 4px 0 #B8860B';
        }
    }
    
    // 1. 关闭摄像头
    if (cameraActive) {
        stopCamera();
    }
    
    // 2. 停止所有语音
    stopAllSpeech();
    
    // 3. 清空聊天记录
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }
    
    // 4. 关闭距离弹窗（如果开着）
    const distanceModal = document.getElementById('distance-modal');
    if (distanceModal) {
        distanceModal.style.display = 'none';
    }
    distanceWarningActive = false;
    
    // 5. 关闭答案弹窗（如果开着）
    const answerModal = document.getElementById('answer-modal');
    if (answerModal) {
        answerModal.remove();
    }
    
    // 6. 关闭持续距离弹窗（如果开着）
    closeContinuousDistanceWarning();
    
    // 7. 重置摄像头显示文字
    const detectedText = document.getElementById('detected-text');
    if (detectedText) {
        detectedText.innerHTML = '识别中...';
    }
    
    // 8. 重置机器人表情和心情
    const faceLabel = document.getElementById('robot-face');
    const moodLabel = document.getElementById('robot-mood');
    if (faceLabel) faceLabel.textContent = '😊';
    if (moodLabel) moodLabel.textContent = '心情: 开心';
    
    // 9. 清空语音队列
    speechQueue = [];
    isProcessingQueue = false;
    
    // 10. 重置轮询定时器
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (distanceCheckInterval) {
        clearInterval(distanceCheckInterval);
        distanceCheckInterval = null;
    }
    // 注意：continuousDistanceInterval 不重置，让它继续运行
    
    // 11. 重置识别按钮
    resetLearnButton();
    
    // 12. 添加重置成功消息
    addMessage('robot', '✨ 已经全部重置啦！我们可以重新开始咯~');
    speakMessage('已经全部重置啦，我们可以重新开始咯');
    
    console.log('🔄 所有状态已重置');
}