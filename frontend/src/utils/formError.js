export function formError(error, fallback) {
  return { message: error.response?.data?.message || fallback, fields: error.response?.data?.errors || {} };
}
