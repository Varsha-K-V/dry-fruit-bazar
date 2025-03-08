const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const bcrypt = require('bcrypt');
const env=require("dotenv").config();
const nodemailer=require("nodemailer");
const crypto = require("crypto");
const otpStore = new Map();
const Wallet = require('../../models/walletSchema');


const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};



const loadHomepage = async (req, res) => {
  try {

    const user = req.session.user;

    const categories = await Category.find({ isListed: true });
    if (!categories.length) {
      console.log("No listed categories found.");
    }

    // let productData = await Product.find({
    //   isBlocked: false,
    //   category: { $in: categories.map((category) => category._id) },
    //   quantity: { $gt: 0 }, 
    // })
  
    let productData = await Product.aggregate([
      {
          $lookup: {
              from: "variants",
              localField: "_id",
              foreignField: "productId",
              as: "variants"
          }
      },
      {
          $match: {
              isBlocked: false,
              category: { $in: categories.map((category) => category._id) },
              "variants.stock": { $gt: 0 }
          }
      },
      {
          $sort: { createdAt: -1 } 
      },
      {
          $limit: 4 
      }
  ]);

  //console.log(productData);
  
  if (!productData.length) {
    console.log("No products found matching criteria.");
  }
  
  
  
  
  productData = productData.map((product) => {
      if (!product.productImage || !product.productImage.length) {
        product.productImage = ["default.jpg"]; 
      }
      
      return product;
    });

  
    //console.log("product data: ", productData);
    if (user) {
      const userData = await User.findOne({ _id: user._id });
      if (!userData) {
        console.log("User data not found for logged-in user.");
      }
      return res.render("home", { user: userData, products: productData });
    }

  
    return res.render("home", { products: productData });
  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).send("Server Error");
  }
};

const loadSignUp = async (req, res) => {
  try {
    return res.render("signup", {
      Message: ''
    });
  } catch (error) {
    console.log("Sign up page is not loading", error);
    res.status(500).send("Server Error");
  }
};

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){
    try {
        
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject:"Verify your account",
        text:`your OTP is ${otp}`,
        html:`<b>Your OTP:${otp}</b>`,
        })

        return info.accepted.length >0


    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

const signup = async (req,res)=>{
    try {
      
        const {name,email,password,Cpassword,mobileNumber}=req.body;
       
        if(password!==Cpassword){
        
            return res.render("signup",{Message:"Password do not match"});
            
        }
        
        const findUser = await User.findOne({email})
        if(findUser)
          {
            return res.render("signup",{Message:"User with this email already exists"});
        }
        

        const otp = generateOtp();

        const emailSent = await sendVerificationEmail(email,otp);
        console.log(otp);
        if(!emailSent){
            return res.json("email-error")
        }

        req.session.userOTP = otp;
        console.log(req.session.userOTP);
        req.session.userData = {name,email,password,mobileNumber};
     
        res.render("otpPage");
        console.log("OTP sent",otp);

    } catch (error) {
        console.error("signup error",error);
        res.redirect("/pageNotFound")
    }
}

const loadOtp = async (req,res)=>{
    try {
         res.render("otpPage");
    } catch (error) {
        console.log("otp page not found");
        res.status(500).send("Server error");
    }
}

const securePassword = async (password)=>{
  try {
    
    const passwordHash = await bcrypt.hash(password,10)
    return passwordHash;
  } catch (error) {
    
  }
}

const otpPage = async (req,res)=>{
  try {

    const {otp}= req.body;

    console.log(otp);

    if(otp===req.session.userOTP){
      const user= req.session.userData
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name:user.name,
        email:user.email,
        mobileNumber:user.mobileNumber,
        password:passwordHash,
      })

      await saveUserData.save();
      
      await Wallet.create({
        userId: saveUserData._id,
        balance: 0,
        transactions: [],
      });
      
      res.json({ success: true, redirectUrl: "/login" });
    
    }else {
      res.status(400).json({success:false, Message:"Invalid OTP, Please try again"})
    }
    
  } catch (error) {
    console.error("Error verifying OTP",error);
    res.status(500).json({success:false,Message:"An error occured"})
  }
} 


