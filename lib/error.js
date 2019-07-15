/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   error.js                                           :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: Jianjin Wu <mosaic101@foxmail.com>         +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2017/09/05 17:17:42 by Jianjin Wu        #+#    #+#             */
/*   Updated: 2018/03/30 14:49:35 by Jianjin Wu       ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */


/**
 * FIXME: 优化构造函数
 * 资源级别的 error，带入唯一标识符 id， 
 * 方便直接在 error 日志明确具体的资源位置定位 error 并且能快速修复
 * such as： new UserNotExist(userId)
 * log: userId: xxxxxxx not exist
 */
const E = {}

// generate function
const EClass = (code, message, httpCode) => {
  return class extends Error {
    constructor(m = message) {
      super(m)
      this.code = code
      this.status = httpCode
    }
  }
}

const define = (name, code, message, httpCode) => E[name] = EClass(code, message, httpCode)

/**
 * Error Code
 * such as: 60001，固定长度为5位整数！ 
 * 6 											 00 		     01
 * 服务级错误（1为系统级错误）	服务模块代码	具体错误代码
 */

// system
define('RequestTimeOut', 10000, 'request time out')
// user: 600XX
define('UserNotExist', 60000, 'user not exist')
define('UserAlreadyExist', 60001, 'user already exist')
define('InvalidPhoneNumber', 60002, 'invalid phone number')
define('SmsCodeError', 60003, 'sms code error')
define('WechatAlreadyAssociated', 60004, 'wechat has been associated')
define('MailAlreadyBound', 60005, 'mail has been bound')
define('MailCodeInvalid', 60006, 'mail code is invalid')
define('UserHasBoundMail', 60007, 'user has bound mail already')
define('UsernameOrPasswordError', 60008, 'username or password error', 401)
define('MailOrPasswordError', 60009, 'mail or password error')
define('MailShouldBeBound', 60010, 'mail should be bound first')
define('PasswordError', 60011, 'password error')
define('RefreshTokenError', 60012, 'refresh token failed', 401)
// station: 601XX
define('StationNotExist', 60100, 'station not exist')
define('StationAlreadyExist', 60101, 'station already exist')
define('StationNotOnline', 60102, 'station not online')
define('StationHasOwner', 60103, 'station has owner already')
define('StationCertInactive', 60104, 'station cert is inactive')
define('StationVerifyFailed', 60105, 'station signature verify failed')
define('StationNotBelongToUser', 60106, 'station is not belong to user')
define('ShareExist', 60107, 'exist same share relation')
define('UserNotExistInStation', 60108, 'user is not in the station')
// pipe: 603XX
define('PipeResponseTimeout', 60300, 'pipe: response time over')
define('PipeResponseHaveFinished', 60301, 'pipe: client response already finished')
define('PipeTooMuchTask', 60302, 'pipe: too much processing tasks')
// fetch file: 6031X
define('FetchFileQueueNoServer', 60310, 'fetchFile queue have`t server')
// store file: 6032X
define('StoreFileQueueNoServer', 60320, 'storeFile queue have`t server')
define('NoManiFestField', 60321, 'no manifest field')
define('FormError', 60322, 'form error')
// transform json: 6033XX
define('TransformJsonQueueNoServer', 60330, 'transformJson queue can not find server')
// phone: 607xx
define('MobileError', 60701, 'mobile error')
define('MobileLimit', 60702, '对同一个手机号码发送短信验证码，支持1条/分钟，5条/小时 ，累计10条/天。')
define('PhoneTicketInvalid', 60703, 'phone ticket invalid')
define('PhoneNotBelongToUser', 60704, 'phone is not belong to user')
// mail: 608xx
define('MailNotBelongToUser', 60800, 'mail is not belong to user')
define('MailTicketInvalid', 60803, 'mail ticket invald')



module.exports = Object.freeze(E)
