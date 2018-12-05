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
  req.on('abort', () => {
    // console.log('req abort trigger')
  })

  // 当响应已被发送时触发
  res.on('finish', () => {
    // console.log('res finish trigger')
  })

  req.on('end', () => {
    // console.log('req end trigger')
    try {
      req.db.release()
    } catch (e) {}
  })


  req.on('close', () => {
    // console.log('req close trigger')
  })

  // 当底层连接在 response.end() 被调用或能够刷新之前被终止时触发。
  res.on('close', () => {
    // console.log('res close trigger')
    try {
      req.db.release()
    } catch (e) {}
  })
  
  next()
})

// app.use(timeout('15s', { respond: true }))
app.use(logger('dev'))
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

// app.set('view >>enigne<<', 'jade')

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
