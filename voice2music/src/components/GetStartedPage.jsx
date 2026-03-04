import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, UploadCloud, Play, ArrowLeft } from "lucide-react";

/* Floating music notes & sparkles setup (copied from MainPage) */
const notes = [...Array(12)].map((_, i) => ({
  id: i,
  size: Math.random() * 20 + 15,
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: Math.random() * 15 + 10,
  color: Math.random() > 0.5 ? "#FFD700" : "#FFFFFF",
  directionX: Math.random() > 0.5 ? 1 : -1,
  directionY: Math.random() > 0.5 ? 1 : -1,
}));

const sparkles = [...Array(25)].map((_, i) => ({
  id: i,
  size: Math.random() * 4 + 2,
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: Math.random() * 3 + 2,
}));

/*
  GetStartedPage.jsx (updated)
  - Preserves your original logic and structure
  - Adds floating notes + sparkles background
  - Adds top nav (same style as GeneratedMusicPage)
  - Adds single-input behavior (upload OR record)
  - Start Recording button: full green + pulsing while recording
  - Upload disabled while recording; Record disabled when file uploaded
  - Browser confirm popups when switching audio sources (style A)
  - Fixed duration handling (no Infinity/NaN)
*/

export default function GetStartedPage({ setPage, passGenerated }) {
  // UI / state
  const [recording, setRecording] = useState(false);
  const [hasAudio, setHasAudio] = useState(false); // an audio exists (recorded or uploaded)
  const [audioURL, setAudioURL] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [durationSec, setDurationSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // NEW: track if the user uploaded a file (to disable record)
  const [uploadedFile, setUploadedFile] = useState(null);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioElRef = useRef(null);

  // analyser + canvas
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataArrayRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);

  // decorative uploaded image path (developer-provided file). Used as very subtle backdrop element.
  const referenceImage = "/mnt/data/WhatsApp Image 2025-11-21 at 11.23.16_656c4dd7.jpg";

  // helpers
  const formatTime = (s) => {
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${("0" + ss).slice(-2)}`;
  };
  // ensure canvas proper pixel size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Utility: revoke existing object URL (if any)
  const revokeCurrentURL = () => {
    try {
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    } catch (e) {
      // ignore
    }
  };
   // uploading co ecting to app.py 
 const uploadToFlask = async () => {
  if (!audioBlob && !uploadedFile) {
    alert("No audio selected/recorded to upload.");
    return null;
  }

  try {
    const formData = new FormData();

    // Support both uploaded file (mp3/wav) and recorded blob (wav)
    if (uploadedFile) {
      formData.append("audio", uploadedFile, uploadedFile.name);
    } else {
      formData.append("audio", audioBlob, "audio.wav");
    }

    const response = await fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Backend response:", data);

      // Make sure backend returns EXACT FIELDS used by generateMusic():
      // uploaded_file
      // variants → [ { title, url, duration } ]

      if (!data.uploaded_file) {
        console.warn("Backend did not return uploaded_file");
      }

      if (!data.variants || !Array.isArray(data.variants)) {
        console.warn("Backend did not return variants properly");
        data.variants = []; // avoid crash
      }

      return data;
    } else {
      alert("Upload failed: " + (data.error || "Unknown error"));
      return null;
    }
  } catch (err) {
    alert("Error uploading file: " + err.message);
    console.error(err);
    return null;
  }
};

  // Start recording
  const startRecording = async () => {
    // If a file was uploaded, ask confirmation (because user chose option A)
    if (uploadedFile) {
      const ok = window.confirm("Recording will remove the uploaded MP3. Continue?");
      if (!ok) return;
      // user confirmed -> remove uploaded file and existing audio
      revokeCurrentURL();
      setUploadedFile(null);
      setAudioBlob(null);
      setAudioURL(null);
      setHasAudio(false);
      setDurationSec(0);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      // reset timer right when recording starts
      setDurationSec(0);

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        // assemble blob
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // revoke previous URL
        revokeCurrentURL();
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioURL(url);
        setHasAudio(true);
        setUploadedFile(null); // recorded audio is now the active source

        // compute duration safely
        const tmp = new Audio(url);
        tmp.preload = "metadata";
        tmp.onloadedmetadata = () => {
          const d = tmp.duration;
          if (isFinite(d) && !isNaN(d)) setDurationSec(Math.floor(d));
          else setDurationSec(0);
        };
        // fallback: if metadata doesn't fire in some edge cases, ensure we don't display NaN/Infinity
        tmp.onerror = () => {
          setDurationSec(0);
        };
      };

      mediaRecorderRef.current.start();
      setRecording(true);

      // Setup audio context + analyser to draw bars
      setupAnalyser(stream);
    } catch (err) {
      console.error("startRecording error", err);
      alert("Unable to access microphone. Please check permissions.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive")
        mediaRecorderRef.current.stop();
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    } catch (e) {
      console.warn("stopRecording error", e);
    }
    // ensure recording state is cleared (this will also clear timer via effect)
    setRecording(false);
    teardownAnalyser();
  };

  // File upload — only MP3 allowed
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // accept only mp3 by mime or extension
    if (!(f.type === "audio/mpeg" || f.name.toLowerCase().endsWith(".mp3"))) {
      alert("Please upload an MP3 file.");
      return;
    }

    // If there's an existing recorded/uploaded audio, ask confirmation (user chose style A)
    if (hasAudio) {
      const ok = window.confirm("Uploading a new MP3 will remove the existing audio. Continue?");
      if (!ok) {
        // reset input value so user can re-select same file if desired
        e.target.value = "";
        return;
      }
      // user confirmed -> remove existing
      revokeCurrentURL();
      setAudioBlob(null);
      setAudioURL(null);
      setHasAudio(false);
      setUploadedFile(null);
      setDurationSec(0);
      // continue to accept new file
    }

    // stop recording if in progress
    if (recording) stopRecording();

    // create object URL for uploaded file
    try {
      // revoke previous if any
      revokeCurrentURL();
    } catch (err) {
      // ignore
    }
 const url = URL.createObjectURL(f);
      
  setAudioBlob(f);
  setUploadedFile(f);
  setAudioURL(url);
  setHasAudio(true);
    // get duration via audio element (safe)
    const tmp = new Audio(url);
    tmp.preload = "metadata";
    tmp.onloadedmetadata = () => {
      const d = tmp.duration;
      if (isFinite(d) && !isNaN(d)) setDurationSec(Math.floor(d));
      else setDurationSec(0);
    };
    tmp.onerror = () => {
      setDurationSec(0);
    };

    // clear input value so same file can be uploaded again later if user wants
    e.target.value = "";
  };

  // Setup analyser for a MediaStream (microphone)
  const setupAnalyser = (stream) => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      sourceRef.current = source;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      drawBars(); // start render loop
    } catch (err) {
      console.error("setupAnalyser error", err);
    }
  };

  // Setup analyser for playback from audio element (uploaded or recorded preview)
  const setupAnalyserFromAudio = () => {
    if (!audioURL) return;
    try {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const audioEl = audioElRef.current;
      if (!audioEl) return;
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioEl);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      drawBars();
    } catch (err) {
      console.error("setupAnalyserFromAudio error", err);
    }
  };

  // draw medium-size glowing bars (neon) — lightweight & centered area
  const drawBars = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;
    const ctx = canvas.getContext("2d");

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      const width = canvas.width;
      const height = canvas.height;
      // clear but keep slight glow trail using low-alpha fill
      ctx.clearRect(0, 0, width, height);

      const barCount = 36; // medium number of bars (not huge)
      const barWidth = Math.max(2, width / (barCount * 1.6));
      const gap = (width - barCount * barWidth) / (barCount + 1);

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * dataArrayRef.current.length);
        const v = dataArrayRef.current[dataIndex] / 255; // 0..1
        const barHeight = v * height;

        const x = gap + i * (barWidth + gap);
        const y = height - barHeight;

        // neon gradient per bar (bright)
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, "#ff7ab6"); // hot pink
        grad.addColorStop(0.45, "#7c3aed"); // purple
        grad.addColorStop(1, "#3b82f6"); // blue

        // glow shadow
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(124,58,237,0.55)";

        ctx.fillStyle = grad;

        // rounded-top rectangle for smoother look
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + barWidth, y, x + barWidth, y + barHeight, r);
        ctx.arcTo(x + barWidth, y + barHeight, x, y + barHeight, r);
        ctx.arcTo(x, y + barHeight, x, y, r);
        ctx.arcTo(x, y, x + barWidth, y, r);
        ctx.closePath();
        ctx.fill();

        // subtle top highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x, y, barWidth, 2);
      }
    };

    render();
  };

  // teardown analyser and animation
  const teardownAnalyser = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      if (sourceRef.current && sourceRef.current.disconnect) sourceRef.current.disconnect();
      if (analyserRef.current && analyserRef.current.disconnect) analyserRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== "closed")
        audioContextRef.current.close();
    } catch (e) {
      /* ignore */
    }
    analyserRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    dataArrayRef.current = null;
  };

  // preview play/pause (setup analyser from audio element)
  const handlePreview = async () => {
    if (!audioURL) return;
    const a = audioElRef.current;
    if (!a) return;

    if (!analyserRef.current) {
      setupAnalyserFromAudio();
    }

    if (a.paused) {
      try {
        await a.play();
        setIsPlayingPreview(true);
      } catch (e) {
        console.warn("preview play error", e);
      }
    } else {
      a.pause();
      setIsPlayingPreview(false);
    }

    a.onended = () => {
      setIsPlayingPreview(false);
    };
  };
  // 🔥 LIVE RECORDING DURATION TIMER
useEffect(() => {
  let interval = null;

  if (recording) {
    interval = setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
  }

  return () => {
    if (interval) clearInterval(interval);
  };
}, [recording]);


  // Generate: simulate 2.5s and pass placeholders to generated page
const generateMusic = async () => {
  if (recording) {
    alert("Please stop recording before generating.");
    return;
  }

  if (!hasAudio || !audioBlob) {
    alert("Please record or upload an audio file first.");
    return;
  }

  setLoading(true);

  try {
    // Upload audio to Flask
    const backendData = await uploadToFlask();
    if (!backendData) return;

    console.log("Backend Data:", backendData);

    // ─────────────────────────────
    // 1️⃣ Read uploaded_file (original audio)
    // ─────────────────────────────
    const originalFileUrl = backendData.uploaded_file || null;

    // ─────────────────────────────
    // 2️⃣ Read variants array
    // ─────────────────────────────
    const variants = Array.isArray(backendData.variants)
      ? backendData.variants.map((v) => ({
          title: v.title,
          url: v.url,
          duration: v.duration || 0,
        }))
      : [];

    if (variants.length === 0) {
      alert("No generated music variants returned from backend.");
      return;
    }

    // ─────────────────────────────
    // 3️⃣ Pass everything to GeneratedMusic.jsx
    // ─────────────────────────────
    if (typeof passGenerated === "function") {
      passGenerated({
        original: originalFileUrl,  // From backend
        originalBlob: audioBlob,    // Local blob
        variants: variants
      });
    }

    // Move to generated page
    setPage("generated");

  } catch (err) {
    console.error("Error generating music:", err);
    alert("An error occurred while generating music.");
  } finally {
    setLoading(false);
  }
};


  // cleanup on unmount
  useEffect(() => {
    return () => {
      teardownAnalyser();
      try {
        if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      // revoke URL on component unmount
      revokeCurrentURL();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // canvas sizing (device pixel ratio) initialization done via earlier useEffect
  // but ensure small delay to render bars when analyser set
  useEffect(() => {
    // if we have an analyser and canvas, drawBars will run automatically
  }, []);

  // Derived states for disabling controls
  const isUploadDisabled = recording; // disable upload while recording
  const isRecordDisabled = !!uploadedFile; // disable record if a file has been uploaded

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#08030e] via-[#1a1635] to-[#060417] p-6 text-white">
      {/* Floating Music Notes */}
      {notes.map((note) => (
        <motion.div
          key={note.id}
          className="absolute"
          style={{
            left: `${note.left}%`,
            top: `${note.top}%`,
            fontSize: `${note.size}px`,
            color: note.color,
            zIndex: 1,
          }}
          animate={{
            x: [0, 100 * note.directionX, 0, -100 * note.directionX],
            y: [0, 100 * note.directionY, 0, -100 * note.directionY],
          }}
          transition={{
            repeat: Infinity,
            duration: note.duration,
            ease: "linear",
          }}
        >
          🎵
        </motion.div>
      ))}

      {/* Golden Sparkles */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute rounded-full bg-yellow-400"
          style={{
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
            top: `${sparkle.top}%`,
            left: `${sparkle.left}%`,
            opacity: 0.7,
            zIndex: 1,
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: sparkle.duration,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Top navigation (same style as GeneratedMusicPage) */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white/5 backdrop-blur-md border-b border-white/10 rounded-md relative z-20">
        <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">
          Voice2Music
        </div>
        <button
          onClick={() => setPage("home")}
          className="px-3 py-2 rounded-full border border-white/10 text-gray-300 flex items-center gap-2"
        >
          <ArrowLeft /> Back
        </button>
      </nav>

      <div className="w-full max-w-4xl mx-auto mt-6 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-4xl bg-white/6 backdrop-blur-xl border border-white/10 shadow-2xl p-8"
          style={{ boxShadow: "0 12px 40px rgba(124,58,237,0.12)" }}
        >
          {/* subtle decorative background image (very faint) */}
          <img
            src={referenceImage}
            alt=""
            className="pointer-events-none absolute right-6 top-6 w-40 opacity-5 select-none rounded-lg"
          />

          {/* header */}
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400">
                Voice2Music Studio
              </h1>
              <p className="text-gray-300 mt-2 max-w-xl">
                Sing or upload an MP3 (only one). The waveform shows recording / playback activity.
              </p>
            </div>

            <div className="text-right text-gray-300">
              <div className="text-sm">Live Status</div>
              <div className="text-2xl font-semibold">{recording ? "Recording" : hasAudio ? "Ready" : "Idle"}</div>
            </div>
          </div>

          {/* main layout: left controls, right waveform */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* left column: controls */}
            <div className="col-span-1 flex flex-col gap-4">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (isRecordDisabled) return; // block if upload active and user didn't confirm earlier
                  if (recording) stopRecording(); else startRecording();
                }}
                className={`flex items-center gap-3 px-5 py-3 rounded-full font-semibold shadow-lg transform transition
                  ${recording ? "bg-green-500 text-gray-900 animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.35)]" : "bg-gradient-to-r from-pink-500 to-purple-500 text-white"}
                  ${isRecordDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                aria-pressed={recording}
                title=""
                disabled={isRecordDisabled}
              >
                <Mic />
                {recording ? "Stop Recording" : "Start Recording"}
              </motion.button>

              <label className={`flex items-center gap-3 px-4 py-3 rounded-full border border-white/10 cursor-pointer bg-white/5 hover:bg-white/7 ${isUploadDisabled ? "opacity-40 pointer-events-none" : ""}`}>
                <UploadCloud />
                <span className="text-sm text-gray-200">Choose MP3</span>
                <input type="file" accept=".mp3,audio/mpeg" onChange={handleFileChange} className="hidden" disabled={isUploadDisabled} />
              </label>

              <button
                onClick={handlePreview}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${!hasAudio ? "bg-white/6 text-gray-400 cursor-not-allowed" : "bg-white/6 text-gray-200"}`}
                disabled={!hasAudio}
              >
                <Play />
                <span>{isPlayingPreview ? "Pause Preview" : "Preview"}</span>
              </button>

              <div className="mt-4">
                <motion.button
                  onClick={generateMusic}
                  whileTap={{ scale: 0.98 }}
                  disabled={!hasAudio || loading || recording}
                  className={`w-full px-6 py-3 rounded-2xl font-semibold shadow-xl transform transition
                    ${!hasAudio || recording ? "bg-white/10 text-gray-400 cursor-not-allowed" :
                     loading ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white" :
                     "bg-gradient-to-r from-pink-500 to-purple-500 text-white"}`}
                >
                  {loading ? (
                    <div className="flex items-center gap-3 justify-center">
                      <div className="w-5 h-5 rounded-full bg-white animate-pulse" />
                      Generating...
                    </div>
                  ) : (
                    "Generate Music"
                  )}
                </motion.button>
              </div>

              <button onClick={() => setPage("home")} className="mt-2 px-4 py-2 rounded-full border border-white/10 text-gray-300">
                Cancel
              </button>
            </div>

            {/* right: waveform + timer inside the waveform area (top-right) */}
            <div className="col-span-2">
              <div className="relative rounded-xl p-3 bg-[#071120]/50 border border-white/6">
                {/* timer inside waveform area (top-right) */}
                <div className="absolute right-4 top-3 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/6 text-sm text-white/90">
                  {formatTime(durationSec)}
                </div>

                {/* canvas: medium height waveform */}
                <div className="h-36 md:h-44 rounded-lg overflow-hidden">
                  <canvas ref={canvasRef} className="w-full h-full" />
                </div>

                {/* subtle caption */}
                <div className="mt-3 text-xs text-gray-400">Waveform visual (recording / playback)</div>
              </div>

              {/* hidden audio element for playback/preview */}
              <audio ref={audioElRef} src={audioURL || ""} className="hidden" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
