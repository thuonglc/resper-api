const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema
const cartScheme = mongoose.Schema({
	orderBy: { type: ObjectId, ref: 'User' },
	products: [
		{
			product: {
				type: ObjectId,
				ref: 'Product',
			},
			quantity: Number,
			price: Number,
		},
	],
	cartTotal: { type: Number, required: true },
	totalAfterDiscount: Number,
	timeCart: { type: String, required: true },
})

module.exports = mongoose.model('Cart', cartScheme)
