import Promise from 'bluebird'
import get from 'lodash.get'
import merge from 'lodash.merge'
import { validate as jsonschema } from 'jsonschema'
import AbstractValidator from './abstract-validator'
import { AbstractError, ContentTypeError, HttpError, NotFoundError, ValidationError } from './errors'

/**
 * @todo
 */
export default class RequestValidator extends AbstractValidator {

  /**
   * @todo
   * @returns {undefined}
   * @throws {ContentTypeError}
   */
  checkContentType(req) {
    const contentType = req.get('content-type')
    const expectedType = get(this.findRouteSchema(req), 'encType', 'application/json')
    const expectedRe = new RegExp(expectedType)
    const isValidContentType = expectedRe.test(contentType)
    const skipFormParams = this._opts.allowFormParams && (contentType === 'application/x-www-form-urlencoded')

    // skip if body is empty and either a) no content type is defined, or
    // b) invalid content type is defined
    if ((!contentType || !isValidContentType) && this.isEmptyRequest(req)) {
      return
    }

    if (!isValidContentType && !skipFormParams) {
      throw new ContentTypeError(`expected the request header "Content-Type" to be \`${expectedType}\`, got \`${contentType}\` instead`)
    }
  }

  /**
   * @todo
   * @returns {undefined}
   * @throws {ValidationError}
   */
  checkRouteSchema(req) {
    const schema = this.findRouteSchema(req)

    if (!schema) {
      if (this._opts.strict) {
        throw new NotFoundError(`\`${req.method} ${req.path}\` was not found`)
      }

      return
    }

    if (!schema.schema) {
      return
    }

    const data = merge({}, req.body, (this._opts.allowQueryParams ? req.query : {}))
    const result = jsonschema(data, schema.schema)

    if (result.errors.length) {
      throw new ValidationError(result.errors)
    }
  }

  /**
   * @todo
   * @returns {Boolean}
   */
  isEmptyRequest(req) {
    if (~['DELETE', 'GET'].indexOf(req.method) || !Object.keys(req.body).length) {
      return true
    }

    return false
  }

  /**
   * @todo
   */
  middleware(req, res, next) {
    return this.initialize().then(() => {
      return this.validate(req)
    }).then(() => next()).catch(AbstractError, (err) => {
      if (this._opts.throw) {
        throw err
      }

      const http = new HttpError(err)
      res.status(http.status).json(http.toJSON())
    }).catch(next)
  }

  /**
   * @todo
   * @returns {Promise<undefined, ContentTypeError|ValidationError>}
   */
  validate(req) {
    return Promise.try(() => {
      if (this._opts.checkContentType) {
        this.checkContentType(req)
      }

      this.checkRouteSchema(req)
    })
  }
}
