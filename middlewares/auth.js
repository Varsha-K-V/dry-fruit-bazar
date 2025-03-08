const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
    try {
        if (req.session.user) {
            const userId = req.session.user._id;
            console.log(userId);
            
            const user = await User.findById(userId);
            
            if (user && !user.is_Blocked) {
                req.user = user;
                return next();
            } else {
                console.log("User is either blocked or not found.");
    
                req.session.destroy(err => {
                    if (err) {
                        console.error("Session destruction error:", err);
                    }
                    return res.redirect("/login");
                });
            }
        } else {
            console.log("User session not found");
            return res.redirect("/login");
        }
    } catch (error) {
        console.error("Error in userAuth middleware:", error);
        res.status(500).send("Internal Server Error");
    }
};



const adminAuth = async(req,res,next)=>{
    try{
    if (req.session.admin) {
        const admin = await User.findOne({email:req.session.adminEmail,is_admin:true})
        if(admin){
            next()
        }else{
            res.redirect('/admin/login') 
        }
       
        
    } else {
        res.redirect('/admin/login')
        
    }
} catch (error){
    console.error("Error in adminAuth middleware:", error);
    res.status(500).send("Internal Server Error");
}

}

module.exports = {
    userAuth,
    adminAuth,
}