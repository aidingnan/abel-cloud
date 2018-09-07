var express = require('express')
var path = require('path')
const promise = require('bluebird')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

var app = express()

app.use(async (req, res, next) => {
  let connect = promise.promisifyAll(await pool.getConnectionAsync())
  req.db = connect
  next()
})

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// res middleware
app.use(require('./middlewares/res'))

app.use('/', require('./routes'))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  req.db.release()
  res.status(404).end()
})

// app.set('view >>enigne<<', 'jade')

// error handler
app.use(function(err, req, res, next) {
  req.db.release()
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500)
  res.json({
    message: err.message,
    error: err
  });
})


module.exports = app
