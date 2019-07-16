/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   jwt.js                                             :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: Jianjin Wu <mosaic101@foxmail.com>         +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2017/07/12 15:27:49 by Jianjin Wu        #+#    #+#             */
/*   Updated: 2018/03/30 14:49:35 by Jianjin Wu       ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

const jwt = require('jwt-simple')

/**
 * JWT (JSON Web Token)
 * @class
 */
class Jwt {
	/**
	 * 加密
	 * @param {object} payload 
	 * @returns {object} token
	 * @memberof Jwt
	 */
  async encode(payload) {
    try {
      let { keys, latest } = cache.getValue()
      let key = keys[latest]
      return `${latest}@${jwt.encode(payload, key)}`
    } catch (error) { throw error }
  }
	/**
	 * 解密
	 * @param {object} token 
	 * @returns {object} decoded data
	 * @memberof Jwt
	 */
  async decode(aut, S) {
    try {
      let arr = aut.split('@')
      let latest = arr[0]
      let token = arr[1]
      let { keys } = cache.getValue()
      let SECRET = keys[latest]

      return jwt.decode(token, S || SECRET)
    } catch (error) { 
      console.log('error in decode -->', error.message)
      throw error
     }
  }
}


module.exports = new Jwt()
