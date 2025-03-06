const express=require("express");
const router =express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productController");
const addressController = require("../controllers/user/addressController");
const cartController = require("../controllers/user/cartController");
const wishlistController = require("../controllers/user/whislistController");
const walletController = require("../controllers/user/walletController");
const couponController=require("../controllers/user/couponController");
const passport = require("passport");
const { userAuth } = require("../middlewares/auth");

router.use(express.static('public'))
router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomepage);
router.get("/signup",userController.loadSignUp);
router.post("/signup",userController.signup)
router.get("/otpPage",userController.loadOtp);
router.post("/otpPage",userController.otpPage);
router.post("/resendOtp",userController.resendOTP);


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user=req.user
    return res.redirect('/')
});

// userlogin
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
router.get("/logout",userController.logout);
//  products
router.get('/productDetails',userAuth, productController.productDetails);         
router.get('/productDetails/:id',userAuth, productController.productDetails);
router.get("/shop",userAuth,productController.loadShopPage);
router.get('/filter',userAuth,productController.filterProduct);
router.get("/filterPrice",userAuth,productController.filterByPrice);
router.post("/search",userAuth,productController.searchProducts);
router.get("/sort",userAuth,productController.sortProducts);
router.get('/clear',userAuth,productController.clearSearchData);

//router.get("/shop",productController.loadShopProducts);
// userProfile
router.get("/userProfile",userAuth,userController.loadUserProfile);
router.post("/updateuserProfile",userAuth,userController.updateUserProfile);
// addressManagement
router.get("/addressManagement",userAuth,addressController.loadAddress);
router.post("/addresses",userAuth,addressController.addAddress);
router.post("/addresses/edit",userAuth,addressController.updateAddress);
router.delete("/addresses/delete/:id",userAuth,addressController.deleteAddress);
//changePassword
router.get("/changePassword",userAuth,addressController.changePassword);
router.post("/updatePassword",userAuth,addressController.updatePassword);

// forgotPassword
router.get("/forgotPassword",userController.loadForgotPassword);
router.post("/forgotPassword",userController.forgotPassword);
router.get("/forgotVerifyOtp",userController.loadVerifyOtp);
router.post("/verifyOtp",userController.verifyOtp);
router.post("/resendOtp2",userController.resendOTP2)
router.get("/resetPassword",userController.loadResetPassword);
router.post("/resetPassword",userController.resetPassword);
//cartManagement
router.post('')
router.post("/cart/add",userAuth,cartController.addToCart);
router.get("/cart",userAuth,cartController.viewCart);
router.delete("/cart/remove/:productId/:variantId",userAuth,cartController.removeCartItem);
router.put("/cart/update/:productId/:variantId", userAuth,cartController.updateCartItem);
router.put("/cart/clear",userAuth,cartController.clearCart);

//checkOut

router.get("/checkOut",userAuth,cartController.loadCheckOut);
router.post("/addAddress",userAuth,cartController.saveAddress);
router.get("/getAddress",userAuth,cartController.getEditAddress);
router.get("/getAllAddress",userAuth,cartController.getAllAddress);
router.patch("/updateAddress/:addressId",userAuth,cartController.updateAddress);
router.post("/order/placeOrder",userAuth,cartController.placeOrder);
router.get("/orderConfirmation/:orderId",userAuth,cartController.orderConfirmation);
router.get("/order/retry-payment/:orderId",userAuth,cartController.retryPayment)
router.post("/order/update-payment",userAuth,cartController.updatePaymentStatus);
// router.get("/order/invoice/:orderId",userAuth,cartController.invoiceDownload);
router.get('/order/invoice/:orderId',userAuth,cartController.downloadPDF);

//orderManagement

router.get("/orderDetails/:orderId",userAuth,cartController.loadOrderDetails);
router.get("/orderHistory",userAuth,cartController.loadOrderHistory);
router.delete("/order/:orderId/cancel",userAuth,cartController.cancelOrderItem);
router.post('/order/request-return',userAuth,cartController.requestReturn);
//wishlist management

router.get("/wishlist",userAuth,wishlistController.loadWhistList);
router.post("/wishlist/add",userAuth,wishlistController.addToWishlist);
router.post("/wishlist/move-to-cart",userAuth,wishlistController.moveToCart);
router.post("/wishlist/remove-from-wishlist",userAuth,wishlistController.removeFromWishlist);

//razorpay
router.post("/create-order", userAuth,cartController.createorder)

//walletManagement

router.get("/wallet",userAuth,walletController.loadWallet)
router.post("/wallet/recharge",userAuth,walletController.rechargeWallet);
router.post("/wallet/recharge-callback",userAuth,walletController.walletRechargeCallback);

//coupon management

router.get('/availableCoupons',userAuth,couponController.getAvailableCoupons);
// router.post("/validateCoupon",userAuth,couponController.validateCoupon);


module.exports = router;

