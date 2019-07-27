export type HTTPMethodUpperCase = 'GET' | 'POST' | 'HEAD' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type HTTPMethodLowerCase = 'get' | 'post' | 'head' | 'put' | 'patch' | 'delete' | 'options';

export type HTTPMethod = HTTPMethodUpperCase | HTTPMethodLowerCase;

interface APIInfoWithURL<ContentType, Meta> {
	url: string;
	method?: HTTPMethod;
	type?: ContentType;
	meta?: Meta;
}

interface APIInfoWithPath<ContentType, Meta> {
	baseURL?: string;
	path: string;
	method?: HTTPMethod;
	type?: ContentType;
	meta?: Meta;
}

export type APIInfo<ContentType = any, Meta = any> =
	| APIInfoWithURL<ContentType, Meta>
	| APIInfoWithPath<ContentType, Meta>;

export interface APIGroup<
	T extends Record<string, APIInfo<any, any>> = Record<string, APIInfo<any, any>>
> {
	baseURL?: string;
	apis: T;
}

export interface ClientRequestOptions<RawRequestOptions, ContentType, Meta> {
	url: string;
	name: string;
	meta?: Meta;
	options?: RawRequestOptions;
	body?: any;
	params?: Record<string, string>;
	query?: string | Record<string, any>;
	headers?: Record<string, any>;
	type?: ContentType;
	handleError?: boolean;
}

export type APIzClientRequest<RawRequestOptions, ContentType, Meta> = (
	options: ClientRequestOptions<RawRequestOptions, ContentType, Meta>
) => Promise<any>;

export type APIzClient<
RawRequestOptions,
ContentType,
Meta,
Method extends HTTPMethodLowerCase = HTTPMethodLowerCase
> = {[k in Method]: APIzClientRequest<RawRequestOptions, ContentType, Meta>};

export type Serialize2QueryString = (obj: any) => string;

export interface APIzOptions<
	RawRequestOptions,
	ContentType,
	Meta,
	Method extends HTTPMethodLowerCase = HTTPMethodLowerCase
> {
	baseURL?: string;
	client?: APIzClient<RawRequestOptions, ContentType, Meta, Method>;
	paramRegex?: RegExp;
	querystring?: Serialize2QueryString;
}

export interface GlobalAPIzOptions<
	RawRequestOptions,
	ContentType,
	Meta,
	Method extends HTTPMethodLowerCase = HTTPMethodLowerCase
> {
	client?: APIzClient<RawRequestOptions, ContentType, Meta, Method>;
	paramRegex?: RegExp;
	defaultType?: ContentType;
	reset?: boolean;
	querystring?: (obj: any) => string;
}

type Callable = (...args: Array<any>) => any;

interface ParsedAPIInfo<RawRequestOptions, ContentType, Meta, Method extends HTTPMethodLowerCase> {
	url: string;
	baseURL: string;
	path: string;
	name: string;
	meta?: Meta;
	method: HTTPMethodUpperCase;
	methodLowerCase: Method;
	type?: ContentType;
	regex: RegExp;
	querystring: Serialize2QueryString;
	init: boolean;
	client: APIzClient<RawRequestOptions, ContentType, Meta, Method>;
}

type ContentTypeFrom<R> = R extends Record<string, APIInfo<infer C, infer M>>
	? C extends unknown
		? any
		: C
	: never;

type ProxyGroup<RawRequestOptions, T extends Record<string, APIInfo<any, any>>> = {
	[k in keyof T]: RequestWithoutThis<RawRequestOptions, ContentTypeFrom<T>>
};

export type APIzInstance<
RawRequestOptions = any,
T extends Record<string, APIInfo<any, any>> = Record<string, APIInfo<any, any>>,
Method extends HTTPMethodLowerCase = HTTPMethodLowerCase
> = Omit<ProxyGroup<RawRequestOptions, T>, 'add'> & {
	add: (
		name: string,
		apiInfo: T extends Record<string, infer I>
		? I extends APIInfo<infer C, infer M>
		? APIInfo<C extends unknown ? any : C, M extends unknown ? any : M>
		: never
		: never
	) => APIzInstance<RawRequestOptions, T, Method>;
};

export interface APIzRequestOptions<ContentType> {
	body?: any;
	params?: Record<string, string>;
	query?: string | Record<string, any>;
	headers?: Record<string, any>;
	type?: ContentType;
	handleError?: boolean;
}

export type RequestWithoutThis<RawRequestOptions, ContentType> = (
	options: APIzRequestOptions<ContentType> | RawRequestOptions,
	isRawOption?: boolean
) => Promise<any>;

