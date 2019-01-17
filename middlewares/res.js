/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   res.js                                             :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: Jianjin Wu <mosaic101@foxmail.com>         +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2017/05/15 14:57:04 by Jianjin Wu        #+#    #+#             */
/*   Updated: 2018/03/30 14:49:36 by Jianjin Wu       ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */


const debug = require('debug')('app:res')

const DEFAULT_SUCCESS_STATUS = 200
const DEFAULT_ERROR_STATUS = 403

//http code 
const httpCode = {
  200: 'ok',
  400: 'invalid parameters',
  401: 'Authentication failed',
  403: 'forbidden',
  404: 'not found',
  500: 'system error'
}

module.exports = (req, res, next) => {
  /**
  * success response
  * @param {any} data 
  * @param {number} status - default 200
  */

  req.on('close', () => { res.finished = true })

  res.success = (data, status) => {

    status = status || DEFAULT_SUCCESS_STATUS
    return res.status(status).json({
      url: req.originalUrl,
      code: 1,
      message: 'ok',
      data: data || null
    })
  }

  /**
	* error response
  * @param {any} error 
  * @param {number} status - default 403
  */
  res.error = (error, status) => {

    let code, message
    status = status || DEFAULT_ERROR_STATUS
    if (error) {
      if (error instanceof Error) {
        code = error.code || status
        message = error.message
      }
      // 400
      else if (error instanceof Array) {
        code = 400
        message = httpCode[status]
      }
      // string
      else if (typeof error === 'string') {
        code = status || 403
        message = error
      }
      // others
      else {
        code = error.code || status || 403
        message = error.message || httpCode[status] || 'forbidden'
      }
    }
    
    let response = {
      url: req.originalUrl,
      code: code,
      message: message
    }
    
    console.error(error.message)
    debug(`error: ${error}`)
    return res.status(status).json(response)
  }
  next()
}