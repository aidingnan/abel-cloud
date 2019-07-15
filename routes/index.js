var express = require('express');
var router = express.Router();

// 添加默认api 供AWS负载均衡器检查
router.get('/', function(req, res) {
  res.status(200).success()
})

router.use('/c', require('./client'))
router.use('/s', require('./server'))

module.exports = router
