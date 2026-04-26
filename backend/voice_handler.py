"""
语音处理模块 - 使用 edge-tts + ffplay（支持打断 + 缓存，降低延迟）
"""
import speech_recognition as sr
import threading
import asyncio
import edge_tts
import tempfile
import os
import subprocess
import time
import queue
import hashlib

class VoiceHandler:
    def __init__(self):
        """初始化语音引擎"""
        self.recognizer = sr.Recognizer()

        # 可用的中文声线
        self.available_voices = {
            "晓萌女声": "zh-CN-XiaomengNeural",
            "晓晓女声": "zh-CN-XiaoxiaoNeural",
            "晓伊女声": "zh-CN-XiaoyiNeural",
        }

        self.current_voice = self.available_voices["晓晓女声"]
        self.current_rate = "+0%"

        # 控制变量
        self.current_process = None
        self.lock = threading.Lock()
        self.speech_queue = queue.Queue()
        self.worker_thread = None
        self.is_worker_running = True

        # ========== 缓存目录 ==========
        self.cache_dir = os.path.join(os.path.dirname(__file__), "voice_cache")
        os.makedirs(self.cache_dir, exist_ok=True)

        print(f"✅ 语音引擎初始化完成")
        print(f"   使用声线: 晓晓女声")
        print(f"   播放器: ffplay")
        print(f"   缓存目录: {self.cache_dir}")

        # 启动后台工作线程
        self.start_worker()
        
        # ========== 预加载常用语句 ==========
        self.preload_common_phrases()

    def get_cache_key(self, text):
        """生成缓存键"""
        return hashlib.md5(f"{text}_{self.current_voice}".encode()).hexdigest()

    def get_cached_path(self, text):
        """获取缓存的音频文件路径"""
        cache_key = self.get_cache_key(text)
        return os.path.join(self.cache_dir, f"{cache_key}.mp3")
    
    def is_cached(self, text):
        """检查是否已缓存"""
        return os.path.exists(self.get_cached_path(text))

    def generate_audio(self, text, output_path):
        """生成音频文件"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                communicate = edge_tts.Communicate(text, self.current_voice, rate=self.current_rate)
                loop.run_until_complete(communicate.save(output_path))
                return True
            finally:
                loop.close()
        except Exception as e:
            print(f"生成音频失败: {e}")
            return False

    def preload_common_phrases(self):
        """预加载常用语句到缓存（后台进行，不阻塞启动）"""
        common_phrases = [
            # 基础问候
            "你好呀",
            "我是小智",
            "你好呀，我是小智",
            "让我陪你一起学习吧",
            
            # 认识物品
            "我来帮你认识物品",
            "把东西放在摄像头前面",
            "摄像头已开启",
            "我看到了",
            "把物品放到摄像头前",
            
            # 讲故事相关
            "讲故事",
            "我来给你讲故事",
            "从前",
            "故事讲完了",
            
            # 猜谜语相关
            "猜谜语",
            "我们来猜谜语吧",
            "答案是",
            "你猜对了吗",
            
            # 反馈
            "没听清楚",
            "原来是这样",
            "你真棒",
            "继续加油",
            "太厉害了",
            
            # 休息提醒
            "休息好了吗",
            "我们继续学习吧",
            "该休息啦",
            
            # 重置
            "已经全部重置啦",
            "我们可以重新开始咯",
            
            # 再见
            "再见啦",
            "下次再来玩哦",
        ]
        
        def preload():
            print("📦 开始预加载常用语音...")
            count = 0
            for phrase in common_phrases:
                if not self.is_cached(phrase):
                    print(f"   预加载: {phrase}")
                    self.generate_audio(phrase, self.get_cached_path(phrase))
                    count += 1
                    time.sleep(0.2)  # 避免请求过快
            print(f"✅ 预加载完成！共缓存 {count} 条语音")
        
        threading.Thread(target=preload, daemon=True).start()

    def start_worker(self):
        """启动后台工作线程处理语音队列"""
        def worker():
            while self.is_worker_running:
                try:
                    text = self.speech_queue.get(timeout=0.5)
                    if text is None:
                        continue
                    self._speak_sync(text)
                except queue.Empty:
                    continue
                except Exception as e:
                    print(f"语音工作线程错误: {e}")

        self.worker_thread = threading.Thread(target=worker, daemon=True)
        self.worker_thread.start()

    def stop_current(self):
        """立即停止当前播放的语音"""
        with self.lock:
            if self.current_process and self.current_process.poll() is None:
                try:
                    self.current_process.terminate()
                    self.current_process = None
                    print("🛑 已停止当前语音")
                except Exception as e:
                    print(f"停止语音失败: {e}")

    def clear_queue(self):
        """清空语音队列"""
        cleared = 0
        while not self.speech_queue.empty():
            try:
                self.speech_queue.get_nowait()
                cleared += 1
            except:
                break
        if cleared > 0:
            print(f"🗑️ 已清空 {cleared} 条待播放语音")

    def speak(self, text: str):
        """文字转语音（新语音会打断旧语音，使用缓存）"""
        if not text or not text.strip():
            return

        # 打断模式：清空队列，停止当前播放
        self.clear_queue()
        self.stop_current()

        # 加入队列立即播放
        self.speech_queue.put(text.strip())

    def _speak_sync(self, text: str):
        """同步播放语音（由工作线程调用，使用缓存）"""
        process = None
        try:
            # ========== 使用缓存 ==========
            cached_path = self.get_cached_path(text)
            
            if os.path.exists(cached_path):
                # 使用缓存，直接播放
                print(f"📦 使用缓存: {text[:30]}...")
                audio_path = cached_path
            else:
                # 生成新音频并缓存
                print(f"🎤 生成新音频: {text[:30]}...")
                audio_path = cached_path
                if not self.generate_audio(text, audio_path):
                    return

            # 播放
            process = subprocess.Popen(
                ["ffplay", "-autoexit", "-nodisp", "-loglevel", "quiet", audio_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            with self.lock:
                self.current_process = process

            # 等待播放完成
            process.wait()

        except Exception as e:
            print(f"语音播报错误: {e}")
        finally:
            with self.lock:
                if self.current_process == process:
                    self.current_process = None

    def listen(self):
        """语音识别"""
        try:
            with sr.Microphone() as source:
                print("🎤 正在听...")
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=5)
                text = self.recognizer.recognize_google(audio, language='zh-CN')
                print(f"✅ 识别到: {text}")
                return text
        except sr.WaitTimeoutError:
            print("⏰ 语音识别超时")
            return None
        except sr.UnknownValueError:
            print("❓ 无法识别语音")
            return None
        except Exception as e:
            print(f"语音识别错误: {e}")
            return None

    def __del__(self):
        """析构函数"""
        self.is_worker_running = False
        self.clear_queue()
        self.stop_current()
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=1)


if __name__ == "__main__":
    print("测试语音模块...")
    vh = VoiceHandler()
    vh.speak("小朋友们好呀，我是小智")
    time.sleep(2)
    vh.speak("第二句话会打断第一句")
    time.sleep(3)
    print("测试完成")