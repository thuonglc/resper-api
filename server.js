require('dotenv').config()
const express = require('express')
const app = express()
var colors = require('colors/safe')
const bodyParser = require('body-parser')
const connectDB = require('./config/db')
const { notFound, errorHandler } = require('./middleware/errorMiddleware')
const server = require('http').createServer(app)

const morgan = require('morgan')
if (process.env.NODE_ENV === 'development') {
	app.use(morgan('dev'))
}

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())
app.use(express.json())

// Routes
app.use('/api', require('./routes/cartRoutes'))
app.use('/api', require('./routes/commentRoutes'))
app.use('/api', require('./routes/userRoutes'))
app.use('/api', require('./routes/orderRoutes'))
app.use('/api', require('./routes/categoryRoutes'))
app.use('/api', require('./routes/subRoutes'))
app.use('/api', require('./routes/couponRoutes'))
app.use('/api', require('./routes/cartRoutes'))
app.use('/api', require('./routes/walletRoutes'))
app.use(notFound)
app.use(errorHandler)
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*')
	res.header(
		'Access-Control-Header',
		'Origin, X-Requested-With, Content-Type, Accept, Authorization'
	)
	res.header('Access-Control-Allow-Methods', 'PUT, POST, PUT, DELETE, GET')
	next()
})

// database connection
connectDB()

const PORT = process.env.PORT || 5000

server.listen(
	PORT,
	console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
)
