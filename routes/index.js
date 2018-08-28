var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var connection = mysql.createConnection({
  host     : 'wisnuc.cyb10i3l88dy.rds.cn-north-1.amazonaws.com.cn',
  user     : 'wisnuc',
  password : '12345678',
  database : 'wisnuc'
});

connection.connect();

/* GET home page. */
router.get('/', function(req, res, next) {
  connection.query('SELECT * FROM user', function (error, results, fields) {
    if (error) throw error;
    res.status(200).json(results)
  })
});

module.exports = router;
