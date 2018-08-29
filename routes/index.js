var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var connection = mysql.createConnection({
  host     : 'wisnuc.cyb10i3l88dy.rds.cn-north-1.amazonaws.com.cn',
  user     : 'wisnuc',
  password : '12345678',
  database : 'wisnuc'
});

connection.connect(err => {
  if (err) console.log(err)
})

/* GET home page. */
router.get('/', function(req, res, next) {
  let beginTime = (new Date()).getTime()
  connection.query('SELECT * FROM user', function (error, results, fields) {
    let endTime = (new Date()).getTime()
    if (error) throw error;
    res.status(200).json(endTime-beginTime)
  })
});

module.exports = router;
