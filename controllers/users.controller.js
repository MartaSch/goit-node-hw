const express = require('express')
const jwt = require('jsonwebtoken');
const gravatar = require('gravatar');
const User = require("../service/schemas/users");
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const { v4: uuidv4} = require('uuid')
const optimizeImage = require('../helpers/optimizeImage');
require('dotenv').config()
const secret = process.env.SECRET
const emailService = require('../service/email.service');

const signUp = async (req, res, next) => {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).lean();
        if (user) {
            return res.status(409)
            .json({
                status: 'conflict',
                code: 409,
                message: 'Email in use',
            });
        }
        try {
            const avatarURL = gravatar.url(email, { s: '200', r: 'pg', d: 'mm' });
            const verificationToken = uuidv4();
            const newUser = new User({
                email,
                password,
                avatarURL,
                verificationToken
             });
            newUser.setPassword(password)
            await newUser.save()

            await emailService.send(email, verificationToken)

            return res.status(201).json({
                status: 'Created',
                code: 201,
                ResponseBody: {
                    user: {
                        email: email,
                        avatarURL: avatarURL,
                        subscription: 'starter',
                        verificationToken: verificationToken,
                    },
                },
            })
        } catch (error) {
            next(error);
        }
}

const logIn = async (req, res) => {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if(!user || !user.validPassword(password)) {
        return res.status(400).json({
            status: 'Bad request',
            code: 400,
            message: 'Incorrect login or password',
        })
    }
    const payload = {
        id: user.id,
    }
    const token = jwt.sign(payload, secret, { expiresIn: '1h' })
   return res.json({
        status: 'success',
        code: 200,
        data: {
            id: user._id,
            email: email,
            token,
        }
    })
}

const logOut = async ( req, res, next) => {
    const { _id } = req.user;
    const user = await User.findByIdAndUpdate(_id, { token: null});
    if(!user) {
        return res.status(401).json({
            status: 'Unauthorized',
            code: 401,
            message: 'Not authorized'
        })
    }

    res.status(204).json({
        status: 'No content',
        code: 204,
        message: 'Logged out'
    })
}


const currentUser = async (req, res) => {
    const { _id, email } = req.user;
    const user = await User.findById(_id)
    if(!user) {
        return res.status(401).json({
            status: 'Unauthorized',
            code: 401,
            message: 'Unauthorized',
        })
    }
    res.status(200).json({
        status: 'OK',
        code: 200,
        ResponseBody: {
            email: email,
            subscription: 'starter'
        }
    })
}

const updateAvatar = async (req, res, next) => {
    const avatarDir = path.join(process.cwd(), 'public/avatars');
    const { path: tempUpload } = req.file;
    const  { _id } = req.user
    const imageName = `${_id}_avatar.png`;
    const avatarPath = path.join(avatarDir, imageName)
    await optimizeImage(tempUpload);

    const avatarURL = `http://localhost:3000/avatars/${imageName}`;

    await fs.rename(tempUpload, avatarPath);
        
         return res.status(200).json({
                status: "success",
                code: 200,
                data: {
                result: avatarURL,
                }
            })
        }

        const verifyEmail = async (req, res) => {
            const { verificationToken } = req.params;
            try {
                const user = await User.findOne({ verificationToken })
                if (!user) {
                   return res.status(404).json({
                        status: "Not found",
                        code: 404,
                        ResponseBody: {
                        message: 'User not found',
                        }
                    })
                }
                await User.findByIdAndUpdate(user._id, {
                    verify: true,
                    verificationToken: "",
                });
                return res.status(200).json({
                    status: 'Ok',
                    code: 200,
                    ResponseBody: {
                        message: 'Verification successful',
                    }
                })
            } catch (error) {
                console.error(error)
            }
        }

        const sendAgain = async (req, res) => {
            const { email } = req.body;
            const verificationToken = uuidv4();
            if (!email) {
                return res.status(400).json({
                    status: 'fail',
                    code: 400,
                    RequestBody: {
                        message: 'missing required field email'
                    }
                })
            }
            const user = await User.findOne({ email })
            if(user.verify==true) {
                return res.status(400).json({
                    status: 'Bad request',
                    code: 400,
                    ResponseBody: {
                        message: 'Verification has already been passed',
                    }
                })
            }
            try {
                const result = await emailService.send(email, verificationToken)
                return res.status(200).json({
                    status: 'Ok',
                    code: 200,
                    data: result,
                    ResponseBody: {
                        message: 'Verification email sent'
                    }
                })
            } catch (error) {
                console.error(error)
            }
        }

       

module.exports = {
    signUp,
    logIn,
    logOut,
    currentUser,
    updateAvatar,
    verifyEmail,
    sendAgain,
}