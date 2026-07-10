const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'employee'],
    required: true
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true // Only present for employees, allows multiple nulls if admins don't have it
  },
  pushToken: {
    type: String,
    required: false
  },
  lastLatitude: {
    type: Number,
    required: false
  },
  lastLongitude: {
    type: Number,
    required: false
  },
  lastLocationUpdatedAt: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
