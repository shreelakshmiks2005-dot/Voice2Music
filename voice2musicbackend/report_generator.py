import os
import pandas as pd
import numpy as np
import librosa
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Non-GUI backend
import matplotlib.gridspec as gridspec
from io import BytesIO
import base64
import glob
from datetime import datetime

# -------------------- PATHS --------------------
BASE_FOLDER = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\comparitative_analysis_report"
REPORT_FILE = os.path.join(BASE_FOLDER, "model_comparative_report.html")
FEEDBACK_CSV = os.path.join(BASE_FOLDER, "feedback.csv")

# AUDIO OUTPUT PATHS
model_audio_paths = {
    "Our Model": r"C:\Users\monit\Desktop\react project\voice2musicbackend\Phase1_Final",
    "Performance-RNN": r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\performancernn",
    "MusicVAE": r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\music_vae",
}

# -------------------- LOAD FEEDBACK --------------------
def load_feedback():
    # If first run, return empty structure
    if not os.path.exists(FEEDBACK_CSV):
        return pd.DataFrame(
            columns=["melody_rating", "accompaniment_rating", "overall_rating"],
            index=["Our Model", "Performance-RNN", "MusicVAE"]
        )

    # Read CSV safely
    df = pd.read_csv(
        FEEDBACK_CSV,
        names=["timestamp", "model", "melody_rating", "accompaniment_rating", "overall_rating"],
        header=0
    )

    # Fix timestamps
    df['timestamp'] = pd.to_datetime(
        df['timestamp'],
        format="%d/%m/%Y, %H:%M:%S",
        errors='coerce'
    )

    # Normalize model names
    model_map = {
        "CustomModel": "Our Model",
        "Our Custom Model": "Our Model",
        "PerformanceRNN": "Performance-RNN",
        "Performance-RNN": "Performance-RNN",
        "MusicVAE": "MusicVAE"
    }
    df["model"] = df["model"].map(lambda x: model_map.get(x, x))

    # Drop rows with invalid timestamps OR invalid model names
    df = df.dropna(subset=["timestamp", "model"])

    # Only keep known 3 models
    df = df[df["model"].isin(["Our Model", "Performance-RNN", "MusicVAE"])]

    # If CSV has no valid entries
    if df.empty:
        return pd.DataFrame(
            columns=["melody_rating", "accompaniment_rating", "overall_rating"],
            index=["Our Model", "Performance-RNN", "MusicVAE"]
        )

    # Compute **latest feedback for each model**
    latest_feedback = df.loc[df.groupby("model")["timestamp"].idxmax()]

    # Set index
    latest_feedback = latest_feedback.set_index("model")[
        ["melody_rating", "accompaniment_rating", "overall_rating"]
    ]

    # Ensure all three models exist
    for m in ["Our Model", "Performance-RNN", "MusicVAE"]:
        if m not in latest_feedback.index:
            latest_feedback.loc[m] = [pd.NA, pd.NA, pd.NA]

    # Sort in fixed order
    latest_feedback = latest_feedback.loc[
        ["Our Model", "Performance-RNN", "MusicVAE"]
    ]

    return latest_feedback


# -------------------- AUDIO METRICS --------------------
def extract_audio_metrics(path):
    metrics_list = [
        'duration', 'energy', 'spectral_contrast', 'harmony_fit',
        'tempo', 'note_density', 'spectral_centroid'
    ]

    if path is None or not os.path.exists(path):
        return dict(zip(metrics_list, [np.nan] * len(metrics_list)))

    try:
        y, sr = librosa.load(path, sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)
        energy = float(np.mean(librosa.feature.rms(y=y)))
        spectral_contrast = float(np.mean(librosa.feature.spectral_contrast(y=y, sr=sr)))
        harmonic_y = librosa.effects.harmonic(y)
        harmony_fit = float(np.mean(np.abs(harmonic_y)))
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo = float(librosa.beat.tempo(onset_envelope=onset_env, sr=sr)[0])
        onset_frames = librosa.onset.onset_detect(y=harmonic_y, sr=sr)
        note_density = len(onset_frames) / duration if duration > 0 else 0
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

        return {
            'duration': duration,
            'energy': energy,
            'spectral_contrast': spectral_contrast,
            'harmony_fit': harmony_fit,
            'tempo': tempo,
            'note_density': note_density,
            'spectral_centroid': spectral_centroid
        }

    except Exception as e:
        print(f"Error processing {path}: {e}")
        return dict(zip(metrics_list, [np.nan] * len(metrics_list)))


