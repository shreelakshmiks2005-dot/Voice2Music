import React, { useRef, useEffect, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Download, ArrowLeft, Edit, Star, X } from "lucide-react";
import { motion } from "framer-motion";

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
export default function GeneratedMusicPage({ setPage, generatedData }) {
  const [playingIndex, setPlayingIndex] = useState(null);
  const waveformRefs = useRef([]);
  const wavesurferInstances = useRef([]);
  const [durations, setDurations] = useState([]);
  const destroyed = useRef(false);

  // Feedback modal
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackModelTitle, setFeedbackModelTitle] = useState("");
  const [ratings, setRatings] = useState({ melody: 0, accompaniment: 0, overall: 0 });
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openFeedbackFor = (modelTitle) => {
    setFeedbackModelTitle(modelTitle || "Unknown version");
    setRatings({ melody: 0, accompaniment: 0, overall: 0 });
    setComments("");
    setFeedbackOpen(true);
  };

  const handleStarClick = (field, value) => {
    setRatings((prev) => ({ ...prev, [field]: value }));
  };

  const submitFeedback = async () => {
    if (
      ![1, 2, 3, 4, 5].includes(ratings.melody) ||
      ![1, 2, 3, 4, 5].includes(ratings.accompaniment) ||
      ![1, 2, 3, 4, 5].includes(ratings.overall)
    ) {
      alert("Please give all three ratings (1 to 5 stars).");
      return;
    }

    setSubmitting(true);

    const payload = {
      timestamp: new Date().toLocaleString(),
      model: feedbackModelTitle,
      melody_rating: ratings.melody,
      accompaniment_rating: ratings.accompaniment,
      overall_rating: ratings.overall,
      comments: comments || "",
    };

    try {
      await fetch("http://localhost:5000/save-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      alert("Thank you — feedback saved!");
      setFeedbackOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save feedback. Check backend.");
    } finally {
      setSubmitting(false);
    }
  };

  // Page cleanup
    useEffect(() => {
    if (!generatedData?.variants) return;

    const timeout = setTimeout(() => {
      generatedData.variants.forEach((v, i) => {
        // Destroy previous instance (prevents double-abort error)
        if (wavesurferInstances.current[i]) {
          try {
            wavesurferInstances.current[i].destroy();
          } catch {}
        }

        const container = waveformRefs.current[i];
        if (!container) return; // Fix: prevents "Container not found"

        const ws = WaveSurfer.create({
          container,
          waveColor: "#a855f7",
          progressColor: "#ec4899",
          height: 60,
          responsive: true,
        });

        wavesurferInstances.current[i] = ws;

        ws.load(v.url);

        ws.on("ready", () => {
          const d = ws.getDuration();
          setDurations((prev) => {
            const copy = [...prev];
            copy[i] = d;
            return copy;
          });
        });

        ws.on("finish", () => setPlayingIndex(null));
      });
    }, 10); // delay ensures DOM is fully ready

    return () => clearTimeout(timeout);
  }, [generatedData]);

  const togglePlay = (i) => {
    const ws = wavesurferInstances.current[i];
    if (!ws) return;

    if (playingIndex === i) {
      ws.pause();
      setPlayingIndex(null);
    } else {
      wavesurferInstances.current.forEach((w, idx) => {
        if (w && idx !== i && typeof w.pause === "function") w.pause();
      });
      ws.play();
      setPlayingIndex(i);
    }
  };

 const handleDirectDownload = async (url, title) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `${title.replace(/\s+/g, "_")}.mp3`;

    link.click();
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Direct download failed:", error);
  }
};

