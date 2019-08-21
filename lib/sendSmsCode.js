const SMSClient = require('@alicloud/sms-sdk')

const templateCodeMap = {
  register: 'SMS_172710048',
  password: 'SMS_172710047',
  replace: 'SMS_172710046',
  login: 'SMS_172710050',
  mail: 'SMS_172710051',
  deviceChange: 'SMS_172736729'
}

const sendSmsCode = async (phone, code, type) => {
  try {
    let data = await getParameterAsync({ Name: 'ali-dingnan' })
    let smsCode = JSON.parse(data.Parameter.Value)

    let smsClient = new SMSClient({
      accessKeyId: smsCode.accessKeyId,
      secretAccessKey: smsCode.secretAccessKey
    })

    return await smsClient.sendSMS({
      PhoneNumbers: phone,
      SignName: '口袋网盘',
      TemplateCode: templateCodeMap[type],
      TemplateParam: `{"code":"${code}"}`
    })
  } catch (error) { throw error }


}

module.exports = sendSmsCode