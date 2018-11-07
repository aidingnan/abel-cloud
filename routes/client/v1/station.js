/*
 * @Author: harry.liu 
 * @Date: 2018-09-10 11:02:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-07 16:21:52
 */

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const stationService = require('../../../service/stationService')
const transformJson = require('../../../service/transformJson')
const storeFile = require('../../../service/storeFile')
const fetchFile = require('../../../service/fetchFile')
const Station = require('../../../models/station')
const nodemailer = require('nodemailer')

// 绑定设备
router.post('/', async (req, res) => {
  try {
    // 获取 user id
    let { id } = req.auth
    let user = { id }
    // 获取 cloud key
    let cloudKey = await getParameterAsync({ Name: 'cloudKeys' })
    let value = JSON.parse(cloudKey.Parameter.Value)
    let { keys, latest } = value
    let key = keys[latest]
    // 加密user
    let cipher = crypto.createCipher('aes128', key)
    let encrypted = cipher.update(JSON.stringify(user), 'utf8', 'hex')
    encrypted += cipher.final('hex')

    let result = { encrypted: `${latest}@${encrypted}`}
    res.success(result)
  } catch (error) {  console.log(error);res.error(error) }
})

// 分享设备
router.post('/:sn/user', joiValidator({
  params: { sn: Joi.string().required() },
  body: {  phone: Joi.string().required() }
}), async (req, res) => {
  try {
    // 获取owner
    let { id } = req.auth
    // 获取设备ID & 对象ID
    let { sn } = req.params
    let { phone } = req.body
    console.log(id, sn, phone)
    let result = await stationService.addUser(req.db, id, sn, phone)

    res.success(result)
  } catch (error) { res.error(error)}
})

// 查询所有设备
router.get('/', async (req, res) => {
  try {
    let { id, clientId, type } = req.auth
    let result = await stationService.getStations(req.db, id, clientId, type)

    res.success(result)
  } catch (e) { res.error(e)}
})

// json操作

router.post('/:sn/json', checkUserAndStation, (req, res) => {
  transformJson.createServer(req, res)
})

// 上传文件
router.post('/:sn/pipe', checkUserAndStation, joiValidator({
  query: { data: Joi.string().required() }
}), (req, res) => {
  storeFile.createServer(req, res)
})

// 下载文件
router.get('/:sn/pipe', checkUserAndStation, joiValidator({
  query: { data: Joi.string().required() }
}), (req, res) => {
  fetchFile.createServer(req, res)
})

async function checkUserAndStation(req, res, next) {
  try {
    let userId = req.auth.id
    let sn = req.params.sn
    let connect = req.db
    let ownStations = await Station.getStationBelongToUser(connect, userId)
    let sharedStations = await Station.getStationSharedToUser(connect, userId)
    let sameOwnStation = ownStations.find(item => item.sn == sn)
    let sameSharedStations = sharedStations.find(item => item.sn == sn)
    if (!sameOwnStation && !sameSharedStations) throw new Error('sn error')

    let station = sameOwnStation || sharedStations
    if (!station.online) throw new Error('Station is not online')

    try {
      req.db.release()
    } catch (e) {}
    
    next()
  } catch (e) { 
    res.error(e)
  }
}



module.exports = router