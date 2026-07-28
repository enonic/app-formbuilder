var t = require('/lib/xp/testing');

t.mock('/lib/xp/portal.js', {});
t.mock('/lib/http-client.js', {});

var recaptcha = require('/lib/recaptcha');

exports.testPostWritesUrlAndParamsThroughSetters = function () {
    var result = recaptcha.post({
        url: 'https://example.test/verify',
        params: {
            secret: 'sekret',
            response: 'token'
        }
    });

    t.assertEquals('https://example.test/verify|sekret|token', result);
};

exports.testPostPassesMissingUrlAsNull = function () {
    var result = recaptcha.post({
        params: {
            secret: 'sekret',
            response: 'token'
        }
    });

    t.assertEquals('null|sekret|token', result);
};
