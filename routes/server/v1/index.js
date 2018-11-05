const express = require('express')
const router = express.Router()
const { sAuth } = require('../../../middlewares/jwt')

router.use('*', sAuth)
router.use('/station', require('./station'))



module.exports = router