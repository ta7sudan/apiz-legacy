var toString = Map.call.bind(Object.prototype.toString);

var isStr = function isStr(s) {
  return s && typeof s === 'string';
};

var isFn = function isFn(f) {
  return typeof f === 'function';
};

var isObj = function isObj(o) {
  return toString(o) === '[object Object]';
};

var globalQuerystring, globalParamRegex, globalClient, defaultType;

var defaultParamRegex = /:((\w|-)+)/g,
    slashRegex = /\/\//g,
    replaceSlash = function replaceSlash(m, o) {
  return o <= 6 ? m : '/';
};

function isAPIInfoWithURL(v) {
  return !!v.url;
}

function parseApiInfo(name, rawInfo, _ref) {
  var gBaseURL = _ref.baseURL,
      paramRegex = _ref.paramRegex,
      querystring = _ref.querystring,
      client = _ref.client;
  var _rawInfo$method = rawInfo.method,
      method = _rawInfo$method === void 0 ? 'GET' : _rawInfo$method,
      _rawInfo$type = rawInfo.type,
      type = _rawInfo$type === void 0 ? defaultType : _rawInfo$type,
      meta = rawInfo.meta;
  var url, baseURL, path; // 照理讲放parseApiInfo外面显得更合理一点, 不过考虑到add和实例化的时候都要校验

  if (name === 'add') {
    throw new Error('"add" is preserved key.');
  }

  if (isAPIInfoWithURL(rawInfo)) {
    url = rawInfo.url;
  } else {
    baseURL = rawInfo.baseURL;
    path = rawInfo.path;
  }

  var info = {},
      bURL = baseURL || gBaseURL;

  if (!isObj(rawInfo)) {
    throw new TypeError("API " + name + " expected an object, but received " + JSON.stringify(rawInfo) + ".");
  }

  if (isStr(url)) {
    info.url = url;
  } else if (isStr(bURL)) {
    info.url = (bURL + (path || '')).replace(slashRegex, replaceSlash);
  } else {
    throw new Error("API \"" + name + "\" must set url or baseURL correctly.");
  }

  var methodUpperCase = method.toUpperCase(),
      methodLowerCase = method.toLowerCase();

  if (!(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].indexOf(methodUpperCase) !== -1)) {
    throw new Error("Unsupported HTTP method: " + methodUpperCase + ".");
  }

  if (!isFn(client[methodLowerCase])) {
    throw new Error("client must implement a " + methodLowerCase + " function.");
  }

  var parts = info.url.split(/\/(?=\w|:)/g),
      offset = /^(https?:|\/)/.test(parts[0]) ? 2 : 1;
  info.baseURL = parts.slice(0, offset).join('/');
  info.path = "/" + parts.slice(offset).join('/');
  info.name = name;
  info.meta = meta;
  info.method = methodUpperCase;
  info.methodLowerCase = methodLowerCase;
  info.client = client;
  info.type = type;
  info.regex = paramRegex;
  info.querystring = querystring;
  info.init = true;
  return info;
}

function replaceParams(params) {
  return function (m, v) {
    if (params[v] == null) {
      throw new Error("Can't find a property \"" + v + "\" in params.");
    }

    return encodeURIComponent(params[v]);
  };
}

function request(options, isRawOption) {
  // $以区分全局变量
  var methodLowerCase = this.methodLowerCase,
      $defaultType = this.type,
      regex = this.regex,
      querystring = this.querystring,
      baseURL = this.baseURL,
      path = this.path,
      client = this.client,
      meta = this.meta;

  var qs,
      _ref2 = options || {},
      query = _ref2.query,
      params = _ref2.params,
      body = _ref2.body,
      headers = _ref2.headers,
      type = _ref2.type,
      handleError = _ref2.handleError,
      url = this.url;

  if (isRawOption === true) {
    return client[methodLowerCase]({
      url: url,
      name: this.name,
      handleError: handleError,
      options: options
    });
  }

  type === undefined && (type = $defaultType);

  if (params) {
    url = baseURL + path.replace(regex, replaceParams(params));
  }

  if (query) {
    qs = querystring(query);
    url = url.indexOf('?') !== -1 ? url + "&" + qs : url + "?" + qs;
  }

  return client[methodLowerCase]({
    url: url,
    name: this.name,
    handleError: handleError,
    meta: meta,
    type: type,
    body: body,
    headers: headers,
    query: query
  });
}

