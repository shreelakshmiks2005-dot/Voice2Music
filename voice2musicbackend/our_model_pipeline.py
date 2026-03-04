# our_model_pipeline.py

from pathlib import Path
import shutil
import traceback

# import your full Phase 1 code here
from Phase1_Final.phase1_code import main as phase1_main


def run_our_model(input_wav_path, output_folder, output_file):
    """
    Runs your Phase-1 pipeline using the uploaded WAV.
    Returns the final output WAV path.
    """
    try:
        input_path = Path(input_wav_path)

        # The model expects audio.wav inside its folder
        phase1_audio = Path(r"C:\Users\monit\Desktop\react project\voice2musicbackend\Phase1_Final\audio.wav")

        # Copy uploaded audio → model input
        shutil.copy(input_path, phase1_audio)

        print("🎤 Running our custom model...")
        phase1_main()   # run your pipeline

        # Your model always outputs: final_with_voice_and_music.wav
        final_mix = Path(r"C:\Users\monit\Desktop\react project\voice2musicbackend\Phase1_Final\final_with_voice_and_music.wav")

        # Save to flask output folder
        shutil.copy(final_mix, output_file)

        print("🎶 Our model output saved:", output_file)
        return output_file

    except Exception as e:
        print("❌ OUR MODEL ERROR:", e)
        traceback.print_exc()
        return None
