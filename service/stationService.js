const crypto = require('crypto')
const Station = require('../models/station')
const E = require('../lib/error')
const jwt = require('../lib/jwt')

class StationService {
  async bindUser(connect, sn, certId, signature, encrypted) {
    try {
      // 通过证书ID获取设备公钥
      let certResult = await describeCertificateAsync({ certificateId: certId })
      let { certificatePem, status } = certResult.certificateDescription

      // 通过公钥验证签名
      let verify = crypto.createVerify('SHA256').update(encrypted)
      let verifyResult = verify.verify(certificatePem, signature, 'hex')
      if (status !== 'ACTIVE') throw new E.StationCertInactive()

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
      await Station.bindUser(connect, sn, id)
      return verifyResult
    } catch (error) { throw(error) }
  }
}

module.exports = new StationService()