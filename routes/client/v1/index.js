const express = require('express')
const router = express.Router()
const { cAuth } = require('../../../middlewares/jwt')
var timeout = require('connect-timeout')

router.use('/station', require('./station'))
router.use(timeout('15s'))
router.get('/', (req, res) => res.success({}))
router.use('/user', require('./user'))
router.use('/wechat', require('./wechat'))
router.use('*', cAuth)



module.exports = router