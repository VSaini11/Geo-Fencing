const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  radiusMeters: { type: Number, required: true },
  assignedEmployees: [{ type: String }],
  shiftStart: { type: String, default: "09:00" },
  shiftEnd: { type: String, default: "18:00" },
  lunchStart: { type: String, default: "12:00" },
  lunchEnd: { type: String, default: "13:00" },
  createdAt: { type: Date, default: Date.now }
});

// Using a custom toJSON to map _id to id so it matches existing frontend types
locationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
  }
});

module.exports = mongoose.model('Location', locationSchema);
