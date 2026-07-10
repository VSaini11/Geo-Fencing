const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  firstCheckIn: { type: Date },
  lastCheckOut: { type: Date },
  events: [{
    time: { type: Date, required: true },
    type: { type: String, enum: ['enter', 'exit', 'ping'], required: true },
    tag: { type: String, enum: ['lunch', 'unscheduled', 'shift_end', 'active'] },
    coords: {
      latitude: Number,
      longitude: Number
    }
  }],
  workedMinutes: { type: Number, default: 0 },
  lunchMinutes: { type: Number, default: 0 },
  unscheduledMinutes: { type: Number, default: 0 },
  flags: [{ type: String }] // e.g., 'late_checkin', 'early_checkout', 'excessive_breaks'
});

// Compound index to quickly find a user's log for a specific date
dailyLogSchema.index({ userName: 1, date: 1 }, { unique: true });

dailyLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
  }
});

module.exports = mongoose.model('DailyLog', dailyLogSchema);
