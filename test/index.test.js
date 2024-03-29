import test from 'ava';
import { APIz, config } from '../test_cache/core';
import { querystring } from '../test_cache/querystring';

/* global todo */


/**
 * AVA 默认不处理src下面的文件, 所以需要@babel/register
 * 对于async, 还需要@babel/polyfill, 这些都在package.json中配置
 * 另外由于tree shaking的需要, 全局的babel配置是不会将ES module
 * 语法转换成CommonJS的(modules: false), 所以需要覆盖掉全局babel配置
 */

// const sleep = time => new Promise(rs => setTimeout(rs, time));
const isObj = o => Object.prototype.toString.call(o) === '[object Object]';

test.beforeEach(() => {
	config();
});

test.serial('without querystring', t => {
	const apiMeta = {
		apis: {
			getBook: {
				url: 'http://www.a.com'
			}
		}
	};
	try {
		new APIz(apiMeta);
	} catch (e) {
		t.is(e.message, 'A querystring function must set.');
	}
});

test.serial('without client', t => {
	const apiMeta = {
		apis: {
			getBook: {
				url: 'http://www.a.com'
			}
		}
	};
	config({ querystring });
	try {
		new APIz(apiMeta);
	} catch (e) {
		t.is(e.message, 'A client must set.');
	}
});

test.serial('without baseURL', t => {
	config({
		querystring,
		client: {
			get() { }
		}
	});
	const apiMeta = {
		apis: {
			getBook: {
				path: '/test/:book/test'
			}
		}
	};
	try {
		new APIz(apiMeta);
	} catch (e) {
		t.regex(e.message, /must set url or baseURL correctly./);
	}
});

test.serial('client implements method is not a function', t => {
	config({
		querystring,
		client: {
			get: 5
		}
	});
	const apiMeta = {
		apis: {
			getBook: {
				baseURL: 'http://www.a.com',
				path: '/test/:book/test'
			}
		}
	};
	try {
		new APIz(apiMeta);
	} catch (e) {
		t.regex(e.message, /client must implement a/);
	}
});

test.serial('meta data with invalid HTTP method', t => {
	config({
		querystring,
		client: {
			get() { }
		}
	});
	const apiMeta = {
		apis: {
			getBook: {
				baseURL: 'http://www.a.com',
				path: '/test/:book/test',
				method: 'test'
			}
		}
	};
	try {
		new APIz(apiMeta);
	} catch (e) {
		t.regex(e.message, /Unsupported HTTP method:/);
	}
});

test.serial('global config', t => {
	const querystring = o => 'querystring';
	const defaultType = 'defaultType';
	const paramRegex = /{(\w+)}/g;
	const apiMeta = {
		apis: {
			getBook: {
				baseURL: 'http://www.a.com',
				path: '/test/{book}/test',
				method: 'post'
			}
		}
	};

	config({
		querystring,
		paramRegex,
		defaultType,
		client: {
			post({ url, body }) {
				t.is(url, 'http://www.a.com/test/CSAPP/test?querystring');
				t.deepEqual(body, {
					body: 'test'
				});
			}
		}
	});

	const group0 = new APIz(apiMeta);
	group0.getBook(
		{
			body: {
				body: 'test'
			},
			params: {
				book: 'CSAPP'
			},
			query: {
				query: 'aaa'
			}
		}
	);
	t.is(group0.getBook.type, 'defaultType');

	const group1 = new APIz(apiMeta);
	group1.getBook(
		{
			body: {
				body: 'test'
			},
			params: {
				book: 'CSAPP'
			},
			query: {
				query: 'aaa'
			}
		}
	);
	t.is(group1.getBook.type, 'defaultType');
});

