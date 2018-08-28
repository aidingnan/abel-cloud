var express = require('express');
var router = express.Router();
var AV = require('leancloud-storage')

/* GET users listing. */
router.get('/', async function(req, res, next) {
  try {
    var query = new AV.Query('_User');
    let result = await query.find({useMasterKey: false})
    console.log(result)
    res.send('respond with a resource');
  } catch (e) {
    res.send('respond with a resource');
  }
});

module.exports = router;
