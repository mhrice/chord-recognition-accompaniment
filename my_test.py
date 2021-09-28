import os
import mir_eval
from btc_model import *
from utils.mir_eval_modules import audio_file_to_features, idx2chord, idx2voca_chord, get_audio_paths
import argparse
import warnings

use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")
# Chord recognition and save lab file
config = HParams.load("run_config.yaml")
config.feature['large_voca'] = True
config.model['num_chords'] = 170
# model_file = './test/btc_model_large_voca.pt'
model_file = "C:\\data\music\\chord_recognition\\jayg996\\assets\\model\\idx_123_100.pth.tar"
idx_to_chord = idx2voca_chord()

model = BTC_model(config=config.model).to(device)
# Load model

mp3_config = config.mp3
feature_config = config.feature
mp3_string = "%d_%.1f_%.1f" % (mp3_config['song_hz'], mp3_config['inst_len'], mp3_config['skip_interval'])
feature_string = "_%s_%d_%d_%d_" % ('cqt', feature_config['n_bins'], feature_config['bins_per_octave'], feature_config['hop_length'])

z_path = os.path.join(config.path['root_path'], 'result', mp3_string + feature_string + 'mix_kfold_'+ str(5) +'_normalization.pt')

if os.path.isfile(model_file):
    checkpoint = torch.load(model_file)
    normalization = torch.load(z_path)
    mean = normalization['mean']
    std = normalization['std']
    model.load_state_dict(checkpoint['model'])
    print("restore model")


def run_model(audio_path):

    print("Processing...")
    # Load mp3
    feature, feature_per_second, song_length_second = audio_file_to_features(audio_path, config, test=True)
    print("audio file loaded and feature computation success : %s" % audio_path)

    # Majmin type chord recognition
    feature = feature.T
    feature = (feature - mean) / std
    time_unit = feature_per_second
    n_timestep = config.model['timestep']

    num_pad = n_timestep - (feature.shape[0] % n_timestep)
    feature = np.pad(feature, ((0, num_pad), (0, 0)), mode="constant", constant_values=0)
    num_instance = feature.shape[0] // n_timestep

    start_time = 0.0
    lines = []
    with torch.no_grad():
        model.eval()
        feature = torch.tensor(feature, dtype=torch.float32).unsqueeze(0).to(device)
        for t in range(num_instance):
            self_attn_output, _ = model.self_attn_layers(feature[:, n_timestep * t:n_timestep * (t + 1), :])
            prediction, _ = model.output_layer(self_attn_output)
            prediction = prediction.squeeze()
            for i in range(n_timestep):
                if t == 0 and i == 0:
                    prev_chord = prediction[i].item()
                    continue
                if prediction[i].item() != prev_chord:
                    lines.append(
                        '%.3f %.3f %s\n' % (start_time, time_unit * (n_timestep * t + i), idx_to_chord[prev_chord]))
                    start_time = time_unit * (n_timestep * t + i)
                    prev_chord = prediction[i].item()
                if t == num_instance - 1 and i + num_pad == n_timestep:
                    if start_time != time_unit * (n_timestep * t + i):
                        lines.append('%.3f %.3f %s\n' % (start_time, time_unit * (n_timestep * t + i), idx_to_chord[prev_chord]))
                    break
    return lines
#     save_path = os.path.join(args.save_dir, os.path.split(audio_path)[-1].replace('.mp3', '').replace('.wav', '') + '.lab')
#     with open(save_path, 'w') as f:
#         for line in lines:
#             f.write(line)

#     print("label file saved : %s" % save_path)

#     # lab file to midi file
    

#     starts, ends, pitchs = list(), list(), list()

#     intervals, chords = mir_eval.io.load_labeled_intervals(save_path)
#     for p in range(12):
#         for i, (interval, chord) in enumerate(zip(intervals, chords)):
#             root_num, relative_bitmap, _ = mir_eval.chord.encode(chord)
#             tmp_label = mir_eval.chord.rotate_bitmap_to_root(relative_bitmap, root_num)[p]
#             if i == 0:
#                 start_time = interval[0]
#                 label = tmp_label
#                 continue
#             if tmp_label != label:
#                 if label == 1.0:
#                     starts.append(start_time), ends.append(interval[0]), pitchs.append(p + 48)
#                 start_time = interval[0]
#                 label = tmp_label
#             if i == (len(intervals) - 1): 
#                 if label == 1.0:
#                     starts.append(start_time), ends.append(interval[1]), pitchs.append(p + 48)

#     midi = pm.PrettyMIDI()
#     instrument = pm.Instrument(program=0)

#     for start, end, pitch in zip(starts, ends, pitchs):
#         pm_note = pm.Note(velocity=120, pitch=pitch, start=start, end=end)
#         instrument.notes.append(pm_note)

#     midi.instruments.append(instrument)
#     midi.write(save_path.replace('.lab', '.midi'))    

