var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  let beginTime = (new Date()).getTime()
  connection.query('SELECT * FROM user', function (error, results, fields) {
    let endTime = (new Date()).getTime()
    if (error) throw error;
    res.status(200).json(endTime-beginTime)
  })
});

router.use('/client', require('./client'))
router.use('/server', require('./server'))

module.exports = router;
