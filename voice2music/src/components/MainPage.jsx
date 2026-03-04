import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mic, Music, Headphones } from "lucide-react";

export default function MainPage({ setModalOpen }) {
  // Floating notes array
  const notes = [...Array(12)].map((_, i) => ({
    id: i,
    size: Math.random() * 20 + 15,
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: Math.random() * 15 + 10,
    color: Math.random() > 0.5 ? "#FFD700" : "#FFFFFF", // gold or white
    directionX: Math.random() > 0.5 ? 1 : -1,
    directionY: Math.random() > 0.5 ? 1 : -1,
  }));

  // Sparkle particles
  const sparkles = [...Array(25)].map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: Math.random() * 3 + 2,
  }));

  return (
    <div className="min-h-screen relative overflow-hidden text-white bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]">
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
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.5, 1] }}
          transition={{
            repeat: Infinity,
            duration: sparkle.duration,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Navbar */}
      <nav className="flex items-center justify-between px-20 py-8 bg-white/5 backdrop-blur-md border-b border-white/10 fixed top-0 left-0 w-full z-50">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 cursor-pointer"
        >
          Voice2Music
        </motion.h1>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center h-screen px-10 pt-24 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-7xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400"
        >
          Turn Your Voice Into Music 🎶
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-3xl text-xl text-gray-300 mb-14"
        >
          Speak, hum, or sing — and let Voice2Music transform your sound into beautiful melodies using the power of AI.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={() => setModalOpen(true)}
            className="px-10 py-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:scale-105 transform transition font-semibold text-lg"
          >
            Get Started
          </button>
        </motion.div>

        {/* Music Wave Animation */}
        <div className="mt-24 flex gap-1.5 h-24 items-end">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: [10, 100, 20, 80, 10] }}
              transition={{ duration: 1.5, delay: i * 0.05, repeat: Infinity, ease: "easeInOut" }}
              className="w-2 bg-gradient-to-t from-pink-500 to-purple-500 rounded-full"
            />
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-20 bg-white/5 backdrop-blur-md relative z-10">
        <h3 className="text-center text-5xl font-bold mb-20 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
          What Makes Voice2Music Special
        </h3>

        <div className="grid grid-cols-3 gap-16 max-w-6xl mx-auto">
          {[
            {
              icon: <Mic size={50} />,
              title: "Voice Input",
              desc: "Just record your voice — no instruments needed.",
            },
            {
              icon: <Music size={50} />,
              title: "AI Composition",
              desc: "Our AI creates melodies, beats, and harmonies for you.",
            },
            {
              icon: <Headphones size={50} />,
              title: "Studio Sound",
              desc: "Get crystal-clear music ready for sharing or mixing.",
            },
          ].map((f, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 p-10 rounded-2xl border border-white/10 shadow-lg hover:shadow-pink-500/30 text-center"
            >
              <div className="flex justify-center mb-6 text-pink-400">{f.icon}</div>
              <h4 className="text-2xl font-semibold mb-4">{f.title}</h4>
              <p className="text-gray-300 text-lg">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
