"""
YOLO物体识别模块 + 人脸检测
"""
from ultralytics import YOLO
import cv2
import numpy as np

class YOLODetector:
    def __init__(self, model_path="../models/yolov8n.pt"):
        self.model = YOLO(model_path)
        self.class_names_cn = {
            0: '人', 1: '自行车', 2: '汽车', 3: '摩托车', 4: '飞机',
            5: '公交车', 6: '火车', 7: '卡车', 8: '船', 9: '红绿灯',
            10: '消防栓', 11: '停止标志', 12: '停车计时器', 13: '长椅',
            14: '鸟', 15: '猫', 16: '狗', 17: '马', 18: '羊', 19: '牛',
            20: '大象', 21: '熊', 22: '斑马', 23: '长颈鹿', 24: '背包',
            25: '雨伞', 26: '手提包', 27: '领带', 28: '行李箱', 29: '飞盘',
            30: '滑雪板', 31: '滑雪板', 32: '球', 33: '风筝', 34: '棒球棒',
            35: '棒球手套', 36: '滑板', 37: '冲浪板', 38: '网球拍', 39: '瓶子',
            40: '酒杯', 41: '杯子', 42: '叉子', 43: '刀子', 44: '勺子',
            45: '碗', 46: '香蕉', 47: '苹果', 48: '三明治', 49: '橙子',
            50: '西兰花', 51: '胡萝卜', 52: '热狗', 53: '披萨', 54: '甜甜圈',
            55: '蛋糕', 56: '椅子', 57: '沙发', 58: '盆栽', 59: '床',
            60: '餐桌', 61: '马桶', 62: '电视', 63: '笔记本电脑', 64: '鼠标',
            65: '遥控器', 66: '键盘', 67: '手机', 68: '微波炉', 69: '烤箱',
            70: '烤面包机', 71: '水槽', 72: '冰箱', 73: '书', 74: '时钟',
            75: '花瓶', 76: '剪刀', 77: '玩具熊', 78: '吹风机', 79: '牙刷'
        }
        
        # 加载人脸检测模型（OpenCV自带）
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    def detect_face_distance(self, frame):
        """检测人脸并判断距离
        
        返回:
            - distance_status: 'normal', 'close', 'too_close'
            - face_size: 人脸大小（宽度）
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 5)
        
        if len(faces) == 0:
            return 'normal', 0
        
        # 取最大的人脸
        (x, y, w, h) = max(faces, key=lambda f: f[2] * f[3])
        face_size = w
        
        # 判断距离（根据人脸宽度）
        # 这些阈值可以根据实际摄像头调整
        if face_size > 250:
            return 'too_close', face_size  # 太近（小于20cm）
        elif face_size > 220:
            return 'close', face_size      # 偏近（20-40cm）
        else:
            return 'normal', face_size     # 正常（大于40cm）
    
    def detect(self, image_bytes):
        """识别图片中的物体"""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        results = self.model(img, conf=0.3, verbose=False)
        
        detected = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                cls_id = int(box.cls[0])
                chinese_name = self.class_names_cn.get(cls_id, str(cls_id))
                confidence = float(box.conf[0])
                detected.append({
                    'name': chinese_name,
                    'confidence': round(confidence, 2)
                })
        
        unique = []
        seen = set()
        for item in detected:
            if item['name'] not in seen:
                seen.add(item['name'])
                unique.append(item)
        
        return unique[:5]