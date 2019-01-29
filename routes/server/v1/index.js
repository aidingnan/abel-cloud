const express = require('express')
const logger = require('morgan')
const router = express.Router()
const { sAuth } = require('../../../middlewares/jwt')

router.use(logger(':remote-addr [:date[clf]] ":method :url :status :response-time ms', {
    skip: (req, res) => { return res.statusCode == 200 }
}))
// router.use('*', sAuth)
router.use('/station', require('./station'))

module.exports = router