function createAPI(info) {
  var fn = request.bind(info);
  ['url', 'method', 'meta', 'type'].forEach(function (k) {
    Object.defineProperty(fn, k, {
      value: info[k],
      enumerable: true,
      writable: true
    });
  });
  return fn;
}

function APIz(group, options) {
  var self = this instanceof APIz ? this : Object.create(APIz.prototype);
  var baseURL, paramRegex, querystring, client;
  isStr(group.baseURL) && (baseURL = group.baseURL);

  var _ref3 = options || {};

  var _ref3$baseURL = _ref3.baseURL;
  baseURL = _ref3$baseURL === void 0 ? baseURL : _ref3$baseURL;
  var _ref3$paramRegex = _ref3.paramRegex;
  paramRegex = _ref3$paramRegex === void 0 ? globalParamRegex || defaultParamRegex : _ref3$paramRegex;
  var _ref3$querystring = _ref3.querystring;
  querystring = _ref3$querystring === void 0 ? globalQuerystring : _ref3$querystring;
  var _ref3$client = _ref3.client;
  client = _ref3$client === void 0 ? globalClient : _ref3$client;

  if (!isFn(querystring)) {
    throw new Error('A querystring function must set.');
  }

  if (!client) {
    throw new Error('A client must set.');
  }

  var groupOptions = {
    baseURL: baseURL,
    paramRegex: paramRegex,
    querystring: querystring,
    client: client
  };
  var apis = group.apis; // 不用Object.keys, 允许配置对象继承

  for (var key in apis) {
    // tslint:disable-next-line
    if (isObj(apis[key])) {
      var info = parseApiInfo(key, apis[key], groupOptions);
      Object.defineProperty(self, key, {
        value: createAPI(info),
        writable: false
      });
    } else {
      console.warn("The " + key + " in group is not an object.");
    }
  }

  self.add = function (name, apiInfo) {
    if (this[name]) {
      throw new Error("API \"" + name + "\" already exists.");
    }

    var info = parseApiInfo(name, apiInfo, groupOptions);
    this[name] = createAPI(info);
    return this;
  };

  return self;
}
function config(_temp) {
  var _ref4 = _temp === void 0 ? {
    reset: true
  } : _temp,
      querystring = _ref4.querystring,
      paramRegex = _ref4.paramRegex,
      client = _ref4.client,
      reset = _ref4.reset,
      dt = _ref4.defaultType;

  isFn(querystring) && (globalQuerystring = querystring);
  paramRegex instanceof RegExp && (globalParamRegex = paramRegex);
  globalClient = client;
  defaultType = dt;
  reset && (globalQuerystring = globalParamRegex = globalClient = defaultType = undefined);
}

var querystring = function querystring(obj) {
  if (Object.prototype.toString.call(obj) === '[object Object]') {
    return Object.keys(obj).map(function (k) {
      return Array.isArray(obj[k]) ? obj[k].map(function (v) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(v == null ? '' : v);
      }).join('&') : encodeURIComponent(k) + "=" + encodeURIComponent(obj[k] == null ? '' : obj[k]);
    }).join('&');
  } else if (typeof obj === 'string') {
    return obj;
  } else {
    return JSON.stringify(obj);
  }
};

config({
  querystring: querystring,
  defaultType: 'json'
});

export { APIz, config };
//# sourceMappingURL=apiz.esm.js.map