test.serial('group config', t => {
	const querystring = o => 'querystring';
	const defaultType = 'defaultType';
	const paramRegex = /{(\w+)}/g;
	const apiMeta = {
		apis: {
			getBook: {
				baseURL: 'http://www.a.com',
				path: '/test/:book/test',
				method: 'post'
			}
		}
	};

	t.plan(3);

	config({
		querystring,
		paramRegex,
		defaultType,
		client: {
			post({ url, body }) {
				t.is(url, 'http://www.a.com/test/CSAPP/test?querystring');
				t.is(body, 'test');
				t.fail();
			}
		}
	});

	const apis = new APIz(apiMeta, {
		querystring: o => 'gquerystring',
		paramRegex: /:(book)/g,
		client: {
			post({ url, body }) {
				t.is(url, 'http://www.a.com/test/CSAPP/test?gquerystring');
				t.deepEqual(body, {
					body: 'test'
				});
			}
		}
	});
	apis.getBook(
		{
			body: {
				body: 'test'
			},
			params: {
				book: 'CSAPP'
			},
			query: {
				query: 'aaa'
			}
		}
	);
	t.is(apis.getBook.type, 'defaultType');
});

test.serial('use meta baseURL', t => {
	let count = 0;
	config({
		querystring,
		client: {
			get({ url }) {
				count++
					? t.is(url, 'http://www.a.com/test/Tom/bbb')
					: t.is(url, 'http://www.b.com/test/SICP/aaa');
			}
		}
	});

	const apiMeta = {
		baseURL: 'http://www.a.com',
		apis: {
			getBook: {
				baseURL: 'http://www.b.com',
				path: '/test/:book/aaa'
			},
			getUser: {
				path: '/test/:user/bbb'
			}
		}
	};

	const apis = new APIz(apiMeta);
	apis.getBook({
		params: {
			book: 'SICP'
		}
	});

	apis.getUser({
		params: {
			user: 'Tom'
		}
	});
});

test.serial('use group baseURL', t => {
	let count = 0;
	config({
		querystring,
		client: {
			get({ url }) {
				count++
					? t.is(url, 'http://www.c.com/test/Tom/bbb')
					: t.is(url, 'http://www.b.com/test/SICP/aaa');
			}
		}
	});

	const apiMeta = {
		baseURL: 'http://www.a.com',
		apis: {
			getBook: {
				baseURL: 'http://www.b.com',
				path: '/test/:book/aaa'
			},
			getUser: {
				path: '/test/:user/bbb'
			}
		}
	};

	const apis = new APIz(apiMeta, {
		baseURL: 'http://www.c.com'
	});
	apis.getBook({
		params: {
			book: 'SICP'
		}
	});

	apis.getUser({
		params: {
			user: 'Tom'
		}
	});
});

test.serial('inherited from APIz', t => {
	config({
		querystring,
		client: {
			get() { }
		}
	});

	const apis = new APIz({});

	t.true(apis instanceof APIz);
});

test.serial('properties of Object prototype', t => {
	config({
		querystring,
		client: {
			get() { }
		}
	});

	const apis = new APIz({});

	t.is(apis.toString(), '[object Object]');
});

test.serial('add new API', t => {
	config({
		querystring,
		client: {
			get({ url }) {
				t.is(url, 'http://www.a.com/test/CSAPP/aaa?key1=value1&key2=value2');
			}
		}
	});

	const apis = new APIz(
		{},
		{
			baseURL: 'http://www.a.com'
		}
	);

	apis.add('getBook', {
		path: '/test/:book/aaa'
	});

	apis.getBook(
		{
			params: {
				book: 'CSAPP'
			},
			query: {
				key1: 'value1',
				key2: 'value2'
			}
		}
	);
});

test.serial('add an API already exists', t => {
	config({
		querystring,
		client: {
			get({ url }) {
				t.is(url, 'http://www.a.com/test/CSAPP/aaa?key1=value1&key2=value2');
			}
		}
	});

	const apis = new APIz(
		{
			apis: {
				getBook: {
					path: '/test/:book/aaa'
				}
			}
		},
		{
			baseURL: 'http://www.a.com'
		}
	);

	try {
		apis.add('getBook', {
			path: '/test/:book/aaa'
		});
	} catch (e) {
		t.regex(e.message, /already exists./);
	}
});

test.serial('invalid querystring', t => {
	config({
		querystring,
		client: {
			get({ url }) {
				t.is(url, 'http://www.a.com/test/CSAPP/aaa?555');
			}
		}
	});

	const apis = new APIz(
		{
			apis: {
				getBook: {
					path: '/test/:book/aaa'
				}
			}
		},
		{
			baseURL: 'http://www.a.com'
		}
	);

	apis.getBook(
		{
			params: {
				book: 'CSAPP'
			},
			query: 555
		}
	);
});

