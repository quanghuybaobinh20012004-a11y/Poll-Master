import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import html2canvas from 'html2canvas'; 
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid 
} from 'recharts';
import './App.css';

const BACKEND_URL = "https://poll-master.onrender.com"; 

const socket = io.connect(BACKEND_URL);
const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

function App() {
  const [polls, setPolls] = useState([]);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [userId, setUserId] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let storedId = localStorage.getItem("poll_user_id");
    if (!storedId) {
      storedId = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("poll_user_id", storedId);
    }
    setUserId(storedId);

    fetchPolls();
    
    // Lắng nghe socket
    socket.on('new-poll', (newPoll) => setPolls(prev => [newPoll, ...prev]));
    socket.on('update-poll', (updatedPoll) => {
      setPolls(prev => prev.map(p => p._id === updatedPoll._id ? updatedPoll : p));
    });
    
    return () => {
      socket.off('new-poll');
      socket.off('update-poll');
    };
  }, []);

  const fetchPolls = async () => {
    try {
      // Dùng BACKEND_URL thay vì localhost
      const res = await axios.get(`${BACKEND_URL}/api/polls`);
      setPolls(res.data);
    } catch (error) {
      console.error("Lỗi tải poll:", error);
    }
  };

  const handleCreate = async () => {
    if (!question.trim()) return alert("Vui lòng nhập câu hỏi!");
    const validOptions = options.filter(o => o.trim() !== "").map(text => ({ text }));
    if (validOptions.length < 2) return alert("Cần ít nhất 2 lựa chọn!");
    
    try {
      await axios.post(`${BACKEND_URL}/api/polls`, { 
        question, 
        options: validOptions,
        settings: { multiSelect: isMultiSelect } 
      });
      
      setQuestion("");
      setOptions(["", ""]);
      setIsMultiSelect(false);
      setIsCreating(false);
    } catch (error) {
      alert("Lỗi khi tạo: " + error.message);
    }
  };

  const handleVote = async (pollId, optionId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/polls/${pollId}/vote`, { optionId, userId });
    } catch (error) {
      const msg = error.response?.data?.msg || "Lỗi kết nối server";
      alert("⚠️ CẢNH BÁO BẢO MẬT:\n" + msg);
    }
  };

  const handleLike = async (pollId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/polls/${pollId}/like`);
    } catch (error) {}
  };

  // Tính năng tải ảnh kết quả
  const handleDownloadImage = async (pollId) => {
    const element = document.getElementById(`poll-card-${pollId}`);
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2, 
          ignoreElements: (node) => node.classList.contains('no-capture')
        });
        const link = document.createElement('a');
        link.download = `ket-qua-poll-${pollId}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (err) {
        alert("Không thể tải ảnh lúc này.");
      }
    }
  };

  const shareSocial = (platform, poll) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Tham gia bình chọn: "${poll.question}"`);
    let shareUrl = "";

    if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    else if (platform === 'twitter') shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    else if (platform === 'linkedin') shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    else if (platform === 'copy') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedId(poll._id);
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }
    
    const width = 600, height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    window.open(shareUrl, '_blank', `width=${width},height=${height},top=${top},left=${left}`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="app-container">
      <header className="app-header no-print">
        <div className="header-content">
          <h1>📊 Poll Master</h1>
          <p>Hệ thống bình chọn toàn diện</p>
        </div>
        <div className="header-actions">
           <button className="btn-secondary" onClick={handlePrint}>🖨️ Xuất PDF</button>
           <button className="btn-primary create-btn" onClick={() => setIsCreating(!isCreating)}>
             {isCreating ? "Đóng Form" : "+ Tạo Bình Chọn"}
           </button>
        </div>
      </header>

      <main className="main-content">
        <div className={`create-panel no-print ${isCreating ? 'active' : ''}`}>
          <div className="card form-card">
            <h2>✨ Tạo cuộc thăm dò mới</h2>
            <input className="input-field question-input" placeholder="Câu hỏi..." value={question} onChange={e => setQuestion(e.target.value)} />
            <div className="options-list">
              {options.map((opt, i) => (
                <input key={i} className="input-field option-input" placeholder={`Lựa chọn ${i + 1}`} value={opt} onChange={e => {
                  const newOpts = [...options]; newOpts[i] = e.target.value; setOptions(newOpts);
                }} />
              ))}
            </div>
            <div className="poll-settings">
              <label className="checkbox-label">
                <input type="checkbox" checked={isMultiSelect} onChange={e => setIsMultiSelect(e.target.checked)} />
                Cho phép chọn nhiều đáp án (Multi-select)
              </label>
            </div>
            <div className="form-actions">
              <button className="btn-text" onClick={() => setOptions([...options, ""])}>+ Thêm lựa chọn</button>
              <button className="btn-primary" onClick={handleCreate}>Đăng ngay 🚀</button>
            </div>
          </div>
        </div>

        <div className="poll-grid">
          {polls.map(poll => {
             const isMulti = poll.settings?.multiSelect;
             const myVotes = poll.votedDetail 
                ? poll.votedDetail.filter(v => v.userId === userId).map(v => v.optionId)
                : [];
             const hasVotedAny = myVotes.length > 0;

             return (
              <div id={`poll-card-${poll._id}`} key={poll._id} className="card poll-card avoid-break">
                <div className="poll-header">
                  <div>
                    <h3 className="poll-question">{poll.question}</h3>
                    <div className="security-badge no-print">🔒 Secure Poll</div>
                  </div>
                  <div className="poll-badges no-print">
                    {isMulti ? <span className="badge multi">Chọn nhiều</span> : <span className="badge single">Chọn 1</span>}
                  </div>
                </div>

                <div className="poll-body">
                  <div className="poll-layout">
                    <div className="vote-options">
                      {poll.options.map((opt, idx) => {
                        const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                        const percent = totalVotes === 0 ? 0 : Math.round(((opt.votes || 0) / totalVotes) * 100);
                        const isSelected = myVotes.includes(opt._id);
                        const isDisabled = isMulti ? isSelected : hasVotedAny;

                        return (
                          <div key={opt._id} className={`vote-item ${isDisabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => !isDisabled && handleVote(poll._id, opt._id)}>
                            <div className="vote-progress-bg">
                              <div className="vote-progress-fill" style={{width: `${percent}%`, backgroundColor: COLORS[idx % COLORS.length] + '40'}}></div>
                            </div>
                            <div className="vote-content">
                              <span className="vote-text">{isSelected ? '✅ ' : isMulti ? '⬜ ' : '🔘 '} {opt.text}</span>
                              <span className="vote-stat">{opt.votes} ({percent}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={poll.options}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                          <XAxis dataKey="text" hide />
                          <YAxis hide />
                          <Tooltip cursor={{fill: 'transparent'}} />
                          <Bar dataKey="votes" radius={[4, 4, 4, 4]}>
                            {poll.options.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="poll-footer no-print">
                  <div className="left-actions">
                    <button className="action-btn like-btn" onClick={() => handleLike(poll._id)}>
                      ❤️ <span>{poll.likes || 0}</span>
                    </button>
                    <button className="action-btn download-btn" onClick={() => handleDownloadImage(poll._id)} title="Tải ảnh kết quả">
                      📥 Tải Ảnh
                    </button>
                    <button className="action-btn copy-btn" onClick={() => shareSocial('copy', poll)}>
                      {copiedId === poll._id ? '✅ Đã Copy' : '🔗 Link'}
                    </button>
                  </div>
                  <div className="social-actions no-capture">
                    <span className="share-label">Share:</span>
                    <button className="icon-btn fb" onClick={() => shareSocial('facebook', poll)}>F</button>
                    <button className="icon-btn tw" onClick={() => shareSocial('twitter', poll)}>X</button>
                    <button className="icon-btn in" onClick={() => shareSocial('linkedin', poll)}>in</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default App;