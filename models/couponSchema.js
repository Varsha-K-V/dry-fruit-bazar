const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discountValue: { type: Number, required: true },
    minPurchaseAmount: { type: Number, required: true },
    maxPurchaseAmount: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    maxUsageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Coupon", couponSchema);
