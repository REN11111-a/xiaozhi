/**
 * VRM数字人动作模块
 * 包含所有动作函数：挥手、敬礼、鞠躬、点头、叉腰等
 * 
 * 使用方法：
 * 1. 在 HTML 中引入此文件：<script src="/shuziren/vrm_actions.js"></script>
 * 2. 确保全局有 window.vrmModel 对象（VRM模型实例）
 * 3. 调用动作函数：waveHand()、salute()、bow()、nodHead() 等
 */

// ========== 配置参数 ==========
const ARM_DOWN_ANGLE = 1.3;   // 手臂自然下垂角度
const ACTION_SPEED = {
    stepDelay: 80,    // 步骤间隔（毫秒）
    waveInterval: 60, // 挥手间隔
    nodInterval: 60,  // 点头间隔
    holdTime: 800,    // 动作保持时间
    bowHoldTime: 1500 // 鞠躬保持时间
};

// 全局计时器
let actionTimer = null;
let currentAction = null;

// ========== 工具函数 ==========

// 重置所有骨骼到初始状态
function resetBones() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('等待模型加载...');
        return;
    }
    
    // 清除当前动作计时器
    if (actionTimer) {
        clearTimeout(actionTimer);
        clearInterval(actionTimer);
        actionTimer = null;
    }
    
    // 头部
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    if (head) head.rotation.set(0, 0, 0);
    
    // 手臂 - 自然下垂
    const rightArm = window.vrmModel.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftArm = window.vrmModel.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightForearm = window.vrmModel.humanoid.getNormalizedBoneNode('rightLowerArm');
    const leftForearm = window.vrmModel.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightHand = window.vrmModel.humanoid.getNormalizedBoneNode('rightHand');
    const leftHand = window.vrmModel.humanoid.getNormalizedBoneNode('leftHand');
    
    if (rightArm) rightArm.rotation.set(0, 0, ARM_DOWN_ANGLE);
    if (leftArm) leftArm.rotation.set(0, 0, -ARM_DOWN_ANGLE);
    if (rightForearm) rightForearm.rotation.set(0, 0, 0.1);
    if (leftForearm) leftForearm.rotation.set(0, 0, -0.1);
    if (rightHand) rightHand.rotation.set(0, 0, 0);
    if (leftHand) leftHand.rotation.set(0, 0, 0);
    
    // 脊椎
    const spine = window.vrmModel.humanoid.getNormalizedBoneNode('spine');
    if (spine) spine.rotation.set(0, 0, 0);
    
    const chest = window.vrmModel.humanoid.getNormalizedBoneNode('chest');
    if (chest) chest.rotation.set(0, 0, 0);
    
    // 重置位置和旋转
    if (window.vrmModel.scene) {
        window.vrmModel.scene.position.y = -0.85;
        window.vrmModel.scene.rotation.y = 0;
    }
    
    currentAction = null;
}

// 平滑插值
function smoothLerp(start, end, factor) {
    return start + (end - start) * factor;
}

// 停止当前动作
function stopCurrentAction() {
    if (actionTimer) {
        clearTimeout(actionTimer);
        clearInterval(actionTimer);
        actionTimer = null;
    }
    resetBones();
}