const resendOTP = async (req,res)=>{
  
  try {
      
    const {email}=req.session.userData;
    if(!email){
      return res.status(400).json({success:false,Message:"Email not found in session"})
    }

    const otp = generateOtp();
    req.session.userOTP = otp;

    const emailSent = await sendVerificationEmail(email,otp);
    if(emailSent){
      console.log("Resend OTP:",otp);
      res.status(200).json({success:true,message:"OTP Resend Successfully"});
    }else{
      res.status(500).json({success:false,message:"Failed to resend OTP.Please try again."});
    }
  } catch (error) {
    console.error("Error resending OTP",error);
    res.status(500).json({success:false,message:"Internal Server Error. Please try again"})
  }
};


const loadLogin= async (req,res)=>{
  try {
    
    if(!req.session.user){
      return res.render("login")
    }else{
      res.redirect('/')
    }
  } catch (error) {
    res.redirect("/pageNotFound")
  }
};


const login = async (req,res)=>{

  try {

    const {email,password} = req.body;

    const findUser = await User.findOne({is_admin:false,email:email});
    

    if(!findUser){
      return res.render("login",{message:"User not found"});
    }
    if(findUser.is_Blocked){
      return res.render("login",{message:"User is blocked by admin"});
    }

    const passwordMatch = await bcrypt.compare(password,findUser.password);
    if(!passwordMatch){
      return res.render("login",{message:"Incorrect Password"})
    }

    req.session.user = findUser;
   
    //console.log(req.session.user)
    res.redirect("/")
  } catch (error) {
      console.error("login error",error);
      res.render("login",{message:"login failed. Please try again later"})
    
  }
};

const logout = async (req,res)=>{
  try {
    
    req.session.destroy((err)=>{
      if(err){
        console.log("Session destruction error",err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login")
    })

  } catch (error) {
    console.log("Logout error",error);
    res.redirect("/pageNotFound")
  }
}

const loadUserProfile = async (req,res)=>{

  try {
    const userId = req.session.user;
    // console.log("UserDetails " ,userId);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.render('userProfile', { user });
   
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error });
  }
}

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, mobileNumber } = req.body;

    
    if (!name || !mobileNumber) {
      return res.status(400).json({ message: 'Name and mobile number are required!' });
    }

    const nameRegex = /^[a-zA-Z\s]+$/;
    const mobileRegex = /^[0-9]{10}$/;

    if (!nameRegex.test(name)) {
      return res.status(400).json({ message: 'Name should only contain letters and spaces!' });
    }

    if (!mobileRegex.test(mobileNumber)) {
      return res.status(400).json({ message: 'Mobile number must be exactly 10 digits!' });
    }

   
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, mobileNumber },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found!' });
    }

   
    res.status(200).json({ message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'An error occurred while updating the profile.' });
  }
};


