/*
 * @Author: harry.liu 
 * @Date: 2018-09-10 11:02:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-28 17:09:38
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

// 解绑设备
router.delete('/:sn', joiValidator({
  params: { sn: Joi.string().required() }
}), async(req, res) => {
  try {
    let { id } = req.auth
    let { sn } = req.params
    let result = await stationService.unbindStation(req.db, id, sn)
    return result
  } catch (error) {res.error(error)}
})

// 查询某台station下用户
router.get('/:sn/user', async (req, res) => {
  try {
    let { id } = req.auth
    let { sn } = req.params
    let result = await stationService.getStationUsers(req.db, sn)
    res.success(result)
  } catch (e) { res.error(e)}
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
    let result = await stationService.addUser(req.db, id, sn, phone)

    res.success(result)
  } catch (error) { res.error(error)}
})

// 取消分享设备
router.delete('/:sn/user', joiValidator({
  params: { sn: Joi.string().required() },
  body: { sharedUserId: Joi.string().required() }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { sharedUserId } = req.body
    let { sn } = req.params
    let result = await stationService.deleteUser(sn, userId, sharedUserId)
    res.success(result)
  } catch (error) { res.error(error) }
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
router.post('/:sn/pipe', joiValidator({
  query: { data: Joi.string().required() }
}), checkUserAndStation, (req, res) => {
  storeFile.createServer(req, res)
})

// 下载文件
router.get('/:sn/pipe', joiValidator({
  query: { data: Joi.string().required() }
}), checkUserAndStation, (req, res) => {
  fetchFile.createServer(req, res)
})

async function checkUserAndStation(req, res, next) {
  try {
    let userId = req.auth.id
    let sn = req.params.sn
    let connect = req.db
    // 查询station
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