// ========== 1. 挥手动作 ==========
function waveHand() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const rightArm = window.vrmModel.humanoid.getNormalizedBoneNode('rightUpperArm');
    const rightForearm = window.vrmModel.humanoid.getNormalizedBoneNode('rightLowerArm');
    const rightHand = window.vrmModel.humanoid.getNormalizedBoneNode('rightHand');
    const spine = window.vrmModel.humanoid.getNormalizedBoneNode('spine');
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    
    // 初始姿势
    if (rightArm) {
        rightArm.rotation.x = -0.2;
        rightArm.rotation.z = 0.3;
    }
    if (rightForearm) {
        rightForearm.rotation.x = -1.2;
        rightForearm.rotation.y = 0.1;
    }
    if (rightHand) {
        rightHand.rotation.x = 0.2;
        rightHand.rotation.y = -0.1;
    }
    if (head) head.rotation.x = 0.1;
    if (spine) spine.rotation.z = 0.05;
    
    let waveStep = 0;
    let phase = 0;
    
    actionTimer = setInterval(() => {
        if (!rightForearm || !rightArm) return;
        
        if (waveStep < 20) {
            const swingAmount = Math.sin(phase * 0.8) * 0.7;
            rightForearm.rotation.y = smoothLerp(rightForearm.rotation.y, 1 + swingAmount, 0.3);
            rightForearm.rotation.x = -1.2;
            
            if (rightHand) {
                rightHand.rotation.y = smoothLerp(rightHand.rotation.y, -0.1 + swingAmount * 0.5, 0.3);
            }
            if (head) {
                head.rotation.x = smoothLerp(head.rotation.x, 0.1 + Math.sin(phase * 0.8) * 0.05, 0.3);
                head.rotation.y = smoothLerp(head.rotation.y, Math.sin(phase * 0.8) * 0.1, 0.3);
            }
            
            phase += 0.8;
            waveStep++;
        } else {
            // 恢复
            if (head) {
                head.rotation.x *= 0.9;
                head.rotation.y *= 0.9;
            }
            if (spine) spine.rotation.z *= 0.9;
            
            if (rightArm.rotation.z > ARM_DOWN_ANGLE) {
                rightArm.rotation.z += 0.08;
                rightArm.rotation.x *= 0.9;
                rightForearm.rotation.x += 0.15;
                rightForearm.rotation.y *= 0.9;
                
                if (rightHand) {
                    rightHand.rotation.x *= 0.9;
                    rightHand.rotation.y *= 0.9;
                }
            } else {
                resetBones();
                clearInterval(actionTimer);
                actionTimer = null;
                currentAction = null;
            }
        }
    }, ACTION_SPEED.waveInterval);
    
    currentAction = 'waveHand';
}

// ========== 2. 敬礼动作 ==========
function salute() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const spine = window.vrmModel.humanoid.getNormalizedBoneNode('spine');
    const chest = window.vrmModel.humanoid.getNormalizedBoneNode('chest');
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    const rightArm = window.vrmModel.humanoid.getNormalizedBoneNode('rightUpperArm');
    const rightForearm = window.vrmModel.humanoid.getNormalizedBoneNode('rightLowerArm');
    const rightHand = window.vrmModel.humanoid.getNormalizedBoneNode('rightHand');
    
    let salutePhase = 0;
    
    function doSalute() {
        if (!window.vrmModel) {
            return;
        }
        
        switch(salutePhase) {
            case 0:
                if (spine) spine.rotation.x = -0.05;
                if (chest) chest.rotation.x = -0.03;
                if (head) head.rotation.x = -0.05;
                salutePhase = 1;
                actionTimer = setTimeout(doSalute, ACTION_SPEED.stepDelay);
                break;
            case 1:
                if (rightArm) {
                    rightArm.rotation.x = -0.2;
                    rightArm.rotation.z = 0.3;
                }
                if (rightForearm) {
                    rightForearm.rotation.x = -1.2;
                    rightForearm.rotation.y = 0.1;
                }
                salutePhase = 2;
                actionTimer = setTimeout(doSalute, ACTION_SPEED.stepDelay);
                break;
            case 2:
                if (rightArm) {
                    rightArm.rotation.x = -0.2;
                    rightArm.rotation.z = 0.1;
                }
                if (rightForearm) {
                    rightForearm.rotation.x = -1.5;
                    rightForearm.rotation.y = 2.3;
                }
                if (rightHand) {
                    rightHand.rotation.x = -2;
                    rightHand.rotation.y = 0;
                    rightHand.rotation.z = 0.1;
                }
                if (head) {
                    head.rotation.x = -0.08;
                    head.rotation.y = 0.05;
                }
                salutePhase = 3;
                actionTimer = setTimeout(doSalute, ACTION_SPEED.holdTime);
                break;
            case 3:
                if (rightArm) {
                    rightArm.rotation.x *= 0.8;
                    rightArm.rotation.z *= 0.8;
                }
                if (rightForearm) {
                    rightForearm.rotation.x *= 0.8;
                    rightForearm.rotation.y *= 0.8;
                }
                if (rightHand) {
                    rightHand.rotation.x *= 0.8;
                }
                if (head) {
                    head.rotation.x *= 0.8;
                    head.rotation.y *= 0.8;
                }
                salutePhase = 4;
                actionTimer = setTimeout(doSalute, ACTION_SPEED.stepDelay);
                break;
            case 4:
                if (rightArm) {
                    rightArm.rotation.x *= 0.7;
                    rightArm.rotation.z *= 0.7;
                }
                if (rightForearm) {
                    rightForearm.rotation.x *= 0.7;
                    rightForearm.rotation.y *= 0.7;
                }
                salutePhase = 5;
                actionTimer = setTimeout(doSalute, ACTION_SPEED.stepDelay);
                break;
            case 5:
                if (rightArm) {
                    rightArm.rotation.x = 0;
                    rightArm.rotation.z = ARM_DOWN_ANGLE;
                }
                if (rightForearm) {
                    rightForearm.rotation.x = 0;
                    rightForearm.rotation.y = 0;
                    rightForearm.rotation.z = 0.1;
                }
                if (rightHand) {
                    rightHand.rotation.x = 0;
                }
                salutePhase = 6;
                actionTimer = setTimeout(doSalute, ACTION_SPEED.stepDelay);
                break;
            case 6:
                if (spine) spine.rotation.x = 0;
                if (chest) chest.rotation.x = 0;
                if (head) {
                    head.rotation.x = 0;
                    head.rotation.y = 0;
                }
                salutePhase = 7;
                actionTimer = setTimeout(doSalute, ACTION_SPEED.stepDelay);
                break;
            case 7:
                resetBones();
                clearTimeout(actionTimer);
                actionTimer = null;
                currentAction = null;
                break;
        }
    }
    
    salutePhase = 0;
    doSalute();
    currentAction = 'salute';
}

