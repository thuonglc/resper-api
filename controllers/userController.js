const bcrypt = require('bcryptjs')
const { google } = require('googleapis')
const createError = require('http-errors')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mongoose = require('mongoose')
const Cart = require('../models/cartModel')
const Comment = require('../models/commentModel')
const Coupon = require('../models/couponModel')
const User = require('../models/userModel')
const cloudinaryConfig = require('../cloudinary')
const { signAccessToken, signRefreshToken } = require('../utils/jwt_helpers')
const sendMail = require('./sendMail')

const { OAuth2 } = google.auth
const { GOOGLE_LOGIN_SERVICE_CLIENT_ID, GOOGLE_LOGIN_SECRET, CLIENT_URL, ACTIVATION_TOKEN_SECRET } =
	process.env

const client = new google.auth.OAuth2(GOOGLE_LOGIN_SERVICE_CLIENT_ID)

const createAccessToken = (payload) => {
	return jwt.sign(payload, ACTIVATION_TOKEN_SECRET, { expiresIn: '15m' })
}
const createActivationToken = (payload) => {
	return jwt.sign(payload, ACTIVATION_TOKEN_SECRET, { expiresIn: '5m' })
}

module.exports = {
	registerUser: async (req, res) => {
		try {
			const { name, email, password } = req.body
			const doseExists = await User.findOne({ email: email })
			if (doseExists) return res.status(400).json({ message: 'User already exists' })
			if (!password) return res.status(400).json({ message: 'Please enter your password' })
			if (password.length < 6)
				return res.status(400).json({ message: 'Password is at least 6 characters long.' })

			// password encryption
			const passwordHash = await bcrypt.hash(password, 12)
			const newUser = { name, email, password: passwordHash }
			const accessToken = createActivationToken(newUser)
			const url = `${CLIENT_URL}/user/active-email/${accessToken}`
			sendMail(email, 'Verify your email address', url, name, 'Click to active your email')
			res.status(200).json({
				message: 'Activate your account',
			})
		} catch (error) {
			res.status(400).json({
				message: error,
			})
		}
	},

	loginByGoogle: async (req, res) => {
		try {
			const { tokenId } = req.body
			const verify = await client.verifyIdToken({
				idToken: tokenId,
				audience: GOOGLE_LOGIN_SERVICE_CLIENT_ID,
			})
			const { email_verified, email, name, picture } = verify.payload
			if (!email_verified) return res.status(400).json({ message: 'Email verification failed.' })
			const user = await User.findOne({ email: email })
			const password = email + GOOGLE_LOGIN_SECRET
			const passwordHash = await bcrypt.hash(password, 12)
			if (user) {
				const accessToken = await signAccessToken(user._id)
				res.status(200).json({
					user: user,
					accessToken: accessToken,
				})
			} else {
				const newUser = new User({
					_id: new mongoose.Types.ObjectId(),
					name,
					email,
					password: passwordHash,
					avatar: picture,
				})
				await newUser.save()
				const users = await User.findOne({ email: email })
				const accessToken = await signAccessToken(users._id)
				res.status(200).json({
					user: users,
					accessToken: accessToken,
				})
			}
		} catch (error) {
			console.log(error)
			res.status(400).json({
				message: error,
			})
		}
	},

	login: async (req, res) => {
		try {
			const { email, password } = req.body
			const user = await User.findOne({ email: email.toLowerCase().trim() })
			if (!user) return res.status(400).json({ message: 'User does not exist' })
			const isMatch = await bcrypt.compare(password, user.password)
			if (!isMatch) return res.status(400).json({ message: 'Invalid password' })
			const accessToken = await signAccessToken(user)
			const refreshToken = await signRefreshToken(user)
			const userResult = await User.findById(user._id)
			res.send({
				accessToken: accessToken,
				refreshToken: refreshToken,
				user: userResult,
			})
		} catch (error) {
			res.status(400).json({
				message: error,
			})
		}
	},

	getProfile: async (req, res) => {
		try {
			const user = await User.findById(req.data.id).select('-password')
			if (!user) return res.status(400).json({ message: 'User does not exist.' })
			res.status(200).json({
				user: user,
			})
		} catch (error) {
			console.log(error)
			res.status(400).json({
				message: error,
			})
		}
	},

	refreshToken: async (req, res) => {
		try {
			const refreshToken = req.body
			if (!refreshToken) throw createError.BadRequest()
			const id = await jwtCtrl.verilyRefreshToken(refreshToken)
			const accessToken = await signAccessToken(id)
			const refToken = await signRefreshToken(id)
			res.send({ accessToken: accessToken, refreshToken: refToken })
		} catch (error) {
			res.status(400).json({
				message: error,
			})
		}
	},

	updateUserImage: async (req, res) => {
		try {
			const { id } = req.data
			const options = { new: true }
			const file = req.file
			cloudinaryConfig.v2.uploader.upload(file.path, { folder: 'test' }, async (error, result) => {
				if (result) {
					const userSave = {
						avatar: result.url,
					}
					const update = {
						avatar: result.url,
					}
					const user = await User.findByIdAndUpdate(id, userSave, options)
					const comment = await Comment.updateMany({ id_user: id }, update, options)
					const dataReply = await Comment.find()
					for (let index = 0; index < dataReply.length; index++) {
						const reply = Array.from(dataReply[index].reply)
						if (reply.length > 0) {
							for (let j = 0; j < reply.length; j++) {
								const element = reply[j]
								if (element.id_user === id) {
									element.avatar = result.url
									const id_array = dataReply[index]._id
									await Comment.findByIdAndUpdate(id_array, { reply: reply }, options)
								}
							}
						}
					}
					res.json({
						user: user,
						comment: comment,
					})
				}
			})
		} catch (error) {
			res.send(error)
		}
	},

	updateUserInfo: async (req, res) => {
		try {
			const { id } = req.data
			const { name, sex } = req.body
			const options = { new: true }
			const data = {
				name: name,
				sex: sex,
			}
			const user = await User.findByIdAndUpdate(id, data, options)
			const comment = await Comment.updateMany({ id_user: id }, { name: name }, options)
			res.status(200).json({
				status: 'Update success',
				user: user,
				comment: comment,
			})
		} catch (error) {
			console.log('error', error)
		}
	},

	changePassword: async (req, res) => {
		try {
			const { id } = req.data
			const { password } = req.body
			if (password.length < 6)
				return res.status(400).json({ message: 'Password is at least 6 characters long.' })
			const result = await User.findById(id)
			if (result) {
				const passwordHash = await bcrypt.hash(password, 12)
				await User.findOneAndUpdate({ _id: id }, { password: passwordHash })
				res.status(200).json({
					message: 'Password has been changed successfully',
				})
			}
		} catch (err) {
			console.log(err)
		}
	},

	activeEmail: async (req, res) => {
		try {
			const { accessToken } = req.body
			const user = JWT.verify(accessToken, ACTIVATION_TOKEN_SECRET)
			const { email, password, name } = user
			const checkEmail = await User.findOne({ email: email })
			if (checkEmail) return res.status(400).json({ message: 'User already exists' })
			const userSave = new User({
				_id: new mongoose.Types.ObjectId(),
				name: name.trim(),
				email: email,
				password: password,
				role: 0,
			})
			const result = await userSave.save()
			const token = await signAccessToken(result._id)
			res.status(200).json({
				user: result,
				token,
			})
		} catch (error) {
			res.status(400).json({
				message: error,
			})
		}
	},

	forgotPassword: async (req, res) => {
		try {
			const { email } = req.body
			const user = await User.findOne({ email: email.toLowerCase().trim() })
			if (!user) return res.status(400).json({ message: 'Email does not exist' })
			const access_token = createAccessToken({ email: email })
			const url = `${CLIENT_URL}/user/reset-password/${access_token}`
			sendMail(email, 'Reset your password', url, user.name, 'Click to create a new password')
			res.json({ message: 'Create a new password, please check your email' })
		} catch (error) {
			console.log(error)
			res.status(400).json({
				message: error,
			})
		}
	},

	resetPassword: async (req, res) => {
		try {
			const { password, accessToken } = req.body
			const result = JWT.verify(accessToken, ACTIVATION_TOKEN_SECRET)
			const user = await User.findOne({ email: result.email })
			if (!password) return res.status(400).json({ message: 'Enter your new password' })
			if (!user) return res.status(400).json({ message: 'User does not exist' })
			const passwordHash = await bcrypt.hash(password, 12)
			await User.findOneAndUpdate({ email: result.email }, { password: passwordHash })
			const token = await signAccessToken(user._id)
			res.status(200).json({
				user: user,
				token,
			})
		} catch (error) {
			res.status(400).json({
				message: error,
			})
		}
	},

	saveAddress: async (req, res) => {
		const { id } = req.data
		const userArray = await User.find({ _id: id }).exec()
		const user = userArray[0]
		const userAddress = await User.findOneAndUpdate(
			{ email: user.email },
			{ address: req.body.address, paymentMethod: req.body.paymentMethod }
		).exec()

		res.json({ ok: true })
	},

	// coupon
	applyCoupon: async (req, res) => {
		const { coupon } = req.body
		const validCoupon = await Coupon.findOne({ name: coupon }).exec()
		console.log(validCoupon)
		if (validCoupon === null || validCoupon.expiry < moment()) {
			return res.json({
				err: 'Invalid coupon',
			})
		}
		console.log('VALID COUPON', validCoupon)

		const { id } = req.data
		const userArray = await User.find({ _id: id }).exec()
		const user = userArray[0]

		let { products, cartTotal } = await Cart.findOne({ orderBy: user._id })
			.populate('products.product', '_id name price')
			.exec()

		console.log('cartTotal', cartTotal, 'discount%', validCoupon.discount)

		// calculate the total after discount
		let totalAfterDiscount = (cartTotal - (cartTotal * validCoupon.discount) / 100).toFixed(2) // 99.99

		console.log('----------> ', totalAfterDiscount)

		Cart.findOneAndUpdate({ orderBy: user._id }, { totalAfterDiscount }, { new: true }).exec()

		res.json({ value: totalAfterDiscount })
	},

	// wishlist
	addToWishlist: async (req, res) => {
		const { productId } = req.body

		const user = await User.findOneAndUpdate(
			{ email: req.user.email },
			{ $addToSet: { wishlist: productId } }
		).exec()

		res.json({ ok: true })
	},

	wishlist: async (req, res) => {
		const list = await User.findOne({ email: req.user.email })
			.select('wishlist')
			.populate('wishlist')
			.exec()

		res.json(list)
	},

	removeFromWishlist: async (req, res) => {
		const { productId } = req.params
		const user = await User.findOneAndUpdate(
			{ email: req.user.email },
			{ $pull: { wishlist: productId } }
		).exec()

		res.json({ ok: true })
	},
}
