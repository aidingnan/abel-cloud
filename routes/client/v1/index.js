const express = require('express')
const router = express.Router()
const { cAuth } = require('../../../middlewares/jwt')
var timeout = require('connect-timeout')

router.use(timeout('15s'))
router.get('/', (req, res) => res.success({}))
router.use('/user', require('./user'))
router.use('/wechat', require('./wechat'))
router.use('*', cAuth)
router.use('/station', require('./station'))


module.exports = router