// ========== 3. 鞠躬动作 ==========
function bow() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const spine = window.vrmModel.humanoid.getNormalizedBoneNode('spine');
    const chest = window.vrmModel.humanoid.getNormalizedBoneNode('chest');
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    const rightArm = window.vrmModel.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftArm = window.vrmModel.humanoid.getNormalizedBoneNode('leftUpperArm');
    
    let bowStep = 0;
    
    function doBow() {
        if (!window.vrmModel) {
            return;
        }
        
        switch(bowStep) {
            case 0:
                if (spine) spine.rotation.x = -0.3;
                if (chest) chest.rotation.x = -0.2;
                if (head) head.rotation.x = -0.2;
                if (rightArm) rightArm.rotation.z = ARM_DOWN_ANGLE + 0.2;
                if (leftArm) leftArm.rotation.z = -ARM_DOWN_ANGLE - 0.2;
                bowStep = 1;
                actionTimer = setTimeout(doBow, ACTION_SPEED.stepDelay);
                break;
            case 1:
                if (spine) spine.rotation.x = -0.6;
                if (chest) chest.rotation.x = -0.4;
                if (head) head.rotation.x = -0.3;
                bowStep = 2;
                actionTimer = setTimeout(doBow, ACTION_SPEED.stepDelay);
                break;
            case 2:
                if (spine) spine.rotation.x = -0.8;
                if (chest) chest.rotation.x = -0.5;
                if (head) head.rotation.x = -0.4;
                bowStep = 3;
                actionTimer = setTimeout(doBow, ACTION_SPEED.bowHoldTime);
                break;
            case 3:
                if (spine) spine.rotation.x = -0.6;
                if (chest) chest.rotation.x = -0.4;
                if (head) head.rotation.x = -0.3;
                bowStep = 4;
                actionTimer = setTimeout(doBow, ACTION_SPEED.stepDelay);
                break;
            case 4:
                if (spine) spine.rotation.x = -0.3;
                if (chest) chest.rotation.x = -0.2;
                if (head) head.rotation.x = -0.2;
                bowStep = 5;
                actionTimer = setTimeout(doBow, ACTION_SPEED.stepDelay);
                break;
            case 5:
                resetBones();
                clearTimeout(actionTimer);
                actionTimer = null;
                currentAction = null;
                break;
        }
    }
    
    bowStep = 0;
    doBow();
    currentAction = 'bow';
}

