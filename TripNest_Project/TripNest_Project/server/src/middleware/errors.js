// معالج أخطاء موحد واستجابات آمنة لحالات فشل الطلب والتحقق. المسؤول: الفريق.

const { HttpError } = require('../utils/httpError');


function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'The requested resource was not found.', { code: 'NOT_FOUND' }));
}


// #explain_notes: Known errors return their message; unexpected errors return a generic message only.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        message: error.message,
        code: error.code,
        fields: error.fields,
      },
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { message: 'The request body is not valid JSON.', code: 'BAD_JSON', fields: null },
    });
  }

  console.error(error);

  return res.status(500).json({
    error: { message: 'Something went wrong. Please try again.', code: 'SERVER_ERROR', fields: null },
  });
}


module.exports = {
  notFoundHandler,
  errorHandler,
};
