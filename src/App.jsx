import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import MainPageFix from './pages/MainPageFix'
import TestFormatting from './pages/TestFormatting'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/main" element={<MainPageFix />} />
        <Route path="/test-format" element={<TestFormatting />} />
      </Routes>
    </Router>
  );
}

export default App
