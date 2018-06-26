var portal = require('/lib/xp/portal');

/**
 * The reCAPTCHA site key
 * @type {string}
 */
exports.getSiteKey = function() {
    return portal.getSiteConfig().recaptchaSiteKey || '';
};

/**
 * The reCAPTCHA secret key
 * @type {string}
 */
exports.getSecretKey = function() {
    return portal.getSiteConfig().recaptchaSecretKey || '';
};

/**
 * Checks with Google if user is verified
 * @returns {boolean}
 */
exports.verify = function(response) {
    var url = 'https://www.google.com/recaptcha/api/siteverify';

    var recaptchaVerified = post({
        'url': url,
        'params': {
            'secret': exports.getSecretKey(),
            'response': response
        },
        proxy: portal.getSiteConfig().proxy
    });

    var recaptchaVerifiedJSON = JSON.parse(recaptchaVerified);

    return recaptchaVerifiedJSON.success;
};

/**
 * Check if site key and secret key are configured
 * @returns {boolean}
 */
exports.isConfigured = function() {
    var isConfigured = exports.getSiteKey() && exports.getSecretKey() ? true : false;

    return isConfigured;
};

/**
 *
 * @param params
 * @returns {*}
 */
function post(params) {
    var bean = __.newBean('com.enonic.lib.recaptcha.HttpClientHandler');

    bean.url = params.url;
    bean.params = params.params;

    return __.toNativeObject(bean.execute());
}









var httpClient = require('/lib/http-client');
var portal = require('/lib/xp/portal');

/**
 * The reCAPTCHA site key
 * @type {string}
 */
exports.getSiteKey = function() {
    return portal.getSiteConfig().recaptchaSiteKey || '';
};


/**
 * The reCAPTCHA secret key
 * @type {string}
 */
exports.getSecretKey = function() {
    return portal.getSiteConfig().recaptchaSecretKey || '';
};


/**
 * Checks with Google if user is verified
 * @returns {boolean}
 */
exports.verify = function(response) {
    var url = 'https://www.google.com/recaptcha/api/siteverify';
    var secret = exports.getSecretKey();

    // TODO: allow for proxy settings
    var recaptchaVerified = httpClient.request({
        url: url,
        params: {
            secret: secret,
            response: response
        }
    });

    // The success object from the response defaults to false here, only set to true if the reCAPTCHA verification response is valid
    var recaptchaVerifiedJSON = recaptchaVerified.body ? JSON.parse(recaptchaVerified.body) : { success: false };
    return recaptchaVerifiedJSON.success;
};

/**
 * Check if site key and secret key are configured
 * @returns {boolean}
 */
exports.isConfigured = function() {
    var isConfigured = exports.getSiteKey() && exports.getSecretKey() ? true : false;

    return isConfigured;
};
