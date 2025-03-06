const Coupon = require("../../models/couponSchema");


const getAllCoupons = async (req,res)=>{
    try {
        const page = parseInt(req.query.page)||1;
        const limit =5;
        const skip = (page-1)*limit;

        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupon.find().sort({ _id: -1 }).skip(skip).limit(limit);

        res.render("coupons",{
            coupons,
            currentPage: page,
            totalPages

        });
    } catch (error) {
        console.error("Error fetching coupons",error);
        res.status(500).send("Internal Server Error");
    }
}

const loadAddCoupon = async (req, res) => {
    try {
        let coupon = null;
        if (req.params.id) {
            coupon = await Coupon.findById(req.params.id);
        }
        res.render("addCoupon", { coupon });
    } catch (error) {
        console.error("Error loading Add Coupon page:", error);           
        res.status(500).send("Error loading page");
    }
};




const addCoupon = async (req, res) => {
    try {
        let { code, discountValue, minPurchaseAmount, maxPurchaseAmount,expiryDate, maxUsageLimit } = req.body;

        
        const codeRegex = /^[A-Z0-9]+$/;
        if (!codeRegex.test(code)) {
            return res.json({ success: false, message: "Coupon code must contain only uppercase letters and numbers!" });
        }

        
        discountValue = Number(discountValue);
        if (isNaN(discountValue) || discountValue < 1 || discountValue > 100) {
            return res.json({ success: false, message: "Discount value must be between 1 and 100!" });
        }

        
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const expiry = new Date(expiryDate);
        if (expiry <= today) {
            return res.json({ success: false, message: "Expiry date must be a future date!" });
        }

        
        maxUsageLimit = Number(maxUsageLimit);
        if (isNaN(maxUsageLimit) || maxUsageLimit < 1 || maxUsageLimit > 10) {
            return res.json({ success: false, message: "Max usage limit must be between 1 and 10!" });
        }

        
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.json({ success: false, message: "Coupon code already exists!" });
        }

        
        const newCoupon = new Coupon({
            code,
            discountValue,
            minPurchaseAmount,
            expiryDate,
            maxUsageLimit,
            maxPurchaseAmount,
        });

        await newCoupon.save();

        return res.json({ success: true, message: "Coupon Added Successfully!", redirect: "/admin/coupons" });

    } catch (error) {
        console.error("Error Adding Coupon", error);
        return res.json({ success: false, message: "Error Adding Coupon" });
    }
};




const editCoupon = async (req, res) => {
    try {
        let { couponId, code, discountValue, minPurchaseAmount, expiryDate, maxUsageLimit } = req.body;

        
        const codeRegex = /^[A-Z0-9]+$/;
        if (!codeRegex.test(code)) {
            return res.json({ success: false, message: "Coupon code must contain only uppercase letters and numbers!" });
        }

        const duplicateCoupon = await Coupon.findOne({ 
            code, 
            _id: { $ne: couponId } 
        });
        if (duplicateCoupon) {
            return res.json({ success: false, message: "Coupon code already exists!" });
        }


        discountValue = Number(discountValue);
        if (isNaN(discountValue) || discountValue < 1 || discountValue > 100) {
            return res.json({ success: false, message: "Discount value must be between 1 and 100!" });
        }

        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDate);
        if (expiry <= today) {
            return res.json({ success: false, message: "Expiry date must be a future date!" });
        }

    
        maxUsageLimit = Number(maxUsageLimit);
        if (isNaN(maxUsageLimit) || maxUsageLimit < 1 || maxUsageLimit > 10) {
            return res.json({ success: false, message: "Max usage limit must be between 1 and 10!" });
        }

    
        const existingCoupon = await Coupon.findById(couponId);
        if (!existingCoupon) {
            return res.json({ success: false, message: "Coupon not found!" });
        }

        
        existingCoupon.code = code;
        existingCoupon.discountValue = discountValue;
        existingCoupon.minPurchaseAmount = minPurchaseAmount;
        existingCoupon.expiryDate = expiryDate;
        existingCoupon.maxUsageLimit = maxUsageLimit;

        await existingCoupon.save();

        return res.json({ success: true, message: "Coupon Updated Successfully!", redirect: "/admin/coupons" });

    } catch (error) {
        console.error("Error Editing Coupon", error);
        return res.json({ success: false, message: "Error Editing Coupon" });
    }
};


const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

        if (!deletedCoupon) {
            return res.json({ success: false, message: "Coupon not found!" });
        }

        return res.json({ success: true, message: "Coupon deleted successfully!", redirect: "/admin/coupons" });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        return res.json({ success: false, message: "Error deleting coupon." });
    }
};


  





module.exports ={
    getAllCoupons,
    loadAddCoupon,
    addCoupon,
    editCoupon,
    deleteCoupon,
   
}