// ========== 4. 点头动作 ==========
function nodHead() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    let nodCount = 0;
    
    actionTimer = setInterval(() => {
        if (!head) return;
        
        if (nodCount < 4) {
            const t = Date.now() * 0.008;
            head.rotation.x = Math.sin(t) * 0.4;
            nodCount++;
        } else {
            if (Math.abs(head.rotation.x) > 0.01) {
                head.rotation.x *= 0.9;
            } else {
                head.rotation.x = 0;
                clearInterval(actionTimer);
                actionTimer = null;
                currentAction = null;
            }
        }
    }, ACTION_SPEED.nodInterval);
    
    currentAction = 'nodHead';
}

// ========== 5. 叉腰动作 ==========
function handsOnHips() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const rightArm = window.vrmModel.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftArm = window.vrmModel.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightForearm = window.vrmModel.humanoid.getNormalizedBoneNode('rightLowerArm');
    const leftForearm = window.vrmModel.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightHand = window.vrmModel.humanoid.getNormalizedBoneNode('rightHand');
    const leftHand = window.vrmModel.humanoid.getNormalizedBoneNode('leftHand');
    const spine = window.vrmModel.humanoid.getNormalizedBoneNode('spine');
    const chest = window.vrmModel.humanoid.getNormalizedBoneNode('chest');
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    
    let step = 0;
    
    function doNextStep() {
        if (!window.vrmModel) {
            return;
        }
        
        switch(step) {
            case 0:
                if (rightArm) rightArm.rotation.z = 0.5;
                if (leftArm) leftArm.rotation.z = -0.5;
                step = 1;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 1:
                if (rightArm) rightArm.rotation.z = 0.5;
                if (leftArm) leftArm.rotation.z = -0.5;
                step = 2;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 2:
                if (rightArm) rightArm.rotation.z = 0.6;
                if (leftArm) leftArm.rotation.z = -0.6;
                if (rightForearm) rightForearm.rotation.z = 0.5;
                if (leftForearm) leftForearm.rotation.z = -0.5;
                step = 3;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 3:
                if (rightArm) rightArm.rotation.z = 0.7;
                if (leftArm) leftArm.rotation.z = -0.7;
                if (rightForearm) rightForearm.rotation.z = 1.2;
                if (leftForearm) leftForearm.rotation.z = -1.2;
                if (rightHand) rightHand.rotation.x = 0.2;
                if (leftHand) leftHand.rotation.x = 0.2;
                step = 4;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 4:
                if (rightArm) rightArm.rotation.z = 0.8;
                if (leftArm) leftArm.rotation.z = -0.8;
                if (rightForearm) rightForearm.rotation.z = 1.5;
                if (leftForearm) leftForearm.rotation.z = -1.5;
                if (spine) spine.rotation.z = 0.03;
                if (chest) chest.rotation.z = 0.02;
                if (head) head.rotation.x = 0.05;
                step = 5;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.holdTime);
                break;
            case 5:
                if (rightForearm) rightForearm.rotation.z = 0.3;
                if (leftForearm) leftForearm.rotation.z = -0.3;
                if (rightArm) rightArm.rotation.z = 0.9;
                if (leftArm) leftArm.rotation.z = -0.9;
                if (rightHand) rightHand.rotation.x = 0.1;
                if (leftHand) leftHand.rotation.x = 0.1;
                if (spine) spine.rotation.z = 0.01;
                if (chest) chest.rotation.z = 0.01;
                step = 6;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 6:
                if (rightForearm) rightForearm.rotation.z = 0.1;
                if (leftForearm) leftForearm.rotation.z = -0.1;
                if (rightArm) rightArm.rotation.z = 0.9;
                if (leftArm) leftArm.rotation.z = -0.8;
                if (rightHand) rightHand.rotation.x = 0;
                if (leftHand) leftHand.rotation.x = 0;
                step = 7;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 7:
                if (rightForearm) rightForearm.rotation.z = 0;
                if (leftForearm) leftForearm.rotation.z = 0;
                if (rightArm) rightArm.rotation.z = 0.9;
                if (leftArm) leftArm.rotation.z = -0.9;
                step = 8;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 8:
                if (rightArm) rightArm.rotation.z = 1;
                if (leftArm) leftArm.rotation.z = -1;
                step = 9;
                actionTimer = setTimeout(doNextStep, ACTION_SPEED.stepDelay);
                break;
            case 9:
                resetBones();
                if (head) head.rotation.x = 0;
                clearTimeout(actionTimer);
                actionTimer = null;
                currentAction = null;
                break;
        }
    }
    
    step = 0;
    doNextStep();
    currentAction = 'handsOnHips';
}

