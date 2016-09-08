/**
 * Created by along on 16/6/21.
 */
const DingTalkCrypt = require('./dingtalk_crypt');


//钉钉文档：http://ddtalk.github.io/dingTalkDoc/?spm=a3140.7785475.0.0.p5bAUd#2-回调接口（分为五个回调类型）
module.exports = function (config, callback) {
    const dingCrypt = new DingTalkCrypt(config.token, config.encodingAESKey, config.suiteid || 'suite4xxxxxxxxxxxxxxx');

    const TICKET_EXPIRES_IN = config.ticket_expires_in || 1000 * 60 * 20 //20分钟
    return function (req, res, next) {

        const signature = req.query.signature;
        const timestamp = req.query.timestamp;
        const nonce = req.query.nonce;
        const encrypt = req.body.encrypt;

        if (signature !== dingCrypt.getSignature(timestamp, nonce, encrypt)) {
            return res.status(401).end('Invalid signature');
        }

        let result = dingCrypt.decrypt(encrypt);
        const message = JSON.parse(result.message);

        if (message.EventType === 'check_update_suite_url' || message.EventType === 'check_create_suite_url') { //创建套件第一步，验证有效性。
            const Random = message.Random;
            result = _jsonWrapper(timestamp, nonce, Random);
            res.json(result);

        } else {
            res.reply = function () { //返回加密后的success
                result = _jsonWrapper(timestamp, nonce, 'success');
                res.json(result);
            }

            if (config.saveTicket && message.EventType === 'suite_ticket') {
                const data = {
                    value: message.SuiteTicket,
                    expires: Number(message.TimeStamp) + TICKET_EXPIRES_IN
                }
                config.saveTicket(data);
                res.reply();
            } else {
                callback(message, req, res, next);
            }
        };
    }

    function _jsonWrapper(timestamp, nonce, text) {
        const encrypt = dingCrypt.encrypt(text);
        const msg_signature = dingCrypt.getSignature(timestamp, nonce, encrypt); //新签名
        return {
            msg_signature: msg_signature,
            encrypt: encrypt,
            timeStamp: timestamp,
            nonce: nonce
        };
    }

}

