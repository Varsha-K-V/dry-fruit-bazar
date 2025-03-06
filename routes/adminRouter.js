const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController")
const {userAuth,adminAuth} = require("../middlewares/auth");
const productController = require("../controllers/admin/productController");
const orderController=require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponControllers");
const salesReportController = require("../controllers/admin/salesReportController");
const dashboardController = require("../controllers/admin/dashboardController");
const multer = require("multer");
const path= require('path');
router.use(express.static('public'));




const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname,'../public/uploads/productImage')); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + "-" + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fieldSize: 10 * 1024 * 1024 } // 10 MB
  });


router.get("/pageError",adminController.pageError)

router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
// router.get("/dashboard",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout);

router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)
//Category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.put('/editCategory/:id', adminAuth, categoryController.editCategory);
router.patch("/listCategory",adminAuth,categoryController.getListCategory);
router.patch("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer);
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer)
//product management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,upload.array("images",3),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,upload.fields([
    { name: "images", maxCount: 3 },
    { name: "newImage", maxCount: 1 }
  ]),productController.editProduct);
// router.post('/admin/editProduct/:id', upload.array('images', 3), editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);
router.post("/addProductOffer",adminAuth,productController.addProductOffer);
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer);

router.get("/viewVariants",adminAuth,productController.viewVariants);
router.get("/addVariant",adminAuth,productController.getAddVariant);
router.post("/addVariant",adminAuth,productController.postAddVariant);
router.get("/editVariant",adminAuth,productController.getEditVariant);
router.post("/editVariant",adminAuth,productController.postEditVariant);
router.get("/deleteVariant",adminAuth,productController.deleteVariant);
// order Management
router.get("/order",adminAuth,orderController.loadOrderList);
router.get("/orderDetails",adminAuth,orderController.loadOrderDetails)
router.post("/updateOrderStatus",adminAuth,orderController.updateOrderStatus)
router.post("/orders/approve-return",userAuth,orderController.approveReturn)
router.post("/orders/reject-return",userAuth,orderController.rejectReturn)
// couponManagement

router.get("/coupons",adminAuth,couponController.getAllCoupons);
router.get("/addCoupon/:id?",adminAuth,couponController.loadAddCoupon);
router.post("/addCoupon",adminAuth,couponController.addCoupon);
router.put("/editCoupon",adminAuth,couponController.editCoupon);
router.delete("/deleteCoupon/:id",adminAuth,couponController.deleteCoupon);

// Sales Report Routes
router.get('/sales-report', adminAuth, salesReportController.getSalesReport);
router.get('/sales-report/download-excel', adminAuth, salesReportController.downloadExcel);
router.get('/sales-report/download-pdf', adminAuth, salesReportController.downloadPDF);

router.get("/dashboard",adminAuth,dashboardController.loadDashboard);


module.exports=router;
