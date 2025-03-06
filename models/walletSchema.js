const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({

    type: { type: String, enum: ['Recharge', 'Payment', 'Refund', 'Cashback'], required: true }, 
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String },
});

const walletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    balance: { type: Number, default: 0 },
    transactions: [walletTransactionSchema],
});

module.exports = mongoose.model('Wallet', walletSchema);
