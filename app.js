const express = require('express')
const promise = require('bluebird')
const cookieParser = require('cookie-parser')
const E = require('./lib/error')
const app = express()
const methodOverride = require('method-override');

// 为请求 request添加数据库句柄
app.use(async (req, res, next) => {
  try {
    req.db = pool
    next()
  } catch (error) {
    res.error(error)
  }
})

app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Authorization,Content-Type");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", ' 3.2.1')
      //这段仅仅为了方便返回json而已
  res.header("Content-Type", "application/json;charset=utf-8");
  if(req.method == 'OPTIONS') {
      //让options请求快速返回
      res.sendStatus(200); 
  } else { 
      next(); 
  }
});

// 为response添加 success, error 方法
app.use(require('./middlewares/res'))

app.use(methodOverride('_method'))

app.use(express.json({ limit: '5mb', extended: false }))

app.use(cookieParser())

app.use('/', require('./routes'))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.status(404).end()
})

// error handler
app.use(function(err, req, res, next) {

  console.error(err.message)
  if (err.message == 'Response timeout') res.error(new E.RequestTimeOut(), 504)
  else res.error(err)
})

module.exports = app