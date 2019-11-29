/*
 * @Author: harry.liu 
 * @Date: 2018-09-10 11:02:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2019-03-26 14:52:21
 */

const express = require('express')
const router = express.Router()
const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const stationService = require('../../../service/stationService')
const transformJson = require('../../../service/transformJson')
const storeFile = require('../../../service/storeFile')
const fetchFile = require('../../../service/fetchFile')
const Station = require('../../../models/station')
var timeout = require('connect-timeout')

// json操作
router.post('/:sn/json', checkSn(true), (req, res) => {
  transformJson.createServer(req, res)
})

// 上传文件
router.post('/:sn/pipe', joiValidator({
  query: { data: Joi.string().required() }
}), checkSn(true), (req, res) => {
  storeFile.createServer(req, res)
})

// 下载文件
router.get('/:sn/pipe', joiValidator({
  query: { data: Joi.string().required() }
}), checkSn(true), (req, res) => {
  fetchFile.createServer(req, res)
})

// 恢复出厂设置
router.post('/:sn/reset', joiValidator({
  body: {
    tickets: Joi.array().required()
  }
}), checkSn(true, true), async (req, res) => {
  try {
    let { sn } = rams
    let { tickets } = req.body
    await stationService.resetStation(req.db, sn, tickets, req, res)
  } catch (error) { res.error(error) }
})

router.use(timeout('15s'))

// 删除设备
router.delete('/:sn', checkSn(true, false), async (req, res) => {
  try {
    let { id } = req.auth
    let { sn } = req.params
    let { ticket, color, manager } = req.body
    let result = await stationService.deleteStation(req, sn, id, ticket, color, manager)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 查询某台station下用户
router.get('/:sn/user', checkSn(false, true), async (req, res) => {
  try {
    let { sn } = req.params
    let result = await stationService.getStationUsers(req.db, sn)
    result.owner = result.owner.filter(item => !item.delete)
    result.sharer = result.sharer.filter(item => !item.delete)
    res.success(result)
  } catch (e) { res.error(e) }
})

// 查询用户设备
router.get('/', async (req, res) => {
  try {
    let { id, clientId, type } = req.auth
    let result = await stationService.getStations(req.db, id, clientId, type)
    res.success(result)
  } catch (e) { res.error(e) }
})

// 分享设备
router.post('/:sn/user', joiValidator({
  params: { sn: Joi.string().required() },
  body: {
    phone: Joi.string().required(),
    setting: Joi.object({
      cloud: Joi.number().valid(1).required(),
      publicSpace: Joi.number().valid(0, 1).required()
    }).required()
  }
}), checkSn(false, true), async (req, res) => {
  try {
    let { id } = req.auth
    let { sn } = req.params
    let { phone, setting } = req.body
    let result = await stationService.addUser(req.db, id, sn, phone, setting, true)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 取消分享设备
router.delete('/:sn/user/:userId', joiValidator({
  params: {
    sn: Joi.string().required(),
    userId: Joi.string().required()
  },
  body: {
    ticket: Joi.string().required()
  }
}), checkSn(false, true), async (req, res) => {
  try {
    let { id } = req.auth
    let { sn, userId } = req.params
    let { ticket } = req.body
    let result = await stationService.deleteUser(req.db, id, sn, userId, ticket)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 禁用设备
router.patch('/:sn/user/:userId', joiValidator({
  params: {
    sn: Joi.string().required(),
    userId: Joi.string().required()
  },
  body: { disable: Joi.number().required() }
}), checkSn(false, true), async (req, res) => {
  try {
    let { sn, userId } = req.params
    let { id } = req.auth
    let { disable } = req.body
    let result = await stationService.disableUser(req.db, id, sn, userId, disable)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 设备下用户设置
router.patch('/:sn/user', joiValidator({
  params: { sn: Joi.string()},
  body: { 
    sharedUserId: Joi.string().required(),
    setting: Joi.object({ publicSpace: Joi.number().valid(0, 1) }).required() }
}), checkSn(false, true), async (req, res) => {
  try {
    let { sn } = req.params
    let { setting, sharedUserId } = req.body
    if (Object.getOwnPropertyNames(setting).length == 0) throw new Error('invalid params')
    let result = await stationService.updateStationUser(req.db, sn, sharedUserId, setting)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 发送消息给设备
router.post('/:sn/publish', joiValidator({
  params: { sn: Joi.string()},
  body: { 
    message:['checkout', 'download'],
    content: Joi.object().required(),
    tag: Joi.string()
  }
}), checkSn(true, false), async(req, res) => {
  try {
    let { message, content, tag } = req.body
    let { sn } = req.params
    let topic = `cloud/${sn}/${message}`
    let qos = 1
    let payload
    // generate payload
    if (message == 'checkout') {
      // checkout
      payload = JSON.stringify(content)
    } else if (message == 'download') {
      // download
      if (!tag) res.error('tag is necessary')
      let result = await Station.getUpgradeInfoWithTag(req.db, tag)
      if (result.length !== 1) throw new Error('tag not match')
      payload = JSON.stringify(result[0])
    }

    let obj = { topic, qos, payload }
    await publishAsync(obj)
    res.success()
  } catch(err) { res.error(err)}
})

function checkSn(checkOnline, checkOwner) {
  return async function(req, res, next) {
    // return next()
    try {
      let userId = req.auth.id
      let sn = req.params.sn
      let connect = req.db
      // 查询station
      let ownStations = await Station.getStationBelongToUser(connect, userId)
      // let sharedStations = await Station.getStationSharedToUser(connect, userId)
      let sameOwnStation = ownStations.find(item => item.sn == sn)
      // let sameSharedStations = sharedStations.find(item => item.sn == sn  && !item.disable)
      
      if (!sameOwnStation) throw new Error('sn not belong to user')
      // 判断owner
      // if (checkOwner && !sameOwnStation) throw new Error('user is not the owner of station')
      // 判断在线
      // let station = sameOwnStation || sameSharedStations
      let station = sameOwnStation
      if (!station.online && checkOnline) throw new Error('Station is not online')

      next()  
    } catch (error) { res.error(error) }
  }
}

module.exports = router