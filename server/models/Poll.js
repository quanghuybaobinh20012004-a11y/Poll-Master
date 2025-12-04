const mongoose = require('mongoose');

const PollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{
    text: String,
    votes: { type: Number, default: 0 }
  }],
  settings: {
    multiSelect: { type: Boolean, default: false },
  },
  likes: { type: Number, default: 0 },
  
  // CHI TIẾT VOTE AN TOÀN
  votedDetail: [{ userId: String, optionId: String }], // Kiểm tra bằng ID trình duyệt
  votedIPs: [{ type: String }], // MỚI: Kiểm tra bằng địa chỉ mạng (IP) để chặn ẩn danh
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Poll', PollSchema);