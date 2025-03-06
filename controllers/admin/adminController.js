
const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");



const pageError = (req,res)=>{
    res.render("pageError");
}

const loadLogin = (req,res)=>{

    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("adminLogin",{message:null})
};

const login = async(req,res)=>{
    try {
        
        const {email,password} = req.body;
        console.log(email,password);
        const admin = await User.findOne({email,is_admin:true});
        if(admin){

            const passwordMatch = await bcrypt.compare(password,admin.password);
            console.log("Password match",passwordMatch);
            
            if(passwordMatch){
                
                req.session.admin = true;
                req.session.adminEmail =email
                return res.redirect("/admin/dashboard")
            }else{
                return res.redirect("/admin/login");
            }
        }else{
            return res.redirect("/admin/login")
        }
    } catch (error) {
        console.log("loggin error",error);
        return res.redirect("/pageError")

        
    }
};

const loadDashboard = async(req,res)=>{

    if(req.session.admin){
        try {
            
            res.render("dashboard");

        } catch (error) {
            res.redirect("/pageError")
        }
    }
};

const logout = async (req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err);
                return res.redirect("pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout",error)
        res.redirect("/pageError")
        
    }
}



module.exports = {
    loadLogin ,
    login,
    loadDashboard,
    pageError,
    logout
};