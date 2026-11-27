"""Train the CNN-LSTM speech emotion model on RAVDESS.
Usage:  python train_emotion.py "C:\\path\\to\\RAVDESS"   (folder containing Actor_01 ... Actor_24)
"""
import glob
import os
import sys
import numpy as np
from tensorflow import keras
from tensorflow.keras import layers
from features import EMOTIONS, N_MFCC, MAX_FRAMES, load_audio, mfcc_matrix, windows


def build():
    inp = keras.Input((MAX_FRAMES, N_MFCC, 1))
    x = layers.BatchNormalization()(inp)
    x = layers.Conv2D(32, 3, padding='same', activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D(2)(x)
    x = layers.Conv2D(64, 3, padding='same', activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D(2)(x)
    x = layers.Reshape((MAX_FRAMES // 4, (N_MFCC // 4) * 64)
                       )(x)  # CNN output as a time sequence
    x = layers.LSTM(128)(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(64, activation='relu')(x)
    out = layers.Dense(len(EMOTIONS), activation='softmax')(x)
    m = keras.Model(inp, out)
    m.compile('adam', 'sparse_categorical_crossentropy', metrics=['accuracy'])
    return m


def main(root):
    files = glob.glob(os.path.join(root, '**', '*.wav'), recursive=True)
    if not files:
        sys.exit('No .wav files found in ' + root)
    Xtr, ytr, Xva, yva = [], [], [], []
    for n, f in enumerate(files, 1):
        # emotion code in the file name
        label = int(os.path.basename(f).split('-')[2]) - 1
        actor = int(''.join(ch for ch in os.path.basename(
            os.path.dirname(f)) if ch.isdigit()) or 0)
        w = windows(mfcc_matrix(load_audio(f)))
        # actors 21-24 held out for validation
        (Xva if actor > 20 else Xtr).extend(w)
        (yva if actor > 20 else ytr).extend([label] * len(w))
        if n % 100 == 0:
            print(f'{n}/{len(files)} files processed')
    Xtr, ytr, Xva, yva = map(np.array, (Xtr, ytr, Xva, yva))
    model = build()
    model.fit(Xtr, ytr, validation_data=(Xva, yva), epochs=40, batch_size=32,
              callbacks=[keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True)])
    print('Validation accuracy:', model.evaluate(Xva, yva, verbose=0)[1])
    model.save(os.path.join(os.path.dirname(
        __file__), 'emotion_cnn_lstm.keras'))
    print('Saved emotion_cnn_lstm.keras')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
