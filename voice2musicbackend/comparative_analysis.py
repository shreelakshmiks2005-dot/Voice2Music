import os
import glob
import pandas as pd
import numpy as np
import datetime
import matplotlib.pyplot as plt
from io import BytesIO
import base64
import librosa
import matplotlib.gridspec as gridspec

# -------------------- CONFIG --------------------
FEEDBACK_FILE = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\comparitative_analysis_report\feedback.csv"
REPORT_FILE = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\comparitative_analysis_report\model_comparative_report.html"

PERFORMANCE_RNN_OUTPUT = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\performancernn"
MUSICVAE_OUTPUT = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\music_vae"

METRICS = ["melody_rating", "accompaniment_rating", "overall_rating"]

# -------------------- HELPER: LOAD FEEDBACK --------------------
def load_feedback():
    if not os.path.exists(FEEDBACK_FILE):
        df = pd.DataFrame(columns=["timestamp", "model"] + METRICS)
        df.to_csv(FEEDBACK_FILE, index=False)
    df = pd.read_csv(FEEDBACK_FILE)
    # Remove any completely empty rows
    df = df.dropna(subset=["model"], how="all")
    return df

# -------------------- HELPER: GET LATEST AUDIO FILES --------------------
def get_latest_model_files():
    model_audio_paths = {}
    perf_files = glob.glob(os.path.join(PERFORMANCE_RNN_OUTPUT, "*.wav"))
    musicvae_files = glob.glob(os.path.join(MUSICVAE_OUTPUT, "*.wav"))

    if perf_files:
        latest_perf = max(perf_files, key=os.path.getctime)
        model_audio_paths["PerformanceRNN"] = latest_perf

    if musicvae_files:
        latest_musicvae = max(musicvae_files, key=os.path.getctime)
        model_audio_paths["MusicVAE"] = latest_musicvae

    return model_audio_paths

# -------------------- AUDIO METRICS --------------------
def extract_audio_metrics(path):
    try:
        y, sr = librosa.load(path, sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)
        rms_energy = float(np.mean(librosa.feature.rms(y=y)))
        spectral_contrast = float(np.mean(librosa.feature.spectral_contrast(y=y, sr=sr)))
        harmonic_y = librosa.effects.harmonic(y)
        harmony_fit = float(np.mean(np.abs(harmonic_y)))
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo = float(librosa.beat.tempo(onset_envelope=onset_env, sr=sr)[0])
        onset_frames = librosa.onset.onset_detect(y=harmonic_y, sr=sr)
        note_density = len(onset_frames) / duration if duration > 0 else 0
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        return {
            "duration": duration,
            "energy": rms_energy,
            "spectral_contrast": spectral_contrast,
            "harmony_fit": harmony_fit,
            "tempo": tempo,
            "note_density": note_density,
            "spectral_centroid": spectral_centroid
        }
    except Exception as e:
        print(f"Error processing {path}: {e}")
        return {"duration": 0, "energy": 0, "spectral_contrast": 0,
                "harmony_fit": 0, "tempo": 0, "note_density": 0,
                "spectral_centroid": 0}

def analyze_audio_models(model_audio_paths):
    results = {}
    for model, path in model_audio_paths.items():
        results[model] = extract_audio_metrics(path)
    return results

# -------------------- PLOT HELPER --------------------
def plot_to_base64(fig):
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")

