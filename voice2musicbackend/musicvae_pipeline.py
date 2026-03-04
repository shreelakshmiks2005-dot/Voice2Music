# musicvae_pipeline.py

import os
import numpy as np
import librosa
import pretty_midi
import soundfile as sf
import subprocess
from magenta.models.music_vae import configs
from magenta.models.music_vae.trained_model import TrainedModel
from magenta.music import midi_io

def run_music_vae(input_wav, output_folder, output_file=None):
    """
    input_wav: path to uploaded WAV file
    output_folder: folder to save outputs
    output_file: full path to save final mixed WAV output
    returns: path to final mixed WAV file
    """
    os.makedirs(output_folder, exist_ok=True)

    if output_file is None:
        base_name = os.path.basename(input_wav).rsplit(".", 1)[0]
        output_file = os.path.join(output_folder, f"{base_name}_musicvae.wav")

    # -------------------------------
    # File paths
    # -------------------------------
    input_midi_path = os.path.join(output_folder, "input_melody.mid")
    generated_trio_midi = os.path.join(output_folder, "generated_trio_uncondtest.mid")
    combined_midi = os.path.join(output_folder, "combined_trio_test.mid")
    generated_audio = os.path.join(output_folder, "generated_trio_test.wav")

    # -------------------------------
    # User config
    # -------------------------------
    checkpoint_path = r"C:\Users\monit\Desktop\react project\voice2musicbackend\models\hierdec-trio_16bar\hierdec-trio_16bar.ckpt"
    soundfont_path = r"C:\Users\monit\Desktop\react project\voice2musicbackend\models\TimGM6mb.sf2"
    fluidsynth_exe = r"C:\Users\monit\Desktop\react project\voice2musicbackend\models\fluidsynth-v2.5.1-win10-x64-cpp11\bin\fluidsynth.exe"

    # -------------------------------
    # Step 0: Audio → MIDI
    # -------------------------------
    y, sr = librosa.load(input_wav, sr=16000)
    import crepe
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
    pm.write(input_midi_path)

    # -------------------------------
    # Step 1: Generate MusicVAE trio
    # -------------------------------
    config = configs.CONFIG_MAP['hierdec-trio_16bar']
    model = TrainedModel(config, batch_size=1, checkpoint_dir_or_path=checkpoint_path)

    generated_seq = model.sample(n=1, length=256, temperature=0.8)[0]
    midi_io.sequence_proto_to_midi_file(generated_seq, generated_trio_midi)

    # -------------------------------
    # Step 2: Replace melody track
    # -------------------------------
    gen_pm = pretty_midi.PrettyMIDI(generated_trio_midi)
    input_pm = pretty_midi.PrettyMIDI(input_midi_path)

    target_inst = gen_pm.instruments[0]
    target_inst.notes = []
    src_inst = input_pm.instruments[0]
    for n in src_inst.notes:
        if n.start < gen_pm.get_end_time():
            end_time = min(n.end, gen_pm.get_end_time())
            target_inst.notes.append(pretty_midi.Note(velocity=100, pitch=n.pitch, start=n.start, end=end_time))

    gen_pm.write(combined_midi)

    # -------------------------------
    # Step 3: Render MIDI → WAV using FluidSynth
    # -------------------------------
    cmd = [
        fluidsynth_exe,
        "-ni",
        "-a", "null",
        "-F", generated_audio,
        soundfont_path,
        combined_midi
    ]
    subprocess.run(cmd, check=True)

    # -------------------------------
    # Step 4: Mix voice + accompaniment
    # -------------------------------
    voice_audio, vsr = sf.read(input_wav)
    music_audio, msr = sf.read(generated_audio)

    # Resample if needed
    if vsr != msr:
        voice_audio = librosa.resample(voice_audio.astype(np.float32), orig_sr=vsr, target_sr=msr)
        vsr = msr

    # Mono mix
    if voice_audio.ndim > 1:
        voice_audio = np.mean(voice_audio, axis=1)
    if music_audio.ndim > 1:
        music_audio = np.mean(music_audio, axis=1)

    minlen = min(len(voice_audio), len(music_audio))
    mixed = voice_audio[:minlen] + music_audio[:minlen] * 1.2

    mx = np.max(np.abs(mixed))
    if mx > 1.0:
        mixed = mixed / mx

    sf.write(output_file, mixed.astype(np.float32), msr)
    print(f"✅ MusicVAE final output saved: {output_file}")
    return output_file
