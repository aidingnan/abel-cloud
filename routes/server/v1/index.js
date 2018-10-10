const express = require('express')
const router = express.Router()
const { sAuth } = require('../../../middlewares/jwt')

router.use('/station', require('./station'))
router.use('*', sAuth)


module.exports = router