# -------------------- GENERATE HTML REPORT --------------------
def generate_html_report():
    df_feedback = load_feedback()
    model_audio_paths = get_latest_model_files()
    audio_metrics = analyze_audio_models(model_audio_paths)

    feedback_avg = df_feedback.groupby("model")[METRICS].mean()
    audio_df = pd.DataFrame(audio_metrics).T

    # --------- FEEDBACK BAR GRAPH ---------
    fig, ax = plt.subplots(figsize=(7, 4))
    feedback_avg.plot(kind="bar", ax=ax)
    ax.set_title("User Feedback Comparison", fontsize=13)
    ax.set_ylabel("Average Score")
    ax.set_ylim(0, 5)
    feedback_b64 = plot_to_base64(fig)

    # --------- AUDIO METRICS SIDE-BY-SIDE BAR GRAPHS ---------
    fig2 = plt.figure(figsize=(12, 4))
    gs = gridspec.GridSpec(1, 2, width_ratios=[1, 1], wspace=0.5)

    # Left subplot: duration, spectral_contrast, tempo
    ax2 = fig2.add_subplot(gs[0])
    left_metrics = ['duration', 'spectral_contrast', 'tempo']
    bar_width = 0.25
    indices = np.arange(len(audio_df))
    colors_left = ['#1f77b4', '#ff7f0e', '#2ca02c']
    for i, metric in enumerate(left_metrics):
        ax2.bar(indices + i*bar_width, audio_df[metric], width=bar_width, label=metric, color=colors_left[i])
    ax2.set_title("Large-Scale Audio Metrics")
    ax2.set_xticks(indices + bar_width)
    ax2.set_xticklabels(audio_df.index)
    ax2.set_ylim(0, audio_df[left_metrics].max().max()*1.2)
    ax2.legend()

    # Right subplot: energy, harmony_fit, note_density, spectral_centroid (normalized)
    ax3 = fig2.add_subplot(gs[1])
    right_metrics = ['energy', 'harmony_fit', 'note_density', 'spectral_centroid']
    colors_right = ['#FF5733', '#33C1FF', '#FFD700', '#00FFAA']
    bar_width2 = 0.18
    indices2 = np.arange(len(audio_df))
    for i, metric in enumerate(right_metrics):
        ax3.bar(indices2 + i*bar_width2, audio_df[metric]/audio_df[metric].max(),
                width=bar_width2, color=colors_right[i], label=metric)
    ax3.set_title("Small-Scale Audio Metrics (Normalized)")
    ax3.set_xticks(indices2 + bar_width2*1.5)
    ax3.set_xticklabels(audio_df.index)
    ax3.set_ylim(0, 1.2)
    ax3.legend()

    audio_b64 = plot_to_base64(fig2)

    # --------- HTML CONTENT ---------
    html = f"""
    <html>
    <head>
        <title>Model Comparative Analysis Report</title>
        <style>
            body {{
                font-family: 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #001f54 0%, #9d00ff 100%);
                padding: 20px;
            }}
            .card {{
                background: rgba(255, 255, 255, 0.85);
                border-radius: 18px;
                padding: 25px;
                margin-bottom: 35px;
                backdrop-filter: blur(10px);
                box-shadow: 0 4px 25px rgba(0,0,0,0.2);
            }}
            h1 {{
                text-align: center;
                color: #ffffff;
                text-shadow: 0 0 10px rgba(0,0,0,0.4);
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }}
            th {{
                background: #4b0082;
                color: white;
                padding: 10px;
            }}
            td {{
                padding: 10px;
                background: #ffffff;
                text-align: center;
                border-bottom: 1px solid #ccc;
            }}
        </style>
    </head>
    <body>
        <h1>Model Comparative Analysis Report</h1>

        <div class="card">
            <h2>User Feedback Results</h2>
            <div style="margin-bottom:30px;">
                {feedback_avg.to_html(classes='table table-striped')}
            </div>
            <div style="text-align:center; margin-top:30px;">
                <img src="data:image/png;base64,{feedback_b64}" style="max-width:90%; border-radius:12px;">
            </div>
        </div>

        <div class="card">
            <h2>Audio-Based Evaluation Metrics</h2>
            <div style="margin-bottom:30px;">
                {audio_df.to_html(classes='table table-striped')}
            </div>
            <div style="text-align:center; margin-top:20px;">
                <img src="data:image/png;base64,{audio_b64}" style="max-width:90%; border-radius:12px;">
            </div>
        </div>

        <div class="card">
            <h2>Notes</h2>
            <p>• Metrics include Duration, RMS Energy, Spectral Contrast, Spectral Centroid, Harmony Fit, Tempo, and Note Density.</p>
            <p>• Feedback remains the primary evaluation of perceptual quality.</p>
            <p>• Audio metrics indicate alignment, harmonic consistency, rhythmic stability, and accompaniment richness.</p>
        </div>

    </body>
    </html>
    """

    os.makedirs(os.path.dirname(REPORT_FILE), exist_ok=True)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print("\n✨ Report successfully generated!")
    print("Saved to:", REPORT_FILE)

# -------------------- MAIN --------------------
if __name__ == "__main__":
    generate_html_report()
