const Wallet = require('../../models/walletSchema');
const User = require("../../models/userSchema");
const razorpayInstance = require("../../config/razorpayConfig");
const env=require("dotenv").config();
const crypto = require('crypto');


const getOrCreateWallet = async (userId) => {

    // const userId = req.session.user._id;
    // const userData = await User.findOne({ _id: userId });

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        transactions: [],
      });
    }
    return wallet;
  };


const loadWallet = async (req,res)=>{
    try {
        
        
        const userId = req.session.user._id;
        const userData = await User.findOne({ _id: userId });
        
        if(!userData){
           
            return res.redirect("/login");
        }
    
        const wallet = await getOrCreateWallet(userId);

        wallet.transactions.sort((a,b)=>b.date - a.date);

        const page = parseInt(req.query.page) || 1;
        const perPage = 4;
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / perPage);

        const paginatedTransactions = wallet.transactions.slice((page - 1) * perPage, page * perPage);

        wallet.transactions = paginatedTransactions;
    

        res.render("wallet", { wallet, user: userData, currentPage: page, totalPages  });

    } catch (error) {
        console.error("Error loading wallet:", error);
    res.status(500).send("Internal Server Error");

    }
        
}

const rechargeWallet = async(req,res)=>{
    try {
        const userId = req.session.user._id;
        const { amount } = req.body;

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
          }

          const shortUserId = userId.toString().slice(-4); 
          const shortTimestamp = Date.now().toString().slice(-8); 
          const receipt = `wallet_${shortUserId}_${shortTimestamp}`;

          const options = {
            amount: Math.round(Number(amount) * 100), 
            currency: "INR",
            receipt: receipt,
            payment_capture: 1, 
          };

          const order = await razorpayInstance.orders.create(options);
          res.status(200).json({ success: true, order });
    } catch (error) {
        console.error("Error creating wallet recharge order:", error);
        res.status(500).json({ success: false, message: "Failed to create wallet recharge order" });
    }

};

const walletRechargeCallback = async (req,res)=>{
    try {
        
        const userId = req.session.user._id;
        const { orderId, paymentId, signature, amount } = req.body;

        const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + "|" + paymentId)
        .digest('hex');

        

        if (generatedSignature !== signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
          }

          const wallet = await Wallet.findOne({ userId });
          

          if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
          }

          

          wallet.balance += Number(amount);

          


          wallet.transactions.push({
            type: "Recharge",
            amount: Number(amount),
            description: "Wallet recharge via Razorpay"
          });

          

          await wallet.save();

          res.status(200).json({ success: true, message: "Wallet recharged successfully!" });

          
      
      
    } catch (error) {
        console.error("Error in wallet recharge callback:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}























module.exports={
    loadWallet,
    rechargeWallet,
    getOrCreateWallet,
    walletRechargeCallback,
}