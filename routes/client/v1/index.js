const express = require('express')
const logger = require('morgan')
const router = express.Router()
const { cAuth } = require('../../../middlewares/jwt')

router.get('/', (req, res) => res.success({}))
router.use(logger(':remote-addr [:date[clf]] ":method :url :status :response-time ms'))
router.use('/user', require('./user'))
router.use('/wechat', require('./wechat'))
router.use('/station', cAuth, require('./station'))

module.exports = router