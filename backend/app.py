from flask import Flask, render_template, Response, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import time
import threading
import os
import base64
import numpy as np

from yolo_detector import YOLODetector
from voice_handler import VoiceHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))   # 指向 backend 文件夹

app = Flask(__name__, 
            static_folder=os.path.join(BASE_DIR, 'frontend'),
            template_folder=os.path.join(BASE_DIR, 'frontend'))
CORS(app)

detector = YOLODetector()
voice = VoiceHandler()

camera = None
camera_lock = threading.Lock()
detected_objects = []
face_distance_status = 'normal'
face_size = 0

# ========== 主页 ==========
@app.route('/')
def index():
    return render_template('index.html')
# ========== AI 问答页面 ==========
@app.route('/ai')
def ai_page():
    return render_template('ai.html')
# ========== 游戏大厅 ==========
@app.route('/games')
def games_hub():
    return render_template('games_hub.html')

# ========== 具体游戏 ==========
@app.route('/game/<game_name>')
def play_game(game_name):
    # game 文件夹位于项目根目录（与 backend 同级）
    root_dir = os.path.dirname(BASE_DIR)          # 项目根目录 KID_ROBOT_WEB
    game_folder = os.path.join(root_dir, 'game', game_name)
    if not os.path.isdir(game_folder):
        return "游戏不存在", 404
    return send_from_directory(game_folder, 'index.html')

# ========== 摄像头视频流 ==========
def get_camera():
    global camera
    with camera_lock:
        if camera is None:
            camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return camera

def generate_frames():
    global detected_objects, face_distance_status, face_size
    
    cap = get_camera()
    frame_count = 0
    
    while True:
        try:
            success, frame = cap.read()
            if not success:
                time.sleep(0.05)
                continue
            
            frame_count += 1
            
            if frame_count % 5 == 0:
                try:
                    results = detector.model(frame, conf=0.3, verbose=False)
                    detected = []
                    if results[0].boxes is not None:
                        for box in results[0].boxes:
                            cls_id = int(box.cls[0])
                            chinese_name = detector.class_names_cn.get(cls_id, str(cls_id))
                            detected.append(chinese_name)
                    detected_objects = list(dict.fromkeys(detected))[:5]
                    
                    distance_status, f_size = detector.detect_face_distance(frame)
                    face_distance_status = distance_status
                    face_size = int(f_size)
                    
                    frame = results[0].plot()
                except Exception as e:
                    print(f"检测错误: {e}")
            
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            time.sleep(0.03)
            
        except Exception as e:
            print(f"视频流错误: {e}")
            time.sleep(0.1)

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

# ========== API 接口 ==========
@app.route('/api/get_detected')
def get_detected():
    return jsonify({'objects': detected_objects})

@app.route('/api/get_distance')
def get_distance():
    return jsonify({'status': face_distance_status, 'face_size': int(face_size)})

@app.route('/api/speak', methods=['POST'])
def speak():
    data = request.get_json()
    text = data.get('text', '')
    
    def do_speak():
        try:
            voice.speak(text)
        except Exception as e:
            print(f"语音错误: {e}")
    
    threading.Thread(target=do_speak, daemon=True).start()
    return jsonify({'status': 'ok'})

@app.route('/api/stop_speak', methods=['POST'])
def stop_speak():
    voice.stop_current()
    return jsonify({'status': 'ok'})

# ========== 新增：拍照识别接口 ==========
@app.route('/api/detect_from_frame', methods=['POST'])
def detect_from_frame():
    """从拍照帧识别物体"""
    try:
        data = request.get_json()
        image_data = data.get('image', '')
        
        # 解析base64图片
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        # 转换为numpy数组
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # YOLO识别
        results = detector.model(img, conf=0.3, verbose=False)
        
        # 获取识别结果
        detected = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                cls_id = int(box.cls[0])
                chinese_name = detector.class_names_cn.get(cls_id, str(cls_id))
                detected.append(chinese_name)
        
        # 去重
        unique = list(dict.fromkeys(detected))[:5]
        
        print(f"拍照识别结果: {unique}")
        return jsonify({'objects': unique})
        
    except Exception as e:
        print(f"拍照识别错误: {e}")
        return jsonify({'objects': []})

# ========== 语音识别接口（备用） ==========
@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """语音识别接口（备用）"""
    try:
        # 获取上传的音频文件
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({'text': '', 'error': '没有音频文件'})
        
        # 保存临时文件
        temp_path = os.path.join(BASE_DIR, 'temp_audio.wav')
        audio_file.save(temp_path)
        
        # 使用 speech_recognition 进行识别
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_path) as source:
            audio = recognizer.record(source)
        
        # 识别中文
        text = recognizer.recognize_google(audio, language='zh-CN')
        
        # 删除临时文件
        os.remove(temp_path)
        
        return jsonify({'text': text})
        
    except Exception as e:
        print(f"语音识别错误: {e}")
        return jsonify({'text': '', 'error': str(e)})

@app.route('/api/set_eye_protection', methods=['POST'])
def set_eye_protection():
    return jsonify({'status': 'ok'})

