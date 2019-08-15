const express = require('express')
const logger = require('morgan')
const router = express.Router()
const { cAuth } = require('../../../middlewares/jwt')

router.get('/', (req, res) => res.success({}))
router.use('/user', require('./user'))

module.exports = router