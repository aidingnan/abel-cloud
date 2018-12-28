var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.status(200).success()
});

router.use('/c', require('./client'))
router.use('/s', require('./server'))

module.exports = router
