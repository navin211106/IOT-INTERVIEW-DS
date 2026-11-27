"""Shared audio feature code: MFCC extraction (used for training and live analysis)."""
import numpy as np
import librosa

SR = 16000
N_MFCC = 40
HOP = 256
MAX_FRAMES = 200  # about 3.2 seconds per window
EMOTIONS = ['neutral', 'calm', 'happy', 'sad', 'angry',
            'fearful', 'disgust', 'surprised']  # RAVDESS order


def load_audio(src):
    y, _ = librosa.load(src, sr=SR, mono=True)
    y, _ = librosa.effects.trim(y, top_db=30)
    return y


def mfcc_matrix(y):
    """Mel-Frequency Cepstral Coefficients, shape (frames, N_MFCC)."""
    m = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=N_MFCC,
                             n_fft=1024, hop_length=HOP)
    return m.T


def windows(m):
    """Cut the MFCC matrix into fixed windows for the CNN-LSTM. Shape (N, MAX_FRAMES, N_MFCC, 1)."""
    out = []
    for s in range(0, max(len(m), 1), MAX_FRAMES):
        c = m[s:s + MAX_FRAMES]
        if out and len(c) < MAX_FRAMES // 4:
            break
        out.append(np.pad(c, ((0, MAX_FRAMES - len(c)), (0, 0))))
    return np.array(out)[..., None]


def acoustic_features(y, transcript=''):
    """Pitch, energy, pauses and speech rate."""
    dur = len(y) / SR
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0]
    f0 = librosa.yin(y, fmin=70, fmax=400, sr=SR,
                     frame_length=2048, hop_length=HOP)
    n = min(len(rms), len(f0))
    voiced = rms[:n] > 0.3 * rms[:n].mean()
    pitch = f0[:n][voiced]
    pitch_mean = float(pitch.mean()) if len(pitch) else 0.0
    pitch_cv = float(pitch.std() / pitch_mean) if pitch_mean else 0.0
    speech = sum(e - s for s, e in librosa.effects.split(y, top_db=30))
    words = len(transcript.split())
    return {
        'duration': round(dur, 2),
        'pitch_mean': round(pitch_mean, 1),
        'pitch_cv': round(pitch_cv, 3),
        'energy': round(float(rms.mean()), 4),
        'pause_ratio': round(1 - speech / len(y), 3),
        'speech_rate_wpm': round(words / (dur / 60)) if dur > 1 and words else 0,
    }
