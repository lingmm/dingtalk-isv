/**
 * Created by along on 16/6/24.
 */
const promisePlugin = require('superagent-promise-plugin');
const agent = promisePlugin.patch(require('superagent'));
const crypto = require('crypto');
const BASE_URL = 'https://oapi.dingtalk.com';
const TOKEN_EXPIRES_IN = 1000 * 60 * 60 * 2 - 10000 //1小时59分50秒.防止网络延迟

const Api = function (conf) {
    if (typeof conf === 'string') {
        this.token_cache = {
            value: conf,
            expires: Infinity
        };

        if (arguments[1]) {
            this.jsapi_ticket_cache = {
                value: arguments[1],
                expires: Infinity
            };
        }

    } else {
        this.corpid = conf.corpid;
        this.secret = conf.secret;
        this.token_cache = null;
        this.jsapi_ticket_cache = null;
        this.getJsApiTicket = conf.getJsApiTicket || function () { return Promise.resolve(null) };
        this.saveJsApiTicket = conf.saveJsApiTicket || function () { return Promise.resolve(null) };

        this.getToken = conf.getToken || function () { return Promise.resolve(this.token_cache); };
        this.saveToken = conf.saveToken || function (token) {
            this.token_cache = token;
            if (process.env.NODE_ENV === 'production') {
                console.warn('Don\'t save token in memory, when cluster or multi-computer!');
            }
            Promise.resolve(this.token_cache);
        };
        this.token_expires_in = conf.token_expires_in || TOKEN_EXPIRES_IN;
    }
}

Api.prototype._get_access_token = function () {
    return agent.get(BASE_URL + '/gettoken')
        .query({
            corpid: this.corpid,
            corpsecret: this.secret
        }).then(wrapper);
};

Api.prototype.getLatestToken = function () {
    if (!this.token_cache) {
        return this.getToken().then(token => {
            this.token_cache = token || { expires: 0 };
            return this.getLatestToken();
        });
    } else {
        const now = Date.now();
        if (this.token_cache.expires <= now) {
            return this._get_access_token().then(token => {
                this.token_cache = { value: token.access_token, expires: now + this.token_expires_in };
                this.saveToken(this.token_cache);
                return this.token_cache;
            });
        } else {
            return Promise.resolve(this.token_cache);
        }
    }
};

//代理：get方法
Api.prototype.get = function (path, data = {}) {
    return this.getLatestToken().then(token => {
        data.access_token = token.value;
        return agent.get(BASE_URL + path).query(data)
            .then(wrapper);
    });
};

//代理：post方法
Api.prototype.post = function (path, data) {
    return this.getLatestToken().then(token => {
        return agent.post(BASE_URL + path)
            .query({ access_token: token.value })
            .send(data)
            .then(wrapper);
    });
};

//=============================== 部门 ===============================

Api.prototype.getDepartments = function () {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/department/list')
            .query({ access_token: token.value })
            .then(wrapper);
    });
}

Api.prototype.getDepartmentDetail = function (id) {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/department/get')
            .query({ id: id, access_token: token.value })
            .then(wrapper);
    });
};

Api.prototype.createDepartment = function (name, opts) {
    return this.getLatestToken().then(function (token) {
        if (typeof opts === 'object') {
            opts.name = name;
            opts.parentid = opts.parentid || 1;
        } else {
            opts = {
                name: name,
                parentid: opts
            };
        }
        return agent.post(BASE_URL + '/department/create')
            .query({ access_token: token.value })
            .send(opts)
            .then(wrapper);
    });
}

Api.prototype.updateDepartment = function (id, opts) {
    return this.getLatestToken().then(function (token) {
        if (typeof opts === 'object') {
            opts.id = id;
        } else {
            opts = { name: opts, id: id }
        }
        return agent.post(BASE_URL + '/department/update')
            .query({ access_token: token.value })
            .send(opts)
            .then(wrapper);
    });
}

Api.prototype.deleteDepartment = function (id) {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/department/delete')
            .query({ id: id, access_token: token.value })
            .then(wrapper);
    });
};

//=============================== 微应用 ===============================

