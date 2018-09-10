const express = require('express')
const router = express.Router()
const stationService = require('../../../service/stationService')

router.post('/bind', async (req, res) => {
  try {
    console.log(req.auth)
    let { encrypted, signature } = req.body
    let { sn, certId } = req.auth
    let result = await stationService.bindUser(req.db, sn, certId, signature, encrypted)
    res.success(result)

  } catch (error) { res.error(error) }
})

module.exports = router