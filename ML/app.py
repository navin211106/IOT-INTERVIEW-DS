"""ML service. Run:  python app.py   (port 5000)

Scoring follows the paper:  Score = 0.4*Sim + 0.3*Clarity + 0.3*Conf
  Sim     = cosine similarity between the answer and the expected answer (TF-IDF vectors)
  Clarity = words spoken / time taken (words per minute)
  Conf    = (eye contact + facial stability) / 2, measured from the webcam frames
MFCC voice analysis (pitch, pauses, stress) is reported as extra information.
"""
import io
import os
import re
import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from features import SR, EMOTIONS, load_audio, mfcc_matrix, windows, acoustic_features

app = Flask(__name__)
CORS(app)

model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'emotion_cnn_lstm.keras')
try:
    from tensorflow import keras
    if os.path.exists(MODEL_PATH):
        model = keras.models.load_model(MODEL_PATH)
        print('Loaded CNN-LSTM emotion model')
    else:
        print('No trained model found: using a heuristic stress estimate. Run train_emotion.py to train one.')
except ImportError:
    print('TensorFlow not installed: using a heuristic stress estimate.')

face_cc = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Expected answer for each interview question (same order as the website)
REFS = [
    'I am a computer science student interested in machine learning and web development. I have built projects in Python and React during college and enjoy learning new skills and solving real problems.',
    'I built an interview system using React, Node.js and Python. My role was developing the frontend and scoring logic, and I was responsible for connecting it to the backend. I used data from candidates and worked with my team.',
    'Supervised learning trains on labeled data to predict labels, for classification and regression. Unsupervised learning finds structure in unlabeled data, for example clustering, without labels during training.',
    'Before a project deadline a teammate was stuck. I helped solve the problem, made a plan to prioritize the key features, and kept communication clear so the team delivered on time.',
    'A sensor sends readings to a microcontroller such as an ESP32, which uses WiFi and MQTT or HTTP to send data through a gateway to a cloud API, where it is stored in a database.',
    'I am improving my speaking under pressure. I practice daily, take feedback seriously, and follow a course to build the habit.',
]
HEDGES = ['maybe', 'i guess', 'i think', 'not sure',
          'sort of', 'kind of', 'probably', 'um', 'uh', 'perhaps']
VEC = TfidfVectorizer(stop_words='english', ngram_range=(1, 2)).fit(REFS)


def clamp(n):
    return int(max(0, min(100, round(n))))


def similarity(q, text):
    """Formula (2): cosine similarity of the answer vector A and expected answer vector B."""
    if not text.strip():
        return 0.0
    return float(cosine_similarity(VEC.transform([REFS[q]]), VEC.transform([text]))[0, 0])


def analyse_face(files):
    """Eye contact = share of frames with a frontal face and both eyes visible.
    Facial stability = how little the face position moves between frames. Formula (4): their average."""
    centers, looking, n = [], 0, 0
    for f in files:
        data = f.read()
        img = cv2.imdecode(np.frombuffer(data, np.uint8),
                           cv2.IMREAD_GRAYSCALE) if data else None
        if img is None:
            continue
        n += 1
        faces = face_cc.detectMultiScale(img, 1.2, 5, minSize=(60, 60))
        if len(faces) == 0:
            continue
        x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
        if len(eye_cc.detectMultiScale(img[y:y + h // 2, x:x + w], 1.1, 5)) >= 2:
            looking += 1
        centers.append(
            ((x + w / 2) / img.shape[1], (y + h / 2) / img.shape[0]))
    if n == 0:
        return None
    eye = 100 * looking / n
    stability = 0.0
    if len(centers) > 1:
        c = np.array(centers)
        motion = float(np.hypot(c[:, 0].std(), c[:, 1].std()))
        # movement of 15% of the frame = fully unstable
        stability = 100 * max(0.0, 1 - motion / 0.15)
    elif len(centers) == 1:
        stability = 100.0
    return {'eye_contact': clamp(eye), 'stability': clamp(stability), 'frames': n}


def analyse_voice(y, text):
    feats = acoustic_features(y, text)
    probs = None
    if model is not None:
        p = model.predict(windows(mfcc_matrix(y)), verbose=0).mean(axis=0)
        probs = {e: round(float(p[i]), 3) for i, e in enumerate(EMOTIONS)}
        stress = clamp(
            100 * sum(probs[k] for k in ('sad', 'angry', 'fearful', 'disgust')))
    else:
        stress = clamp(feats['pitch_cv'] * 120 + feats['pause_ratio'] * 70)
    return {**feats, 'stress': stress, 'confidence': 100 - stress, 'emotions': probs,
            'source': 'cnn-lstm' if probs else 'heuristic'}


@app.post('/analyze')
def analyze():
    q = min(max(int(request.form.get('q', 0)), 0), len(REFS) - 1)
    text = request.form.get('transcript', '').strip()
    low = text.lower()
    words = len(low.split())

    voice, seconds = None, float(request.form.get('seconds', 0) or 0)
    f = request.files.get('audio')
    if f:
        try:
            y = load_audio(io.BytesIO(f.read()))
            if len(y) >= SR:
                voice = analyse_voice(y, text)
                seconds = len(y) / SR
        except Exception as e:  # unreadable audio: ignore it
            print('Audio analysis failed:', e)
    face = analyse_face(request.files.getlist('frames'))

    sim = similarity(q, text)
    wpm = round(words / (seconds / 60)) if seconds > 1 and words else 0
    # formula (3), 150 words per minute = 100
    clarity = clamp(min(wpm / 150, 1) * 100)

    if face:
        confidence, source = clamp(
            (face['eye_contact'] + face['stability']) / 2), 'face'
    elif voice:
        confidence, source = voice['confidence'], 'voice'
    else:
        hedges = sum(bool(re.search(rf'\b{h}\b', low)) for h in HEDGES)
        confidence, source = (35 if words < 10 else max(
            30, 100 - hedges * 10)), 'text'

    return jsonify({'technical': clamp(sim * 100), 'communication': clarity, 'confidence': confidence,
                    'sim': round(sim, 3), 'wpm': wpm, 'face': face, 'voice': voice, 'confidence_source': source})


if __name__ == '__main__':
    app.run(port=5000)
