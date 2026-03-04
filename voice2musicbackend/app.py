from flask import Flask, request, jsonify, send_from_directory
import os
from werkzeug.utils import secure_filename
from flask_cors import CORS
from pydub import AudioSegment
import subprocess
import time
import shutil
import csv
import pandas as pd
import numpy as np
import librosa
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from io import BytesIO
import base64
import glob

# ---------------------------------------
# IMPORT REPORT GENERATOR (UNCHANGED)
# ---------------------------------------
from report_generator import generate_html_report

# ---------------------------------------
# IMPORT OUR MODEL PIPELINE (NEW)
# ---------------------------------------
from our_model_pipeline import run_our_model

# ---------------------------------------
# IMPORT OTHER MODELS (UNCHANGED)
# ---------------------------------------
from new_performancernn import run_performance_rnn
from musicvae_pipeline import run_music_vae

# ----------------------------
# SETUP FFMPEG/FFPROBE PATHS
# ----------------------------

FFMPEG_PATH = r"C:\Users\monit\Desktop\react project\voice2musicbackend\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
FFPROBE_PATH = r"C:\Users\monit\Desktop\react project\voice2musicbackend\ffmpeg-8.0.1-full_build\bin\ffprobe.exe"

AudioSegment.ffmpeg = FFMPEG_PATH
AudioSegment.ffprobe = FFPROBE_PATH

os.environ["FFMPEG_BINARY"] = FFMPEG_PATH
os.environ["FFPROBE_BINARY"] = FFPROBE_PATH

