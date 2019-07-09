const express = require('express')
const logger = require('morgan')
const router = express.Router()
const { sAuth } = require('../../../middlewares/jwt')
const stationService = require('../../../service/stationService')

router.use(logger(':remote-addr [:date[clf]] ":method :url :status :response-time ms', {
  skip: (req, res) => { return res.statusCode == 200 }
}))

router.get('/station/upgrade', async (req, res) => {
  try {
    let result = await stationService.getStationUpgrade(req.db)
    res.success(result)
  } catch (error) {
    res.error
  }
})
router.use('*', sAuth)
router.use('/station', require('./station'))

module.exports = router