const crypto = require('crypto')
const Station = require('../models/station')
const User = require('../models/user')
const E = require('../lib/error')
const jwt = require('../lib/jwt')

class StationService {
  async bindUser(connect, sn, certId, signature, encrypted) {
    try {
      let device = (await Station.findDeviceBySn(connect, sn))[0]

      console.log(device)

      if (device.owner !== null) throw new E.StationHasOwner()


      // 通过证书ID获取设备公钥
      let certResult = await describeCertificateAsync({ certificateId: certId })
      let { certificatePem, status } = certResult.certificateDescription

      // 通过公钥验证签名
      let verify = crypto.createVerify('SHA256').update(encrypted)
      let verifyResult = verify.verify(certificatePem, signature, 'hex')

      if (status !== 'ACTIVE') throw new E.StationCertInactive()
      if (!verifyResult) throw new E.StationVerifyFailed()

      // 解密encrypted
      let arr = encrypted.split('@')
      let latest = arr[0]
      let encrypted2 = arr[1]
      let cloudKey = await getParameterAsync({ Name: 'cloudKeys' })
      let { keys } = JSON.parse(cloudKey.Parameter.Value)
      let key = keys[latest]

      let decipher = crypto.createDecipher('aes128', key)
      let decrypted = decipher.update(encrypted2, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      let { id } = JSON.parse(decrypted)

      // 绑定用户
      // let device = await Station.findDeviceBySn(connect, sn)
      let user = (await User.getUserInfo(connect, id))[0]
      let result = await Station.bindUser(connect, sn, id)
      
      return Object.assign(user, {password: undefined})
    } catch (error) { throw error }
  }

  // 分享设备
  async addUser(connect, owner, sn, phone) {
    try {
      // 检查owner 与 device 关系
      let deviceResult = await Station.findDeviceBySn(connect, sn)
      if (deviceResult.length !== 1) throw new E.StationNotExist()
      if (deviceResult[0].owner !== owner) throw new E.StationNotBelongToUser()
      // 检查username
      let userResult = await User.getUserByPhone(connect, phone)
      if (userResult.length !== 1) throw new E.UserNotExist()
      let { user } = userResult[0]
      // 禁止分享给自己
      if (owner == user) throw new Error('station can not share to owner')
      // 检查sn 与 username 关系
      let relationResult = await Station.findDeviceShareBySnAndId(connect, sn, user)
      if (relationResult.length > 0) throw new E.ShareExist()
      // 建立绑定关系
      return await Station.createShare(connect, sn, user)
    } catch (error) { throw error }
  }

  // 查询用户所有设备
  async getStations(connect, userId, clientId, type) {
    try {
      let ownStations = await Station.getStationBelongToUser(connect, userId)
      let sharedStations = await Station.getStationSharedToUser(connect, userId)
      let lastUseDevice = await User.getUseRecordInfo(connect, userId, clientId, type)
      let lastUseDeviceSn = null
      if (lastUseDevice.length == 1 && lastUseDevice[0].sn) {
        lastUseDeviceSn = lastUseDevice[0].sn
      } 
      return { ownStations, sharedStations, lastUseDeviceSn }
    } catch (error) { throw error}
  }

  // 查询设备所有用户
  async getStationUsers(connect, sn) {
    try {
      let owner = await Station.getStationOwner(connect, sn)
      let sharer = await Station.getStationSharer(connect, sn)
      return { owner, sharer }
    } catch (error) { throw error}
  }
}

module.exports = new StationService()