type Request<RawRequestOptions, ContentType, Meta, Method extends HTTPMethodLowerCase> = (
	this: ParsedAPIInfo<RawRequestOptions, ContentType, Meta, Method>,
	options: APIzRequestOptions<ContentType> | RawRequestOptions,
	isRawOption?: boolean
) => Promise<any>;

export interface APIzRequest<RawRequestOptions, ContentType, Meta> {
	(options: APIzRequestOptions<ContentType> | RawRequestOptions, isRawOption?: boolean): Promise<
		any
	>;
	readonly url: string;
	readonly method: HTTPMethodUpperCase;
	readonly meta: Meta;
	readonly type: ContentType;
}

const toString = ((Map as unknown) as () => any).call.bind(Object.prototype.toString);
const isStr = (s: any): s is string => s && typeof s === 'string';
const isFn = (f: any): f is Callable => typeof f === 'function';
const isObj = (o: any): boolean => toString(o) === '[object Object]';

let globalQuerystring: Serialize2QueryString | undefined,
	globalParamRegex: RegExp | undefined,
	globalClient: APIzClient<any, any, any, any> | undefined,
	defaultType: any;

const defaultParamRegex = /:((\w|-)+)/g,
	slashRegex = /\/\//g,
	replaceSlash = (m: string, o: number): string => (o <= 6 ? m : '/');

function isAPIInfoWithURL<ContentType, Meta>(v: any): v is APIInfoWithURL<ContentType, Meta> {
	return !!v.url;
}

function parseApiInfo<RawRequestOptions, ContentType, Meta, Method extends HTTPMethodLowerCase>(
	name: string,
	rawInfo: APIInfo<ContentType, Meta>,
	{
		baseURL: gBaseURL,
		paramRegex,
		querystring,
		client
	}: {
	baseURL?: string;
	paramRegex: RegExp;
	querystring: Serialize2QueryString;
	client: APIzClient<RawRequestOptions, ContentType, Meta, Method>;
	}
): ParsedAPIInfo<RawRequestOptions, ContentType, Meta, Method> {
	const {
		method = 'GET' as HTTPMethod,
		type = defaultType as ContentType | undefined,
		meta
	} = rawInfo;
	let url: string | undefined, baseURL: string | undefined, path: string | undefined;

	// 照理讲放parseApiInfo外面显得更合理一点, 不过考虑到add和实例化的时候都要校验
	if (name === 'add') {
		throw new Error('"add" is preserved key.');
	}

	if (isAPIInfoWithURL<ContentType, Meta>(rawInfo)) {
		url = rawInfo.url;
	} else {
		baseURL = rawInfo.baseURL;
		path = rawInfo.path;
	}

	const info = {} as ParsedAPIInfo<RawRequestOptions, ContentType, Meta, Method>,
		bURL = baseURL || gBaseURL;

	if (!isObj(rawInfo)) {
		throw new TypeError(`API ${name} expected an object, but received ${JSON.stringify(rawInfo)}.`);
	}
	if (isStr(url)) {
		info.url = url;
	} else if (isStr(bURL)) {
		info.url = (bURL + (path || '')).replace(slashRegex, replaceSlash);
	} else {
		throw new Error(`API "${name}" must set url or baseURL correctly.`);
	}
	const methodUpperCase = method.toUpperCase() as HTTPMethodUpperCase,
		methodLowerCase = method.toLowerCase() as Method;
	if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(methodUpperCase)) {
		throw new Error(`Unsupported HTTP method: ${methodUpperCase}.`);
	}
	if (!isFn(client[methodLowerCase])) {
		throw new Error(`client must implement a ${methodLowerCase} function.`);
	}
	const parts = info.url.split(/\/(?=\w|:)/g),
		offset = /^(https?:|\/)/.test(parts[0]) ? 2 : 1;
	info.baseURL = parts.slice(0, offset).join('/');
	info.path = `/${parts.slice(offset).join('/')}`;
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

function replaceParams(params: Record<string, string>): (m: string, v: string) => string | never {
	return (m: string, v: string): string | never => {
		if (params[v] == null) {
			throw new Error(`Can't find a property "${v}" in params.`);
		}
		return encodeURIComponent(params[v]);
	};
}

