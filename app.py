import os
import cv2
import numpy as np
import tensorflow as tf
from flask import Flask, render_template, Response, jsonify
from flask_socketio import SocketIO, emit
import mediapipe as mp
import torch
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2Processor
import librosa
import pyaudio
import wave
import pyttsx3
from datetime import datetime
from threading import Lock

app = Flask(__name__)
socketio = SocketIO(app)

tts_lock = Lock()

# Emotion labels
emotions = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised']
facial_emotions = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']

# Audio model
model = Wav2Vec2ForSequenceClassification.from_pretrained("superb/wav2vec2-base-superb-er")
processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")

# Facial model
FACIAL_MODEL_PATH = 'archive/model.h5'
IMG_SIZE = (48, 48)
facial_model = tf.keras.models.load_model(FACIAL_MODEL_PATH)
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1)

# Text-to-speech
engine = pyttsx3.init()

def speak_text(text):
    with tts_lock:
        engine.stop()
        engine.say(text)
        engine.runAndWait()

def log_emotion(source, emotion):
    try:
        with open("emotion_logs.txt", "a") as f:
            f.write(f"{datetime.now()} - {source}: {emotion}\n")
    except Exception as e:
        print(f"Log error: {e}")

def predict_emotion(audio_path):
    try:
        audio, sr = librosa.load(audio_path, sr=16000)
        inputs = processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
        with torch.no_grad():
            logits = model(**inputs).logits
            pred_id = torch.argmax(logits, dim=-1)
            return emotions[pred_id[0]]
    except Exception as e:
        print(f"Prediction error: {e}")
        return "unknown"

def record_audio(path):
    chunk = 1024
    fmt = pyaudio.paInt16
    channels = 1
    rate = 16000
    seconds = 5
    p = pyaudio.PyAudio()
    try:
        stream = p.open(format=fmt, channels=channels, rate=rate, input=True, frames_per_buffer=chunk)
        frames = [stream.read(chunk) for _ in range(0, int(rate / chunk * seconds))]
        stream.stop_stream()
        stream.close()

        with wave.open(path, 'wb') as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(p.get_sample_size(fmt))
            wf.setframerate(rate)
            wf.writeframes(b''.join(frames))
    except Exception as e:
        print(f"Audio error: {e}")
    finally:
        p.terminate()

def generate_frames():
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, "Camera Not Accessible", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        _, buffer = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        return

    try:
        while True:
            success, frame = camera.read()
            if not success:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            if results.multi_face_landmarks:
                for landmarks in results.multi_face_landmarks:
                    x = [int(pt.x * frame.shape[1]) for pt in landmarks.landmark]
                    y = [int(pt.y * frame.shape[0]) for pt in landmarks.landmark]

                    if x and y:
                        roi = frame[max(0, min(y)):max(1, max(y)), max(0, min(x)):max(1, max(x))]
                        if roi.size != 0:
                            roi = cv2.resize(roi, IMG_SIZE)
                            roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) / 255.0
                            roi = roi.reshape(1, *IMG_SIZE, 1)
                            emotion_index = np.argmax(facial_model.predict(roi), axis=1)[0]
                            emotion = facial_emotions[emotion_index]

                            feedbacks = {
                                'angry': "It looks like you're angry.",
                                'disgust': "You seem disgusted.",
                                'fear': "You look scared.",
                                'happy': "You're smiling! Keep it up!",
                                'sad': "You seem sad.",
                                'surprise': "Wow, that's surprising!",
                                'neutral': "You have a neutral expression."
                            }

                            speak_text(feedbacks.get(emotion, "Emotion detected"))
                            log_emotion("Facial", emotion)
                            cv2.putText(frame, emotion, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    finally:
        camera.release()

@app.route('/')
def index():
    return render_template('intelli_vibe.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@socketio.on('detect_audio_emotion')
def handle_audio_emotion():
    path = "user_voice.wav"
    record_audio(path)
    emotion = predict_emotion(path)
    feedbacks = {
        "neutral": "Keep it neutral and steady!",
        "happy": "Great! You're sounding happy.",
        "sad": "Try to lift your spirits!",
        "angry": "Take a deep breath.",
        "fearful": "It's okay to be scared, focus on your breathing.",
        "disgust": "Find a positive thought.",
        "surprised": "Surprise can be exciting!"
    }
    log_emotion("Audio", emotion)
    emit('emotion_update', {'emotion': emotion, 'feedback': feedbacks.get(emotion, "Stay calm and focus!")})

if __name__ == '__main__':
    socketio.run(app, debug=True)













