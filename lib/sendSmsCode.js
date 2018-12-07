const SMSClient = require('@alicloud/sms-sdk')

const templateCodeMap = {
  register: 'SMS_151010078',
  password: 'SMS_151010077',
  replace: 'SMS_151010076',
  login: 'SMS_151010080',
  mail: 'SMS_151010081'
}

const sendSmsCode = async (phone, code, type) => {
  try {
    let data = await getParameterAsync({ Name: 'sms-code' })
    let smsCode = JSON.parse(data.Parameter.Value)

    let smsClient = new SMSClient({
      accessKeyId: smsCode.accessKeyId,
      secretAccessKey: smsCode.secretAccessKey
    })

    return await smsClient.sendSMS({
      PhoneNumbers: phone,
      SignName: '闻上科技',
      TemplateCode: templateCodeMap[type],
      TemplateParam: `{"code":"${code}"}`
    })
  } catch (error) { throw error }


}

module.exports = sendSmsCode