Api.prototype.createMicroApp = function (data) {
    return this.getLatestToken().then(function (token) {
        return agent.post(BASE_URL + '/microapp/create')
            .query({ access_token: token.value })
            .send(data)
            .then(wrapper);
    });
};

//=============================== 消息 ===============================
//
Api.prototype.sendToConversation = function () {
    return this.getLatestToken().then(function (token) {
        return agent.post(BASE_URL + '/message/send_to_conversation')
            .query({ access_token: token.value })
            .then(wrapper);
    });
};

Api.prototype.send = function (agentid, options) {
    return this.getLatestToken().then(function (token) {
        options.agentid = agentid + '';
        return agent.post(BASE_URL + '/message/send')
            .query({ access_token: token.value })
            .send(options)
            .then(wrapper);
    });
};

//=============================== 用户 ===============================

Api.prototype.getDepartmentUsers = function (id) {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/user/simplelist')
            .query({ department_id: id, access_token: token.value })
            .then(wrapper);
    });
}

Api.prototype.getDepartmentUsersDetail = function (id) {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/user/list')
            .query({ department_id: id, access_token: token.value })
            .then(wrapper);
    });
}


Api.prototype.getUser = function (id) {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/user/get')
            .query({ userid: id, access_token: token.value })
            .then(wrapper);
    });
}

//登录
Api.prototype.getUserInfoByCode = function (code) {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/user/getuserinfo')
            .query({ code: code, access_token: token.value })
            .then(wrapper);
    });
};



//=============================== jsApi Ticket ===============================

Api.prototype._get_jsApi_ticket = function () {
    return this.getLatestToken().then(function (token) {
        return agent.get(BASE_URL + '/get_jsapi_ticket')
            .query({ type: 'jsapi', access_token: token.value })
            .then(wrapper);
    });
};


Api.prototype.getLatestJsApiTicket = function () {
    if (!this.jsapi_ticket_cache) {
        return this.getJsApiTicket().then((data) => {
            this.jsapi_ticket_cache = data || { expires: 0 };
            return this.getLatestJsApiTicket();
        });
    } else {
        const now = Date.now();
        if (this.jsapi_ticket_cache.expires <= now) {
            return this._get_jsApi_ticket().then(data => {
                this.jsapi_ticket_cache = { value: data.ticket, expires: now + this.token_expires_in };
                this.saveJsApiTicket(data);
                return this.jsapi_ticket_cache;
            })
        } else {
            return Promise.resolve(this.jsapi_ticket_cache);
        }
    }
}


const createNonceStr = function () {
    return Math.random().toString(36).substr(2, 15);
};

const raw = function (args) {
    return Object.keys(args).sort().map(k => k + '=' + args[k]).join('&');
};

const sign = function (ret) {
    const string = raw(ret);
    const shasum = crypto.createHash('sha1');
    shasum.update(string);
    return shasum.digest('hex');
};



/*Api.prototype.generate = function(param, callback){
 }*/

Api.prototype.getUrlSign = function (url) {
    return this.getLatestJsApiTicket().then(function (data) {
        let result = {
            noncestr: createNonceStr(),
            jsapi_ticket: data.value,
            timestamp: Date.now(),
            url: url
        }

        const signature = sign(result);
        result = {
            signature: signature,
            timeStamp: result.timestamp.toString(),
            nonceStr: result.noncestr
        }
        return result;
    });

}

//=============================== ISV Suite Ctrl ===============================

Api.fromSuite = function (newSuiteApi, conf) {
    Object.assign(this, conf);
    this.newSuiteApi = newSuiteApi;
}

Api.fromSuite.prototype.ctrl = function (corpid, permanent_code, token_cache, jsapi_ticket_cache) {
    this.corpid = corpid;
    this.token_cache = token_cache;
    this.jsapi_ticket_cache = jsapi_ticket_cache;

    const api = new Api(this);
    const newSuiteApi = this.newSuiteApi;
    api._get_access_token = function () {
        return newSuiteApi.getCorpToken(corpid, permanent_code);
    }
    return api;
}


function wrapper(res) {
    let data = res.body;
    if (data.errcode === 0) {
        return data;
    } else {
        err = new Error(data.errmsg);
        err.name = 'DingTalkAPIError';
        err.code = data.errcode;
        return Promise.reject(err);
    }
}

module.exports = Api;
