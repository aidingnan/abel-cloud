var express = require('express')
const promise = require('bluebird')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

var E = require('./lib/error')

var app = express()

app.get('/', (req, res) => {
  res.status(200).json({})
})

app.use(async (req, res, next) => {
  let connect = promise.promisifyAll(await pool.getConnectionAsync())
  req.db = connect

  req.on('end', () => {
    try {
      // console.log('end trigger in app: relase')
      req.db.release()
    } catch (e) { }
  })

  // 当底层连接在 response.end() 被调用或能够刷新之前被终止时触发。
  res.on('close', () => {
    try {
      // console.log('close trigger in app: relase')
      req.db.release()
    } catch (e) {}
  })
  
  next()
})

app.use(logger(':remote-addr [:date[clf]] ":method :url :status :response-time ms'))
app.use(express.urlencoded({ limit: '500mb', extended: false }))
app.use(express.json({ limit: '500mb', extended: false }))
app.use(cookieParser())

// res middleware
app.use(require('./middlewares/res'))

app.use('/', require('./routes'))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.status(404).end()
})

// error handler
app.use(function(err, req, res, next) {
  try {
    req.db.release()
  } catch (e) {}
  console.log(err.message)
  if (err.message == 'Response timeout') res.error(new E.RequestTimeOut(), 504)
  else res.error(err)
})


module.exports = app
