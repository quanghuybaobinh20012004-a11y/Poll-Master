require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require("socket.io");
const Poll = require('./models/Poll');

const app = express();
const server = http.createServer(app);

// Cấu hình để lấy đúng IP nếu sau này deploy lên host (Vercel/Heroku)
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

const MONGO_URI = process.env.MONGO_URI; 
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Đã kết nối MongoDB Cloud'))
  .catch(err => console.log('❌ Lỗi kết nối:', err));

// --- API ---

app.get('/api/polls', async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    res.json(polls);
  } catch (err) { res.status(500).json(err); }
});

app.post('/api/polls', async (req, res) => {
  try {
    const { question, options, settings } = req.body;
    const newPoll = new Poll({ question, options, settings });
    await newPoll.save();
    io.emit('new-poll', newPoll);
    res.json(newPoll);
  } catch (err) { res.status(500).json(err); }
});

// --- API VOTE AN TOÀN (SECURE VOTING) ---
app.post('/api/polls/:id/vote', async (req, res) => {
  try {
    const { optionId, userId } = req.body;
    
    // 1. LẤY ĐỊA CHỈ IP NGƯỜI DÙNG
    // Nếu chạy localhost thì IP thường là ::1 hoặc 127.0.0.1
    let clientIp = req.ip || req.connection.remoteAddress;
    
    // Chuẩn hóa IP (bỏ prefix ::ffff: nếu có)
    if (clientIp.startsWith("::ffff:")) clientIp = clientIp.substring(7);

    console.log(`User ${userId} voting from IP: ${clientIp}`);

    const poll = await Poll.findById(req.params.id);
    const isMultiSelect = poll.settings && poll.settings.multiSelect;

    // 2. LỚP BẢO MẬT 1: KIỂM TRA IP (Chống Spam từ ẩn danh)
    // Nếu poll này không cho chọn nhiều, và IP này đã từng vote -> CHẶN NGAY
    if (!isMultiSelect && poll.votedIPs.includes(clientIp)) {
      return res.status(403).json({ 
        msg: "Địa chỉ IP của bạn đã bỏ phiếu rồi! (An toàn chống Spam)" 
      });
    }

    // 3. LỚP BẢO MẬT 2: KIỂM TRA USER ID (Chống double click)
    const userVotes = poll.votedDetail.filter(v => v.userId === userId);
    
    if (isMultiSelect) {
      // Nếu chọn nhiều: Chặn nếu đã chọn đúng option này rồi
      const hasVotedThisOption = userVotes.some(v => v.optionId === optionId);
      if (hasVotedThisOption) return res.status(400).json({ msg: "Bạn đã chọn đáp án này rồi!" });
    } else {
      // Nếu chọn 1: Chặn nếu ID này đã vote bất kỳ cái nào
      if (userVotes.length > 0) return res.status(400).json({ msg: "Bạn chỉ được chọn 1 đáp án!" });
    }

    // 4. GHI NHẬN PHIẾU BẦU HỢP LỆ
    const option = poll.options.id(optionId);
    if (!option) return res.status(404).json({ msg: "Lựa chọn không tồn tại" });
    
    option.votes++;
    poll.votedDetail.push({ userId, optionId });
    
    // Lưu IP vào danh sách (nếu chưa có)
    if (!poll.votedIPs.includes(clientIp)) {
      poll.votedIPs.push(clientIp);
    }
    
    await poll.save();
    io.emit('update-poll', poll);
    res.json(poll);

  } catch (err) { 
    console.error(err);
    res.status(500).json({ msg: "Lỗi server" }); 
  }
});

app.post('/api/polls/:id/like', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    poll.likes = (poll.likes || 0) + 1;
    await poll.save();
    io.emit('update-poll', poll);
    res.json(poll);
  } catch (err) { res.status(500).json(err); }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});