test.serial('querystring type is string', t => {
	config({
		querystring,
		client: {
			get({ url }) {
				t.is(url, 'http://www.a.com/test/CSAPP/aaa?key0=000&key1=111');
			}
		}
	});

	const apis = new APIz(
		{
			apis: {
				getBook: {
					path: '/test/:book/aaa'
				}
			}
		},
		{
			baseURL: 'http://www.a.com'
		}
	);

	apis.getBook(
		{
			params: {
				book: 'CSAPP'
			},
			query: 'key0=000&key1=111'
		}
	);
});

test.serial('querystring has array', t => {
	config({
		querystring,
		client: {
			get({ url }) {
				t.is(url, 'http://www.a.com/test/CSAPP/aaa?key1=value1&key2=1&key2=2&key2=3');
			}
		}
	});

	const apis = new APIz(
		{
			apis: {
				getBook: {
					path: '/test/:book/aaa'
				}
			}
		},
		{
			baseURL: 'http://www.a.com'
		}
	);

	apis.getBook(
		{
			params: {
				book: 'CSAPP'
			},
			query: {
				key1: 'value1',
				key2: [1, 2, 3]
			}
		}
	);
});


test.serial('invalid params', t => {
	config({
		querystring,
		client: {
			get() {
				t.fail();
			}
		}
	});

	const apis = new APIz(
		{
			apis: {
				getBook: {
					path: '/test/:book/aaa'
				}
			}
		},
		{
			baseURL: 'http://www.a.com'
		}
	);

	try {
		apis.getBook(
			{
				params: {
					nobook: 'CSAPP'
				}
			}
		);
	} catch (e) {
		t.regex(e.message, /Can't find a property/);
	}
});

test.serial('body with type', t => {
	config({
		querystring,
		client: {
			post({ url, body, options, type }) {
				t.is(url, 'http://www.a.com/test/CSAPP/aaa');
				t.deepEqual(body, {
					body: 'post'
				});
				t.is(type, 'form');
				t.is(options, undefined);
			}
		}
	});

	const apis = new APIz(
		{
			apis: {
				addBook: {
					path: '/test/:book/aaa',
					method: 'post'
				}
			}
		},
		{
			baseURL: 'http://www.a.com'
		}
	);

	apis.addBook({
		body: {
			body: 'post'
		},
		params: {
			book: 'CSAPP'
		},
		type: 'form'
	});
});

test.serial('use preserved key', t => {
	config({
		querystring,
		client: {
			get() {
				t.fail();
			}
		}
	});

	try {
		new APIz({
			apis: {
				baseURL: 'test',
				add: {
					path: 'test'
				}
			}
		});
	} catch (e) {
		t.is(e.message, '"add" is preserved key.');
	}
	try {
		const apis = new APIz({});
		apis.add('add', {});
	} catch (e) {
		t.is(e.message, 'API "add" already exists.');
	}
});

test.serial('invalid api info 0', t => {
	config({
		querystring,
		client: {
			get() {}
		}
	});

	const apiMeta = {
		baseURL: 'http://www.a.com',
		apis: {
			getBook: 233
		}
	};

	const apis = new APIz(apiMeta);
	t.true(typeof apis.getBook === 'undefined');
});

test.serial('all options', t => {
	let count = 0;
	config({
		querystring,
		client: {
			get({ url, options }) {
				switch (count++) {
					case 0:
						t.is(url, 'http://www.b.com/data0/000/test/111?test=1&key0=aaa&key1=bbb');
						t.is(options, undefined);
						break;
					case 1:
						t.is(url, 'http://www.b.com/data0/000/test/111?test=1');
						t.is(options, undefined);
						break;
					case 2:
						t.is(url, 'http://www.c.com/data1/?key0=%E6%B5%8B%E8%AF%95&key1=111');
						t.is(options, undefined);
						break;
					case 3:
						t.is(url, 'http://www.d.com/data2/%E6%B5%8B%E8%AF%95/test/111/?key0=%E6%B5%8B%E8%AF%95&key1=111');
						t.is(options, undefined);
						break;
					case 4:
						t.is(url, 'http://www.a.com/test?key0=000&key1=111');
						t.is(options, undefined);
						break;
					case 5:
						t.is(url, 'http://www.a.com/test');
						t.is(options, undefined);
						break;
					case 6:
						t.is(url, 'http://www.a.com/test');
						t.true(isObj(options));
						break;

					default:
						break;
				}
			},
			post({ url, body, options, type }) {
				switch (count++) {
					case 7:
						t.is(url, 'http://www.a.com/test/000/aaa/111?key0=000&key1=111');
						t.true(isObj(body));
						t.is(type, 'json');
						break;
					case 8:
						t.is(url, 'http://www.a.com/test/000/aaa/111');
						t.true(isObj(body));
						t.is(type, 'json');
						break;
					case 9:
						t.is(url, 'http://www.a.com/test/000/aaa/111');
						t.is(body, undefined);
						t.is(type, 'json');
						break;
					case 10:
						t.is(url, 'http://www.a.com/test');
						t.true(isObj(body));
						t.is(type, undefined);
						break;
					case 11:
						t.is(url, 'http://www.a.com/test');
						t.true(isObj(options));
						t.is(type, undefined);
						t.is(body, undefined);
						break;
					case 12:
						t.is(url, 'http://www.a.com/test?key0=000&key1=111');
						t.true(isObj(body));
						t.is(type, undefined);
						break;

					default:
						break;
				}
			}
		}
	});

	const apiMeta = {
		baseURL: 'http://www.a.com',
		apis: {
			getData0: {
				url: 'http://www.b.com/data0/:data0/test/:data1?test=1'
			},
			getData1: {
				url: 'http://www.c.com/data1/',
				baseURL: 'http://www.cc.com',
				path: '/test/:data0/aaa/:data1/'
			},
			getData2: {
				baseURL: 'http://www.d.com/data2/:data0/test',
				path: '/:data1/'
			},
			getData3: {
				path: '/test'
			},
			postData0: {
				path: '/test/:data0/aaa/:data1',
				method: 'post',
				type: 'json'
			},
			postData1: {
				path: '/test',
				method: 'post'
			}
		}
	};

	const apis = new APIz(apiMeta);

	// case0
	apis.getData0(
		{
			params: {
				data0: '000',
				data1: 111
			},
			query: {
				key0: 'aaa',
				key1: 'bbb'
			}
		}
	);

	// case1
	apis.getData0({
		params: {
			data0: '000',
			data1: 111
		}
	});

	// try {
	// 	apis.getData0({
	// 		query: {
	// 			key0: '000',
	// 			key1: 111
	// 		}
	// 	});
	// } catch (e0) {
	// 	t.is(e0.message, 'Path params is required.');
	// }

	// case2
	apis.getData1({
		params: {
			data0: '测试',
			data1: 111
		},
		query: {
			key0: '测试',
			key1: 111
		}
	});

	// case3
	apis.getData2({
		params: {
			data0: '测试',
			data1: 111
		},
		query: {
			key0: '测试',
			key1: 111
		}
	});

	// case4
	apis.getData3({
		query: {
			key0: '000',
			key1: 111
		}
	});

	// case5
	apis.getData3();

	// case6
	apis.getData3({
		headers: {
			'Content-Type': 'application/json'
		}
	}, true);

	// try {
	// 	apis.postData0();
	// } catch (e1) {
	// 	t.is(e1.message, 'Path params is required.');
	// }

	// try {
	// 	apis.postData0({
	// 		body: 'body'
	// 	});
	// } catch (e1) {
	// 	t.is(e1.message, 'Path params is required.');
	// }

	// case7
	apis.postData0({
		body: {
			body: 'body'
		},
		params: {
			data0: '000',
			data1: 111
		},
		query: {
			key0: '000',
			key1: 111
		}
	});

	// case8
	apis.postData0({
		body: {
			body: 'body'
		},
		params: {
			data0: '000',
			data1: 111
		}
	});

	// case9
	apis.postData0({
		params: {
			data0: '000',
			data1: 111
		}
	});

	// case10
	apis.postData1({
		body: {
			body: 'body'
		}
	});

	// case11
	apis.postData1({
		headers: {
			'Content-Type': 'text/plain'
		}
	}, true);

	// case12
	apis.postData1({
		body: {
			body: 'body'
		},
		query: {
			key0: '000',
			key1: 111
		}
	});
});