function request<RawRequestOptions, ContentType, Meta, Method extends HTTPMethodLowerCase>(
	this: ParsedAPIInfo<RawRequestOptions, ContentType, Meta, Method>,
	options?: APIzRequestOptions<ContentType> | RawRequestOptions,
	isRawOption?: boolean
): Promise<any> {
	// $以区分全局变量
	const {
		methodLowerCase,
		type: $defaultType,
		regex,
		querystring,
		baseURL,
		path,
		client,
		meta
	} = this;
	let qs,
		// tslint:disable-next-line
		{query, params, body, headers, type, handleError} = (options as APIzRequestOptions<ContentType> | undefined) || {} as APIzRequestOptions<ContentType>,
		url = this.url;

	if (isRawOption === true) {
		return client[methodLowerCase]({
			url,
			name: this.name,
			handleError,
			options: options as RawRequestOptions | undefined
		});
	}
	type === undefined && (type = $defaultType);

	if (params) {
		url = baseURL + path.replace(regex, replaceParams(params));
	}

	if (query) {
		qs = querystring(query);
		url = url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
	}

	return client[methodLowerCase]({
		url,
		name: this.name,
		handleError,
		meta,
		type,
		body,
		headers,
		query
	});
}

function createAPI<RawRequestOptions, ContentType, Meta, Method extends HTTPMethodLowerCase>(
	info: ParsedAPIInfo<RawRequestOptions, ContentType, Meta, Method>
): APIzRequest<RawRequestOptions, ContentType, Meta> {
	const fn = request.bind<Request<RawRequestOptions, ContentType, Meta, Method>>(info);

	['url', 'method', 'meta', 'type'].forEach((k: string) => {
		Object.defineProperty(fn, k, {
			value: (info as any)[k],
			enumerable: true,
			writable: true
		});
	});
	return (fn as unknown) as APIzRequest<RawRequestOptions, ContentType, Meta>;
}

export function APIz<
RawRequestOptions = any,
ContentType = any,
Meta = any,
Method extends HTTPMethodLowerCase = HTTPMethodLowerCase,
T extends Record<string, APIInfo<ContentType, Meta>> = Record<string, APIInfo<ContentType, Meta>>
>(
	this: APIzInstance<RawRequestOptions, T, Method>,
	group: APIGroup<T>,
	options?: APIzOptions<RawRequestOptions, ContentType, Meta, Method>
): APIzInstance<RawRequestOptions, T, Method> {
	const self = this instanceof APIz ? this : Object.create(APIz.prototype);
	let baseURL: string | undefined,
		paramRegex: RegExp,
		querystring: Serialize2QueryString | undefined,
		client: APIzClient<RawRequestOptions, ContentType, Meta, Method> | undefined;

	isStr(group.baseURL) && (baseURL = group.baseURL);

	({
		baseURL = baseURL,
		paramRegex = globalParamRegex || defaultParamRegex,
		// 这里querystring虽然可能为undefined, 但是后面立马检测了是否为callable,
		// 为了给js用户提示, 所以这里也可以暂时视为不为undefined
		querystring = globalQuerystring,
		client = globalClient
	} = options || {});

	if (!isFn(querystring)) {
		throw new Error('A querystring function must set.');
	}

	if (!client) {
		throw new Error('A client must set.');
	}

	const groupOptions = {
		baseURL,
		paramRegex,
		querystring,
		client
	};

	const apis = group.apis;

	// 不用Object.keys, 允许配置对象继承
	for (const key in apis) {
		// tslint:disable-next-line
		if (isObj(apis[key])) {
			const info = parseApiInfo<RawRequestOptions, ContentType, Meta, Method>(
				key,
				apis[key],
				groupOptions
			);
			Object.defineProperty(self, key, {
				value: createAPI(info),
				writable: false
			});
		} else {
			console.warn(`The ${key} in group is not an object.`);
		}
	}

	self.add = function (
		name: string,
		apiInfo: APIInfo<ContentType, Meta>
	): APIzInstance<RawRequestOptions, T, Method> {
		if (this[name]) {
			throw new Error(`API "${name}" already exists.`);
		}
		const info = parseApiInfo<RawRequestOptions, ContentType, Meta, Method>(
			name,
			apiInfo,
			groupOptions
		);
		this[name] = createAPI(info);
		return this;
	};

	return self;
}

export function config<
RawRequestOptions,
ContentType = any,
Meta = any,
Method extends HTTPMethodLowerCase = HTTPMethodLowerCase
>(
	{
		querystring,
		paramRegex,
		client,
		reset,
		defaultType: dt
	}: GlobalAPIzOptions<RawRequestOptions, ContentType, Meta, Method> = {reset: true}
): void {
	isFn(querystring) && (globalQuerystring = querystring);
	paramRegex instanceof RegExp && (globalParamRegex = paramRegex);
	globalClient = client;
	defaultType = dt;
	reset &&
		(globalQuerystring = globalParamRegex = globalClient = defaultType = undefined);
}