// ========== 6. 指向动作 ==========
function point() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const rightArm = window.vrmModel.humanoid.getNormalizedBoneNode('rightUpperArm');
    const rightForearm = window.vrmModel.humanoid.getNormalizedBoneNode('rightLowerArm');
    const rightHand = window.vrmModel.humanoid.getNormalizedBoneNode('rightHand');
    const indexFinger = window.vrmModel.humanoid.getNormalizedBoneNode('rightIndexProximal');
    const spine = window.vrmModel.humanoid.getNormalizedBoneNode('spine');
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    
    let step = 0;
    
    function doPoint() {
        if (!window.vrmModel) {
            return;
        }
        
        switch(step) {
            case 0:
                if (rightArm) {
                    rightArm.rotation.x = -0.3;
                    rightArm.rotation.z = 0.2;
                }
                if (spine) spine.rotation.x = -0.05;
                if (head) head.rotation.x = -0.1;
                step = 1;
                actionTimer = setTimeout(doPoint, ACTION_SPEED.stepDelay);
                break;
            case 1:
                if (rightForearm) {
                    rightForearm.rotation.x = -1.5;
                    rightForearm.rotation.y = 0.5;
                }
                if (rightHand) {
                    rightHand.rotation.x = -0.5;
                    rightHand.rotation.z = 0.2;
                }
                if (indexFinger) {
                    indexFinger.rotation.x = -0.8;
                }
                step = 2;
                actionTimer = setTimeout(doPoint, ACTION_SPEED.holdTime);
                break;
            case 2:
                if (rightForearm) {
                    rightForearm.rotation.x = -1.2;
                    rightForearm.rotation.y = 0.3;
                }
                if (rightHand) {
                    rightHand.rotation.x = -0.3;
                }
                if (indexFinger) {
                    indexFinger.rotation.x = -0.4;
                }
                step = 3;
                actionTimer = setTimeout(doPoint, ACTION_SPEED.stepDelay);
                break;
            case 3:
                resetBones();
                clearTimeout(actionTimer);
                actionTimer = null;
                currentAction = null;
                break;
        }
    }
    
    step = 0;
    doPoint();
    currentAction = 'point';
}

// ========== 7. 打招呼（挥手+鞠躬） ==========
function greet() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    waveHand();
    setTimeout(() => {
        if (currentAction === 'waveHand') {
            stopCurrentAction();
            bow();
        }
    }, 1500);
    currentAction = 'greet';
}

// ========== 8. 摇头动作 ==========
function shakeHead() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    let shakeCount = 0;
    
    actionTimer = setInterval(() => {
        if (!head) return;
        
        if (shakeCount < 6) {
            const t = Date.now() * 0.01;
            head.rotation.y = Math.sin(t) * 0.5;
            shakeCount++;
        } else {
            if (Math.abs(head.rotation.y) > 0.01) {
                head.rotation.y *= 0.9;
            } else {
                head.rotation.y = 0;
                clearInterval(actionTimer);
                actionTimer = null;
                currentAction = null;
            }
        }
    }, ACTION_SPEED.nodInterval);
    
    currentAction = 'shakeHead';
}

