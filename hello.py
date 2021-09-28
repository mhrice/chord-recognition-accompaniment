import uuid
import wave
from flask_socketio import SocketIO, emit
from flask import Flask, session, url_for
from my_test import *
import json

print("LOADED ALL IMPORTS")

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
app.config["FILEDIR"] = "C:\\Users\\mrice\\BTC-ISMIR19\\chord-recognition-fe\\recordings\\"

@app.route("/")
def index():
    return "Index!"


@socketio.on('message')
def message(message):
        print(message)


@socketio.on('start-recording')
def start_recording(options):
    print("starting record")
    """Start recording audio from the client."""
    id = uuid.uuid4().hex  # server-side filename
    session['wavename'] = id + '.wav'
    wf = wave.open(app.config['FILEDIR'] + session['wavename'], 'wb')
    wf.setnchannels(options.get('numChannels', 1))
    wf.setsampwidth(options.get('bps', 16) // 8)
    wf.setframerate(options.get('fps', 22050))
    session['wavefile'] = wf

@socketio.on('write-audio')
def write_audio(data):
    """Write a chunk of audio from the client."""
#     decoded_pcm = opus_decoder.decode(data)
#     print(decoded_pcm)
    print("RECEIVED AUDIO")
    session['wavefile'].writeframes(data)
#     print(type(data))



def process_audio(id):
        path = app.config['FILEDIR'] + id        
        output = run_model(path)
        emit('response', json.dumps(output))
        # audio, sr = librosa.load(path)
        # print(sr, audio.shape)

@socketio.on('end-recording')
def end_recording():
    """Stop recording audio from the client."""
    print("Stopping ")
#     emit('add-wavefile', url_for('static',
                                #  filename='_files/' + session['wavename']))
    session['wavefile'].close()
#     emit('add-wavefile', session['wavename'])
    process_audio(session['wavename'])

    del session['wavefile']
    del session['wavename']



if __name__ == "__main__":
    socketio.run(app)