# ----------------------------
# FLASK SETUP
# ----------------------------

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = r"C:\Users\monit\Desktop\react project\voice2musicbackend\data"
PERFORMANCE_RNN_OUTPUT = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\performancernn"
MUSICVAE_OUTPUT = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\music_vae"
REPORT_FOLDER = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\comparitative_analysis_report"
OUR_MODEL_OUTPUT = r"C:\Users\monit\Desktop\react project\voice2musicbackend\output\our_model"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PERFORMANCE_RNN_OUTPUT, exist_ok=True)
os.makedirs(MUSICVAE_OUTPUT, exist_ok=True)
os.makedirs(REPORT_FOLDER, exist_ok=True)
os.makedirs(OUR_MODEL_OUTPUT, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {"wav", "mp3", "mpeg"}

FEEDBACK_CSV = os.path.join(REPORT_FOLDER, "feedback.csv")
REPORT_FILE = os.path.join(REPORT_FOLDER, "model_comparative_report.html")


# ----------------------------
# HELPER FUNCTIONS
# ----------------------------

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def convert_mp3_to_wav(mp3_path, wav_path):
    try:
        subprocess.run(
            [FFMPEG_PATH, "-y", "-i", mp3_path, wav_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )
        return True
    except Exception as e:
        print("❌ MP3→WAV conversion error:", e)
        return False


# ----------------------------
# ROUTES
# ----------------------------

@app.route("/")
def home():
    return "Voice2Music Backend Running"


@app.route("/data/<path:filename>")
def serve_data(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route("/output/performancernn/<path:filename>")
def serve_performancernn(filename):
    return send_from_directory(PERFORMANCE_RNN_OUTPUT, filename)


@app.route("/output/music_vae/<path:filename>")
def serve_musicvae(filename):
    return send_from_directory(MUSICVAE_OUTPUT, filename)


@app.route("/output/our_model/<path:filename>")
def serve_our_model(filename):
    return send_from_directory(OUR_MODEL_OUTPUT, filename)


# ----------------------------
# UPLOAD + MODEL PIPELINES
# ----------------------------

@app.route("/upload", methods=["POST"])
def upload_audio():

    # --- check file ---
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    file = request.files["audio"]

    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    # --- save file ---
    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(save_path)

    print("📥 File uploaded:", save_path)

    # Convert MP3 → WAV
    if filename.lower().endswith(".mp3"):
        wav_filename = filename.rsplit(".", 1)[0] + ".wav"
        wav_path = os.path.join(app.config["UPLOAD_FOLDER"], wav_filename)

        if not convert_mp3_to_wav(save_path, wav_path):
            return jsonify({"error": "MP3 conversion failed"}), 500

        os.remove(save_path)
        save_path = wav_path
        print("🔄 Converted to WAV:", save_path)

    # Normalize WAV
    try:
        temp_path = save_path.rsplit(".", 1)[0] + "_norm.wav"

        subprocess.run(
            [
                FFMPEG_PATH, "-y", "-i", save_path,
                "-ac", "1", "-ar", "44100", "-sample_fmt", "s16",
                temp_path
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )

        shutil.move(temp_path, save_path)
        print("🎚️ WAV normalized:", save_path)

    except Exception as e:
        print("❌ WAV normalization failed:", e)
        return jsonify({"error": "WAV normalization failed"}), 500

    timestamp = int(time.time() * 1000)

    # ============================================================
    #                OUR MODEL (NEW — works independently)
    # ============================================================
    our_output_file = os.path.join(
        OUR_MODEL_OUTPUT,
        f"{filename.rsplit('.', 1)[0]}_ourmodel_{timestamp}.wav"
    )

    try:
        run_our_model(
            input_wav_path=save_path,
            output_folder=OUR_MODEL_OUTPUT,
            output_file=our_output_file
        )
        print("🎼 OUR MODEL output:", our_output_file)
    except Exception as e:
        print("❌ OUR MODEL ERROR:", e)
        our_output_file = None

    # ============================================================
    # PERFORMANCE RNN (unchanged)
    # ============================================================

    perf_rnn_file = os.path.join(
        PERFORMANCE_RNN_OUTPUT,
        f"{filename.rsplit('.', 1)[0]}_perf_rnn_{timestamp}.wav"
    )

    try:
        run_performance_rnn(save_path, output_file=perf_rnn_file)
        print("🎵 PerformanceRNN output:", perf_rnn_file)
    except Exception as e:
        print("❌ PERFORMANCE RNN ERROR:", e)
        perf_rnn_file = None

    # ============================================================
    # MUSICVAE (unchanged)
    # ============================================================

    musicvae_file = os.path.join(
        MUSICVAE_OUTPUT,
        f"{filename.rsplit('.', 1)[0]}_musicvae_{timestamp}.wav"
    )

    try:
        run_music_vae(save_path, output_folder=MUSICVAE_OUTPUT, output_file=musicvae_file)
        print("🎵 MusicVAE output:", musicvae_file)
    except Exception as e:
        print("❌ MUSICVAE ERROR:", e)
        musicvae_file = None

    # ============================================================
    # RETURN ALL OUTPUTS TO REACT
    # ============================================================

    base_url = "http://localhost:5000"
    variants = []

    if our_output_file:
        variants.append({
            "title": "Our Model",
            "url": f"{base_url}/output/our_model/{os.path.basename(our_output_file)}",
            "duration": 0
        })

    if perf_rnn_file:
        variants.append({
            "title": "Performance-RNN",
            "url": f"{base_url}/output/performancernn/{os.path.basename(perf_rnn_file)}",
            "duration": 0
        })

    if musicvae_file:
        variants.append({
            "title": "MusicVAE",
            "url": f"{base_url}/output/music_vae/{os.path.basename(musicvae_file)}",
            "duration": 0
        })

    response = {
        "uploaded_file": f"{base_url}/data/{os.path.basename(save_path)}",
        "variants": variants
    }

    return jsonify(response), 200


# ----------------------------
# FEEDBACK ROUTE (unchanged)
# ----------------------------

@app.route("/save-feedback", methods=["POST"])
def save_feedback():
    try:
        data = request.get_json()

        timestamp = data.get("timestamp", "")
        model = data.get("model", "")
        melody_rating = data.get("melody_rating", "")
        accompaniment_rating = data.get("accompaniment_rating", "")
        overall_rating = data.get("overall_rating", "")

        if not os.path.exists(FEEDBACK_CSV):
            with open(FEEDBACK_CSV, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "timestamp", "model", "melody_rating",
                    "accompaniment_rating", "overall_rating"
                ])

        with open(FEEDBACK_CSV, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                timestamp, model, melody_rating,
                accompaniment_rating, overall_rating
            ])

        return jsonify({"success": True, "message": "Feedback saved successfully"}), 200

    except Exception as e:
        print("❌ Failed to save feedback:", e)
        return jsonify({"success": False, "error": str(e)}), 500


# ----------------------------
# REPORT GENERATION (unchanged)
# ----------------------------

@app.route("/generate_report", methods=["GET"])
def generate_report():
    try:
        report_path = generate_html_report()
        report_filename = os.path.basename(report_path)
        report_url = f"http://localhost:5000/report/{report_filename}"

        return jsonify({
            "success": True,
            "report_url": report_url
        }), 200

    except Exception as e:
        print("❌ REPORT GENERATION ERROR:", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/report/<path:filename>")
def serve_report(filename):
    return send_from_directory(REPORT_FOLDER, filename)


# ----------------------------
# RUN FLASK
# ----------------------------

if __name__ == "__main__":
    app.run(debug=True)