# ========== 小智数字人 ==========
@app.route('/xiaozhi')
def xiaozhi():
    return render_template('xiaozhi_2d_to_3d.html')

# ========== 数学思维分类页 ==========

@app.route('/game/math_quiz')
def math_quiz_index():
    return render_template('game/math_quiz/index.html')

@app.route('/game/math_quiz/arithmetic')
def arithmetic():
    return render_template('game/math_quiz/arithmetic.html')

@app.route('/game/math_quiz/multiplication')
def multiplication():
    return render_template('game/math_quiz/multiplication.html')

@app.route('/game/math_quiz/sorting')
def sorting():
    return render_template('game/math_quiz/sorting.html')


# ========== 快乐阅读分类页 ==========
@app.route('/game/reading')
def reading_index():
    return render_template('game/reading/index.html')

@app.route('/game/reading/story_quiz')
def story_quiz():
    return render_template('game/reading/story_quiz.html')

@app.route('/game/reading/word_match')
def word_match():
    return render_template('game/reading/word_match.html')

@app.route('/game/reading/sentence_sort')
def sentence_sort():
    return render_template('game/reading/sentence_sort.html')

# ========== 艺术创想分类页 ==========
@app.route('/game/art')
def art_index():
    return render_template('game/art/index.html')

@app.route('/game/art/drawing_pad')
def drawing_pad():
    return render_template('game/art/drawing_pad.html')

@app.route('/game/art/color_mix')
def color_mix():
    return render_template('game/art/color_mix.html')

@app.route('/game/art/rhythm_game')
def rhythm_game():
    return render_template('game/art/rhythm_game.html')

# ========== 益智拼图分类页 ==========
@app.route('/game/puzzle')
def puzzle_index():
    return render_template('game/puzzle/index.html')

@app.route('/game/puzzle/memory_match')
def memory_match():
    return render_template('game/puzzle/memory_match.html')

@app.route('/game/puzzle/spot_diff')
def spot_diff():
    return render_template('game/puzzle/spot_diff.html')

@app.route('/game/puzzle/jigsaw')
def jigsaw():
    return render_template('game/puzzle/jigsaw.html')

# ========== 科学探索分类页 ==========
@app.route('/game/science')
def science_index():
    return render_template('game/science/index.html')

@app.route('/game/science/animal_quiz')
def animal_quiz():
    return render_template('game/science/animal_quiz.html')

@app.route('/game/science/plant_growth')
def plant_growth():
    return render_template('game/science/plant_growth.html')

@app.route('/game/science/density_lab')
def density_lab():
    return render_template('game/science/density_lab.html')

# ========== 玩具工坊分类页 ==========
@app.route('/game/toy')
def toy_index():
    return render_template('game/toy/index.html')

@app.route('/game/toy/virtual_pet')
def virtual_pet():
    return render_template('game/toy/virtual_pet.html')

@app.route('/game/toy/dress_up')
def dress_up():
    return render_template('game/toy/dress_up.html')

@app.route('/game/toy/role_play')
def role_play():
    return render_template('game/toy/role_play.html')
# ========== AI 问答接口（调用硅基流动 DeepSeek API） ==========
import requests
import json

# 硅基流动 API 配置
SILICONFLOW_API_KEY = "sk-nzwqyvtfqrhqxygoipebslzmiuswnpyqhitccowjorxoaijw" 
SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions"

@app.route('/api/ai_chat', methods=['POST'])
def ai_chat():
    """AI 智能问答接口"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({'reply': '请问你想问什么呢？'})
        
        # 构建请求头
        headers = {
            "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # 构建请求体
        payload = {
            "model": "deepseek-ai/DeepSeek-V3",
            "messages": [
                {"role": "system", "content": "你叫小智，是一个儿童启蒙机器人助手。你回答问题时应该：1. 用简单易懂的语言 2. 回答要亲切友善 3. 适合小朋友理解 4. 回答要生动有趣 5. 不要说太长，控制在100字以内"},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.7,
            "max_tokens": 500,
            "stream": False
        }
        
        # 发送请求
        response = requests.post(SILICONFLOW_API_URL, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            return jsonify({'reply': reply})
        else:
            print(f"API请求失败: {response.status_code}, {response.text}")
            return jsonify({'reply': 'AI服务暂时不可用，请稍后再试~'})
            
    except requests.exceptions.Timeout:
        return jsonify({'reply': 'AI思考时间太长啦，请再问一次~'})
    except Exception as e:
        print(f"AI问答错误: {e}")
        return jsonify({'reply': '哎呀，出错了，请稍后再试~'})
# ========== 静态资源：3D数字人模型 ==========
@app.route('/shuziren/<path:filename>')
def serve_shuziren(filename):
    # 直接访问根目录下的 shuziren 文件夹
    root_dir = os.path.dirname(BASE_DIR)  # 项目根目录
    return send_from_directory(os.path.join(root_dir, 'shuziren'), filename)
# ========== 启动 ==========
if __name__ == '__main__':
    print("=" * 50)
    print("小智儿童启蒙机器人启动中...")
    print("访问地址: http://127.0.0.1:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)