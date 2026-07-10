const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  userName: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  checkInAt: { type: Date, default: Date.now },
  checkOutAt: { type: Date },
  lastLatitude: { type: Number, required: true },
  lastLongitude: { type: Number, required: true },
  lastPingAt: { type: Date, default: Date.now }
});

// Using a custom toJSON to map _id to id so it matches existing frontend types
checkInSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    if (ret.locationId) {
       ret.locationId = ret.locationId.toString();
    }
  }
});

module.exports = mongoose.model('CheckIn', checkInSchema);
