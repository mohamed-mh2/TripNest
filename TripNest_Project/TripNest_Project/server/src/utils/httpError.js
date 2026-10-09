// Error type with an HTTP status and optional field messages, used by routes and controllers. المسؤول: الفريق.

class HttpError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.status = status;
    this.code = options.code || null;
    this.fields = options.fields || null;
  }
}


// #explain_notes: Express 4 does not catch rejected promises, so async handlers are wrapped.
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}


module.exports = {
  HttpError,
  asyncHandler,
};
