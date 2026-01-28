/**
 * Extract a user-friendly error message from API error responses.
 * Handles both string errors and Pydantic validation error arrays.
 * 
 * @param {Error} error - Axios error object
 * @param {string} fallback - Default message if extraction fails
 * @returns {string} Error message suitable for display
 */
export const getErrorMessage = (error, fallback = 'An error occurred') => {
    const detail = error?.response?.data?.detail;

    if (typeof detail === 'string') {
        return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation errors are arrays of objects with 'msg' property
        return detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
    }

    if (typeof detail === 'object' && detail !== null) {
        return detail.msg || detail.message || fallback;
    }

    return error?.message || fallback;
};