const handleDownloadAndEdit = async (url, title) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `${title.replace(/\s+/g, "_")}.mp3`;

    link.click();
    window.URL.revokeObjectURL(link.href);

    // AFTER download starts, open AudioMass
    setTimeout(() => {
      window.open("https://audiomass.co", "_blank");
    }, 300);
  } catch (error) {
    console.error("Download & edit failed:", error);
  }
};


 const generateReport = async () => {
  try {
    const res = await fetch("http://localhost:5000/generate_report");
    const data = await res.json();

    if (data.success) {
      // Open the report URL returned by backend
      window.open(data.report_url, "_blank");
    } else {
      alert("Report generation failed.");
    }
  } catch (err) {
    console.error(err);
    alert("Backend not responding.");
  }
};

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
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white/5 backdrop-blur-md border-b border-white/10 rounded-md relative z-10">
        <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">
          Voice2Music
        </div>
        <button
          onClick={() => setPage("start")}
          className="px-3 py-2 rounded-full border border-white/10 text-gray-300 flex items-center gap-2"
        >
          <ArrowLeft /> Back
        </button>
      </nav>

      {/* Main Card */}
      <div className="max-w-5xl mx-auto mt-8 bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative z-10 space-y-6">
        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
          Generated Music
        </h2>
        <p className="text-gray-300">Variants produced from your input. Click play to preview.</p>

        {/* Variants */}
        <div className="space-y-10">
          {generatedData.variants.map((v, i) => (
            <div key={v.url + i} className="bg-white/6 p-6 rounded-2xl flex flex-col space-y-4">
              {/* Heading */}
              <div className="flex justify-between items-center">
                <div className="text-lg font-semibold">{v.title}</div>
                <div className="text-sm text-gray-300">{v.model || "Model Output"}</div>
              </div>

              {/* Play + waveform */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => togglePlay(i)}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white"
                >
                  {playingIndex === i ? <Pause /> : <Play />}
                </button>
                <div ref={(el) => (waveformRefs.current[i] = el)} className="flex-1 h-16 rounded-md bg-black/20"></div>
              </div>

              {/* Buttons + message row */}
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => handleDirectDownload(v.url, v.title)}
                  className="px-4 py-2 rounded-full bg-white/10 flex items-center gap-2"
                 >
                  <Download /> Download
                </button>

                <button
                  onClick={() => handleDownloadAndEdit(v.url, v.title)}
                  className="px-4 py-2 rounded-full bg-white/10 flex items-center gap-2"
                 >
                  <Download />
                  <Edit /> Download & Edit
                </button>

                <span className="text-xs text-gray-300">(Upload the downloaded file inside the editor)</span>
              </div>

              {/* Feedback button */}
              <div>
                <button
                  onClick={() => openFeedbackFor(v.title)}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 hover:scale-105 transform transition font-medium"
                >
                  ⭐ Give Feedback
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Analysis Report */}
        <div className="mt-10 flex justify-center">
          <button
             onClick={generateReport}
             className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 font-semibold hover:scale-105 transition"
           >
          📊 Generate Comparative Analysis Report
          </button>
        </div>
      </div>

      {/* Feedback modal (desktop) */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !submitting && setFeedbackOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="relative bg-[#0b1220]/80 border border-white/10 rounded-3xl p-8 w-[900px] max-w-[95%] backdrop-blur-md shadow-2xl space-y-6"
          >
            <button
              onClick={() => !submitting && setFeedbackOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/6 hover:bg-white/10"
            >
              <X />
            </button>

            <h2 className="text-2xl font-bold text-white text-center">Rate Your Music Experience 🎧✨</h2>

            <div className="flex justify-between gap-6">
              {/* Melody */}
              <div className="flex-1 p-4 bg-white/5 rounded-xl border border-white/6 space-y-2">
                <div className="font-medium text-white text-center">
                  How good does the tune / melody sound to you?
                </div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={`m-${n}`}
                      onClick={() => handleStarClick("melody", n)}
                      className={`cursor-pointer ${ratings.melody >= n ? "text-yellow-400" : "text-gray-500"}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-400 text-center">1 = poor, 5 = excellent</div>
              </div>

              {/* Accompaniment */}
              <div className="flex-1 p-4 bg-white/5 rounded-xl border border-white/6 space-y-2">
                <div className="font-medium text-white text-center">
                  How well do the beats & background music support the melody?
                </div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={`a-${n}`}
                      onClick={() => handleStarClick("accompaniment", n)}
                      className={`cursor-pointer ${ratings.accompaniment >= n ? "text-yellow-400" : "text-gray-500"}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-400 text-center">1 = not supportive, 5 = very supportive</div>
              </div>

              {/* Overall */}
              <div className="flex-1 p-4 bg-white/5 rounded-xl border border-white/6 space-y-2">
                <div className="font-medium text-white text-center">
                  Overall, how much do you like this version of the music?
                </div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={`o-${n}`}
                      onClick={() => handleStarClick("overall", n)}
                      className={`cursor-pointer ${ratings.overall >= n ? "text-yellow-400" : "text-gray-500"}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-400 text-center">1 = dislike, 5 = love it</div>
              </div>
            </div>

            {/* Optional comments */}
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Anything we can improve? (optional)"
              className="w-full p-3 rounded-md border border-white/6 bg-transparent text-white placeholder-gray-400 focus:outline-none"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => !submitting && setFeedbackOpen(false)}
                className="px-4 py-2 rounded-full bg-white/6"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:scale-105 transform transition"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
