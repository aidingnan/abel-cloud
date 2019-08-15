const express = require('express')
const logger = require('morgan')
const router = express.Router()
const { sAuth } = require('../../../middlewares/jwt')
const stationService = require('../../../service/stationService')

router.use(logger(':remote-addr [:date[clf]] ":method :url :status :response-time ms', {
  skip: (req, res) => { return res.statusCode == 200 }
}))

// 升级查询
router.get('/station/upgrade', async (req, res) => {
  try {
    let result = await stationService.getStationUpgrade(req.db)
    res.success(result)
  } catch (error) {
    res.error(error)
  }
})

router.get('/station/:sn/cert', async (req, res) => {
  try {
    let { sn } = req.params
    if (!sn) throw new Error('sn is required')
    let result = await stationService.getCert(sn, req.hostname)
    res.success(result)
  } catch (error) {
    res.error(error)
  }
})
router.use('*', sAuth)
router.use('/station', require('./station'))

module.exports = router