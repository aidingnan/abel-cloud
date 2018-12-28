const express = require('express')
const router = express.Router()
const { cAuth } = require('../../../middlewares/jwt')

router.get('/', (req, res) => res.success({}))
router.use('/user', require('./user'))
router.use('/wechat', require('./wechat'))
router.use('/station', cAuth, require('./station'))

module.exports = router