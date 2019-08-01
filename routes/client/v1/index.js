const express = require('express')
const logger = require('morgan')
const router = express.Router()
const { cAuth } = require('../../../middlewares/jwt')
const stationService = require('../../../service/stationService')

router.get('/', (req, res) => res.success({}))
router.get('/station/upgrade', async (req, res) => {
    try {
      let result = await stationService.getStationUpgrade(req.db)
      res.success(result)
    } catch (error) {
      res.error
    }
  })
router.use(logger(':remote-addr [:date[clf]] ":method :url :status :response-time ms', {
    skip: (req, res) => { return res.statusCode == 200 }
}))
router.use('/user', require('./user'))
router.use('/wechat', require('./wechat'))
router.use('/station', cAuth, require('./station'))

module.exports = router