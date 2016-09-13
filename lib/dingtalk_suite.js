/**
 * Created by along on 16/6/22.
 */
const promisePlugin = require('superagent-promise-plugin');
const agent = promisePlugin.patch(require('superagent'));
const BASE_URL = 'https://oapi.dingtalk.com/service';
const SSO_BASE_URL = 'https://oapi.dingtalk.com';
const TICKET_EXPIRES_IN = 1000 * 60 * 20 //20分钟
const TOKEN_EXPIRES_IN = 1000 * 60 * 60 * 2 - 10000 //1小时59分50秒.防止网络延迟


const Api = function (conf) {
    this.suite_key = conf.suiteid;
    this.suite_secret = conf.secret;
    this.ticket_expires_in = TICKET_EXPIRES_IN;
    this.token_expires_in = conf.token_expires_in || TOKEN_EXPIRES_IN;

    this.getTicket = conf.getTicket;
    this.ticket_cache = {
        expires: 0,
        value: null
    };

    this.token_cache = null;
    this.getToken = conf.getToken || (() => {
        return Promise.resolve(this.token_cache);
    });
    this.saveToken = conf.saveToken || ((token) => {
        this.token_cache = token;
    });

};

Api.prototype.getLatestTicket = function () {
    const now = Date.now();
    if (this.ticket_cache.expires <= now) {
        return this.getTicket();
    } else {
        return Promise.resolve(this.ticket_cache);
    }
};

Api.prototype._get_access_token = function (callback) {
    return this.getLatestTicket().then(ticket => {
        const data = {
            suite_key: this.suite_key,
            suite_secret: this.suite_secret,
            suite_ticket: ticket.value
        };
        return agent.post(BASE_URL + '/get_suite_token').send(data).then(wrapper);
    });
};

Api.prototype.getLatestToken = function () {
    if (!this.token_cache) {
        return this.getToken().then(token => {
            if (!token) {
                const now = Date.now();
                return this._get_access_token().then(token => {
                    this.token_cache = {
                        value: token.suite_access_token,
                        expires: now + this.token_expires_in
                    };
                    this.saveToken(this.token_cache);
                    return this.token_cache;
                });
            }
            this.token_cache = token;
            return this.getLatestToken();
        });
    } else {

        const now = Date.now();
        if (this.token_cache.expires <= now) {
            return this._get_access_token().then(token => {
                this.token_cache = {
                    value: token.suite_access_token,
                    expires: now + this.token_expires_in
                };
                this.saveToken(this.token_cache);
                return this.token_cache;
            });
        } else {
            return Promise.resolve(this.token_cache);
        }
    }
};

Api.prototype.getPermanentCode = function (tmp_auth_code) {
    return this.getLatestToken().then(function (token) {
        return agent.post(BASE_URL + '/get_permanent_code').query({ suite_access_token: token.value }).send({ tmp_auth_code: tmp_auth_code }).then(wrapper);
    });
};

Api.prototype.getCorpToken = function (auth_corpid, permanent_code) {
    return this.getLatestToken().then(function (token) {
        return agent.post(BASE_URL + '/get_corp_token').query({ suite_access_token: token.value }).send({
            auth_corpid: auth_corpid,
            permanent_code: permanent_code
        }).then(wrapper);
    });
};

Api.prototype.getAuthInfo = function (auth_corpid, permanent_code) {
    return this.getLatestToken().then(token => {
        return agent.post(BASE_URL + '/get_auth_info')
            .query({ suite_access_token: token.value })
            .send({ suite_key: this.suite_key, auth_corpid: auth_corpid, permanent_code: permanent_code })
            .then(wrapper);
    });
};

Api.prototype.getAgent = function (agentid, auth_corpid, permanent_code) {
    return this.getLatestToken().then(token => {
        return agent.post(BASE_URL + '/get_agent')
            .query({ suite_access_token: token.value })
            .send({
                suite_key: this.suite_key,
                auth_corpid: auth_corpid,
                permanent_code: permanent_code,
                agentid: agentid
            })
            .then(wrapper);
    });
};

Api.prototype.activateSuite = function (auth_corpid, permanent_code) {
    return this.getLatestToken().then(token => {
        return agent.post(BASE_URL + '/activate_suite')
            .query({ suite_access_token: token.value })
            .send({ suite_key: this.suite_key, auth_corpid: auth_corpid, permanent_code: permanent_code })
            .then(wrapper);
    });
};

Api.prototype.setCorpIpwhitelist = function (auth_corpid, ip_whitelist) {
    return this.getLatestToken().then(token => {
        return agent.post(BASE_URL + '/set_corp_ipwhitelist')
            .query({ suite_access_token: token.value })
            .send({ suite_key: this.suite_key, auth_corpid: auth_corpid, ip_whitelist: ip_whitelist })
            .then(wrapper);
    });
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