def analyze_audio_models():
    results = {}

    for model, path in model_audio_paths.items():
        if os.path.isdir(path):
            wav_files = sorted(
                glob.glob(os.path.join(path, "*.wav")),
                key=os.path.getmtime
            )
            path_to_use = wav_files[-1] if wav_files else None
        else:
            path_to_use = path if os.path.exists(path) else None

        results[model] = extract_audio_metrics(path_to_use)

    return results


# -------------------- HELPER: PLOT TO BASE64 --------------------
def plot_to_base64(fig):
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# -------------------- GENERATE HTML --------------------
def generate_html_report():
    feedback_df = load_feedback()

    # Convert index ('model') → first column
    feedback_df = feedback_df.reset_index()
    feedback_df.rename(columns={"index": "model"}, inplace=True)

    audio_metrics = analyze_audio_models()
    audio_df = pd.DataFrame(audio_metrics).T

    # Feedback graph
    fig, ax = plt.subplots(figsize=(7, 4))
    feedback_df.plot(kind="bar", ax=ax)
    ax.set_title("User Feedback Comparison", fontsize=13)
    ax.set_ylabel("Average Score")
    ax.set_ylim(0, 5)
    feedback_b64 = plot_to_base64(fig)

    # Audio metrics graph
    fig2 = plt.figure(figsize=(12, 4))
    gs = gridspec.GridSpec(1, 2, width_ratios=[1, 1], wspace=0.5)

    # Left metrics
    ax2 = fig2.add_subplot(gs[0])
    left_metrics = ['duration', 'spectral_contrast', 'tempo']
    bar_width = 0.25
    indices = np.arange(len(audio_df))
    colors_left = ['#1f77b4', '#ff7f0e', '#2ca02c']

    for i, metric in enumerate(left_metrics):
        ax2.bar(indices + i * bar_width, audio_df[metric], width=bar_width,
                label=metric, color=colors_left[i])

    ax2.set_title("Large-Scale Audio Metrics")
    ax2.set_xticks(indices + bar_width)
    ax2.set_xticklabels(audio_df.index)
    ax2.set_ylim(0, audio_df[left_metrics].max().max() * 1.2)
    ax2.legend()

    # Right metrics
    ax3 = fig2.add_subplot(gs[1])
    right_metrics = ['energy', 'harmony_fit', 'note_density', 'spectral_centroid']
    colors_right = ['#FF5733', '#33C1FF', '#FFD700', '#00FFAA']
    bar_width2 = 0.18
    indices2 = np.arange(len(audio_df))

    for i, metric in enumerate(right_metrics):
        ax3.bar(
            indices2 + i * bar_width2,
            audio_df[metric] / audio_df[metric].max(),
            width=bar_width2,
            color=colors_right[i],
            label=metric
        )

    ax3.set_title("Small-Scale Audio Metrics (Normalized)")
    ax3.set_xticks(indices2 + bar_width2 * 1.5)
    ax3.set_xticklabels(audio_df.index)
    ax3.set_ylim(0, 1.2)
    ax3.legend()

    buf2 = BytesIO()
    fig2.savefig(buf2, format="png", bbox_inches="tight", dpi=150)
    plt.close(fig2)
    audio_b64 = base64.b64encode(buf2.getvalue()).decode("utf-8")

    # HTML content (unchanged)
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
                {feedback_df.to_html(classes='table table-striped')}
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

    os.makedirs(BASE_FOLDER, exist_ok=True)

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print("\n✨ Report successfully generated!")
    print("Saved to:", REPORT_FILE)
    return REPORT_FILE


# -------------------- RUN --------------------
if __name__ == "__main__":
    generate_html_report()
