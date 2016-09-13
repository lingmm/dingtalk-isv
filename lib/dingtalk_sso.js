/**
 * Created by along on 16/6/23.
 */
const agent = require('superagent');
const SSO_BASE_URL = 'https://oapi.dingtalk.com';

const Api = function (conf) {
    this.SSOSecret = conf.SSOSecret;
    this.corpid = conf.corpid;
}

Api.prototype.getSSOToken = function () {
    return agent.get(SSO_BASE_URL + '/sso/gettoken').query({
        corpid: this.corpid,
        corpsecret: this.SSOSecret
    }).then(wrapper)
};

//登录
Api.prototype.getSSOUserInfoByCode = function (code) {
    return this.getSSOToken().then(function (token) {
        agent.get(SSO_BASE_URL + '/sso/getuserinfo')
            .query({
                code: code,
                access_token: token.access_token
            })
            .then(wrapper);
    });
};

//生成授权链接
Api.prototype.generateAuthUrl = function (redirect_url) {
    return 'https://oa.dingtalk.com/omp/api/micro_app/admin/landing?corpid=' + this.corpid + '&redirect_url=' + redirect_url;
};

function wrapper(res) {
    let data = res.body;
    if (data.errcode === 0) {
        return data;
    } else {
        let err = new Error(data.errmsg);
        err.name = 'DingTalkAPIError';
        err.code = data.errcode;
        return Promise.reject(err);
    }
}

module.exports = Api;