// ========== 9. 兴奋跳跃 ==========
function jump() {
    if (!window.vrmModel || !window.vrmModel.scene) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const originalY = window.vrmModel.scene.position.y;
    let jumpStep = 0;
    
    function doJump() {
        if (!window.vrmModel || !window.vrmModel.scene) {
            return;
        }
        
        switch(jumpStep) {
            case 0:
                window.vrmModel.scene.position.y = originalY + 0.15;
                jumpStep = 1;
                actionTimer = setTimeout(doJump, 100);
                break;
            case 1:
                window.vrmModel.scene.position.y = originalY;
                jumpStep = 2;
                actionTimer = setTimeout(doJump, 100);
                break;
            case 2:
                window.vrmModel.scene.position.y = originalY + 0.1;
                jumpStep = 3;
                actionTimer = setTimeout(doJump, 80);
                break;
            case 3:
                window.vrmModel.scene.position.y = originalY;
                jumpStep = 4;
                actionTimer = setTimeout(doJump, 80);
                break;
            case 4:
                window.vrmModel.scene.position.y = originalY + 0.05;
                jumpStep = 5;
                actionTimer = setTimeout(doJump, 60);
                break;
            case 5:
                window.vrmModel.scene.position.y = originalY;
                clearTimeout(actionTimer);
                actionTimer = null;
                currentAction = null;
                break;
        }
    }
    
    jumpStep = 0;
    doJump();
    currentAction = 'jump';
}

// ========== 10. 思考动作 ==========
function think() {
    if (!window.vrmModel || !window.vrmModel.humanoid) {
        console.log('模型未加载');
        return;
    }
    
    stopCurrentAction();
    
    const rightArm = window.vrmModel.humanoid.getNormalizedBoneNode('rightUpperArm');
    const rightForearm = window.vrmModel.humanoid.getNormalizedBoneNode('rightLowerArm');
    const rightHand = window.vrmModel.humanoid.getNormalizedBoneNode('rightHand');
    const head = window.vrmModel.humanoid.getNormalizedBoneNode('head');
    const spine = window.vrmModel.humanoid.getNormalizedBoneNode('spine');
    
    let step = 0;
    
    function doThink() {
        if (!window.vrmModel) {
            return;
        }
        
        switch(step) {
            case 0:
                if (rightArm) {
                    rightArm.rotation.x = -0.2;
                    rightArm.rotation.z = 0.5;
                }
                if (spine) spine.rotation.x = -0.05;
                if (head) head.rotation.x = -0.1;
                step = 1;
                actionTimer = setTimeout(doThink, ACTION_SPEED.stepDelay);
                break;
            case 1:
                if (rightForearm) {
                    rightForearm.rotation.x = -1.2;
                    rightForearm.rotation.z = 0.5;
                }
                if (rightHand) {
                    rightHand.rotation.x = -0.3;
                    rightHand.rotation.z = 0.2;
                }
                step = 2;
                actionTimer = setTimeout(doThink, ACTION_SPEED.holdTime);
                break;
            case 2:
                resetBones();
                clearTimeout(actionTimer);
                actionTimer = null;
                currentAction = null;
                break;
        }
    }
    
    step = 0;
    doThink();
    currentAction = 'think';
}

// ========== 导出全局函数 ==========
window.resetBones = resetBones;
window.stopCurrentAction = stopCurrentAction;
window.waveHand = waveHand;
window.salute = salute;
window.bow = bow;
window.nodHead = nodHead;
window.handsOnHips = handsOnHips;
window.point = point;
window.greet = greet;
window.shakeHead = shakeHead;
window.jump = jump;
window.think = think;

console.log('VRM动作模块已加载，可用函数: waveHand(), salute(), bow(), nodHead(), handsOnHips(), point(), greet(), shakeHead(), jump(), think()');