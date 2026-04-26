// ========== 统一距离检测模块 ==========
// 适用于所有游戏页面，复制到任何HTML页面即可使用

(function() {
    // 状态变量
    let continuousDistanceInterval = null;
    let lastDistanceWarningTime = 0;
    let warningModal = null;
    
    // 配置参数
    const CHECK_INTERVAL = 3000;      // 检测间隔（毫秒）
    const WARNING_COOLDOWN = 8000;    // 警告冷却时间（毫秒）
    const MODAL_AUTO_CLOSE = 5000;    // 弹窗自动关闭时间（毫秒）
    
    // 启动距离检测
    function startDistanceCheck() {
        if (continuousDistanceInterval) {
            clearInterval(continuousDistanceInterval);
        }
        
        continuousDistanceInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/get_distance');
                const data = await response.json();
                
                console.log('[距离检测]', data.status, '人脸大小:', data.face_size);
                
                const now = Date.now();
                if (data.status === 'too_close' && now - lastDistanceWarningTime > WARNING_COOLDOWN) {
                    lastDistanceWarningTime = now;
                    showWarning('too_close');
                } else if (data.status === 'close' && now - lastDistanceWarningTime > WARNING_COOLDOWN) {
                    lastDistanceWarningTime = now;
                    showWarning('close');
                }
            } catch(e) {
                console.log('[距离检测] 失败:', e);
            }
        }, CHECK_INTERVAL);
    }
    
    // 显示警告弹窗
    function showWarning(level) {
        // 关闭已有弹窗
        closeWarning();
        
        // 创建弹窗
        warningModal = document.createElement('div');
        warningModal.id = 'distance-warning-modal';
        warningModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        let message = '';
        let icon = '👀';
        if (level === 'too_close') {
            message = '⚠️ 你离屏幕太近啦！请后退一点，保护小眼睛~';
            icon = '🔴';
        } else {
            message = '👀 请离屏幕远一点，保持距离对眼睛好哦~';
            icon = '👀';
        }
        
        warningModal.innerHTML = `
            <div style="background: #FFF8F0; border-radius: 30px; padding: 30px; max-width: 320px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2); animation: fadeIn 0.3s ease-out;">
                <div style="font-size: 60px; margin-bottom: 15px;">${icon}</div>
                <h2 style="color: #E8A735; margin-bottom: 15px;">离屏幕太近啦！</h2>
                <p style="color: #6B5B4F; margin-bottom: 20px; font-size: 16px; line-height: 1.5;">${message}</p>
                <button id="close-warning-btn" style="background: #E8A735; color: white; border: none; padding: 10px 25px; border-radius: 50px; font-size: 15px; cursor: pointer; font-weight: bold;">知道啦</button>
            </div>
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
            </style>
        `;
        
        document.body.appendChild(warningModal);
        
        // 语音提醒（只在太近时提醒）
        if (level === 'too_close') {
            speakWarningMessage('你离屏幕太近啦，请后退一点保护眼睛');
        }
        
        // 关闭按钮事件
        const closeBtn = document.getElementById('close-warning-btn');
        if (closeBtn) {
            closeBtn.onclick = closeWarning;
        }
        
        // 点击背景关闭
        warningModal.onclick = function(e) {
            if (e.target === warningModal) {
                closeWarning();
            }
        };
        
        // 自动关闭
        setTimeout(closeWarning, MODAL_AUTO_CLOSE);
    }
    
    // 关闭警告弹窗
    function closeWarning() {
        if (warningModal && warningModal.parentNode) {
            warningModal.remove();
            warningModal = null;
        }
    }
    
    // 语音提醒（如果页面有语音功能）
    function speakWarningMessage(text) {
        // 尝试使用全局的 speakMessage（如果存在）
        if (typeof window.speakMessage === 'function') {
            window.speakMessage(text);
        } else if (typeof speakMessage === 'function') {
            speakMessage(text);
        } else {
            // 如果都没有，直接调用 API
            fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            }).catch(e => console.log('语音提醒失败:', e));
        }
    }
    
    // 停止距离检测
    function stopDistanceCheck() {
        if (continuousDistanceInterval) {
            clearInterval(continuousDistanceInterval);
            continuousDistanceInterval = null;
        }
        closeWarning();
    }
    
    // 页面加载时启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDistanceCheck);
    } else {
        startDistanceCheck();
    }
    
    // 页面关闭时清理
    window.addEventListener('beforeunload', function() {
        if (continuousDistanceInterval) {
            clearInterval(continuousDistanceInterval);
        }
    });
})();