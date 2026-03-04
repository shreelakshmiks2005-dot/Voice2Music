import React, { useState } from "react";
import MainPage from "./components/MainPage";
import GetStartedPage from "./components/GetStartedPage";
import GeneratedMusicPage from "./components/GeneratedMusicPage";

export default function App() {
  const [page, setPage] = useState("home"); // home | start | generated
  const [generatedData, setGeneratedData] = useState(null);

  // adapter so MainPage's existing button works (it calls setModalOpen(true) previously)
  const openStartFromMain = (val) => {
    // ignore val, switch to start
    setPage("start");
  };

  const passGenerated = (data) => {
    setGeneratedData(data);
  };

  return (
    <>
      {page === "home" && <MainPage setModalOpen={openStartFromMain} />}

      {page === "start" && (
        <GetStartedPage setPage={setPage} passGenerated={passGenerated} />
      )}

      {page === "generated" && generatedData && (
        <GeneratedMusicPage setPage={setPage} generatedData={generatedData} />
      )}
    </>
  );
}
