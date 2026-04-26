// ========== 统一休息检测模块 ==========
// 适用于所有页面，累计计时15分钟提醒休息，并在右上角显示剩余时长

(function() {
    // 配置
    const REST_INTERVAL = 15 * 60 * 1000;  // 15分钟 = 900000毫秒
    let restModalVisible = false;
    let restTimerInterval = null;
    let updateTimerInterval = null;
    
    // 获取存储的开始时间（所有页面共享）
    function getStartTime() {
        let startTime = localStorage.getItem('studyStartTime');
        if (!startTime) {
            // 第一次访问，设置开始时间
            startTime = Date.now();
            localStorage.setItem('studyStartTime', startTime);
        }
        return parseInt(startTime);
    }
    
    // 重置开始时间
    function resetStartTime() {
        localStorage.setItem('studyStartTime', Date.now());
        updateRemainingDisplay();
    }
    
    // 获取已学习时间
    function getElapsedTime() {
        const startTime = getStartTime();
        return Date.now() - startTime;
    }
    
    // 获取剩余时间（毫秒）
    function getRemainingTime() {
        const elapsed = getElapsedTime();
        const remaining = REST_INTERVAL - elapsed;
        return remaining > 0 ? remaining : 0;
    }
    
    // 格式化剩余时间为 mm:ss
    function formatRemainingTime(ms) {
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // 创建或获取剩余时长显示元素
    let remainingDisplay = null;
    
    function createRemainingDisplay() {
        // 如果已经存在，直接返回
        if (remainingDisplay && document.body.contains(remainingDisplay)) {
            return remainingDisplay;
        }
        
        // 创建显示元素
        remainingDisplay = document.createElement('div');
        remainingDisplay.id = 'rest-remaining-display';
        remainingDisplay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(232, 167, 53, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 40px;
            font-size: 14px;
            font-weight: bold;
            font-family: 'Segoe UI', '微软雅黑', sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: default;
            transition: 0.3s;
        `;
        
        remainingDisplay.innerHTML = `
            <span style="font-size: 16px;">⏰</span>
            <span id="rest-remaining-text">15:00</span>
            <span style="font-size: 12px; opacity: 0.8;">后休息</span>
        `;
        
        document.body.appendChild(remainingDisplay);
        return remainingDisplay;
    }
    
    // 更新剩余时间显示
    function updateRemainingDisplay() {
        const remainingMs = getRemainingTime();
        const remainingText = formatRemainingTime(remainingMs);
        
        const textSpan = document.getElementById('rest-remaining-text');
        if (textSpan) {
            textSpan.textContent = remainingText;
        }
        
        // 如果剩余时间小于1分钟，改变颜色
        if (remainingDisplay) {
            if (remainingMs < 60000) {
                remainingDisplay.style.background = 'rgba(255, 107, 107, 0.95)';
                remainingDisplay.style.animation = 'rest-pulse 1s infinite';
            } else {
                remainingDisplay.style.background = 'rgba(232, 167, 53, 0.9)';
                remainingDisplay.style.animation = 'none';
            }
        }
    }
    
    // 添加动画样式
    function addAnimationStyle() {
        if (document.getElementById('rest-animation-style')) return;
        
        const style = document.createElement('style');
        style.id = 'rest-animation-style';
        style.textContent = `
            @keyframes rest-pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.05); opacity: 0.9; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 检查是否需要休息
    function checkAndShowRest() {
        if (restModalVisible) return;
        
        const elapsed = getElapsedTime();
        if (elapsed >= REST_INTERVAL) {
            showRestModal();
        }
        updateRemainingDisplay();
    }
    
    // 显示休息弹窗
    function showRestModal() {
        restModalVisible = true;
        
        // 创建弹窗（如果不存在）
        let modal = document.getElementById('global-rest-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'global-rest-modal';
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
                z-index: 10000;
            `;
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div style="background: #FFF8F0; border-radius: 30px; padding: 30px; max-width: 320px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                <div style="font-size: 60px; margin-bottom: 15px;">😴</div>
                <h2 style="color: #E8A735; margin-bottom: 10px;">该休息啦！</h2>
                <p style="color: #6B5B4F; margin-bottom: 20px;">你已经学习了15分钟，让眼睛休息一下吧~</p>
                <div style="font-size: 24px; font-weight: bold; color: #FF6B6B; margin: 15px 0;" id="global-rest-countdown">60</div>
                <button id="global-rest-close" style="background: #E8A735; color: white; border: none; padding: 12px 30px; border-radius: 50px; font-size: 16px; cursor: pointer; font-weight: bold;">继续学习</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // 倒计时
        let countdown = 60;
        const countdownEl = document.getElementById('global-rest-countdown');
        
        const timer = setInterval(() => {
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(timer);
                closeRestModal();
            }
        }, 1000);
        
        // 关闭按钮
        document.getElementById('global-rest-close').onclick = () => {
            clearInterval(timer);
            closeRestModal();
        };
        
        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                clearInterval(timer);
                closeRestModal();
            }
        };
        
        // 语音提醒
        if (typeof speakMessage === 'function') {
            speakMessage('学习15分钟啦，该休息一下了');
        } else {
            fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '学习15分钟啦，该休息一下了' })
            }).catch(e => console.log('语音提醒失败:', e));
        }
    }
    
    function closeRestModal() {
        const modal = document.getElementById('global-rest-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        restModalVisible = false;
        // 重置计时器
        resetStartTime();
    }
    
    // 启动定时器
    function startRestTimer() {
        if (restTimerInterval) clearInterval(restTimerInterval);
        if (updateTimerInterval) clearInterval(updateTimerInterval);
        
        // 每分钟检查一次是否该休息
        restTimerInterval = setInterval(() => {
            checkAndShowRest();
        }, 60000);
        
        // 每秒更新一次显示
        updateTimerInterval = setInterval(() => {
            updateRemainingDisplay();
        }, 1000);
    }
    
    // 页面可见性变化时更新
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            updateRemainingDisplay();
            checkAndShowRest();
        }
    });
    
    // 初始化
    function init() {
        addAnimationStyle();
        createRemainingDisplay();
        startRestTimer();
        updateRemainingDisplay();
    }
    
    // 页面加载时启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 页面关闭时清理
    window.addEventListener('beforeunload', () => {
        if (restTimerInterval) clearInterval(restTimerInterval);
        if (updateTimerInterval) clearInterval(updateTimerInterval);
    });
})();