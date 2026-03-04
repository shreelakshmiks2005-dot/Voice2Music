# new_performance_rnn.py

import os
import subprocess
import pretty_midi
import librosa
from note_seq import midi_file_to_note_sequence, sequence_proto_to_midi_file
from magenta.models.performance_rnn import performance_sequence_generator
from magenta.models.shared import sequence_generator_bundle
from note_seq.protobuf import generator_pb2
from pydub import AudioSegment
from pydub.effects import compress_dynamic_range, normalize, low_pass_filter, high_pass_filter
import crepe

# -------------------------------
# CONFIG (adjust paths as needed)
# -------------------------------
OUTPUT_FOLDER = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\performancernn"
PERFORMANCE_BUNDLE = r"C:\Users\monit\Desktop\react project\voice2musicbackend\models\performance_with_dynamics.mag"
SOUNDFONT = r"C:\Users\monit\Desktop\react project\voice2musicbackend\models\TimGM6mb.sf2"
FLUIDSYNTH_EXE = r"C:\Users\monit\Desktop\react project\voice2musicbackend\models\fluidsynth-v2.5.1-win10-x64-cpp11\bin\fluidsynth.exe"

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# -------------------------------
# PERFORMANCE RNN PIPELINE
# -------------------------------
def run_performance_rnn(input_wav, output_file=None):
    """
    input_wav: full path to WAV file
    output_file: full path to save the final mixed WAV
    returns: full path to final mixed WAV output
    """
    if output_file is None:
        output_file = os.path.join(OUTPUT_FOLDER, "voice_music_rich.wav")

    input_midi = os.path.join(OUTPUT_FOLDER, "input_melody.mid")
    generated_midi = os.path.join(OUTPUT_FOLDER, "performance_generated.mid")

    # Step 1: Audio -> MIDI
    y, sr = librosa.load(input_wav, sr=16000)
    time, freq, confidence, _ = crepe.predict(y, sr, viterbi=True)

    pm = pretty_midi.PrettyMIDI()
    inst = pretty_midi.Instrument(program=0)
    notes = []
    for t, f, c in zip(time, freq, confidence):
        if c > 0.5 and f > 0:
            n = int(pretty_midi.hz_to_note_number(f))
            notes.append((n, t, t + 0.25))
    if not notes:
        notes.append((60, 0.0, 0.5))

    # Merge consecutive notes
    merged = []
    cur, start, end = notes[0]
    for n, s, e in notes[1:]:
        if n == cur and s - end < 0.1:
            end = e
        else:
            merged.append((cur, start, end))
            cur, start, end = n, s, e
    merged.append((cur, start, end))

    for n, s, e in merged:
        note = pretty_midi.Note(velocity=100, pitch=n, start=s, end=e)
        inst.notes.append(note)
    pm.instruments.append(inst)
    pm.write(input_midi)

    # Step 2: Load PerformanceRNN
    bundle = sequence_generator_bundle.read_bundle_file(PERFORMANCE_BUNDLE)
    generator_map = performance_sequence_generator.get_generator_map()
    model = generator_map['performance_with_dynamics'](checkpoint=None, bundle=bundle)
    model.initialize()

    # Step 3: Generate accompaniment
    seq = midi_file_to_note_sequence(input_midi)
    if seq.total_time == 0:
        n = seq.notes.add()
        n.pitch = 60
        n.start_time = 0.0
        n.end_time = 0.5

    start_time = seq.total_time + 0.01
    end_time = start_time + 32.0
    options = generator_pb2.GeneratorOptions()
    options.args['temperature'].float_value = 1.2
    options.generate_sections.add(start_time=start_time, end_time=end_time)
    generated_seq = model.generate(seq, options)
    sequence_proto_to_midi_file(generated_seq, generated_midi)

    # Step 4: Split layers + synthesize
    pm_gen = pretty_midi.PrettyMIDI(generated_midi)
    bass = pretty_midi.Instrument(program=32)
    mid = pretty_midi.Instrument(program=0)
    high = pretty_midi.Instrument(program=0)
    for inst in pm_gen.instruments:
        for note in inst.notes:
            bass.notes.append(pretty_midi.Note(max(50, note.velocity), max(0, note.pitch - 12), note.start, note.end))
            mid.notes.append(pretty_midi.Note(max(50, note.velocity), note.pitch, note.start, note.end))
            high.notes.append(pretty_midi.Note(max(50, note.velocity), min(127, note.pitch + 12), note.start, note.end))

    def synth_layer(inst, out_wav):
        temp_midi = out_wav.replace(".wav","_temp.mid")
        pm_temp = pretty_midi.PrettyMIDI()
        pm_temp.instruments.append(inst)
        pm_temp.write(temp_midi)
        cmd = [FLUIDSYNTH_EXE, "-ni", "-F", out_wav, "-T", "wav", SOUNDFONT, temp_midi]
        subprocess.run(cmd, check=True)
        os.remove(temp_midi)

    # Intermediate layer files
    bass_wav = os.path.join(OUTPUT_FOLDER, "bass.wav")
    mid_wav  = os.path.join(OUTPUT_FOLDER, "mid.wav")
    high_wav = os.path.join(OUTPUT_FOLDER, "high.wav")
    synth_layer(bass, bass_wav)
    synth_layer(mid, mid_wav)
    synth_layer(high, high_wav)

    # Step 5: Mix with voice
    voice = AudioSegment.from_wav(input_wav)
    bass_seg = AudioSegment.from_wav(bass_wav).pan(-0.5) + 4
    mid_seg  = AudioSegment.from_wav(mid_wav).pan(0.0) + 6
    high_seg = AudioSegment.from_wav(high_wav).pan(0.5) + 4

    for t in [bass_seg, mid_seg, high_seg]:
        if len(t) < len(voice):
            t += AudioSegment.silent(duration=(len(voice)-len(t)))

    voice = compress_dynamic_range(voice, threshold=-20.0, ratio=2.0)
    voice = normalize(voice)
    voice = high_pass_filter(voice, 80)
    voice = low_pass_filter(voice, 12000)

    final_mix_seg = voice.overlay(bass_seg).overlay(mid_seg).overlay(high_seg)
    final_mix_seg = normalize(final_mix_seg)

    # Save final mix to the custom output_file
    final_mix_seg.export(output_file, format="wav")

    return output_file
