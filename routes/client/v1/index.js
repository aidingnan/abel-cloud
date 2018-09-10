const express = require('express')
const router = express.Router()
const { cAuth } = require('../../../middlewares/jwt')

router.use('/user', require('./user'))
router.use('*', cAuth)
router.use('/station', require('./station'))


module.exports = router