const loadForgotPassword = async (req,res)=>{
  try {
    res.render("forgotPassword");
  } catch (error) {
    res.redirect("/pageNotFound")
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendForgotPasswordOtp(email, otp) {
  try {
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          port: 587,
          secure: false, 
          requireTLS: true,
          auth: {
              user: process.env.NODEMAILER_EMAIL, 
              pass: process.env.NODEMAILER_PASSWORD 
          }
      });

      
      const info = await transporter.sendMail({
          from: `"Dry Fruit Bazar Support" <${process.env.NODEMAILER_EMAIL}>`,
          to: email, 
          subject: "Reset Your Password - Dry Fruit Bazar",
          text: `Your OTP for resetting your password is: ${otp}`, 
          html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                  <h2 style="color: #dba56f;">Password Reset Request</h2>
                  <p>Hi,</p>
                  <p>We received a request to reset your password for your Dry Fruit Bazar account. Please use the OTP below to reset your password:</p>
                  <h3 style="color: #000; font-weight: bold;">${otp}</h3>
                  <p>This OTP is valid for 5 minutes. If you did not request this, please ignore this email or contact support.</p>
                  <p>Thank you,</p>
                  <p>The Dry Fruit Bazar Team</p>
              </div>
          ` 
      });

      return info.accepted.length > 0;
  } catch (error) {
      console.error("Error sending email:", error.message);
      return false;
  }
}


const forgotPassword = async (req,res)=>{
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send(`<script>
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Please provide a valid email address.',
        }).then(() => {
          window.history.back();
        });
      </script>`);
    }

    const otp = generateOtp();

    const otpSent = await sendForgotPasswordOtp(email, otp);
    console.log(otp);

    if (otpSent) {

      otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); 
      return res.redirect(`/forgotVerifyOtp?email=${encodeURIComponent(email)}&otpSent=true`);
      
    } else {
      return res.status(500).send(`<script>
        Swal.fire({
          icon: 'error',
          title: 'Failed!',
          text: 'Unable to send OTP. Please try again later.',
        }).then(() => {
          window.history.back();
        });
      </script>`);
    }
  } catch (error) {
    console.error("Error in forgotPassword:", error.message);

    return res.status(500).send(`<script>
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Something went wrong. Please try again later.',
      }).then(() => {
        window.history.back();
      });
    </script>`);
    
  }
}

const loadVerifyOtp = async (req, res) => {
  try {
    const { email, otpSent } = req.query;

    if (!email) {
      return res.status(400).send(`<script>
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Email is required to verify OTP.',
        }).then(() => {
          window.location.href = '/forgotPassword';
        });
      </script>`);
    }

    console.log('Email passed to verifyOtp:', email); 
    res.render("forgotVerifyOtp", { email, otpSent });
  } catch (error) {
    console.error("Error in loadVerifyOtp:", error.message);
    res.redirect("/pageNotFound");
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log("Email received in verifyOtp:", email);
    console.log("OTP entered by user:", otp);

    const storedOtpData = otpStore.get(email);

    if (!storedOtpData) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found for the given email.',
        redirect: false,
      });
    }

    const { otp: storedOtp, expiresAt } = storedOtpData;

    if (Date.now() > expiresAt) {
      otpStore.delete(email); 
      return res.status(400).json({
        success: false,
        message: 'The OTP has expired. Please request a new one.',
        
      });
    }

    if (otp !== storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'The OTP you entered is incorrect.',
        
      });
    }

    otpStore.delete(email); 

    return res.status(200).json({
      success: true,
      message: 'Your OTP has been successfully verified. Please reset your password.',
      redirect: `/resetPassword?email=${email}`,
    });

  } catch (error) {
    console.error("Error in verifyOtp:", error); 
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      redirect: false,
    });
  }
};




const sendOtp = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail', 
    auth: {
      user: 'varshakvas@gmail.com', 
      pass: 'ssvv adsh mbqe jjva', 
    },
  });

  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP.');
  }
};




const resendOTP2 = async (req,res)=>{
  try {
    const { email } = req.body;
    const newOtp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { otp: newOtp, expiresAt });

    await sendOtp(email, newOtp);

    console.log(newOtp)

    res.status(200).json({
      success: true,
      message: 'A new OTP has been sent to your email.',
    });

  } catch (error) {
    console.error("Error in resendOtp:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again later.',
    });
  }
}


const loadResetPassword = async (req,res)=>{
  
  try {
    const email = req.query.email;
    
    if (!email) {
      return res.status(400).send(`<script>
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Email is required to reset password.',
        }).then(() => {
          window.location.href = '/forgotPassword'; // Redirect to forgotPassword page
        });
      </script>`);
    }
    res.render('resetPassword', { email });

  } catch (error) {
    console.error('Error rendering resetPassword page:', error.message);
    res.redirect('/pageNotFound'); 
    
  }
}

const resetPassword = async (req,res)=>{
  try {
    const { email, newPassword, confirmPassword } = req.body;
    

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'The passwords do not match. Please try again.',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'No user found with the provided email.',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully reset. You can now log in with your new password.',
    });


  } catch (error) {
    console.error("Error resetting password:", error.message);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
}







module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignUp,
  signup,
  loadOtp,
  otpPage,
  resendOTP,
  loadLogin,
  login,
  logout,
  loadUserProfile,
  updateUserProfile,
  loadForgotPassword,
  forgotPassword,
  sendForgotPasswordOtp,
  loadVerifyOtp,
  verifyOtp,
  resendOTP2,
  loadResetPassword,
  resetPassword,
  
  
};
