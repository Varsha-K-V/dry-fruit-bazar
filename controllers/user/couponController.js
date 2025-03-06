const Coupon = require("../../models/couponSchema");

const getAvailableCoupons = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const purchaseAmount = parseFloat(req.query.purchaseAmount);
        if (isNaN(purchaseAmount) || purchaseAmount <= 0) {
            return res.json({ success: false, message: "Invalid purchase amount." });
        }

    const coupons = await Coupon.find({
      expiryDate: { $gt: today },
      minPurchaseAmount: { $lte: purchaseAmount },
      maxPurchaseAmount: { $gte: purchaseAmount },
      $expr: { $lt: ["$usedCount", "$maxUsageLimit"] }
  });

    res.json({ success: true, coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.json({ success: false, message: "Error fetching coupons." });
  }
};



module.exports = {
  getAvailableCoupons,
  
};
