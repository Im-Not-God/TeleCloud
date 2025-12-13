import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import FileManager from "./components/routes/FileManager";
import { SharePage } from "./components/routes/SharePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FileManager />} />
        <Route path="/folder/:folderId" element={<FileManager />} />
        <Route path="/share" element={<SharePage />} />
        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
