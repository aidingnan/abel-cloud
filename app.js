const express = require('express')
const promise = require('bluebird')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const E = require('./lib/error')
const app = express()

// 添加默认api 供AWS负载均衡器检查
app.get('/', (req, res) => res.end())

// 为请求 request添加数据库句柄
app.use(async (req, res, next) => {
  try {
    let connect = promise.promisifyAll(await pool.getConnectionAsync())
    req.db = connect
    next()
  } catch (error) {
    console.error(error)
    res.error(error)
  }
})

app.use(logger(':remote-addr [:date[clf]] ":method :url :status :response-time ms'))
app.use(express.json({ limit: '5mb', extended: false }))
app.use(cookieParser())

// 为response添加 success, error 方法
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
  console.error(err.message)
  if (err.message == 'Response timeout') res.error(new E.RequestTimeOut(), 504)
  else res.error(err)
})


module.exports = app
