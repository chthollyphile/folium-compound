// \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t, t.exports), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = (n, r, o) => (o = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule || !a.call(n, "default") ? t(o, "default", {
	value: n,
	enumerable: !0
}) : o, n)), l = /* @__PURE__ */ o(((e) => {
	function t(e, t) {
		var n = e.length;
		e.push(t);
		a: for (; 0 < n;) {
			var r = n - 1 >>> 1, a = e[r];
			if (0 < i(a, t)) e[r] = t, e[n] = a, n = r;
			else break a;
		}
	}
	function n(e) {
		return e.length === 0 ? null : e[0];
	}
	function r(e) {
		if (e.length === 0) return null;
		var t = e[0], n = e.pop();
		if (n !== t) {
			e[0] = n;
			a: for (var r = 0, a = e.length, o = a >>> 1; r < o;) {
				var s = 2 * (r + 1) - 1, c = e[s], l = s + 1, u = e[l];
				if (0 > i(c, n)) l < a && 0 > i(u, c) ? (e[r] = u, e[l] = n, r = l) : (e[r] = c, e[s] = n, r = s);
				else if (l < a && 0 > i(u, n)) e[r] = u, e[l] = n, r = l;
				else break a;
			}
		}
		return t;
	}
	function i(e, t) {
		var n = e.sortIndex - t.sortIndex;
		return n === 0 ? e.id - t.id : n;
	}
	if (e.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
		var a = performance;
		e.unstable_now = function() {
			return a.now();
		};
	} else {
		var o = Date, s = o.now();
		e.unstable_now = function() {
			return o.now() - s;
		};
	}
	var c = [], l = [], u = 1, d = null, f = 3, p = !1, m = !1, h = !1, g = !1, _ = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, y = typeof setImmediate < "u" ? setImmediate : null;
	function b(e) {
		for (var i = n(l); i !== null;) {
			if (i.callback === null) r(l);
			else if (i.startTime <= e) r(l), i.sortIndex = i.expirationTime, t(c, i);
			else break;
			i = n(l);
		}
	}
	function x(e) {
		if (h = !1, b(e), !m) {
			if (n(c) !== null) m = !0, S || (S = !0, ee());
			else {
				var t = n(l);
				t !== null && re(x, t.startTime - e);
			}
		}
	}
	var S = !1, C = -1, w = 5, T = -1;
	function E() {
		return g ? !0 : !(e.unstable_now() - T < w);
	}
	function D() {
		if (g = !1, S) {
			var t = e.unstable_now();
			T = t;
			var i = !0;
			try {
				a: {
					m = !1, h && (h = !1, v(C), C = -1), p = !0;
					var a = f;
					try {
						b: {
							for (b(t), d = n(c); d !== null && !(d.expirationTime > t && E());) {
								var o = d.callback;
								if (typeof o == "function") {
									d.callback = null, f = d.priorityLevel;
									var s = o(d.expirationTime <= t);
									if (t = e.unstable_now(), typeof s == "function") {
										d.callback = s, b(t), i = !0;
										break b;
									}
									d === n(c) && r(c), b(t);
								} else r(c);
								d = n(c);
							}
							if (d !== null) i = !0;
							else {
								var u = n(l);
								u !== null && re(x, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? ee() : S = !1;
			}
		}
	}
	var ee;
	if (typeof y == "function") ee = function() {
		y(D);
	};
	else if (typeof MessageChannel < "u") {
		var te = new MessageChannel(), ne = te.port2;
		te.port1.onmessage = D, ee = function() {
			ne.postMessage(null);
		};
	} else ee = function() {
		_(D, 0);
	};
	function re(t, n) {
		C = _(function() {
			t(e.unstable_now());
		}, n);
	}
	e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
		e.callback = null;
	}, e.unstable_forceFrameRate = function(e) {
		0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : w = 0 < e ? Math.floor(1e3 / e) : 5;
	}, e.unstable_getCurrentPriorityLevel = function() {
		return f;
	}, e.unstable_next = function(e) {
		switch (f) {
			case 1:
			case 2:
			case 3:
				var t = 3;
				break;
			default: t = f;
		}
		var n = f;
		f = t;
		try {
			return e();
		} finally {
			f = n;
		}
	}, e.unstable_requestPaint = function() {
		g = !0;
	}, e.unstable_runWithPriority = function(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5: break;
			default: e = 3;
		}
		var n = f;
		f = e;
		try {
			return t();
		} finally {
			f = n;
		}
	}, e.unstable_scheduleCallback = function(r, i, a) {
		var o = e.unstable_now();
		switch (typeof a == "object" && a ? (a = a.delay, a = typeof a == "number" && 0 < a ? o + a : o) : a = o, r) {
			case 1:
				var s = -1;
				break;
			case 2:
				s = 250;
				break;
			case 5:
				s = 1073741823;
				break;
			case 4:
				s = 1e4;
				break;
			default: s = 5e3;
		}
		return s = a + s, r = {
			id: u++,
			callback: i,
			priorityLevel: r,
			startTime: a,
			expirationTime: s,
			sortIndex: -1
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(C), C = -1) : h = !0, re(x, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, S || (S = !0, ee()))), r;
	}, e.unstable_shouldYield = E, e.unstable_wrapCallback = function(e) {
		var t = f;
		return function() {
			var n = f;
			f = t;
			try {
				return e.apply(this, arguments);
			} finally {
				f = n;
			}
		};
	};
})), u = /* @__PURE__ */ o(((e, t) => {
	t.exports = l();
})), d = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), a = Symbol.for("react.profiler"), o = Symbol.for("react.consumer"), s = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), f = Symbol.for("react.activity"), p = Symbol.for("react.view_transition"), m = Symbol.iterator;
	function h(e) {
		return typeof e != "object" || !e ? null : (e = m && e[m] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var g = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, _ = Object.assign, v = {};
	function y(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	y.prototype.isReactComponent = {}, y.prototype.setState = function(e, t) {
		if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, e, t, "setState");
	}, y.prototype.forceUpdate = function(e) {
		this.updater.enqueueForceUpdate(this, e, "forceUpdate");
	};
	function b() {}
	b.prototype = y.prototype;
	function x(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	var S = x.prototype = new b();
	S.constructor = x, _(S, y.prototype), S.isPureReactComponent = !0;
	var C = Array.isArray;
	function w() {}
	var T = {
		H: null,
		A: null,
		T: null,
		S: null
	}, E = Object.prototype.hasOwnProperty;
	function D(e, n, r) {
		var i = r.ref;
		return {
			$$typeof: t,
			type: e,
			key: n,
			ref: i === void 0 ? null : i,
			props: r
		};
	}
	function ee(e, t) {
		return D(e.type, t, e.props);
	}
	function te(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}
	function ne(e) {
		var t = {
			"=": "=0",
			":": "=2"
		};
		return "$" + e.replace(/[=:]/g, function(e) {
			return t[e];
		});
	}
	var re = /\/+/g;
	function ie(e, t) {
		return typeof e == "object" && e && e.key != null ? ne("" + e.key) : t.toString(36);
	}
	function ae(e) {
		switch (e.status) {
			case "fulfilled": return e.value;
			case "rejected": throw e.reason;
			default: switch (typeof e.status == "string" ? e.then(w, w) : (e.status = "pending", e.then(function(t) {
				e.status === "pending" && (e.status = "fulfilled", e.value = t);
			}, function(t) {
				e.status === "pending" && (e.status = "rejected", e.reason = t);
			})), e.status) {
				case "fulfilled": return e.value;
				case "rejected": throw e.reason;
			}
		}
		throw e;
	}
	function oe(e, r, i, a, o) {
		var s = typeof e;
		(s === "undefined" || s === "boolean") && (e = null);
		var c = !1;
		if (e === null) c = !0;
		else switch (s) {
			case "bigint":
			case "string":
			case "number":
				c = !0;
				break;
			case "object": switch (e.$$typeof) {
				case t:
				case n:
					c = !0;
					break;
				case d: return c = e._init, oe(c(e._payload), r, i, a, o);
			}
		}
		if (c) return o = o(e), c = a === "" ? "." + ie(e, 0) : a, C(o) ? (i = "", c != null && (i = c.replace(re, "$&/") + "/"), oe(o, r, i, "", function(e) {
			return e;
		})) : o != null && (te(o) && (o = ee(o, i + (o.key == null || e && e.key === o.key ? "" : ("" + o.key).replace(re, "$&/") + "/") + c)), r.push(o)), 1;
		c = 0;
		var l = a === "" ? "." : a + ":";
		if (C(e)) for (var u = 0; u < e.length; u++) a = e[u], s = l + ie(a, u), c += oe(a, r, i, s, o);
		else if (u = h(e), typeof u == "function") for (e = u.call(e), u = 0; !(a = e.next()).done;) a = a.value, s = l + ie(a, u++), c += oe(a, r, i, s, o);
		else if (s === "object") {
			if (typeof e.then == "function") return oe(ae(e), r, i, a, o);
			throw r = String(e), Error("Objects are not valid as a React child (found: " + (r === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : r) + "). If you meant to render a collection of children, use an array instead.");
		}
		return c;
	}
	function O(e, t, n) {
		if (e == null) return e;
		var r = [], i = 0;
		return oe(e, r, "", "", function(e) {
			return t.call(n, e, i++);
		}), r;
	}
	function se(e) {
		if (e._status === -1) {
			var t = e._result, n = t();
			n.then(function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 1, e._result = t, n.status === void 0 && (n.status = "fulfilled", n.value = t));
			}, function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 2, e._result = t, n.status === void 0 && (n.status = "rejected", n.reason = t));
			}), e._status === -1 && (e._status = 0, e._result = n);
		}
		if (e._status === 1) return e._result.default;
		throw e._result;
	}
	var ce = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	};
	function le(e) {
		var t = T.T, n = {};
		n.types = t === null ? null : t.types, T.T = n;
		try {
			var r = e(), i = T.S;
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(w, ce);
		} catch (e) {
			ce(e);
		} finally {
			t !== null && n.types !== null && (t.types = n.types), T.T = t;
		}
	}
	function ue(e) {
		var t = T.T;
		if (t !== null) {
			var n = t.types;
			n === null ? t.types = [e] : n.indexOf(e) === -1 && n.push(e);
		} else le(ue.bind(null, e));
	}
	var de = {
		map: O,
		forEach: function(e, t, n) {
			O(e, function() {
				t.apply(this, arguments);
			}, n);
		},
		count: function(e) {
			var t = 0;
			return O(e, function() {
				t++;
			}), t;
		},
		toArray: function(e) {
			return O(e, function(e) {
				return e;
			}) || [];
		},
		only: function(e) {
			if (!te(e)) throw Error("React.Children.only expected to receive a single React element child.");
			return e;
		}
	};
	e.Activity = f, e.Children = de, e.Component = y, e.Fragment = r, e.Profiler = a, e.PureComponent = x, e.StrictMode = i, e.Suspense = l, e.ViewTransition = p, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = T, e.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(e) {
			return T.H.useMemoCache(e);
		}
	}, e.addTransitionType = ue, e.cache = function(e) {
		return function() {
			return e.apply(null, arguments);
		};
	}, e.cacheSignal = function() {
		return null;
	}, e.cloneElement = function(e, t, n) {
		if (e == null) throw Error("The argument must be a React element, but you passed " + e + ".");
		var r = _({}, e.props), i = e.key;
		if (t != null) for (a in t.key !== void 0 && (i = "" + t.key), t) !E.call(t, a) || a === "key" || a === "__self" || a === "__source" || a === "ref" && t.ref === void 0 || (r[a] = t[a]);
		var a = arguments.length - 2;
		if (a === 1) r.children = n;
		else if (1 < a) {
			for (var o = Array(a), s = 0; s < a; s++) o[s] = arguments[s + 2];
			r.children = o;
		}
		return D(e.type, i, r);
	}, e.createContext = function(e) {
		return e = {
			$$typeof: s,
			_currentValue: e,
			_currentValue2: e,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		}, e.Provider = e, e.Consumer = {
			$$typeof: o,
			_context: e
		}, e;
	}, e.createElement = function(e, t, n) {
		var r, i = {}, a = null;
		if (t != null) for (r in t.key !== void 0 && (a = "" + t.key), t) E.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (i[r] = t[r]);
		var o = arguments.length - 2;
		if (o === 1) i.children = n;
		else if (1 < o) {
			for (var s = Array(o), c = 0; c < o; c++) s[c] = arguments[c + 2];
			i.children = s;
		}
		if (e && e.defaultProps) for (r in o = e.defaultProps, o) i[r] === void 0 && (i[r] = o[r]);
		return D(e, a, i);
	}, e.createRef = function() {
		return { current: null };
	}, e.forwardRef = function(e) {
		return {
			$$typeof: c,
			render: e
		};
	}, e.isValidElement = te, e.lazy = function(e) {
		return {
			$$typeof: d,
			_payload: {
				_status: -1,
				_result: e
			},
			_init: se
		};
	}, e.memo = function(e, t) {
		return {
			$$typeof: u,
			type: e,
			compare: t === void 0 ? null : t
		};
	}, e.startTransition = le, e.unstable_useCacheRefresh = function() {
		return T.H.useCacheRefresh();
	}, e.use = function(e) {
		return T.H.use(e);
	}, e.useActionState = function(e, t, n) {
		return T.H.useActionState(e, t, n);
	}, e.useCallback = function(e, t) {
		return T.H.useCallback(e, t);
	}, e.useContext = function(e) {
		return T.H.useContext(e);
	}, e.useDebugValue = function() {}, e.useDeferredValue = function(e, t) {
		return T.H.useDeferredValue(e, t);
	}, e.useEffect = function(e, t) {
		return T.H.useEffect(e, t);
	}, e.useEffectEvent = function(e) {
		return T.H.useEffectEvent(e);
	}, e.useId = function() {
		return T.H.useId();
	}, e.useImperativeHandle = function(e, t, n) {
		return T.H.useImperativeHandle(e, t, n);
	}, e.useInsertionEffect = function(e, t) {
		return T.H.useInsertionEffect(e, t);
	}, e.useLayoutEffect = function(e, t) {
		return T.H.useLayoutEffect(e, t);
	}, e.useMemo = function(e, t) {
		return T.H.useMemo(e, t);
	}, e.useOptimistic = function(e, t) {
		return T.H.useOptimistic(e, t);
	}, e.useReducer = function(e, t, n) {
		return T.H.useReducer(e, t, n);
	}, e.useRef = function(e) {
		return T.H.useRef(e);
	}, e.useState = function(e) {
		return T.H.useState(e);
	}, e.useSyncExternalStore = function(e, t, n) {
		return T.H.useSyncExternalStore(e, t, n);
	}, e.useTransition = function() {
		return T.H.useTransition();
	}, e.version = "19.3.1";
})), f = /* @__PURE__ */ o(((e, t) => {
	t.exports = d();
})), p = /* @__PURE__ */ o(((e) => {
	var t = f();
	function n(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function r() {}
	var i = {
		d: {
			f: r,
			r: function() {
				throw Error(n(522));
			},
			D: r,
			C: r,
			L: r,
			m: r,
			X: r,
			S: r,
			M: r
		},
		p: 0,
		findDOMNode: null
	}, a = Symbol.for("react.portal"), o = Symbol.for("react.recoverable"), s = Symbol.for("react.optimistic_key");
	function c(e, t, n) {
		var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
		return {
			$$typeof: a,
			key: r == null ? null : r === s ? s : "" + r,
			children: e,
			containerInfo: t,
			implementation: n
		};
	}
	var l = t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
	function u(e, t) {
		if (e === "font") return "";
		if (typeof t == "string") return t === "use-credentials" ? t : "";
	}
	e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i, e.browser = function(e) {
		return {
			$$typeof: o,
			_reason: e
		};
	}, e.createPortal = function(e, t) {
		var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
		if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error(n(299));
		return c(e, t, null, r);
	}, e.flushSync = function(e) {
		var t = l.T, n = i.p;
		try {
			if (l.T = null, i.p = 2, e) return e();
		} finally {
			l.T = t, i.p = n, i.d.f();
		}
	}, e.preconnect = function(e, t) {
		typeof e == "string" && (t ? (t = t.crossOrigin, t = typeof t == "string" ? t === "use-credentials" ? t : "" : void 0) : t = null, i.d.C(e, t));
	}, e.prefetchDNS = function(e) {
		typeof e == "string" && i.d.D(e);
	}, e.preinit = function(e, t) {
		if (typeof e == "string" && t && typeof t.as == "string") {
			var n = t.as, r = u(n, t.crossOrigin), a = typeof t.integrity == "string" ? t.integrity : void 0, o = typeof t.fetchPriority == "string" ? t.fetchPriority : void 0;
			n === "style" ? i.d.S(e, typeof t.precedence == "string" ? t.precedence : void 0, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o
			}) : n === "script" && i.d.X(e, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0
			});
		}
	}, e.preinitModule = function(e, t) {
		if (typeof e == "string") {
			if (typeof t == "object" && t) {
				if (t.as == null || t.as === "script") {
					var n = u(t.as, t.crossOrigin);
					i.d.M(e, {
						crossOrigin: n,
						integrity: typeof t.integrity == "string" ? t.integrity : void 0,
						nonce: typeof t.nonce == "string" ? t.nonce : void 0,
						fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
					});
				}
			} else t ?? i.d.M(e);
		}
	}, e.preload = function(e, t) {
		if (typeof e == "string" && typeof t == "object" && t && typeof t.as == "string") {
			var n = t.as, r = u(n, t.crossOrigin);
			i.d.L(e, n, {
				crossOrigin: r,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				type: typeof t.type == "string" ? t.type : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0,
				referrerPolicy: typeof t.referrerPolicy == "string" ? t.referrerPolicy : void 0,
				imageSrcSet: typeof t.imageSrcSet == "string" ? t.imageSrcSet : void 0,
				imageSizes: typeof t.imageSizes == "string" ? t.imageSizes : void 0,
				media: typeof t.media == "string" ? t.media : void 0
			});
		}
	}, e.preloadModule = function(e, t) {
		if (typeof e == "string") {
			if (t) {
				var n = u(t.as, t.crossOrigin);
				i.d.m(e, {
					as: typeof t.as == "string" && t.as !== "script" ? t.as : void 0,
					crossOrigin: n,
					integrity: typeof t.integrity == "string" ? t.integrity : void 0,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0,
					fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
				});
			} else i.d.m(e);
		}
	}, e.requestFormReset = function(e) {
		i.d.r(e);
	}, e.unstable_batchedUpdates = function(e, t) {
		return e(t);
	}, e.useFormState = function(e, t, n) {
		return l.H.useFormState(e, t, n);
	}, e.useFormStatus = function() {
		return l.H.useHostTransitionStatus();
	}, e.version = "19.3.1";
})), m = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = p();
})), h = /* @__PURE__ */ o(((e) => {
	var t = u(), n = f(), r = m();
	function i(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function a(e) {
		return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
	}
	function o(e) {
		for (var t = e, n = t; n && !n.alternate;) t = n, t.flags & 4098 && (e = t.return), n = t.return;
		for (; t.return;) t = t.return;
		return t.tag === 3 ? e : null;
	}
	function s(e) {
		if (e.tag === 13) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function c(e) {
		if (e.tag === 31) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function l(e) {
		if (o(e) !== e) throw Error(i(188));
	}
	function d(e) {
		var t = e.alternate;
		if (!t) {
			if (t = o(e), t === null) throw Error(i(188));
			return t === e ? e : null;
		}
		for (var n = e, r = t;;) {
			var a = n.return;
			if (a === null) break;
			var s = a.alternate;
			if (s === null) {
				if (r = a.return, r !== null) {
					n = r;
					continue;
				}
				break;
			}
			if (a.child === s.child) {
				for (s = a.child; s;) {
					if (s === n) return l(a), e;
					if (s === r) return l(a), t;
					s = s.sibling;
				}
				throw Error(i(188));
			}
			if (n.return !== r.return) n = a, r = s;
			else {
				for (var c = !1, u = a.child; u;) {
					if (u === n) {
						c = !0, n = a, r = s;
						break;
					}
					if (u === r) {
						c = !0, r = a, n = s;
						break;
					}
					u = u.sibling;
				}
				if (!c) {
					for (u = s.child; u;) {
						if (u === n) {
							c = !0, n = s, r = a;
							break;
						}
						if (u === r) {
							c = !0, r = s, n = a;
							break;
						}
						u = u.sibling;
					}
					if (!c) throw Error(i(189));
				}
			}
			if (n.alternate !== r) throw Error(i(190));
		}
		if (n.tag !== 3) throw Error(i(188));
		return n.stateNode.current === n ? e : t;
	}
	function p(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e;
		for (e = e.child; e !== null;) {
			if (t = p(e), t !== null) return t;
			e = e.sibling;
		}
		return null;
	}
	function h(e, t, n, r, i, a) {
		for (; e !== null;) {
			if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && n(e, r, i, a) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && h(e.child, t, n, r, i, a)) return !0;
			e = e.sibling;
		}
		return !1;
	}
	function g(e) {
		for (e = e.return; e !== null;) {
			if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
			e = e.return;
		}
		return null;
	}
	function _(e) {
		var t = !1;
		for (e = e.return; e !== null && (e.tag === 4 && (t = !0), e.tag !== 3 && e.tag !== 5 && e.tag !== 27);) e = e.return;
		return t;
	}
	function v(e) {
		var t = [null, null], n = g(e);
		return n === null || y(t, e, n.child, { foundSelf: !1 }), t;
	}
	function y(e, t, n, r) {
		for (; n !== null;) {
			if (n === t) r.foundSelf = !0;
			else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
				if (r.foundSelf) return e[1] = n, !0;
				e[0] = n;
			} else if ((n.tag !== 22 || n.memoizedState === null) && y(e, t, n.child, r)) return !0;
			n = n.sibling;
		}
		return !1;
	}
	function b(e) {
		switch (e.tag) {
			case 5:
			case 27:
			case 6: return e.stateNode;
			case 3: return e.stateNode.containerInfo;
			default: throw Error(i(559));
		}
	}
	var x = null, S = null;
	function C(e, t, n) {
		return e === n || e === t && (x = e, !0);
	}
	function w(e, t, n) {
		return e === n ? (S = e, !1) : e === t && (S !== null && (x = e), !0);
	}
	function T(e) {
		if (e === null) return null;
		do
			e = e === null ? null : e.return;
		while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
		return e || null;
	}
	function E(e, t, n) {
		for (var r = 0, i = e; i; i = n(i)) r++;
		i = 0;
		for (var a = t; a; a = n(a)) i++;
		for (; 0 < r - i;) e = n(e), r--;
		for (; 0 < i - r;) t = n(t), i--;
		for (; r--;) {
			if (e === t || t !== null && e === t.alternate) return e;
			e = n(e), t = n(t);
		}
		return null;
	}
	var D = Object.assign, ee = Symbol.for("react.element"), te = Symbol.for("react.transitional.element"), ne = Symbol.for("react.portal"), re = Symbol.for("react.fragment"), ie = Symbol.for("react.strict_mode"), ae = Symbol.for("react.profiler"), oe = Symbol.for("react.consumer"), O = Symbol.for("react.context"), se = Symbol.for("react.forward_ref"), ce = Symbol.for("react.suspense"), le = Symbol.for("react.suspense_list"), ue = Symbol.for("react.memo"), de = Symbol.for("react.lazy"), fe = Symbol.for("react.activity"), pe = Symbol.for("react.legacy_hidden"), me = Symbol.for("react.memo_cache_sentinel"), he = Symbol.for("react.view_transition"), ge = Symbol.for("react.recoverable"), _e = Symbol.iterator;
	function ve(e) {
		return typeof e != "object" || !e ? null : (e = _e && e[_e] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var ye = Symbol.for("react.client.reference");
	function be(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === ye ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case re: return "Fragment";
			case ae: return "Profiler";
			case ie: return "StrictMode";
			case ce: return "Suspense";
			case le: return "SuspenseList";
			case fe: return "Activity";
			case he: return "ViewTransition";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case ne: return "Portal";
			case O: return e.displayName || "Context";
			case oe: return (e._context.displayName || "Context") + ".Consumer";
			case se:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case ue: return t = e.displayName || null, t === null ? be(e.type) || "Memo" : t;
			case de:
				t = e._payload, e = e._init;
				try {
					return be(e(t));
				} catch {}
		}
		return null;
	}
	var xe = Array.isArray, k = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, A = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Se = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, Ce = [], we = -1;
	function Te(e) {
		return { current: e };
	}
	function Ee(e) {
		0 > we || (e.current = Ce[we], Ce[we] = null, we--);
	}
	function De(e, t) {
		we++, Ce[we] = e.current, e.current = t;
	}
	var Oe = Te(null), ke = Te(null), Ae = Te(null), je = Te(null);
	function Me(e, t) {
		switch (De(Ae, t), De(ke, e), De(Oe, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? up(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = up(t), e = dp(t, e);
			else switch (e) {
				case "svg":
					e = 1;
					break;
				case "math":
					e = 2;
					break;
				default: e = 0;
			}
		}
		Ee(Oe), De(Oe, e);
	}
	function Ne() {
		Ee(Oe), Ee(ke), Ee(Ae);
	}
	function Pe(e) {
		var t = e.memoizedState;
		t !== null && (sh._currentValue = t.memoizedState, De(je, e)), t = Oe.current;
		var n = dp(t, e.type);
		t !== n && (De(ke, e), De(Oe, n));
	}
	function Fe(e) {
		ke.current === e && (Ee(Oe), Ee(ke)), je.current === e && (Ee(je), sh._currentValue = Se);
	}
	var Ie, Le;
	function Re(e) {
		if (Ie === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			Ie = t && t[1] || "", Le = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + Ie + e + Le;
	}
	var ze = !1;
	function Be(e, t) {
		if (!e || ze) return "";
		ze = !0;
		var n = Error.prepareStackTrace;
		Error.prepareStackTrace = void 0;
		try {
			var r = { DetermineComponentFrameRoot: function() {
				try {
					if (t) {
						var n = function() {
							throw Error();
						};
						if (Object.defineProperty(n.prototype, "props", { set: function() {
							throw Error();
						} }), typeof Reflect == "object" && Reflect.construct) {
							try {
								Reflect.construct(n, []);
							} catch (e) {
								var r = e;
							}
							Reflect.construct(e, [], n);
						} else {
							try {
								n.call();
							} catch (e) {
								r = e;
							}
							n = !1;
							try {
								var i = Object.getOwnPropertyDescriptor(e.prototype, "props");
								Object.defineProperty(e.prototype, "props", {
									configurable: !0,
									set: function() {
										throw Error();
									}
								}), n = !0, new e();
							} finally {
								n && (i === void 0 ? delete e.prototype.props : Object.defineProperty(e.prototype, "props", i));
							}
						}
					} else {
						try {
							throw Error();
						} catch (e) {
							r = e;
						}
						(n = e()) && typeof n.catch == "function" && n.catch(function() {});
					}
				} catch (e) {
					if (e && r && typeof e.stack == "string") return [e.stack, r.stack];
				}
				return [null, null];
			} };
			r.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
			var i = Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot, "name");
			i && i.configurable && Object.defineProperty(r.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
			var a = r.DetermineComponentFrameRoot(), o = a[0], s = a[1];
			if (o && s) {
				var c = o.split("\n"), l = s.split("\n");
				for (i = r = 0; r < c.length && !c[r].includes("DetermineComponentFrameRoot");) r++;
				for (; i < l.length && !l[i].includes("DetermineComponentFrameRoot");) i++;
				if (r === c.length || i === l.length) for (r = c.length - 1, i = l.length - 1; 1 <= r && 0 <= i && c[r] !== l[i];) i--;
				for (; 1 <= r && 0 <= i; r--, i--) if (c[r] !== l[i]) {
					if (r !== 1 || i !== 1) do
						if (r--, i--, 0 > i || c[r] !== l[i]) {
							var u = "\n" + c[r].replace(" at new ", " at ");
							return e.displayName && u.includes("<anonymous>") && (u = u.replace("<anonymous>", e.displayName)), u;
						}
					while (1 <= r && 0 <= i);
					break;
				}
			}
		} finally {
			ze = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? Re(n) : "";
	}
	function Ve(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return Re(e.type);
			case 16: return Re("Lazy");
			case 13: return e.child !== t && t !== null ? Re("Suspense Fallback") : Re("Suspense");
			case 19: return Re("SuspenseList");
			case 0:
			case 15: return Be(e.type, !1);
			case 11: return Be(e.type.render, !1);
			case 1: return Be(e.type, !0);
			case 31: return Re("Activity");
			case 30: return Re("ViewTransition");
			default: return "";
		}
	}
	function He(e) {
		try {
			var t = "", n = null;
			do
				t += Ve(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var Ue = Object.prototype.hasOwnProperty, We = t.unstable_scheduleCallback, Ge = t.unstable_cancelCallback, Ke = t.unstable_shouldYield, qe = t.unstable_requestPaint, Je = t.unstable_now, Ye = t.unstable_getCurrentPriorityLevel, Xe = t.unstable_ImmediatePriority, Ze = t.unstable_UserBlockingPriority, Qe = t.unstable_NormalPriority, $e = t.unstable_LowPriority, et = t.unstable_IdlePriority, tt = t.log, nt = t.unstable_setDisableYieldValue, rt = null, it = null;
	function at(e) {
		if (typeof tt == "function" && nt(e), it && typeof it.setStrictMode == "function") try {
			it.setStrictMode(rt, e);
		} catch {}
	}
	var ot = Math.clz32 ? Math.clz32 : lt, st = Math.log, ct = Math.LN2;
	function lt(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (st(e) / ct | 0) | 0;
	}
	var ut = 256, dt = 262144, ft = 4194304;
	function pt(e) {
		var t = e & 42;
		if (t !== 0) return t;
		switch (e & -e) {
			case 1: return 1;
			case 2: return 2;
			case 4: return 4;
			case 8: return 8;
			case 16: return 16;
			case 32: return 32;
			case 64: return 64;
			case 128: return 128;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072: return e & -e;
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return e & 3932160;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return e & 62914560;
			case 67108864: return 67108864;
			case 134217728: return 134217728;
			case 268435456: return 268435456;
			case 536870912: return 536870912;
			case 1073741824: return 0;
			default: return e;
		}
	}
	function mt(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = pt(n))) : i = pt(o) : i = pt(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = pt(n))) : i = pt(o)) : i = pt(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function ht(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function gt(e, t) {
		t & 8 && (t |= t & 32);
		var n = e.entangledLanes;
		if (n !== 0) for (e = e.entanglements, n &= t; 0 < n;) {
			var r = 31 - ot(n), i = 1 << r;
			t |= e[r], n &= ~i;
		}
		return t;
	}
	function _t(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 4:
			case 8:
			case 64: return t + 250;
			case 16:
			case 32:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return t + 5e3;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return -1;
			case 67108864:
			case 134217728:
			case 268435456:
			case 536870912:
			case 1073741824: return -1;
			default: return -1;
		}
	}
	function vt() {
		var e = ft;
		return ft <<= 1, !(ft & 62914560) && (ft = 4194304), e;
	}
	function yt(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function bt(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function j(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - ot(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && xt(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function xt(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - ot(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function St(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - ot(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function Ct(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : wt(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function wt(e) {
		switch (e) {
			case 2:
				e = 1;
				break;
			case 8:
				e = 4;
				break;
			case 32:
				e = 16;
				break;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152:
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
				e = 128;
				break;
			case 268435456:
				e = 134217728;
				break;
			default: e = 0;
		}
		return e;
	}
	function Tt(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function Et() {
		var e = A.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : Ch(e.type)) : e;
	}
	function Dt(e, t) {
		var n = A.p;
		try {
			return A.p = e, t();
		} finally {
			A.p = n;
		}
	}
	var Ot = Math.random().toString(36).slice(2), kt = "__reactFiber$" + Ot, At = "__reactProps$" + Ot, jt = "__reactContainer$" + Ot, Mt = "__reactEvents$" + Ot, Nt = "__reactListeners$" + Ot, Pt = "__reactHandles$" + Ot, Ft = "__reactResources$" + Ot, It = "__reactMarker$" + Ot, Lt = "__reactLoad$" + Ot;
	function Rt(e) {
		delete e[kt], delete e[At], delete e[Nt], delete e[Pt];
	}
	function zt(e) {
		var t;
		if (t = e[kt]) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[jt] || n[kt]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = fm(e); e !== null;) {
					if (n = e[kt]) return n;
					e = fm(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function Bt(e) {
		if (e = e[kt] || e[jt]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function Vt(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(i(33));
	}
	function Ht(e) {
		var t = e[Ft];
		return t ||= e[Ft] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function Ut(e) {
		e[It] = !0;
	}
	function Wt(e) {
		e[Lt] = void 0;
	}
	var Gt = /* @__PURE__ */ new Set(), Kt = {};
	function qt(e, t) {
		M(e, t), M(e + "Capture", t);
	}
	function M(e, t) {
		for (Kt[e] = t, e = 0; e < t.length; e++) Gt.add(t[e]);
	}
	var Jt = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Yt = {}, Xt = {};
	function Zt(e) {
		return Ue.call(Xt, e) ? !0 : Ue.call(Yt, e) ? !1 : Jt.test(e) ? Xt[e] = !0 : (Yt[e] = !0, !1);
	}
	var N = !1;
	function Qt() {
		var e = N;
		return N = !1, e;
	}
	function $t(e, t, n) {
		if (Zt(t)) {
			if (n === null) e.removeAttribute(t);
			else {
				switch (typeof n) {
					case "undefined":
					case "function":
					case "symbol":
						e.removeAttribute(t);
						return;
					case "boolean":
						var r = t.toLowerCase().slice(0, 5);
						if (r !== "data-" && r !== "aria-") {
							e.removeAttribute(t);
							return;
						}
				}
				e.setAttribute(t, n);
			}
		}
	}
	function en(e, t, n) {
		if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(t);
					return;
			}
			e.setAttribute(t, n);
		}
	}
	function tn(e, t, n, r) {
		if (r === null) e.removeAttribute(n);
		else {
			switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(n);
					return;
			}
			e.setAttributeNS(t, n, r);
		}
	}
	function nn(e) {
		switch (typeof e) {
			case "bigint":
			case "boolean":
			case "number":
			case "string":
			case "undefined": return e;
			case "object": return e;
			default: return "";
		}
	}
	function rn(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function an(e, t, n) {
		var r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
		if (!e.hasOwnProperty(t) && r !== void 0 && typeof r.get == "function" && typeof r.set == "function") {
			var i = r.get, a = r.set;
			return Object.defineProperty(e, t, {
				configurable: !0,
				get: function() {
					return i.call(this);
				},
				set: function(e) {
					n = "" + e, a.call(this, e);
				}
			}), Object.defineProperty(e, t, { enumerable: r.enumerable }), {
				getValue: function() {
					return n;
				},
				setValue: function(e) {
					n = "" + e;
				},
				stopTracking: function() {
					e._valueTracker = null, delete e[t];
				}
			};
		}
	}
	function on(e) {
		if (!e._valueTracker) {
			var t = rn(e) ? "checked" : "value";
			e._valueTracker = an(e, t, "" + e[t]);
		}
	}
	function sn(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = rn(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n && (t.setValue(e), !0);
	}
	var cn = /[\n"\\]/g;
	function P(e) {
		return e.replace(cn, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function ln(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + nn(t)) : e.value !== "" + nn(t) && (e.value = "" + nn(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : dn(e, nn(n)) : o === "number" && e.value == t ? dn(e, nn(e.value)) : dn(e, nn(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + nn(s) : e.removeAttribute("name");
	}
	function un(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				on(e);
				return;
			}
			n = n == null ? "" : "" + nn(n), t = t == null ? n : "" + nn(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), on(e);
	}
	function dn(e, t) {
		e.defaultValue !== "" + t && (e.defaultValue = "" + t);
	}
	function fn(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + nn(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function pn(e, t, n) {
		t != null && (t = "" + nn(t), t !== e.value && (e.value = t), n == null) ? e.defaultValue !== t && (e.defaultValue = t) : e.defaultValue = n == null ? "" : "" + nn(n);
	}
	function mn(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(i(92));
				if (xe(r)) {
					if (1 < r.length) throw Error(i(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = nn(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), on(e);
	}
	function hn(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var gn = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function _n(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || gn.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function vn(e, t, n) {
		if (t != null && typeof t != "object") throw Error(i(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "", N = !0);
			for (var a in t) r = t[a], t.hasOwnProperty(a) && n[a] !== r && (_n(e, a, r), N = !0);
		} else for (var o in t) t.hasOwnProperty(o) && _n(e, o, t[o]);
	}
	function yn(e) {
		if (e.indexOf("-") === -1) return !1;
		switch (e) {
			case "annotation-xml":
			case "color-profile":
			case "font-face":
			case "font-face-src":
			case "font-face-uri":
			case "font-face-format":
			case "font-face-name":
			case "missing-glyph": return !1;
			default: return !0;
		}
	}
	var bn = /* @__PURE__ */ new Map([
		["acceptCharset", "accept-charset"],
		["htmlFor", "for"],
		["httpEquiv", "http-equiv"],
		["crossOrigin", "crossorigin"],
		["accentHeight", "accent-height"],
		["alignmentBaseline", "alignment-baseline"],
		["arabicForm", "arabic-form"],
		["baselineShift", "baseline-shift"],
		["capHeight", "cap-height"],
		["clipPath", "clip-path"],
		["clipRule", "clip-rule"],
		["colorInterpolation", "color-interpolation"],
		["colorInterpolationFilters", "color-interpolation-filters"],
		["colorProfile", "color-profile"],
		["colorRendering", "color-rendering"],
		["dominantBaseline", "dominant-baseline"],
		["enableBackground", "enable-background"],
		["fillOpacity", "fill-opacity"],
		["fillRule", "fill-rule"],
		["floodColor", "flood-color"],
		["floodOpacity", "flood-opacity"],
		["fontFamily", "font-family"],
		["fontSize", "font-size"],
		["fontSizeAdjust", "font-size-adjust"],
		["fontStretch", "font-stretch"],
		["fontStyle", "font-style"],
		["fontVariant", "font-variant"],
		["fontWeight", "font-weight"],
		["glyphName", "glyph-name"],
		["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
		["glyphOrientationVertical", "glyph-orientation-vertical"],
		["horizAdvX", "horiz-adv-x"],
		["horizOriginX", "horiz-origin-x"],
		["imageRendering", "image-rendering"],
		["letterSpacing", "letter-spacing"],
		["lightingColor", "lighting-color"],
		["markerEnd", "marker-end"],
		["markerMid", "marker-mid"],
		["markerStart", "marker-start"],
		["maskType", "mask-type"],
		["overlinePosition", "overline-position"],
		["overlineThickness", "overline-thickness"],
		["paintOrder", "paint-order"],
		["panose-1", "panose-1"],
		["pointerEvents", "pointer-events"],
		["renderingIntent", "rendering-intent"],
		["shapeRendering", "shape-rendering"],
		["stopColor", "stop-color"],
		["stopOpacity", "stop-opacity"],
		["strikethroughPosition", "strikethrough-position"],
		["strikethroughThickness", "strikethrough-thickness"],
		["strokeDasharray", "stroke-dasharray"],
		["strokeDashoffset", "stroke-dashoffset"],
		["strokeLinecap", "stroke-linecap"],
		["strokeLinejoin", "stroke-linejoin"],
		["strokeMiterlimit", "stroke-miterlimit"],
		["strokeOpacity", "stroke-opacity"],
		["strokeWidth", "stroke-width"],
		["textAnchor", "text-anchor"],
		["textDecoration", "text-decoration"],
		["textRendering", "text-rendering"],
		["transformOrigin", "transform-origin"],
		["underlinePosition", "underline-position"],
		["underlineThickness", "underline-thickness"],
		["unicodeBidi", "unicode-bidi"],
		["unicodeRange", "unicode-range"],
		["unitsPerEm", "units-per-em"],
		["vAlphabetic", "v-alphabetic"],
		["vHanging", "v-hanging"],
		["vIdeographic", "v-ideographic"],
		["vMathematical", "v-mathematical"],
		["vectorEffect", "vector-effect"],
		["vertAdvY", "vert-adv-y"],
		["vertOriginX", "vert-origin-x"],
		["vertOriginY", "vert-origin-y"],
		["wordSpacing", "word-spacing"],
		["writingMode", "writing-mode"],
		["xmlnsXlink", "xmlns:xlink"],
		["xHeight", "x-height"]
	]), xn = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function Sn(e) {
		return xn.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function Cn() {}
	var F = null;
	function wn(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var Tn = null, En = null;
	function Dn(e) {
		var t = Bt(e);
		if (t && (e = t.stateNode)) {
			var n = e[At] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (ln(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + P("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var a = r[At] || null;
								if (!a) throw Error(i(90));
								ln(r, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && sn(r);
					}
					break a;
				case "textarea":
					pn(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && fn(e, !!n.multiple, t, !1);
			}
		}
	}
	var On = !1;
	function kn(e, t, n) {
		if (On) return e(t, n);
		On = !0;
		try {
			return e(t);
		} finally {
			if (On = !1, (Tn !== null || En !== null) && (Ld(), Tn && (t = Tn, e = En, En = Tn = null, Dn(t), e))) for (t = 0; t < e.length; t++) Dn(e[t]);
		}
	}
	function An(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[At] || null;
		if (r === null) return null;
		n = r[t];
		a: switch (t) {
			case "onClick":
			case "onClickCapture":
			case "onDoubleClick":
			case "onDoubleClickCapture":
			case "onMouseDown":
			case "onMouseDownCapture":
			case "onMouseMove":
			case "onMouseMoveCapture":
			case "onMouseUp":
			case "onMouseUpCapture":
			case "onMouseEnter":
				(r = !r.disabled) || (e = e.type, r = e !== "button" && e !== "input" && e !== "select" && e !== "textarea"), e = !r;
				break a;
			default: e = !1;
		}
		if (e) return null;
		if (n && typeof n != "function") throw Error(i(231, t, typeof n));
		return n;
	}
	var jn = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, Mn = !1;
	if (jn) try {
		var Nn = {};
		Object.defineProperty(Nn, "passive", { get: function() {
			Mn = !0;
		} }), window.addEventListener("test", Nn, Nn), window.removeEventListener("test", Nn, Nn);
	} catch {
		Mn = !1;
	}
	var Pn = null, Fn = null, In = null;
	function Ln() {
		if (In) return In;
		var e, t = Fn, n = t.length, r, i = "value" in Pn ? Pn.value : Pn.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return In = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function Rn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function zn() {
		return !0;
	}
	function Bn() {
		return !1;
	}
	function Vn(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? zn : Bn, this.isPropagationStopped = Bn, this;
		}
		return D(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = zn);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = zn);
			},
			persist: function() {},
			isPersistent: zn
		}), t;
	}
	var Hn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, Un = Vn(Hn), Wn = D({}, Hn, {
		view: 0,
		detail: 0
	}), Gn = Vn(Wn), Kn, qn, Jn, Yn = D({}, Wn, {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		getModifierState: or,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== Jn && (Jn && e.type === "mousemove" ? (Kn = e.screenX - Jn.screenX, qn = e.screenY - Jn.screenY) : qn = Kn = 0, Jn = e), Kn);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : qn;
		}
	}), Xn = Vn(Yn), Zn = Vn(D({}, Yn, { dataTransfer: 0 })), Qn = Vn(D({}, Wn, { relatedTarget: 0 })), $n = Vn(D({}, Hn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), er = Vn(D({}, Hn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), tr = Vn(D({}, Hn, { data: 0 })), nr = {
		Esc: "Escape",
		Spacebar: " ",
		Left: "ArrowLeft",
		Up: "ArrowUp",
		Right: "ArrowRight",
		Down: "ArrowDown",
		Del: "Delete",
		Win: "OS",
		Menu: "ContextMenu",
		Apps: "ContextMenu",
		Scroll: "ScrollLock",
		MozPrintableKey: "Unidentified"
	}, rr = {
		8: "Backspace",
		9: "Tab",
		12: "Clear",
		13: "Enter",
		16: "Shift",
		17: "Control",
		18: "Alt",
		19: "Pause",
		20: "CapsLock",
		27: "Escape",
		32: " ",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "ArrowLeft",
		38: "ArrowUp",
		39: "ArrowRight",
		40: "ArrowDown",
		45: "Insert",
		46: "Delete",
		112: "F1",
		113: "F2",
		114: "F3",
		115: "F4",
		116: "F5",
		117: "F6",
		118: "F7",
		119: "F8",
		120: "F9",
		121: "F10",
		122: "F11",
		123: "F12",
		144: "NumLock",
		145: "ScrollLock",
		224: "Meta"
	}, ir = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function ar(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = ir[e]) ? !!t[e] : !1;
	}
	function or() {
		return ar;
	}
	var sr = Vn(D({}, Wn, {
		key: function(e) {
			if (e.key) {
				var t = nr[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = Rn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? rr[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: or,
		charCode: function(e) {
			return e.type === "keypress" ? Rn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? Rn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), cr = Vn(D({}, Yn, {
		pointerId: 0,
		width: 0,
		height: 0,
		pressure: 0,
		tangentialPressure: 0,
		tiltX: 0,
		tiltY: 0,
		twist: 0,
		pointerType: 0,
		isPrimary: 0
	})), lr = Vn(D({}, Hn, { submitter: 0 })), ur = Vn(D({}, Wn, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: or
	})), dr = Vn(D({}, Hn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), fr = Vn(D({}, Yn, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), pr = Vn(D({}, Hn, {
		newState: 0,
		oldState: 0,
		source: 0
	})), mr = [
		9,
		13,
		27,
		32
	], hr = jn && "CompositionEvent" in window, gr = null;
	jn && "documentMode" in document && (gr = document.documentMode);
	var _r = jn && "TextEvent" in window && !gr, vr = jn && (!hr || gr && 8 < gr && 11 >= gr), yr = " ", I = !1;
	function br(e, t) {
		switch (e) {
			case "keyup": return mr.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function xr(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var Sr = !1;
	function Cr(e, t) {
		switch (e) {
			case "compositionend": return xr(t);
			case "keypress": return t.which === 32 ? (I = !0, yr) : null;
			case "textInput": return e = t.data, e === yr && I ? null : e;
			default: return null;
		}
	}
	function wr(e, t) {
		if (Sr) return e === "compositionend" || !hr && br(e, t) ? (e = Ln(), In = Fn = Pn = null, Sr = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return vr && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var Tr = {
		color: !0,
		date: !0,
		datetime: !0,
		"datetime-local": !0,
		email: !0,
		month: !0,
		number: !0,
		password: !0,
		range: !0,
		search: !0,
		tel: !0,
		text: !0,
		time: !0,
		url: !0,
		week: !0
	};
	function Er(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!Tr[e.type] : t === "textarea";
	}
	function Dr(e, t, n, r) {
		Tn ? En ? En.push(r) : En = [r] : Tn = r, t = qf(t, "onChange"), 0 < t.length && (n = new Un("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var Or = null, kr = null;
	function Ar(e) {
		Bf(e, 0);
	}
	function jr(e) {
		if (sn(Vt(e))) return e;
	}
	function Mr(e, t) {
		if (e === "change") return t;
	}
	var Nr = !1;
	if (jn) {
		var Pr;
		if (jn) {
			var Fr = "oninput" in document;
			if (!Fr) {
				var Ir = document.createElement("div");
				Ir.setAttribute("oninput", "return;"), Fr = typeof Ir.oninput == "function";
			}
			Pr = Fr;
		} else Pr = !1;
		Nr = Pr && (!document.documentMode || 9 < document.documentMode);
	}
	function Lr() {
		Or && (Or.detachEvent("onpropertychange", Rr), kr = Or = null);
	}
	function Rr(e) {
		if (e.propertyName === "value" && jr(kr)) {
			var t = [];
			Dr(t, kr, e, wn(e)), kn(Ar, t);
		}
	}
	function zr(e, t, n) {
		e === "focusin" ? (Lr(), Or = t, kr = n, Or.attachEvent("onpropertychange", Rr)) : e === "focusout" && Lr();
	}
	function Br(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return jr(kr);
	}
	function Vr(e, t) {
		if (e === "click") return jr(t);
	}
	function Hr(e, t) {
		if (e === "input" || e === "change") return jr(t);
	}
	function Ur(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var Wr = typeof Object.is == "function" ? Object.is : Ur;
	function Gr(e, t) {
		if (Wr(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!Ue.call(t, i) || !Wr(e[i], t[i])) return !1;
		}
		return !0;
	}
	function Kr(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	function qr(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function Jr(e, t) {
		var n = qr(e);
		e = 0;
		for (var r; n;) {
			if (n.nodeType === 3) {
				if (r = e + n.textContent.length, e <= t && r >= t) return {
					node: n,
					offset: t - e
				};
				e = r;
			}
			a: {
				for (; n;) {
					if (n.nextSibling) {
						n = n.nextSibling;
						break a;
					}
					n = n.parentNode;
				}
				n = void 0;
			}
			n = qr(n);
		}
	}
	function Yr(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Yr(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function Xr(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = Kr(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = Kr(e.document);
		}
		return t;
	}
	function L(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var Zr = jn && "documentMode" in document && 11 >= document.documentMode, Qr = null, $r = null, R = null, ei = !1;
	function ti(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		ei || Qr == null || Qr !== Kr(r) || (r = Qr, "selectionStart" in r && L(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), R && Gr(R, r) || (R = r, r = qf($r, "onSelect"), 0 < r.length && (t = new Un("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = Qr)));
	}
	function ni(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var ri = {
		animationend: ni("Animation", "AnimationEnd"),
		animationiteration: ni("Animation", "AnimationIteration"),
		animationstart: ni("Animation", "AnimationStart"),
		transitionrun: ni("Transition", "TransitionRun"),
		transitionstart: ni("Transition", "TransitionStart"),
		transitioncancel: ni("Transition", "TransitionCancel"),
		transitionend: ni("Transition", "TransitionEnd")
	}, ii = {}, ai = {};
	jn && (ai = document.createElement("div").style, "AnimationEvent" in window || (delete ri.animationend.animation, delete ri.animationiteration.animation, delete ri.animationstart.animation), "TransitionEvent" in window || delete ri.transitionend.transition);
	function oi(e) {
		if (ii[e]) return ii[e];
		if (!ri[e]) return e;
		var t = ri[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in ai) return ii[e] = t[n];
		return e;
	}
	var si = oi("animationend"), ci = oi("animationiteration"), li = oi("animationstart"), ui = oi("transitionrun"), di = oi("transitionstart"), fi = oi("transitioncancel"), pi = oi("transitionend"), mi = /* @__PURE__ */ new Map(), hi = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	hi.push("scrollEnd");
	function gi(e, t) {
		mi.set(e, t), qt(t, [e]);
	}
	var _i = 0;
	function vi(e, t) {
		if (e.name != null && e.name !== "auto") return e.name;
		if (t.autoName !== null) return t.autoName;
		e = vd.identifierPrefix;
		var n = _i++;
		return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
	}
	function yi(e) {
		if (e == null || typeof e == "string") return e;
		var t = null, n = Ed;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = e[n[r]];
			if (i != null) {
				if (i === "none") return "none";
				t = t == null ? i : t + (" " + i);
			}
		}
		return t ?? e.default;
	}
	function bi(e, t) {
		return e = yi(e), t = yi(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
	}
	var xi = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, Si = [], Ci = 0, wi = 0;
	function Ti() {
		for (var e = Ci, t = wi = Ci = 0; t < e;) {
			var n = Si[t];
			Si[t++] = null;
			var r = Si[t];
			Si[t++] = null;
			var i = Si[t];
			Si[t++] = null;
			var a = Si[t];
			if (Si[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && ki(n, i, a);
		}
	}
	function Ei(e, t, n, r) {
		Si[Ci++] = e, Si[Ci++] = t, Si[Ci++] = n, Si[Ci++] = r, wi |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function Di(e, t, n, r) {
		return Ei(e, t, n, r), Ai(e);
	}
	function Oi(e, t) {
		return Ei(e, null, null, t), Ai(e);
	}
	function ki(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - ot(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Ai(e) {
		if (50 < Dd) throw Dd = 0, Od = null, Error(i(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var ji = {};
	function Mi(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function z(e, t, n, r) {
		return new Mi(e, t, n, r);
	}
	function Ni(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function Pi(e, t) {
		var n = e.alternate;
		return n === null ? (n = z(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function Fi(e, t) {
		e.flags &= 1206910978;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function Ii(e, t, n, r, a, o) {
		var s = 0;
		if (r = e, typeof r == "function") Ni(r) && (s = 1);
		else if (typeof r == "string") s = qm(e, n, Oe.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (r) {
			case fe: return e = z(31, n, t, a), e.elementType = fe, e.lanes = o, e;
			case re: return Li(n.children, a, o, t);
			case ie:
				s = 8, a |= 24;
				break;
			case ae: return e = z(12, n, t, a | 2), e.elementType = ae, e.lanes = o, e;
			case ce: return e = z(13, n, t, a), e.elementType = ce, e.lanes = o, e;
			case le: return e = z(19, n, t, a), e.elementType = le, e.lanes = o, e;
			case pe:
			case he: return e = a | 32, e = z(30, n, t, e), e.elementType = he, e.lanes = o, e.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}, e;
			default:
				if (typeof r == "object" && r) switch (r.$$typeof) {
					case O:
						s = 10;
						break a;
					case oe:
						s = 9;
						break a;
					case se:
						s = 11;
						break a;
					case ue:
						s = 14;
						break a;
					case de:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(i(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = z(s, n, t, a), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function Li(e, t, n, r) {
		return e = z(7, e, r, t), e.lanes = n, e;
	}
	function Ri(e, t, n) {
		return e = z(6, e, null, t), e.lanes = n, e;
	}
	function zi(e) {
		var t = z(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function Bi(e, t, n) {
		return t = z(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var Vi = /* @__PURE__ */ new WeakMap();
	function Hi(e, t) {
		if (typeof e == "object" && e) {
			var n = Vi.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: He(t)
			}, Vi.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: He(t)
		};
	}
	var Ui = [], Wi = 0, Gi = null, Ki = 0, B = [], qi = 0, Ji = null, Yi = 1, Xi = "";
	function Zi(e, t) {
		Ui[Wi++] = Ki, Ui[Wi++] = Gi, Gi = e, Ki = t;
	}
	function Qi(e, t, n) {
		B[qi++] = Yi, B[qi++] = Xi, B[qi++] = Ji, Ji = e;
		var r = Yi;
		e = Xi;
		var i = 32 - ot(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - ot(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, Yi = 1 << 32 - ot(t) + i | n << i | r, Xi = a + e;
		} else Yi = 1 << a | n << i | r, Xi = e;
	}
	function $i(e) {
		e.return !== null && (Zi(e, 1), Qi(e, 1, 0));
	}
	function ea(e) {
		for (; e === Gi;) Gi = Ui[--Wi], Ui[Wi] = null, Ki = Ui[--Wi], Ui[Wi] = null;
		for (; e === Ji;) Ji = B[--qi], B[qi] = null, Xi = B[--qi], B[qi] = null, Yi = B[--qi], B[qi] = null;
	}
	function ta(e, t) {
		B[qi++] = Yi, B[qi++] = Xi, B[qi++] = Ji, Yi = t.id, Xi = t.overflow, Ji = e;
	}
	var na = null, ra = null, V = !1, ia = null, aa = !1, oa = Error(i(519));
	function sa(e) {
		throw pa(Hi(Error(i(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), oa;
	}
	function ca(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[kt] = e, t[At] = r, n) {
			case "dialog":
				$("cancel", t), $("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				$("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < Rf.length; n++) $(Rf[n], t);
				break;
			case "source":
				$("error", t);
				break;
			case "img":
			case "image":
			case "link":
				$("error", t), $("load", t);
				break;
			case "details":
				$("toggle", t);
				break;
			case "input":
				$("invalid", t), un(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				$("invalid", t);
				break;
			case "textarea": $("invalid", t), mn(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || $f(t.textContent, n) ? (r.popover != null && ($("beforetoggle", t), $("toggle", t)), r.onScroll != null && $("scroll", t), r.onScrollEnd != null && $("scrollend", t), r.onClick != null && (t.onclick = Cn), t = !0) : t = !1, t || sa(e, !0);
	}
	function la(e) {
		for (na = e.return; na;) switch (na.tag) {
			case 5:
			case 31:
			case 13:
				aa = !1;
				return;
			case 27:
			case 3:
				aa = !0;
				return;
			default: na = na.return;
		}
	}
	function ua(e) {
		if (e !== na) return !1;
		if (!V) return la(e), V = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = n === "form" || n === "button" || pp(e.type, e.memoizedProps)), n = !n), n && ra && sa(e), la(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			ra = dm(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			ra = dm(e);
		} else t === 27 ? (t = ra, Sp(e.type) ? (e = um, um = null, ra = e) : ra = t) : ra = na ? lm(e.stateNode.nextSibling) : null;
		return !0;
	}
	function da() {
		ra = na = null, V = !1;
	}
	function fa() {
		var e = ia;
		return e !== null && (ud === null ? ud = e : ud.push.apply(ud, e), ia = null), e;
	}
	function pa(e) {
		ia === null ? ia = [e] : ia.push(e);
	}
	var ma = Te(null), ha = null, ga = null;
	function _a(e, t, n) {
		De(ma, t._currentValue), t._currentValue = n;
	}
	function va(e) {
		e._currentValue = ma.current, Ee(ma);
	}
	function ya(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function ba(e, t, n, r) {
		var a = e.child;
		for (a !== null && (a.return = e); a !== null;) {
			var o = a.dependencies;
			if (o !== null) {
				var s = a.child;
				o = o.firstContext;
				a: for (; o !== null;) {
					var c = o;
					o = a;
					for (var l = 0; l < t.length; l++) if (c.context === t[l]) {
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), ya(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (a.tag === 18) {
				if (s = a.return, s === null) throw Error(i(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), ya(s, n, e), s = null;
			} else a.tag === 13 && a.memoizedState !== null && a.memoizedState.dehydrated === null ? (a.lanes |= n, s = a.alternate, s !== null && (s.lanes |= n), ya(a.return, n, e), s = a.child, s = s === null ? null : s.sibling) : s = a.child;
			if (s !== null) s.return = a;
			else for (s = a; s !== null;) {
				if (s === e) {
					s = null;
					break;
				}
				if (a = s.sibling, a !== null) {
					a.return = s.return, s = a;
					break;
				}
				s = s.return;
			}
			a = s;
		}
	}
	function xa(e, t, n, r) {
		e = null;
		for (var a = t, o = !1; a !== null;) {
			if (!o) {
				if (a.flags & 524288) o = !0;
				else if (a.flags & 262144) break;
			}
			if (a.tag === 10) {
				var s = a.alternate;
				if (s === null) throw Error(i(387));
				if (s = s.memoizedProps, s !== null) {
					var c = a.type;
					Wr(a.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (a === je.current) {
				if (s = a.alternate, s === null) throw Error(i(387));
				s.memoizedState.memoizedState !== a.memoizedState.memoizedState && (e === null ? e = [sh] : e.push(sh));
			}
			a = a.return;
		}
		return e !== null && ba(t, e, n, r), t.flags |= 262144, e !== null;
	}
	function Sa(e) {
		for (e = e.firstContext; e !== null;) {
			if (!Wr(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function Ca(e) {
		ha = e, ga = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function wa(e) {
		return Ea(ha, e);
	}
	function Ta(e, t) {
		return ha === null && Ca(e), Ea(e, t);
	}
	function Ea(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, ga === null) {
			if (e === null) throw Error(i(308));
			ga = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else ga = ga.next = t;
		return n;
	}
	var Da = typeof AbortController < "u" ? AbortController : function() {
		var e = [], t = this.signal = {
			aborted: !1,
			addEventListener: function(t, n) {
				e.push(n);
			}
		};
		this.abort = function() {
			t.aborted = !0, e.forEach(function(e) {
				return e();
			});
		};
	}, Oa = t.unstable_scheduleCallback, ka = t.unstable_NormalPriority, Aa = {
		$$typeof: O,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function ja() {
		return {
			controller: new Da(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function Ma(e) {
		e.refCount--, e.refCount === 0 && Oa(ka, function() {
			e.controller.abort();
		});
	}
	function Na(e, t) {
		if (e.pendingLanes & 4194048) {
			var n = e.transitionTypes;
			for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
				var r = t[e];
				n.indexOf(r) === -1 && n.push(r);
			}
		}
	}
	var Pa = null;
	function Fa(e) {
		var t = e.transitionTypes;
		return e.transitionTypes = null, t;
	}
	var Ia = null, La = 0, Ra = 0, za = null;
	function Ba(e, t) {
		if (Ia === null) {
			var n = Ia = [];
			La = 0, Ra = Nf(), za = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return La++, t.then(Va, Va), t;
	}
	function Va() {
		if (--La === 0 && (Pa = null, Ia !== null)) {
			za !== null && (za.status = "fulfilled");
			var e = Ia;
			Ia = null, Ra = 0, za = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function Ha(e, t) {
		var n = [], r = {
			status: "pending",
			value: null,
			reason: null,
			then: function(e) {
				n.push(e);
			}
		};
		return e.then(function() {
			r.status = "fulfilled", r.value = t;
			for (var e = 0; e < n.length; e++) (0, n[e])(t);
		}, function(e) {
			for (r.status = "rejected", r.reason = e, e = 0; e < n.length; e++) (0, n[e])(void 0);
		}), r;
	}
	var Ua = k.S;
	k.S = function(e, t) {
		if (pd = Je(), typeof t == "object" && t && typeof t.then == "function" && Ba(e, t), Pa !== null) for (var n = yf; n !== null;) Na(n, Pa), n = n.next;
		if (n = e.types, n !== null) {
			for (var r = yf; r !== null;) Na(r, n), r = r.next;
			if (Ra !== 0) {
				r = Pa, r === null && (r = Pa = []);
				for (var i = 0; i < n.length; i++) {
					var a = n[i];
					r.indexOf(a) === -1 && r.push(a);
				}
			}
		}
		Ua !== null && Ua(e, t);
	};
	var Wa = Te(null);
	function Ga() {
		var e = Wa.current;
		return e === null ? Qu.pooledCache : e;
	}
	function Ka(e, t) {
		t === null ? De(Wa, Wa.current) : De(Wa, t.pool);
	}
	function qa() {
		var e = Ga();
		return e === null ? null : {
			parent: Aa._currentValue,
			pool: e
		};
	}
	var Ja = Error(i(460)), Ya = Error(i(474)), Xa = Error(i(542)), Za = { then: function() {} };
	function Qa(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function $a(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(Cn, Cn), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, ro(e), e === void 0 && !("reason" in t) ? Error(i(600)) : e;
			default:
				if (typeof t.status == "string") t.then(Cn, Cn);
				else {
					if (e = Qu, e !== null && 100 < e.shellSuspendCounter) throw Error(i(482));
					e = t, e.status = "pending", e.then(function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "fulfilled", n.value = e;
						}
					}, function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "rejected", n.reason = e;
						}
					});
				}
				switch (t.status) {
					case "fulfilled": return t.value;
					case "rejected": throw e = t.reason, ro(e), e;
				}
				throw to = t, Ja;
		}
	}
	function eo(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? (to = e, Ja) : e;
		}
	}
	var to = null;
	function no() {
		if (to === null) throw Error(i(459));
		var e = to;
		return to = null, e;
	}
	function ro(e) {
		if (e === Ja || e === Xa) throw Error(i(483));
	}
	var io = null, ao = 0;
	function oo(e) {
		var t = ao;
		return ao += 1, io === null && (io = []), $a(io, e, t);
	}
	function so(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function co(e, t) {
		throw t.$$typeof === ee ? Error(i(525)) : (e = Object.prototype.toString.call(t), Error(i(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function lo(e) {
		function t(t, n) {
			if (e) {
				var r = t.deletions;
				r === null ? (t.deletions = [n], t.flags |= 16) : r.push(n);
			}
		}
		function n(n, r) {
			if (!e) return null;
			for (; r !== null;) t(n, r), r = r.sibling;
			return null;
		}
		function r(e) {
			for (var t = /* @__PURE__ */ new Map(); e !== null;) e.key === null ? t.set(e.index, e) : t.set(e.key, e), e = e.sibling;
			return t;
		}
		function a(e, t) {
			return e = Pi(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 134217730, n) : (r = r.index, r < n ? (t.flags |= 2, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 134217730), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = Ri(n, e.mode, r), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var i = n.type;
			return i === re ? (e = d(e, t, n.props.children, r, n.key), so(e, n), e) : t !== null && (t.elementType === i || typeof i == "object" && i && i.$$typeof === de && eo(i) === t.type) ? (t = a(t, n.props), so(t, n), t.return = e, t) : (t = Ii(n.type, n.key, n.props, null, e.mode, r), so(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = Bi(n, e.mode, r), t.return = e, t) : (t = a(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, i) {
			return t === null || t.tag !== 7 ? (t = Li(n, e.mode, r, i), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = Ri("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case te: return n = Ii(t.type, t.key, t.props, null, e.mode, n), so(n, t), n.return = e, n;
					case ne: return t = Bi(t, e.mode, n), t.return = e, t;
					case de: return t = eo(t), f(e, t, n);
				}
				if (xe(t) || ve(t)) return t = Li(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, oo(t), n);
				if (t.$$typeof === O) return f(e, Ta(e, t), n);
				co(e, t);
			}
			return null;
		}
		function p(e, t, n, r) {
			var i = t === null ? null : t.key;
			if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? c(e, t, "" + n, r) : null;
			if (typeof n == "object" && n) {
				switch (n.$$typeof) {
					case te: return n.key === i ? l(e, t, n, r) : null;
					case ne: return n.key === i ? u(e, t, n, r) : null;
					case de: return n = eo(n), p(e, t, n, r);
				}
				if (xe(n) || ve(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, oo(n), r);
				if (n.$$typeof === O) return p(e, t, Ta(e, n), r);
				co(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case te: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case ne: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case de: return r = eo(r), m(e, t, n, r, i);
				}
				if (xe(r) || ve(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, oo(r), i);
				if (r.$$typeof === O) return m(e, t, n, Ta(t, r), i);
				co(t, r);
			}
			return null;
		}
		function h(i, a, s, c) {
			for (var l = null, u = null, d = a, h = a = 0, g = null; d !== null && h < s.length; h++) {
				d.index > h ? (g = d, d = null) : g = d.sibling;
				var _ = p(i, d, s[h], c);
				if (_ === null) {
					d === null && (d = g);
					break;
				}
				e && d && _.alternate === null && t(i, d), a = o(_, a, h), u === null ? l = _ : u.sibling = _, u = _, d = g;
			}
			if (h === s.length) return n(i, d), V && Zi(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return V && Zi(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && (_ = g.alternate, _ !== null && d.delete(_.key === null ? h : _.key)), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), V && Zi(i, h), l;
		}
		function g(a, s, c, l) {
			if (c == null) throw Error(i(151));
			for (var u = null, d = null, h = s, g = s = 0, _ = null, v = c.next(); h !== null && !v.done; g++, v = c.next()) {
				h.index > g ? (_ = h, h = null) : _ = h.sibling;
				var y = p(a, h, v.value, l);
				if (y === null) {
					h === null && (h = _);
					break;
				}
				e && h && y.alternate === null && t(a, h), s = o(y, s, g), d === null ? u = y : d.sibling = y, d = y, h = _;
			}
			if (v.done) return n(a, h), V && Zi(a, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(a, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return V && Zi(a, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, a, g, v.value, l), v !== null && (e && (_ = v.alternate, _ !== null && h.delete(_.key === null ? g : _.key)), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(a, e);
			}), V && Zi(a, g), u;
		}
		function _(e, r, o, c) {
			if (typeof o == "object" && o && o.type === re && o.key === null && o.props.ref === void 0 && (o = o.props.children), typeof o == "object" && o) {
				switch (o.$$typeof) {
					case te:
						a: {
							for (var l = o.key; r !== null;) {
								if (r.key === l) {
									if (l = o.type, l === re) {
										if (r.tag === 7) {
											n(e, r.sibling), c = a(r, o.props.children), so(c, o), c.return = e, e = c;
											break a;
										}
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === de && eo(l) === r.type) {
										n(e, r.sibling), c = a(r, o.props), so(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							o.type === re ? (c = Li(o.props.children, e.mode, c, o.key), so(c, o), c.return = e, e = c) : (c = Ii(o.type, o.key, o.props, null, e.mode, c), so(c, o), c.return = e, e = c);
						}
						return s(e);
					case ne:
						a: {
							for (l = o.key; r !== null;) {
								if (r.key === l) {
									if (r.tag === 4 && r.stateNode.containerInfo === o.containerInfo && r.stateNode.implementation === o.implementation) {
										n(e, r.sibling), c = a(r, o.children || []), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							c = Bi(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case de: return o = eo(o), _(e, r, o, c);
				}
				if (xe(o)) return h(e, r, o, c);
				if (ve(o)) {
					if (l = ve(o), typeof l != "function") throw Error(i(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return _(e, r, oo(o), c);
				if (o.$$typeof === O) return _(e, r, Ta(e, o), c);
				co(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = a(r, o), c.return = e, e = c) : (n(e, r), c = Ri(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				ao = 0;
				var i = _(e, t, n, r);
				return io = null, i;
			} catch (t) {
				if (t === Ja || t === Xa) throw t;
				var a = z(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var uo = lo(!0), fo = lo(!1), po = !1;
	function mo(e) {
		e.updateQueue = {
			baseState: e.memoizedState,
			firstBaseUpdate: null,
			lastBaseUpdate: null,
			shared: {
				pending: null,
				lanes: 0,
				hiddenCallbacks: null
			},
			callbacks: null
		};
	}
	function ho(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function go(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function _o(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, J & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Ai(e), ki(e, null, n), t;
		}
		return Ei(e, r, t, n), Ai(e);
	}
	function vo(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, St(e, n);
		}
	}
	function yo(e, t) {
		var n = e.updateQueue, r = e.alternate;
		if (r !== null && (r = r.updateQueue, n === r)) {
			var i = null, a = null;
			if (n = n.firstBaseUpdate, n !== null) {
				do {
					var o = {
						lane: n.lane,
						tag: n.tag,
						payload: n.payload,
						callback: null,
						next: null
					};
					a === null ? i = a = o : a = a.next = o, n = n.next;
				} while (n !== null);
				a === null ? i = a = t : a = a.next = t;
			} else i = a = t;
			n = {
				baseState: r.baseState,
				firstBaseUpdate: i,
				lastBaseUpdate: a,
				shared: r.shared,
				callbacks: r.callbacks
			}, e.updateQueue = n;
		} else e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
	}
	var bo = !1;
	function xo() {
		if (bo) {
			var e = za;
			if (e !== null) throw e;
		}
	}
	function So(e, t, n, r) {
		bo = !1;
		var i = e.updateQueue;
		po = !1;
		var a = i.firstBaseUpdate, o = i.lastBaseUpdate, s = i.shared.pending;
		if (s !== null) {
			i.shared.pending = null;
			var c = s, l = c.next;
			c.next = null, o === null ? a = l : o.next = l, o = c;
			var u = e.alternate;
			u !== null && (u = u.updateQueue, s = u.lastBaseUpdate, s !== o && (s === null ? u.firstBaseUpdate = l : s.next = l, u.lastBaseUpdate = c));
		}
		if (a !== null) {
			var d = i.baseState;
			o = 0, u = l = c = null, s = a;
			do {
				var f = s.lane & -536870913, p = f !== s.lane;
				if (p ? (X & f) === f : (r & f) === f) {
					f !== 0 && f === Ra && (bo = !0), u !== null && (u = u.next = {
						lane: 0,
						tag: s.tag,
						payload: s.payload,
						callback: null,
						next: null
					});
					a: {
						var m = e, h = s;
						f = t;
						var g = n;
						switch (h.tag) {
							case 1:
								if (m = h.payload, typeof m == "function") {
									d = m.call(g, d, f);
									break a;
								}
								d = m;
								break a;
							case 3: m.flags = m.flags & -65537 | 128;
							case 0:
								if (m = h.payload, f = typeof m == "function" ? m.call(g, d, f) : m, f == null) break a;
								d = D({}, d, f);
								break a;
							case 2: po = !0;
						}
					}
					f = s.callback, f !== null && (e.flags |= 64, p && (e.flags |= 8192), p = i.callbacks, p === null ? i.callbacks = [f] : p.push(f));
				} else p = {
					lane: f,
					tag: s.tag,
					payload: s.payload,
					callback: s.callback,
					next: null
				}, u === null ? (l = u = p, c = d) : u = u.next = p, o |= f;
				if (s = s.next, s === null) {
					if (s = i.shared.pending, s === null) break;
					p = s, s = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
				}
			} while (1);
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), id |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function Co(e, t) {
		if (typeof e != "function") throw Error(i(191, e));
		e.call(t);
	}
	function wo(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) Co(n[e], t);
	}
	var To = Te(null), Eo = Te(0);
	function Do(e, t) {
		e = Q, De(Eo, e), De(To, t), Q = e | t.baseLanes;
	}
	function Oo() {
		De(Eo, Q), De(To, To.current);
	}
	function ko() {
		Q = Eo.current, Ee(To), Ee(Eo);
	}
	var Ao = Te(null), jo = null;
	function Mo(e) {
		var t = e.alternate;
		De(Lo, Lo.current & 1), De(Ao, e), jo === null && (t === null || To.current !== null || t.memoizedState !== null) && (jo = e);
	}
	function No(e) {
		De(Lo, Lo.current), De(Ao, e), jo === null && (jo = e);
	}
	function Po(e) {
		e.tag === 22 ? (De(Lo, Lo.current), De(Ao, e), jo === null && (jo = e)) : Fo();
	}
	function Fo() {
		De(Lo, Lo.current), De(Ao, Ao.current);
	}
	function Io(e) {
		Ee(Ao), jo === e && (jo = null), Ee(Lo);
	}
	var Lo = Te(0);
	function Ro(e, t) {
		De(Ao, Ao.current), De(Lo, t);
	}
	function zo(e) {
		Ee(Lo), Ee(Ao), jo === e && (jo = null);
	}
	function Bo(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || om(n) || sm(n))) return t;
			} else if (t.tag === 19 && t.memoizedProps.revealOrder !== "independent") {
				if (t.flags & 128) return t;
			} else if (t.child !== null) {
				t.child.return = t, t = t.child;
				continue;
			}
			if (t === e) break;
			for (; t.sibling === null;) {
				if (t.return === null || t.return === e) return null;
				t = t.return;
			}
			t.sibling.return = t.return, t = t.sibling;
		}
		return null;
	}
	var Vo = 0, H = null, U = null, Ho = null, Uo = !1, Wo = !1, Go = !1, Ko = 0, qo = 0, Jo = null, Yo = 0;
	function Xo() {
		throw Error(i(321));
	}
	function Zo(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!Wr(e[n], t[n])) return !1;
		return !0;
	}
	function Qo(e, t, n, r, i, a) {
		return Vo = a, H = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, k.H = e === null || e.memoizedState === null ? hc : gc, Go = !1, a = n(r, i), Go = !1, Wo && (a = es(t, n, r, i)), $o(e), a;
	}
	function $o(e) {
		k.H = mc;
		var t = U !== null && U.next !== null;
		if (Vo = 0, Ho = U = H = null, Uo = !1, qo = 0, Jo = null, t) throw Error(i(300));
		e === null || Nc || (e = e.dependencies, e !== null && Sa(e) && (Nc = !0));
	}
	function es(e, t, n, r) {
		H = e;
		var a = 0;
		do {
			if (Wo && (Jo = null), qo = 0, Wo = !1, 25 <= a) throw Error(i(301));
			if (a += 1, Ho = U = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			k.H = _c, o = t(n, r);
		} while (Wo);
		return o;
	}
	function ts() {
		var e = k.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? cs(t) : t, e = e.useState()[0], (U === null ? null : U.memoizedState) !== e && (H.flags |= 1024), t;
	}
	function ns() {
		var e = Ko !== 0;
		return Ko = 0, e;
	}
	function rs(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function is(e) {
		if (Uo) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			Uo = !1;
		}
		Vo = 0, Ho = U = H = null, Wo = !1, qo = Ko = 0, Jo = null;
	}
	function as() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return Ho === null ? H.memoizedState = Ho = e : Ho = Ho.next = e, Ho;
	}
	function os() {
		if (U === null) {
			var e = H.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = U.next;
		var t = Ho === null ? H.memoizedState : Ho.next;
		if (t !== null) Ho = t, U = e;
		else {
			if (e === null) throw H.alternate === null ? Error(i(467)) : Error(i(310));
			U = e, e = {
				memoizedState: U.memoizedState,
				baseState: U.baseState,
				baseQueue: U.baseQueue,
				queue: U.queue,
				next: null
			}, Ho === null ? H.memoizedState = Ho = e : Ho = Ho.next = e;
		}
		return Ho;
	}
	function ss() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function cs(e) {
		var t = qo;
		return qo += 1, Jo === null && (Jo = []), e = $a(Jo, e, t), t = H, (Ho === null ? t.memoizedState : Ho.next) === null && (t = t.alternate, k.H = t === null || t.memoizedState === null ? hc : gc), e;
	}
	function ls(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return cs(e);
			if (e.$$typeof === ge) return;
			if (e.$$typeof === O) return wa(e);
		}
		throw Error(i(438, String(e)));
	}
	function us(e) {
		var t = null, n = H.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = H.alternate;
			r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (t = {
				data: r.data.map(function(e) {
					return e.slice();
				}),
				index: 0
			})));
		}
		if (t ??= {
			data: [],
			index: 0
		}, n === null && (n = ss(), H.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = me;
		return t.index++, n;
	}
	function ds(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function fs(e) {
		return ps(os(), U, e);
	}
	function ps(e, t, n) {
		var r = e.queue;
		if (r === null) throw Error(i(311));
		r.lastRenderedReducer = n;
		var a = e.baseQueue, o = r.pending;
		if (o !== null) {
			if (a !== null) {
				var s = a.next;
				a.next = o.next, o.next = s;
			}
			t.baseQueue = a = o, r.pending = null;
		}
		if (o = e.baseState, a === null) e.memoizedState = o;
		else {
			t = a.next;
			var c = s = null, l = null, u = t, d = !1;
			do {
				var f = u.lane & -536870913;
				if (f === u.lane ? (Vo & f) === f : (X & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === Ra && (d = !0);
					else if ((Vo & p) === p) {
						u = u.next, p === Ra && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, s = o) : l = l.next = f, H.lanes |= p, id |= p;
					f = u.action, Go && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, H.lanes |= f, id |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !Wr(o, e.memoizedState) && (Nc = !0, d && (n = za, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return a === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function ms(e) {
		var t = os(), n = t.queue;
		if (n === null) throw Error(i(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, a = n.pending, o = t.memoizedState;
		if (a !== null) {
			n.pending = null;
			var s = a = a.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== a);
			Wr(o, t.memoizedState) || (Nc = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function hs(e, t, n) {
		var r = H, a = os(), o = V;
		if (o) {
			if (n === void 0) throw Error(i(407));
			n = n();
		} else n = t();
		var s = !Wr((U || a).memoizedState, n);
		if (s && (a.memoizedState = n, Nc = !0), a = a.queue, Bs(vs.bind(null, r, a, e), [e]), e = a.getSnapshot !== t || s || Ho !== null && !!(Ho.memoizedState.tag & 1), Fs(e ? 9 : 8, { destroy: void 0 }, _s.bind(null, r, a, n, t), null), e) {
			if (r.flags |= 2048, Qu === null) throw Error(i(349));
			o || Vo & 127 || gs(r, t, n);
		}
		return n;
	}
	function gs(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = H.updateQueue, t === null ? (t = ss(), H.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function _s(e, t, n, r) {
		t.value = n, t.getSnapshot = r, ys(t) && bs(e);
	}
	function vs(e, t, n) {
		return n(function() {
			ys(t) && bs(e);
		});
	}
	function ys(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !Wr(e, n);
		} catch {
			return !0;
		}
	}
	function bs(e) {
		var t = Oi(e, 2);
		t !== null && Md(t, e, 2);
	}
	function xs(e) {
		var t = as();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), Go) {
				at(!0);
				try {
					n();
				} finally {
					at(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: ds,
			lastRenderedState: e
		}, t;
	}
	function Ss(e, t, n, r) {
		return e.baseState = n, ps(e, U, typeof r == "function" ? r : ds);
	}
	function Cs(e, t, n, r, a) {
		if (dc(e)) throw Error(i(485));
		if (e = t.action, e !== null) {
			var o = {
				payload: a,
				action: e,
				next: null,
				isTransition: !0,
				status: "pending",
				value: null,
				reason: null,
				listeners: [],
				then: function(e) {
					o.listeners.push(e);
				}
			};
			k.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, ws(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function ws(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = k.T, o = {};
			o.types = a === null ? null : a.types, k.T = o;
			try {
				var s = n(i, r), c = k.S;
				c !== null && c(o, s), Ts(e, t, s);
			} catch (n) {
				Ds(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), k.T = a;
			}
		} else try {
			a = n(i, r), Ts(e, t, a);
		} catch (n) {
			Ds(e, t, n);
		}
	}
	function Ts(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			Es(e, t, n);
		}, function(n) {
			return Ds(e, t, n);
		}) : Es(e, t, n);
	}
	function Es(e, t, n) {
		t.status = "fulfilled", t.value = n, Os(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, ws(e, n)));
	}
	function Ds(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, Os(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function Os(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function ks(e, t) {
		return t;
	}
	function As(e, t) {
		if (V) {
			var n = Qu.formState;
			if (n !== null) {
				a: {
					var r = H;
					if (V) {
						if (ra) {
							b: {
								for (var i = ra, a = aa; i.nodeType !== 8;) if (!a || (i = lm(i.nextSibling), i === null)) {
									i = null;
									break b;
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								ra = lm(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						sa(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = as(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: ks,
			lastRenderedState: t
		}, n.queue = r, n = cc.bind(null, H, r), r.dispatch = n, r = xs(!1), a = uc.bind(null, H, !1, r.queue), r = as(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = Cs.bind(null, H, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function js(e) {
		return Ms(os(), U, e);
	}
	function Ms(e, t, n) {
		if (t = ps(e, t, ks)[0], e = fs(ds)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = cs(t);
		} catch (e) {
			throw e === Ja ? Xa : e;
		}
		else r = t;
		t = os();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (H.flags |= 2048, Fs(9, { destroy: void 0 }, Ns.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function Ns(e, t) {
		e.action = t;
	}
	function Ps(e) {
		var t = os(), n = U;
		if (n !== null) return Ms(t, n, e);
		os(), t = t.memoizedState, n = os();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function Fs(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = H.updateQueue, t === null && (t = ss(), H.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function Is() {
		return os().memoizedState;
	}
	function Ls(e, t, n, r) {
		var i = as();
		H.flags |= e, i.memoizedState = Fs(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function Rs(e, t, n, r) {
		var i = os();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		U !== null && r !== null && Zo(r, U.memoizedState.deps) ? i.memoizedState = Fs(t, a, n, r) : (H.flags |= e, i.memoizedState = Fs(1 | t, a, n, r));
	}
	function zs(e, t) {
		Ls(8390656, 8, e, t);
	}
	function Bs(e, t) {
		Rs(2048, 8, e, t);
	}
	function Vs(e) {
		H.flags |= 4;
		var t = H.updateQueue;
		if (t === null) t = ss(), H.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function Hs(e) {
		var t = os().memoizedState;
		return Vs({
			ref: t,
			nextImpl: e
		}), function() {
			if (J & 2) throw Error(i(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function Us(e, t) {
		return Rs(4, 2, e, t);
	}
	function Ws(e, t) {
		return Rs(4, 4, e, t);
	}
	function Gs(e, t) {
		if (typeof t == "function") {
			e = e();
			var n = t(e);
			return function() {
				typeof n == "function" ? n() : t(null);
			};
		}
		if (t != null) return e = e(), t.current = e, function() {
			t.current = null;
		};
	}
	function Ks(e, t, n) {
		n = n == null ? null : n.concat([e]), Rs(4, 4, Gs.bind(null, t, e), n);
	}
	function qs() {}
	function Js(e, t) {
		var n = os();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && Zo(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function Ys(e, t) {
		var n = os();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && Zo(t, r[1])) return r[0];
		if (r = e(), Go) {
			at(!0);
			try {
				e();
			} finally {
				at(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function Xs(e, t, n) {
		return n === void 0 || Vo & 1073741824 && !(X & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = Ad(), H.lanes |= e, id |= e, n);
	}
	function Zs(e, t, n, r) {
		return Wr(n, t) ? n : To.current === null ? !(Vo & 106) || Vo & 1073741824 && !(X & 261930) ? (Nc = !0, e.memoizedState = n) : (e = Ad(), H.lanes |= e, id |= e, t) : (e = Xs(e, n, r), Wr(e, t) || (Nc = !0), e);
	}
	function Qs(e, t, n, r, i) {
		var a = A.p;
		A.p = a !== 0 && 8 > a ? a : 8;
		var o = k.T, s = {};
		s.types = o === null ? null : o.types, k.T = s, uc(e, !1, t, n);
		try {
			var c = i(), l = k.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? lc(e, t, Ha(c, r), kd(e)) : lc(e, t, r, kd(e));
		} catch (n) {
			lc(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, kd());
		} finally {
			A.p = a, o !== null && s.types !== null && (o.types = s.types), k.T = o;
		}
	}
	function $s() {}
	function ec(e, t, n, r) {
		if (e.tag !== 5) throw Error(i(476));
		var a = tc(e).queue;
		Qs(e, a, t, Se, n === null ? $s : function() {
			return nc(e), n(r);
		});
	}
	function tc(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: Se,
			baseState: Se,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: ds,
				lastRenderedState: Se
			},
			next: null
		};
		var n = {};
		return t.next = {
			memoizedState: n,
			baseState: n,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: ds,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function nc(e) {
		var t = tc(e);
		t.next === null && (t = e.alternate.memoizedState), lc(e, t.next.queue, {}, kd());
	}
	function rc() {
		return wa(sh);
	}
	function ic() {
		return os().memoizedState;
	}
	function ac() {
		return os().memoizedState;
	}
	function oc(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = kd();
					e = go(n);
					var r = _o(t, e, n);
					r !== null && (Md(r, t, n), vo(r, t, n)), t = { cache: ja() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function sc(e, t, n) {
		var r = kd();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, dc(e) ? fc(t, n) : (n = Di(e, t, n, r), n !== null && (Md(n, e, r), pc(n, t, r)));
	}
	function cc(e, t, n) {
		lc(e, t, n, kd());
	}
	function lc(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (dc(e)) fc(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, Wr(s, o)) return Ei(e, t, i, 0), Qu === null && Ti(), !1;
			} catch {}
			if (n = Di(e, t, i, r), n !== null) return Md(n, e, r), pc(n, t, r), !0;
		}
		return !1;
	}
	function uc(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: Nf(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, dc(e)) {
			if (t) throw Error(i(479));
		} else t = Di(e, n, r, 2), t !== null && Md(t, e, 2);
	}
	function dc(e) {
		var t = e.alternate;
		return e === H || t !== null && t === H;
	}
	function fc(e, t) {
		Wo = Uo = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function pc(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, St(e, n);
		}
	}
	var mc = {
		readContext: wa,
		use: ls,
		useCallback: Xo,
		useContext: Xo,
		useEffect: Xo,
		useImperativeHandle: Xo,
		useLayoutEffect: Xo,
		useInsertionEffect: Xo,
		useMemo: Xo,
		useReducer: Xo,
		useRef: Xo,
		useState: Xo,
		useDebugValue: Xo,
		useDeferredValue: Xo,
		useTransition: Xo,
		useSyncExternalStore: Xo,
		useId: Xo,
		useHostTransitionStatus: Xo,
		useFormState: Xo,
		useActionState: Xo,
		useOptimistic: Xo,
		useMemoCache: Xo,
		useCacheRefresh: Xo,
		useEffectEvent: Xo
	}, hc = {
		readContext: wa,
		use: ls,
		useCallback: function(e, t) {
			return as().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: wa,
		useEffect: zs,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), Ls(4194308, 4, Gs.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return Ls(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			Ls(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = as();
			t = t === void 0 ? null : t;
			var r = e();
			if (Go) {
				at(!0);
				try {
					e();
				} finally {
					at(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = as();
			if (n !== void 0) {
				var i = n(t);
				if (Go) {
					at(!0);
					try {
						n(t);
					} finally {
						at(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = sc.bind(null, H, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = as();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = xs(e);
			var t = e.queue, n = cc.bind(null, H, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: qs,
		useDeferredValue: function(e, t) {
			return Xs(as(), e, t);
		},
		useTransition: function() {
			var e = xs(!1);
			return e = Qs.bind(null, H, e.queue, !0, !1), as().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = H, a = as();
			if (V) {
				if (n === void 0) throw Error(i(407));
				n = n();
			} else {
				if (n = t(), Qu === null) throw Error(i(349));
				X & 127 || gs(r, t, n);
			}
			a.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return a.queue = o, zs(vs.bind(null, r, o, e), [e]), r.flags |= 2048, Fs(9, { destroy: void 0 }, _s.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = as(), t = Qu.identifierPrefix;
			if (V) {
				var n = Xi, r = Yi;
				n = (r & ~(1 << 32 - ot(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = Ko++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = Yo++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: rc,
		useFormState: As,
		useActionState: As,
		useOptimistic: function(e) {
			var t = as();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = uc.bind(null, H, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: us,
		useCacheRefresh: function() {
			return as().memoizedState = oc.bind(null, H);
		},
		useEffectEvent: function(e) {
			var t = as(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (J & 2) throw Error(i(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, gc = {
		readContext: wa,
		use: ls,
		useCallback: Js,
		useContext: wa,
		useEffect: Bs,
		useImperativeHandle: Ks,
		useInsertionEffect: Us,
		useLayoutEffect: Ws,
		useMemo: Ys,
		useReducer: fs,
		useRef: Is,
		useState: function() {
			return fs(ds);
		},
		useDebugValue: qs,
		useDeferredValue: function(e, t) {
			return Zs(os(), U.memoizedState, e, t);
		},
		useTransition: function() {
			var e = fs(ds)[0], t = os().memoizedState;
			return [typeof e == "boolean" ? e : cs(e), t];
		},
		useSyncExternalStore: hs,
		useId: ic,
		useHostTransitionStatus: rc,
		useFormState: js,
		useActionState: js,
		useOptimistic: function(e, t) {
			return Ss(os(), U, e, t);
		},
		useMemoCache: us,
		useCacheRefresh: ac,
		useEffectEvent: Hs
	}, _c = {
		readContext: wa,
		use: ls,
		useCallback: Js,
		useContext: wa,
		useEffect: Bs,
		useImperativeHandle: Ks,
		useInsertionEffect: Us,
		useLayoutEffect: Ws,
		useMemo: Ys,
		useReducer: ms,
		useRef: Is,
		useState: function() {
			return ms(ds);
		},
		useDebugValue: qs,
		useDeferredValue: function(e, t) {
			var n = os();
			return U === null ? Xs(n, e, t) : Zs(n, U.memoizedState, e, t);
		},
		useTransition: function() {
			var e = ms(ds)[0], t = os().memoizedState;
			return [typeof e == "boolean" ? e : cs(e), t];
		},
		useSyncExternalStore: hs,
		useId: ic,
		useHostTransitionStatus: rc,
		useFormState: Ps,
		useActionState: Ps,
		useOptimistic: function(e, t) {
			var n = os();
			return U === null ? (n.baseState = e, [e, n.queue.dispatch]) : Ss(n, U, e, t);
		},
		useMemoCache: us,
		useCacheRefresh: ac,
		useEffectEvent: Hs
	};
	function vc(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : D({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var yc = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = kd(), i = go(r);
			i.payload = t, n != null && (i.callback = n), t = _o(e, i, r), t !== null && (Md(t, e, r), vo(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = kd(), i = go(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = _o(e, i, r), t !== null && (Md(t, e, r), vo(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = kd(), r = go(n);
			r.tag = 2, t != null && (r.callback = t), t = _o(e, r, n), t !== null && (Md(t, e, n), vo(t, e, n));
		}
	};
	function bc(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !Gr(n, r) || !Gr(i, a) : !0;
	}
	function xc(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && yc.enqueueReplaceState(t, t.state, null);
	}
	function Sc(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = D({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function Cc(e) {
		xi(e);
	}
	function wc(e) {
		console.error(e);
	}
	function Tc(e) {
		xi(e);
	}
	function Ec(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Dc(e, t, n) {
		try {
			var r = e.onCaughtError;
			r(n.value, {
				componentStack: n.stack,
				errorBoundary: t.tag === 1 ? t.stateNode : null
			});
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Oc(e, t, n) {
		return n = go(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			Ec(e, t);
		}, n;
	}
	function kc(e) {
		return e = go(e), e.tag = 3, e;
	}
	function Ac(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				Dc(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			Dc(t, n, r), typeof i != "function" && (gd === null ? gd = /* @__PURE__ */ new Set([this]) : gd.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function jc(e, t, n, r, a) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && xa(t, n, a, !0), n = Ao.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13:
					case 19: return jo === null ? Wd() : n.alternate === null && rd === 0 && (rd = 3), n.flags &= -257, n.flags |= 65536, n.lanes = a, r === Za ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), pf(e, r, a)), !1;
					case 22: return n.flags |= 65536, r === Za ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), pf(e, r, a)), !1;
				}
				throw Error(i(435, n.tag));
			}
			return pf(e, r, a), Wd(), !1;
		}
		if (V) return t = Ao.current, t === null ? (r !== oa && (t = Error(i(423), { cause: r }), pa(Hi(t, n))), e = e.current.alternate, e.flags |= 65536, a &= -a, e.lanes |= a, r = Hi(r, n), a = Oc(e.stateNode, r, a), yo(e, a), rd !== 4 && (rd = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = a, r !== oa && (e = Error(i(422), { cause: r }), pa(Hi(e, n)))), !1;
		var o = Error(i(520), { cause: r });
		if (o = Hi(o, n), ld === null ? ld = [o] : ld.push(o), rd !== 4 && (rd = 2), t === null) return !0;
		r = Hi(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = a & -a, n.lanes |= e, e = Oc(n.stateNode, r, e), yo(n, e), !1;
				case 1:
					if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (gd === null || !gd.has(o)))) return n.flags |= 65536, a &= -a, n.lanes |= a, a = kc(a), Ac(a, e, n, r), yo(n, a), !1;
					break;
				case 22: if (n.memoizedState !== null) return n.flags |= 65536, !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Mc = Error(i(461)), Nc = !1;
	function Pc(e, t, n, r) {
		t.child = e === null ? fo(t, null, n, r) : uo(t, e.child, n, r);
	}
	function Fc(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return Ca(t), r = Qo(e, t, n, o, a, i), s = ns(), e !== null && !Nc ? (rs(e, t, i), cl(e, t, i)) : (V && s && $i(t), t.flags |= 1, Pc(e, t, r, i), t.child);
	}
	function Ic(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !Ni(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, Lc(e, t, a, r, i)) : (e = Ii(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !ll(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? Gr : n, n(o, r) && e.ref === t.ref) return cl(e, t, i);
		}
		return t.flags |= 1, e = Pi(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function Lc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (Gr(a, r) && e.ref === t.ref) {
				if (Nc = !1, t.pendingProps = r = a, ll(e, i)) e.flags & 131072 && (Nc = !0);
				else return t.lanes = e.lanes, cl(e, t, i);
			}
		}
		return Gc(e, t, n, r, i);
	}
	function Rc(e, t, n, r) {
		var i = r.children, a = e === null ? null : e.memoizedState;
		if (e === null && t.stateNode === null && (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), r.mode === "hidden") {
			if (t.flags & 128) {
				if (a = a === null ? n : a.baseLanes | n, e !== null) {
					for (r = t.child = e.child, i = 0; r !== null;) i = i | r.lanes | r.childLanes, r = r.sibling;
					r = i & ~a;
				} else r = 0, t.child = null;
				return Bc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && Ka(t, a === null ? null : a.cachePool), a === null ? Oo() : Do(t, a), Po(t);
			else return r = t.lanes = 536870912, Bc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && Ka(t, null), Oo(), Fo()) : (Ka(t, a.cachePool), Do(t, a), Fo(), t.memoizedState = null);
		return Pc(e, t, i, n), t.child;
	}
	function zc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function Bc(e, t, n, r, i) {
		var a = Ga();
		return a = a === null ? null : {
			parent: Aa._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && Ka(t, null), Oo(), Po(t), e !== null && xa(e, t, r, !0), t.childLanes = i, null;
	}
	function Vc(e, t) {
		return t = $c({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function Hc(e, t, n) {
		return uo(t, e.child, null, n), e = Vc(t, t.pendingProps), e.flags |= 2, Io(t), t.memoizedState = null, e;
	}
	function Uc(e, t, n) {
		var r = t.pendingProps, a = !!(t.flags & 128);
		if (t.flags &= -129, e === null) {
			if (V) {
				if (r.mode === "hidden") return e = Vc(t, r), t.lanes = 536870912, e.memoizedState = {
					baseLanes: 0,
					cachePool: null
				}, zc(null, e);
				if (No(t), (e = ra) ? (e = am(e, aa), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: Ji === null ? null : {
						id: Yi,
						overflow: Xi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = zi(e), n.return = t, t.child = n, na = t, ra = null)) : e = null, e === null) throw sa(t);
				return t.lanes = 536870912, null;
			}
			return Vc(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if (No(t), a) {
				if (t.flags & 256) t.flags &= -257, t = Hc(e, t, n);
				else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
				else throw Error(i(558));
			} else if (Nc || xa(e, t, n, !1), a = (n & e.childLanes) !== 0, Nc || a) {
				if (To.current === null) {
					if (r = Qu, r !== null && (s = Ct(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, Oi(e, s), Md(r, e, s), Mc;
					Wd();
				}
				t = Hc(e, t, n);
			} else e = o.treeContext, ra = lm(s.nextSibling), na = t, V = !0, ia = null, aa = !1, e !== null && ta(t, e), t = Vc(t, r), t.flags |= 134221824;
			return t;
		}
		return e = Pi(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function Wc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(i(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function Gc(e, t, n, r, i) {
		return Ca(t), n = Qo(e, t, n, r, void 0, i), r = ns(), e !== null && !Nc ? (rs(e, t, i), cl(e, t, i)) : (V && r && $i(t), t.flags |= 1, Pc(e, t, n, i), t.child);
	}
	function Kc(e, t, n, r, i, a) {
		return Ca(t), t.updateQueue = null, n = es(t, r, n, i), $o(e), r = ns(), e !== null && !Nc ? (rs(e, t, a), cl(e, t, a)) : (V && r && $i(t), t.flags |= 1, Pc(e, t, n, a), t.child);
	}
	function qc(e, t, n, r, i) {
		if (Ca(t), t.stateNode === null) {
			var a = ji, o = n.contextType;
			typeof o == "object" && o && (a = wa(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = yc, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, mo(t), o = n.contextType, a.context = typeof o == "object" && o ? wa(o) : ji, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (vc(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && yc.enqueueReplaceState(a, a.state, null), So(t, r, a, i), xo(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Sc(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = ji, typeof u == "object" && u && (o = wa(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && xc(t, a, r, o), po = !1;
			var f = t.memoizedState;
			a.state = f, So(t, r, a, i), xo(), l = t.memoizedState, s || f !== l || po ? (typeof d == "function" && (vc(t, n, d, r), l = t.memoizedState), (c = po || bc(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, ho(e, t), o = t.memoizedProps, u = Sc(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = ji, typeof l == "object" && l && (c = wa(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && xc(t, a, r, c), po = !1, f = t.memoizedState, a.state = f, So(t, r, a, i), xo();
			var p = t.memoizedState;
			o !== d || f !== p || po || e !== null && e.dependencies !== null && Sa(e.dependencies) ? (typeof s == "function" && (vc(t, n, s, r), p = t.memoizedState), (u = po || bc(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Sa(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, Wc(e, t), r = !!(t.flags & 128), a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = uo(t, e.child, null, i), t.child = uo(t, null, n, i)) : Pc(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = cl(e, t, i), e;
	}
	function Jc(e, t, n, r) {
		return da(), t.flags |= 256, Pc(e, t, n, r), t.child;
	}
	var Yc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function W(e) {
		return {
			baseLanes: e,
			cachePool: qa()
		};
	}
	function Xc(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= sd), e;
	}
	function Zc(e, t, n) {
		var r = t.pendingProps, i = !1, a = !!(t.flags & 128), o;
		if ((o = a) || (o = e !== null && e.memoizedState === null ? !1 : !!(Lo.current & 2)), o && (i = !0, t.flags &= -129), o = !!(t.flags & 32), t.flags &= -33, e === null) {
			if (V) {
				if (i ? Mo(t) : Fo(), (e = ra) ? (e = am(e, aa), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: Ji === null ? null : {
						id: Yi,
						overflow: Xi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = zi(e), n.return = t, t.child = n, na = t, ra = null)) : e = null, e === null) throw sa(t);
				return t.lanes = sm(e) ? 32 : 536870912, null;
			}
			return a = r.children, r = r.fallback, i ? (Fo(), i = t.mode, a = $c({
				mode: "hidden",
				children: a
			}, i), r = Li(r, i, n, null), a.return = t, r.return = t, a.sibling = r, t.child = a, r = t.child, r.memoizedState = W(n), r.childLanes = Xc(e, o, n), t.memoizedState = Yc, zc(null, r)) : (Mo(t), Qc(t, a));
		}
		var s = e.memoizedState;
		if (s !== null) {
			var c = s.dehydrated;
			if (c !== null) return tl(e, t, a, o, r, c, s, n);
		}
		return i ? (Fo(), i = r.fallback, a = t.mode, s = e.child, c = s.sibling, r = Pi(s, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = s.subtreeFlags & 1206910976, c === null ? (i = Li(i, a, n, null), i.flags |= 2) : i = Pi(c, i), i.return = t, r.return = t, r.sibling = i, t.child = r, zc(null, r), r = t.child, i = e.child.memoizedState, i === null ? i = W(n) : (a = i.cachePool, a === null ? a = qa() : (s = Aa._currentValue, a = a.parent === s ? a : {
			parent: s,
			pool: s
		}), i = {
			baseLanes: i.baseLanes | n,
			cachePool: a
		}), r.memoizedState = i, r.childLanes = Xc(e, o, n), t.memoizedState = Yc, zc(e.child, r)) : (Mo(t), n = e.child, e = n.sibling, n = Pi(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (o = t.deletions, o === null ? (t.deletions = [e], t.flags |= 16) : o.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function Qc(e, t) {
		return t = $c({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function $c(e, t) {
		return e = z(22, e, null, t), e.lanes = 0, e;
	}
	function el(e, t, n) {
		return uo(t, e.child, null, n), e = Qc(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function tl(e, t, n, r, a, o, s, c) {
		if (n) return t.flags & 256 ? (Mo(t), t.flags &= -257, el(e, t, c)) : t.memoizedState === null ? (Fo(), o = a.fallback, s = t.mode, a = $c({
			mode: "visible",
			children: a.children
		}, s), o = Li(o, s, c, null), o.flags |= 2, a.return = t, o.return = t, a.sibling = o, t.child = a, uo(t, e.child, null, c), a = t.child, a.memoizedState = W(c), a.childLanes = Xc(e, r, c), t.memoizedState = Yc, zc(null, a)) : (Fo(), t.child = e.child, t.flags |= 128, null);
		if (Mo(t), sm(o)) {
			if (r = o.nextSibling && o.nextSibling.dataset, r) var l = r.dgst;
			return r = l, r !== "" && (a = Error(i(419)), a.stack = "", a.digest = r, pa({
				value: a,
				source: null,
				stack: null
			})), el(e, t, c);
		}
		if (Nc || xa(e, t, c, !1), r = (c & e.childLanes) !== 0, Nc || r) {
			if (To.current !== null) return el(e, t, c);
			if (r = Qu, r !== null && (a = Ct(r, c), a !== 0 && a !== s.retryLane)) throw s.retryLane = a, Oi(e, a), Md(r, e, a), Mc;
			return om(o) || Wd(), el(e, t, c);
		}
		return om(o) ? (t.flags |= 192, t.child = e.child, null) : (e = s.treeContext, ra = lm(o.nextSibling), na = t, V = !0, ia = null, aa = !1, e !== null && ta(t, e), t = Qc(t, a.children), t.flags |= 134221824, t);
	}
	function nl(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), ya(e.return, t, n);
	}
	function rl(e) {
		for (var t = null; e !== null;) {
			var n = e.alternate;
			n !== null && Bo(n) === null && (t = e), e = e.sibling;
		}
		return t;
	}
	function il(e, t, n, r, i, a) {
		var o = e.memoizedState;
		o === null ? e.memoizedState = {
			isBackwards: t,
			rendering: null,
			renderingStartTime: 0,
			last: r,
			tail: n,
			tailMode: i,
			treeForkCount: a
		} : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = i, o.treeForkCount = a);
	}
	function al(e) {
		var t = e.child;
		for (e.child = null; t !== null;) {
			var n = t.sibling;
			t.sibling = e.child, e.child = t, t = n;
		}
	}
	function ol(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = Lo.current;
		if (t.flags & 128) return Ro(t, o), null;
		var s = !!(o & 2);
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, Ro(t, o), i === "backwards" && e !== null ? (al(e), Pc(e, t, r, n), al(e)) : Pc(e, t, r, n), r = V ? Ki : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && nl(e, n, t);
			else if (e.tag === 19) nl(e, n, t);
			else if (e.child !== null) {
				e.child.return = e, e = e.child;
				continue;
			}
			if (e === t) break a;
			for (; e.sibling === null;) {
				if (e.return === null || e.return === t) break a;
				e = e.return;
			}
			e.sibling.return = e.return, e = e.sibling;
		}
		switch (i) {
			case "backwards":
				n = rl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null, al(t)), il(t, !0, i, null, a, r);
				break;
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && Bo(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				il(t, !0, n, null, a, r);
				break;
			case "together":
				il(t, !1, null, null, void 0, r);
				break;
			case "independent":
				t.memoizedState = null;
				break;
			default: n = rl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), il(t, !1, i, n, a, r);
		}
		return t.child;
	}
	function sl(e, t, n) {
		var r = t.pendingProps;
		return _a(t, t.type, r.value), Pc(e, t, r.children, n), t.child;
	}
	function cl(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), id |= t.lanes, (n & t.childLanes) === 0) {
			if (e !== null) {
				if (xa(e, t, n, !1), (n & t.childLanes) === 0) return null;
			} else return null;
		}
		if (e !== null && t.child !== e.child) throw Error(i(153));
		if (t.child !== null) {
			for (e = t.child, n = Pi(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = Pi(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function ll(e, t) {
		return (e.lanes & t) !== 0 || (e = e.dependencies, !!(e !== null && Sa(e)));
	}
	function ul(e, t, n) {
		switch (t.tag) {
			case 3:
				Me(t, t.stateNode.containerInfo), _a(t, Aa, e.memoizedState.cache), da();
				break;
			case 27:
			case 5:
				Pe(t);
				break;
			case 4:
				Me(t, t.stateNode.containerInfo);
				break;
			case 10:
				_a(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, No(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) {
					if (r.dehydrated !== null) return Mo(t), t.flags |= 128, null;
					r = xa(e, t, n, !1);
					var i = t.child.childLanes;
					return r || (n & i) !== 0 ? Zc(e, t, n) : (Mo(t), e = cl(e, t, n), e === null ? null : e.sibling);
				}
				Mo(t);
				break;
			case 19:
				if (t.flags & 128) return ol(e, t, n);
				if (i = !!(e.flags & 128), r = (n & t.childLanes) !== 0, r ||= (xa(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return ol(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), Ro(t, Lo.current), r) break;
				return null;
			case 22: return t.lanes = 0, Rc(e, t, n, t.pendingProps);
			case 24: _a(t, Aa, e.memoizedState.cache);
		}
		return cl(e, t, n);
	}
	function dl(e, t, n) {
		if (e !== null) {
			if (e.memoizedProps !== t.pendingProps) Nc = !0;
			else {
				if (!ll(e, n) && !(t.flags & 128)) return Nc = !1, ul(e, t, n);
				Nc = !!(e.flags & 131072);
			}
		} else Nc = !1, V && t.flags & 1048576 && Qi(t, Ki, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = eo(t.elementType), t.type = e, typeof e == "function") Ni(e) ? (r = Sc(e, r), t.tag = 1, t = qc(null, t, e, r, n)) : (t.tag = 0, t = Gc(null, t, e, r, n));
					else {
						if (e != null) {
							var a = e.$$typeof;
							if (a === se) {
								t.tag = 11, t = Fc(null, t, e, r, n);
								break a;
							}
							if (a === ue) {
								t.tag = 14, t = Ic(null, t, e, r, n);
								break a;
							}
							if (a === O) {
								t.tag = 10, t.type = e, t = sl(null, t, n);
								break a;
							}
						}
						throw t = be(e) || e, Error(i(306, t, ""));
					}
				}
				return t;
			case 0: return Gc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, a = Sc(r, t.pendingProps), qc(e, t, r, a, n);
			case 3:
				a: {
					if (Me(t, t.stateNode.containerInfo), e === null) throw Error(i(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					a = o.element, ho(e, t), So(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, _a(t, Aa, r), r !== o.cache && ba(t, [Aa], n, !0), xo(), r = s.element, o.isDehydrated) {
						if (o = {
							element: r,
							isDehydrated: !1,
							cache: s.cache
						}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
							t = Jc(e, t, r, n);
							break a;
						}
						if (r !== a) {
							a = Hi(Error(i(424)), t), pa(a), t = Jc(e, t, r, n);
							break a;
						}
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (ra = lm(e.firstChild), na = t, V = !0, ia = null, aa = !0, n = fo(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 134221824, n = n.sibling;
					} else {
						if (da(), r === a) {
							t = cl(e, t, n);
							break a;
						}
						Pc(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return Wc(e, t), e === null ? (n = Nm(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : V || (t.stateNode = fp(t.type, t.pendingProps, Ae.current, t)) : t.memoizedState = Nm(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return Pe(t), e === null && V && (r = t.stateNode = hm(t.type, t.pendingProps, Ae.current), na = t, aa = !0, a = ra, Sp(t.type) ? (um = a, ra = lm(r.firstChild)) : ra = a), Pc(e, t, t.pendingProps.children, n), Wc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && V && ((a = r = ra) && (r = rm(r, t.type, t.pendingProps, aa), r === null ? a = !1 : (t.stateNode = r, na = t, ra = lm(r.firstChild), aa = !1, a = !0)), a || sa(t)), Pe(t), a = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, pp(a, o) ? r = null : s !== null && pp(a, s) && (t.flags |= 32), t.memoizedState !== null && (a = Qo(e, t, ts, null, null, n), sh._currentValue = a), Wc(e, t), Pc(e, t, r, n), t.child;
			case 6: return e === null && V && ((e = n = ra) && (n = im(n, t.pendingProps, aa), n === null ? e = !1 : (t.stateNode = n, na = t, ra = null, e = !0)), e || sa(t)), null;
			case 13: return Zc(e, t, n);
			case 4: return Me(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = uo(t, null, r, n) : Pc(e, t, r, n), t.child;
			case 11: return Fc(e, t, t.type, t.pendingProps, n);
			case 7: return r = t.pendingProps, Wc(e, t), Pc(e, t, r, n), t.child;
			case 8: return Pc(e, t, t.pendingProps.children, n), t.child;
			case 12: return Pc(e, t, t.pendingProps.children, n), t.child;
			case 10: return sl(e, t, n);
			case 9: return a = t.type._context, r = t.pendingProps.children, Ca(t), a = wa(a), r = r(a), t.flags |= 1, Pc(e, t, r, n), t.child;
			case 14: return Ic(e, t, t.type, t.pendingProps, n);
			case 15: return Lc(e, t, t.type, t.pendingProps, n);
			case 19: return ol(e, t, n);
			case 31: return Uc(e, t, n);
			case 22: return Rc(e, t, n, t.pendingProps);
			case 24: return Ca(t), r = wa(Aa), e === null ? (a = Ga(), a === null && (a = Qu, o = ja(), a.pooledCache = o, o.refCount++, o !== null && (a.pooledCacheLanes |= n), a = o), t.memoizedState = {
				parent: r,
				cache: a
			}, mo(t), _a(t, Aa, a)) : ((e.lanes & n) !== 0 && (ho(e, t), So(t, null, null, n), xo()), a = e.memoizedState, o = t.memoizedState, a.parent === r ? (r = o.cache, _a(t, Aa, r), r !== a.cache && ba(t, [Aa], n, !0)) : (a = {
				parent: r,
				cache: r
			}, t.memoizedState = a, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = a), _a(t, Aa, r))), Pc(e, t, t.pendingProps.children, n), t.child;
			case 30: return t.stateNode === null && (t.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}), r = t.pendingProps, r.name != null && r.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : V && $i(t), e !== null && e.memoizedProps.name !== r.name ? t.flags |= 4194816 : Wc(e, t), Pc(e, t, r.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(i(156, t.tag));
	}
	function fl(e) {
		e.flags |= 4;
	}
	function pl(e, t, n, r, i) {
		var a;
		if ((a = !!(e.mode & 32)) && (a = n === null ? Jm(t, r) : Jm(t, r) && (r.src !== n.src || r.srcSet !== n.srcSet)), a) {
			if (e.flags |= 16777216, (i & 335544128) === i) {
				if (e.stateNode.complete) e.flags |= 8192;
				else if (Vd()) e.flags |= 8192;
				else throw to = Za, Ya;
			}
		} else e.flags &= -16777217;
	}
	function ml(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Ym(t)) {
			if (Vd()) e.flags |= 8192;
			else throw to = Za, Ya;
		}
	}
	function hl(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : vt(), e.lanes |= t, cd |= t);
	}
	function gl(e, t) {
		if (!V) switch (e.tailMode) {
			case "visible": break;
			case "collapsed":
				for (var n = e.tail, r = null; n !== null;) n.alternate !== null && (r = n), n = n.sibling;
				r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
				break;
			default:
				for (t = e.tail, n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
				n === null ? e.tail = null : n.sibling = null;
		}
	}
	function _l(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 1206910976, r |= i.flags & 1206910976, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function vl(e, t, n) {
		var r = t.pendingProps;
		switch (ea(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return _l(t), null;
			case 1: return _l(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), va(Aa), Ne(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (ua(t) ? fl(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, fa())), _l(t), null;
			case 26:
				var a = t.type, o = t.memoizedState;
				return e === null ? (fl(t), o === null ? (_l(t), pl(t, a, null, r, n)) : (_l(t), ml(t, o))) : o ? o === e.memoizedState ? (_l(t), t.flags &= -16777217) : (fl(t), _l(t), ml(t, o)) : (e = e.memoizedProps, e !== r && fl(t), _l(t), pl(t, a, e, r, n)), null;
			case 27:
				if (Fe(t), n = Ae.current, a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && fl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return _l(t), t.subtreeFlags &= -33554433, null;
					}
					e = Oe.current, ua(t) ? ca(t, e) : (e = hm(a, r, n), t.stateNode = e, fl(t));
				}
				return _l(t), t.subtreeFlags &= -33554433, null;
			case 5:
				if (Fe(t), a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && fl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return _l(t), t.subtreeFlags &= -33554433, null;
					}
					if (o = Oe.current, ua(t)) ca(t, o);
					else {
						var s = lp(Ae.current);
						switch (o) {
							case 1:
								o = s.createElementNS("http://www.w3.org/2000/svg", a);
								break;
							case 2:
								o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
								break;
							default: switch (a) {
								case "svg":
									o = s.createElementNS("http://www.w3.org/2000/svg", a);
									break;
								case "math":
									o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
									break;
								case "script":
									o = s.createElement("div"), o.innerHTML = "<script><\/script>", o = o.removeChild(o.firstChild);
									break;
								case "select":
									o = typeof r.is == "string" ? s.createElement("select", { is: r.is }) : s.createElement("select"), r.multiple ? o.multiple = !0 : r.size && (o.size = r.size);
									break;
								default: o = typeof r.is == "string" ? s.createElement(a, { is: r.is }) : s.createElement(a);
							}
						}
						o[kt] = t, o[At] = r;
						a: for (s = t.child; s !== null;) {
							if (s.tag === 5 || s.tag === 6) o.appendChild(s.stateNode);
							else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
								s.child.return = s, s = s.child;
								continue;
							}
							if (s === t) break a;
							for (; s.sibling === null;) {
								if (s.return === null || s.return === t) break a;
								s = s.return;
							}
							s.sibling.return = s.return, s = s.sibling;
						}
						t.stateNode = o;
						a: switch (np(o, a, r), a) {
							case "button":
							case "input":
							case "select":
							case "textarea":
								r = !!r.autoFocus;
								break a;
							case "img":
								r = !0;
								break a;
							default: r = !1;
						}
						r && fl(t);
					}
				}
				return _l(t), t.subtreeFlags &= -33554433, pl(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && fl(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(i(166));
					if (e = Ae.current, ua(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, a = na, a !== null) switch (a.tag) {
							case 27:
							case 5: r = a.memoizedProps;
						}
						e[kt] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || $f(e.nodeValue, n)), e || sa(t, !0);
					} else e = lp(e).createTextNode(r), e[kt] = t, t.stateNode = e;
				}
				return _l(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = ua(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(i(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(557));
							e[kt] = t;
						} else da(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						_l(t), e = !1;
					} else n = fa(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (Io(t), t) : (Io(t), null);
					if (t.flags & 128) throw Error(i(558));
				}
				return _l(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (a = ua(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!a) throw Error(i(318));
							if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error(i(317));
							a[kt] = t;
						} else da(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						_l(t), a = !1;
					} else a = fa(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), a = !0;
					if (!a) return t.flags & 256 ? (Io(t), t) : (Io(t), null);
				}
				return Io(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, a = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (a = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== a && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), hl(t, t.updateQueue), _l(t), null);
			case 4: return Ne(), e === null && Uf(t.stateNode.containerInfo), t.flags |= 67108864, _l(t), null;
			case 10: return va(t.type), _l(t), null;
			case 19:
				if (zo(t), r = t.memoizedState, r === null) return _l(t), null;
				if (a = !!(t.flags & 128), o = r.rendering, o === null) {
					if (a) gl(r, !1);
					else {
						if (rd !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
							if (o = Bo(e), o !== null) {
								for (t.flags |= 128, gl(r, !1), e = o.updateQueue, t.updateQueue = e, hl(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) Fi(n, e), n = n.sibling;
								return Ro(t, Lo.current & 1 | 2), V && Zi(t, r.treeForkCount), t.child;
							}
							e = e.sibling;
						}
						r.tail !== null && Je() > md && (t.flags |= 128, a = !0, gl(r, !1), t.lanes = 4194304);
					}
				} else {
					if (!a) {
						if (e = Bo(o), e !== null) {
							if (t.flags |= 128, a = !0, e = e.updateQueue, t.updateQueue = e, hl(t, e), gl(r, !0), r.tail === null && r.tailMode !== "collapsed" && r.tailMode !== "visible" && !o.alternate && !V) return _l(t), null;
						} else 2 * Je() - r.renderingStartTime > md && n !== 536870912 && (t.flags |= 128, a = !0, gl(r, !1), t.lanes = 4194304);
					}
					r.isBackwards ? (o.sibling = t.child, t.child = o) : (e = r.last, e === null ? t.child = o : e.sibling = o, r.last = o);
				}
				if (r.tail !== null) {
					e = r.tail;
					a: {
						for (n = e; n !== null;) {
							if (n.alternate !== null) {
								n = !1;
								break a;
							}
							n = n.sibling;
						}
						n = !0;
					}
					return r.rendering = e, r.tail = e.sibling, r.renderingStartTime = Je(), e.sibling = null, o = Lo.current, o = a ? o & 1 | 2 : o & 1, r.tailMode === "visible" || r.tailMode === "collapsed" || !n || V ? Ro(t, o) : (n = o, De(Ao, t), De(Lo, n), jo === null && (jo = t)), V && Zi(t, r.treeForkCount), e;
				}
				return _l(t), null;
			case 22:
			case 23: return Io(t), ko(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (_l(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : _l(t), n = t.updateQueue, n !== null && hl(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && Ee(Wa), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), va(Aa), _l(t), null;
			case 25: return null;
			case 30: return t.flags |= 33554432, _l(t), null;
		}
		throw Error(i(156, t.tag));
	}
	function yl(e, t) {
		switch (ea(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return va(Aa), Ne(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return Fe(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (Io(t), t.alternate === null) throw Error(i(340));
					da();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (Io(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(i(340));
					da();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return zo(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
			case 4: return Ne(), null;
			case 10: return va(t.type), null;
			case 22:
			case 23: return Io(t), ko(), e !== null && Ee(Wa), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return va(Aa), null;
			case 25: return null;
			default: return null;
		}
	}
	function bl(e, t) {
		switch (ea(t), t.tag) {
			case 3:
				va(Aa), Ne();
				break;
			case 26:
			case 27:
			case 5:
				Fe(t);
				break;
			case 4:
				Ne();
				break;
			case 31:
				t.memoizedState !== null && Io(t);
				break;
			case 13:
				Io(t);
				break;
			case 19:
				zo(t);
				break;
			case 10:
				va(t.type);
				break;
			case 22:
			case 23:
				Io(t), ko(), e !== null && Ee(Wa);
				break;
			case 24: va(Aa);
		}
	}
	function xl(e, t) {
		try {
			var n = t.updateQueue, r = n === null ? null : n.lastEffect;
			if (r !== null) {
				var i = r.next;
				n = i;
				do {
					if ((n.tag & e) === e) {
						r = void 0;
						var a = n.create, o = n.inst;
						r = a(), o.destroy = r;
					}
					n = n.next;
				} while (n !== i);
			}
		} catch (e) {
			ff(t, t.return, e);
		}
	}
	function Sl(e, t, n) {
		try {
			var r = t.updateQueue, i = r === null ? null : r.lastEffect;
			if (i !== null) {
				var a = i.next;
				r = a;
				do {
					if ((r.tag & e) === e) {
						var o = r.inst, s = o.destroy;
						if (s !== void 0) {
							o.destroy = void 0, i = t;
							var c = n, l = s;
							try {
								l();
							} catch (e) {
								ff(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			ff(t, t.return, e);
		}
	}
	function Cl(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				wo(t, n);
			} catch (t) {
				ff(e, e.return, t);
			}
		}
	}
	function wl(e, t, n) {
		n.props = Sc(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			ff(e, t, n);
		}
	}
	function Tl(e, t) {
		try {
			var n = e.ref;
			if (n !== null) {
				switch (e.tag) {
					case 26:
					case 27:
					case 5:
						var r = e.stateNode;
						break;
					case 30:
						var i = e.stateNode, a = vi(e.memoizedProps, i);
						(i.ref === null || i.ref.name !== a) && (i.ref = Pp(a)), r = i.ref;
						break;
					case 7:
						if (e.stateNode === null) {
							var o = new Fp(e);
							h(e.child, !1, Qp, o, void 0, void 0), e.stateNode = o;
						}
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			ff(e, t, n);
		}
	}
	function El(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) {
			if (typeof r == "function") try {
				r();
			} catch (n) {
				ff(e, t, n);
			} finally {
				e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
			}
			else if (typeof n == "function") try {
				n(null);
			} catch (n) {
				ff(e, t, n);
			}
			else n.current = null;
		}
	}
	function Dl(e, t) {
		if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var n = 0; n < t.length; n++) em(e.stateNode, t[n]);
	}
	function Ol(e) {
		for (var t = e.return; t !== null && (jl(t) && em(e.stateNode, t.stateNode), !Al(t));) t = t.return;
	}
	function kl(e) {
		for (var t = e.return; t !== null && (jl(t) && tm(e.stateNode, t.stateNode), !Al(t));) t = t.return;
	}
	function Al(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 27;
	}
	function jl(e) {
		return e && e.tag === 7 && e.stateNode !== null;
	}
	function Ml(e) {
		var t = e.type, n = e.memoizedProps, r = e.stateNode;
		try {
			a: switch (t) {
				case "button":
				case "input":
				case "select":
				case "textarea":
					n.autoFocus && r.focus();
					break a;
				case "img": n.src ? r.src = n.src : n.srcSet && (r.srcset = n.srcSet);
			}
		} catch (t) {
			ff(e, e.return, t);
		}
	}
	function Nl(e, t, n) {
		try {
			var r = e.stateNode;
			ip(r, e.type, n, t), r[At] = t;
		} catch (t) {
			ff(e, e.return, t);
		}
	}
	function Pl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Sp(e.type) || e.tag === 4;
	}
	function Fl(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Pl(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Sp(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Il(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(i, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(i), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = Cn)), Dl(e, r), N = !0;
		else if (i !== 4 && (i === 27 && (Dl(e, r), r = null, Sp(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null)) for (Il(e, t, n, r), e = e.sibling; e !== null;) Il(e, t, n, r), e = e.sibling;
	}
	function Ll(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? n.insertBefore(i, t) : n.appendChild(i), Dl(e, r), N = !0;
		else if (i !== 4 && (i === 27 && (Dl(e, r), r = null, Sp(e.type) && (n = e.stateNode)), e = e.child, e !== null)) for (Ll(e, t, n, r), e = e.sibling; e !== null;) Ll(e, t, n, r), e = e.sibling;
	}
	function Rl(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			np(t, r, n), t[kt] = e, t[At] = n;
		} catch (t) {
			ff(e, e.return, t);
		}
	}
	var zl = !1, Bl = null;
	function Vl(e) {
		(e.tag === 30 || e.subtreeFlags & 33554432) && (zl = !0);
	}
	var Hl = null;
	function Ul() {
		var e = Hl;
		return Hl = null, e;
	}
	var Wl = 0;
	function Gl(e, t, n, r, i) {
		return Wl = 0, Kl(e.child, t, n, r, i);
	}
	function Kl(e, t, n, r, i) {
		for (var a = !1; e !== null;) {
			if (e.tag === 5) {
				var o = e.stateNode;
				if (r !== null) {
					var s = Op(o);
					r.push(s), s.view && (a = !0);
				} else a || Op(o).view && (a = !0);
				zl = !0, Tp(o, Wl === 0 ? t : t + "_" + Wl, n), Wl++;
			} else e.tag === 22 && e.memoizedState !== null || e.tag === 30 && i || Kl(e.child, t, n, r, i) && (a = !0);
			e = e.sibling;
		}
		return a;
	}
	function ql(e, t) {
		for (; e !== null;) e.tag === 5 ? Ep(e.stateNode, e.memoizedProps) : e.tag === 22 && e.memoizedState !== null || e.tag === 30 && t || ql(e.child, t), e = e.sibling;
	}
	function Jl(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if ((e.tag !== 22 || e.memoizedState === null) && (Jl(e), e.tag === 30 && e.flags & 18874368 && e.stateNode.paired)) {
				var t = e.memoizedProps;
				if (t.name == null || t.name === "auto") throw Error(i(544));
				var n = t.name;
				t = bi(t.default, t.share), t !== "none" && (Gl(e, n, t, null, !1) || ql(e.child, !1));
			}
			e = e.sibling;
		}
	}
	function Yl(e, t) {
		if (e.tag === 30) {
			var n = e.stateNode, r = e.memoizedProps, i = vi(r, n), a = bi(r.default, n.paired ? r.share : r.enter);
			a === "none" ? Jl(e) : Gl(e, i, a, null, !1) ? (Jl(e), n.paired || t || jd(e, r.onEnter)) : ql(e.child, !1);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Yl(e, t), e = e.sibling;
		else Jl(e);
	}
	function Xl(e) {
		if (Bl !== null && Bl.size !== 0) {
			var t = Bl;
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if (e.tag !== 22 || e.memoizedState === null) {
					if (e.tag === 30 && e.flags & 18874368) {
						var n = e.memoizedProps, r = n.name;
						if (r != null && r !== "auto") {
							var i = t.get(r);
							if (i !== void 0) {
								var a = bi(n.default, n.share);
								if (a !== "none" && (Gl(e, r, a, null, !1) ? (a = e.stateNode, i.paired = a, a.paired = i, jd(e, n.onShare)) : ql(e.child, !1)), t.delete(r), t.size === 0) break;
							}
						}
					}
					Xl(e);
				}
				e = e.sibling;
			}
		}
	}
	function Zl(e) {
		if (e.tag === 30) {
			var t = e.memoizedProps, n = vi(t, e.stateNode), r = Bl === null ? void 0 : Bl.get(n), i = bi(t.default, r === void 0 ? t.exit : t.share);
			i !== "none" && (Gl(e, n, i, null, !1) ? r === void 0 ? jd(e, t.onExit) : (i = e.stateNode, r.paired = i, i.paired = r, Bl.delete(n), jd(e, t.onShare)) : ql(e.child, !1)), Bl !== null && Xl(e);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Zl(e), e = e.sibling;
		else Bl !== null && Xl(e);
	}
	function Ql(e) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var t = e.memoizedProps, n = vi(t, e.stateNode);
				t = bi(t.default, t.update), e.flags &= -5, t !== "none" && Gl(e, n, t, e.memoizedState = [], !1);
			} else e.subtreeFlags & 33554432 && Ql(e);
			e = e.sibling;
		}
	}
	function $l(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if (e.tag !== 22 || e.memoizedState === null) {
				if (e.tag === 30 && e.flags & 18874368) {
					var t = e.stateNode;
					t.paired !== null && (t.paired = null, ql(e.child, !1));
				}
				$l(e);
			}
			e = e.sibling;
		}
	}
	function eu(e) {
		if (e.tag === 30) e.stateNode.paired = null, ql(e.child, !1), $l(e);
		else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) eu(e), e = e.sibling;
		else $l(e);
	}
	function tu(e) {
		for (e = e.child; e !== null;) e.tag === 30 ? ql(e.child, !1) : e.subtreeFlags & 33554432 && tu(e), e = e.sibling;
	}
	function nu(e, t, n, r, i, a, o) {
		for (var s = !1; t !== null;) {
			if (t.tag === 5) {
				var c = t.stateNode;
				if (a !== null && Wl < a.length) {
					var l = a[Wl], u = Op(c);
					(l.view || u.view) && (s = !0);
					var d;
					if (d = !(e.flags & 4)) {
						if (u.clip) d = !0;
						else {
							d = l.rect;
							var f = u.rect;
							d = d.y !== f.y || d.x !== f.x || d.height !== f.height || d.width !== f.width;
						}
					}
					d && (e.flags |= 4), u.abs ? u = !l.abs : (l = l.rect, u = u.rect, u = l.height !== u.height || l.width !== u.width), u && (e.flags |= 32);
				} else e.flags |= 32;
				e.flags & 4 && Tp(c, Wl === 0 ? n : n + "_" + Wl, i), s && e.flags & 4 || (Hl === null && (Hl = []), Hl.push(c, Wl === 0 ? r : r + "_" + Wl, t.memoizedProps)), Wl++;
			} else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && o ? e.flags |= t.flags & 32 : nu(e, t.child, n, r, i, a, o) && (s = !0));
			t = t.sibling;
		}
		return s;
	}
	function ru(e, t) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var n = e.memoizedProps, r = e.stateNode, i = vi(n, r), a = bi(n.default, n.update);
				if (t) {
					r = r.clones;
					var o = r === null ? null : r.map(kp);
				} else o = e.memoizedState, e.memoizedState = null;
				r = e;
				var s = e.child;
				Wl = 0, i = nu(r, s, i, i, a, o, !1), e.flags & 4 && i && (t || jd(e, n.onUpdate));
			} else e.subtreeFlags & 33554432 && ru(e, t);
			e = e.sibling;
		}
	}
	var iu = !1, G = !1, au = !1, ou = !1, su = typeof WeakSet == "function" ? WeakSet : Set, cu = null, lu = !1, uu = !1, du = !1, fu = !1;
	function pu(e, t, n) {
		if (e = e.containerInfo, sp = gh, e = Xr(e), L(e)) {
			if ("selectionStart" in e) var r = {
				start: e.selectionStart,
				end: e.selectionEnd
			};
			else a: {
				r = (r = e.ownerDocument) && r.defaultView || window;
				var i = r.getSelection && r.getSelection();
				if (i && i.rangeCount !== 0) {
					r = i.anchorNode;
					var a = i.anchorOffset, o = i.focusNode;
					i = i.focusOffset;
					try {
						r.nodeType, o.nodeType;
					} catch {
						r = null;
						break a;
					}
					var s = 0, c = -1, l = -1, u = 0, d = 0, f = e, p = null;
					b: for (;;) {
						for (var m; f !== r || a !== 0 && f.nodeType !== 3 || (c = s + a), f !== o || i !== 0 && f.nodeType !== 3 || (l = s + i), f.nodeType === 3 && (s += f.nodeValue.length), (m = f.firstChild) !== null;) p = f, f = m;
						for (;;) {
							if (f === e) break b;
							if (p === r && ++u === a && (c = s), p === o && ++d === i && (l = s), (m = f.nextSibling) !== null) break;
							f = p, p = f.parentNode;
						}
						f = m;
					}
					r = c === -1 || l === -1 ? null : {
						start: c,
						end: l
					};
				} else r = null;
			}
			r ||= {
				start: 0,
				end: 0
			};
		} else r = null;
		for (cp = {
			focusedElem: e,
			selectionRange: r
		}, gh = !1, n = (n & 335544064) === n, cu = t, t = n ? 9270 : 1024; cu !== null;) {
			if (e = cu, n && (r = e.deletions, r !== null)) for (a = 0; a < r.length; a++) n && Zl(r[a]);
			if (e.alternate === null && e.flags & 2) n && Vl(e), K(n);
			else {
				if (e.tag === 22) {
					if (r = e.alternate, e.memoizedState !== null) {
						r !== null && r.memoizedState === null && n && Zl(r), K(n);
						continue;
					}
					if (r !== null && r.memoizedState !== null) {
						n && Vl(e), K(n);
						continue;
					}
				}
				r = e.child, (e.subtreeFlags & t) !== 0 && r !== null ? (r.return = e, cu = r) : (n && Ql(e), K(n));
			}
		}
		Bl = null;
	}
	function K(e) {
		for (; cu !== null;) {
			var t = cu, n = e, r = t.alternate, a = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15: break;
				case 1:
					if (a & 1024 && r !== null) {
						n = void 0, a = r.memoizedProps, r = r.memoizedState;
						var o = t.stateNode;
						try {
							var s = Sc(t.type, a);
							n = o.getSnapshotBeforeUpdate(s, r), o.__reactInternalSnapshotBeforeUpdate = n;
						} catch (e) {
							ff(t, t.return, e);
						}
					}
					break;
				case 3:
					if (a & 1024) {
						if (r = t.stateNode.containerInfo, n = r.nodeType, n === 9) nm(r);
						else if (n === 1) switch (r.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								nm(r);
								break;
							default: r.textContent = "";
						}
					}
					break;
				case 5:
				case 26:
				case 27:
				case 6:
				case 4:
				case 17: break;
				case 30:
					n && r !== null && (n = vi(r.memoizedProps, r.stateNode), a = t.memoizedProps, a = bi(a.default, a.update), a !== "none" && Gl(r, n, a, r.memoizedState = [], !0));
					break;
				default: if (a & 1024) throw Error(i(163));
			}
			if (r = t.sibling, r !== null) {
				r.return = t.return, cu = r;
				break;
			}
			cu = t.return;
		}
	}
	function mu(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				Pu(e, n), r & 4 && xl(5, n);
				break;
			case 1:
				if (Pu(e, n), r & 4) {
					if (e = n.stateNode, t === null) try {
						e.componentDidMount();
					} catch (e) {
						ff(n, n.return, e);
					}
					else {
						var i = Sc(n.type, t.memoizedProps);
						t = t.memoizedState;
						try {
							e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
						} catch (e) {
							ff(n, n.return, e);
						}
					}
				}
				r & 64 && Cl(n), r & 512 && Tl(n, n.return);
				break;
			case 3:
				if (Pu(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						wo(e, t);
					} catch (e) {
						ff(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && Rl(n);
			case 26:
			case 5:
				Pu(e, n), t === null && r & 4 && Ml(n), r & 512 && Tl(n, n.return);
				break;
			case 12:
				Pu(e, n);
				break;
			case 31:
				Pu(e, n), r & 4 && Cu(e, n);
				break;
			case 13:
				Pu(e, n), r & 4 && wu(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = gf.bind(null, n), cm(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || iu, !r) {
					var a = t !== null && t.memoizedState !== null || G;
					t = iu, i = G, iu = r, (G = a) && !i ? (r = 2, n.subtreeFlags & 8772 && (r |= 1), Iu(e, n, r)) : Pu(e, n), iu = t, G = i;
				}
				break;
			case 30:
				Pu(e, n), r & 512 && Tl(n, n.return);
				break;
			case 7: r & 512 && Tl(n, n.return);
			default: Pu(e, n);
		}
	}
	function hu(e, t) {
		for (e = e.child; e !== null;) gu(e, t), e = e.sibling;
	}
	function gu(e, t) {
		switch (e.tag) {
			case 5:
			case 26:
				try {
					var n = e.stateNode;
					if (t) {
						var r = n.style;
						typeof r.setProperty == "function" ? r.setProperty("display", "none", "important") : r.display = "none";
					} else {
						var i = e.stateNode, a = e.memoizedProps.style, o = a != null && a.hasOwnProperty("display") ? a.display : null;
						i.style.display = o == null || typeof o == "boolean" ? "" : ("" + o).trim();
					}
				} catch (t) {
					ff(e, e.return, t);
				}
				_u(e, t);
				break;
			case 6:
				try {
					e.stateNode.nodeValue = t ? "" : e.memoizedProps, N = !0;
				} catch (t) {
					ff(e, e.return, t);
				}
				break;
			case 18:
				try {
					var s = e.stateNode;
					t ? wp(s, !0) : wp(e.stateNode, !1);
				} catch (t) {
					ff(e, e.return, t);
				}
				break;
			case 22:
			case 23:
				e.memoizedState === null && hu(e, t);
				break;
			default: hu(e, t);
		}
	}
	function _u(e, t) {
		if (e.subtreeFlags & 67108864) for (e = e.child; e !== null;) {
			a: {
				var n = e, r = t;
				switch (n.tag) {
					case 4:
						gu(n, r);
						break a;
					case 22:
						n.memoizedState === null && _u(n, r);
						break a;
					default: _u(n, r);
				}
			}
			e = e.sibling;
		}
	}
	function vu(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, vu(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Rt(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var yu = null, bu = !1;
	function xu(e, t, n) {
		for (n = n.child; n !== null;) Su(e, t, n), n = n.sibling;
	}
	function Su(e, t, n) {
		if (it && typeof it.onCommitFiberUnmount == "function") try {
			it.onCommitFiberUnmount(rt, n);
		} catch {}
		switch (n.tag) {
			case 26:
				G || El(n, t), xu(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !G && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				G || El(n, t), kl(n);
				var r = yu, i = bu;
				Sp(n.type) && (yu = n.stateNode, bu = !1), xu(e, t, n), gm(n.stateNode, n.type, n.memoizedProps), yu = r, bu = i;
				break;
			case 5: G || El(n, t), kl(n);
			case 6:
				if (n.tag === 6 && kl(n), r = yu, i = bu, yu = null, xu(e, t, n), yu = r, bu = i, yu !== null) {
					if (bu) try {
						(yu.nodeType === 9 ? yu.body : yu.nodeName === "HTML" ? yu.ownerDocument.body : yu).removeChild(n.stateNode), N = !0;
					} catch (e) {
						ff(n, t, e);
					}
					else try {
						yu.removeChild(n.stateNode), N = !0;
					} catch (e) {
						ff(n, t, e);
					}
				}
				break;
			case 18:
				yu !== null && (bu ? (e = yu, Cp(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Hh(e)) : Cp(yu, n.stateNode));
				break;
			case 4:
				r = yu, i = bu, yu = n.stateNode.containerInfo, bu = !0, xu(e, t, n), yu = r, bu = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				Sl(2, n, t), G || Sl(4, n, t), xu(e, t, n);
				break;
			case 1:
				G || (El(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && wl(n, t, r)), xu(e, t, n);
				break;
			case 21:
				xu(e, t, n);
				break;
			case 22:
				G = (r = G) || n.memoizedState !== null, xu(e, t, n), G = r;
				break;
			case 30:
				El(n, t), xu(e, t, n);
				break;
			case 7:
				G || El(n, t), xu(e, t, n);
				break;
			default: xu(e, t, n);
		}
	}
	function Cu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Hh(e);
			} catch (e) {
				ff(t, t.return, e);
			}
		}
	}
	function wu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Hh(e);
		} catch (e) {
			ff(t, t.return, e);
		}
	}
	function Tu(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new su()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new su()), t;
			default: throw Error(i(435, e.tag));
		}
	}
	function Eu(e, t) {
		var n = Tu(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = _f.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function Du(e, t, n) {
		var r = t.deletions;
		if (r !== null) for (var a = 0; a < r.length; a++) {
			var o = r[a], s = e, c = t, l = c;
			a: for (; l !== null;) {
				switch (l.tag) {
					case 27:
						if (Sp(l.type)) {
							yu = l.stateNode, bu = !1;
							break a;
						}
						break;
					case 5:
						yu = l.stateNode, bu = !1;
						break a;
					case 3:
					case 4:
						yu = l.stateNode.containerInfo, bu = !0;
						break a;
				}
				l = l.return;
			}
			if (yu === null) throw Error(i(160));
			Su(s, c, o), yu = null, bu = !1, s = o.alternate, s !== null && (s.return = null), o.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) ku(t, e, n), t = t.sibling;
	}
	var Ou = null;
	function ku(e, t, n) {
		var r = e.alternate, a = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				if (a & 4 && (r = e.updateQueue, r = r === null ? null : r.events, r !== null)) for (var o = 0; o < r.length; o++) {
					var s = r[o];
					s.ref.impl = s.nextImpl;
				}
				Du(t, e, n), Au(e), a & 4 && (Sl(3, e, e.return), xl(3, e), Sl(5, e, e.return));
				break;
			case 1:
				Du(t, e, n), Au(e), a & 512 && (G || r === null || El(r, r.return)), a & 64 && iu && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
				break;
			case 26:
				if (o = Ou, Du(t, e, n), Au(e), a & 512 && (G || r === null || El(r, r.return)), a & 4) {
					if (a = r === null ? null : r.memoizedState, n = e.memoizedState, r === null) {
						if (n === null) {
							if (e.stateNode === null) {
								if (iu) e.stateNode = fp(e.type, e.memoizedProps, t.containerInfo, e);
								else {
									a: {
										t = e.type, n = e.memoizedProps, a = o.ownerDocument || o;
										b: switch (t) {
											case "title":
												r = a.getElementsByTagName("title")[0], (!r || r[It] || r[kt] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = a.createElement(t), a.head.insertBefore(r, a.querySelector("head > title"))), np(r, t, n), r[kt] = e, Ut(r), t = r;
												break a;
											case "link":
												if (o = Gm("link", "href", a).get(t + (n.href || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && r.getAttribute("rel") === (n.rel == null ? null : n.rel) && r.getAttribute("title") === (n.title == null ? null : n.title) && r.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), np(r, t, n), a.head.appendChild(r);
												break;
											case "meta":
												if (o = Gm("meta", "content", a).get(t + (n.content || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("content") === (n.content == null ? null : "" + n.content) && r.getAttribute("name") === (n.name == null ? null : n.name) && r.getAttribute("property") === (n.property == null ? null : n.property) && r.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && r.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), np(r, t, n), a.head.appendChild(r);
												break;
											default: throw Error(i(468, t));
										}
										r[kt] = e, Ut(r), t = r;
									}
									e.stateNode = t;
								}
							} else iu || Km(o, e.type, e.stateNode);
						} else e.stateNode = Bm(o, n, e.memoizedProps);
					} else a === n ? n === null && e.stateNode !== null && Nl(e, e.memoizedProps, r.memoizedProps) : (a === null ? (t = r.stateNode, t === null || G || t.parentNode.removeChild(t)) : a.count--, n === null ? iu || Km(o, e.type, e.stateNode) : Bm(o, n, e.memoizedProps));
				}
				break;
			case 27:
				Du(t, e, n), Au(e), a & 512 && (G || r === null || El(r, r.return)), r !== null && a & 4 && Nl(e, e.memoizedProps, r.memoizedProps);
				break;
			case 5:
				if (o = au, au = !1, Du(t, e, n), au = o, Au(e), a & 512 && (G || r === null || El(r, r.return)), e.flags & 32) {
					t = e.stateNode;
					try {
						hn(t, ""), N = !0;
					} catch (t) {
						ff(e, e.return, t);
					}
				}
				a & 4 && e.stateNode != null && (t = e.memoizedProps, Nl(e, t, r === null ? t : r.memoizedProps)), a & 1024 && (ou = !0);
				break;
			case 6:
				if (Du(t, e, n), Au(e), a & 4) {
					if (e.stateNode === null) throw Error(i(162));
					t = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = t, N = !0;
					} catch (t) {
						ff(e, e.return, t);
					}
				}
				break;
			case 3:
				if (N = !1, Wm = null, o = Ou, Ou = bm(t.containerInfo), Du(t, e, n), Ou = o, Au(e), a & 4 && r !== null && r.memoizedState.isDehydrated) try {
					Hh(t.containerInfo);
				} catch (t) {
					ff(e, e.return, t);
				}
				ou && (ou = !1, ju(e)), N = !1;
				break;
			case 4:
				a = au, au = iu, r = Qt(), o = Ou, Ou = bm(e.stateNode.containerInfo), Du(t, e, n), Au(e), Ou = o, N && uu && (du = !0), N = r, au = a;
				break;
			case 12:
				Du(t, e, n), Au(e);
				break;
			case 31:
				Du(t, e, n), Au(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Eu(e, t)));
				break;
			case 13:
				Du(t, e, n), Au(e), e.child.flags & 8192 && e.memoizedState !== null != (r !== null && r.memoizedState !== null) && (fd = Je()), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Eu(e, t)));
				break;
			case 22:
				o = e.memoizedState !== null, s = r !== null && r.memoizedState !== null;
				var c = iu, l = G, u = au;
				iu = c || o, au = u || o, G = l || s, Du(t, e, n), G = l, au = u, iu = c, Au(e), a & 8192 && (t = e.stateNode, t._visibility = o ? t._visibility & -2 : t._visibility | 1, !o || r === null || s || iu || G || (t = s || G, n = iu, r = G, iu = o || iu, G = t, Fu(e, 2), iu = n, G = r), !o && au || hu(e, o)), a & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, Eu(e, n))));
				break;
			case 19:
				Du(t, e, n), Au(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Eu(e, t)));
				break;
			case 30:
				a & 512 && (G || r === null || El(r, r.return)), a = Qt(), o = uu, s = (n & 335544064) === n, c = e.memoizedProps, uu = s && bi(c.default, c.update) !== "none", Du(t, e, n), Au(e), s && r !== null && N && (e.flags |= 4), uu = o, N = a;
				break;
			case 21: break;
			case 7: a & 512 && (G || r === null || El(r, r.return)), r && r.stateNode !== null && (r.stateNode._fragmentFiber = e);
			default: Du(t, e, n), Au(e);
		}
	}
	function Au(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Pl(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				r = null;
				for (var a = e.return; a !== null;) {
					if (jl(a)) {
						var o = a.stateNode;
						r === null ? r = [o] : r.push(o);
					}
					if (Al(a)) break;
					a = a.return;
				}
				var s = r;
				if (n == null) throw Error(i(160));
				switch (n.tag) {
					case 27:
						var c = n.stateNode;
						Ll(e, Fl(e), c, s);
						break;
					case 5:
						var l = n.stateNode;
						n.flags & 32 && (hn(l, ""), n.flags &= -33), Ll(e, Fl(e), l, s);
						break;
					case 3:
					case 4:
						var u = n.stateNode.containerInfo;
						Il(e, Fl(e), u, s);
						break;
					default: throw Error(i(161));
				}
			} catch (t) {
				ff(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function ju(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			ju(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, gh = !0, t.reset(), gh = !1), e = e.sibling;
		}
	}
	function Mu(e, t) {
		if (t.subtreeFlags & 9270) for (t = t.child; t !== null;) Nu(t, e), t = t.sibling;
		else ru(t, !1);
	}
	function Nu(e, t) {
		var n = e.alternate;
		if (n === null) Yl(e, !1);
		else switch (e.tag) {
			case 3:
				if (fu = lu = !1, Ul(), Mu(t, e), !lu && !du) {
					if (e = Hl, e !== null) for (var r = 0; r < e.length; r += 3) {
						n = e[r];
						var i = e[r + 1];
						Ep(n, e[r + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate({
							opacity: [0, 0],
							pointerEvents: ["none", "none"]
						}, {
							duration: 0,
							fill: "forwards",
							pseudoElement: "::view-transition-group(" + i + ")"
						});
					}
					e = t.containerInfo, e = e.nodeType === 9 ? e.documentElement : e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "" && (e.style.viewTransitionName = "none", e.animate({
						opacity: [0, 0],
						pointerEvents: ["none", "none"]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition-group(root)"
					}), e.animate({
						width: [0, 0],
						height: [0, 0]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition"
					})), fu = !0;
				}
				Hl = null;
				break;
			case 5:
				Mu(t, e);
				break;
			case 4:
				r = lu, lu = !1, Mu(t, e), lu && (du = !0), lu = r;
				break;
			case 22:
				e.memoizedState === null && (n.memoizedState === null ? Mu(t, e) : Yl(e, !1));
				break;
			case 30:
				r = lu, i = Ul(), lu = !1, Mu(t, e), lu && (e.flags |= 4);
				var a = e.memoizedProps, o = e.stateNode;
				t = vi(a, o), o = vi(n.memoizedProps, o);
				var s = bi(a.default, a.update);
				s === "none" ? t = !1 : (a = n.memoizedState, n.memoizedState = null, n = e.child, Wl = 0, t = nu(e, n, t, o, s, a, !0), Wl !== (a === null ? 0 : a.length) && (e.flags |= 32)), e.flags & 4 && t ? (jd(e, e.memoizedProps.onUpdate), Hl = i) : i !== null && (i.push.apply(i, Hl), Hl = i), lu = e.flags & 32 ? !0 : r;
				break;
			default: Mu(t, e);
		}
	}
	function Pu(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) mu(e, t.alternate, t), t = t.sibling;
	}
	function Fu(e, t) {
		for (e = e.child; e !== null;) {
			var n = e, r = t;
			switch (n.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Sl(4, n, n.return), Fu(n, r);
					break;
				case 1:
					El(n, n.return);
					var i = n.stateNode;
					typeof i.componentWillUnmount == "function" && wl(n, n.return, i), Fu(n, r);
					break;
				case 27: r & 2 && gm(n.stateNode, n.type, n.memoizedProps);
				case 5:
					El(n, n.return), n.tag !== 5 && n.tag !== 27 || kl(n), Fu(n, r);
					break;
				case 6:
					kl(n);
					break;
				case 26:
					El(n, n.return), i = n.stateNode, n.memoizedState !== null || i === null || G || i.parentNode.removeChild(i), Fu(n, r);
					break;
				case 22:
					n.memoizedState === null && Fu(n, r);
					break;
				case 30:
					El(n, n.return), Fu(n, r);
					break;
				case 7: El(n, n.return);
				default: Fu(n, r);
			}
			e = e.sibling;
		}
	}
	function Iu(e, t, n) {
		for (n = t.subtreeFlags & 8772 ? n : n & -2, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags, s = !!(n & 1);
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					Iu(i, a, n), xl(4, a);
					break;
				case 1:
					if (Iu(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						ff(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var c = r.stateNode;
						try {
							var l = i.shared.hiddenCallbacks;
							if (l !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < l.length; i++) Co(l[i], c);
						} catch (e) {
							ff(r, r.return, e);
						}
					}
					s && o & 64 && Cl(a), Tl(a, a.return);
					break;
				case 27: n & 2 && Rl(a);
				case 5:
					a.tag !== 5 && a.tag !== 27 || Ol(a), Iu(i, a, n), s && r === null && o & 4 && Ml(a), Tl(a, a.return);
					break;
				case 6:
					Ol(a);
					break;
				case 26:
					c = a.stateNode, a.memoizedState !== null || c === null || iu || Km(bm(c.ownerDocument), a.type, c), Iu(i, a, n), s && r === null && o & 4 && Ml(a), Tl(a, a.return);
					break;
				case 12:
					Iu(i, a, n);
					break;
				case 31:
					Iu(i, a, n), s && o & 4 && Cu(i, a);
					break;
				case 13:
					Iu(i, a, n), s && o & 4 && wu(i, a);
					break;
				case 22:
					a.memoizedState === null && Iu(i, a, n), Tl(a, a.return);
					break;
				case 30:
					Iu(i, a, n), Tl(a, a.return);
					break;
				case 7: Tl(a, a.return);
				default: Iu(i, a, n);
			}
			t = t.sibling;
		}
	}
	function Lu(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Ma(n));
	}
	function Ru(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Ma(e));
	}
	function zu(e, t, n, r) {
		var i = (n & 335544064) === n;
		if (t.subtreeFlags & (i ? 10262 : 10256)) for (t = t.child; t !== null;) Bu(e, t, n, r), t = t.sibling;
		else i && tu(t);
	}
	function Bu(e, t, n, r) {
		var i = (n & 335544064) === n;
		i && t.alternate === null && t.return !== null && t.return.alternate !== null && eu(t);
		var a = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				zu(e, t, n, r), a & 2048 && xl(9, t);
				break;
			case 1:
				zu(e, t, n, r);
				break;
			case 3:
				zu(e, t, n, r), i && fu && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), a & 2048 && (a = null, t.alternate !== null && (a = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== a && (t.refCount++, a != null && Ma(a)));
				break;
			case 12:
				if (a & 2048) {
					zu(e, t, n, r), a = t.stateNode;
					try {
						var o = t.memoizedProps, s = o.id, c = o.onPostCommit;
						typeof c == "function" && c(s, t.alternate === null ? "mount" : "update", a.passiveEffectDuration, -0);
					} catch (e) {
						ff(t, t.return, e);
					}
				} else zu(e, t, n, r);
				break;
			case 31:
				zu(e, t, n, r);
				break;
			case 13:
				zu(e, t, n, r);
				break;
			case 23: break;
			case 22:
				o = t.stateNode, s = t.alternate, t.memoizedState === null ? (i && s !== null && s.memoizedState !== null && eu(t), o._visibility & 2 ? zu(e, t, n, r) : (o._visibility |= 2, q(e, t, n, r, !!(t.subtreeFlags & 10256) || !1))) : (i && s !== null && s.memoizedState === null && eu(s), o._visibility & 2 ? zu(e, t, n, r) : Vu(e, t)), a & 2048 && Lu(s, t);
				break;
			case 24:
				zu(e, t, n, r), a & 2048 && Ru(t.alternate, t);
				break;
			case 30:
				i && (a = t.alternate, a !== null && (ql(a.child, !0), ql(t.child, !0))), zu(e, t, n, r);
				break;
			default: zu(e, t, n, r);
		}
	}
	function q(e, t, n, r, i) {
		for (i &&= !!(t.subtreeFlags & 10256) || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					q(a, o, s, c, i), xl(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, q(a, o, s, c, i)) : u._visibility & 2 ? q(a, o, s, c, i) : Vu(a, o), i && l & 2048 && Lu(o.alternate, o);
					break;
				case 24:
					q(a, o, s, c, i), i && l & 2048 && Ru(o.alternate, o);
					break;
				default: q(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function Vu(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					Vu(n, r), i & 2048 && Lu(r.alternate, r);
					break;
				case 24:
					Vu(n, r), i & 2048 && Ru(r.alternate, r);
					break;
				default: Vu(n, r);
			}
			t = t.sibling;
		}
	}
	var Hu = 8192;
	function Uu(e, t, n) {
		if (e.subtreeFlags & Hu) for (e = e.child; e !== null;) Wu(e, t, n), e = e.sibling;
	}
	function Wu(e, t, n) {
		switch (e.tag) {
			case 26:
				Uu(e, t, n), e.flags & Hu && (e.memoizedState === null ? (e = e.stateNode, (t & 335544128) === t && Zm(n, e)) : Qm(n, Ou, e.memoizedState, e.memoizedProps));
				break;
			case 5:
				Uu(e, t, n), e.flags & Hu && (e = e.stateNode, (t & 335544128) === t && Zm(n, e));
				break;
			case 3:
			case 4:
				var r = Ou;
				Ou = bm(e.stateNode.containerInfo), Uu(e, t, n), Ou = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = Hu, Hu = 16777216, Uu(e, t, n), Hu = r) : Uu(e, t, n));
				break;
			case 30:
				if ((e.flags & Hu) !== 0 && (r = e.memoizedProps.name, r != null && r !== "auto")) {
					var i = e.stateNode;
					i.paired = null, Bl === null && (Bl = /* @__PURE__ */ new Map()), Bl.set(r, i);
				}
				Uu(e, t, n);
				break;
			default: Uu(e, t, n);
		}
	}
	function Gu(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function Ku(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				cu = r, Yu(r, e);
			}
			Gu(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) qu(e), e = e.sibling;
	}
	function qu(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				Ku(e), e.flags & 2048 && Sl(9, e, e.return);
				break;
			case 3:
				Ku(e);
				break;
			case 12:
				Ku(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Ju(e)) : Ku(e);
				break;
			default: Ku(e);
		}
	}
	function Ju(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				cu = r, Yu(r, e);
			}
			Gu(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					Sl(8, t, t.return), Ju(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Ju(t));
					break;
				default: Ju(t);
			}
			e = e.sibling;
		}
	}
	function Yu(e, t) {
		for (; cu !== null;) {
			var n = cu;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Sl(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: Ma(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, cu = r;
			else a: for (n = e; cu !== null;) {
				r = cu;
				var i = r.sibling, a = r.return;
				if (vu(r), r === n) {
					cu = null;
					break a;
				}
				if (i !== null) {
					i.return = a, cu = i;
					break a;
				}
				cu = a;
			}
		}
	}
	var Xu = {
		getCacheForType: function(e) {
			var t = wa(Aa), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return wa(Aa).controller.signal;
		}
	}, Zu = typeof WeakMap == "function" ? WeakMap : Map, J = 0, Qu = null, Y = null, X = 0, Z = 0, $u = null, ed = !1, td = !1, nd = !1, Q = 0, rd = 0, id = 0, ad = 0, od = 0, sd = 0, cd = 0, ld = null, ud = null, dd = !1, fd = 0, pd = 0, md = Infinity, hd = null, gd = null, _d = 0, vd = null, yd = null, bd = 0, xd = 0, Sd = null, Cd = null, wd = null, Td = null, Ed = null, Dd = 0, Od = null;
	function kd() {
		return J & 2 && X !== 0 ? X & -X : k.T === null ? Et() : Nf();
	}
	function Ad() {
		if (sd === 0) {
			if (!(X & 536870912) || V) {
				var e = dt;
				dt <<= 1, !(dt & 3932160) && (dt = 262144), sd = e;
			} else sd = 536870912;
		}
		return e = Ao.current, e !== null && (e.flags |= 32), sd;
	}
	function jd(e, t) {
		if (t != null) {
			var n = e.stateNode, r = n.ref;
			r === null && (r = n.ref = Pp(vi(e.memoizedProps, n))), Td === null && (Td = []), Td.push(t.bind(null, r));
		}
	}
	function Md(e, t, n) {
		(e === Qu && (Z === 2 || Z === 9) || e.cancelPendingCommit !== null) && (zd(e, 0), Id(e, X, sd, !1)), bt(e, n), J & 2 && e === Qu || (e === Qu && (!(J & 2) && (ad |= n), rd === 4 && Id(e, X, sd, !1)), Tf(e));
	}
	function Nd(e, t, n) {
		if (J & 6) throw Error(i(327));
		var r = !n && !(t & 127) && (t & e.expiredLanes) === 0 || ht(e, t), a = r ? qd(e, t) : Gd(e, t, !0), o = r;
		do {
			if (a === 0) {
				td && !r && Id(e, t, 0, !1);
				break;
			}
			if (n = e.current.alternate, o && !Fd(n)) a = Gd(e, t, !1), o = !1;
			else {
				if (a === 2) {
					if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
					else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
					if (s !== 0) {
						t = s;
						a: {
							var c = e;
							a = ld;
							var l = c.current.memoizedState.isDehydrated;
							if (l && (zd(c, s).flags |= 256), s = Gd(c, s, !1), s !== 2 && s !== 6) {
								if (nd && !l) {
									c.errorRecoveryDisabledLanes |= o, ad |= o, a = 4;
									break a;
								}
								o = ud, ud = a, o !== null && (ud === null ? ud = o : ud.push.apply(ud, o));
							}
							a = s;
						}
						if (o = !1, a !== 2) continue;
					}
				}
				if (a === 1) {
					zd(e, 0), Id(e, t, 0, !0);
					break;
				}
				a: {
					switch (r = e, o = a, o) {
						case 0:
						case 1: throw Error(i(345));
						case 4: if ((t & 4194048) !== t && (t & 62914560) !== t) break;
						case 6:
							Id(r, t, sd, !ed);
							break a;
						case 2:
							ud = null;
							break;
						case 3:
						case 5: break;
						default: throw Error(i(329));
					}
					if ((t & 62914560) === t && (a = fd + 300 - Je(), 10 < a)) {
						if (Id(r, t, sd, !ed), mt(r, 0, !0) !== 0) break a;
						bd = t, r.timeoutHandle = gp(Pd.bind(null, r, n, ud, hd, dd, t, sd, ad, cd, ed, o, "Throttled", -0, 0), a);
						break a;
					}
					Pd(r, n, ud, hd, dd, t, sd, ad, cd, ed, o, null, -0, 0);
				}
				break;
			}
		} while (1);
		Tf(e);
	}
	function Pd(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
		e.timeoutHandle = -1;
		var m = t.subtreeFlags, h = (a & 335544064) === a;
		d = null, (h || m & 8192 || (m & 16785408) == 16785408) && (d = {
			stylesheets: null,
			count: 0,
			imgCount: 0,
			imgBytes: 0,
			suspenseyImages: [],
			waitingForImages: !0,
			waitingForViewTransition: !1,
			unsuspend: Cn
		}, Bl = null, Wu(t, a, d), h && (m = d, h = e.containerInfo, h = (h.nodeType === 9 ? h : h.ownerDocument).__reactViewTransition, h != null && (m.count++, m.waitingForViewTransition = !0, m = nh.bind(m), h.finished.then(m, m))), m = (a & 62914560) === a ? fd - Je() : (a & 4194048) === a ? pd - Je() : 0, m = eh(d, m), m !== null) ? (bd = a, e.cancelPendingCommit = m(ef.bind(null, e, t, a, n, r, i, o, s, c, l, u, d, null, f, p)), Id(e, a, o, !l)) : ef(e, t, a, n, r, i, o, s, c, l, u, d);
	}
	function Fd(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!Wr(a(), i)) return !1;
				} catch {
					return !1;
				}
			}
			if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
			else {
				if (t === e) break;
				for (; t.sibling === null;) {
					if (t.return === null || t.return === e) return !0;
					t = t.return;
				}
				t.sibling.return = t.return, t = t.sibling;
			}
		}
		return !0;
	}
	function Id(e, t, n, r) {
		t = gt(e, t), t &= ~od, t &= ~ad, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - ot(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && xt(e, n, t);
	}
	function Ld() {
		return J & 6 ? !0 : (Ef(0, !1), !1);
	}
	function Rd() {
		if (Y !== null) {
			if (Z === 0) var e = Y.return;
			else e = Y, ga = ha = null, is(e), io = null, ao = 0, e = Y;
			for (; e !== null;) bl(e.alternate, e), e = e.return;
			Y = null;
		}
	}
	function zd(e, t) {
		var n = e.timeoutHandle;
		return n !== -1 && (e.timeoutHandle = -1, _p(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), bd = 0, Rd(), Qu = e, Y = n = Pi(e.current, null), X = t, Z = 0, $u = null, ed = !1, td = ht(e, t), nd = !1, cd = sd = od = ad = id = rd = 0, ud = ld = null, dd = !1, Q = gt(e, t), Ti(), n;
	}
	function Bd(e, t) {
		H = null, k.H = mc, t === Ja || t === Xa ? (t = no(), Z = 3) : t === Ya ? (t = no(), Z = 4) : Z = t === Mc ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, $u = t, Y === null && (rd = 1, Ec(e, Hi(t, e.current)));
	}
	function Vd() {
		var e = Ao.current;
		return e === null ? !0 : (X & 4194048) === X ? jo === null : (X & 62914560) === X || X & 536870912 ? e === jo : !1;
	}
	function Hd() {
		var e = k.H;
		return k.H = mc, e === null ? mc : e;
	}
	function Ud() {
		var e = k.A;
		return k.A = Xu, e;
	}
	function Wd() {
		rd = 4, ed || (X & 4194048) !== X && Ao.current !== null || (td = !0), !(id & 134217727) && !(ad & 134217727) || Qu === null || Id(Qu, X, sd, !1);
	}
	function Gd(e, t, n) {
		var r = J;
		J |= 2;
		var i = Hd(), a = Ud();
		(Qu !== e || X !== t) && (hd = null, zd(e, t)), t = !1;
		var o = rd;
		a: do
			try {
				if (Z !== 0 && Y !== null) {
					var s = Y, c = $u;
					switch (Z) {
						case 8:
							Rd(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							Ao.current === null && (t = !0);
							var l = Z;
							if (Z = 0, $u = null, Zd(e, s, c, l), n && td) {
								o = 0;
								break a;
							}
							break;
						default: l = Z, Z = 0, $u = null, Zd(e, s, c, l);
					}
				}
				Kd(), o = rd;
				break;
			} catch (t) {
				Bd(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, ga = ha = null, J = r, k.H = i, k.A = a, Y === null && (Qu = null, X = 0, Ti()), o;
	}
	function Kd() {
		for (; Y !== null;) Yd(Y);
	}
	function qd(e, t) {
		var n = J;
		J |= 2;
		var r = Hd(), a = Ud();
		Qu !== e || X !== t ? (hd = null, md = Je() + 500, zd(e, t)) : td = ht(e, t);
		a: do
			try {
				if (Z !== 0 && Y !== null) {
					t = Y;
					var o = $u;
					b: switch (Z) {
						case 1:
							Z = 0, $u = null, Zd(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (Qa(o)) {
								Z = 0, $u = null, Xd(t);
								break;
							}
							t = function() {
								Z !== 2 && Z !== 9 || Qu !== e || (Z = 7), Tf(e);
							}, o.then(t, t);
							break a;
						case 3:
							Z = 7;
							break a;
						case 4:
							Z = 5;
							break a;
						case 7:
							Qa(o) ? (Z = 0, $u = null, Xd(t)) : (Z = 0, $u = null, Zd(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (Y.tag) {
								case 26: s = Y.memoizedState;
								case 5:
								case 27:
									var c = Y;
									if (s ? Ym(s) : c.stateNode.complete) {
										Z = 0, $u = null;
										var l = c.sibling;
										if (l !== null) Y = l;
										else {
											var u = c.return;
											u === null ? Y = null : (Y = u, Qd(u));
										}
										break b;
									}
							}
							Z = 0, $u = null, Zd(e, t, o, 5);
							break;
						case 6:
							Z = 0, $u = null, Zd(e, t, o, 6);
							break;
						case 8:
							Rd(), rd = 6;
							break a;
						default: throw Error(i(462));
					}
				}
				Jd();
				break;
			} catch (t) {
				Bd(e, t);
			}
		while (1);
		return ga = ha = null, k.H = r, k.A = a, J = n, Y === null ? (Qu = null, X = 0, Ti(), rd) : 0;
	}
	function Jd() {
		for (; Y !== null && !Ke();) Yd(Y);
	}
	function Yd(e) {
		var t = dl(e.alternate, e, Q);
		e.memoizedProps = e.pendingProps, t === null ? Qd(e) : Y = t;
	}
	function Xd(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = Kc(n, t, t.pendingProps, t.type, void 0, X);
				break;
			case 11:
				t = Kc(n, t, t.pendingProps, t.type.render, t.ref, X);
				break;
			case 5:
				is(t);
				var r = t;
				r === na && (V ? (la(r), r.tag === 5 && r.stateNode != null && (ra = r.stateNode)) : (la(r), V = !0));
			default: bl(n, t), t = Y = Fi(t, Q), t = dl(n, t, Q);
		}
		e.memoizedProps = e.pendingProps, t === null ? Qd(e) : Y = t;
	}
	function Zd(e, t, n, r) {
		ga = ha = null, is(t), io = null, ao = 0;
		var i = t.return;
		try {
			if (jc(e, i, t, n, X)) {
				rd = 1, Ec(e, Hi(n, e.current)), Y = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw Y = i, t;
			rd = 1, Ec(e, Hi(n, e.current)), Y = null;
			return;
		}
		t.flags & 32768 ? (V || r === 1 ? e = !0 : td || X & 536870912 ? e = !1 : (ed = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Ao.current, r !== null && r.tag === 13 && (r.flags |= 16384))), $d(t, e)) : Qd(t);
	}
	function Qd(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				$d(t, ed);
				return;
			}
			e = t.return;
			var n = vl(t.alternate, t, Q);
			if (n !== null) {
				Y = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				Y = t;
				return;
			}
			Y = t = e;
		} while (t !== null);
		rd === 0 && (rd = 5);
	}
	function $d(e, t) {
		do {
			var n = yl(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, Y = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				Y = e;
				return;
			}
			Y = e = n;
		} while (e !== null);
		rd = 6, Y = null;
	}
	function ef(e, t, n, r, a, o, s, c, l, u, d, f) {
		e.cancelPendingCommit = null;
		do
			lf();
		while (_d !== 0);
		if (J & 6) throw Error(i(327));
		if (t !== null) {
			if (t === e.current) throw Error(i(177));
			e === Qu && (Y = Qu = null, X = 0), yd = t, vd = e, bd = n, Sd = a, Cd = r, tf(e, t, n, s, c, l, f);
		}
	}
	function tf(e, t, n, r, i, a, o) {
		var s = t.lanes | t.childLanes;
		if (xd = s, s |= wi, j(e, n, s, r, i, a), Td = null, (n & 335544064) === n ? (Ed = Fa(e), r = 10262) : (Ed = null, r = 10256), (t.subtreeFlags & r) !== 0 || (t.flags & r) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, vf(Qe, function() {
			return uf(), null;
		})) : (e.callbackNode = null, e.callbackPriority = 0), zl = !1, r = !!(t.flags & 13878), t.subtreeFlags & 13878 || r) {
			r = k.T, k.T = null, i = A.p, A.p = 2, a = J, J |= 4;
			try {
				pu(e, t, n);
			} finally {
				J = a, A.p = i, k.T = r;
			}
		}
		_d = 1, zl ? wd = Mp(o, e.containerInfo, Ed, af, of, rf, sf, uf, nf, null, null) : (af(), of(), sf());
	}
	function nf(e) {
		if (_d !== 0) {
			var t = vd.onRecoverableError;
			t(e, { componentStack: null });
		}
	}
	function rf() {
		_d === 3 && (_d = 0, Nu(yd, vd), _d = 4);
	}
	function af() {
		if (_d === 1) {
			_d = 0;
			var e = vd, t = yd, n = bd, r = !!(t.flags & 13878);
			if (t.subtreeFlags & 13878 || r) {
				r = k.T, k.T = null;
				var i = A.p;
				A.p = 2;
				var a = J;
				J |= 4;
				try {
					uu = du = !1, ku(t, e, n), n = cp;
					var o = Xr(e.containerInfo), s = n.focusedElem, c = n.selectionRange;
					if (o !== s && s && s.ownerDocument && Yr(s.ownerDocument.documentElement, s)) {
						if (c !== null && L(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = Jr(s, h), v = Jr(s, g);
									if (_ && v && (p.rangeCount !== 1 || p.anchorNode !== _.node || p.anchorOffset !== _.offset || p.focusNode !== v.node || p.focusOffset !== v.offset)) {
										var y = d.createRange();
										y.setStart(_.node, _.offset), p.removeAllRanges(), h > g ? (p.addRange(y), p.extend(v.node, v.offset)) : (y.setEnd(v.node, v.offset), p.addRange(y));
									}
								}
							}
						}
						for (d = [], p = s; p = p.parentNode;) p.nodeType === 1 && d.push({
							element: p,
							left: p.scrollLeft,
							top: p.scrollTop
						});
						for (typeof s.focus == "function" && s.focus(), s = 0; s < d.length; s++) {
							var b = d[s];
							b.element.scrollLeft = b.left, b.element.scrollTop = b.top;
						}
					}
					gh = !!sp, cp = sp = null;
				} finally {
					J = a, A.p = i, k.T = r;
				}
			}
			e.current = t, _d = 2;
		}
	}
	function of() {
		if (_d === 2) {
			_d = 0;
			var e = vd, t = yd, n = !!(t.flags & 8772);
			if (t.subtreeFlags & 8772 || n) {
				n = k.T, k.T = null;
				var r = A.p;
				A.p = 2;
				var i = J;
				J |= 4;
				try {
					mu(e, t.alternate, t);
				} finally {
					J = i, A.p = r, k.T = n;
				}
			}
			_d = 3;
		}
	}
	function sf() {
		if (_d === 4 || _d === 3) {
			_d = 0;
			var e = wd;
			wd = null, qe();
			var t = vd, n = yd, r = bd, i = Cd, a = (r & 335544064) === r ? 10262 : 10256;
			if ((n.subtreeFlags & a) !== 0 || (n.flags & a) !== 0 ? _d = 5 : (_d = 0, yd = vd = null, cf(t, t.pendingLanes)), a = t.pendingLanes, a === 0 && (gd = null), Tt(r), n = n.stateNode, it && typeof it.onCommitFiberRoot == "function") try {
				it.onCommitFiberRoot(rt, n, void 0, (n.current.flags & 128) == 128);
			} catch {}
			if (i !== null) {
				n = k.T, a = A.p, A.p = 2, k.T = null;
				try {
					for (var o = t.onRecoverableError, s = 0; s < i.length; s++) {
						var c = i[s];
						o(c.value, { componentStack: c.stack });
					}
				} finally {
					k.T = n, A.p = a;
				}
			}
			if (i = Td, o = Ed, Ed = null, i !== null && (Td = null, o === null && (o = []), e !== null)) for (c = 0; c < i.length; c++) n = (0, i[c])(o), n !== void 0 && e.finished.finally(n);
			bd & 3 && lf(), Tf(t), a = t.pendingLanes, r & 261930 && a & 42 ? t === Od ? Dd++ : (Dd = 0, Od = t) : (Dd = 0, Od = null), Ef(0, !1);
		}
	}
	function cf(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Ma(t)));
	}
	function lf() {
		return wd !== null && (wd.skipTransition(), wd = null), af(), of(), sf(), uf();
	}
	function uf() {
		if (_d !== 5) return !1;
		var e = vd, t = xd;
		xd = 0;
		var n = Tt(bd), r = k.T, a = A.p;
		try {
			A.p = 32 > n ? 32 : n, k.T = null, n = Sd, Sd = null;
			var o = vd, s = bd;
			if (_d = 0, yd = vd = null, bd = 0, J & 6) throw Error(i(331));
			var c = J;
			if (J |= 4, qu(o.current), Bu(o, o.current, s, n), J = c, Ef(0, !1), it && typeof it.onPostCommitFiberRoot == "function") try {
				it.onPostCommitFiberRoot(rt, o);
			} catch {}
			return !0;
		} finally {
			A.p = a, k.T = r, cf(e, t);
		}
	}
	function df(e, t, n) {
		t = Hi(n, t), t = Oc(e.stateNode, t, 2), e = _o(e, t, 2), e !== null && (bt(e, 2), Tf(e));
	}
	function ff(e, t, n) {
		if (e.tag === 3) df(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				df(t, e, n);
				break;
			}
			if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (gd === null || !gd.has(r))) {
					e = Hi(n, e), n = kc(2), r = _o(t, n, 2), r !== null && (Ac(n, r, t, e), bt(r, 2), Tf(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function pf(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new Zu();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (nd = !0, i.add(n), e = mf.bind(null, e, t, n), t.then(e, e));
	}
	function mf(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, Qu === e && (X & n) === n && (rd === 4 || rd === 3 && (X & 62914560) === X && 300 > Je() - fd ? J & 2 ? od |= n : zd(e, 0) : od |= n, cd === X && (cd = 0)), Tf(e);
	}
	function hf(e, t) {
		t === 0 && (t = vt()), e = Oi(e, t), e !== null && (bt(e, t), Tf(e));
	}
	function gf(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), hf(e, n);
	}
	function _f(e, t) {
		var n = 0;
		switch (e.tag) {
			case 31:
			case 13:
				var r = e.stateNode, a = e.memoizedState;
				a !== null && (n = a.retryLane);
				break;
			case 19:
				r = e.stateNode;
				break;
			case 22:
				r = e.stateNode._retryCache;
				break;
			default: throw Error(i(314));
		}
		r !== null && r.delete(t), hf(e, n);
	}
	function vf(e, t) {
		return We(e, t);
	}
	var yf = null, bf = null, xf = !1, Sf = !1, Cf = !1, wf = 0;
	function Tf(e) {
		e !== bf && e.next === null && (bf === null ? yf = bf = e : bf = bf.next = e), Sf = !0, xf || (xf = !0, Mf());
	}
	function Ef(e, t) {
		if (!Cf && Sf) {
			Cf = !0;
			do
				for (var n = !1, r = yf; r !== null;) {
					if (!t) {
						if (e !== 0) {
							var i = r.pendingLanes;
							if (i === 0) var a = 0;
							else {
								var o = r.suspendedLanes, s = r.pingedLanes;
								a = (1 << 31 - ot(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
							}
							a !== 0 && (n = !0, jf(r, a));
						} else a = X, a = mt(r, r === Qu ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || ht(r, a) || (n = !0, jf(r, a));
					}
					r = r.next;
				}
			while (n);
			Cf = !1;
		}
	}
	function Df() {
		Of();
	}
	function Of() {
		Sf = xf = !1;
		var e = 0;
		wf !== 0 && hp() && (e = wf);
		for (var t = Je(), n = null, r = yf; r !== null;) {
			var i = r.next, a = kf(r, t);
			a === 0 ? (r.next = null, n === null ? yf = i : n.next = i, i === null && (bf = n)) : (n = r, (e !== 0 || a & 3) && (Sf = !0)), r = i;
		}
		_d !== 0 && _d !== 5 || Ef(e, !1), wf !== 0 && (wf = 0);
	}
	function kf(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - ot(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = _t(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = Qu, n = X, n = mt(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (Z === 2 || Z === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && Ge(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || ht(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && Ge(r), Tt(n)) {
				case 2:
				case 8:
					n = Ze;
					break;
				case 32:
					n = Qe;
					break;
				case 268435456:
					n = et;
					break;
				default: n = Qe;
			}
			return r = Af.bind(null, e), n = We(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && Ge(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function Af(e, t) {
		if (_d !== 0 && _d !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (lf() && e.callbackNode !== n) return null;
		var r = X;
		return r = mt(e, e === Qu ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (Nd(e, r, t), kf(e, Je()), e.callbackNode != null && e.callbackNode === n ? Af.bind(null, e) : null);
	}
	function jf(e, t) {
		if (lf()) return null;
		Nd(e, t, !0);
	}
	function Mf() {
		bp(function() {
			J & 6 ? We(Xe, Df) : Of();
		});
	}
	function Nf() {
		if (wf === 0) {
			var e = Ra;
			e === 0 && (e = ut, ut <<= 1, !(ut & 261888) && (ut = 256)), wf = e;
		}
		return wf;
	}
	function Pf(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : Sn(e);
	}
	function Ff(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = Pf((i[At] || null).action), o = r.submitter;
			o && (t = (t = o[At] || null) ? Pf(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new Un("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (wf !== 0) {
								var e = new FormData(i, o);
								ec(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = new FormData(i, o), ec(n, {
							pending: !0,
							data: e,
							method: i.method,
							action: a
						}, a, e));
					},
					currentTarget: i
				}]
			});
		}
	}
	for (var If = 0; If < hi.length; If++) {
		var Lf = hi[If];
		gi(Lf.toLowerCase(), "on" + (Lf[0].toUpperCase() + Lf.slice(1)));
	}
	gi(si, "onAnimationEnd"), gi(ci, "onAnimationIteration"), gi(li, "onAnimationStart"), gi("dblclick", "onDoubleClick"), gi("focusin", "onFocus"), gi("focusout", "onBlur"), gi(ui, "onTransitionRun"), gi(di, "onTransitionStart"), gi(fi, "onTransitionCancel"), gi(pi, "onTransitionEnd"), M("onMouseEnter", ["mouseout", "mouseover"]), M("onMouseLeave", ["mouseout", "mouseover"]), M("onPointerEnter", ["pointerout", "pointerover"]), M("onPointerLeave", ["pointerout", "pointerover"]), qt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), qt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), qt("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), qt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), qt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), qt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var Rf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), zf = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Rf));
	function Bf(e, t) {
		t = !!(t & 4);
		for (var n = 0; n < e.length; n++) {
			var r = e[n], i = r.event;
			r = r.listeners;
			a: {
				var a = void 0;
				if (t) for (var o = r.length - 1; 0 <= o; o--) {
					var s = r[o], c = s.instance, l = s.currentTarget;
					if (s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						xi(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						xi(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function $(e, t) {
		var n = t[Mt];
		n === void 0 && (n = t[Mt] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Wf(t, e, 2, !1), n.add(r));
	}
	function Vf(e, t, n) {
		var r = 0;
		t && (r |= 4), Wf(n, e, r, t);
	}
	var Hf = "_reactListening" + Math.random().toString(36).slice(2);
	function Uf(e) {
		if (!e[Hf]) {
			e[Hf] = !0, Gt.forEach(function(t) {
				t !== "selectionchange" && (zf.has(t) || Vf(t, !1, e), Vf(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[Hf] || (t[Hf] = !0, Vf("selectionchange", !1, t));
		}
	}
	function Wf(e, t, n, r) {
		switch (Ch(t)) {
			case 2:
				var i = _h;
				break;
			case 8:
				i = vh;
				break;
			default: i = yh;
		}
		n = i.bind(null, t, n, e), i = void 0, !Mn || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function Gf(e, t, n, r, i) {
		var a = r;
		if (!(t & 1) && !(t & 2) && r !== null) a: for (;;) {
			if (r === null) return;
			var s = r.tag;
			if (s === 3 || s === 4) {
				var c = r.stateNode.containerInfo;
				if (c === i) break;
				if (s === 4) for (s = r.return; s !== null;) {
					var l = s.tag;
					if ((l === 3 || l === 4) && s.stateNode.containerInfo === i) return;
					s = s.return;
				}
				for (; c !== null;) {
					if (s = zt(c), s === null) return;
					if (l = s.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = s;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		kn(function() {
			var r = a, i = wn(n), s = [];
			a: {
				var c = mi.get(e);
				if (c !== void 0) {
					var l = Un, u = e;
					switch (e) {
						case "keypress": if (Rn(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = sr;
							break;
						case "focusin":
							u = "focus", l = Qn;
							break;
						case "focusout":
							u = "blur", l = Qn;
							break;
						case "beforeblur":
						case "afterblur":
							l = Qn;
							break;
						case "click": if (n.button === 2) break a;
						case "auxclick":
						case "dblclick":
						case "mousedown":
						case "mousemove":
						case "mouseup":
						case "mouseout":
						case "mouseover":
						case "contextmenu":
							l = Xn;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = Zn;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = ur;
							break;
						case si:
						case ci:
						case li:
							l = $n;
							break;
						case pi:
							l = dr;
							break;
						case "scroll":
						case "scrollend":
							l = Gn;
							break;
						case "wheel":
							l = fr;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = er;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = cr;
							break;
						case "submit":
							l = lr;
							break;
						case "toggle":
						case "beforetoggle": l = pr;
					}
					var d = !!(t & 4), f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = An(m, p), g != null && d.push(Kf(m, g, h))), f) break;
						m = m.return;
					}
					0 < d.length && (c = new l(c, u, null, n, i), s.push({
						event: c,
						listeners: d
					}));
				}
			}
			if (!(t & 7)) {
				a: {
					if (l = e === "mouseover" || e === "pointerover", c = e === "mouseout" || e === "pointerout", l && n !== F && (u = n.relatedTarget || n.fromElement) && (zt(u) || u[jt])) break a;
					(c || l) && (u = i.window === i ? i : (l = i.ownerDocument) ? l.defaultView || l.parentWindow : window, c ? (l = n.relatedTarget || n.toElement, c = r, l = l ? zt(l) : null, l !== null && (f = o(l), d = l.tag, l !== f || d !== 5 && d !== 27 && d !== 6) && (l = null)) : (c = null, l = r), c !== l && (d = Xn, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = cr, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = c == null ? u : Vt(c), h = l == null ? u : Vt(l), u = new d(g, m + "leave", c, n, i), u.target = f, u.relatedTarget = h, g = null, zt(i) === r && (d = new d(p, m + "enter", l, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, d = c && l ? E(c, l, Jf) : null, c !== null && Yf(s, u, c, d, !1), l !== null && f !== null && Yf(s, f, l, d, !0)));
				}
				a: {
					if (c = r ? Vt(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var _ = Mr;
					else if (Er(c)) {
						if (Nr) _ = Hr;
						else {
							_ = Br;
							var v = zr;
						}
					} else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && yn(r.elementType) && (_ = Mr) : _ = Vr;
					if (_ &&= _(e, r)) {
						Dr(s, _, n, i);
						break a;
					}
					v && v(e, c, r);
				}
				switch (v = r ? Vt(r) : window, e) {
					case "focusin":
						(Er(v) || v.contentEditable === "true") && (Qr = v, $r = r, R = null);
						break;
					case "focusout":
						R = $r = Qr = null;
						break;
					case "mousedown":
						ei = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						ei = !1, ti(s, n, i);
						break;
					case "selectionchange": if (Zr) break;
					case "keydown":
					case "keyup": ti(s, n, i);
				}
				var y;
				if (hr) b: {
					switch (e) {
						case "compositionstart":
							var b = "onCompositionStart";
							break b;
						case "compositionend":
							b = "onCompositionEnd";
							break b;
						case "compositionupdate":
							b = "onCompositionUpdate";
							break b;
					}
					b = void 0;
				}
				else Sr ? br(e, n) && (b = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (b = "onCompositionStart");
				b && (vr && n.locale !== "ko" && (Sr || b !== "onCompositionStart" ? b === "onCompositionEnd" && Sr && (y = Ln()) : (Pn = i, Fn = "value" in Pn ? Pn.value : Pn.textContent, Sr = !0)), v = qf(r, b), 0 < v.length && (b = new tr(b, e, null, n, i), s.push({
					event: b,
					listeners: v
				}), y ? b.data = y : (y = xr(n), y !== null && (b.data = y)))), (y = _r ? Cr(e, n) : wr(e, n)) && (b = qf(r, "onBeforeInput"), 0 < b.length && (v = new tr("onBeforeInput", "beforeinput", null, n, i), s.push({
					event: v,
					listeners: b
				}), v.data = y)), Ff(s, e, r, n, i);
			}
			Bf(s, t);
		});
	}
	function Kf(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function qf(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = An(e, n), i != null && r.unshift(Kf(e, i, a)), i = An(e, t), i != null && r.push(Kf(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function Jf(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function Yf(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = An(n, a), l != null && o.unshift(Kf(n, l, c))) : i || (l = An(n, a), l != null && o.push(Kf(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var Xf = /\r\n?/g, Zf = /\u0000|\uFFFD/g;
	function Qf(e) {
		return (typeof e == "string" ? e : "" + e).replace(Xf, "\n").replace(Zf, "");
	}
	function $f(e, t) {
		return t = Qf(t), Qf(e) === t;
	}
	function ep(e, t, n, r, a, o) {
		switch (n) {
			case "children":
				if (typeof r == "string") t === "body" || t === "textarea" && r === "" || hn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") t !== "body" && hn(e, "" + r);
				else return;
				break;
			case "className":
				en(e, "class", r);
				break;
			case "tabIndex":
				en(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				en(e, n, r);
				break;
			case "style":
				vn(e, r, o);
				return;
			case "data": if (t !== "object") {
				en(e, "data", r);
				break;
			}
			case "src":
			case "href":
				if (r === "" && (t !== "a" || n !== "href") || r == null || typeof r == "function" || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Sn(r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				}
				if (typeof o == "function" && (n === "formAction" ? (t !== "input" && ep(e, t, "name", a.name, a, null), ep(e, t, "formEncType", a.formEncType, a, null), ep(e, t, "formMethod", a.formMethod, a, null), ep(e, t, "formTarget", a.formTarget, a, null)) : (ep(e, t, "encType", a.encType, a, null), ep(e, t, "method", a.method, a, null), ep(e, t, "target", a.target, a, null))), r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Sn(r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = Cn);
				return;
			case "onScroll":
				r != null && $("scroll", e);
				return;
			case "onScrollEnd":
				r != null && $("scrollend", e);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "multiple":
				e.multiple = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "muted":
				e.muted = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "defaultValue":
			case "defaultChecked":
			case "innerHTML":
			case "ref": break;
			case "autoFocus": break;
			case "xlinkHref":
				if (r == null || typeof r == "function" || typeof r == "boolean" || typeof r == "symbol") {
					e.removeAttribute("xlink:href");
					break;
				}
				n = Sn(r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
				break;
			case "contentEditable":
			case "spellCheck":
			case "draggable":
			case "value":
			case "autoReverse":
			case "externalResourcesRequired":
			case "focusable":
			case "preserveAlpha":
				r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "inert":
			case "allowFullScreen":
			case "async":
			case "autoPlay":
			case "controls":
			case "credentialless":
			case "default":
			case "defer":
			case "disabled":
			case "disablePictureInPicture":
			case "disableRemotePlayback":
			case "formNoValidate":
			case "hidden":
			case "loop":
			case "noModule":
			case "noValidate":
			case "open":
			case "playsInline":
			case "readOnly":
			case "required":
			case "reversed":
			case "scoped":
			case "seamless":
			case "itemScope":
				r && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
				break;
			case "capture":
			case "download":
				!0 === r ? e.setAttribute(n, "") : !1 !== r && r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "cols":
			case "rows":
			case "size":
			case "span":
				r != null && typeof r != "function" && typeof r != "symbol" && !isNaN(r) && 1 <= r ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "rowSpan":
			case "start":
				r == null || typeof r == "function" || typeof r == "symbol" || isNaN(r) ? e.removeAttribute(n) : e.setAttribute(n, r);
				break;
			case "popover":
				$("beforetoggle", e), $("toggle", e), $t(e, "popover", r);
				break;
			case "xlinkActuate":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				tn(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				tn(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				tn(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				$t(e, "is", r);
				break;
			case "innerText":
			case "textContent": return;
			default: if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") n = bn.get(n) || n, $t(e, n, r);
			else return;
		}
		N = !0;
	}
	function tp(e, t, n, r, a, o) {
		switch (n) {
			case "style":
				vn(e, r, o);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "children":
				if (typeof r == "string") hn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") hn(e, "" + r);
				else return;
				break;
			case "onScroll":
				r != null && $("scroll", e);
				return;
			case "onScrollEnd":
				r != null && $("scrollend", e);
				return;
			case "onClick":
				r != null && (e.onclick = Cn);
				return;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": return;
			case "innerText":
			case "textContent": return;
			default:
				if (!Kt.hasOwnProperty(n)) a: {
					if (n[0] === "o" && n[1] === "n" && (a = n.endsWith("Capture"), o = n.slice(2, a ? n.length - 7 : void 0), t = e[At] || null, t = t == null ? null : t[n], typeof t == "function" && e.removeEventListener(o, t, a), typeof r == "function")) {
						typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(o, r, a);
						break a;
					}
					N = !0, n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : $t(e, n, r);
				}
				return;
		}
		N = !0;
	}
	function np(e, t, n) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "img":
				$("error", e), $("load", e);
				var r = !1, a = !1, o;
				for (o in n) if (n.hasOwnProperty(o)) {
					var s = n[o];
					if (s != null) switch (o) {
						case "src":
							r = !0;
							break;
						case "srcSet":
							a = !0;
							break;
						case "children":
						case "dangerouslySetInnerHTML": throw Error(i(137, t));
						default: ep(e, t, o, s, n, null);
					}
				}
				a && ep(e, t, "srcSet", n.srcSet, n, null), r && ep(e, t, "src", n.src, n, null);
				return;
			case "input":
				$("invalid", e);
				var c = o = s = a = null, l = null, u = null;
				for (r in n) if (n.hasOwnProperty(r)) {
					var d = n[r];
					if (d != null) switch (r) {
						case "name":
							a = d;
							break;
						case "type":
							s = d;
							break;
						case "checked":
							l = d;
							break;
						case "defaultChecked":
							u = d;
							break;
						case "value":
							o = d;
							break;
						case "defaultValue":
							c = d;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (d != null) throw Error(i(137, t));
							break;
						default: ep(e, t, r, d, n, null);
					}
				}
				un(e, o, c, l, u, s, a, !1);
				return;
			case "select":
				for (a in $("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(a) && (c = n[a], c != null)) switch (a) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: ep(e, t, a, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && fn(e, !!r, n, !0) : fn(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in $("invalid", e), o = a = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
					case "value":
						r = c;
						break;
					case "defaultValue":
						a = c;
						break;
					case "children":
						o = c;
						break;
					case "dangerouslySetInnerHTML":
						if (c != null) throw Error(i(91));
						break;
					default: ep(e, t, s, c, n, null);
				}
				mn(e, r, a, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: ep(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				$("beforetoggle", e), $("toggle", e), $("cancel", e), $("close", e);
				break;
			case "iframe":
			case "object":
				$("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < Rf.length; r++) $(Rf[r], e);
				break;
			case "image":
				$("error", e), $("load", e);
				break;
			case "details":
				$("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": $("error", e), $("load", e);
			case "area":
			case "base":
			case "br":
			case "col":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "track":
			case "wbr":
			case "menuitem":
				for (u in n) if (n.hasOwnProperty(u) && (r = n[u], r != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML": throw Error(i(137, t));
					default: ep(e, t, u, r, n, null);
				}
				return;
			default: if (yn(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && tp(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && ep(e, t, c, r, n, null));
	}
	var rp = {};
	function ip(e, t, n, r) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "input":
				var a = null, o = null, s = null, c = null, l = null, u = null, d = null;
				for (m in n) {
					var f = n[m];
					if (n.hasOwnProperty(m) && f != null) switch (m) {
						case "checked": break;
						case "value": break;
						case "defaultValue": l = f;
						default: r.hasOwnProperty(m) || ep(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							m !== f && (N = !0), o = m;
							break;
						case "name":
							m !== f && (N = !0), a = m;
							break;
						case "checked":
							m !== f && (N = !0), u = m;
							break;
						case "defaultChecked":
							m !== f && (N = !0), d = m;
							break;
						case "value":
							m !== f && (N = !0), s = m;
							break;
						case "defaultValue":
							m !== f && (N = !0), c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(i(137, t));
							break;
						default: m !== f && ep(e, t, p, m, r, f);
					}
				}
				ln(e, s, c, l, u, d, o, a);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || ep(e, t, o, null, r, l);
				}
				for (a in r) if (o = r[a], l = n[a], r.hasOwnProperty(a) && (o != null || l != null)) switch (a) {
					case "value":
						o !== l && (N = !0), p = o;
						break;
					case "defaultValue":
						o !== l && (N = !0), c = o;
						break;
					case "multiple": o !== l && (N = !0), s = o;
					default: o !== l && ep(e, t, a, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? fn(e, !!n, n ? [] : "", !1) : fn(e, !!n, t, !0)) : fn(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (a = n[c], n.hasOwnProperty(c) && a != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: ep(e, t, c, null, r, a);
				}
				for (s in r) if (a = r[s], o = n[s], r.hasOwnProperty(s) && (a != null || o != null)) switch (s) {
					case "value":
						a !== o && (N = !0), p = a;
						break;
					case "defaultValue":
						a !== o && (N = !0), m = a;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (a != null) throw Error(i(91));
						break;
					default: a !== o && ep(e, t, s, a, r, o);
				}
				pn(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: ep(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						p !== m && (N = !0), e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: ep(e, t, l, p, r, m);
				}
				return;
			case "img":
			case "link":
			case "area":
			case "base":
			case "br":
			case "col":
			case "embed":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "source":
			case "track":
			case "wbr":
			case "menuitem":
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && ep(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(i(137, t));
						break;
					default: ep(e, t, u, p, r, m);
				}
				return;
			default: if (yn(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && tp(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || tp(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && ep(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || ep(e, t, f, p, r, m);
	}
	function ap(e) {
		switch (e) {
			case "css":
			case "script":
			case "font":
			case "img":
			case "image":
			case "input":
			case "link": return !0;
			default: return !1;
		}
	}
	function op() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && ap(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && ap(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var sp = null, cp = null;
	function lp(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function up(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function dp(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function fp(e, t, n, r) {
		return n = lp(n).createElement(e), n[kt] = r, n[At] = t, np(n, e, t), Ut(n), n;
	}
	function pp(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var mp = null;
	function hp() {
		var e = window.event;
		return e && e.type === "popstate" ? e !== mp && (mp = e, !0) : (mp = null, !1);
	}
	var gp = typeof setTimeout == "function" ? setTimeout : void 0, _p = typeof clearTimeout == "function" ? clearTimeout : void 0, vp = typeof Promise == "function" ? Promise : void 0, yp = typeof requestAnimationFrame == "function" ? requestAnimationFrame : gp, bp = typeof queueMicrotask == "function" ? queueMicrotask : vp === void 0 ? gp : function(e) {
		return vp.resolve(null).then(e).catch(xp);
	};
	function xp(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Sp(e) {
		return e === "head";
	}
	function Cp(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) {
				if (n = i.data, n === "/$" || n === "/&") {
					if (r === 0) {
						e.removeChild(i), Hh(t);
						return;
					}
					r--;
				} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
				else if (n === "html") _m(e.ownerDocument.documentElement);
				else if (n === "head") {
					n = e.ownerDocument.head, _m(n);
					for (var a = n.firstChild; a;) {
						var o = a.nextSibling, s = a.nodeName;
						a[It] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
					}
				} else n === "body" && _m(e.ownerDocument.body);
			}
			n = i;
		} while (n);
		Hh(t);
	}
	function wp(e, t) {
		var n = e;
		e = 0;
		do {
			var r = n.nextSibling;
			if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), r && r.nodeType === 8) {
				if (n = r.data, n === "/$") {
					if (e === 0) break;
					e--;
				} else n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
			}
			n = r;
		} while (n);
	}
	function Tp(e, t, n) {
		if (t = CSS.escape(t) === t ? t : "r-" + btoa(t).replace(/=/g, ""), e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
			if (t = e.getClientRects(), t.length === 1) var r = 1;
			else for (var i = r = 0; i < t.length; i++) {
				var a = t[i];
				0 < a.width && 0 < a.height && r++;
			}
			r === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
		}
	}
	function Ep(e, t) {
		e = e.style, t = t.style;
		var n = t == null ? null : t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null;
		e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t == null ? null : t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n == null ? (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t) : e.margin = n));
	}
	function Dp(e, t, n) {
		return n = n.ownerDocument.defaultView, {
			rect: e,
			abs: t.position === "absolute" || t.position === "fixed",
			clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
			view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
		};
	}
	function Op(e) {
		return Dp(e.getBoundingClientRect(), getComputedStyle(e), e);
	}
	function kp(e) {
		var t = e.getBoundingClientRect();
		t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
		var n = getComputedStyle(e);
		return Dp(t, n, e);
	}
	function Ap(e) {
		return e.documentElement.clientHeight;
	}
	function jp(e) {
		this.addEventListener("load", e), this.addEventListener("error", e);
	}
	function Mp(e, t, n, r, i, a, o, s, c) {
		var l = t.nodeType === 9 ? t : t.ownerDocument;
		try {
			var u = l.startViewTransition({
				update: function() {
					var t = l.defaultView, n = t.navigation && t.navigation.transition, o = l.fonts.status;
					r();
					var s = [];
					if (o === "loaded" && (Ap(l), l.fonts.status === "loading" && s.push(l.fonts.ready)), o = s.length, e !== null) for (var c = e.suspenseyImages, u = 0, d = 0; d < c.length; d++) {
						var f = c[d];
						if (!f.complete) {
							var p = f.getBoundingClientRect();
							if (0 < p.bottom && 0 < p.right && p.top < t.innerHeight && p.left < t.innerWidth) {
								if (u += Xm(f), u > $m) {
									s.length = o;
									break;
								}
								f = new Promise(jp.bind(f)), s.push(f);
							}
						}
					}
					if (0 < s.length) return t = Promise.race([Promise.all(s), new Promise(function(e) {
						return setTimeout(e, 500);
					})]).then(i, i), (n ? Promise.allSettled([n.finished, t]) : t).then(a, a);
					if (i(), n) return n.finished.then(a, a);
					a();
				},
				types: n
			});
			l.__reactViewTransition = u;
			var d = [];
			return u.ready.then(function() {
				for (var e = l.documentElement.getAnimations({ subtree: !0 }), t = 0; t < e.length; t++) {
					var n = e[t], r = n.effect, i = r.pseudoElement;
					if (i != null && i.startsWith("::view-transition")) {
						d.push(n), n = r.getKeyframes();
						for (var a = i = void 0, s = !0, c = 0; c < n.length; c++) {
							var u = n[c], f = u.width;
							if (i === void 0) i = f;
							else if (i !== f) {
								s = !1;
								break;
							}
							if (f = u.height, a === void 0) a = f;
							else if (a !== f) {
								s = !1;
								break;
							}
							delete u.width, delete u.height, u.transform === "none" && delete u.transform;
						}
						s && i !== void 0 && a !== void 0 && (r.setKeyframes(n), s = getComputedStyle(r.target, r.pseudoElement), s.width !== i || s.height !== a) && (s = n[0], s.width = i, s.height = a, s = n[n.length - 1], s.width = i, s.height = a, r.setKeyframes(n));
					}
				}
				o();
			}, function(e) {
				l.__reactViewTransition === u && (l.__reactViewTransition = null);
				try {
					if (typeof e == "object" && e) switch (e.name) {
						case "InvalidStateError": (e.message === "View transition was skipped because document visibility state is hidden." || e.message === "Skipping view transition because document visibility state has become hidden." || e.message === "Skipping view transition because viewport size changed." || e.message === "Transition was aborted because of invalid state") && (e = null);
					}
					e !== null && c(e);
				} finally {
					r(), i(), o();
				}
			}), u.finished.finally(function() {
				for (var e = 0; e < d.length; e++) d[e].cancel();
				l.__reactViewTransition === u && (l.__reactViewTransition = null), s();
			}), u;
		} catch {
			return r(), i(), o(), null;
		}
	}
	function Np(e, t) {
		this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
	}
	Np.prototype.animate = function(e, t) {
		return t = typeof t == "number" ? { duration: t } : D({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
	}, Np.prototype.getAnimations = function() {
		for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), r = [], i = 0; i < n.length; i++) {
			var a = n[i].effect;
			a !== null && a.target === e && a.pseudoElement === t && r.push(n[i]);
		}
		return r;
	}, Np.prototype.getComputedStyle = function() {
		return getComputedStyle(this._scope, this._selector);
	};
	function Pp(e) {
		return {
			name: e,
			group: new Np("group", e),
			imagePair: new Np("image-pair", e),
			old: new Np("old", e),
			new: new Np("new", e)
		};
	}
	function Fp(e) {
		this._fragmentFiber = e, this._observers = this._eventListeners = null;
	}
	Fp.prototype.addEventListener = function(e, t, n) {
		var r = null, i = null;
		if (!(n != null && typeof n != "boolean" && (r = n.signal || null, r !== null && r.aborted))) {
			this._eventListeners === null && (this._eventListeners = []);
			var a = this._eventListeners;
			if (Bp(a, e, t, n) === -1) {
				var o = this, s = t;
				n != null && typeof n != "boolean" && !0 === n.once && (s = function(r) {
					o.removeEventListener(e, t, n), typeof t == "function" ? t.call(this, r) : t.handleEvent(r);
				}), r !== null && (i = o.removeEventListener.bind(o, e, t, n), r.addEventListener("abort", i, { once: !0 }), i = r.removeEventListener.bind(r, "abort", i)), r = Rp(n), a.push({
					type: e,
					listener: t,
					optionsOrUseCapture: n,
					attachedListener: s,
					cleanup: i
				}), h(this._fragmentFiber.child, !1, Ip, e, s, r);
			}
			this._eventListeners = a;
		}
	};
	function Ip(e, t, n, r) {
		return b(e).addEventListener(t, n, r), !1;
	}
	Fp.prototype.removeEventListener = function(e, t, n) {
		var r = this._eventListeners;
		if (r !== null && (t = Bp(r, e, t, n), t !== -1)) {
			var i = r[t];
			n = i.attachedListener;
			var a = i.cleanup;
			i = Rp(i.optionsOrUseCapture), h(this._fragmentFiber.child, !1, Lp, e, n, i), r.splice(t, 1), a !== null && a();
		}
	};
	function Lp(e, t, n, r) {
		return b(e).removeEventListener(t, n, r), !1;
	}
	function Rp(e) {
		return e != null && typeof e != "boolean" && (!0 === e.once || e.signal instanceof AbortSignal) ? {
			capture: e.capture,
			passive: e.passive
		} : e;
	}
	function zp(e) {
		return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
	}
	function Bp(e, t, n, r) {
		if (e.length === 0) return -1;
		r = zp(r);
		for (var i = 0; i < e.length; i++) {
			var a = e[i];
			if (a.type === t && a.listener === n && zp(a.optionsOrUseCapture) === r) return i;
		}
		return -1;
	}
	Fp.prototype.dispatchEvent = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return !0;
		t = b(t);
		var n = this._eventListeners;
		if (n !== null && 0 < n.length || !e.bubbles) {
			var r = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
			if (n) for (var i = 0; i < n.length; i++) {
				var a = n[i];
				r.addEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			}
			if (t.appendChild(r), e = r.dispatchEvent(e), n) for (i = 0; i < n.length; i++) a = n[i], r.removeEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			return t.removeChild(r), e;
		}
		return t.dispatchEvent(e);
	}, Fp.prototype.focus = function(e) {
		h(this._fragmentFiber.child, !0, Vp, e, void 0, void 0);
	};
	function Vp(e, t) {
		return e.tag !== 6 && (e = b(e), pm(e, t));
	}
	Fp.prototype.focusLast = function(e) {
		var t = [];
		h(this._fragmentFiber.child, !0, Hp, t, void 0, void 0);
		for (var n = t.length - 1; 0 <= n && !Vp(t[n], e); n--);
	};
	function Hp(e, t) {
		return t.push(e), !1;
	}
	Fp.prototype.blur = function() {
		var e = g(this._fragmentFiber);
		e !== null && (e = b(e), e = lp(e).activeElement, e !== null && h(this._fragmentFiber.child, !1, Up, e, void 0, void 0));
	};
	function Up(e, t) {
		return e.tag !== 6 && (e = b(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
	}
	Fp.prototype.observeUsing = function(e) {
		this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), h(this._fragmentFiber.child, !1, Wp, e, void 0, void 0);
	};
	function Wp(e, t) {
		return e.tag === 6 || (e = b(e), t.observe(e)), !1;
	}
	Fp.prototype.unobserveUsing = function(e) {
		var t = this._observers;
		if (t !== null && t.has(e)) {
			t.delete(e), h(this._fragmentFiber.child, !1, Gp, e, void 0, void 0);
			for (var n = t = 0; n < Kp.length; n++) {
				var r = Kp[n];
				r.fragmentInstance === this && r.observer === e ? e.unobserve(r.instance) : Kp[t++] = r;
			}
			Kp.length = t;
		}
	};
	function Gp(e, t) {
		return e.tag === 6 || (e = b(e), t.unobserve(e)), !1;
	}
	var Kp = [], qp = !1;
	function Jp(e, t, n) {
		Kp.push({
			fragmentInstance: e,
			observer: t,
			instance: n
		}), qp || (qp = !0, mm(function() {
			qp = !1;
			var e = Kp;
			Kp = [];
			for (var t = 0; t < e.length; t++) {
				var n = e[t];
				n.observer.unobserve(n.instance);
			}
		}));
	}
	Fp.prototype.getClientRects = function() {
		var e = [];
		return h(this._fragmentFiber.child, !1, Yp, e, void 0, void 0), e;
	};
	function Yp(e, t) {
		if (e.tag === 6) {
			e = e.stateNode;
			var n = e.ownerDocument.createRange();
			n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
		} else e = b(e), t.push.apply(t, e.getClientRects());
		return !1;
	}
	Fp.prototype.getRootNode = function(e) {
		var t = g(this._fragmentFiber);
		return t === null ? this : b(t).getRootNode(e);
	}, Fp.prototype.compareDocumentPosition = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		var n = [];
		h(this._fragmentFiber.child, !1, Hp, n, void 0, void 0);
		var r = b(t);
		if (n.length === 0) {
			if (n = r, _(this._fragmentFiber)) {
				a: {
					for (t = this._fragmentFiber.return; t !== null;) {
						if (t.tag === 4) {
							t = t.stateNode.containerInfo;
							break a;
						}
						if (t.tag === 3 || t.tag === 5 || t.tag === 27) break;
						t = t.return;
					}
					t = null;
				}
				t != null && (n = t);
			}
			t = this._fragmentFiber;
			var i = r = n.compareDocumentPosition(e);
			return n === e ? i = Node.DOCUMENT_POSITION_CONTAINS : r & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = v(t)[1], n === null ? i = Node.DOCUMENT_POSITION_PRECEDING : (e = b(n).compareDocumentPosition(e), i = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), i |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
		}
		t = b(n[0]), i = b(n[n.length - 1]);
		var a = _(this._fragmentFiber) ? t.parentElement : r;
		if (a == null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		r = a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, a = a.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_CONTAINED_BY;
		var o = t.compareDocumentPosition(e), s = i.compareDocumentPosition(e), c = o & Node.DOCUMENT_POSITION_CONTAINED_BY || s & Node.DOCUMENT_POSITION_CONTAINED_BY;
		return s = r && a && o & Node.DOCUMENT_POSITION_FOLLOWING && s & Node.DOCUMENT_POSITION_PRECEDING, t = r && t === e || a && i === e || c || s ? Node.DOCUMENT_POSITION_CONTAINED_BY : !r && t === e || !a && i === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : o, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || Xp(t, this._fragmentFiber, n[0], n[n.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
	};
	function Xp(e, t, n, r, i) {
		var a = zt(i);
		if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
			if (n = !!a) a: {
				for (; a !== null;) {
					if (a.tag === 7 && (a === t || a.alternate === t)) {
						n = !0;
						break a;
					}
					a = a.return;
				}
				n = !1;
			}
			return n;
		}
		if (e & Node.DOCUMENT_POSITION_CONTAINS) {
			if (a === null) return a = i.ownerDocument, i === a || i === a.documentElement || i === a.body;
			a: {
				for (a = t, t = g(t); a !== null;) {
					if (!(a.tag !== 5 && a.tag !== 3 && a.tag !== 27 || a !== t && a.alternate !== t)) {
						a = !0;
						break a;
					}
					a = a.return;
				}
				a = !1;
			}
			return a;
		}
		return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!a) && !(t = a === n) && (t = E(n, a, T), t === null ? t = !1 : (h(t, !0, C, a, n), a = x, x = null, t = a !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!a) && !(t = a === r) && (t = E(r, a, T), t === null ? t = !1 : (h(t, !0, w, a, r), a = x, S = x = null, t = a !== null)), t) : !1;
	}
	function Zp(e, t) {
		var n = e.ownerDocument.createRange();
		n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
	}
	Fp.prototype.scrollIntoView = function(e) {
		if (typeof e == "object") throw Error(i(566));
		var t = [];
		h(this._fragmentFiber.child, !1, Hp, t, void 0, void 0);
		var n = !1 !== e;
		if (t.length === 0) {
			var r = v(this._fragmentFiber);
			if (r = n ? r[1] || r[0] || g(this._fragmentFiber) : r[0] || r[1], r === null) return;
			if (r.tag === 6) {
				e = b(r), Zp(e, n);
				return;
			}
			if (r = b(r), r.nodeType !== 9) {
				if (r.nodeType === 11) {
					n = "host" in r ? r.host : null, n !== null && n.scrollIntoView(e);
					return;
				}
				r.scrollIntoView(e);
			}
		}
		for (r = n ? t.length - 1 : 0; r !== (n ? -1 : t.length);) {
			var a = t[r];
			a.tag === 6 ? (a = b(a), Zp(a, n)) : b(a).scrollIntoView(e), r += n ? -1 : 1;
		}
	};
	function Qp(e, t) {
		return e = b(e), $p(e, t), !1;
	}
	function $p(e, t) {
		e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
	}
	function em(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.addEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			for (var r = 0, i = 0; i < Kp.length; i++) {
				var a = Kp[i];
				(a.fragmentInstance !== t || a.observer !== n || a.instance !== e) && (Kp[r++] = a);
			}
			Kp.length = r, n.observe(e);
		}), $p(e, t));
	}
	function tm(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.removeEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			typeof n.rootMargin == "string" ? Jp(t, n, e) : n.unobserve(e);
		}), e.reactFragments != null && e.reactFragments.delete(t));
	}
	function nm(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					nm(n), Rt(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function rm(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) {
				if (t === "input" && e.type === "hidden") {
					var a = i.name == null ? null : "" + i.name;
					if (i.type === "hidden" && e.getAttribute("name") === a) return e;
				} else return e;
			} else if (!e[It]) switch (t) {
				case "meta":
					if (!e.hasAttribute("itemprop")) break;
					return e;
				case "link":
					if (a = e.getAttribute("rel"), a === "stylesheet" && e.hasAttribute("data-precedence") || a !== i.rel || e.getAttribute("href") !== (i.href == null || i.href === "" ? null : i.href) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin) || e.getAttribute("title") !== (i.title == null ? null : i.title)) break;
					return e;
				case "style":
					if (e.hasAttribute("data-precedence")) break;
					return e;
				case "script":
					if (a = e.getAttribute("src"), (a !== (i.src == null ? null : i.src) || e.getAttribute("type") !== (i.type == null ? null : i.type) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin)) && a && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
					return e;
				default: return e;
			}
			if (e = lm(e.nextSibling), e === null) break;
		}
		return null;
	}
	function im(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function am(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function om(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function sm(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function cm(e, t) {
		var n = e.ownerDocument;
		if (e.data === "$~") e._reactRetry = t;
		else if (e.data !== "$?" || n.readyState !== "loading") t();
		else {
			var r = function() {
				t(), n.removeEventListener("DOMContentLoaded", r);
			};
			n.addEventListener("DOMContentLoaded", r), e._reactRetry = r;
		}
	}
	function lm(e) {
		for (; e != null; e = e.nextSibling) {
			var t = e.nodeType;
			if (t === 1 || t === 3) break;
			if (t === 8) {
				if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F") break;
				if (t === "/$" || t === "/&") return null;
			}
		}
		return e;
	}
	var um = null;
	function dm(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return lm(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function fm(e) {
		e = e.previousSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
					if (t === 0) return e;
					t--;
				} else n !== "/$" && n !== "/&" || t++;
			}
			e = e.previousSibling;
		}
		return null;
	}
	function pm(e, t) {
		function n() {
			r = !0;
		}
		if (e.ownerDocument.activeElement === e) return !0;
		var r = !1;
		try {
			e.ownerDocument.addEventListener("focus", n, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
		} finally {
			e.ownerDocument.removeEventListener("focus", n, !0);
		}
		return r;
	}
	function mm(e) {
		yp(function() {
			yp(function(t) {
				return e(t);
			});
		});
	}
	function hm(e, t, n) {
		switch (t = lp(n), e) {
			case "html":
				if (e = t.documentElement, !e) throw Error(i(452));
				return e;
			case "head":
				if (e = t.head, !e) throw Error(i(453));
				return e;
			case "body":
				if (e = t.body, !e) throw Error(i(454));
				return e;
			default: throw Error(i(451));
		}
	}
	function gm(e, t, n) {
		for (var r in n) {
			var i = n[r];
			n.hasOwnProperty(r) && i != null && ep(e, t, r, null, rp, i);
		}
		n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === Cn && (e.onclick = null), Rt(e);
	}
	function _m(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		Rt(e);
	}
	var vm = /* @__PURE__ */ new Map(), ym = /* @__PURE__ */ new Set();
	function bm(e) {
		if (typeof e.getRootNode == "function") {
			var t = e.getRootNode();
			if (t.nodeType === 9 || t.nodeType === 11) return t;
		}
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	var xm = A.d;
	A.d = {
		f: Sm,
		r: Cm,
		D: Em,
		C: Dm,
		L: Om,
		m: km,
		X: jm,
		S: Am,
		M: Mm
	};
	function Sm() {
		var e = xm.f(), t = Ld();
		return e || t;
	}
	function Cm(e) {
		var t = Bt(e);
		t !== null && t.tag === 5 && t.type === "form" ? nc(t) : xm.r(e);
	}
	var wm = typeof document > "u" ? null : document;
	function Tm(e, t, n) {
		var r = wm;
		if (r && typeof t == "string" && t) {
			var i = P(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), ym.has(i) || (ym.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), np(t, "link", e), Ut(t), r.head.appendChild(t)));
		}
	}
	function Em(e) {
		xm.D(e), Tm("dns-prefetch", e, null);
	}
	function Dm(e, t) {
		xm.C(e, t), Tm("preconnect", e, t);
	}
	function Om(e, t, n) {
		xm.L(e, t, n);
		var r = wm;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + P(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + P(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + P(n.imageSizes) + "\"]")) : i += "[href=\"" + P(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = Pm(e);
					break;
				case "script": a = Rm(e);
			}
			if (!(vm.has(a) || (e = D({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), vm.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(Fm(a)) || t === "script" && r.querySelector(zm(a))))) {
				var o = r.createElement("link");
				np(o, "link", e), t === "style" && (o[Lt] = !0, o.onload = o.onerror = function() {
					Wt(o);
				}), Ut(o), r.head.appendChild(o);
			}
		}
	}
	function km(e, t) {
		xm.m(e, t);
		var n = wm;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + P(r) + "\"][href=\"" + P(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Rm(e);
			}
			if (!vm.has(a) && (e = D({
				rel: "modulepreload",
				href: e
			}, t), vm.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(zm(a))) return;
				}
				r = n.createElement("link"), np(r, "link", e), Ut(r), n.head.appendChild(r);
			}
		}
	}
	function Am(e, t, n) {
		xm.S(e, t, n);
		var r = wm;
		if (r && e) {
			var i = Ht(r).hoistableStyles, a = Pm(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(Fm(a))) s.loading = 5;
				else {
					e = D({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = vm.get(a)) && Hm(e, n);
					var c = o = r.createElement("link");
					Ut(c), np(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, Vm(o, t, r);
				}
				o = {
					type: "stylesheet",
					instance: o,
					count: 1,
					state: s
				}, i.set(a, o);
			}
		}
	}
	function jm(e, t) {
		xm.X(e, t);
		var n = wm;
		if (n && e) {
			var r = Ht(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = D({
				src: e,
				async: !0
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Ut(a), np(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Mm(e, t) {
		xm.M(e, t);
		var n = wm;
		if (n && e) {
			var r = Ht(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = D({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Ut(a), np(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Nm(e, t, n, r) {
		var a = (a = Ae.current) ? bm(a) : null;
		if (!a) throw Error(i(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (n = Pm(n.href), t = Ht(a).hoistableStyles, r = t.get(n), r || (r = {
				type: "style",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			case "link":
				if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
					e = Pm(n.href);
					var o = Ht(a).hoistableStyles, s = o.get(e);
					if (s || (a = a.ownerDocument || a, s = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, o.set(e, s), (o = a.querySelector(Fm(e))) ? o._p || (s.instance = o, s.state.loading = 5) : (o = vm.get(e), o || (o = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, vm.set(e, o)), Lm(a, e, o, s.state))), t && r === null) throw Error(i(528, ""));
					return s;
				}
				if (t && r !== null) throw Error(i(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = Rm(n), t = Ht(a).hoistableScripts, r = t.get(n), r || (r = {
				type: "script",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			default: throw Error(i(444, e));
		}
	}
	function Pm(e) {
		return "href=\"" + P(e) + "\"";
	}
	function Fm(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function Im(e) {
		return D({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Lm(e, t, n, r) {
		if (t = e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]")) {
			if (!0 !== t[Lt]) {
				r.loading = 1;
				return;
			}
		} else t = e.createElement("link"), t[Lt] = !0, t.onload = t.onerror = Wt.bind(null, t), np(t, "link", n), Ut(t), e.head.appendChild(t);
		r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		});
	}
	function Rm(e) {
		return "[src=\"" + P(e) + "\"]";
	}
	function zm(e) {
		return "script[async]" + e;
	}
	function Bm(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + P(n.href) + "\"]");
				if (r) return t.instance = r, Ut(r), r;
				var a = D({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), Ut(r), np(r, "style", a), Vm(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				a = Pm(n.href);
				var o = e.querySelector(Fm(a));
				if (o) return t.state.loading |= 4, t.instance = o, Ut(o), o;
				r = Im(n), (a = vm.get(a)) && Hm(r, a), o = (e.ownerDocument || e).createElement("link"), Ut(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), np(o, "link", r), t.state.loading |= 4, Vm(o, n.precedence, e), t.instance = o;
			case "script": return o = Rm(n.src), (a = e.querySelector(zm(o))) ? (t.instance = a, Ut(a), a) : (r = n, (a = vm.get(o)) && (r = D({}, n), Um(r, a)), e = e.ownerDocument || e, a = e.createElement("script"), Ut(a), np(a, "link", r), e.head.appendChild(a), t.instance = a);
			case "void": return null;
			default: throw Error(i(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, Vm(r, n.precedence, e));
		return t.instance;
	}
	function Vm(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function Hm(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function Um(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var Wm = null;
	function Gm(e, t, n) {
		if (Wm === null) {
			var r = /* @__PURE__ */ new Map(), i = Wm = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = Wm, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[It] || a[kt] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function Km(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function qm(e, t, n) {
		if (n === 1 || t.itemProp != null) return !1;
		switch (e) {
			case "meta":
			case "title": return !0;
			case "style":
				if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") break;
				return !0;
			case "link":
				if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) break;
				switch (t.rel) {
					case "stylesheet": return e = t.disabled, typeof t.precedence == "string" && e == null;
					default: return !0;
				}
			case "script": if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string") return !0;
		}
		return !1;
	}
	function Jm(e, t) {
		return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
	}
	function Ym(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function Xm(e) {
		return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * .25;
	}
	function Zm(e, t) {
		typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += Xm(t), e.suspenseyImages.push(t)), e = rh.bind(e), t.decode().then(e, e));
	}
	function Qm(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = Pm(r.href), a = t.querySelector(Fm(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = nh.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, Ut(a);
					return;
				}
				a = t.ownerDocument || t, r = Im(r), (i = vm.get(i)) && Hm(r, i), a = a.createElement("link"), Ut(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), np(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = nh.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var $m = 0;
	function eh(e, t) {
		return e.stylesheets && e.count === 0 && ah(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && ah(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && $m === 0 && ($m = 62500 * op());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && ah(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > $m ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function th(e) {
		if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
			if (e.stylesheets) ah(e, e.stylesheets);
			else if (e.unsuspend) {
				var t = e.unsuspend;
				e.unsuspend = null, t();
			}
		}
	}
	function nh() {
		this.count--, th(this);
	}
	function rh() {
		this.imgCount--, th(this);
	}
	var ih = null;
	function ah(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, ih = /* @__PURE__ */ new Map(), t.forEach(oh, e), ih = null, nh.call(e));
	}
	function oh(e, t) {
		if (!(t.state.loading & 4)) {
			var n = ih.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), ih.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = nh.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var sh = {
		$$typeof: O,
		Provider: null,
		Consumer: null,
		_currentValue: Se,
		_currentValue2: Se,
		_threadCount: 0
	};
	function ch(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = yt(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = yt(0), this.hiddenUpdates = yt(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function lh(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new ch(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = z(3, null, null, t), e.current = a, a.stateNode = e, t = ja(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, mo(a), e;
	}
	function uh(e) {
		return e ? (e = ji, e) : ji;
	}
	function dh(e, t, n, r, i, a) {
		i = uh(i), r.context === null ? r.context = i : r.pendingContext = i, r = go(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = _o(e, r, t), n !== null && (Md(n, e, t), vo(n, e, t));
	}
	function fh(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function ph(e, t) {
		fh(e, t), (e = e.alternate) && fh(e, t);
	}
	function mh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Oi(e, 67108864);
			t !== null && Md(t, e, 67108864), ph(e, 67108864);
		}
	}
	function hh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = kd();
			t = wt(t);
			var n = Oi(e, t);
			n !== null && Md(n, e, t), ph(e, t);
		}
	}
	var gh = !0;
	function _h(e, t, n, r) {
		var i = k.T;
		k.T = null;
		var a = A.p;
		try {
			A.p = 2, yh(e, t, n, r);
		} finally {
			A.p = a, k.T = i;
		}
	}
	function vh(e, t, n, r) {
		var i = k.T;
		k.T = null;
		var a = A.p;
		try {
			A.p = 8, yh(e, t, n, r);
		} finally {
			A.p = a, k.T = i;
		}
	}
	function yh(e, t, n, r) {
		if (gh) {
			var i = bh(r);
			if (i === null) Gf(e, t, r, xh, n), Mh(e, r);
			else if (Ph(i, e, t, n, r)) r.stopPropagation();
			else if (Mh(e, r), t & 4 && -1 < jh.indexOf(e)) {
				for (; i !== null;) {
					var a = Bt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = pt(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - ot(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									Tf(a), !(J & 6) && (md = Je() + 500, Ef(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = Oi(a, 2), s !== null && Md(s, a, 2), Ld(), ph(a, 2);
					}
					if (a = bh(r), a === null && Gf(e, t, r, xh, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else Gf(e, t, r, null, n);
		}
	}
	function bh(e) {
		return e = wn(e), Sh(e);
	}
	var xh = null;
	function Sh(e) {
		if (xh = null, e = zt(e), e !== null) {
			var t = o(e);
			if (t === null) e = null;
			else {
				var n = t.tag;
				if (n === 13) {
					if (e = s(t), e !== null) return e;
					e = null;
				} else if (n === 31) {
					if (e = c(t), e !== null) return e;
					e = null;
				} else if (n === 3) {
					if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
					e = null;
				} else t !== e && (e = null);
			}
		}
		return xh = e, null;
	}
	function Ch(e) {
		switch (e) {
			case "beforetoggle":
			case "cancel":
			case "click":
			case "close":
			case "contextmenu":
			case "copy":
			case "cut":
			case "auxclick":
			case "dblclick":
			case "dragend":
			case "dragstart":
			case "drop":
			case "focusin":
			case "focusout":
			case "input":
			case "invalid":
			case "keydown":
			case "keypress":
			case "keyup":
			case "mousedown":
			case "mouseup":
			case "paste":
			case "pause":
			case "play":
			case "pointercancel":
			case "pointerdown":
			case "pointerup":
			case "ratechange":
			case "reset":
			case "seeked":
			case "submit":
			case "toggle":
			case "touchcancel":
			case "touchend":
			case "touchstart":
			case "volumechange":
			case "change":
			case "selectionchange":
			case "textInput":
			case "compositionstart":
			case "compositionend":
			case "compositionupdate":
			case "beforeblur":
			case "afterblur":
			case "beforeinput":
			case "blur":
			case "fullscreenchange":
			case "fullscreenerror":
			case "focus":
			case "hashchange":
			case "popstate":
			case "select":
			case "selectstart": return 2;
			case "drag":
			case "dragenter":
			case "dragexit":
			case "dragleave":
			case "dragover":
			case "mousemove":
			case "mouseout":
			case "mouseover":
			case "pointermove":
			case "pointerout":
			case "pointerover":
			case "resize":
			case "scroll":
			case "touchmove":
			case "wheel":
			case "mouseenter":
			case "mouseleave":
			case "pointerenter":
			case "pointerleave": return 8;
			case "message": switch (Ye()) {
				case Xe: return 2;
				case Ze: return 8;
				case Qe:
				case $e: return 32;
				case et: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var wh = !1, Th = null, Eh = null, Dh = null, Oh = /* @__PURE__ */ new Map(), kh = /* @__PURE__ */ new Map(), Ah = [], jh = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Mh(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				Th = null;
				break;
			case "dragenter":
			case "dragleave":
				Eh = null;
				break;
			case "mouseover":
			case "mouseout":
				Dh = null;
				break;
			case "pointerover":
			case "pointerout":
				Oh.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": kh.delete(t.pointerId);
		}
	}
	function Nh(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = Bt(t), t !== null && mh(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function Ph(e, t, n, r, i) {
		switch (t) {
			case "focusin": return Th = Nh(Th, e, t, n, r, i), !0;
			case "dragenter": return Eh = Nh(Eh, e, t, n, r, i), !0;
			case "mouseover": return Dh = Nh(Dh, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return Oh.set(a, Nh(Oh.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, kh.set(a, Nh(kh.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Fh(e) {
		var t = zt(e.target);
		if (t !== null) {
			var n = o(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = s(n), t !== null) {
						e.blockedOn = t, Dt(e.priority, function() {
							hh(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, Dt(e.priority, function() {
							hh(n);
						});
						return;
					}
				} else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
					e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
					return;
				}
			}
		}
		e.blockedOn = null;
	}
	function Ih(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = bh(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				F = r, n.target.dispatchEvent(r), F = null;
			} else return t = Bt(n), t !== null && mh(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Lh(e, t, n) {
		Ih(e) && n.delete(t);
	}
	function Rh() {
		wh = !1, Th !== null && Ih(Th) && (Th = null), Eh !== null && Ih(Eh) && (Eh = null), Dh !== null && Ih(Dh) && (Dh = null), Oh.forEach(Lh), kh.forEach(Lh);
	}
	function zh(e, n) {
		e.blockedOn === n && (e.blockedOn = null, wh || (wh = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, Rh)));
	}
	var Bh = null;
	function Vh(e) {
		Bh !== e && (Bh = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			Bh === e && (Bh = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (Sh(r || n) === null) continue;
					break;
				}
				var a = Bt(n);
				a !== null && (e.splice(t, 3), t -= 3, ec(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function Hh(e) {
		function t(t) {
			return zh(t, e);
		}
		Th !== null && zh(Th, e), Eh !== null && zh(Eh, e), Dh !== null && zh(Dh, e), Oh.forEach(t), kh.forEach(t);
		for (var n = 0; n < Ah.length; n++) {
			var r = Ah[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < Ah.length && (n = Ah[0], n.blockedOn === null);) Fh(n), n.blockedOn === null && Ah.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[At] || null;
			if (typeof a == "function") o || Vh(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[At] || null) s = o.formAction;
					else if (Sh(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), Vh(n);
			}
		}
	}
	function Uh() {
		function e(e) {
			e.canIntercept && e.info === "react-transition" && e.intercept({
				handler: function() {
					return new Promise(function(e) {
						return i = e;
					});
				},
				focusReset: "manual",
				scroll: "manual"
			});
		}
		function t() {
			i !== null && (i(), i = null), r || setTimeout(n, 20);
		}
		function n() {
			if (!r && !navigation.transition) {
				var e = navigation.currentEntry;
				e && e.url != null && navigation.navigate(e.url, {
					state: e.getState(),
					info: "react-transition",
					history: "replace"
				});
			}
		}
		if (typeof navigation == "object") {
			var r = !1, i = null;
			return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
				r = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), i !== null && (i(), i = null);
			};
		}
	}
	function Wh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.render = Wh.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(i(409));
		var n = t.current;
		dh(n, kd(), e, t, null, null);
	}, Gh.prototype.unmount = Wh.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			dh(e.current, 2, null, e, null, null), Ld(), t[jt] = null;
		}
	};
	function Gh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = Et();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < Ah.length && t !== 0 && t < Ah[n].priority; n++);
			Ah.splice(n, 0, e), n === 0 && Fh(e);
		}
	};
	var Kh = n.version;
	if (Kh !== "19.3.1") throw Error(i(527, Kh, "19.3.1"));
	A.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
		return e = d(t), e = e === null ? null : p(e), e = e === null ? null : e.stateNode, e;
	};
	var qh = {
		bundleType: 0,
		version: "19.3.1",
		rendererPackageName: "react-dom",
		currentDispatcherRef: k,
		reconcilerVersion: "19.3.1"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var Jh = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!Jh.isDisabled && Jh.supportsFiber) try {
			rt = Jh.inject(qh), it = Jh;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!a(e)) throw Error(i(299));
		var n = !1, r = "", o = Cc, s = wc, c = Tc;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = lh(e, 1, !1, null, null, n, r, null, o, s, c, Uh), e[jt] = t.current, Uf(e), new Wh(t);
	};
})), g = (/* @__PURE__ */ o(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = h();
})))(), _ = (e) => typeof e == "string", v = () => {
	let e, t, n = new Promise((n, r) => {
		e = n, t = r;
	});
	return n.resolve = e, n.reject = t, n;
}, y = (e) => e == null ? "" : String(e), b = (e) => _(e) && /^[A-Za-z0-9_@.-]{1,128}$/.test(e) && !e.includes("..") && ![
	"__proto__",
	"constructor",
	"prototype"
].includes(e), x = (e) => e?.callbackApi ?? e?.constructor?.callbackApi, S = (e, t, n) => {
	e.forEach((e) => {
		t[e] && (n[e] = t[e]);
	});
}, C = /###/g, w = (e) => e && e.includes("###") ? e.replace(C, ".") : e, T = (e) => !e || _(e), E = (e, t, n) => {
	let r = _(t) ? t.split(".") : t, i = 0;
	for (; i < r.length - 1;) {
		if (T(e)) return {};
		let t = w(r[i]);
		!e[t] && n && (e[t] = new n()), e = Object.prototype.hasOwnProperty.call(e, t) ? e[t] : {}, ++i;
	}
	return T(e) ? {} : {
		obj: e,
		k: w(r[i])
	};
}, D = (e, t, n) => {
	let { obj: r, k: i } = E(e, t, Object);
	if (r !== void 0 || t.length === 1) {
		r[i] = n;
		return;
	}
	let a = t[t.length - 1], o = t.slice(0, t.length - 1), s = E(e, o, Object);
	for (; s.obj === void 0 && o.length;) a = `${o[o.length - 1]}.${a}`, o = o.slice(0, o.length - 1), s = E(e, o, Object), s?.obj && s.obj[`${s.k}.${a}`] !== void 0 && (s.obj = void 0);
	s.obj[`${s.k}.${a}`] = n;
}, ee = (e, t, n, r) => {
	let { obj: i, k: a } = E(e, t, Object);
	i[a] = i[a] || [], i[a].push(n);
}, te = (e, t) => {
	let { obj: n, k: r } = E(e, t);
	if (n && Object.prototype.hasOwnProperty.call(n, r)) return n[r];
}, ne = (e, t, n) => {
	let r = te(e, n);
	return r === void 0 ? te(t, n) : r;
}, re = (e, t, n) => {
	for (let r in t) r !== "__proto__" && r !== "constructor" && (Object.prototype.hasOwnProperty.call(e, r) ? _(e[r]) || e[r] instanceof String || _(t[r]) || t[r] instanceof String ? n && (e[r] = t[r]) : re(e[r], t[r], n) : e[r] = t[r]);
	return e;
}, ie = (e) => e.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), ae = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;",
	"/": "&#x2F;"
}, oe = (e) => _(e) ? e.replace(/[&<>"'\/]/g, (e) => ae[e]) : e, O = class {
	constructor(e) {
		this.capacity = e, this.regExpMap = /* @__PURE__ */ new Map(), this.regExpQueue = [];
	}
	getRegExp(e) {
		let t = this.regExpMap.get(e);
		if (t !== void 0) return t;
		let n = new RegExp(e);
		return this.regExpQueue.length === this.capacity && this.regExpMap.delete(this.regExpQueue.shift()), this.regExpMap.set(e, n), this.regExpQueue.push(e), n;
	}
}, se = [
	" ",
	",",
	"?",
	"!",
	";"
], ce = new O(20), le = (e, t, n) => {
	t ||= "", n ||= "";
	let r = se.filter((e) => !t.includes(e) && !n.includes(e));
	if (r.length === 0) return !0;
	let i = ce.getRegExp(`(${r.map((e) => e === "?" ? "\\?" : e).join("|")})`), a = !i.test(e);
	if (!a) {
		let t = e.indexOf(n);
		t > 0 && !i.test(e.substring(0, t)) && (a = !0);
	}
	return a;
}, ue = (e, t, n = ".") => {
	if (!e) return;
	if (e[t]) return Object.prototype.hasOwnProperty.call(e, t) ? e[t] : void 0;
	let r = t.split(n), i = e;
	for (let e = 0; e < r.length;) {
		if (!i || typeof i != "object") return;
		let t, a = "";
		for (let o = e; o < r.length; ++o) if (o !== e && (a += n), a += r[o], t = i[a], typeof t != "function" && a !== "__proto__" || Object.prototype.hasOwnProperty.call(i, a) || (t = void 0), t !== void 0) {
			if ([
				"string",
				"number",
				"boolean"
			].includes(typeof t) && o < r.length - 1) continue;
			e += o - e + 1;
			break;
		}
		i = t;
	}
	return i;
}, de = (e) => e?.replace(/_/g, "-"), fe = {
	type: "logger",
	log(e) {
		this.output("log", e);
	},
	warn(e) {
		this.output("warn", e);
	},
	error(e) {
		this.output("error", e);
	},
	output(e, t) {
		console?.[e]?.apply?.(console, t);
	}
}, pe = new class e {
	constructor(e, t = {}) {
		this.init(e, t);
	}
	init(e, t = {}) {
		this.prefix = t.prefix || "i18next:", this.logger = e || fe, this.options = t, this.debug = t.debug, this.seen = /* @__PURE__ */ new Set();
	}
	log(...e) {
		return this.forward(e, "log", "", !0);
	}
	warn(...e) {
		return this.forward(e, "warn", "", !0);
	}
	error(...e) {
		return this.forward(e, "error", "");
	}
	deprecate(...e) {
		return this.forward(e, "warn", "WARNING DEPRECATED: ", !0);
	}
	once(e, t, ...n) {
		return !this.debug || this.seen.has(e) || this.seen.size >= 1e3 ? null : (this.seen.add(e), this[t](...n));
	}
	forward(e, t, n, r) {
		return r && !this.debug ? null : (e = e.map((e) => _(e) ? e.replace(/[\r\n\x00-\x1F\x7F]/g, " ") : e), _(e[0]) && (e[0] = `${n}${this.prefix} ${e[0]}`), this.logger[t](e));
	}
	create(t) {
		return new e(this.logger, {
			prefix: `${this.prefix}:${t}:`,
			...this.options
		});
	}
	clone(t) {
		return t ||= this.options, t.prefix = t.prefix || this.prefix, new e(this.logger, t);
	}
}(), me = class {
	constructor() {
		this.observers = {};
	}
	on(e, t) {
		return e.split(" ").forEach((e) => {
			this.observers[e] || (this.observers[e] = /* @__PURE__ */ new Map());
			let n = this.observers[e].get(t) || 0;
			this.observers[e].set(t, n + 1);
		}), this;
	}
	off(e, t) {
		(typeof e == "string" ? e.split(" ") : [e]).forEach((e) => {
			this.observers[e] && (t ? this.observers[e].delete(t) : delete this.observers[e]);
		});
	}
	once(e, t) {
		let n = (...r) => {
			t(...r), this.off(e, n);
		};
		return this.on(e, n), this;
	}
	emit(e, ...t) {
		this.observers[e] && Array.from(this.observers[e].entries()).forEach(([e, n]) => {
			for (let r = 0; r < n; r++) e(...t);
		}), this.observers["*"] && Array.from(this.observers["*"].entries()).forEach(([n, r]) => {
			for (let i = 0; i < r; i++) n(e, ...t);
		});
	}
}, he = /* @__PURE__ */ new WeakSet(), ge = class extends me {
	constructor(e, t = {
		ns: ["translation"],
		defaultNS: "translation"
	}) {
		super(), this.data = e || {}, this.options = t, this.logger = pe.create("resourceStore"), this.options.keySeparator === void 0 && (this.options.keySeparator = "."), this.options.ignoreJSONStructure === void 0 && (this.options.ignoreJSONStructure = !0);
	}
	addNamespaces(e) {
		this.options.ns.includes(e) || this.options.ns.push(e);
	}
	removeNamespaces(e) {
		let t = this.options.ns.indexOf(e);
		t > -1 && this.options.ns.splice(t, 1);
	}
	deprecateDottedLng(e) {
		this.logger.once(e, "deprecate", `${e}: a dotted language ('en.translation.key') that carries the namespace and key is removed in v27; pass language, namespace and key as separate arguments`);
	}
	getResource(e, t, n, r = {}) {
		let i = r.keySeparator === void 0 ? this.options.keySeparator : r.keySeparator, a = r.ignoreJSONStructure === void 0 ? this.options.ignoreJSONStructure : r.ignoreJSONStructure, o;
		e.includes(".") ? (this.deprecateDottedLng("getResource"), o = e.split(".")) : (o = [e, t], n && (Array.isArray(n) ? o.push(...n) : _(n) && i ? o.push(...n.split(i)) : o.push(n)));
		let s = te(this.data, o);
		return s == null && !t && !n && e.includes(".") && (e = o[0], t = o[1], n = o.slice(2).join(".")), s != null || !a || !_(n) ? s : ue(this.data?.[e]?.[t], n, i);
	}
	addResource(e, t, n, r, i = { silent: !1 }) {
		let a = i.keySeparator === void 0 ? this.options.keySeparator : i.keySeparator, o = [e, t];
		n && (o = o.concat(a ? n.split(a) : n)), e.includes(".") && (this.deprecateDottedLng("addResource"), o = e.split("."), r = t, t = o[1]), this.addNamespaces(t), D(this.data, o, r), i.silent || this.emit("added", e, t, n, r);
	}
	addResources(e, t, n, r = { silent: !1 }) {
		for (let r in n) (_(n[r]) || Array.isArray(n[r])) && this.addResource(e, t, r, n[r], { silent: !0 });
		r.silent || this.emit("added", e, t, n);
	}
	addResourceBundle(e, t, n, r, i, a = {
		silent: !1,
		skipCopy: !1
	}) {
		let o = [e, t];
		e.includes(".") && (this.deprecateDottedLng("addResourceBundle"), o = e.split("."), r = n, n = t, t = o[1]), this.addNamespaces(t);
		let s = te(this.data, o) || {};
		a.skipCopy || (n = JSON.parse(JSON.stringify(n))), r ? re(s, n, i) : s = {
			...s,
			...n
		}, D(this.data, o, s), a.silent || this.emit("added", e, t, n);
	}
	removeResourceBundle(e, t) {
		this.hasResourceBundle(e, t) && delete this.data[e][t], this.removeNamespaces(t), this.emit("removed", e, t);
	}
	hasResourceBundle(e, t) {
		return this.getResource(e, t) !== void 0;
	}
	getResourceBundle(e, t) {
		return t ||= this.options.defaultNS, this.getResource(e, t);
	}
	getDataByLanguage(e) {
		return this.data[e];
	}
	hasLanguageSomeTranslations(e) {
		let t = this.getDataByLanguage(e);
		return !!(t && Object.keys(t) || []).find((e) => {
			let n = t[e];
			return he.has(n) ? !0 : !n || Object.keys(n).length === 0 ? !1 : (typeof n == "object" && he.add(n), !0);
		});
	}
	toJSON() {
		return this.data;
	}
}, _e = {
	processors: {},
	addPostProcessor(e) {
		this.processors[e.name] = e;
	},
	handle(e, t, n, r, i) {
		return e.forEach((e) => {
			t = this.processors[e]?.process(t, n, r, i) ?? t;
		}), t;
	}
}, ve = Symbol("i18next/PATH_KEY");
function ye() {
	let e = [], t = Object.create(null), n;
	return t.get = (r, i) => (n?.revoke?.(), i === ve ? e : (e.push(i), n = Proxy.revocable(r, t), n.proxy)), Proxy.revocable(Object.create(null), t).proxy;
}
function be(e, t) {
	let { [ve]: n } = e(ye()), r = t?.keySeparator ?? ".", i = t?.nsSeparator ?? ":", a = t?.enableSelector === "strict";
	if (n.length > 1 && i) {
		let e = t?.ns, o = a ? Array.isArray(e) ? e : e ? [e] : null : Array.isArray(e) ? e : null;
		if (o && (a ? o : o.length > 1 ? o.slice(1) : []).includes(n[0])) return `${n[0]}${i}${n.slice(1).join(r)}`;
	}
	return n.join(r);
}
var xe = (e) => !_(e) && typeof e != "boolean" && typeof e != "number", k = class e extends me {
	constructor(e, t = {}) {
		super(), S([
			"resourceStore",
			"languageUtils",
			"pluralResolver",
			"interpolator",
			"backendConnector",
			"i18nFormat",
			"utils",
			"ownPostProcessors"
		], e, this), this.options = t, this.options.keySeparator === void 0 && (this.options.keySeparator = "."), this.logger = pe.create("translator"), this.checkedLoadedFor = {};
	}
	changeLanguage(e) {
		e && (this.language = e);
	}
	exists(e, t = { interpolation: {} }) {
		let n = { ...t };
		if (e == null) return !1;
		let r = this.resolve(e, n);
		if (r?.res === void 0) return !1;
		let i = xe(r.res);
		return !(n.returnObjects === !1 && i);
	}
	extractFromKey(e, t) {
		let n = t.nsSeparator === void 0 ? this.options.nsSeparator : t.nsSeparator;
		n === void 0 && (n = ":");
		let r = t.keySeparator === void 0 ? this.options.keySeparator : t.keySeparator, i = t.ns || this.options.defaultNS || [], a = n && e.includes(n), o = !this.options.userDefinedKeySeparator && !t.keySeparator && !this.options.userDefinedNsSeparator && !t.nsSeparator && !le(e, n, r);
		if (a && !o) {
			let t = e.match(this.interpolator.nestingRegexp);
			if (t && t.length > 0) return {
				key: e,
				namespaces: _(i) ? [i] : i
			};
			let a = e.split(n);
			(n !== r || n === r && this.options.ns.includes(a[0])) && (i = a.shift()), e = a.join(r);
		}
		return {
			key: e,
			namespaces: _(i) ? [i] : i
		};
	}
	translate(t, n, r) {
		let i = typeof n == "object" ? { ...n } : n;
		if (typeof i != "object" && this.options.overloadTranslationOptionHandler && (i = this.options.overloadTranslationOptionHandler(arguments)), typeof i == "object" && (i = { ...i }), i ||= {}, t == null) return "";
		typeof t == "function" && (t = be(t, {
			...this.options,
			...i
		})), Array.isArray(t) || (t = [String(t)]), t = t.map((e) => typeof e == "function" ? be(e, {
			...this.options,
			...i
		}) : String(e));
		let a = i.returnDetails === void 0 ? this.options.returnDetails : i.returnDetails, o = i.keySeparator === void 0 ? this.options.keySeparator : i.keySeparator, { key: s, namespaces: c } = this.extractFromKey(t[t.length - 1], i), l = c[c.length - 1], u = i.nsSeparator === void 0 ? this.options.nsSeparator : i.nsSeparator;
		u === void 0 && (u = ":");
		let d = i.lng || this.language, f = i.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
		if (d?.toLowerCase() === "cimode") return f ? a ? {
			res: `${l}${u}${s}`,
			usedKey: s,
			exactUsedKey: s,
			usedLng: d,
			usedNS: l,
			usedParams: this.getUsedParamsDetails(i)
		} : `${l}${u}${s}` : a ? {
			res: s,
			usedKey: s,
			exactUsedKey: s,
			usedLng: d,
			usedNS: l,
			usedParams: this.getUsedParamsDetails(i)
		} : s;
		let p = this.resolve(t, i), m = p?.res, h = p?.usedKey || s, g = p?.exactUsedKey || s, v = [
			"[object Number]",
			"[object Function]",
			"[object RegExp]"
		], y = i.joinArrays === void 0 ? this.options.joinArrays : i.joinArrays, b = !this.i18nFormat || this.i18nFormat.handleAsObject, x = i.count !== void 0 && !_(i.count), S = e.hasDefaultValue(i), C = x ? this.pluralResolver.getSuffix(d, i.count, i) : "", w = i.ordinal && x ? this.pluralResolver.getSuffix(d, i.count, { ordinal: !1 }) : "", T = x && !i.ordinal && i.count === 0, E = T && i[`defaultValue${this.options.pluralSeparator}zero`] || i[`defaultValue${C}`] || i[`defaultValue${w}`] || i.defaultValue, D = m;
		b && !m && S && (D = E);
		let ee = xe(D), te = Object.prototype.toString.apply(D);
		if (b && D && ee && !v.includes(te) && !(_(y) && Array.isArray(D))) {
			if (!i.returnObjects && !this.options.returnObjects) {
				this.options.returnedObjectHandler || (this.logger.warn("accessing an object - but returnObjects options is not enabled!"), this.logger.once("returnedObject", "deprecate", "accessing an object without returnObjects returns a sentence about it today; from v27 t() returns the key, as for a missing key (returnedObjectHandler can keep today's text)"));
				let e = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(h, D, {
					...i,
					ns: c
				}) : `key '${s} (${this.language})' returned an object instead of string.`;
				return a ? (p.res = e, p.usedParams = this.getUsedParamsDetails(i), p) : e;
			}
			if (o) {
				let e = Array.isArray(D), t = e ? [] : {}, n = e ? g : h;
				for (let e in D) if (Object.prototype.hasOwnProperty.call(D, e)) {
					let r = `${n}${o}${e}`;
					t[e] = S && !m ? this.translate(r, {
						...i,
						defaultValue: xe(E) ? E[e] : void 0,
						joinArrays: !1,
						ns: c
					}) : this.translate(r, {
						...i,
						joinArrays: !1,
						ns: c
					}), t[e] === r && (t[e] = D[e]);
				}
				m = t;
			}
		} else if (b && _(y) && Array.isArray(m)) m = m.join(y), m &&= this.extendTranslation(m, t, i, p, r);
		else {
			let e = !1, n = !1;
			!this.isValidLookup(m) && S && (e = !0, m = E), this.isValidLookup(m) || (n = !0, m = s);
			let a = (i.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey) && n ? void 0 : m, c = S && E !== m && this.options.updateMissing;
			if (n || e || c) {
				if (this.logger.log(c ? "updateKey" : "missingKey", d, l, x && !c ? `${s}${this.pluralResolver.getSuffix(d, i.count, i)}` : s, c ? E : m), o) {
					let e = this.resolve(s, {
						...i,
						keySeparator: !1
					});
					e && e.res && this.logger.warn("Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.");
				}
				let e = [], t = this.languageUtils.getFallbackCodes(this.options.fallbackLng, i.lng || this.language);
				if (this.options.saveMissingTo === "fallback" && t && t[0]) for (let n = 0; n < t.length; n++) e.push(t[n]);
				else this.options.saveMissingTo === "all" ? e = this.languageUtils.toResolveHierarchy(i.lng || this.language) : e.push(i.lng || this.language);
				let n = (e, t, n) => {
					let r = S && n !== m ? n : a;
					this.options.missingKeyHandler ? this.options.missingKeyHandler(e, l, t, r, c, i) : this.backendConnector?.saveMissing && this.backendConnector.saveMissing(e, l, t, r, c, i, void 0, this.utils?.hasLoadedNamespace), this.emit("missingKey", e, l, t, m);
				};
				this.options.saveMissing && (this.options.saveMissingPlurals && x ? e.forEach((e) => {
					let t = this.pluralResolver.getSuffixes(e, i);
					T && i[`defaultValue${this.options.pluralSeparator}zero`] && !t.includes(`${this.options.pluralSeparator}zero`) && t.push(`${this.options.pluralSeparator}zero`), t.forEach((t) => {
						n([e], s + t, i[`defaultValue${t}`] || E);
					});
				}) : n(e, s, E));
			}
			m = this.extendTranslation(m, t, i, p, r), n && m === s && this.options.appendNamespaceToMissingKey && (m = `${l}${u}${s}`), (n || e) && this.options.parseMissingKeyHandler && (m = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? `${l}${u}${s}` : s, e ? m : void 0, i));
		}
		return a ? (p.res = m, p.usedParams = this.getUsedParamsDetails(i), p) : m;
	}
	extendTranslation(e, t, n, r, i) {
		if (this.i18nFormat?.parse) e = this.i18nFormat.parse(e, {
			...this.options.interpolation.defaultVariables,
			...n
		}, n.lng || this.language || r.usedLng, r.usedNS, r.usedKey, { resolved: r });
		else if (!n.skipInterpolation) {
			n.interpolation && this.interpolator.init({
				...n,
				interpolation: {
					...this.options.interpolation,
					...n.interpolation
				}
			});
			let a = _(e) && (n?.interpolation?.skipOnVariables === void 0 ? this.options.interpolation.skipOnVariables : n.interpolation.skipOnVariables), o;
			if (a) {
				let t = e.match(this.interpolator.nestingRegexp);
				o = t && t.length;
			}
			let s = n.replace && !_(n.replace) ? n.replace : n;
			if (this.options.interpolation.defaultVariables && (s = {
				...this.options.interpolation.defaultVariables,
				...s
			}), e = this.interpolator.interpolate(e, s, n.lng || this.language || r.usedLng, n), a) {
				let t = e.match(this.interpolator.nestingRegexp), r = t && t.length;
				o < r && (n.nest = !1);
			}
			!n.lng && r && r.res && (n.lng = this.language || r.usedLng), n.nest !== !1 && (e = this.interpolator.nest(e, (...e) => i?.[0] === e[0] && !n.context ? (this.logger.warn(`It seems you are nesting recursively key: ${e[0]} in key: ${t[0]}`), null) : this.translate(...e, t), n)), n.interpolation && this.interpolator.reset();
		}
		let a = n.postProcess || this.options.postProcess, o = _(a) ? [a] : a;
		return e != null && o?.length && n.applyPostProcessor !== !1 && (o.forEach((e) => {
			this.logger.debug && _e.processors[e] && this.ownPostProcessors && !this.ownPostProcessors.has(e) && this.logger.once(e, "deprecate", `postProcess: '${e}' was registered with use() on another i18next instance; from v27 post-processors are per instance, so call use() with it on this instance too`);
		}), e = _e.handle(o, e, t, this.options && this.options.postProcessPassResolved ? {
			i18nResolved: {
				...r,
				usedParams: this.getUsedParamsDetails(n)
			},
			...n
		} : n, this)), e;
	}
	resolve(e, t = {}) {
		let n, r, i, a, o;
		return _(e) && (e = [e]), Array.isArray(e) && (e = e.map((e) => typeof e == "function" ? be(e, {
			...this.options,
			...t
		}) : e)), e.forEach((e) => {
			if (this.isValidLookup(n)) return;
			let s = this.extractFromKey(e, t), c = s.key;
			r = c;
			let l = s.namespaces;
			this.options.fallbackNS && (l = l.concat(this.options.fallbackNS));
			let u = t.count !== void 0 && !_(t.count), d = u && !t.ordinal && t.count === 0, f = t.context !== void 0 && (_(t.context) || typeof t.context == "number") && t.context !== "", p = t.lngs ? t.lngs : this.languageUtils.toResolveHierarchy(t.lng || this.language, t.fallbackLng);
			l.forEach((e) => {
				this.isValidLookup(n) || (o = e, !this.checkedLoadedFor[`${p[0]}-${e}`] && this.utils?.hasLoadedNamespace && !this.utils?.hasLoadedNamespace(o) && (this.checkedLoadedFor[`${p[0]}-${e}`] = !0, this.logger.warn(`key "${r}" for languages "${p.join(", ")}" won't get resolved as namespace "${o}" was not yet loaded`, "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!")), p.forEach((r) => {
					if (this.isValidLookup(n)) return;
					a = r;
					let o = [c];
					if (this.i18nFormat?.addLookupKeys) this.i18nFormat.addLookupKeys(o, c, r, e, t);
					else {
						let e;
						u && (e = this.pluralResolver.getSuffix(r, t.count, t));
						let n = `${this.options.pluralSeparator}zero`, i = `${this.options.pluralSeparator}ordinal${this.options.pluralSeparator}`;
						if (u && (t.ordinal && e.startsWith(i) && o.push(c + e.replace(i, this.options.pluralSeparator)), o.push(c + e), d && o.push(c + n)), f) {
							let r = `${c}${this.options.contextSeparator || "_"}${t.context}`;
							o.push(r), u && (t.ordinal && e.startsWith(i) && o.push(r + e.replace(i, this.options.pluralSeparator)), o.push(r + e), d && o.push(r + n));
						}
					}
					let s;
					for (; s = o.pop();) this.isValidLookup(n) || (i = s, n = this.getResource(r, e, s, t));
				}));
			});
		}), {
			res: n,
			usedKey: r,
			exactUsedKey: i,
			usedLng: a,
			usedNS: o
		};
	}
	isValidLookup(e) {
		return e !== void 0 && !(!this.options.returnNull && e === null) && !(!this.options.returnEmptyString && e === "");
	}
	getResource(e, t, n, r = {}) {
		return this.i18nFormat?.getResource ? this.i18nFormat.getResource(e, t, n, r) : this.resourceStore.getResource(e, t, n, r);
	}
	getUsedParamsDetails(e = {}) {
		let t = [
			"defaultValue",
			"ordinal",
			"context",
			"replace",
			"lng",
			"lngs",
			"fallbackLng",
			"ns",
			"keySeparator",
			"nsSeparator",
			"returnObjects",
			"returnDetails",
			"joinArrays",
			"postProcess",
			"interpolation"
		], n = e.replace && !_(e.replace), r = n ? e.replace : e;
		if (n && e.count !== void 0 && (r = {
			...r,
			count: e.count
		}), this.options.interpolation.defaultVariables && (r = {
			...this.options.interpolation.defaultVariables,
			...r
		}), !n) {
			r = { ...r };
			for (let e of t) delete r[e];
		}
		return r;
	}
	static hasDefaultValue(e) {
		for (let t in e) if (Object.prototype.hasOwnProperty.call(e, t) && t.startsWith("defaultValue") && e[t] !== void 0) return !0;
		return !1;
	}
}, A = class {
	constructor(e) {
		this.options = e, this.supportedLngs = this.options.supportedLngs || !1, this.logger = pe.create("languageUtils"), this.resolveHierarchyCache = {};
	}
	clearCache() {
		this.resolveHierarchyCache = {};
	}
	getScriptPartFromCode(e) {
		if (e = de(e), !e || !e.includes("-")) return null;
		let t = e.split("-");
		return t.length === 2 || (t.pop(), t[t.length - 1].toLowerCase() === "x") ? null : this.formatLanguageCode(t.join("-"));
	}
	getLanguagePartFromCode(e) {
		if (e = de(e), !e || !e.includes("-")) return e;
		let t = e.split("-");
		return this.formatLanguageCode(t[0]);
	}
	formatLanguageCode(e) {
		if (_(e) && e.includes("-")) {
			let t;
			try {
				t = Intl.getCanonicalLocales(e)[0];
			} catch {}
			return t && this.options.lowerCaseLng && (t = t.toLowerCase()), t || (this.options.lowerCaseLng ? e.toLowerCase() : e);
		}
		let t = this.options.cleanCode || this.options.lowerCaseLng ? e.toLowerCase() : e;
		return this.logger.debug && _(e) && this.deprecateBareCode(e, t), t;
	}
	deprecateBareCode(e, t) {
		let n;
		try {
			n = Intl.getCanonicalLocales(e)[0];
		} catch {
			return;
		}
		let r = n.toLowerCase() === e.toLowerCase() ? n : e.toLowerCase();
		this.options.lowerCaseLng && (r = r.toLowerCase()), r !== t && this.logger.once(e, "deprecate", `language code '${e}' is used as '${t}'; i18next v27 gives it the canonical casing '${r}', use '${r}' in lng, fallbackLng, supportedLngs and the resources`);
	}
	isSupportedCode(e) {
		return (this.options.load === "languageOnly" || this.options.nonExplicitSupportedLngs) && (e = this.getLanguagePartFromCode(e)), !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.includes(e);
	}
	getBestMatchFromCodes(e) {
		if (!e) return null;
		let t;
		return e.forEach((e) => {
			if (t) return;
			let n = this.formatLanguageCode(e);
			(!this.options.supportedLngs || this.isSupportedCode(n)) && (t = n);
		}), !t && this.options.supportedLngs && e.forEach((e) => {
			if (t) return;
			let n = this.getScriptPartFromCode(e);
			if (this.isSupportedCode(n)) return t = n;
			let r = this.getLanguagePartFromCode(e);
			if (this.isSupportedCode(r)) return t = r;
			t = this.options.supportedLngs.find((e) => e === r ? !0 : !e.includes("-") && !r.includes("-") ? !1 : !(!e.includes("-") || r.includes("-") || e.slice(0, e.indexOf("-")) !== r));
		}), t ||= this.getFallbackCodes(this.options.fallbackLng)[0], t;
	}
	getFallbackCodes(e, t) {
		if (!e) return [];
		if (typeof e == "function" && (e = e(t)), _(e) && (e = [e]), Array.isArray(e)) return e;
		if (!t) return e.default || [];
		let n = e[t];
		return n ||= e[this.getScriptPartFromCode(t)], n ||= e[this.formatLanguageCode(t)], n ||= e[this.getLanguagePartFromCode(t)], n ||= e.default, n || [];
	}
	toResolveHierarchy(e, t) {
		let n = this.options.fallbackLng, r = Array.isArray(n) ? n.join("|") : n;
		r !== this._cachedFallbackLng && (this.resolveHierarchyCache = {}, this._cachedFallbackLng = r);
		let i = t === void 0 || t === !1 || _(t), a = t === void 0 && typeof this.options.fallbackLng == "function", o = _(e) && i && !a, s = null;
		if (o) {
			let n;
			n = t === void 0 ? "undefined" : t === !1 ? "boolean:false" : `string:${t}`, s = `${e.length}:${e}|${n}`;
		}
		if (s !== null) {
			let e = this.resolveHierarchyCache[s];
			if (e !== void 0) return e.slice();
		}
		let c = this.getFallbackCodes((t === !1 ? [] : t) || this.options.fallbackLng || [], e), l = [], u = (e) => {
			e && (this.isSupportedCode(e) ? l.push(e) : this.logger.warn(`rejecting language code not found in supportedLngs: ${e}`));
		};
		return _(e) && (e.includes("-") || e.includes("_")) ? (this.options.load !== "languageOnly" && u(this.formatLanguageCode(e)), this.options.load !== "languageOnly" && this.options.load !== "currentOnly" && u(this.getScriptPartFromCode(e)), this.options.load !== "currentOnly" && u(this.getLanguagePartFromCode(e))) : _(e) && u(this.formatLanguageCode(e)), c.forEach((e) => {
			let t = this.formatLanguageCode(e);
			l.includes(t) || u(t);
		}), s === null ? l : (this.resolveHierarchyCache[s] = l, l.slice());
	}
}, Se = {
	zero: 0,
	one: 1,
	two: 2,
	few: 3,
	many: 4,
	other: 5
}, Ce = {
	select: (e) => e === 1 ? "one" : "other",
	resolvedOptions: () => ({ pluralCategories: ["one", "other"] })
}, we = class {
	constructor(e, t = {}) {
		this.languageUtils = e, this.options = t, this.logger = pe.create("pluralResolver"), this.pluralRulesCache = {};
	}
	clearCache() {
		this.pluralRulesCache = {};
	}
	getRule(e, t = {}) {
		let n = de(e === "dev" ? "en" : e), r = t.ordinal ? "ordinal" : "cardinal", i = JSON.stringify({
			cleanedCode: n,
			type: r
		});
		if (i in this.pluralRulesCache) return this.pluralRulesCache[i];
		let a;
		try {
			a = new Intl.PluralRules(n, { type: r });
		} catch {
			if (typeof Intl > "u") return this.logger.error("No Intl support, please use an Intl polyfill!"), Ce;
			if (!e.match(/-|_/)) return Ce;
			let n = this.languageUtils.getLanguagePartFromCode(e);
			a = this.getRule(n, t);
		}
		return this.pluralRulesCache[i] = a, a;
	}
	needsPlural(e, t = {}) {
		let n = this.getRule(e, t);
		return n ||= this.getRule("dev", t), n?.resolvedOptions().pluralCategories.length > 1;
	}
	getPluralFormsOfKey(e, t, n = {}) {
		return this.getSuffixes(e, n).map((e) => `${t}${e}`);
	}
	getSuffixes(e, t = {}) {
		let n = this.getRule(e, t);
		return n ||= this.getRule("dev", t), n ? n.resolvedOptions().pluralCategories.sort((e, t) => Se[e] - Se[t]).map((e) => `${this.options.prepend}${t.ordinal ? `ordinal${this.options.prepend}` : ""}${e}`) : [];
	}
	getSuffix(e, t, n = {}) {
		let r = this.getRule(e, n);
		return r ? `${this.options.prepend}${n.ordinal ? `ordinal${this.options.prepend}` : ""}${r.select(t)}` : (this.logger.warn(`no plural rule found for: ${e}`), this.getSuffix("dev", t, n));
	}
}, Te = (e, t, n, r = ".", i = !0) => {
	let a = ne(e, t, n);
	return a == null && i && _(n) && (a = ue(e, n, r), a === void 0 && (a = ue(t, n, r))), a;
}, Ee = class {
	constructor(e = {}) {
		this.logger = pe.create("interpolator"), this.options = e, this.format = e?.interpolation?.format || ((e) => e), this.init(e);
	}
	init(e = {}) {
		e.interpolation ||= { escapeValue: !0 };
		let { escape: t, escapeValue: n, useRawValueToEscape: r, prefix: i, prefixEscaped: a, suffix: o, suffixEscaped: s, formatSeparator: c, unescapeSuffix: l, unescapePrefix: u, nestingPrefix: d, nestingPrefixEscaped: f, nestingSuffix: p, nestingSuffixEscaped: m, nestingOptionsSeparator: h, maxReplaces: g, alwaysFormat: _ } = e.interpolation;
		if (a || s || f || m) {
			let e = Object.entries({
				prefixEscaped: a,
				suffixEscaped: s,
				nestingPrefixEscaped: f,
				nestingSuffixEscaped: m
			}).filter(([, e]) => e).map(([e]) => e);
			this.logger.once(e.join(), "deprecate", `interpolation.${e.join(", interpolation.")}: the regex-escaped delimiter options are removed in v27; pass the literal delimiters as prefix, suffix, nestingPrefix and nestingSuffix`);
		}
		this.escape = t === void 0 ? oe : t, this.escapeValue = n === void 0 || n, this.useRawValueToEscape = r !== void 0 && r, this.prefix = i ? ie(i) : a || "{{", this.suffix = o ? ie(o) : s || "}}", this.formatSeparator = c || ",", this.unescapePrefix = l ? "" : u ? ie(u) : "-", this.unescapeSuffix = this.unescapePrefix ? "" : l ? ie(l) : "", this.nestingPrefix = d ? ie(d) : f || ie("$t("), this.nestingSuffix = p ? ie(p) : m || ie(")"), this.nestingOptionsSeparator = h || ",", this.maxReplaces = g || 1e3, this.alwaysFormat = _ !== void 0 && _, this.resetRegExp();
	}
	reset() {
		this.options && this.init(this.options);
	}
	resetRegExp() {
		let e = (e, t) => e?.source === t ? (e.lastIndex = 0, e) : new RegExp(t, "g");
		this.regexp = e(this.regexp, `${this.prefix}(.+?)${this.suffix}`), this.regexpUnescape = e(this.regexpUnescape, `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`), this.nestingRegexp = e(this.nestingRegexp, `${this.nestingPrefix}((?:[^()"']|"[^"]*"|'[^']*'|\\((?:[^()"']|"[^"]*"|'[^']*')*\\))*?)${this.nestingSuffix}`);
	}
	interpolate(e, t, n, r) {
		let i, a, o, s = e, c = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {}, l = (e) => {
			if (!e.includes(this.formatSeparator)) {
				let i = Te(t, c, e, this.options.keySeparator, this.options.ignoreJSONStructure);
				return this.alwaysFormat ? this.format(i, void 0, n, {
					...r,
					...t,
					interpolationkey: e
				}) : i;
			}
			let i = e.split(this.formatSeparator), a = i.shift().trim(), o = i.join(this.formatSeparator).trim();
			return this.format(Te(t, c, a, this.options.keySeparator, this.options.ignoreJSONStructure), o, n, {
				...r,
				...t,
				interpolationkey: a
			});
		};
		this.resetRegExp(), !this.escapeValue && typeof e == "string" && /\$t\([^)]*\{[^}]*\{\{/.test(e) && this.logger.warn("nesting options string contains interpolated variables with escapeValue: false — if any of those values are attacker-controlled they can inject additional nesting options (e.g. redirect lng/ns). Sanitise untrusted input before passing it to t(), or keep escapeValue: true.");
		let u = r?.missingInterpolationHandler || this.options.missingInterpolationHandler, d = r?.interpolation?.skipOnVariables === void 0 ? this.options.interpolation.skipOnVariables : r.interpolation.skipOnVariables, f = [{
			regex: this.regexpUnescape,
			safeValue: (e) => e
		}, {
			regex: this.regexp,
			safeValue: (e) => this.escapeValue ? (this.escape === oe && this.options?.interpolation?.escapeValue !== !1 && _(e) && e.includes("/") && this.logger.once("/", "deprecate", "escapeValue renders '/' in a value as '&#x2F;' today; from v27 the default escape leaves '/' as it is"), this.escape(e)) : e
		}], p = [], m = 0;
		return f.forEach((t) => {
			for (o = 0; i = t.regex.exec(e);) {
				let n = i.index - m, c = p.find(([e, t]) => n >= e && n < t);
				if (c) {
					t.regex.lastIndex = c[1] + m;
					continue;
				}
				let f = i[1].trim();
				if (a = l(f), a === void 0) {
					if (typeof u == "function") {
						let t = u(e, i, r);
						a = _(t) ? t : "";
					} else if (r && Object.prototype.hasOwnProperty.call(r, f)) a = "";
					else if (d) {
						this.logger.debug && this.logger.once(`${s}\u0000${i[0]}`, "warn", `missed to pass in variable ${f} for interpolating ${s}`), a = i[0];
						continue;
					} else this.logger.warn(`missed to pass in variable ${f} for interpolating ${e}`), a = "";
				} else !_(a) && !this.useRawValueToEscape && (a = y(a));
				let h = y(t.safeValue(a));
				if (e = e.slice(0, i.index) + h + e.slice(i.index + i[0].length), d ? (t.regex === this.regexpUnescape ? p.push([i.index, i.index + h.length]) : m += h.length - i[0].length, t.regex.lastIndex += h.length, t.regex.lastIndex -= i[0].length) : t.regex.lastIndex = 0, o++, o >= this.maxReplaces) break;
			}
		}), e;
	}
	nest(e, t, n = {}) {
		let r, i, a, o = (e, t) => {
			let n = this.nestingOptionsSeparator;
			if (!e.includes(n)) return e;
			let r = e.split(RegExp(`${ie(n)}[ ]*{`)), i = `{${r[1]}`;
			e = r[0], i = this.interpolate(i, a);
			let o = i.match(/'/g), s = i.match(/"/g);
			((o?.length ?? 0) % 2 == 0 && !s || (s?.length ?? 0) % 2 != 0) && (i = i.replace(/'/g, "\""));
			try {
				a = JSON.parse(i), t && (a = {
					...t,
					...a
				});
			} catch (t) {
				return this.logger.warn(`failed parsing options string in nesting for key ${e}`, t), `${e}${n}${i}`;
			}
			return a.defaultValue && a.defaultValue.includes(this.prefix) && delete a.defaultValue, e;
		}, s = new RegExp(this.nestingRegexp), c = "", l = 0;
		for (; r = s.exec(e);) {
			let u = [];
			a = { ...n }, a = a.replace && !_(a.replace) ? a.replace : a, a.applyPostProcessor = !1, delete a.defaultValue;
			let d = /{.*}/s.test(r[1]) ? r[1].lastIndexOf("}") + 1 : r[1].indexOf(this.formatSeparator);
			if (d !== -1 && (u = r[1].slice(d).split(this.formatSeparator).map((e) => e.trim()).filter(Boolean), r[1] = r[1].slice(0, d)), i = t(o.call(this, r[1].trim(), a), a), i && r[0] === e && !_(i)) return i;
			_(i) || (i = y(i)), i ||= (this.logger.warn(`missed to resolve ${r[1]} for nesting ${e}`), ""), u.length && (i = u.reduce((e, t) => this.format(e, t, n.lng, {
				...n,
				interpolationkey: r[1].trim()
			}), i.trim())), c += e.slice(l, r.index) + y(i), l = s.lastIndex, this.regexp.lastIndex = 0;
		}
		return l ? c + e.slice(l) : e;
	}
}, De = (e) => {
	let t = e.toLowerCase().trim(), n = {};
	if (e.includes("(")) {
		let r = e.split("(");
		t = r[0].toLowerCase().trim();
		let i = r[1].slice(0, -1);
		t === "currency" && !i.includes(":") ? n.currency ||= i.trim() : t === "relativetime" && !i.includes(":") ? n.range ||= i.trim() : i.split(";").forEach((e) => {
			if (e) {
				let [t, ...r] = e.split(":"), i = r.join(":").trim().replace(/^'+|'+$/g, ""), a = t.trim();
				n[a] || (n[a] = i), i === "false" && (n[a] = !1), i === "true" && (n[a] = !0), isNaN(i) || (n[a] = parseInt(i, 10));
			}
		});
	}
	return {
		formatName: t,
		formatOptions: n
	};
}, Oe = (e) => {
	let t = {};
	return (n, r, i) => {
		let a = i;
		i && i.interpolationkey && i.formatParams && i.formatParams[i.interpolationkey] && i[i.interpolationkey] && (a = {
			...a,
			[i.interpolationkey]: void 0
		});
		let o;
		try {
			o = r + JSON.stringify(a);
		} catch {
			return e(de(r), i)(n);
		}
		let s = t[o];
		return s || (s = e(de(r), i), t[o] = s), s(n);
	};
}, ke = (e) => (t, n, r) => e(de(n), r)(t), Ae = class {
	constructor(e = {}) {
		this.logger = pe.create("formatter"), this.options = e, this.init(e);
	}
	init(e, t = { interpolation: {} }) {
		this.formatSeparator = t.interpolation.formatSeparator || ",";
		let n = t.cacheInBuiltFormats ? Oe : ke;
		this.formats = {
			number: n((e, t) => {
				let n = new Intl.NumberFormat(e, { ...t });
				return (e) => n.format(e);
			}),
			currency: n((e, t) => {
				let n = new Intl.NumberFormat(e, {
					...t,
					style: "currency"
				});
				return (e) => n.format(e);
			}),
			datetime: n((e, t) => {
				let n = new Intl.DateTimeFormat(e, { ...t });
				return (e) => n.format(e);
			}),
			relativetime: n((e, t) => {
				let n = new Intl.RelativeTimeFormat(e, { ...t });
				return (e) => n.format(e, t.range || "day");
			}),
			list: n((e, t) => {
				let n = new Intl.ListFormat(e, { ...t });
				return (e) => n.format(e);
			})
		};
	}
	add(e, t) {
		this.formats[e.toLowerCase().trim()] = t;
	}
	addCached(e, t) {
		this.formats[e.toLowerCase().trim()] = Oe(t);
	}
	format(e, t, n, r = {}) {
		if (!t || e == null) return e;
		let i = t.split(this.formatSeparator), a = [];
		for (let e = 0; e < i.length; e++) {
			let t = i[e];
			for (; t.indexOf("(") > -1 && !t.includes(")") && e + 1 < i.length;) t = `${t}${this.formatSeparator}${i[++e]}`;
			a.push(t);
		}
		return a.reduce((e, t) => {
			let { formatName: i, formatOptions: a } = De(t);
			if (this.formats[i]) {
				let t = e;
				try {
					let o = r?.formatParams?.[r.interpolationkey] || {}, s = o.locale || o.lng || r.locale || r.lng || n;
					t = this.formats[i](e, s, {
						...a,
						...r,
						...o
					});
				} catch (e) {
					this.logger.warn(e);
				}
				return t;
			}
			return this.logger.warn(`there was no format function for ${i}`), e;
		}, e);
	}
}, je = (e, t) => {
	e.pending[t] !== void 0 && (delete e.pending[t], e.pendingCount--);
}, Me = class extends me {
	constructor(e, t, n, r = {}) {
		super(), this.backend = e, this.store = t, this.services = n, this.languageUtils = n.languageUtils, this.options = r, this.logger = pe.create("backendConnector"), this.waitingReads = [], this.maxParallelReads = r.maxParallelReads || 10, this.readingCalls = 0, this.maxRetries = r.maxRetries >= 0 ? r.maxRetries : 5, this.retryTimeout = r.retryTimeout >= 1 ? r.retryTimeout : 350, this.state = {}, this.queue = [], this.backend?.init?.(n, r.backend, r), this.callbackApi = x(this.backend), this.backend && this.callbackApi === void 0 && (this.backend.read || this.backend.create) && this.logger.deprecate("backend: set callbackApi to declare the calling convention (true: read(language, namespace, callback) and create(languages, namespace, key, fallbackValue, callback, options); false: both return a promise or a value); guessing it from the number of parameters is deprecated");
	}
	queueLoad(e, t, n, r) {
		let i = {}, a = {}, o = {}, s = {};
		return e.forEach((e) => {
			let r = !0;
			t.forEach((t) => {
				let o = `${e}|${t}`;
				!n.reload && this.store.hasResourceBundle(e, t) ? this.state[o] = 2 : !n.reload && this.state[o] < 0 || (this.state[o] === 1 ? a[o] === void 0 && (a[o] = !0) : (this.state[o] = 1, r = !1, a[o] === void 0 && (a[o] = !0), i[o] === void 0 && (i[o] = !0), s[t] === void 0 && (s[t] = !0)));
			}), r || (o[e] = !0);
		}), (Object.keys(i).length || Object.keys(a).length) && this.queue.push({
			pending: a,
			pendingCount: Object.keys(a).length,
			loaded: {},
			errors: [],
			callback: r
		}), {
			toLoad: Object.keys(i),
			pending: Object.keys(a),
			toLoadLanguages: Object.keys(o),
			toLoadNamespaces: Object.keys(s)
		};
	}
	loaded(e, t, n) {
		let r = e.split("|"), i = r[0], a = r[1];
		t && this.emit("failedLoading", i, a, t), !t && n && this.store.addResourceBundle(i, a, n, void 0, void 0, { skipCopy: !0 }), this.state[e] = t ? -1 : 2, t && n && (this.state[e] = 0);
		let o = {};
		this.queue.forEach((n) => {
			ee(n.loaded, [i], a), je(n, e), t && n.errors.push(t), n.pendingCount === 0 && !n.done && (Object.keys(n.loaded).forEach((e) => {
				o[e] || (o[e] = {});
				let t = n.loaded[e];
				t.length && t.forEach((t) => {
					o[e][t] === void 0 && (o[e][t] = !0);
				});
			}), n.done = !0, n.errors.length ? n.callback(n.errors) : n.callback());
		}), this.emit("loaded", o), this.queue = this.queue.filter((e) => !e.done);
	}
	read(e, t, n, r = 0, i = this.retryTimeout, a) {
		if (!e.length) return a(null, {});
		if (this.readingCalls >= this.maxParallelReads) {
			this.waitingReads.push({
				lng: e,
				ns: t,
				fcName: n,
				tried: r,
				wait: i,
				callback: a
			});
			return;
		}
		this.readingCalls++;
		let o = (o, s) => {
			if (this.readingCalls--, this.waitingReads.length > 0) {
				let e = this.waitingReads.shift();
				this.read(e.lng, e.ns, e.fcName, e.tried, e.wait, e.callback);
			}
			o && s && r < this.maxRetries ? setTimeout(() => {
				this.read(e, t, n, r + 1, i * 2, a);
			}, i) : a(o, s);
		}, s = this.backend[n].bind(this.backend);
		if (this.callbackApi === !1 || this.callbackApi === void 0 && s.length === 2) try {
			let n = s(e, t);
			n && typeof n.then == "function" ? n.then((e) => o(null, e)).catch(o) : o(null, n);
		} catch (e) {
			o(e);
		}
		else return s(e, t, o);
	}
	prepareLoading(e, t, n = {}, r) {
		if (!this.backend) return this.logger.warn("No backend was added via i18next.use. Will not load resources."), r && r();
		_(e) && (e = this.languageUtils.toResolveHierarchy(e)), _(t) && (t = [t]);
		let i = this.queueLoad(e, t, n, r);
		if (!i.toLoad.length) return i.pending.length || r(), null;
		i.toLoad.forEach((e) => {
			this.loadOne(e);
		});
	}
	load(e, t, n) {
		this.prepareLoading(e, t, {}, n);
	}
	reload(e, t, n) {
		this.prepareLoading(e, t, { reload: !0 }, n);
	}
	noticeDevFallback(e) {
		e === "dev" && this.devIsDefaultFallback && this.logger.once("dev", "warn", "language 'dev' is requested because fallbackLng is not set (its default is ['dev']); i18next v27 defaults to fallbackLng: false and loads and saves missing keys in the requested language instead. Set fallbackLng to your source language, or to 'dev' to keep this behavior");
	}
	loadOne(e, t = "") {
		let n = e.split("|"), r = n[0], i = n[1];
		this.noticeDevFallback(r), this.read(r, i, "read", void 0, void 0, (n, a) => {
			n && this.logger.warn(`${t}loading namespace ${i} for language ${r} failed`, n), !n && a && this.logger.log(`${t}loaded namespace ${i} for language ${r}`, a), this.loaded(e, n, a);
		});
	}
	saveMissing(e, t, n, r, i, a = {}, o = () => {}, s = this.newestCloneHasLoadedNamespace || this.services?.utils?.hasLoadedNamespace) {
		if (s && !s(t)) this.logger.warn(`did not save key "${n}" as the namespace "${t}" was not yet loaded`, "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
		else if (n != null && n !== "") {
			if (this.backend?.create) {
				e?.forEach?.((e) => this.noticeDevFallback(e));
				let s = {
					...a,
					isUpdate: i
				}, c = this.backend.create.bind(this.backend);
				if (this.callbackApi === !1 || this.callbackApi === void 0 && c.length < 6) try {
					let i;
					i = this.callbackApi === !1 || c.length === 5 ? c(e, t, n, r, s) : c(e, t, n, r), i && typeof i.then == "function" ? i.then((e) => o(null, e)).catch(o) : o(null, i);
				} catch (e) {
					o(e);
				}
				else c(e, t, n, r, o, s);
			}
			e && e[0] && this.store.addResource(e[0], t, n, r);
		}
	}
}, Ne = () => ({
	debug: !1,
	initAsync: !0,
	ns: ["translation"],
	defaultNS: ["translation"],
	fallbackLng: ["dev"],
	fallbackNS: !1,
	supportedLngs: !1,
	nonExplicitSupportedLngs: !1,
	load: "all",
	preload: !1,
	keySeparator: ".",
	nsSeparator: ":",
	pluralSeparator: "_",
	contextSeparator: "_",
	enableSelector: !1,
	partialBundledLanguages: !1,
	saveMissing: !1,
	updateMissing: !1,
	saveMissingTo: "fallback",
	saveMissingPlurals: !0,
	missingKeyHandler: !1,
	missingInterpolationHandler: !1,
	postProcess: !1,
	postProcessPassResolved: !1,
	returnNull: !1,
	returnEmptyString: !0,
	returnObjects: !1,
	joinArrays: !1,
	returnedObjectHandler: !1,
	parseMissingKeyHandler: !1,
	appendNamespaceToMissingKey: !1,
	appendNamespaceToCIMode: !1,
	overloadTranslationOptionHandler: (e) => {
		let t = {};
		if (typeof e[1] == "object" && (t = e[1]), _(e[1]) && (t.defaultValue = e[1]), _(e[2]) && (t.tDescription = e[2]), typeof e[2] == "object" || typeof e[3] == "object") {
			let n = e[3] || e[2];
			Object.keys(n).forEach((e) => {
				t[e] = n[e];
			});
		}
		return t;
	},
	interpolation: {
		escapeValue: !0,
		prefix: "{{",
		suffix: "}}",
		formatSeparator: ",",
		unescapePrefix: "-",
		nestingPrefix: "$t(",
		nestingSuffix: ")",
		nestingOptionsSeparator: ",",
		maxReplaces: 1e3,
		skipOnVariables: !0
	},
	cacheInBuiltFormats: !0
}), Pe = (e) => (_(e.ns) && (e.ns = [e.ns]), _(e.fallbackLng) && (e.fallbackLng = [e.fallbackLng]), _(e.fallbackNS) && (e.fallbackNS = [e.fallbackNS]), e.supportedLngs && !e.supportedLngs.includes("cimode") && (e.supportedLngs = e.supportedLngs.concat(["cimode"])), e), Fe = () => {}, Ie, Le = (e) => {
	Object.getOwnPropertyNames(Object.getPrototypeOf(e)).forEach((t) => {
		typeof e[t] == "function" && (e[t] = e[t].bind(e));
	});
}, Re = class e extends me {
	constructor(e = {}, t) {
		if (super(), this.options = Pe(e), this.services = { ownPostProcessors: /* @__PURE__ */ new Set() }, this.logger = pe, this.modules = { external: [] }, Le(this), t && !this.isInitialized && !e.isClone) {
			if (!this.options.initAsync) return this.init(e, t), this;
			setTimeout(() => {
				this.init(e, t);
			}, 0);
		}
	}
	init(e = {}, t) {
		this.isInitializing = !0, typeof e == "function" && (t = e, e = {}), e.defaultNS == null && e.ns && (_(e.ns) ? e.defaultNS = e.ns : e.ns.includes("translation") || (e.defaultNS = e.ns[0]));
		let n = e.fallbackLng === void 0 && this.options.fallbackLng === void 0, r = Ne();
		this.options = {
			...r,
			...this.options,
			...Pe(e)
		}, this.options.interpolation = {
			...r.interpolation,
			...this.options.interpolation
		}, e.keySeparator !== void 0 && (this.options.userDefinedKeySeparator = e.keySeparator), e.nsSeparator !== void 0 && (this.options.userDefinedNsSeparator = e.nsSeparator), typeof this.options.overloadTranslationOptionHandler != "function" && (this.options.overloadTranslationOptionHandler = r.overloadTranslationOptionHandler);
		let i = (e) => e ? typeof e == "function" ? new e() : e : null;
		if (!this.options.isClone) {
			Ie && Ie !== this && Ie.modules.logger !== this.modules.logger && pe.deprecate("init: this init() replaces the logger another i18next instance set with use(), as the logger is shared in v26; from v27 each instance keeps its own logger"), Ie = this.modules.logger ? this : void 0, this.modules.logger ? pe.init(i(this.modules.logger), this.options) : pe.init(null, this.options), this.pendingWarnings?.forEach((e) => this.logger.warn(e)), this.pendingWarnings = void 0;
			let e;
			e = this.modules.formatter ? this.modules.formatter : Ae;
			let t = new A(this.options);
			this.store = new ge(this.options.resources, this.options);
			let r = this.services;
			r.logger = pe, r.resourceStore = this.store, r.languageUtils = t, r.pluralResolver = new we(t, { prepend: this.options.pluralSeparator }), e && (r.formatter = i(e), r.formatter.init && r.formatter.init(r, this.options), this.options.interpolation.format = r.formatter.format.bind(r.formatter)), r.interpolator = new Ee(this.options), r.utils = {
				hasLoadedNamespace: this.hasLoadedNamespace.bind(this),
				reloadResources: this.reloadResources.bind(this)
			}, r.backendConnector = new Me(i(this.modules.backend), r.resourceStore, r, this.options), r.backendConnector.devIsDefaultFallback = n, r.backendConnector.on("*", (e, ...t) => {
				this.emit(e, ...t);
			}), this.modules.languageDetector && (r.languageDetector = i(this.modules.languageDetector), r.languageDetector.init && r.languageDetector.init(r, this.options.detection, this.options), r.languageDetector.async && x(r.languageDetector) === void 0 && this.logger.deprecate("languageDetector: set callbackApi to declare how the async detect() answers (true: detect(callback); false: detect() returns a promise); guessing it from the number of parameters is deprecated")), this.modules.i18nFormat && (r.i18nFormat = i(this.modules.i18nFormat), r.i18nFormat.init && r.i18nFormat.init(this)), this.translator = new k(this.services, this.options), this.translator.on("*", (e, ...t) => {
				this.emit(e, ...t);
			}), this.modules.external.forEach((e) => {
				e.init && e.init(this);
			});
		}
		if (this.format = this.options.interpolation.format, t ||= Fe, this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
			let e = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
			e.length > 0 && e[0] !== "dev" && (this.options.lng = e[0]);
		}
		!this.services.languageDetector && !this.options.lng && this.logger.warn("init: no languageDetector is used and no lng is defined"), [
			"getResource",
			"hasResourceBundle",
			"getResourceBundle",
			"getDataByLanguage"
		].forEach((e) => {
			this[e] = (...t) => this.store[e](...t);
		}), [
			"addResource",
			"addResources",
			"addResourceBundle",
			"removeResourceBundle"
		].forEach((e) => {
			this[e] = (...t) => (this.store[e](...t), this);
		});
		let a = v(), o = () => {
			let e = (e, n) => {
				this.isInitializing = !1, this.isInitialized && !this.initializedStoreOnce && this.logger.warn("init: i18next is already initialized. You should call init just once!"), this.isInitialized = !0, this.options.isClone || this.logger.log("initialized", this.options), this.emit("initialized", this.options), a.resolve(n), t(e, n);
			};
			if ((this.languages || this.isLanguageChangingTo) && !this.isInitialized) return e(null, this.t.bind(this));
			this.changeLanguage(this.options.lng, e);
		};
		return this.options.resources || !this.options.initAsync ? o() : setTimeout(o, 0), a;
	}
	loadResources(e, t = Fe) {
		let n = t, r = _(e) ? e : this.language;
		if (typeof e == "function" && (n = e), !this.options.resources || this.options.partialBundledLanguages) {
			if (r?.toLowerCase() === "cimode" && (!this.options.preload || this.options.preload.length === 0)) return n();
			let e = [], t = (t) => {
				t && t !== "cimode" && this.services.languageUtils.toResolveHierarchy(t).forEach((t) => {
					t !== "cimode" && (e.includes(t) || e.push(t));
				});
			};
			r ? t(r) : this.services.languageUtils.getFallbackCodes(this.options.fallbackLng).forEach((e) => t(e)), this.options.preload?.forEach?.((e) => t(e)), this.services.backendConnector.load(e, this.options.ns, (e) => {
				!e && !this.resolvedLanguage && this.language && this.setResolvedLanguage(this.language), n(e);
			});
		} else n(null);
	}
	reloadResources(e, t, n) {
		let r = v();
		if (typeof e == "function" && (n = e, e = void 0), typeof t == "function" && (n = t, t = void 0), !e) {
			let t = Object.keys(this.services.backendConnector.state).map((e) => e.split("|")[0]);
			e = [.../* @__PURE__ */ new Set([...this.languages || [], ...t])].filter((e) => e !== "cimode");
		}
		return t ||= this.options.ns, n ||= Fe, this.services.backendConnector.reload(e, t, (e) => {
			r.resolve(), n(e);
		}), r;
	}
	use(e) {
		if (!e) throw Error("You are passing an undefined module! Please check the object you are passing to i18next.use()");
		if (!e.type) throw Error("You are passing a wrong module! Please check the object you are passing to i18next.use()");
		let t = (t) => {
			if (this.modules[t] && this.modules[t] !== e) {
				let e = `use: this ${t} replaces the ${t} passed to an earlier use() call; only one ${t} is used per instance`;
				this.isInitializing || this.isInitialized ? this.logger.warn(e) : (this.pendingWarnings = this.pendingWarnings || []).push(e);
			}
			this.modules[t] = e;
		};
		return e.type === "backend" && t("backend"), (e.type === "logger" || e.log && e.warn && e.error) && (this.modules.logger = e), e.type === "languageDetector" && t("languageDetector"), e.type === "i18nFormat" && t("i18nFormat"), e.type === "postProcessor" && (_e.addPostProcessor(e), this.services.ownPostProcessors?.add(e.name)), e.type === "formatter" && t("formatter"), e.type === "3rdParty" && this.modules.external.push(e), this;
	}
	hydrate(e, t) {
		return this.options.isClone ? this : this.services.resourceStore ? (e && !this.initializedStoreOnce && (this.services.resourceStore.data = e, Object.values(e).forEach((e) => {
			Object.keys(e).forEach((e) => {
				this.options.ns.includes(e) || this.options.ns.push(e);
			});
		}), this.initializedStoreOnce = !0, this.isInitialized = !0), t && !this.initializedLanguageOnce && (this.changeLanguage(t), this.initializedLanguageOnce = !0), this) : (this.logger.warn("hydrate: call init() first, the instance has no resource store yet"), this);
	}
	setResolvedLanguage(e) {
		if (e && this.languages && !["cimode", "dev"].includes(e)) {
			for (let e = 0; e < this.languages.length; e++) {
				let t = this.languages[e];
				if (!["cimode", "dev"].includes(t) && this.store.hasLanguageSomeTranslations(t)) {
					this.resolvedLanguage = t;
					break;
				}
			}
			!this.resolvedLanguage && !this.languages.includes(e) && this.store.hasLanguageSomeTranslations(e) && (this.resolvedLanguage = e, this.languages.unshift(e));
		}
	}
	changeLanguage(e, t) {
		this.isLanguageChangingTo = e;
		let n = v();
		this.emit("languageChanging", e);
		let r = (e) => {
			this.language = e, this.languages = this.services.languageUtils.toResolveHierarchy(e), this.resolvedLanguage = void 0, this.setResolvedLanguage(e);
		}, i = (i, a) => {
			a ? this.isLanguageChangingTo === e && (r(a), this.translator.changeLanguage(a), this.isLanguageChangingTo = void 0, this.emit("languageChanged", a), this.logger.log("languageChanged", a)) : this.isLanguageChangingTo = void 0, n.resolve((...e) => this.t(...e)), t && t(i, (...e) => this.t(...e));
		}, a = (t) => {
			!e && !t && this.services.languageDetector && (t = []);
			let n = _(t) ? t : t && t[0], a = this.store.hasLanguageSomeTranslations(n) ? n : this.services.languageUtils.getBestMatchFromCodes(_(t) ? [t] : t);
			a && this.logger.debug && !b(a) && ![].concat(this.options.supportedLngs || [], this.services.languageUtils.getFallbackCodes(this.options.fallbackLng, a), this.options.preload || []).includes(a) && !Object.prototype.hasOwnProperty.call(this.store.data, a) && this.logger.once(`lng:${a}`, "deprecate", `changeLanguage: the language code '${a.slice(0, 64)}' comes from lng, changeLanguage() or the language detector and is not configured; from v27 such a code is refused unless it has only letters, digits, '-', '_', '@' and '.' (no '..'), at most 128 characters. Set supportedLngs, or check the code before passing it on`), a && (this.language || r(a), this.translator.language || this.translator.changeLanguage(a), this.services.languageDetector?.cacheUserLanguage?.(a)), this.loadResources(a, (e) => {
				i(e, a);
			});
		};
		if (!e && this.services.languageDetector && !this.services.languageDetector.async) a(this.services.languageDetector.detect());
		else if (!e && this.services.languageDetector && this.services.languageDetector.async) {
			let e = x(this.services.languageDetector);
			e === !1 || e === void 0 && this.services.languageDetector.detect.length === 0 ? this.services.languageDetector.detect().then(a) : this.services.languageDetector.detect(a);
		} else a(e);
		return n;
	}
	getFixedT(e, t, n, r) {
		let i = r?.scopeNs, a = (e, t, ...r) => {
			let o;
			o = typeof t == "object" ? { ...t } : this.options.overloadTranslationOptionHandler([e, t].concat(r)), o.lng = o.lng || a.lng, o.lngs = o.lngs || a.lngs;
			let s = o.ns !== void 0 && o.ns !== null;
			o.ns = o.ns || a.ns, o.keyPrefix !== "" && (o.keyPrefix = o.keyPrefix || n || a.keyPrefix);
			let c = {
				...this.options,
				...o
			};
			Array.isArray(i) && !s && (c.ns = i), typeof o.keyPrefix == "function" && (o.keyPrefix = be(o.keyPrefix, c));
			let l = this.options.keySeparator || ".", u;
			return o.keyPrefix && Array.isArray(e) ? u = e.map((e) => (typeof e == "function" && (e = be(e, c)), `${o.keyPrefix}${l}${e}`)) : (typeof e == "function" && (e = be(e, c)), u = o.keyPrefix ? `${o.keyPrefix}${l}${e}` : e), this.t(u, o);
		};
		return _(e) ? a.lng = e : a.lngs = e, a.ns = t, a.keyPrefix = n, a;
	}
	t(...e) {
		return this.translator ? this.translator.translate(...e) : (this.logger.warn("t: called before init(); returning an empty string"), "");
	}
	exists(...e) {
		return this.translator?.exists(...e);
	}
	setDefaultNamespace(e) {
		this.options.defaultNS = e;
	}
	hasLoadedNamespace(e, t = {}) {
		if (!this.isInitialized) return this.logger.warn("hasLoadedNamespace: i18next was not initialized", this.languages), !1;
		if (!this.languages || !this.languages.length) return this.logger.warn("hasLoadedNamespace: i18n.languages were undefined or empty", this.languages), !1;
		let n = t.lng || this.resolvedLanguage || this.languages[0], r = this.options ? this.options.fallbackLng : !1, i = this.languages[this.languages.length - 1];
		if (n.toLowerCase() === "cimode") return !0;
		let a = (e, t) => {
			let n = this.services.backendConnector.state[`${e}|${t}`];
			return n === -1 || n === 0 || n === 2;
		};
		if (t.precheck) {
			let e = t.precheck(this, a);
			if (e !== void 0) return e;
		}
		if (this.hasResourceBundle(n, e) || !this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages) return !0;
		let { languageUtils: o } = this.services, s = t.lng ? o.isSupportedCode(n) && o.toResolveHierarchy(n, !1)[0] : n;
		return !(s && !a(s, e) || r && !a(i, e));
	}
	loadNamespaces(e, t) {
		let n = v();
		return this.options.ns ? (_(e) && (e = [e]), e.forEach((e) => {
			this.options.ns.includes(e) || this.options.ns.push(e);
		}), this.loadResources((e) => {
			n.resolve(), t && t(e);
		}), n) : (t && t(), Promise.resolve());
	}
	loadLanguages(e, t) {
		let n = v();
		_(e) && (e = [e]);
		let r = this.options.preload || [], i = e.filter((e) => !r.includes(e) && this.services.languageUtils.isSupportedCode(e));
		return i.length ? (this.options.preload = r.concat(i), this.loadResources((e) => {
			n.resolve(), t && t(e);
		}), n) : (t && t(), Promise.resolve());
	}
	dir(e) {
		if (e ||= this.resolvedLanguage || (this.languages?.length > 0 ? this.languages[0] : this.language), !e) return "ltr";
		try {
			let t = new Intl.Locale(e);
			if (t && t.getTextInfo) {
				let e = t.getTextInfo();
				if (e && e.direction) return e.direction;
			}
		} catch {}
		let t = /* @__PURE__ */ "ar.shu.sqr.ssh.xaa.yhd.yud.aao.abh.abv.acm.acq.acw.acx.acy.adf.ads.aeb.aec.afb.ajp.apc.apd.arb.arq.ars.ary.arz.auz.avl.ayh.ayl.ayn.ayp.bbz.pga.he.iw.ps.pbt.pbu.pst.prp.prd.ug.ur.ydd.yds.yih.ji.yi.hbo.men.xmn.fa.jpr.peo.pes.prs.dv.sam.ckb".split("."), n = this.services?.languageUtils || new A(Ne());
		return e.toLowerCase().indexOf("-latn") > 1 ? "ltr" : t.includes(n.getLanguagePartFromCode(e)) || e.toLowerCase().indexOf("-arab") > 1 ? "rtl" : "ltr";
	}
	static createInstance(t = {}, n) {
		let r = new e(t, n);
		return r.createInstance = e.createInstance, r;
	}
	cloneInstance(t = {}, n = Fe) {
		let r = t.forkResourceStore;
		r && (t = { ...t }, delete t.forkResourceStore);
		let i = {
			...this.options,
			preload: !1,
			...t,
			isClone: !0
		}, a = new e(i);
		if ((t.debug !== void 0 || t.prefix !== void 0) && (a.logger = a.logger.clone(t)), [
			"store",
			"services",
			"language"
		].forEach((e) => {
			a[e] = this[e];
		}), a.services = { ...this.services }, a.services.utils = {
			...a.services.utils,
			hasLoadedNamespace: a.hasLoadedNamespace.bind(a),
			reloadResources: a.reloadResources.bind(a)
		}, r) {
			let e = (t) => {
				let n = Array.isArray(t) ? [...t] : { ...t };
				return Object.keys(n).forEach((t) => {
					n[t] && typeof n[t] == "object" && (n[t] = e(n[t]));
				}), n;
			};
			a.store = new ge(e(this.store.data), i), a.services.resourceStore = a.store;
		}
		if (t.interpolation) {
			let e = {
				...Ne().interpolation,
				...this.options.interpolation,
				...t.interpolation
			}, n = {
				...i,
				interpolation: e
			};
			a.services.interpolator = new Ee(n);
		}
		return a.translator = new k(a.services, i), a.translator.on("*", (e, ...t) => {
			a.emit(e, ...t);
		}), a.init(i, n), a.translator.options = i, a.translator.backendConnector.newestCloneHasLoadedNamespace = a.hasLoadedNamespace.bind(a), a;
	}
	toJSON() {
		return {
			options: this.options,
			store: this.store,
			language: this.language,
			languages: this.languages,
			resolvedLanguage: this.resolvedLanguage
		};
	}
}.createInstance(), ze = Re.createInstance;
Re.dir, Re.init, Re.loadResources, Re.reloadResources, Re.use, Re.changeLanguage, Re.getFixedT, Re.t, Re.exists, Re.setDefaultNamespace, Re.hasLoadedNamespace, Re.loadNamespaces, Re.loadLanguages;
// node_modules/.pnpm/html-parse-stringify@4.0.1/node_modules/html-parse-stringify/dist/esm/html-parse-stringify.js
var Be = {
	area: !0,
	base: !0,
	br: !0,
	col: !0,
	embed: !0,
	hr: !0,
	img: !0,
	input: !0,
	link: !0,
	meta: !0,
	param: !0,
	source: !0,
	track: !0,
	wbr: !0,
	"!doctype": !0,
	"!DOCTYPE": !0
}, Ve = /\s([^'"/\s><]+?)[\s/>]|([^\s=]+)=\s?("[^"]*"|'[^']*')/g;
function He(e) {
	let t = {
		type: "tag",
		name: "",
		voidElement: !1,
		attrs: {},
		children: []
	}, n = e.match(/<\/?([^\s]+?)[/\s>]/);
	if (n && (t.name = n[1], (Be[n[1]] || e.charAt(e.length - 2) === "/") && (t.voidElement = !0), t.name.startsWith("!--"))) {
		let t = e.indexOf("-->");
		return {
			type: "comment",
			comment: t === -1 ? "" : e.slice(4, t)
		};
	}
	let r = new RegExp(Ve), i = null;
	for (; i = r.exec(e), i !== null;) if (i[0].trim()) {
		if (i[1]) {
			let e = i[1].trim(), n = [e, null], a = e.indexOf("=");
			a > -1 && (n = [e.slice(0, a), e.slice(a + 1)]), t.attrs[n[0]] = n[1], r.lastIndex--;
		} else i[2] && (t.attrs[i[2]] = i[3].trim().substring(1, i[3].length - 1));
	}
	return t;
}
var Ue = /<!--[\s\S]*?-->|<[a-zA-Z0-9\-!/](?:"[^"]*"|'[^']*'|[^'">])*>/g, We = /<\/?([^\s]+?)[/\s>]/, Ge = /^\s*$/, Ke = /^(script|style)$/i, qe = "\0", Je = Object.create(null);
function Ye(e) {
	e.forEach(function(e) {
		if (e.type === "text") e.content = e.content.split(qe).join("<");
		else if (e.type === "comment") e.comment = e.comment.split(qe).join("<");
		else {
			for (let t in e.attrs) {
				let n = e.attrs[t];
				typeof n == "string" && n.indexOf(qe) > -1 && (e.attrs[t] = n.split(qe).join("<"));
			}
			e.children.length && Ye(e.children);
		}
	});
}
function Xe(e, t) {
	let n = t && t.components || Je, r = t && t.allowedTags, i = !1;
	if (r) {
		let t = typeof r == "function" ? r : function(e) {
			return r.indexOf(e) > -1;
		}, n = "", a = 0;
		Ue.lastIndex = 0;
		let o;
		for (; o = Ue.exec(e);) {
			let r = o[0];
			n += e.slice(a, o.index);
			let s = r.match(We);
			r.startsWith("<!--") || s && t(s[1]) ? (n += r, a = o.index + r.length) : (i = !0, n += qe, a = o.index + 1, Ue.lastIndex = a);
		}
		e = n + e.slice(a);
	}
	let a = [], o = [], s, c = -1, l = !1, u = 0, d;
	if (e.indexOf("<") !== 0) {
		let t = e.indexOf("<");
		a.push({
			type: "text",
			content: t === -1 ? e : e.substring(0, t)
		});
	}
	let f = [], p;
	for (; p = Ue.exec(e);) f.push(p);
	return f.forEach(function(e, t) {
		let n = e[0];
		if (!n || n.startsWith("<!--")) return;
		let r = 0, i = 0, a = -1, o = null;
		for (let e = 0; e < n.length; e++) {
			let t = n.charAt(e);
			o ? t === o && (o = null) : t === "\"" || t === "'" ? o = t : t === "<" ? (r++, r === 2 && (a = e)) : t === ">" && i++;
		}
		let s = a > -1 && /[a-zA-Z0-9\-!/]/.test(n.charAt(a + 1));
		if (r > i && s) {
			let e = n.substring(0, a), r = n.substring(e.length);
			f[t][0] = r, f[t].index += e.length;
		}
	}), f.forEach(function(t, r) {
		let i = t[0];
		if (!i) return;
		let p = t.index;
		if (p < u) return;
		if (l) {
			if (i !== "</" + s.name + ">") return;
			l = !1;
		}
		let m = i.charAt(1) !== "/", h = i.startsWith("<!--"), g = p + i.length, _ = e.charAt(g), v = f[r + 1], y;
		if (_ === "<" && v) {
			let t = e.substring(g, v.index);
			y = t.split("<").length > t.split(">").length;
		}
		let b;
		if (h) {
			let t = He(i);
			if (c < 0) return a.push(t), a;
			b = o[c], b.children.push(t);
			let n = e.slice(g, v ? v.index : void 0);
			return n.length > 0 && b.children.push({
				type: "text",
				content: n
			}), a;
		}
		if (m) {
			c++, s = He(i), s.type === "tag" && n[s.name] && (s.type = "component", l = !0);
			let t = !1;
			if (!l && !s.voidElement && Ke.test(s.name)) {
				t = !0, d ||= e.toLowerCase();
				let n = d.indexOf("</" + s.name.toLowerCase() + ">", g), r = n === -1 ? e.length : n, i = e.slice(g, r);
				i && s.children.push({
					type: "text",
					content: i
				}), u = r;
			}
			!s.voidElement && !l && !t && _ && _ !== "<" && s.children.push({
				type: "text",
				content: e.slice(g, v ? v.index : void 0)
			}), c === 0 && a.push(s), b = o[c - 1], b && b.children.push(s), o[c] = s;
		}
		if ((!m || s.voidElement) && (c > -1 && (s.voidElement || s.name === i.slice(2, -1)) && (c--, s = c === -1 ? a : o[c]), !l && (_ !== "<" || y) && _)) {
			b = c === -1 ? a : o[c].children;
			let t = v ? v.index : -1, n = e.slice(g, t === -1 ? void 0 : t);
			Ge.test(n) && (n = " "), (t > -1 && c + b.length >= 0 || n !== " ") && b.push({
				type: "text",
				content: n
			});
		}
	}), i && Ye(a), a;
}
function Ze(e) {
	let t = [];
	for (let n in e) e[n] === null ? t.push(n) : t.push(n + "=\"" + String(e[n]).replace(/"/g, "&quot;") + "\"");
	return t.length ? " " + t.join(" ") : "";
}
function Qe(e, t) {
	switch (t.type) {
		case "text": return e + t.content;
		case "tag": {
			let n = t.voidElement && t.name.toLowerCase() !== "!doctype" ? "/>" : ">";
			return e += "<" + t.name + (t.attrs ? Ze(t.attrs) : "") + n, t.voidElement ? e : e + t.children.reduce(Qe, "") + "</" + t.name + ">";
		}
		case "comment": return e += "<!--" + t.comment + "-->", e;
	}
}
function $e(e) {
	return e.reduce(function(e, t) {
		return e + Qe("", t);
	}, "");
}
var et = {
	parse: Xe,
	stringify: $e
}, tt = (e, t, n, r) => {
	let i = [n, {
		code: t,
		...r || {}
	}];
	if (e?.services?.logger?.forward) return e.services.logger.forward(i, "warn", "react-i18next::", !0);
	ct(i[0]) && (i[0] = `react-i18next:: ${i[0]}`), e?.services?.logger?.warn ? e.services.logger.warn(...i) : console?.warn && console.warn(...i);
}, nt = {}, rt = (e, t, n, r) => {
	ct(n) && nt[n] || (ct(n) && (nt[n] = /* @__PURE__ */ new Date()), tt(e, t, n, r));
}, it = (e, t) => () => {
	if (e.isInitialized) t();
	else {
		let n = () => {
			setTimeout(() => {
				e.off("initialized", n);
			}, 0), t();
		};
		e.on("initialized", n);
	}
}, at = (e, t, n) => {
	e.loadNamespaces(t, it(e, n));
}, ot = (e, t, n, r) => {
	if (ct(n) && (n = [n]), e.options.preload && e.options.preload.indexOf(t) > -1) return at(e, n, r);
	n.forEach((t) => {
		e.options.ns.indexOf(t) < 0 && e.options.ns.push(t);
	}), e.loadLanguages(t, it(e, r));
}, st = (e, t, n = {}) => !t.languages || !t.languages.length ? (rt(t, "NO_LANGUAGES", "i18n.languages were undefined or empty", { languages: t.languages }), !0) : t.hasLoadedNamespace(e, {
	lng: n.lng,
	precheck: (t, r) => {
		if (n.bindI18n && n.bindI18n.indexOf("languageChanging") > -1 && t.services.backendConnector.backend && t.isLanguageChangingTo && !r(t.isLanguageChangingTo, e)) return !1;
	}
}), ct = (e) => typeof e == "string", lt = (e) => typeof e == "object" && !!e, ut = (e) => {
	let t = e?.services?.i18nFormat;
	return typeof t?.parse == "function" ? t : void 0;
}, dt = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
}, ft = (e) => {
	if (!e) return e;
	let t = {};
	return Object.keys(e).forEach((n) => {
		let r = e[n];
		t[n] = ct(r) ? r.replace(/[&<>"']/g, (e) => dt[e]) : r;
	}), t;
}, pt = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160|copy|#169|reg|#174|hellip|#8230|#x2F|#47);/g, mt = {
	"&amp;": "&",
	"&#38;": "&",
	"&lt;": "<",
	"&#60;": "<",
	"&gt;": ">",
	"&#62;": ">",
	"&apos;": "'",
	"&#39;": "'",
	"&quot;": "\"",
	"&#34;": "\"",
	"&nbsp;": "\xA0",
	"&#160;": "\xA0",
	"&copy;": "©",
	"&#169;": "©",
	"&reg;": "®",
	"&#174;": "®",
	"&hellip;": "…",
	"&#8230;": "…",
	"&#x2F;": "/",
	"&#47;": "/"
}, ht = (e) => mt[e], gt = (e) => e.replace(pt, ht), _t = {
	bindI18n: "languageChanged",
	bindI18nStore: "",
	transEmptyNodeValue: "",
	transSupportBasicHtmlNodes: !0,
	transWrapTextNodes: "",
	transKeepBasicHtmlNodesFor: [
		"br",
		"strong",
		"i",
		"p"
	],
	useSuspense: !0,
	unescape: gt,
	transDefaultProps: void 0
}, vt = () => _t, yt, bt = () => yt, j = /* @__PURE__ */ c(f()), xt = (e, t) => {
	if (!e) return !1;
	let n = e.props?.children ?? e.children;
	return t ? n.length > 0 : !!n;
}, St = (e) => {
	if (!e) return [];
	let t = e.props?.children ?? e.children;
	return e.props?.i18nIsDynamicList ? wt(t) : t;
}, Ct = (e) => wt(e).every(j.isValidElement), wt = (e) => Array.isArray(e) ? e : [e], Tt = (e, t) => {
	let n = { ...t };
	return n.props = {
		...t.props,
		...e.props
	}, n;
}, Et = (e) => {
	let t = {};
	if (!e) return t;
	let n = (e) => {
		wt(e).forEach((e) => {
			ct(e) || (xt(e) ? n(St(e)) : lt(e) && !(0, j.isValidElement)(e) && Object.assign(t, e));
		});
	};
	return n(e), t;
}, Dt = (e, t, n, r) => {
	if (!e) return "";
	let i = "", a = wt(e), o = t?.transSupportBasicHtmlNodes ? t.transKeepBasicHtmlNodesFor ?? [] : [];
	return a.forEach((e, a) => {
		if (ct(e)) i += `${e}`;
		else if ((0, j.isValidElement)(e)) {
			let { props: s, type: c } = e, l = Object.keys(s).length, u = o.indexOf(c) > -1, d = s.children;
			if (!d && u && !l) {
				i += `<${c}/>`;
				return;
			}
			if (!d && (!u || l) || s.i18nIsDynamicList) {
				i += `<${a}></${a}>`;
				return;
			}
			if (u && l <= 1) {
				let e = ct(d) ? d : Dt(d, t, n, r);
				i += `<${c}>${e}</${c}>`;
				return;
			}
			let f = Dt(d, t, n, r);
			i += `<${a}>${f}</${a}>`;
		} else if (e === null) tt(n, "TRANS_NULL_VALUE", "Passed in a null value as child", { i18nKey: r });
		else if (lt(e)) {
			let { format: t, ...a } = e, o = Object.keys(a);
			if (o.length === 1) {
				let e = t ? `${o[0]}, ${t}` : o[0];
				i += `{{${e}}}`;
				return;
			}
			if (!o.length && Object.keys(e).length === 1 && "format" in e) {
				i += "{{format}}";
				return;
			}
			tt(n, "TRANS_INVALID_OBJ", "Invalid child - Object should only have keys {{ value, format }} (format is optional).", {
				i18nKey: r,
				child: e
			});
		} else tt(n, "TRANS_INVALID_VAR", "Passed in a variable like {number} - pass variables for interpolation as full objects like {{number}}.", {
			i18nKey: r,
			child: e
		});
	}), i;
}, Ot = (e, t, n, r, i, a, o, s) => {
	if (n === "") return [];
	let c = i.transKeepBasicHtmlNodesFor || [], l = n && new RegExp(c.map((e) => `<${e}`).join("|")).test(n), u = typeof i.unescape == "function" ? i.unescape : vt().unescape;
	if (!e && !t && !l && !o) return [s && ct(n) ? u(n) : n];
	let d = o || s, f = t ?? {}, p = (e) => {
		wt(e).forEach((e) => {
			ct(e) || (xt(e) ? p(St(e)) : lt(e) && !(0, j.isValidElement)(e) && Object.assign(f, e));
		});
	};
	p(e);
	let m = Object.keys(f), h = et.parse(`<0>${n}</0>`, { allowedTags: (e) => /^\d+$/.test(e) || c.indexOf(e) > -1 || m.indexOf(e) > -1 }), g = {
		...f,
		...a
	}, _ = (e, t, n) => {
		let r = St(e), i = y(r, t.children, n);
		return Ct(r) && i.length === 0 || e.props?.i18nIsDynamicList ? r : i;
	}, v = (e, t, n, r, i) => {
		e.dummy ? (e.children = t, n.push((0, j.cloneElement)(e, { key: r }, i ? void 0 : t))) : n.push(...j.Children.map([e], (e) => {
			if (e.type === j.Fragment || e.props?.i18nIsDynamicList !== void 0) {
				let n = { key: r };
				return e && e.props && Object.keys(e.props).forEach((t) => {
					t !== "children" && t !== "i18nIsDynamicList" && (n[t] = e.props[t]);
				}), (0, j.createElement)(e.type, n, i ? null : t);
			}
			let n = { key: r };
			return e && e.props && Object.keys(e.props).forEach((t) => {
				t !== "ref" && t !== "children" && (n[t] = e.props[t]);
			}), (0, j.cloneElement)(e, n, i ? null : t);
		}));
	}, y = (e, n, a) => {
		let o = wt(e), s = wt(n), f = {};
		return s.reduce((e, n, s) => {
			let p = n.children?.[0]?.content && r.services.interpolator.interpolate(n.children[0].content, g, r.language), m = d && p ? u(p) : p;
			if (n.type === "tag") {
				let u = o[parseInt(n.name, 10)];
				!u && t && (u = t[n.name]), a.length === 1 && !u && lt(a[0]) && (u = a[0][n.name]), u ||= {};
				let p = { ...n.attrs };
				d && Object.keys(p).forEach((e) => {
					let t = p[e];
					ct(t) && (p[e] = gt(t));
				});
				let h = Object.keys(p).length === 0 ? u : Tt({ props: p }, u), b = (0, j.isValidElement)(h), x = b && xt(n, !0) && !n.voidElement, S = l && lt(h) && h.dummy && !b, C = lt(t) && Object.hasOwnProperty.call(t, n.name);
				if (ct(h)) {
					let t = r.services.interpolator.interpolate(h, g, r.language);
					e.push(t);
				} else if (xt(h) || x) {
					let t = _(h, n, a);
					v(h, t, e, s);
				} else if (S) {
					let t = y(o, n.children, a);
					v(h, t, e, s);
				} else if (Number.isNaN(parseFloat(n.name))) {
					if (C) {
						let t = _(h, n, a);
						v(h, t, e, s, n.voidElement);
					} else if (i.transSupportBasicHtmlNodes && c.indexOf(n.name) > -1) {
						if (n.voidElement) e.push((0, j.createElement)(n.name, { key: `${n.name}-${s}` }));
						else {
							let t = f[n.name] || 0;
							f[n.name] = t + 1;
							let r, i = 0;
							for (let e = 0; e < o.length; e += 1) {
								let a = o[e];
								if ((0, j.isValidElement)(a) && a.type === n.name) {
									if (i === t) {
										r = a;
										break;
									}
									i += 1;
								}
							}
							let c = r ? wt(St(r)) : o, l = y(c, n.children, a);
							e.push((0, j.createElement)(n.name, { key: `${n.name}-${s}` }, l));
						}
					} else if (n.voidElement) e.push(`<${n.name} />`);
					else {
						let t = y(o, n.children, a);
						e.push(`<${n.name}>${t}</${n.name}>`);
					}
				} else if (lt(h) && !b) {
					let t = n.children[0] ? m : null;
					t && e.push(t);
				} else v(h, m, e, s, n.children.length !== 1 || !m);
			} else if (n.type === "text") {
				let t = i.transWrapTextNodes, a = d ? u(r.services.interpolator.interpolate(n.content, g, r.language)) : r.services.interpolator.interpolate(n.content, g, r.language);
				t ? e.push((0, j.createElement)(t, { key: `${n.name}-${s}` }, a)) : e.push(a);
			}
			return e;
		}, []);
	};
	return St(y([{
		dummy: !0,
		children: e || []
	}], h, wt(e || []))[0]);
}, kt = (e, t, n) => {
	let r = e.key || t, i = (0, j.cloneElement)(e, { key: r });
	if (!i.props || !i.props.children || n.indexOf(`${t}/>`) < 0 && n.indexOf(`${t} />`) < 0) return i;
	function a() {
		return (0, j.createElement)(j.Fragment, null, i);
	}
	return (0, j.createElement)(a, { key: r });
}, At = (e, t) => e.map((e, n) => kt(e, n, t)), jt = (e, t) => {
	let n = {};
	return Object.keys(e).forEach((r) => {
		Object.assign(n, { [r]: kt(e[r], r, t) });
	}), n;
}, Mt = (e, t, n, r) => e ? Array.isArray(e) ? At(e, t) : lt(e) ? jt(e, t) : (rt(n, "TRANS_INVALID_COMPONENTS", "<Trans /> \"components\" prop expects an object or array", { i18nKey: r }), null) : null, Nt = (e) => !lt(e) || Array.isArray(e) ? !1 : Object.keys(e).reduce((e, t) => e && Number.isNaN(Number.parseFloat(t)), !0);
function Pt({ children: e, count: t, parent: n, i18nKey: r, context: i, tOptions: a = {}, values: o, defaults: s, components: c, ns: l, i18n: u, t: d, shouldUnescape: f, ...p }) {
	let m = u || bt();
	if (!m) return rt(m, "NO_I18NEXT_INSTANCE", "Trans: You need to pass in an i18next instance using initReactI18next or by passing it via props or context. In monorepo setups, make sure there is only one instance of react-i18next.", { i18nKey: r }), e;
	let h = d || m.t.bind(m) || ((e) => e), g = {
		...vt(),
		...m.options?.react
	}, _ = l || (h.ns ? void 0 : m.options?.defaultNS || "translation");
	ct(_) && (_ = [_]);
	let { transDefaultProps: v } = g, y = v?.tOptions ? {
		...v.tOptions,
		...a
	} : a, b = f ?? v?.shouldUnescape, x = v?.values ? {
		...v.values,
		...o
	} : o, S = v?.components ? {
		...v.components,
		...c
	} : c, C = Dt(e, g, m, r), w = Array.isArray(r) ? r[r.length - 1] : r, T = s || y?.defaultValue || C || g.transEmptyNodeValue || (typeof w == "function" ? be(w) : w), { hashTransKey: E } = g, D = r || (E ? E(C || T) : C || T);
	o = m.options?.interpolation?.defaultVariables ? {
		...m.options.interpolation.defaultVariables,
		...x
	} : x;
	let ee = Et(e);
	ee && typeof ee.count == "number" && t === void 0 && (t = ee.count), t === void 0 && (t = y?.count);
	let te = o || t !== void 0 && !m.options?.interpolation?.alwaysFormat || !e, ne = ut(m), re = te && (ne ? !ne.options?.escapeVariables : (y.interpolation?.escapeValue ?? m.options?.interpolation?.escapeValue) === !1), ie = te ? y.interpolation : { interpolation: {
		...y.interpolation,
		prefix: "#$?",
		suffix: "?$#"
	} };
	re && !ne && (ie = { interpolation: {
		...y.interpolation,
		escapeValue: !0
	} });
	let ae = {
		...m.options?.interpolation,
		...y.interpolation
	}, oe = ae.escape || m.services?.interpolator?.escape, O = Object.keys(ee).map((e) => `${ae.prefix ?? "{{"}${e}${ae.suffix ?? "}}"}`), se = te && !ne && O.length > 0 && ae.skipOnVariables !== !1 && !y.missingInterpolationHandler && !m.options?.missingInterpolationHandler && typeof oe == "function" && O.every((e) => oe(e) === e), ce = re && ne ? ft : (e) => e, le = {
		...ce(y),
		context: i || y.context,
		count: t,
		...ce(o),
		...se && { missingInterpolationHandler: (e, t, n) => n && Object.prototype.hasOwnProperty.call(n, t[1].trim()) ? "" : t[0] },
		...ie,
		defaultValue: T,
		ns: _
	}, ue = D ? h(D, le) : T;
	ue === D && T && (ue = T);
	let de = Mt(S, ue, m, r), fe = de || e, pe = null;
	Nt(de) ? (pe = de, fe = e) : de && !Array.isArray(de) && (pe = de, fe = void 0);
	let me = Ot(fe, pe, ue, m, g, le, b, re), he = n ?? g.defaultTransParent;
	return he ? (0, j.createElement)(he, p, me) : me;
}
// node_modules/.pnpm/react-i18next@17.1.13_i18next@26.7.2_typescript@7.0.2__react-dom@19.3.1_react@19.3.1__react@19.3.1_typescript@7.0.2/node_modules/react-i18next/dist/es/context.js
var Ft = (0, j.createContext)(), It = class {
	constructor() {
		this.usedNamespaces = {};
	}
	addUsedNamespaces(e) {
		e.forEach((e) => {
			this.usedNamespaces[e] || (this.usedNamespaces[e] = !0);
		});
	}
	getUsedNamespaces() {
		return Object.keys(this.usedNamespaces);
	}
};
// node_modules/.pnpm/react-i18next@17.1.13_i18next@26.7.2_typescript@7.0.2__react-dom@19.3.1_react@19.3.1__react@19.3.1_typescript@7.0.2/node_modules/react-i18next/dist/es/Trans.js
function Lt({ children: e, count: t, parent: n, i18nKey: r, context: i, tOptions: a = {}, values: o, defaults: s, components: c, ns: l, i18n: u, t: d, shouldUnescape: f, ...p }) {
	let { i18n: m, defaultNS: h } = (0, j.useContext)(Ft) || {}, g = u || m || bt(), _ = d || g?.t.bind(g);
	return Pt({
		children: e,
		count: t,
		parent: n,
		i18nKey: r,
		context: i,
		tOptions: a,
		values: o,
		defaults: s,
		components: c,
		ns: l || (_?.ns ? void 0 : h || g?.options?.defaultNS),
		i18n: g,
		t: d,
		shouldUnescape: f,
		...p
	});
}
// node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
var Rt = /* @__PURE__ */ o(((e) => {
	var t = f();
	function n(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var r = typeof Object.is == "function" ? Object.is : n, i = t.useState, a = t.useEffect, o = t.useLayoutEffect, s = t.useDebugValue;
	function c(e, t) {
		var n = t(), r = i({ inst: {
			value: n,
			getSnapshot: t
		} }), c = r[0].inst, u = r[1];
		return o(function() {
			c.value = n, c.getSnapshot = t, l(c) && u({ inst: c });
		}, [
			e,
			n,
			t
		]), a(function() {
			return l(c) && u({ inst: c }), e(function() {
				l(c) && u({ inst: c });
			});
		}, [e]), s(n), n;
	}
	function l(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !r(e, n);
		} catch {
			return !0;
		}
	}
	function u(e, t) {
		return t();
	}
	var d = typeof window > "u" || window.document === void 0 || window.document.createElement === void 0 ? u : c;
	e.useSyncExternalStore = t.useSyncExternalStore === void 0 ? d : t.useSyncExternalStore;
})), zt = (/* @__PURE__ */ o(((e, t) => {
	t.exports = Rt();
})))(), Bt = {
	t: (e, t) => {
		if (ct(t)) return t;
		if (lt(t) && ct(t.defaultValue)) return t.defaultValue;
		if (typeof e == "function") return "";
		if (Array.isArray(e)) {
			let t = e[e.length - 1];
			return typeof t == "function" ? "" : t;
		}
		return e;
	},
	ready: !1
}, Vt = () => () => {}, Ht = (e, t = {}) => {
	let { i18n: n } = t, { i18n: r, defaultNS: i } = (0, j.useContext)(Ft) || {}, a = n || r || bt();
	a && !a.reportNamespaces && (a.reportNamespaces = new It()), a || rt(a, "NO_I18NEXT_INSTANCE", "useTranslation: You will need to pass in an i18next instance by using initReactI18next or by passing it via props or context. In monorepo setups, make sure there is only one instance of react-i18next.");
	let o = (0, j.useMemo)(() => ({
		...vt(),
		...a?.options?.react,
		...t
	}), [a, t]), { useSuspense: s, keyPrefix: c, bindI18n: l, bindI18nStore: u } = o, d = e || i || a?.options?.defaultNS, f = ct(d) ? [d] : d || ["translation"], p = JSON.stringify(f), m = (0, j.useMemo)(() => f, [p]);
	a?.reportNamespaces?.addUsedNamespaces?.(m);
	let h = (0, j.useRef)(0), g = (0, j.useCallback)((e) => {
		if (!a) return Vt;
		let t = () => {
			h.current += 1, e();
		};
		return l && a.on(l, t), u && a.store.on(u, t), () => {
			l && l.split(" ").forEach((e) => a.off(e, t)), u && u.split(" ").forEach((e) => a.store.off(e, t));
		};
	}, [
		a,
		l,
		u
	]), _ = (0, j.useRef)(), v = (0, j.useCallback)(() => {
		if (!a) return Bt;
		let e = !!(a.isInitialized || a.initializedStoreOnce) && m.every((e) => st(e, a, o)), n = t.lng || a.language, r = h.current, i = typeof c == "function" ? be(c, {
			...a.options,
			ns: m
		}) : c, s = _.current;
		if (s && s.i18n === a && s.ready === e && s.lng === n && s.namespaces === m && s.keyPrefix === i && s.revision === r) return s;
		let l = {
			t: a.getFixedT(n, o.nsMode === "fallback" ? m : m[0], c, { scopeNs: m }),
			i18n: a,
			ready: e,
			lng: n,
			namespaces: m,
			keyPrefix: i,
			revision: r
		};
		return _.current = l, l;
	}, [
		a,
		m,
		c,
		o,
		t.lng
	]), [y, b] = (0, j.useState)(0), { t: x, ready: S } = (0, zt.useSyncExternalStore)(g, v, v), C;
	a && s && !S && (C = new Promise((e) => {
		let n = () => e();
		t.lng ? ot(a, t.lng, m, n) : at(a, m, n);
	}), {t: x, ready: S} = v()), (0, j.useEffect)(() => {
		if (a && !S && !s) {
			let e = () => b((e) => e + 1);
			t.lng ? ot(a, t.lng, m, e) : at(a, m, e);
		}
	}, [
		a,
		t.lng,
		m,
		S,
		s,
		y
	]);
	let w = a || {}, T = (0, j.useRef)(null), E = (0, j.useRef)(), D = (e) => `${e.language}|${e.resolvedLanguage}|${e.languages?.join(",")}`, ee = (e) => {
		let t = Object.getOwnPropertyDescriptors(e);
		t.__original && delete t.__original;
		let n = Object.create(Object.getPrototypeOf(e), t);
		if (!Object.prototype.hasOwnProperty.call(n, "__original")) try {
			Object.defineProperty(n, "__original", {
				value: e,
				writable: !1,
				enumerable: !1,
				configurable: !1
			});
		} catch {}
		return n;
	}, te = (0, j.useMemo)(() => {
		let e = w, t = e && D(e), n = e;
		e && (T.current && T.current.__original === e && E.current === t ? n = T.current : (n = ee(e), T.current = n, E.current = t));
		let r = !S && !s ? (...e) => (rt(a, "USE_T_BEFORE_READY", "useTranslation: t was called before ready. When using useSuspense: false, make sure to check the ready flag before using t."), x(...e)) : x, i = [
			r,
			n,
			S
		];
		return i.t = r, i.i18n = n, i.ready = S, i;
	}, [
		x,
		w,
		S,
		w.resolvedLanguage,
		w.language,
		w.languages
	]);
	if (a && s && !S) {
		let e = !1;
		try {
			e = !1;
		} catch {}
		throw e && rt(a, "SUSPENDED_WHILE_LOADING", "useTranslation: suspended while translations are loading (useSuspense is true by default). Add a <Suspense> boundary above this component, or set react.useSuspense: false in the i18next init options. https://react.i18next.com/latest/usetranslation-hook"), C;
	}
	return te;
};
// node_modules/.pnpm/react-i18next@17.1.13_i18next@26.7.2_typescript@7.0.2__react-dom@19.3.1_react@19.3.1__react@19.3.1_typescript@7.0.2/node_modules/react-i18next/dist/es/I18nextProvider.js
function Ut({ i18n: e, defaultNS: t, children: n }) {
	let r = (0, j.useMemo)(() => ({
		i18n: e,
		defaultNS: t
	}), [e, t]);
	return (0, j.createElement)(Ft.Provider, { value: r }, n);
}
// src/core/notesModel.ts
var Wt = Object.freeze({
	identity: 512,
	metadata: 2e3,
	tags: 32,
	tag: 64,
	note: 5e4,
	bookmarks: 500,
	bookmarkText: 2e3,
	positionSeconds: 604800,
	records: 5e4,
	backupCharacters: 2e7
}), Gt = class extends Error {
	constructor(e) {
		super(`Invalid music notes data: ${e}`), this.name = "NotesValidationError";
	}
}, Kt = class extends Error {
	constructor() {
		super("This music note changed after the editor opened it. Reload before saving."), this.name = "NotesConflictError";
	}
}, qt = class extends Error {
	constructor() {
		super("The music notes library exceeds its backup capacity. Remove records or shorten notes before saving."), this.name = "NotesCapacityError";
	}
}, M = (e) => JSON.stringify([e.source, e.id]), Jt = () => ({
	tags: [],
	note: "",
	bookmarks: []
}), Yt = (e) => {
	let t = new Set(e.map((e) => e.id)), n = 1;
	for (; t.has(`bookmark-${n}`);) n += 1;
	return `bookmark-${n}`;
}, Xt = (e) => e.trim().toLowerCase(), Zt = (e) => e.split(/[,，、\n]/u), N = (e) => {
	let t = /* @__PURE__ */ new Set();
	return e.map((e) => e.trim()).filter((e) => {
		let n = Xt(e);
		return !n || t.has(n) ? !1 : (t.add(n), !0);
	});
}, Qt = (e, t, n) => {
	let r = t.toLowerCase().trim().split(/\s+/u).filter(Boolean), i = Xt(n ?? "");
	return e.filter((e) => {
		if (i && !e.tags.some((e) => Xt(e) === i)) return !1;
		let t = [
			e.song.title,
			e.song.artist,
			e.song.album ?? "",
			e.note,
			...e.tags,
			...e.bookmarks.map((e) => e.text)
		].join("\n").toLowerCase();
		return r.every((e) => t.includes(e));
	});
}, $t = (e, t) => {
	if ((e?.revision ?? null) !== t) throw new Kt();
}, en = (e, t) => {
	if (typeof e != "object" || !e || Array.isArray(e)) throw new Gt(t);
	return e;
}, tn = (e, t, n, r = !1) => {
	if (typeof e != "string" || e.length > n || r && !e.trim()) throw new Gt(t);
	return e;
}, nn = (e, t, n = 0) => {
	if (typeof e != "number" || !Number.isSafeInteger(e) || e < n) throw new Gt(t);
	return e;
}, rn = (e) => {
	let t = en(e, "song");
	return {
		source: tn(t.source, "source", Wt.identity, !0),
		id: tn(t.id, "id", Wt.identity, !0)
	};
}, an = (e) => {
	let t = en(e, "song");
	return {
		...rn(t),
		title: tn(t.title, "title", Wt.metadata, !0),
		artist: tn(t.artist, "artist", Wt.metadata),
		...t.album === void 0 ? {} : { album: tn(t.album, "album", Wt.metadata) }
	};
}, on = (e) => {
	let t = en(e, "bookmark");
	if (typeof t.positionSeconds != "number" || !Number.isFinite(t.positionSeconds) || t.positionSeconds < 0 || t.positionSeconds > Wt.positionSeconds) throw new Gt("bookmark.positionSeconds");
	return {
		id: tn(t.id, "bookmark.id", Wt.identity, !0),
		positionSeconds: t.positionSeconds,
		text: tn(t.text, "bookmark.text", Wt.bookmarkText)
	};
}, sn = (e) => {
	let t = en(e, "draft");
	if (!Array.isArray(t.tags) || t.tags.length > Wt.tags) throw new Gt("tags");
	let n = N(t.tags.map((e) => tn(e, "tag", Wt.tag)));
	if (!Array.isArray(t.bookmarks) || t.bookmarks.length > Wt.bookmarks) throw new Gt("bookmarks");
	let r = t.bookmarks.map((e) => on(e));
	if (new Set(r.map((e) => e.id)).size !== r.length) throw new Gt("bookmark.id duplicate");
	return {
		tags: n,
		note: tn(t.note, "note", Wt.note),
		bookmarks: r
	};
}, cn = (e) => {
	let t = en(e, "record"), n = an(t.song);
	if (t.key !== M(n)) throw new Gt("record.key");
	let r = nn(t.createdAt, "createdAt"), i = nn(t.updatedAt, "updatedAt");
	if (i < r) throw new Gt("updatedAt");
	return {
		key: M(n),
		song: n,
		...sn(t),
		createdAt: r,
		updatedAt: i,
		revision: nn(t.revision, "revision", 1)
	};
}, P = class extends Error {
	constructor(e) {
		super(`Music notes host: ${e}`), this.code = e, this.name = "NoteImportError";
	}
}, ln = (e) => {
	if (e === null || typeof e != "object" && typeof e != "function" || Array.isArray(e)) throw new P("incomplete");
	return e;
}, un = (e) => {
	if (typeof e != "string" && typeof e != "number" || String(e).trim() === "" || typeof e == "number" && !Number.isFinite(e)) throw new P("incomplete");
	return String(e);
}, dn = (e, t) => {
	let n = e[t];
	if (typeof n != "function") throw new P("unsupported-host");
	let r = n;
	return (...t) => r.call(e, ...t);
}, fn = (e) => {
	let t = /^0\.7\.(\d+)(?:[-+].*)?$/u.exec(e.host.folia ?? "");
	if (e.host.folium.major !== 1 || e.host.folium.minor < 9 || e.env.context !== "main" || !t || Number(t[1]) < 29) throw new P("unsupported-host");
}, pn = (e) => {
	fn(e);
	try {
		return ln(e.internals);
	} catch {
		throw new P("unsupported-host");
	}
}, mn = (e) => {
	try {
		return ln(pn(e).omni);
	} catch {
		throw new P("unsupported-host");
	}
}, hn = (e, t) => {
	let n;
	try {
		n = dn(ln(ln(pn(e).stores).playback), "getState");
	} catch {
		throw new P("unsupported-host");
	}
	let r = ln(n()), i = (r.transitionDisplay == null ? null : ln(r.transitionDisplay))?.song ?? r.currentSong;
	if (!i) return null;
	let a = ln(i);
	if (un(a.id) !== t.id) return null;
	if (a.sourceRef != null) {
		let e = ln(a.sourceRef);
		return (t.source === "local" ? e.kind === "local" : e.kind === "online" && e.providerId === t.source) ? un(e.mediaId) : null;
	}
	return t.source === "local" ? a.localRef == null ? null : un(ln(a.localRef).songId) : t.id;
}, gn = (e, t) => {
	let n = ln(e), r = ln(n.sourceRef);
	if (r.kind !== "online" || r.providerId !== t || !Array.isArray(n.artists)) throw new P("incomplete");
	let i = n.artists.map((e) => {
		let t = ln(e).name;
		if (typeof t != "string") throw new P("incomplete");
		return t;
	}), a = ln(n.album).name;
	return an({
		source: `online:${t}`,
		id: un(r.mediaId),
		title: n.name,
		artist: i.join(" / "),
		...a === void 0 || a === "" ? {} : { album: a }
	});
}, _n = 100, vn = 1e4, yn = (e) => {
	if (e !== void 0) {
		if (typeof e != "number" || !Number.isSafeInteger(e) || e < 0) throw new P("incomplete");
		return e;
	}
}, bn = (e) => {
	let t = /* @__PURE__ */ new WeakMap(), n = () => e.omni.listProviders().flatMap((t) => {
		if (!t.configured) return [];
		let n = e.account.getState(t.providerId);
		return n?.status !== "signed-in" || !n.accountKey ? [] : ln(dn(mn(e), "getProviderCapabilities")(t.providerId)).userLibrary === !0 ? [{
			source: t.providerId,
			id: n.accountKey,
			name: t.displayName
		}] : [];
	}), r = (t, r, i) => {
		let a = !1;
		return {
			stop: e.events.on("account.changed", (e) => {
				e.providerId === t && (a = !0);
			}),
			assert() {
				if (i?.throwIfAborted(), a || !n().some((e) => e.source === t && e.id === r)) throw new P("account-changed");
			}
		};
	};
	return {
		accounts: n,
		async playlists(i, a) {
			a?.throwIfAborted();
			let o = n().find((e) => e.source === i);
			if (!o) throw new P("account-unavailable");
			let s = r(i, o.id, a);
			try {
				s.assert();
				let n = await dn(mn(e), "refreshProviderPlaylists")(i);
				if (s.assert(), !Array.isArray(n)) throw new P("incomplete");
				return n.flatMap((e) => {
					let n = ln(e);
					if (n.providerId !== i || n.type !== "playlist") return [];
					if (typeof n.name != "string") throw new P("incomplete");
					let r = {
						id: un(n.id),
						source: i,
						accountId: o.id,
						name: n.name,
						trackCount: yn(n.trackCount)
					};
					return t.set(r, n), [r];
				});
			} finally {
				s.stop();
			}
		},
		async readPlaylist(n, i) {
			i?.throwIfAborted();
			let a = t.get(n);
			if (!a) throw new P("incomplete");
			let o = r(n.source, n.accountId, i), s = /* @__PURE__ */ new Map(), c = 0, l = 0, u = n.trackCount;
			try {
				for (let t = 0; t <= vn / _n; t += 1) {
					o.assert();
					let t = await dn(mn(e), "getCollectionTracks")(a, {
						limit: _n,
						offset: c
					});
					o.assert();
					let r = ln(t);
					if (!Array.isArray(r.items) || typeof r.hasMore != "boolean") throw new P("incomplete");
					let i = yn(r.total);
					if (i !== void 0 && (u = Math.max(i, u ?? 0)), l += r.items.length, l > vn) throw new P("limit");
					for (let e of r.items) {
						let t = gn(e, n.source);
						s.set(M(t), t);
					}
					if (!r.hasMore) {
						if (u !== void 0 && l < u) throw new P("incomplete");
						return [...s.values()];
					}
					let d = yn(r.nextOffset);
					if (!r.items.length || d === void 0 || d <= c) throw new P("incomplete");
					c = d;
				}
				throw new P("limit");
			} finally {
				o.stop();
			}
		}
	};
}, xn = (e, t) => {
	fn(e);
	let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = 0, a = (t) => {
		if (!t?.id || !t.source || t.source === "stage" || t.source === "navidrome") return null;
		try {
			let r = hn(e, t);
			if (!r) return null;
			let i = an({
				source: t.source === "local" ? "local" : `online:${t.source}`,
				id: r,
				title: t.title,
				artist: t.artist,
				...t.album == null ? {} : { album: t.album }
			});
			return i.source === "local" && t.ref && (n.size >= 256 && !n.has(r) && n.delete(n.keys().next().value), n.set(r, t)), i;
		} catch (e) {
			if (e instanceof Gt || e instanceof P && e.code === "incomplete") return null;
			throw e;
		}
	}, o = () => a(e.playback.getState().song), s = () => {
		let e = o();
		return e && M(e);
	}, c = async (t) => {
		let r = e.playback.getState().song, i = a(r);
		if (i && M(i) === M(t)) return r;
		if (t.source === "local") return n.get(t.id) ?? null;
		if (!t.source.startsWith("online:")) return null;
		let o = t.source.slice(7), [s] = await e.omni.resolveSongs([{
			source: o,
			id: t.id
		}]);
		return s?.status === "found" && s.song.source === o ? s.song : null;
	}, l = (e) => t?.aborted || e !== i, u = async (t, n) => {
		let r = s();
		try {
			let i = await c(t);
			if (l(n) || r !== s()) return "superseded";
			if (!i) return !1;
			let a = await e.playback.playSong(i);
			return l(n) ? "superseded" : a;
		} catch (e) {
			if (l(n)) return "superseded";
			throw e;
		}
	};
	return {
		...bn(e),
		currentSong: o,
		currentTime: () => e.playback.getState().position,
		playbackState: () => e.playback.getState().state,
		isPlaying: () => e.playback.getState().state === "playing",
		cover(t) {
			if (t.source === "local") return Promise.resolve(null);
			let n = M(t), i = r.get(n);
			if (i) return i;
			let a = c(t).then((t) => t ? e.omni.describeSong(t)?.coverUrl ?? null : null).catch(() => null);
			return r.size >= 512 && r.delete(r.keys().next().value), r.set(n, a), a;
		},
		subscribe(t) {
			let n = [
				e.events.on("playback.songChanged", t),
				e.events.on("playback.stateChanged", t),
				e.events.on("account.changed", t)
			];
			return () => {
				n.forEach((e) => e());
			};
		},
		async play(t) {
			let n = ++i, r = e.playback.getState(), o = a(r.song);
			if (o && M(o) === M(t)) {
				if (r.state === "paused") return e.playback.play(), !0;
				if (r.state === "playing") return !0;
			}
			return u(t, n);
		},
		pause(t) {
			let n = e.playback.getState(), r = a(n.song);
			n.state === "playing" && r && M(r) === M(t) && (++i, e.playback.pause());
		},
		async playAt(t, n) {
			if (!Number.isFinite(n) || n < 0) return !1;
			let r = M(t), a = s(), o = ++i;
			if (a === r) return e.playback.seek(n), e.playback.getState().state !== "playing" && e.playback.play(), !0;
			let c = await u(t, o);
			if (c !== !0) return c;
			let d = Date.now() + 5e3;
			do {
				if (l(o)) return "superseded";
				let t = s();
				if (t && t !== r && t !== a) return !1;
				let i = e.playback.getState();
				if (t === r && i.state === "playing" && i.duration > 0) return e.playback.seek(n), !0;
				await new Promise((e) => setTimeout(e, 75));
			} while (Date.now() < d);
			return !1;
		},
		seek(t, n) {
			let r = o();
			r && M(r) === M(t) && Number.isFinite(n) && n >= 0 && e.playback.seek(n);
		}
	};
}, Sn = function(e, t) {
	return Sn = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e, t) {
		e.__proto__ = t;
	} || function(e, t) {
		for (var n in t) Object.prototype.hasOwnProperty.call(t, n) && (e[n] = t[n]);
	}, Sn(e, t);
};
function Cn(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Class extends value " + String(t) + " is not a constructor or null");
	Sn(e, t);
	function n() {
		this.constructor = e;
	}
	e.prototype = t === null ? Object.create(t) : (n.prototype = t.prototype, new n());
}
var F = function() {
	return F = Object.assign || function(e) {
		for (var t, n = 1, r = arguments.length; n < r; n++) for (var i in t = arguments[n], t) Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i]);
		return e;
	}, F.apply(this, arguments);
};
function wn(e, t, n) {
	if (n || arguments.length === 2) for (var r = 0, i = t.length, a; r < i; r++) (a || !(r in t)) && (a ||= Array.prototype.slice.call(t, 0, r), a[r] = t[r]);
	return e.concat(a || Array.prototype.slice.call(t));
}
var Tn = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : global, En = Object.keys, Dn = Array.isArray;
typeof Promise < "u" && !Tn.Promise && (Tn.Promise = Promise);
function On(e, t) {
	return typeof t == "object" && En(t).forEach(function(n) {
		e[n] = t[n];
	}), e;
}
var kn = Object.getPrototypeOf, An = {}.hasOwnProperty;
function jn(e, t) {
	return An.call(e, t);
}
function Mn(e, t) {
	typeof t == "function" && (t = t(kn(e))), (typeof Reflect > "u" ? En : Reflect.ownKeys)(t).forEach(function(n) {
		Pn(e, n, t[n]);
	});
}
var Nn = Object.defineProperty;
function Pn(e, t, n, r) {
	Nn(e, t, On(n && jn(n, "get") && typeof n.get == "function" ? {
		get: n.get,
		set: n.set,
		configurable: !0
	} : {
		value: n,
		configurable: !0,
		writable: !0
	}, r));
}
function Fn(e) {
	return { from: function(t) {
		return e.prototype = Object.create(t.prototype), Pn(e.prototype, "constructor", e), { extend: Mn.bind(null, e.prototype) };
	} };
}
var In = Object.getOwnPropertyDescriptor;
function Ln(e, t) {
	var n = In(e, t), r;
	return n || (r = kn(e)) && Ln(r, t);
}
var Rn = [].slice;
function zn(e, t, n) {
	return Rn.call(e, t, n);
}
function Bn(e, t) {
	return t(e);
}
function Vn(e) {
	if (!e) throw Error("Assertion Failed");
}
function Hn(e) {
	Tn.setImmediate ? setImmediate(e) : setTimeout(e, 0);
}
function Un(e, t) {
	return e.reduce(function(e, n, r) {
		var i = t(n, r);
		return i && (e[i[0]] = i[1]), e;
	}, {});
}
function Wn(e, t) {
	if (typeof t == "string" && jn(e, t)) return e[t];
	if (!t) return e;
	if (typeof t != "string") {
		for (var n = [], r = 0, i = t.length; r < i; ++r) {
			var a = Wn(e, t[r]);
			n.push(a);
		}
		return n;
	}
	var o = t.indexOf(".");
	if (o !== -1) {
		var s = e[t.substr(0, o)];
		return s == null ? void 0 : Wn(s, t.substr(o + 1));
	}
}
function Gn(e, t, n) {
	if (e && t !== void 0 && !("isFrozen" in Object && Object.isFrozen(e))) {
		if (typeof t != "string" && "length" in t) {
			Vn(typeof n != "string" && "length" in n);
			for (var r = 0, i = t.length; r < i; ++r) Gn(e, t[r], n[r]);
		} else {
			var a = t.indexOf(".");
			if (a !== -1) {
				var o = t.substr(0, a), s = t.substr(a + 1);
				if (s === "") n === void 0 ? Dn(e) && !isNaN(parseInt(o)) ? e.splice(o, 1) : delete e[o] : e[o] = n;
				else {
					var c = e[o];
					if (!c || !jn(e, o)) {
						if (n === void 0) return;
						c = e[o] = {};
					}
					Gn(c, s, n);
				}
			} else n === void 0 ? Dn(e) && !isNaN(parseInt(t)) ? e.splice(t, 1) : delete e[t] : e[t] = n;
		}
	}
}
function Kn(e, t) {
	typeof t == "string" ? Gn(e, t, void 0) : "length" in t && [].map.call(t, function(t) {
		Gn(e, t, void 0);
	});
}
function qn(e) {
	var t = {};
	for (var n in e) jn(e, n) && (t[n] = e[n]);
	return t;
}
var Jn = [].concat;
function Yn(e) {
	return Jn.apply([], e);
}
var Xn = "BigUint64Array,BigInt64Array,Array,Boolean,String,Date,RegExp,Blob,File,FileList,FileSystemFileHandle,FileSystemDirectoryHandle,ArrayBuffer,DataView,Uint8ClampedArray,ImageBitmap,ImageData,Map,Set,CryptoKey".split(",").concat(Yn([
	8,
	16,
	32,
	64
].map(function(e) {
	return [
		"Int",
		"Uint",
		"Float"
	].map(function(t) {
		return t + e + "Array";
	});
}))).filter(function(e) {
	return Tn[e];
}), Zn = new Set(Xn.map(function(e) {
	return Tn[e];
}));
function Qn(e) {
	var t = {};
	for (var n in e) if (jn(e, n)) {
		var r = e[n];
		t[n] = !r || typeof r != "object" || Zn.has(r.constructor) ? r : Qn(r);
	}
	return t;
}
var $n = null;
function er(e) {
	$n = /* @__PURE__ */ new WeakMap();
	var t = tr(e);
	return $n = null, t;
}
function tr(e) {
	if (!e || typeof e != "object") return e;
	var t = $n.get(e);
	if (t) return t;
	if (Dn(e)) {
		t = [], $n.set(e, t);
		for (var n = 0, r = e.length; n < r; ++n) t.push(tr(e[n]));
	} else if (Zn.has(e.constructor)) t = e;
	else {
		var i = kn(e);
		for (var a in t = i === Object.prototype ? {} : Object.create(i), $n.set(e, t), e) jn(e, a) && (t[a] = tr(e[a]));
	}
	return t;
}
var nr = {}.toString;
function rr(e) {
	return nr.call(e).slice(8, -1);
}
var ir = typeof Symbol < "u" ? Symbol.iterator : "@@iterator", ar = typeof ir == "symbol" ? function(e) {
	var t;
	return e != null && (t = e[ir]) && t.apply(e);
} : function() {
	return null;
};
function or(e, t) {
	var n = e.indexOf(t);
	return n >= 0 && e.splice(n, 1), n >= 0;
}
var sr = {};
function cr(e) {
	var t, n, r, i;
	if (arguments.length === 1) {
		if (Dn(e)) return e.slice();
		if (this === sr && typeof e == "string") return [e];
		if (i = ar(e)) {
			for (n = []; r = i.next(), !r.done;) n.push(r.value);
			return n;
		}
		if (e == null) return [e];
		if (t = e.length, typeof t == "number") {
			for (n = Array(t); t--;) n[t] = e[t];
			return n;
		}
		return [e];
	}
	for (t = arguments.length, n = Array(t); t--;) n[t] = arguments[t];
	return n;
}
var lr = typeof Symbol < "u" ? function(e) {
	return e[Symbol.toStringTag] === "AsyncFunction";
} : function() {
	return !1;
}, ur = [
	"Modify",
	"Bulk",
	"OpenFailed",
	"VersionChange",
	"Schema",
	"Upgrade",
	"InvalidTable",
	"MissingAPI",
	"NoSuchDatabase",
	"InvalidArgument",
	"SubTransaction",
	"Unsupported",
	"Internal",
	"DatabaseClosed",
	"PrematureCommit",
	"ForeignAwait"
], dr = [
	"Unknown",
	"Constraint",
	"Data",
	"TransactionInactive",
	"ReadOnly",
	"Version",
	"NotFound",
	"InvalidState",
	"InvalidAccess",
	"Abort",
	"Timeout",
	"QuotaExceeded",
	"Syntax",
	"DataClone"
], fr = ur.concat(dr), pr = {
	VersionChanged: "Database version changed by other database connection",
	DatabaseClosed: "Database has been closed",
	Abort: "Transaction aborted",
	TransactionInactive: "Transaction has already completed or failed",
	MissingAPI: "IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb"
};
function mr(e, t) {
	this.name = e, this.message = t;
}
Fn(mr).from(Error).extend({ toString: function() {
	return this.name + ": " + this.message;
} });
function hr(e, t) {
	return e + ". Errors: " + Object.keys(t).map(function(e) {
		return t[e].toString();
	}).filter(function(e, t, n) {
		return n.indexOf(e) === t;
	}).join("\n");
}
function gr(e, t, n, r) {
	this.failures = t, this.failedKeys = r, this.successCount = n, this.message = hr(e, t);
}
Fn(gr).from(mr);
function _r(e, t) {
	this.name = "BulkError", this.failures = Object.keys(t).map(function(e) {
		return t[e];
	}), this.failuresByPos = t, this.message = hr(e, this.failures);
}
Fn(_r).from(mr);
var vr = fr.reduce(function(e, t) {
	return e[t] = t + "Error", e;
}, {}), yr = mr, I = fr.reduce(function(e, t) {
	var n = t + "Error";
	function r(e, r) {
		this.name = n, e ? typeof e == "string" ? (this.message = `${e}${r ? "\n " + r : ""}`, this.inner = r || null) : typeof e == "object" && (this.message = `${e.name} ${e.message}`, this.inner = e) : (this.message = pr[t] || n, this.inner = null);
	}
	return Fn(r).from(yr), e[t] = r, e;
}, {});
I.Syntax = SyntaxError, I.Type = TypeError, I.Range = RangeError;
var br = dr.reduce(function(e, t) {
	return e[t + "Error"] = I[t], e;
}, {});
function xr(e, t) {
	if (!e || e instanceof mr || e instanceof TypeError || e instanceof SyntaxError || !e.name || !br[e.name]) return e;
	var n = new br[e.name](t || e.message, e);
	return "stack" in e && Pn(n, "stack", { get: function() {
		return this.inner.stack;
	} }), n;
}
var Sr = fr.reduce(function(e, t) {
	return [
		"Syntax",
		"Type",
		"Range"
	].indexOf(t) === -1 && (e[t + "Error"] = I[t]), e;
}, {});
Sr.ModifyError = gr, Sr.DexieError = mr, Sr.BulkError = _r;
function Cr() {}
function wr(e) {
	return e;
}
function Tr(e, t) {
	return e == null || e === wr ? t : function(n) {
		return t(e(n));
	};
}
function Er(e, t) {
	return function() {
		e.apply(this, arguments), t.apply(this, arguments);
	};
}
function Dr(e, t) {
	return e === Cr ? t : function() {
		var n = e.apply(this, arguments);
		n !== void 0 && (arguments[0] = n);
		var r = this.onsuccess, i = this.onerror;
		this.onsuccess = null, this.onerror = null;
		var a = t.apply(this, arguments);
		return r && (this.onsuccess = this.onsuccess ? Er(r, this.onsuccess) : r), i && (this.onerror = this.onerror ? Er(i, this.onerror) : i), a === void 0 ? n : a;
	};
}
function Or(e, t) {
	return e === Cr ? t : function() {
		e.apply(this, arguments);
		var n = this.onsuccess, r = this.onerror;
		this.onsuccess = this.onerror = null, t.apply(this, arguments), n && (this.onsuccess = this.onsuccess ? Er(n, this.onsuccess) : n), r && (this.onerror = this.onerror ? Er(r, this.onerror) : r);
	};
}
function kr(e, t) {
	return e === Cr ? t : function() {
		var n = e.apply(this, arguments), r = arguments[0];
		On(r, n);
		var i = this.onsuccess, a = this.onerror;
		this.onsuccess = null, this.onerror = null;
		var o = t.apply(this, arguments);
		return i && (this.onsuccess = this.onsuccess ? Er(i, this.onsuccess) : i), a && (this.onerror = this.onerror ? Er(a, this.onerror) : a), n === void 0 ? o === void 0 ? void 0 : o : On(n, o);
	};
}
function Ar(e, t) {
	return e === Cr ? t : function() {
		return t.apply(this, arguments) !== !1 && e.apply(this, arguments);
	};
}
function jr(e, t) {
	return e === Cr ? t : function() {
		var n = e.apply(this, arguments);
		if (n && typeof n.then == "function") {
			for (var r = this, i = arguments.length, a = Array(i); i--;) a[i] = arguments[i];
			return n.then(function() {
				return t.apply(r, a);
			});
		}
		return t.apply(this, arguments);
	};
}
var Mr = typeof location < "u" && /^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);
function Nr(e, t) {
	Mr = e;
}
var Pr = {}, Fr = 100, Ir = typeof Promise > "u" ? [] : (function() {
	var e = Promise.resolve();
	if (typeof crypto > "u" || !crypto.subtle) return [
		e,
		kn(e),
		e
	];
	var t = crypto.subtle.digest("SHA-512", new Uint8Array([0]));
	return [
		t,
		kn(t),
		e
	];
})(), Lr = Ir[0], Rr = Ir[1], zr = Ir[2], Br = Rr && Rr.then, Vr = Lr && Lr.constructor, Hr = !!zr;
function Ur() {
	queueMicrotask(si);
}
var Wr = function(e, t) {
	Zr.push([e, t]), Kr &&= (Ur(), !1);
}, Gr = !0, Kr = !0, qr = [], Jr = [], Yr = wr, Xr = {
	id: "global",
	global: !0,
	ref: 0,
	unhandleds: [],
	onunhandled: Cr,
	pgp: !1,
	env: {},
	finalize: Cr
}, L = Xr, Zr = [], Qr = 0, $r = [];
function R(e) {
	if (typeof this != "object") throw TypeError("Promises must be constructed via new");
	this._listeners = [], this._lib = !1;
	var t = this._PSD = L;
	if (typeof e != "function") {
		if (e !== Pr) throw TypeError("Not a function");
		this._state = arguments[1], this._value = arguments[2], this._state === !1 && ri(this, this._value);
	} else this._state = null, this._value = null, ++t.ref, ni(this, e);
}
var ei = {
	get: function() {
		var e = L, t = bi;
		function n(n, r) {
			var i = this, a = !e.global && (e !== L || t !== bi), o = a && !wi(), s = new R(function(t, s) {
				ai(i, new ti(ji(n, e, a, o), ji(r, e, a, o), t, s, e));
			});
			return this._consoleTask && (s._consoleTask = this._consoleTask), s;
		}
		return n.prototype = Pr, n;
	},
	set: function(e) {
		Pn(this, "then", e && e.prototype === Pr ? ei : {
			get: function() {
				return e;
			},
			set: ei.set
		});
	}
};
Mn(R.prototype, {
	then: ei,
	_then: function(e, t) {
		ai(this, new ti(null, null, e, t, L));
	},
	catch: function(e) {
		if (arguments.length === 1) return this.then(null, e);
		var t = arguments[0], n = arguments[1];
		return typeof t == "function" ? this.then(null, function(e) {
			return e instanceof t ? n(e) : mi(e);
		}) : this.then(null, function(e) {
			return e && e.name === t ? n(e) : mi(e);
		});
	},
	finally: function(e) {
		return this.then(function(t) {
			return R.resolve(e()).then(function() {
				return t;
			});
		}, function(t) {
			return R.resolve(e()).then(function() {
				return mi(t);
			});
		});
	},
	timeout: function(e, t) {
		var n = this;
		return e < Infinity ? new R(function(r, i) {
			var a = setTimeout(function() {
				return i(new I.Timeout(t));
			}, e);
			n.then(r, i).finally(clearTimeout.bind(null, a));
		}) : this;
	}
}), typeof Symbol < "u" && Symbol.toStringTag && Pn(R.prototype, Symbol.toStringTag, "Dexie.Promise"), Xr.env = ki();
function ti(e, t, n, r, i) {
	this.onFulfilled = typeof e == "function" ? e : null, this.onRejected = typeof t == "function" ? t : null, this.resolve = n, this.reject = r, this.psd = i;
}
Mn(R, {
	all: function() {
		var e = cr.apply(null, arguments).map(Ti);
		return new R(function(t, n) {
			e.length === 0 && t([]);
			var r = e.length;
			e.forEach(function(i, a) {
				return R.resolve(i).then(function(n) {
					e[a] = n, --r || t(e);
				}, n);
			});
		});
	},
	resolve: function(e) {
		return e instanceof R ? e : e && typeof e.then == "function" ? new R(function(t, n) {
			e.then(t, n);
		}) : new R(Pr, !0, e);
	},
	reject: mi,
	race: function() {
		var e = cr.apply(null, arguments).map(Ti);
		return new R(function(t, n) {
			e.map(function(e) {
				return R.resolve(e).then(t, n);
			});
		});
	},
	PSD: {
		get: function() {
			return L;
		},
		set: function(e) {
			return L = e;
		}
	},
	totalEchoes: { get: function() {
		return bi;
	} },
	newPSD: Si,
	usePSD: Ai,
	scheduler: {
		get: function() {
			return Wr;
		},
		set: function(e) {
			Wr = e;
		}
	},
	rejectionMapper: {
		get: function() {
			return Yr;
		},
		set: function(e) {
			Yr = e;
		}
	},
	follow: function(e, t) {
		return new R(function(n, r) {
			return Si(function(t, n) {
				var r = L;
				r.unhandleds = [], r.onunhandled = n, r.finalize = Er(function() {
					var e = this;
					di(function() {
						e.unhandleds.length === 0 ? t() : n(e.unhandleds[0]);
					});
				}, r.finalize), e();
			}, t, n, r);
		});
	}
}), Vr && (Vr.allSettled && Pn(R, "allSettled", function() {
	var e = cr.apply(null, arguments).map(Ti);
	return new R(function(t) {
		e.length === 0 && t([]);
		var n = e.length, r = Array(n);
		e.forEach(function(e, i) {
			return R.resolve(e).then(function(e) {
				return r[i] = {
					status: "fulfilled",
					value: e
				};
			}, function(e) {
				return r[i] = {
					status: "rejected",
					reason: e
				};
			}).then(function() {
				return --n || t(r);
			});
		});
	});
}), Vr.any && typeof AggregateError < "u" && Pn(R, "any", function() {
	var e = cr.apply(null, arguments).map(Ti);
	return new R(function(t, n) {
		e.length === 0 && n(/* @__PURE__ */ AggregateError([]));
		var r = e.length, i = Array(r);
		e.forEach(function(e, a) {
			return R.resolve(e).then(function(e) {
				return t(e);
			}, function(e) {
				i[a] = e, --r || n(AggregateError(i));
			});
		});
	});
}), Vr.withResolvers && (R.withResolvers = Vr.withResolvers));
function ni(e, t) {
	try {
		t(function(t) {
			if (e._state === null) {
				if (t === e) throw TypeError("A promise cannot be resolved with itself.");
				var n = e._lib && ci();
				t && typeof t.then == "function" ? ni(e, function(e, n) {
					t instanceof R ? t._then(e, n) : t.then(e, n);
				}) : (e._state = !0, e._value = t, ii(e)), n && li();
			}
		}, ri.bind(null, e));
	} catch (t) {
		ri(e, t);
	}
}
function ri(e, t) {
	if (Jr.push(t), e._state === null) {
		var n = e._lib && ci();
		t = Yr(t), e._state = !1, e._value = t, fi(e), ii(e), n && li();
	}
}
function ii(e) {
	var t = e._listeners;
	e._listeners = [];
	for (var n = 0, r = t.length; n < r; ++n) ai(e, t[n]);
	var i = e._PSD;
	--i.ref || i.finalize(), Qr === 0 && (++Qr, Wr(function() {
		--Qr === 0 && ui();
	}, []));
}
function ai(e, t) {
	if (e._state === null) e._listeners.push(t);
	else {
		var n = e._state ? t.onFulfilled : t.onRejected;
		if (n === null) return (e._state ? t.resolve : t.reject)(e._value);
		++t.psd.ref, ++Qr, Wr(oi, [
			n,
			e,
			t
		]);
	}
}
function oi(e, t, n) {
	try {
		var r, i = t._value;
		!t._state && Jr.length && (Jr = []), r = Mr && t._consoleTask ? t._consoleTask.run(function() {
			return e(i);
		}) : e(i), !t._state && Jr.indexOf(i) === -1 && pi(t), n.resolve(r);
	} catch (e) {
		n.reject(e);
	} finally {
		--Qr === 0 && ui(), --n.psd.ref || n.psd.finalize();
	}
}
function si() {
	Ai(Xr, function() {
		ci() && li();
	});
}
function ci() {
	var e = Gr;
	return Gr = !1, Kr = !1, e;
}
function li() {
	var e, t, n;
	do
		for (; Zr.length > 0;) for (e = Zr, Zr = [], n = e.length, t = 0; t < n; ++t) {
			var r = e[t];
			r[0].apply(null, r[1]);
		}
	while (Zr.length > 0);
	Gr = !0, Kr = !0;
}
function ui() {
	var e = qr;
	qr = [], e.forEach(function(e) {
		e._PSD.onunhandled.call(null, e._value, e);
	});
	for (var t = $r.slice(0), n = t.length; n;) t[--n]();
}
function di(e) {
	function t() {
		e(), $r.splice($r.indexOf(t), 1);
	}
	$r.push(t), ++Qr, Wr(function() {
		--Qr === 0 && ui();
	}, []);
}
function fi(e) {
	qr.some(function(t) {
		return t._value === e._value;
	}) || qr.push(e);
}
function pi(e) {
	for (var t = qr.length; t;) if (qr[--t]._value === e._value) {
		qr.splice(t, 1);
		return;
	}
}
function mi(e) {
	return new R(Pr, !1, e);
}
function hi(e, t) {
	var n = L;
	return function() {
		var r = ci(), i = L;
		try {
			return Oi(n, !0), e.apply(this, arguments);
		} catch (e) {
			t && t(e);
		} finally {
			Oi(i, !1), r && li();
		}
	};
}
var gi = {
	awaits: 0,
	echoes: 0,
	id: 0
}, _i = 0, vi = [], yi = 0, bi = 0, xi = 0;
function Si(e, t, n, r) {
	var i = L, a = Object.create(i);
	a.parent = i, a.ref = 0, a.global = !1, a.id = ++xi, Xr.env, a.env = Hr ? {
		Promise: R,
		PromiseProp: {
			value: R,
			configurable: !0,
			writable: !0
		},
		all: R.all,
		race: R.race,
		allSettled: R.allSettled,
		any: R.any,
		resolve: R.resolve,
		reject: R.reject
	} : {}, t && On(a, t), ++i.ref, a.finalize = function() {
		--this.parent.ref || this.parent.finalize();
	};
	var o = Ai(a, e, n, r);
	return a.ref === 0 && a.finalize(), o;
}
function Ci() {
	return gi.id ||= ++_i, ++gi.awaits, gi.echoes += Fr, gi.id;
}
function wi() {
	return gi.awaits ? (--gi.awaits === 0 && (gi.id = 0), gi.echoes = gi.awaits * Fr, !0) : !1;
}
("" + Br).indexOf("[native code]") === -1 && (Ci = wi = Cr);
function Ti(e) {
	return gi.echoes && e && e.constructor === Vr ? (Ci(), e.then(function(e) {
		return wi(), e;
	}, function(e) {
		return wi(), z(e);
	})) : e;
}
function Ei(e) {
	++bi, gi.echoes && --gi.echoes !== 0 || (gi.echoes = gi.awaits = gi.id = 0), vi.push(L), Oi(e, !0);
}
function Di() {
	var e = vi[vi.length - 1];
	vi.pop(), Oi(e, !1);
}
function Oi(e, t) {
	var n = L;
	if ((t ? gi.echoes && (!yi++ || e !== L) : yi && (!--yi || e !== L)) && queueMicrotask(t ? Ei.bind(null, e) : Di), e !== L && (L = e, n === Xr && (Xr.env = ki()), Hr)) {
		var r = Xr.env.Promise, i = e.env;
		(n.global || e.global) && (Object.defineProperty(Tn, "Promise", i.PromiseProp), r.all = i.all, r.race = i.race, r.resolve = i.resolve, r.reject = i.reject, i.allSettled && (r.allSettled = i.allSettled), i.any && (r.any = i.any));
	}
}
function ki() {
	var e = Tn.Promise;
	return Hr ? {
		Promise: e,
		PromiseProp: Object.getOwnPropertyDescriptor(Tn, "Promise"),
		all: e.all,
		race: e.race,
		allSettled: e.allSettled,
		any: e.any,
		resolve: e.resolve,
		reject: e.reject
	} : {};
}
function Ai(e, t, n, r, i) {
	var a = L;
	try {
		return Oi(e, !0), t(n, r, i);
	} finally {
		Oi(a, !1);
	}
}
function ji(e, t, n, r) {
	return typeof e == "function" ? function() {
		var i = L;
		n && Ci(), Oi(t, !0);
		try {
			return e.apply(this, arguments);
		} finally {
			Oi(i, !1), r && queueMicrotask(wi);
		}
	} : e;
}
function Mi(e) {
	Promise === Vr && gi.echoes === 0 ? yi === 0 ? e() : enqueueNativeMicroTask(e) : setTimeout(e, 0);
}
var z = R.reject;
function Ni(e, t, n, r) {
	if (!e.idbdb || !e._state.openComplete && !L.letThrough && !e._vip) {
		if (e._state.openComplete) return z(new I.DatabaseClosed(e._state.dbOpenError));
		if (!e._state.isBeingOpened) {
			if (!e._state.autoOpen) return z(new I.DatabaseClosed());
			e.open().catch(Cr);
		}
		return e._state.dbReadyPromise.then(function() {
			return Ni(e, t, n, r);
		});
	}
	var i = e._createTransaction(t, n, e._dbSchema);
	try {
		i.create(), e._state.PR1398_maxLoop = 3;
	} catch (i) {
		return i.name === vr.InvalidState && e.isOpen() && --e._state.PR1398_maxLoop > 0 ? (console.warn("Dexie: Need to reopen db"), e.close({ disableAutoOpen: !1 }), e.open().then(function() {
			return Ni(e, t, n, r);
		})) : z(i);
	}
	return i._promise(t, function(e, t) {
		return Si(function() {
			return L.trans = i, r(e, t, i);
		});
	}).then(function(e) {
		if (t === "readwrite") try {
			i.idbtrans.commit();
		} catch {}
		return t === "readonly" ? e : i._completion.then(function() {
			return e;
		});
	});
}
var Pi = "4.4.7", Fi = "￿", Ii = -Infinity, Li = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.", Ri = "String expected.", zi = 1e3, Bi = "__dbnames", Vi = "readonly", Hi = "readwrite";
function Ui(e, t) {
	return e ? t ? function() {
		return e.apply(this, arguments) && t.apply(this, arguments);
	} : e : t;
}
var Wi = {
	type: 3,
	lower: -Infinity,
	lowerOpen: !1,
	upper: [[]],
	upperOpen: !1
};
function Gi(e) {
	return typeof e == "string" && !/\./.test(e) ? function(t) {
		return t[e] === void 0 && e in t && (t = er(t), delete t[e]), t;
	} : function(e) {
		return e;
	};
}
function Ki() {
	throw I.Type("Entity instances must never be new:ed. Instances are generated by the framework bypassing the constructor.");
}
function B(e, t) {
	try {
		var n = Yi(e), r = Yi(t);
		if (n !== r) return n === "Array" ? 1 : r === "Array" ? -1 : n === "binary" ? 1 : r === "binary" ? -1 : n === "string" ? 1 : r === "string" ? -1 : n === "Date" ? 1 : r === "Date" ? -1 : NaN;
		switch (n) {
			case "number":
			case "Date":
			case "string": return e > t ? 1 : e < t ? -1 : 0;
			case "binary": return Ji(Xi(e), Xi(t));
			case "Array": return qi(e, t);
		}
	} catch {}
	return NaN;
}
function qi(e, t) {
	for (var n = e.length, r = t.length, i = n < r ? n : r, a = 0; a < i; ++a) {
		var o = B(e[a], t[a]);
		if (o !== 0) return o;
	}
	return n === r ? 0 : n < r ? -1 : 1;
}
function Ji(e, t) {
	for (var n = e.length, r = t.length, i = n < r ? n : r, a = 0; a < i; ++a) if (e[a] !== t[a]) return e[a] < t[a] ? -1 : 1;
	return n === r ? 0 : n < r ? -1 : 1;
}
function Yi(e) {
	var t = typeof e;
	if (t !== "object") return t;
	if (ArrayBuffer.isView(e)) return "binary";
	var n = rr(e);
	return n === "ArrayBuffer" ? "binary" : n;
}
function Xi(e) {
	return e instanceof Uint8Array ? e : ArrayBuffer.isView(e) ? new Uint8Array(e.buffer, e.byteOffset, e.byteLength) : new Uint8Array(e);
}
function Zi(e, t, n) {
	var r = e.schema.yProps;
	return r ? (t && n.numFailures > 0 && (t = t.filter(function(e, t) {
		return !n.failures[t];
	})), Promise.all(r.map(function(n) {
		var r = n.updatesTable;
		return t ? e.db.table(r).where("k").anyOf(t).delete() : e.db.table(r).clear();
	})).then(function() {
		return n;
	})) : n;
}
var Qi = function() {
	function e(e) {
		this["@@propmod"] = e;
	}
	return e.prototype.execute = function(e) {
		var t = this["@@propmod"];
		if (t.add !== void 0) {
			var n = t.add;
			if (Dn(n)) return wn(wn([], Dn(e) ? e : [], !0), n, !0).sort();
			if (typeof n == "number") return (Number(e) || 0) + n;
			if (typeof n == "bigint") try {
				return BigInt(e) + n;
			} catch {
				return BigInt(0) + n;
			}
			throw TypeError(`Invalid term ${n}`);
		}
		if (t.remove !== void 0) {
			var r = t.remove;
			if (Dn(r)) return Dn(e) ? e.filter(function(e) {
				return !r.includes(e);
			}).sort() : [];
			if (typeof r == "number") return Number(e) - r;
			if (typeof r == "bigint") try {
				return BigInt(e) - r;
			} catch {
				return BigInt(0) - r;
			}
			throw TypeError(`Invalid subtrahend ${r}`);
		}
		var i = t.replacePrefix?.[0];
		return i && typeof e == "string" && e.startsWith(i) ? t.replacePrefix[1] + e.substring(i.length) : e;
	}, e;
}();
function $i(e, t) {
	for (var n = En(t), r = n.length, i = !1, a = 0; a < r; ++a) {
		var o = n[a], s = t[o], c = Wn(e, o);
		s instanceof Qi ? (Gn(e, o, s.execute(c)), i = !0) : c !== s && (Gn(e, o, s), i = !0);
	}
	return i;
}
var ea = function() {
	function e() {}
	return e.prototype._trans = function(e, t, n) {
		var r = this._tx || L.trans, i = this.name, a = Mr && typeof console < "u" && console.createTask && console.createTask(`Dexie: ${e === "readonly" ? "read" : "write"} ${this.name}`);
		function o(e, n, r) {
			if (!r.schema[i]) throw new I.NotFound("Table " + i + " not part of transaction");
			return t(r.idbtrans, r);
		}
		var s = ci();
		try {
			var c = r && r.db._novip === this.db._novip ? r === L.trans ? r._promise(e, o, n) : Si(function() {
				return r._promise(e, o, n);
			}, {
				trans: r,
				transless: L.transless || L
			}) : Ni(this.db, e, [this.name], o);
			return a && (c._consoleTask = a, c = c.catch(function(e) {
				return console.trace(e), z(e);
			})), c;
		} finally {
			s && li();
		}
	}, e.prototype.get = function(e, t) {
		var n = this;
		return e && e.constructor === Object ? this.where(e).first(t) : e == null ? z(new I.Type("Invalid argument to Table.get()")) : this._trans("readonly", function(t) {
			return n.core.get({
				trans: t,
				key: e
			}).then(function(e) {
				return n.hook.reading.fire(e);
			});
		}).then(t);
	}, e.prototype.where = function(e) {
		if (typeof e == "string") return new this.db.WhereClause(this, e);
		if (Dn(e)) return new this.db.WhereClause(this, `[${e.join("+")}]`);
		var t = En(e);
		if (t.length === 1) return this.where(t[0]).equals(e[t[0]]);
		var n = this.schema.indexes.concat(this.schema.primKey).filter(function(e) {
			if (e.compound && t.every(function(t) {
				return e.keyPath.indexOf(t) >= 0;
			})) {
				for (var n = 0; n < t.length; ++n) if (t.indexOf(e.keyPath[n]) === -1) return !1;
				return !0;
			}
			return !1;
		}).sort(function(e, t) {
			return e.keyPath.length - t.keyPath.length;
		})[0];
		if (n && this.db._maxKey !== Fi) {
			var r = n.keyPath.slice(0, t.length);
			return this.where(r).equals(r.map(function(t) {
				return e[t];
			}));
		}
		!n && Mr && console.warn(`The query ${JSON.stringify(e)} on ${this.name} would benefit from a compound index [${t.join("+")}]`);
		var i = this.schema.idxByName;
		function a(e, t) {
			return B(e, t) === 0;
		}
		var o = t.reduce(function(t, n) {
			var r = t[0], o = t[1], s = i[n], c = e[n];
			return [r || s, r || !s ? Ui(o, s && s.multi ? function(e) {
				var t = Wn(e, n);
				return Dn(t) && t.some(function(e) {
					return a(c, e);
				});
			} : function(e) {
				return a(c, Wn(e, n));
			}) : o];
		}, [null, null]), s = o[0], c = o[1];
		return s ? this.where(s.name).equals(e[s.keyPath]).filter(c) : n ? this.filter(c) : this.where(t).equals("");
	}, e.prototype.filter = function(e) {
		return this.toCollection().and(e);
	}, e.prototype.count = function(e) {
		return this.toCollection().count(e);
	}, e.prototype.offset = function(e) {
		return this.toCollection().offset(e);
	}, e.prototype.limit = function(e) {
		return this.toCollection().limit(e);
	}, e.prototype.each = function(e) {
		return this.toCollection().each(e);
	}, e.prototype.toArray = function(e) {
		return this.toCollection().toArray(e);
	}, e.prototype.toCollection = function() {
		return new this.db.Collection(new this.db.WhereClause(this));
	}, e.prototype.orderBy = function(e) {
		return new this.db.Collection(new this.db.WhereClause(this, Dn(e) ? `[${e.join("+")}]` : e));
	}, e.prototype.reverse = function() {
		return this.toCollection().reverse();
	}, e.prototype.mapToClass = function(e) {
		var t = this, n = t.db, r = t.name;
		this.schema.mappedClass = e, e.prototype instanceof Ki && (e = function(e) {
			Cn(t, e);
			function t() {
				return e !== null && e.apply(this, arguments) || this;
			}
			return Object.defineProperty(t.prototype, "db", {
				get: function() {
					return n;
				},
				enumerable: !1,
				configurable: !0
			}), t.prototype.table = function() {
				return r;
			}, t;
		}(e));
		for (var i = /* @__PURE__ */ new Set(), a = e.prototype; a; a = kn(a)) Object.getOwnPropertyNames(a).forEach(function(e) {
			return i.add(e);
		});
		var o = function(t) {
			if (!t) return t;
			var n = Object.create(e.prototype);
			for (var r in t) if (!i.has(r)) try {
				n[r] = t[r];
			} catch {}
			return n;
		};
		return this.schema.readHook && this.hook.reading.unsubscribe(this.schema.readHook), this.schema.readHook = o, this.hook("reading", o), e;
	}, e.prototype.defineClass = function() {
		function e(e) {
			On(this, e);
		}
		return this.mapToClass(e);
	}, e.prototype.add = function(e, t) {
		var n = this, r = this.schema.primKey, i = r.auto, a = r.keyPath, o = e;
		return a && i && (o = Gi(a)(e)), this._trans("readwrite", function(e) {
			return n.core.mutate({
				trans: e,
				type: "add",
				keys: t == null ? null : [t],
				values: [o]
			});
		}).then(function(e) {
			return e.numFailures ? R.reject(e.failures[0]) : e.lastResult;
		}).then(function(t) {
			if (a) try {
				Gn(e, a, t);
			} catch {}
			return t;
		});
	}, e.prototype.upsert = function(e, t) {
		var n = this, r = this.schema.primKey.keyPath;
		return this._trans("readwrite", function(i) {
			return n.core.get({
				trans: i,
				key: e
			}).then(function(a) {
				var o = a ?? {};
				return $i(o, t), r && Gn(o, r, e), n.core.mutate({
					trans: i,
					type: "put",
					values: [o],
					keys: [e],
					upsert: !0,
					updates: {
						keys: [e],
						changeSpecs: [t]
					}
				}).then(function(e) {
					return e.numFailures ? R.reject(e.failures[0]) : !!a;
				});
			});
		});
	}, e.prototype.update = function(e, t) {
		if (typeof e == "object" && !Dn(e)) {
			var n = Wn(e, this.schema.primKey.keyPath);
			return n === void 0 ? z(new I.InvalidArgument("Given object does not contain its primary key")) : this.where(":id").equals(n).modify(t);
		}
		return this.where(":id").equals(e).modify(t);
	}, e.prototype.put = function(e, t) {
		var n = this, r = this.schema.primKey, i = r.auto, a = r.keyPath, o = e;
		return a && i && (o = Gi(a)(e)), this._trans("readwrite", function(e) {
			return n.core.mutate({
				trans: e,
				type: "put",
				values: [o],
				keys: t == null ? null : [t]
			});
		}).then(function(e) {
			return e.numFailures ? R.reject(e.failures[0]) : e.lastResult;
		}).then(function(t) {
			if (a) try {
				Gn(e, a, t);
			} catch {}
			return t;
		});
	}, e.prototype.delete = function(e) {
		var t = this;
		return this._trans("readwrite", function(n) {
			return t.core.mutate({
				trans: n,
				type: "delete",
				keys: [e]
			}).then(function(n) {
				return Zi(t, [e], n);
			}).then(function(e) {
				return e.numFailures ? R.reject(e.failures[0]) : void 0;
			});
		});
	}, e.prototype.clear = function() {
		var e = this;
		return this._trans("readwrite", function(t) {
			return e.core.mutate({
				trans: t,
				type: "deleteRange",
				range: Wi
			}).then(function(t) {
				return Zi(e, null, t);
			});
		}).then(function(e) {
			return e.numFailures ? R.reject(e.failures[0]) : void 0;
		});
	}, e.prototype.bulkGet = function(e) {
		var t = this;
		return this._trans("readonly", function(n) {
			return t.core.getMany({
				keys: e,
				trans: n
			}).then(function(e) {
				return e.map(function(e) {
					return t.hook.reading.fire(e);
				});
			});
		});
	}, e.prototype.bulkAdd = function(e, t, n) {
		var r = this, i = Array.isArray(t) ? t : void 0;
		n ||= i ? void 0 : t;
		var a = n ? n.allKeys : void 0;
		return this._trans("readwrite", function(t) {
			var n = r.schema.primKey, o = n.auto, s = n.keyPath;
			if (s && i) throw new I.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");
			if (i && i.length !== e.length) throw new I.InvalidArgument("Arguments objects and keys must have the same length");
			var c = e.length, l = s && o ? e.map(Gi(s)) : e;
			return r.core.mutate({
				trans: t,
				type: "add",
				keys: i,
				values: l,
				wantResults: a
			}).then(function(e) {
				var t = e.numFailures, n = e.results, i = e.lastResult, o = e.failures, s = a ? n : i;
				if (t === 0) return s;
				throw new _r(`${r.name}.bulkAdd(): ${t} of ${c} operations failed`, o);
			});
		});
	}, e.prototype.bulkPut = function(e, t, n) {
		var r = this, i = Array.isArray(t) ? t : void 0;
		n ||= i ? void 0 : t;
		var a = n ? n.allKeys : void 0;
		return this._trans("readwrite", function(t) {
			var n = r.schema.primKey, o = n.auto, s = n.keyPath;
			if (s && i) throw new I.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");
			if (i && i.length !== e.length) throw new I.InvalidArgument("Arguments objects and keys must have the same length");
			var c = e.length, l = s && o ? e.map(Gi(s)) : e;
			return r.core.mutate({
				trans: t,
				type: "put",
				keys: i,
				values: l,
				wantResults: a
			}).then(function(e) {
				var t = e.numFailures, n = e.results, i = e.lastResult, o = e.failures, s = a ? n : i;
				if (t === 0) return s;
				throw new _r(`${r.name}.bulkPut(): ${t} of ${c} operations failed`, o);
			});
		});
	}, e.prototype.bulkUpdate = function(e) {
		var t = this, n = e.map(function(e) {
			return e.key;
		}), r = e.map(function(e) {
			return e.changes;
		}), i = [];
		return this._trans("readwrite", function(a) {
			var o = t.core;
			return o.getMany({
				trans: a,
				keys: n,
				cache: "clone"
			}).then(function(s) {
				var c = o.schema.primaryKey, l = c.outbound, u = c.extractKey, d = [], f = [];
				e.forEach(function(e, t) {
					var n = e.key, r = e.changes, a = s[t];
					if (a) {
						for (var o = 0, c = Object.keys(r); o < c.length; o++) {
							var p = c[o];
							Gn(a, p, r[p]);
						}
						if (!l && B(u(a), n) !== 0) throw new I.Constraint("Cannot update primary key in bulkUpdate()");
						i.push(t), d.push(n), f.push(a);
					}
				});
				var p = d.length;
				return o.mutate({
					trans: a,
					type: "put",
					keys: d,
					values: f,
					updates: {
						keys: n,
						changeSpecs: r
					}
				}).then(function(e) {
					var n = e.numFailures, r = e.failures;
					if (n === 0) return p;
					for (var a = 0, o = Object.keys(r); a < o.length; a++) {
						var s = o[a], c = i[Number(s)];
						if (c != null) {
							var l = r[s];
							delete r[s], r[c] = l;
						}
					}
					throw new _r(`${t.name}.bulkUpdate(): ${n} of ${p} operations failed`, r);
				});
			});
		});
	}, e.prototype.bulkDelete = function(e) {
		var t = this, n = e.length;
		return this._trans("readwrite", function(n) {
			return t.core.mutate({
				trans: n,
				type: "delete",
				keys: e
			}).then(function(n) {
				return Zi(t, e, n);
			});
		}).then(function(e) {
			var r = e.numFailures, i = e.lastResult, a = e.failures;
			if (r === 0) return i;
			throw new _r(`${t.name}.bulkDelete(): ${r} of ${n} operations failed`, a);
		});
	}, e;
}();
function ta(e) {
	var t = {}, n = function(n, r) {
		if (r) {
			for (var i = arguments.length, a = Array(i - 1); --i;) a[i - 1] = arguments[i];
			return t[n].subscribe.apply(null, a), e;
		}
		if (typeof n == "string") return t[n];
	};
	n.addEventType = a;
	for (var r = 1, i = arguments.length; r < i; ++r) a(arguments[r]);
	return n;
	function a(e, r, i) {
		if (typeof e == "object") return o(e);
		r ||= Ar, i ||= Cr;
		var a = {
			subscribers: [],
			fire: i,
			subscribe: function(e) {
				a.subscribers.indexOf(e) === -1 && (a.subscribers.push(e), a.fire = r(a.fire, e));
			},
			unsubscribe: function(e) {
				a.subscribers = a.subscribers.filter(function(t) {
					return t !== e;
				}), a.fire = a.subscribers.reduce(r, i);
			}
		};
		return t[e] = n[e] = a, a;
	}
	function o(e) {
		En(e).forEach(function(t) {
			var n = e[t];
			if (Dn(n)) a(t, e[t][0], e[t][1]);
			else if (n === "asap") var r = a(t, wr, function() {
				for (var e = arguments.length, t = Array(e); e--;) t[e] = arguments[e];
				r.subscribers.forEach(function(e) {
					Hn(function() {
						e.apply(null, t);
					});
				});
			});
			else throw new I.InvalidArgument("Invalid event config");
		});
	}
}
function na(e, t) {
	return Fn(t).from({ prototype: e }), t;
}
function ra(e) {
	return na(ea.prototype, function(t, n, r) {
		this.db = e, this._tx = r, this.name = t, this.schema = n, this.hook = e._allTables[t] ? e._allTables[t].hook : ta(null, {
			creating: [Dr, Cr],
			reading: [Tr, wr],
			updating: [kr, Cr],
			deleting: [Or, Cr]
		});
	});
}
function V(e, t) {
	return !(e.filter || e.algorithm || e.or) && (t ? e.justLimit : !e.replayFilter);
}
function ia(e, t) {
	e.filter = Ui(e.filter, t);
}
function aa(e, t, n) {
	var r = e.replayFilter;
	e.replayFilter = r ? function() {
		return Ui(r(), t());
	} : t, e.justLimit = n && !r;
}
function oa(e, t) {
	e.isMatch = Ui(e.isMatch, t);
}
function sa(e, t) {
	if (e.isPrimKey) return t.primaryKey;
	var n = t.getIndexByKeyPath(e.index);
	if (!n) throw new I.Schema("KeyPath " + e.index + " on object store " + t.name + " is not indexed");
	return n;
}
function ca(e, t, n) {
	var r = sa(e, t.schema);
	return t.openCursor({
		trans: n,
		values: !e.keysOnly,
		reverse: e.dir === "prev",
		unique: !!e.unique,
		query: {
			index: r,
			range: e.range
		}
	});
}
function la(e, t, n, r) {
	var i = e.replayFilter ? Ui(e.filter, e.replayFilter()) : e.filter;
	if (e.or) {
		var a = {}, o = function(e, n, r) {
			if (!i || i(n, r, function(e) {
				return n.stop(e);
			}, function(e) {
				return n.fail(e);
			})) {
				var o = n.primaryKey, s = "" + o;
				s === "[object ArrayBuffer]" && (s = "" + new Uint8Array(o)), jn(a, s) || (a[s] = !0, t(e, n, r));
			}
		};
		return Promise.all([e.or._iterate(o, n), ua(ca(e, r, n), e.algorithm, o, !e.keysOnly && e.valueMapper)]);
	}
	return ua(ca(e, r, n), Ui(e.algorithm, i), t, !e.keysOnly && e.valueMapper);
}
function ua(e, t, n, r) {
	var i = hi(r ? function(e, t, i) {
		return n(r(e), t, i);
	} : n);
	return e.then(function(e) {
		if (e) return e.start(function() {
			var n = function() {
				return e.continue();
			};
			(!t || t(e, function(e) {
				return n = e;
			}, function(t) {
				e.stop(t), n = Cr;
			}, function(t) {
				e.fail(t), n = Cr;
			})) && i(e.value, e, function(e) {
				return n = e;
			}), n();
		});
	});
}
var da = function() {
	function e() {}
	return e.prototype._read = function(e, t) {
		var n = this._ctx;
		return n.error ? n.table._trans(null, z.bind(null, n.error)) : n.table._trans("readonly", e).then(t);
	}, e.prototype._write = function(e) {
		var t = this._ctx;
		return t.error ? t.table._trans(null, z.bind(null, t.error)) : t.table._trans("readwrite", e, "locked");
	}, e.prototype._addAlgorithm = function(e) {
		var t = this._ctx;
		t.algorithm = Ui(t.algorithm, e);
	}, e.prototype._iterate = function(e, t) {
		return la(this._ctx, e, t, this._ctx.table.core);
	}, e.prototype.clone = function(e) {
		var t = Object.create(this.constructor.prototype), n = Object.create(this._ctx);
		return e && On(n, e), t._ctx = n, t;
	}, e.prototype.raw = function() {
		return this._ctx.valueMapper = null, this;
	}, e.prototype.each = function(e) {
		var t = this._ctx;
		return this._read(function(n) {
			return la(t, e, n, t.table.core);
		});
	}, e.prototype.count = function(e) {
		var t = this;
		return this._read(function(e) {
			var n = t._ctx, r = n.table.core;
			if (V(n, !0)) return r.count({
				trans: e,
				query: {
					index: sa(n, r.schema),
					range: n.range
				}
			}).then(function(e) {
				return Math.min(e, n.limit);
			});
			var i = 0;
			return la(n, function() {
				return ++i, !1;
			}, e, r).then(function() {
				return i;
			});
		}).then(e);
	}, e.prototype.sortBy = function(e, t) {
		var n = e.split(".").reverse(), r = n[0], i = n.length - 1;
		function a(e, t) {
			return t ? a(e[n[t]], t - 1) : e[r];
		}
		var o = this._ctx.dir === "next" ? 1 : -1;
		function s(e, t) {
			return B(a(e, i), a(t, i)) * o;
		}
		return this.toArray(function(e) {
			return e.slice().sort(s);
		}).then(t);
	}, e.prototype.toArray = function(e) {
		var t = this;
		return this._read(function(e) {
			var n = t._ctx;
			if (V(n, !0) && n.limit > 0) {
				var r = n.valueMapper, i = sa(n, n.table.core.schema);
				return n.table.core.query({
					trans: e,
					limit: n.limit,
					values: !0,
					direction: n.dir === "prev" ? "prev" : void 0,
					query: {
						index: i,
						range: n.range
					}
				}).then(function(e) {
					var t = e.result;
					return r ? t.map(r) : t;
				});
			}
			var a = [];
			return la(n, function(e) {
				return a.push(e);
			}, e, n.table.core).then(function() {
				return a;
			});
		}, e);
	}, e.prototype.offset = function(e) {
		var t = this._ctx;
		return e <= 0 || (t.offset += e, V(t) ? aa(t, function() {
			var t = e;
			return function(e, n) {
				return t === 0 ? !0 : t === 1 ? (--t, !1) : (n(function() {
					e.advance(t), t = 0;
				}), !1);
			};
		}) : aa(t, function() {
			var t = e;
			return function() {
				return --t < 0;
			};
		})), this;
	}, e.prototype.limit = function(e) {
		return this._ctx.limit = Math.min(this._ctx.limit, e), aa(this._ctx, function() {
			var t = e;
			return function(e, n, r) {
				return --t <= 0 && n(r), t >= 0;
			};
		}, !0), this;
	}, e.prototype.until = function(e, t) {
		return ia(this._ctx, function(n, r, i) {
			return !e(n.value) || (r(i), t);
		}), this;
	}, e.prototype.first = function(e) {
		return this.limit(1).toArray(function(e) {
			return e[0];
		}).then(e);
	}, e.prototype.last = function(e) {
		return this.reverse().first(e);
	}, e.prototype.filter = function(e) {
		return ia(this._ctx, function(t) {
			return e(t.value);
		}), oa(this._ctx, e), this;
	}, e.prototype.and = function(e) {
		return this.filter(e);
	}, e.prototype.or = function(e) {
		return new this.db.WhereClause(this._ctx.table, e, this);
	}, e.prototype.reverse = function() {
		return this._ctx.dir = this._ctx.dir === "prev" ? "next" : "prev", this._ondirectionchange && this._ondirectionchange(this._ctx.dir), this;
	}, e.prototype.desc = function() {
		return this.reverse();
	}, e.prototype.eachKey = function(e) {
		var t = this._ctx;
		return t.keysOnly = !t.isMatch, this.each(function(t, n) {
			e(n.key, n);
		});
	}, e.prototype.eachUniqueKey = function(e) {
		return this._ctx.unique = "unique", this.eachKey(e);
	}, e.prototype.eachPrimaryKey = function(e) {
		var t = this._ctx;
		return t.keysOnly = !t.isMatch, this.each(function(t, n) {
			e(n.primaryKey, n);
		});
	}, e.prototype.keys = function(e) {
		var t = this._ctx;
		t.keysOnly = !t.isMatch;
		var n = [];
		return this.each(function(e, t) {
			n.push(t.key);
		}).then(function() {
			return n;
		}).then(e);
	}, e.prototype.primaryKeys = function(e) {
		var t = this._ctx;
		if (V(t, !0) && t.limit > 0) return this._read(function(e) {
			var n = sa(t, t.table.core.schema);
			return t.table.core.query({
				trans: e,
				values: !1,
				limit: t.limit,
				direction: t.dir === "prev" ? "prev" : void 0,
				query: {
					index: n,
					range: t.range
				}
			});
		}).then(function(e) {
			return e.result;
		}).then(e);
		t.keysOnly = !t.isMatch;
		var n = [];
		return this.each(function(e, t) {
			n.push(t.primaryKey);
		}).then(function() {
			return n;
		}).then(e);
	}, e.prototype.uniqueKeys = function(e) {
		return this._ctx.unique = "unique", this.keys(e);
	}, e.prototype.firstKey = function(e) {
		return this.limit(1).keys(function(e) {
			return e[0];
		}).then(e);
	}, e.prototype.lastKey = function(e) {
		return this.reverse().firstKey(e);
	}, e.prototype.distinct = function() {
		var e = this._ctx, t = e.index && e.table.schema.idxByName[e.index];
		if (!t || !t.multi) return this;
		var n = {};
		return ia(this._ctx, function(e) {
			var t = e.primaryKey.toString(), r = jn(n, t);
			return n[t] = !0, !r;
		}), this;
	}, e.prototype.modify = function(e) {
		var t = this, n = this._ctx;
		return this._write(function(r) {
			var i = typeof e == "function" ? e : function(t) {
				return $i(t, e);
			}, a = n.table.core, o = a.schema.primaryKey, s = o.outbound, c = o.extractKey, l = 200, u = t.db._options.modifyChunkSize;
			u && (l = typeof u == "object" ? u[a.name] || u["*"] || 200 : u);
			var d = [], f = 0, p = [], m = function(e, t) {
				var n = t.failures, r = t.numFailures;
				f += e - r;
				for (var i = 0, a = En(n); i < a.length; i++) {
					var o = a[i];
					d.push(n[o]);
				}
			}, h = e === fa;
			return t.clone().primaryKeys().then(function(t) {
				var o = V(n) && n.limit === Infinity && (typeof e != "function" || h) && {
					index: n.index,
					range: n.range
				}, u = function(d) {
					var f = Math.min(l, t.length - d), p = t.slice(d, d + f);
					return (h ? Promise.resolve([]) : a.getMany({
						trans: r,
						keys: p,
						cache: "immutable"
					})).then(function(g) {
						var _ = [], v = [], y = s ? [] : null, b = h ? p : [];
						if (!h) for (var x = 0; x < f; ++x) {
							var S = g[x], C = {
								value: er(S),
								primKey: t[d + x]
							};
							i.call(C, C.value, C) !== !1 && (C.value == null ? b.push(t[d + x]) : !s && B(c(S), c(C.value)) !== 0 ? (b.push(t[d + x]), _.push(C.value)) : (v.push(C.value), s && y.push(t[d + x])));
						}
						return Promise.resolve(_.length > 0 && a.mutate({
							trans: r,
							type: "add",
							values: _
						}).then(function(e) {
							for (var t in e.failures) b.splice(parseInt(t), 1);
							m(_.length, e);
						})).then(function() {
							return (v.length > 0 || o && typeof e == "object") && a.mutate({
								trans: r,
								type: "put",
								keys: y,
								values: v,
								criteria: o,
								changeSpec: typeof e != "function" && e,
								isAdditionalChunk: d > 0
							}).then(function(e) {
								return m(v.length, e);
							});
						}).then(function() {
							return (b.length > 0 || o && h) && a.mutate({
								trans: r,
								type: "delete",
								keys: b,
								criteria: o,
								isAdditionalChunk: d > 0
							}).then(function(e) {
								return Zi(n.table, b, e);
							}).then(function(e) {
								return m(b.length, e);
							});
						}).then(function() {
							return t.length > d + f && u(d + l);
						});
					});
				};
				return u(0).then(function() {
					if (d.length > 0) throw new gr("Error modifying one or more objects", d, f, p);
					return t.length;
				});
			});
		});
	}, e.prototype.delete = function() {
		var e = this._ctx, t = e.range;
		return V(e) && !e.table.schema.yProps && (e.isPrimKey || t.type === 3) ? this._write(function(n) {
			var r = e.table.core.schema.primaryKey, i = t;
			return e.table.core.count({
				trans: n,
				query: {
					index: r,
					range: i
				}
			}).then(function(t) {
				return e.table.core.mutate({
					trans: n,
					type: "deleteRange",
					range: i
				}).then(function(e) {
					var n = e.failures, r = e.numFailures;
					if (r) throw new gr("Could not delete some values", Object.keys(n).map(function(e) {
						return n[e];
					}), t - r);
					return t - r;
				});
			});
		}) : this.modify(fa);
	}, e;
}(), fa = function(e, t) {
	return t.value = null;
};
function pa(e) {
	return na(da.prototype, function(t, n) {
		this.db = e;
		var r = Wi, i = null;
		if (n) try {
			r = n();
		} catch (e) {
			i = e;
		}
		var a = t._ctx, o = a.table, s = o.hook.reading.fire;
		this._ctx = {
			table: o,
			index: a.index,
			isPrimKey: !a.index || o.schema.primKey.keyPath && a.index === o.schema.primKey.name,
			range: r,
			keysOnly: !1,
			dir: "next",
			unique: "",
			algorithm: null,
			filter: null,
			replayFilter: null,
			justLimit: !0,
			isMatch: null,
			offset: 0,
			limit: Infinity,
			error: i,
			or: a.or,
			valueMapper: s === wr ? null : s
		};
	});
}
function ma(e, t) {
	return e < t ? -1 : e === t ? 0 : 1;
}
function ha(e, t) {
	return e > t ? -1 : e === t ? 0 : 1;
}
function ga(e, t, n) {
	var r = e instanceof wa ? new e.Collection(e) : e;
	return r._ctx.error = n ? new n(t) : TypeError(t), r;
}
function _a(e) {
	var t = new e.Collection(e, function() {
		return Ca("");
	});
	return t._addAlgorithm(function() {
		return !1;
	}), t;
}
function va(e) {
	return e === "next" ? function(e) {
		return e.toUpperCase();
	} : function(e) {
		return e.toLowerCase();
	};
}
function ya(e) {
	return e === "next" ? function(e) {
		return e.toLowerCase();
	} : function(e) {
		return e.toUpperCase();
	};
}
function ba(e, t, n, r, i, a) {
	for (var o = Math.min(e.length, r.length), s = -1, c = 0; c < o; ++c) {
		var l = t[c];
		if (l !== r[c]) return i(e[c], n[c]) < 0 ? e.substr(0, c) + n[c] + n.substr(c + 1) : i(e[c], r[c]) < 0 ? e.substr(0, c) + r[c] + n.substr(c + 1) : s >= 0 ? e.substr(0, s) + t[s] + n.substr(s + 1) : null;
		i(e[c], l) < 0 && (s = c);
	}
	return o < r.length && a === "next" ? e + n.substr(e.length) : o < e.length && a === "prev" ? e.substr(0, n.length) : s < 0 ? null : e.substr(0, s) + r[s] + n.substr(s + 1);
}
function xa(e, t, n, r) {
	var i, a, o, s, c, l, u, d = n.length;
	if (!n.every(function(e) {
		return typeof e == "string";
	})) return ga(e, Ri);
	function f(e) {
		i = va(e), a = ya(e), o = e === "next" ? ma : ha;
		var t = n.map(function(e) {
			return {
				lower: a(e),
				upper: i(e)
			};
		}).sort(function(e, t) {
			return o(e.lower, t.lower);
		});
		s = t.map(function(e) {
			return e.upper;
		}), c = t.map(function(e) {
			return e.lower;
		}), l = e, u = e === "next" ? "" : r;
	}
	f("next");
	var p = new e.Collection(e, function() {
		return Sa(s[0], c[d - 1] + r);
	});
	p._ondirectionchange = function(e) {
		f(e);
	};
	var m = 0;
	return p._addAlgorithm(function(e, n, r) {
		var i = e.key;
		if (typeof i != "string") return !1;
		var f = a(i);
		if (t(f, c, m)) return !0;
		for (var p = null, h = m; h < d; ++h) {
			var g = ba(i, f, s[h], c[h], o, l);
			g === null && p === null ? m = h + 1 : (p === null || o(p, g) > 0) && (p = g);
		}
		return n(p === null ? r : function() {
			e.continue(p + u);
		}), !1;
	}), p;
}
function Sa(e, t, n, r) {
	return {
		type: 2,
		lower: e,
		upper: t,
		lowerOpen: n,
		upperOpen: r
	};
}
function Ca(e) {
	return {
		type: 1,
		lower: e,
		upper: e
	};
}
var wa = function() {
	function e() {}
	return Object.defineProperty(e.prototype, "Collection", {
		get: function() {
			return this._ctx.table.db.Collection;
		},
		enumerable: !1,
		configurable: !0
	}), e.prototype.between = function(e, t, n, r) {
		n = n !== !1, r = r === !0;
		try {
			return this._cmp(e, t) > 0 || this._cmp(e, t) === 0 && (n || r) && !(n && r) ? _a(this) : new this.Collection(this, function() {
				return Sa(e, t, !n, !r);
			});
		} catch {
			return ga(this, Li);
		}
	}, e.prototype.equals = function(e) {
		return e == null ? ga(this, Li) : new this.Collection(this, function() {
			return Ca(e);
		});
	}, e.prototype.above = function(e) {
		return e == null ? ga(this, Li) : new this.Collection(this, function() {
			return Sa(e, void 0, !0);
		});
	}, e.prototype.aboveOrEqual = function(e) {
		return e == null ? ga(this, Li) : new this.Collection(this, function() {
			return Sa(e, void 0, !1);
		});
	}, e.prototype.below = function(e) {
		return e == null ? ga(this, Li) : new this.Collection(this, function() {
			return Sa(void 0, e, !1, !0);
		});
	}, e.prototype.belowOrEqual = function(e) {
		return e == null ? ga(this, Li) : new this.Collection(this, function() {
			return Sa(void 0, e);
		});
	}, e.prototype.startsWith = function(e) {
		return typeof e == "string" ? this.between(e, e + Fi, !0, !0) : ga(this, Ri);
	}, e.prototype.startsWithIgnoreCase = function(e) {
		return e === "" ? this.startsWith(e) : xa(this, function(e, t) {
			return e.indexOf(t[0]) === 0;
		}, [e], Fi);
	}, e.prototype.equalsIgnoreCase = function(e) {
		return xa(this, function(e, t) {
			return e === t[0];
		}, [e], "");
	}, e.prototype.anyOfIgnoreCase = function() {
		var e = cr.apply(sr, arguments);
		return e.length === 0 ? _a(this) : xa(this, function(e, t) {
			return t.indexOf(e) !== -1;
		}, e, "");
	}, e.prototype.startsWithAnyOfIgnoreCase = function() {
		var e = cr.apply(sr, arguments);
		return e.length === 0 ? _a(this) : xa(this, function(e, t) {
			return t.some(function(t) {
				return e.indexOf(t) === 0;
			});
		}, e, Fi);
	}, e.prototype.anyOf = function() {
		var e = this, t = cr.apply(sr, arguments), n = this._cmp;
		try {
			t.sort(n);
		} catch {
			return ga(this, Li);
		}
		if (t.length === 0) return _a(this);
		var r = new this.Collection(this, function() {
			return Sa(t[0], t[t.length - 1]);
		});
		r._ondirectionchange = function(r) {
			n = r === "next" ? e._ascending : e._descending, t.sort(n);
		};
		var i = 0;
		return r._addAlgorithm(function(e, r, a) {
			for (var o = e.key; n(o, t[i]) > 0;) if (++i, i === t.length) return r(a), !1;
			return n(o, t[i]) === 0 || (r(function() {
				e.continue(t[i]);
			}), !1);
		}), r;
	}, e.prototype.notEqual = function(e) {
		return this.inAnyRange([[Ii, e], [e, this.db._maxKey]], {
			includeLowers: !1,
			includeUppers: !1
		});
	}, e.prototype.noneOf = function() {
		var e = cr.apply(sr, arguments);
		if (e.length === 0) return new this.Collection(this);
		try {
			e.sort(this._ascending);
		} catch {
			return ga(this, Li);
		}
		var t = e.reduce(function(e, t) {
			return e ? e.concat([[e[e.length - 1][1], t]]) : [[Ii, t]];
		}, null);
		return t.push([e[e.length - 1], this.db._maxKey]), this.inAnyRange(t, {
			includeLowers: !1,
			includeUppers: !1
		});
	}, e.prototype.inAnyRange = function(e, t) {
		var n = this, r = this._cmp, i = this._ascending, a = this._descending, o = this._min, s = this._max;
		if (e.length === 0) return _a(this);
		if (!e.every(function(e) {
			return e[0] !== void 0 && e[1] !== void 0 && i(e[0], e[1]) <= 0;
		})) return ga(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", I.InvalidArgument);
		var c = !t || t.includeLowers !== !1, l = t && t.includeUppers === !0;
		function u(e, t) {
			for (var n = 0, i = e.length; n < i; ++n) {
				var a = e[n];
				if (r(t[0], a[1]) < 0 && r(t[1], a[0]) > 0) {
					a[0] = o(a[0], t[0]), a[1] = s(a[1], t[1]);
					break;
				}
			}
			return n === i && e.push(t), e;
		}
		var d = i;
		function f(e, t) {
			return d(e[0], t[0]);
		}
		var p;
		try {
			p = e.reduce(u, []), p.sort(f);
		} catch {
			return ga(this, Li);
		}
		var m = 0, h = l ? function(e) {
			return i(e, p[m][1]) > 0;
		} : function(e) {
			return i(e, p[m][1]) >= 0;
		}, g = c ? function(e) {
			return a(e, p[m][0]) > 0;
		} : function(e) {
			return a(e, p[m][0]) >= 0;
		};
		function _(e) {
			return !h(e) && !g(e);
		}
		var v = h, y = new this.Collection(this, function() {
			return Sa(p[0][0], p[p.length - 1][1], !c, !l);
		});
		return y._ondirectionchange = function(e) {
			e === "next" ? (v = h, d = i) : (v = g, d = a), p.sort(f);
		}, y._addAlgorithm(function(e, t, r) {
			for (var a = e.key; v(a);) if (++m, m === p.length) return t(r), !1;
			return _(a) ? !0 : (n._cmp(a, p[m][1]) === 0 || n._cmp(a, p[m][0]) === 0 || t(function() {
				d === i ? e.continue(p[m][0]) : e.continue(p[m][1]);
			}), !1);
		}), y;
	}, e.prototype.startsWithAnyOf = function() {
		var e = cr.apply(sr, arguments);
		return e.every(function(e) {
			return typeof e == "string";
		}) ? e.length === 0 ? _a(this) : this.inAnyRange(e.map(function(e) {
			return [e, e + Fi];
		})) : ga(this, "startsWithAnyOf() only works with strings");
	}, e;
}();
function Ta(e) {
	return na(wa.prototype, function(t, n, r) {
		if (this.db = e, this._ctx = {
			table: t,
			index: n === ":id" ? null : n,
			or: r
		}, this._cmp = this._ascending = B, this._descending = function(e, t) {
			return B(t, e);
		}, this._max = function(e, t) {
			return B(e, t) > 0 ? e : t;
		}, this._min = function(e, t) {
			return B(e, t) < 0 ? e : t;
		}, this._IDBKeyRange = e._deps.IDBKeyRange, !this._IDBKeyRange) throw new I.MissingAPI();
	});
}
function Ea(e) {
	return hi(function(t) {
		return Da(t), e(t.target.error), !1;
	});
}
function Da(e) {
	e.stopPropagation && e.stopPropagation(), e.preventDefault && e.preventDefault();
}
var Oa = "storagemutated", ka = "x-storagemutated-1", Aa = ta(null, Oa), ja = function() {
	function e() {}
	return e.prototype._lock = function() {
		return Vn(!L.global), ++this._reculock, this._reculock === 1 && !L.global && (L.lockOwnerFor = this), this;
	}, e.prototype._unlock = function() {
		if (Vn(!L.global), --this._reculock === 0) for (L.global || (L.lockOwnerFor = null); this._blockedFuncs.length > 0 && !this._locked();) {
			var e = this._blockedFuncs.shift();
			try {
				Ai(e[1], e[0]);
			} catch {}
		}
		return this;
	}, e.prototype._locked = function() {
		return this._reculock && L.lockOwnerFor !== this;
	}, e.prototype.create = function(e) {
		var t = this;
		if (!this.mode) return this;
		var n = this.db.idbdb, r = this.db._state.dbOpenError;
		if (Vn(!this.idbtrans), !e && !n) switch (r && r.name) {
			case "DatabaseClosedError": throw new I.DatabaseClosed(r);
			case "MissingAPIError": throw new I.MissingAPI(r.message, r);
			default: throw new I.OpenFailed(r);
		}
		if (!this.active) throw new I.TransactionInactive();
		return Vn(this._completion._state === null), e = this.idbtrans = e || (this.db.core ? this.db.core.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability }) : n.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability })), e.onerror = hi(function(n) {
			Da(n), t._reject(e.error);
		}), e.onabort = hi(function(n) {
			Da(n), t.active && t._reject(new I.Abort(e.error)), t.active = !1, t.on("abort").fire(n);
		}), e.oncomplete = hi(function() {
			t.active = !1, t._resolve(), "mutatedParts" in e && Aa.storagemutated.fire(e.mutatedParts);
		}), this;
	}, e.prototype._promise = function(e, t, n) {
		var r = this;
		if (e === "readwrite" && this.mode !== "readwrite") return z(new I.ReadOnly("Transaction is readonly"));
		if (!this.active) return z(new I.TransactionInactive());
		if (this._locked()) return new R(function(i, a) {
			r._blockedFuncs.push([function() {
				r._promise(e, t, n).then(i, a);
			}, L]);
		});
		if (n) return Si(function() {
			var e = new R(function(e, n) {
				r._lock();
				var i = t(e, n, r);
				i && i.then && i.then(e, n);
			});
			return e.finally(function() {
				return r._unlock();
			}), e._lib = !0, e;
		});
		var i = new R(function(e, n) {
			var i = t(e, n, r);
			i && i.then && i.then(e, n);
		});
		return i._lib = !0, i;
	}, e.prototype._root = function() {
		return this.parent ? this.parent._root() : this;
	}, e.prototype.waitFor = function(e) {
		var t = this._root(), n = R.resolve(e);
		if (t._waitingFor) t._waitingFor = t._waitingFor.then(function() {
			return n;
		});
		else {
			t._waitingFor = n, t._waitingQueue = [];
			var r = t.idbtrans.objectStore(t.storeNames[0]);
			(function e() {
				for (++t._spinCount; t._waitingQueue.length;) t._waitingQueue.shift()();
				t._waitingFor && (r.get(-Infinity).onsuccess = e);
			})();
		}
		var i = t._waitingFor;
		return new R(function(e, r) {
			n.then(function(n) {
				return t._waitingQueue.push(hi(e.bind(null, n)));
			}, function(e) {
				return t._waitingQueue.push(hi(r.bind(null, e)));
			}).finally(function() {
				t._waitingFor === i && (t._waitingFor = null);
			});
		});
	}, e.prototype.abort = function() {
		this.active && (this.active = !1, this.idbtrans && this.idbtrans.abort(), this._reject(new I.Abort()));
	}, e.prototype.table = function(e) {
		var t = this._memoizedTables ||= {};
		if (jn(t, e)) return t[e];
		var n = this.schema[e];
		if (!n) throw new I.NotFound("Table " + e + " not part of transaction");
		var r = new this.db.Table(e, n, this);
		return r.core = this.db.core.table(e), t[e] = r, r;
	}, e;
}();
function Ma(e) {
	return na(ja.prototype, function(t, n, r, i, a) {
		var o = this;
		t !== "readonly" && n.forEach(function(e) {
			var t = r[e]?.yProps;
			t && (n = n.concat(t.map(function(e) {
				return e.updatesTable;
			})));
		}), this.db = e, this.mode = t, this.storeNames = n, this.schema = r, this.chromeTransactionDurability = i, this.idbtrans = null, this.on = ta(this, "complete", "error", "abort"), this.parent = a || null, this.active = !0, this._reculock = 0, this._blockedFuncs = [], this._resolve = null, this._reject = null, this._waitingFor = null, this._waitingQueue = null, this._spinCount = 0, this._completion = new R(function(e, t) {
			o._resolve = e, o._reject = t;
		}), this._completion.then(function() {
			o.active = !1, o.on.complete.fire();
		}, function(e) {
			var t = o.active;
			return o.active = !1, o.on.error.fire(e), o.parent ? o.parent._reject(e) : t && o.idbtrans && o.idbtrans.abort(), z(e);
		});
	});
}
function Na(e, t, n, r, i, a, o, s) {
	return {
		name: e,
		keyPath: t,
		unique: n,
		multi: r,
		auto: i,
		compound: a,
		src: (n && !o ? "&" : "") + (r ? "*" : "") + (i ? "++" : "") + Pa(t),
		type: s
	};
}
function Pa(e) {
	return typeof e == "string" ? e : e ? "[" + [].join.call(e, "+") + "]" : "";
}
function Fa(e, t, n) {
	return {
		name: e,
		primKey: t,
		indexes: n,
		mappedClass: null,
		idxByName: Un(n, function(e) {
			return [e.name, e];
		})
	};
}
function Ia(e) {
	return e.length === 1 ? e[0] : e;
}
var La = function(e) {
	try {
		return e.only([[]]), La = function() {
			return [[]];
		}, [[]];
	} catch {
		return La = function() {
			return Fi;
		}, Fi;
	}
};
function Ra(e) {
	return e == null ? function() {} : typeof e == "string" ? za(e) : function(t) {
		return Wn(t, e);
	};
}
function za(e) {
	return e.split(".").length === 1 ? function(t) {
		return t[e];
	} : function(t) {
		return Wn(t, e);
	};
}
function Ba(e) {
	return [].slice.call(e);
}
var Va = 0;
function Ha(e) {
	return e == null ? ":id" : typeof e == "string" ? e : `[${e.join("+")}]`;
}
function Ua(e, t, n) {
	function r(e, t) {
		var n = Ba(e.objectStoreNames), r = n.length > 0 ? t.objectStore(n[0]) : {};
		return {
			schema: {
				name: e.name,
				tables: n.map(function(e) {
					return t.objectStore(e);
				}).map(function(e) {
					var t = e.keyPath, n = e.autoIncrement, r = Dn(t), i = t == null, a = {}, o = {
						name: e.name,
						primaryKey: {
							name: null,
							isPrimaryKey: !0,
							outbound: i,
							compound: r,
							keyPath: t,
							autoIncrement: n,
							unique: !0,
							extractKey: Ra(t)
						},
						indexes: Ba(e.indexNames).map(function(t) {
							return e.index(t);
						}).map(function(e) {
							var t = e.name, n = e.unique, r = e.multiEntry, i = e.keyPath, o = {
								name: t,
								compound: Dn(i),
								keyPath: i,
								unique: n,
								multiEntry: r,
								extractKey: Ra(i)
							};
							return a[Ha(i)] = o, o;
						}),
						getIndexByKeyPath: function(e) {
							return a[Ha(e)];
						}
					};
					return a[":id"] = o.primaryKey, t != null && (a[Ha(t)] = o.primaryKey), o;
				})
			},
			hasGetAll: n.length > 0 && "getAll" in r && !(typeof navigator < "u" && /Safari/.test(navigator.userAgent) && !/(Chrome\/|Edge\/)/.test(navigator.userAgent) && [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604),
			hasIdb3Features: "getAllRecords" in r
		};
	}
	function i(e) {
		if (e.type === 3) return null;
		if (e.type === 4) throw Error("Cannot convert never type to IDBKeyRange");
		var n = e.lower, r = e.upper, i = e.lowerOpen, a = e.upperOpen;
		return n === void 0 ? r === void 0 ? null : t.upperBound(r, !!a) : r === void 0 ? t.lowerBound(n, !!i) : t.bound(n, r, !!i, !!a);
	}
	function a(e) {
		var t = e.name;
		function n(e) {
			var n = e.trans, r = e.type, a = e.keys, o = e.values, s = e.range;
			return new Promise(function(e, c) {
				e = hi(e);
				var l = n.objectStore(t), u = l.keyPath == null, d = r === "put" || r === "add";
				if (!d && r !== "delete" && r !== "deleteRange") throw Error("Invalid operation type: " + r);
				var f = (a || o || { length: 1 }).length;
				if (a && o && a.length !== o.length) throw Error("Given keys array must have same length as given values array.");
				if (f === 0) return e({
					numFailures: 0,
					failures: {},
					results: [],
					lastResult: void 0
				});
				var p, m = [], h = [], g = 0, _ = function(e) {
					++g, Da(e);
				};
				if (r === "deleteRange") {
					if (s.type === 4) return e({
						numFailures: g,
						failures: h,
						results: [],
						lastResult: void 0
					});
					s.type === 3 ? m.push(p = l.clear()) : m.push(p = l.delete(i(s)));
				} else {
					var v = d ? u ? [o, a] : [o, null] : [a, null], y = v[0], b = v[1];
					if (d) for (var x = 0; x < f; ++x) m.push(p = b && b[x] !== void 0 ? l[r](y[x], b[x]) : l[r](y[x])), p.onerror = _;
					else for (var x = 0; x < f; ++x) m.push(p = l[r](y[x])), p.onerror = _;
				}
				var S = function(t) {
					var n = t.target.result;
					m.forEach(function(e, t) {
						return e.error != null && (h[t] = e.error);
					}), e({
						numFailures: g,
						failures: h,
						results: r === "delete" ? a : m.map(function(e) {
							return e.result;
						}),
						lastResult: n
					});
				};
				p.onerror = function(e) {
					_(e), S(e);
				}, p.onsuccess = S;
			});
		}
		function r(e) {
			var n = e.trans, r = e.values, a = e.query, o = e.reverse, s = e.unique;
			return new Promise(function(e, c) {
				e = hi(e);
				var l = a.index, u = a.range, d = n.objectStore(t), f = l.isPrimaryKey ? d : d.index(l.name), p = o ? s ? "prevunique" : "prev" : s ? "nextunique" : "next", m = r || !("openKeyCursor" in f) ? f.openCursor(i(u), p) : f.openKeyCursor(i(u), p);
				m.onerror = Ea(c), m.onsuccess = hi(function(t) {
					var r = m.result;
					if (!r) e(null);
					else {
						r.___id = ++Va, r.done = !1;
						var i = r.continue.bind(r), a = r.continuePrimaryKey;
						a &&= a.bind(r);
						var o = r.advance.bind(r), s = function() {
							throw Error("Cursor not started");
						}, l = function() {
							throw Error("Cursor not stopped");
						};
						r.trans = n, r.stop = r.continue = r.continuePrimaryKey = r.advance = s, r.fail = hi(c), r.next = function() {
							var e = this, t = 1;
							return this.start(function() {
								return t-- ? e.continue() : e.stop();
							}).then(function() {
								return e;
							});
						}, r.start = function(e) {
							var t = new Promise(function(e, t) {
								e = hi(e), m.onerror = Ea(t), r.fail = t, r.stop = function(t) {
									r.stop = r.continue = r.continuePrimaryKey = r.advance = l, e(t);
								};
							}), n = function() {
								if (m.result) try {
									e();
								} catch (e) {
									r.fail(e);
								}
								else r.done = !0, r.start = function() {
									throw Error("Cursor behind last entry");
								}, r.stop();
							};
							return m.onsuccess = hi(function(e) {
								m.onsuccess = n, n();
							}), r.continue = i, r.continuePrimaryKey = a, r.advance = o, n(), t;
						}, e(r);
					}
				}, c);
			});
		}
		function a(e, n) {
			return function(r) {
				return new Promise(function(a, o) {
					a = hi(a);
					var s = r.trans, c = r.values, l = r.limit, u = r.query, d = r.direction ?? "next", f = l === Infinity ? void 0 : l, p = u.index, m = u.range, h = s.objectStore(t), g = p.isPrimaryKey ? h : h.index(p.name), _ = i(m);
					if (l === 0) return a({ result: [] });
					if (n) {
						var v = {
							query: _,
							count: f,
							direction: d
						}, y = c ? g.getAll(v) : g.getAllKeys(v);
						y.onsuccess = function(e) {
							return a({ result: e.target.result });
						}, y.onerror = Ea(o);
					} else if (e && d === "next") {
						var y = c ? g.getAll(_, f) : g.getAllKeys(_, f);
						y.onsuccess = function(e) {
							return a({ result: e.target.result });
						}, y.onerror = Ea(o);
					} else {
						var b = 0, x = c || !("openKeyCursor" in g) ? g.openCursor(_, d) : g.openKeyCursor(_, d), S = [];
						x.onsuccess = function() {
							var e = x.result;
							if (!e || (S.push(c ? e.value : e.primaryKey), ++b === l)) return a({ result: S });
							e.continue();
						}, x.onerror = Ea(o);
					}
				});
			};
		}
		return {
			name: t,
			schema: e,
			mutate: n,
			getMany: function(e) {
				var n = e.trans, r = e.keys;
				return new Promise(function(e, i) {
					e = hi(e);
					for (var a = n.objectStore(t), o = r.length, s = Array(o), c = 0, l = 0, u, d = function(t) {
						var n = t.target;
						s[n._pos] = n.result, ++l === c && e(s);
					}, f = Ea(i), p = 0; p < o; ++p) r[p] != null && (u = a.get(r[p]), u._pos = p, u.onsuccess = d, u.onerror = f, ++c);
					c === 0 && e(s);
				});
			},
			get: function(e) {
				var n = e.trans, r = e.key;
				return new Promise(function(e, i) {
					e = hi(e);
					var a = n.objectStore(t).get(r);
					a.onsuccess = function(t) {
						return e(t.target.result);
					}, a.onerror = Ea(i);
				});
			},
			query: a(c, l),
			openCursor: r,
			count: function(e) {
				var n = e.query, r = e.trans, a = n.index, o = n.range;
				return new Promise(function(e, n) {
					var s = r.objectStore(t), c = a.isPrimaryKey ? s : s.index(a.name), l = i(o), u = l ? c.count(l) : c.count();
					u.onsuccess = hi(function(t) {
						return e(t.target.result);
					}), u.onerror = Ea(n);
				});
			}
		};
	}
	var o = r(e, n), s = o.schema, c = o.hasGetAll, l = o.hasIdb3Features, u = s.tables.map(function(e) {
		return a(e);
	}), d = {};
	return u.forEach(function(e) {
		return d[e.name] = e;
	}), {
		stack: "dbcore",
		transaction: e.transaction.bind(e),
		table: function(e) {
			if (!d[e]) throw Error(`Table '${e}' not found`);
			return d[e];
		},
		MIN_KEY: -Infinity,
		MAX_KEY: La(t),
		schema: s
	};
}
function Wa(e, t) {
	return t.reduce(function(e, t) {
		var n = t.create;
		return F(F({}, e), n(e));
	}, e);
}
function Ga(e, t, n, r) {
	var i = n.IDBKeyRange;
	return n.indexedDB, { dbcore: Wa(Ua(t, i, r), e.dbcore) };
}
function Ka(e, t) {
	var n = t.db;
	e.core = Ga(e._middlewares, n, e._deps, t).dbcore, e.tables.forEach(function(t) {
		var n = t.name;
		e.core.schema.tables.some(function(e) {
			return e.name === n;
		}) && (t.core = e.core.table(n), e[n] instanceof e.Table && (e[n].core = t.core));
	});
}
function qa(e, t, n, r) {
	n.forEach(function(n) {
		var i = r[n];
		t.forEach(function(t) {
			var r = Ln(t, n);
			(!r || "value" in r && r.value === void 0) && (t === e.Transaction.prototype || t instanceof e.Transaction ? Pn(t, n, {
				get: function() {
					return this.table(n);
				},
				set: function(e) {
					Nn(this, n, {
						value: e,
						writable: !0,
						configurable: !0,
						enumerable: !0
					});
				}
			}) : t[n] = new e.Table(n, i));
		});
	});
}
function Ja(e, t) {
	t.forEach(function(t) {
		for (var n in t) t[n] instanceof e.Table && delete t[n];
	});
}
function Ya(e, t) {
	return e._cfg.version - t._cfg.version;
}
function Xa(e, t, n, r) {
	var i = e._dbSchema;
	n.objectStoreNames.contains("$meta") && !i.$meta && (i.$meta = Fa("$meta", lo("")[0], []), e._storeNames.push("$meta"));
	var a = e._createTransaction("readwrite", e._storeNames, i);
	a.create(n), a._completion.catch(r);
	var o = a._reject.bind(a), s = L.transless || L;
	Si(function() {
		if (L.trans = a, L.transless = s, t === 0) En(i).forEach(function(e) {
			to(n, e, i[e].primKey, i[e].indexes);
		}), Ka(e, n), R.follow(function() {
			return e.on.populate.fire(a);
		}).catch(o);
		else return Ka(e, n), Qa(e, a, t).then(function(t) {
			return $a(e, t, a, n);
		}).catch(o);
	});
}
function Za(e, t) {
	no(e._dbSchema, t), t.db.version % 10 == 0 && !t.objectStoreNames.contains("$meta") && t.db.createObjectStore("$meta").add(Math.ceil(t.db.version / 10 - 1), "version");
	var n = ao(e, e.idbdb, t);
	co(e, e._dbSchema, t);
	for (var r = eo(n, e._dbSchema), i = function(e) {
		if (e.change.length || e.recreate) return console.warn(`Unable to patch indexes of table ${e.name} because it has changes on the type of index or primary key.`), { value: void 0 };
		var n = t.objectStore(e.name);
		e.add.forEach(function(t) {
			Mr && console.debug(`Dexie upgrade patch: Creating missing index ${e.name}.${t.src}`), io(n, t);
		});
	}, a = 0, o = r.change; a < o.length; a++) {
		var s = o[a], c = i(s);
		if (typeof c == "object") return c.value;
	}
}
function Qa(e, t, n) {
	return t.storeNames.includes("$meta") ? t.table("$meta").get("version").then(function(e) {
		return e ?? n;
	}) : R.resolve(n);
}
function $a(e, t, n, r) {
	var i = [], a = e._versions, o = e._dbSchema = ao(e, e.idbdb, r), s = a.filter(function(e) {
		return e._cfg.version >= t;
	});
	if (s.length === 0) return R.resolve();
	s.forEach(function(a) {
		i.push(function() {
			var i = o, s = a._cfg.dbschema;
			co(e, i, r), co(e, s, r), o = e._dbSchema = s;
			var c = eo(i, s);
			c.add.forEach(function(e) {
				to(r, e[0], e[1].primKey, e[1].indexes);
			}), c.change.forEach(function(e) {
				if (e.recreate) throw new I.Upgrade("Not yet support for changing primary key");
				var t = r.objectStore(e.name);
				e.add.forEach(function(e) {
					return io(t, e);
				}), e.change.forEach(function(e) {
					t.deleteIndex(e.name), io(t, e);
				}), e.del.forEach(function(e) {
					return t.deleteIndex(e);
				});
			});
			var l = a._cfg.contentUpgrade;
			if (l && a._cfg.version > t) {
				Ka(e, r), n._memoizedTables = {};
				var u = qn(s);
				c.del.forEach(function(e) {
					u[e] = i[e];
				}), Ja(e, [e.Transaction.prototype]), qa(e, [e.Transaction.prototype], En(u), u), n.schema = u;
				var d = lr(l);
				d && Ci();
				var f, p = R.follow(function() {
					if (f = l(n), f && d) {
						var e = wi.bind(null, null);
						f.then(e, e);
					}
				});
				return f && typeof f.then == "function" ? R.resolve(f) : p.then(function() {
					return f;
				});
			}
		}), i.push(function(t) {
			var r = a._cfg.dbschema;
			ro(r, t), Ja(e, [e.Transaction.prototype]), qa(e, [e.Transaction.prototype], e._storeNames, e._dbSchema), n.schema = e._dbSchema;
		}), i.push(function(t) {
			e.idbdb.objectStoreNames.contains("$meta") && (Math.ceil(e.idbdb.version / 10) === a._cfg.version ? (e.idbdb.deleteObjectStore("$meta"), delete e._dbSchema.$meta, e._storeNames = e._storeNames.filter(function(e) {
				return e !== "$meta";
			})) : t.objectStore("$meta").put(a._cfg.version, "version"));
		});
	});
	function c() {
		return i.length ? R.resolve(i.shift()(n.idbtrans)).then(c) : R.resolve();
	}
	return c().then(function() {
		no(o, r);
	});
}
function eo(e, t) {
	var n = {
		del: [],
		add: [],
		change: []
	}, r;
	for (r in e) t[r] || n.del.push(r);
	for (r in t) {
		var i = e[r], a = t[r];
		if (!i) n.add.push([r, a]);
		else {
			var o = {
				name: r,
				def: a,
				recreate: !1,
				del: [],
				add: [],
				change: []
			};
			if ("" + (i.primKey.keyPath || "") != "" + (a.primKey.keyPath || "") || i.primKey.auto !== a.primKey.auto) o.recreate = !0, n.change.push(o);
			else {
				var s = i.idxByName, c = a.idxByName, l = void 0;
				for (l in s) c[l] || o.del.push(l);
				for (l in c) {
					var u = s[l], d = c[l];
					u ? u.src !== d.src && o.change.push(d) : o.add.push(d);
				}
				(o.del.length > 0 || o.add.length > 0 || o.change.length > 0) && n.change.push(o);
			}
		}
	}
	return n;
}
function to(e, t, n, r) {
	var i = e.db.createObjectStore(t, n.keyPath ? {
		keyPath: n.keyPath,
		autoIncrement: n.auto
	} : { autoIncrement: n.auto });
	return r.forEach(function(e) {
		return io(i, e);
	}), i;
}
function no(e, t) {
	En(e).forEach(function(n) {
		t.db.objectStoreNames.contains(n) || (Mr && console.debug("Dexie: Creating missing table", n), to(t, n, e[n].primKey, e[n].indexes));
	});
}
function ro(e, t) {
	[].slice.call(t.db.objectStoreNames).forEach(function(n) {
		return e[n] == null && t.db.deleteObjectStore(n);
	});
}
function io(e, t) {
	e.createIndex(t.name, t.keyPath, {
		unique: t.unique,
		multiEntry: t.multi
	});
}
function ao(e, t, n) {
	var r = {};
	return zn(t.objectStoreNames, 0).forEach(function(e) {
		for (var t = n.objectStore(e), i = t.keyPath, a = Na(Pa(i), i || "", !0, !1, !!t.autoIncrement, i && typeof i != "string", !0), o = [], s = 0; s < t.indexNames.length; ++s) {
			var c = t.index(t.indexNames[s]);
			i = c.keyPath;
			var l = Na(c.name, i, !!c.unique, !!c.multiEntry, !1, i && typeof i != "string", !1);
			o.push(l);
		}
		r[e] = Fa(e, a, o);
	}), r;
}
function oo(e, t, n) {
	e.verno = t.version / 10;
	var r = e._dbSchema = ao(e, t, n);
	e._storeNames = zn(t.objectStoreNames, 0), qa(e, [e._allTables], En(r), r);
}
function so(e, t) {
	var n = eo(ao(e, e.idbdb, t), e._dbSchema);
	return !(n.add.length || n.change.some(function(e) {
		return e.add.length || e.change.length;
	}));
}
function co(e, t, n) {
	for (var r = n.db.objectStoreNames, i = 0; i < r.length; ++i) {
		var a = r[i], o = n.objectStore(a);
		e._hasGetAll = "getAll" in o;
		for (var s = 0; s < o.indexNames.length; ++s) {
			var c = o.indexNames[s], l = o.index(c).keyPath, u = typeof l == "string" ? l : "[" + zn(l).join("+") + "]";
			if (t[a]) {
				var d = t[a].idxByName[u];
				d && (d.name = c, delete t[a].idxByName[u], t[a].idxByName[c] = d);
			}
		}
	}
	typeof navigator < "u" && /Safari/.test(navigator.userAgent) && !/(Chrome\/|Edge\/)/.test(navigator.userAgent) && Tn.WorkerGlobalScope && Tn instanceof Tn.WorkerGlobalScope && [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604 && (e._hasGetAll = !1);
}
function lo(e) {
	return e.split(",").map(function(e, t) {
		var n = e.split(":"), r = n[1]?.trim();
		e = n[0].trim();
		var i = e.replace(/([&*]|\+\+)/g, ""), a = /^\[/.test(i) ? i.match(/^\[(.*)\]$/)[1].split("+") : i;
		return Na(i, a || null, /\&/.test(e), /\*/.test(e), /\+\+/.test(e), Dn(a), t === 0, r);
	});
}
var uo = function() {
	function e() {}
	return e.prototype._createTableSchema = function(e, t, n) {
		return Fa(e, t, n);
	}, e.prototype._parseIndexSyntax = function(e) {
		return lo(e);
	}, e.prototype._parseStoresSpec = function(e, t) {
		var n = this;
		En(e).forEach(function(r) {
			if (e[r] !== null) {
				var i = n._parseIndexSyntax(e[r]), a = i.shift();
				if (!a) throw new I.Schema("Invalid schema for table " + r + ": " + e[r]);
				if (a.unique = !0, a.multi) throw new I.Schema("Primary key cannot be multiEntry*");
				i.forEach(function(e) {
					if (e.auto) throw new I.Schema("Only primary key can be marked as autoIncrement (++)");
					if (!e.keyPath) throw new I.Schema("Index must have a name and cannot be an empty string");
				}), t[r] = n._createTableSchema(r, a, i);
			}
		});
	}, e.prototype.stores = function(e) {
		var t = this.db;
		this._cfg.storesSource = this._cfg.storesSource ? On(this._cfg.storesSource, e) : e;
		var n = t._versions, r = {}, i = {};
		return n.forEach(function(e) {
			On(r, e._cfg.storesSource), i = e._cfg.dbschema = {}, e._parseStoresSpec(r, i);
		}), t._dbSchema = i, Ja(t, [
			t._allTables,
			t,
			t.Transaction.prototype
		]), qa(t, [
			t._allTables,
			t,
			t.Transaction.prototype,
			this._cfg.tables
		], En(i), i), t._storeNames = En(i), this;
	}, e.prototype.upgrade = function(e) {
		return this._cfg.contentUpgrade = jr(this._cfg.contentUpgrade || Cr, e), this;
	}, e;
}();
function fo(e) {
	return na(uo.prototype, function(t) {
		this.db = e, this._cfg = {
			version: t,
			storesSource: null,
			dbschema: {},
			tables: {},
			contentUpgrade: null
		};
	});
}
var po = mo();
function mo() {
	if (typeof FinalizationRegistry < "u" && typeof WeakRef < "u") {
		var e = /* @__PURE__ */ new Set(), t = new FinalizationRegistry(function(t) {
			e.delete(t);
		}), n = function() {
			return Array.from(e).map(function(e) {
				return e.deref();
			}).filter(function(e) {
				return e !== void 0;
			});
		}, r = function(n) {
			var r = new WeakRef(n._novip);
			if (e.add(r), t.register(n._novip, r, r), e.size > n._options.maxConnections) {
				var i = e.values().next().value;
				e.delete(i), t.unregister(i);
			}
		}, i = function(n) {
			if (n) for (var r = e.values(), i = r.next(); !i.done;) {
				var a = i.value;
				if (a.deref() === n._novip) {
					e.delete(a), t.unregister(a);
					return;
				}
				i = r.next();
			}
		};
		return {
			toArray: n,
			add: r,
			remove: i
		};
	}
	var a = [], n = function() {
		return a;
	}, r = function(e) {
		a.push(e._novip);
	}, i = function(e) {
		if (e) {
			var t = a.indexOf(e._novip);
			t !== -1 && a.splice(t, 1);
		}
	};
	return {
		toArray: n,
		add: r,
		remove: i
	};
}
function ho(e, t) {
	var n = e._dbNamesDB;
	return n || (n = e._dbNamesDB = new ms(Bi, {
		addons: [],
		indexedDB: e,
		IDBKeyRange: t
	}), n.version(1).stores({ dbnames: "name" })), n.table("dbnames");
}
function go(e) {
	return e && typeof e.databases == "function";
}
function _o(e) {
	var t = e.indexedDB, n = e.IDBKeyRange;
	return go(t) ? Promise.resolve(t.databases()).then(function(e) {
		return e.map(function(e) {
			return e.name;
		}).filter(function(e) {
			return e !== Bi;
		});
	}) : ho(t, n).toCollection().primaryKeys();
}
function vo(e, t) {
	var n = e.indexedDB, r = e.IDBKeyRange;
	!go(n) && t !== Bi && ho(n, r).put({ name: t }).catch(Cr);
}
function yo(e, t) {
	var n = e.indexedDB, r = e.IDBKeyRange;
	!go(n) && t !== Bi && ho(n, r).delete(t).catch(Cr);
}
function bo(e) {
	return Si(function() {
		return L.letThrough = !0, e();
	});
}
function xo() {
	if (navigator.userAgentData || !/Safari\//.test(navigator.userAgent) || /Chrom(e|ium)\//.test(navigator.userAgent) || !indexedDB.databases) return Promise.resolve();
	var e;
	return new Promise(function(t) {
		var n = function() {
			return indexedDB.databases().finally(t);
		};
		e = setInterval(n, 100), n();
	}).finally(function() {
		return clearInterval(e);
	});
}
var So;
function Co(e) {
	return !("from" in e);
}
var wo = function(e, t) {
	if (this) On(this, arguments.length ? {
		d: 1,
		from: e,
		to: arguments.length > 1 ? t : e
	} : { d: 0 });
	else {
		var n = new wo();
		return e && "d" in e && On(n, e), n;
	}
};
Mn(wo.prototype, (So = {
	add: function(e) {
		return Eo(this, e), this;
	},
	addKey: function(e) {
		return To(this, e, e), this;
	},
	addKeys: function(e) {
		var t = this;
		return e.forEach(function(e) {
			return To(t, e, e);
		}), this;
	},
	hasKey: function(e) {
		var t = Oo(this).next(e).value;
		return t && B(t.from, e) <= 0 && B(t.to, e) >= 0;
	}
}, So[ir] = function() {
	return Oo(this);
}, So));
function To(e, t, n) {
	var r = B(t, n);
	if (!isNaN(r)) {
		if (r > 0) throw RangeError();
		if (Co(e)) return On(e, {
			from: t,
			to: n,
			d: 1
		});
		var i = e.l, a = e.r;
		if (B(n, e.from) < 0) return i ? To(i, t, n) : e.l = {
			from: t,
			to: n,
			d: 1,
			l: null,
			r: null
		}, ko(e);
		if (B(t, e.to) > 0) return a ? To(a, t, n) : e.r = {
			from: t,
			to: n,
			d: 1,
			l: null,
			r: null
		}, ko(e);
		B(t, e.from) < 0 && (e.from = t, e.l = null, e.d = a ? a.d + 1 : 1), B(n, e.to) > 0 && (e.to = n, e.r = null, e.d = e.l ? e.l.d + 1 : 1);
		var o = !e.r;
		i && !e.l && Eo(e, i), a && o && Eo(e, a);
	}
}
function Eo(e, t) {
	function n(e, t) {
		var r = t.from, i = t.to, a = t.l, o = t.r;
		To(e, r, i), a && n(e, a), o && n(e, o);
	}
	Co(t) || n(e, t);
}
function Do(e, t) {
	var n = Oo(t), r = n.next();
	if (r.done) return !1;
	for (var i = r.value, a = Oo(e), o = a.next(i.from), s = o.value; !r.done && !o.done;) {
		if (B(s.from, i.to) <= 0 && B(s.to, i.from) >= 0) return !0;
		B(i.from, s.from) < 0 ? i = (r = n.next(s.from)).value : s = (o = a.next(i.from)).value;
	}
	return !1;
}
function Oo(e) {
	var t = Co(e) ? null : {
		s: 0,
		n: e
	};
	return { next: function(e) {
		for (var n = arguments.length > 0; t;) switch (t.s) {
			case 0: if (t.s = 1, n) for (; t.n.l && B(e, t.n.from) < 0;) t = {
				up: t,
				n: t.n.l,
				s: 1
			};
			else for (; t.n.l;) t = {
				up: t,
				n: t.n.l,
				s: 1
			};
			case 1: if (t.s = 2, !n || B(e, t.n.to) <= 0) return {
				value: t.n,
				done: !1
			};
			case 2: if (t.n.r) {
				t.s = 3, t = {
					up: t,
					n: t.n.r,
					s: 0
				};
				continue;
			}
			case 3: t = t.up;
		}
		return { done: !0 };
	} };
}
function ko(e) {
	var t = (e.r?.d || 0) - (e.l?.d || 0), n = t > 1 ? "r" : t < -1 ? "l" : "";
	if (n) {
		var r = n === "r" ? "l" : "r", i = F({}, e), a = e[n];
		e.from = a.from, e.to = a.to, e[n] = a[n], i[n] = a[r], e[r] = i, i.d = Ao(i);
	}
	e.d = Ao(e);
}
function Ao(e) {
	var t = e.r, n = e.l;
	return (t ? n ? Math.max(t.d, n.d) : t.d : n ? n.d : 0) + 1;
}
function jo(e, t) {
	return En(t).forEach(function(n) {
		e[n] ? Eo(e[n], t[n]) : e[n] = Qn(t[n]);
	}), e;
}
function Mo(e, t) {
	return e.all || t.all || Object.keys(e).some(function(n) {
		return t[n] && Do(t[n], e[n]);
	});
}
var No = {}, Po = {}, Fo = !1;
function Io(e, t) {
	jo(Po, e), Fo || (Fo = !0, setTimeout(function() {
		Fo = !1;
		var e = Po;
		Po = {}, Lo(e, !1);
	}, 0));
}
function Lo(e, t) {
	t === void 0 && (t = !1);
	var n = /* @__PURE__ */ new Set();
	if (e.all) for (var r = 0, i = Object.values(No); r < i.length; r++) {
		var a = i[r];
		Ro(a, e, n, t);
	}
	else for (var o in e) {
		var s = /^idb\:\/\/(.*)\/(.*)\//.exec(o);
		if (s) {
			var a = No[`idb://${s[1]}/${s[2]}`];
			a && Ro(a, e, n, t);
		}
	}
	n.forEach(function(e) {
		return e();
	});
}
function Ro(e, t, n, r) {
	for (var i = [], a = 0, o = Object.entries(e.queries.query); a < o.length; a++) {
		for (var s = o[a], c = s[0], l = s[1], u = [], d = 0, f = l; d < f.length; d++) {
			var p = f[d];
			Mo(t, p.obsSet) ? p.subscribers.forEach(function(e) {
				return n.add(e);
			}) : r && u.push(p);
		}
		r && i.push([c, u]);
	}
	if (r) for (var m = 0, h = i; m < h.length; m++) {
		var g = h[m], c = g[0], u = g[1];
		e.queries.query[c] = u;
	}
}
function zo(e) {
	var t = e._state, n = e._deps.indexedDB;
	if (t.isBeingOpened || e.idbdb) return t.dbReadyPromise.then(function() {
		return t.dbOpenError ? z(t.dbOpenError) : e;
	});
	t.isBeingOpened = !0, t.dbOpenError = null, t.openComplete = !1;
	var r = t.openCanceller, i = Math.round(e.verno * 10), a = !1;
	function o() {
		if (t.openCanceller !== r) throw new I.DatabaseClosed("db.open() was cancelled");
	}
	var s = t.dbReadyResolve, c = null, l = !1, u = function() {
		return new R(function(r, s) {
			if (o(), !n) throw new I.MissingAPI();
			var d = e.name, f = t.autoSchema || !i ? n.open(d) : n.open(d, i);
			if (!f) throw new I.MissingAPI();
			f.onerror = Ea(s), f.onblocked = hi(e._fireOnBlocked), f.onupgradeneeded = hi(function(r) {
				if (c = f.transaction, t.autoSchema && !e._options.allowEmptyDB) {
					f.onerror = Da, c.abort(), f.result.close();
					var i = n.deleteDatabase(d);
					i.onsuccess = i.onerror = hi(function() {
						s(new I.NoSuchDatabase(`Database ${d} doesnt exist`));
					});
				} else {
					c.onerror = Ea(s);
					var o = r.oldVersion > 2 ** 62 ? 0 : r.oldVersion;
					l = o < 1, e.idbdb = f.result, a && Za(e, c), Xa(e, o / 10, c, s);
				}
			}, s), f.onsuccess = hi(function() {
				c = null;
				var n = e.idbdb = f.result, o = zn(n.objectStoreNames);
				if (o.length > 0) try {
					var s = n.transaction(Ia(o), "readonly");
					if (t.autoSchema) oo(e, n, s);
					else if (co(e, e._dbSchema, s), !so(e, s) && !a) return console.warn("Dexie SchemaDiff: Schema was extended without increasing the number passed to db.version(). Dexie will add missing parts and increment native version number to workaround this."), n.close(), i = n.version + 1, a = !0, r(u());
					Ka(e, s);
				} catch {}
				po.add(e), n.onversionchange = hi(function(n) {
					t.vcFired = !0, e.on("versionchange").fire(n);
				}), n.onclose = hi(function() {
					e.close({ disableAutoOpen: !1 });
				}), l && vo(e._deps, d), r();
			}, s);
		}).catch(function(e) {
			switch (e?.name) {
				case "UnknownError":
					if (t.PR1398_maxLoop > 0) return t.PR1398_maxLoop--, console.warn("Dexie: Workaround for Chrome UnknownError on open()"), u();
					break;
				case "VersionError": if (i > 0) return i = 0, u();
			}
			return R.reject(e);
		});
	}, d = typeof navigator < "u" && !!n && n === Tn.indexedDB;
	return R.race([r, (d ? xo() : R.resolve()).then(u)]).then(function() {
		return o(), t.onReadyBeingFired = [], R.resolve(bo(function() {
			return e.on.ready.fire(e.vip);
		})).then(function n() {
			if (t.onReadyBeingFired.length > 0) {
				var r = t.onReadyBeingFired.reduce(jr, Cr);
				return t.onReadyBeingFired = [], R.resolve(bo(function() {
					return r(e.vip);
				})).then(n);
			}
		});
	}).finally(function() {
		t.openCanceller === r && (t.onReadyBeingFired = null, t.isBeingOpened = !1);
	}).catch(function(n) {
		t.dbOpenError = n;
		try {
			c && c.abort();
		} catch {}
		return r === t.openCanceller && e._close(), z(n);
	}).finally(function() {
		t.openComplete = !0, s();
	}).then(function() {
		if (l) {
			var t = {};
			e.tables.forEach(function(n) {
				n.schema.indexes.forEach(function(r) {
					r.name && (t[`idb://${e.name}/${n.name}/${r.name}`] = new wo(-Infinity, [[[]]]));
				}), t[`idb://${e.name}/${n.name}/`] = t[`idb://${e.name}/${n.name}/:dels`] = new wo(-Infinity, [[[]]]);
			}), Aa(Oa).fire(t), Lo(t, !0);
		}
		return e;
	});
}
function Bo(e) {
	var t = function(t) {
		return e.next(t);
	}, n = function(t) {
		return e.throw(t);
	}, r = a(t), i = a(n);
	function a(e) {
		return function(t) {
			var n = e(t), a = n.value;
			return n.done ? a : !a || typeof a.then != "function" ? Dn(a) ? Promise.all(a).then(r, i) : r(a) : a.then(r, i);
		};
	}
	return a(t)();
}
function Vo(e, t, n) {
	var r = arguments.length;
	if (r < 2) throw new I.InvalidArgument("Too few arguments");
	for (var i = Array(r - 1); --r;) i[r - 1] = arguments[r];
	return n = i.pop(), [
		e,
		Yn(i),
		n
	];
}
function H(e, t, n, r, i) {
	return R.resolve().then(function() {
		var a = L.transless || L, o = e._createTransaction(t, n, e._dbSchema, r);
		o.explicit = !0;
		var s = {
			trans: o,
			transless: a
		};
		if (r) o.idbtrans = r.idbtrans;
		else try {
			o.create(), o.idbtrans._explicit = !0, e._state.PR1398_maxLoop = 3;
		} catch (r) {
			return r.name === vr.InvalidState && e.isOpen() && --e._state.PR1398_maxLoop > 0 ? (console.warn("Dexie: Need to reopen db"), e.close({ disableAutoOpen: !1 }), e.open().then(function() {
				return H(e, t, n, null, i);
			})) : z(r);
		}
		var c = lr(i);
		c && Ci();
		var l, u = R.follow(function() {
			if (l = i.call(o, o), l) {
				if (c) {
					var e = wi.bind(null, null);
					l.then(e, e);
				} else typeof l.next == "function" && typeof l.throw == "function" && (l = Bo(l));
			}
		}, s);
		return (l && typeof l.then == "function" ? R.resolve(l).then(function(e) {
			return o.active ? e : z(new I.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn"));
		}) : u.then(function() {
			return l;
		})).then(function(e) {
			return r && o._resolve(), o._completion.then(function() {
				return e;
			});
		}).catch(function(e) {
			return o._reject(e), z(e);
		});
	});
}
function U(e, t, n) {
	for (var r = Dn(e) ? e.slice() : [e], i = 0; i < n; ++i) r.push(t);
	return r;
}
function Ho(e) {
	return F(F({}, e), { table: function(t) {
		var n = e.table(t), r = n.schema, i = Object.create(null), a = [];
		function o(e, t, n) {
			var r = Ha(e), s = i[r] = i[r] || [], c = e == null ? 0 : typeof e == "string" ? 1 : e.length, l = t > 0, u = F(F({}, n), {
				name: l ? `${r}(virtual-from:${n.name})` : n.name,
				lowLevelIndex: n,
				isVirtual: l,
				keyTail: t,
				keyLength: c,
				extractKey: Ra(e),
				unique: !l && n.unique
			});
			return s.push(u), u.isPrimaryKey || a.push(u), c > 1 && o(c === 2 ? e[0] : e.slice(0, c - 1), t + 1, n), s.sort(function(e, t) {
				return e.keyTail - t.keyTail;
			}), u;
		}
		var s = o(r.primaryKey.keyPath, 0, r.primaryKey);
		i[":id"] = [s];
		for (var c = 0, l = r.indexes; c < l.length; c++) {
			var u = l[c];
			o(u.keyPath, 0, u);
		}
		function d(e) {
			var t = i[Ha(e)];
			return t && t[0];
		}
		function f(t, n) {
			return {
				type: t.type === 1 ? 2 : t.type,
				lower: U(t.lower, t.lowerOpen ? e.MAX_KEY : e.MIN_KEY, n),
				lowerOpen: !0,
				upper: U(t.upper, t.upperOpen ? e.MIN_KEY : e.MAX_KEY, n),
				upperOpen: !0
			};
		}
		function p(e) {
			var t = e.query.index;
			return t.isVirtual ? F(F({}, e), { query: {
				index: t.lowLevelIndex,
				range: f(e.query.range, t.keyTail)
			} }) : e;
		}
		return F(F({}, n), {
			schema: F(F({}, r), {
				primaryKey: s,
				indexes: a,
				getIndexByKeyPath: d
			}),
			count: function(e) {
				return n.count(p(e));
			},
			query: function(e) {
				return n.query(p(e));
			},
			openCursor: function(t) {
				var r = t.query.index, i = r.keyTail, a = r.isVirtual, o = r.keyLength;
				if (!a) return n.openCursor(t);
				function s(n) {
					function r(r) {
						r == null ? t.unique ? n.continue(n.key.slice(0, o).concat(t.reverse ? e.MIN_KEY : e.MAX_KEY, i)) : n.continue() : n.continue(U(r, t.reverse ? e.MAX_KEY : e.MIN_KEY, i));
					}
					return Object.create(n, {
						continue: { value: r },
						continuePrimaryKey: { value: function(t, r) {
							n.continuePrimaryKey(U(t, e.MAX_KEY, i), r);
						} },
						primaryKey: { get: function() {
							return n.primaryKey;
						} },
						key: { get: function() {
							var e = n.key;
							return o === 1 ? e[0] : e.slice(0, o);
						} },
						value: { get: function() {
							return n.value;
						} }
					});
				}
				return n.openCursor(p(t)).then(function(e) {
					return e && s(e);
				});
			}
		});
	} });
}
var Uo = {
	stack: "dbcore",
	name: "VirtualIndexMiddleware",
	level: 1,
	create: Ho
};
function Wo(e, t, n, r) {
	return n ||= {}, r ||= "", En(e).forEach(function(i) {
		if (!jn(t, i)) n[r + i] = void 0;
		else {
			var a = e[i], o = t[i];
			if (typeof a == "object" && typeof o == "object" && a && o) {
				var s = rr(a);
				s === rr(o) ? s === "Object" ? Wo(a, o, n, r + i + ".") : a !== o && (n[r + i] = t[i]) : n[r + i] = t[i];
			} else a !== o && (n[r + i] = t[i]);
		}
	}), En(t).forEach(function(i) {
		jn(e, i) || (n[r + i] = t[i]);
	}), n;
}
function Go(e, t) {
	return t.type === "delete" ? t.keys : t.keys || t.values.map(e.extractKey);
}
var Ko = {
	stack: "dbcore",
	name: "HooksMiddleware",
	level: 2,
	create: function(e) {
		return F(F({}, e), { table: function(t) {
			var n = e.table(t), r = n.schema.primaryKey;
			return F(F({}, n), { mutate: function(e) {
				var i = L.trans, a = i.table(t).hook, o = a.deleting, s = a.creating, c = a.updating;
				switch (e.type) {
					case "add":
						if (s.fire === Cr) break;
						return i._promise("readwrite", function() {
							return l(e);
						}, !0);
					case "put":
						if (s.fire === Cr && c.fire === Cr) break;
						return i._promise("readwrite", function() {
							return l(e);
						}, !0);
					case "delete":
						if (o.fire === Cr) break;
						return i._promise("readwrite", function() {
							return l(e);
						}, !0);
					case "deleteRange":
						if (o.fire === Cr) break;
						return i._promise("readwrite", function() {
							return u(e);
						}, !0);
				}
				return n.mutate(e);
				function l(e) {
					var t = L.trans, i = e.keys || Go(r, e);
					if (!i) throw Error("Keys missing");
					return e = e.type === "add" || e.type === "put" ? F(F({}, e), { keys: i }) : F({}, e), e.type !== "delete" && (e.values = wn([], e.values, !0)), e.keys && (e.keys = wn([], e.keys, !0)), qo(n, e, i).then(function(a) {
						var l = i.map(function(n, i) {
							var l = a[i], u = {
								onerror: null,
								onsuccess: null
							};
							if (e.type === "delete") o.fire.call(u, n, l, t);
							else if (e.type === "add" || l === void 0) {
								var d = s.fire.call(u, n, e.values[i], t);
								n == null && d != null && (n = d, e.keys[i] = n, r.outbound || Gn(e.values[i], r.keyPath, n));
							} else {
								var f = Wo(l, e.values[i]), p = c.fire.call(u, f, n, l, t);
								if (p) {
									var m = e.values[i];
									Object.keys(p).forEach(function(e) {
										jn(m, e) ? m[e] = p[e] : Gn(m, e, p[e]);
									});
								}
							}
							return u;
						});
						return n.mutate(e).then(function(t) {
							for (var n = t.failures, r = t.results, o = t.numFailures, s = t.lastResult, c = 0; c < i.length; ++c) {
								var u = r ? r[c] : i[c], d = l[c];
								u == null ? d.onerror && d.onerror(n[c]) : d.onsuccess && d.onsuccess(e.type === "put" && a[c] ? e.values[c] : u);
							}
							return {
								failures: n,
								results: r,
								numFailures: o,
								lastResult: s
							};
						}).catch(function(e) {
							return l.forEach(function(t) {
								return t.onerror && t.onerror(e);
							}), Promise.reject(e);
						});
					});
				}
				function u(e) {
					return d(e.trans, e.range, 1e4);
				}
				function d(e, t, i) {
					return n.query({
						trans: e,
						values: !1,
						query: {
							index: r,
							range: t
						},
						limit: i
					}).then(function(n) {
						var r = n.result;
						return l({
							type: "delete",
							keys: r,
							trans: e
						}).then(function(n) {
							return n.numFailures > 0 ? Promise.reject(n.failures[0]) : r.length < i ? {
								failures: [],
								numFailures: 0,
								lastResult: void 0
							} : d(e, F(F({}, t), {
								lower: r[r.length - 1],
								lowerOpen: !0
							}), i);
						});
					});
				}
			} });
		} });
	}
};
function qo(e, t, n) {
	return t.type === "add" ? Promise.resolve([]) : e.getMany({
		trans: t.trans,
		keys: n,
		cache: "immutable"
	});
}
function Jo(e, t, n) {
	try {
		if (!t || t.keys.length < e.length) return null;
		for (var r = [], i = 0, a = 0; i < t.keys.length && a < e.length; ++i) B(t.keys[i], e[a]) === 0 && (r.push(n ? er(t.values[i]) : t.values[i]), ++a);
		return r.length === e.length ? r : null;
	} catch {
		return null;
	}
}
var Yo = {
	stack: "dbcore",
	level: -1,
	create: function(e) {
		return { table: function(t) {
			var n = e.table(t);
			return F(F({}, n), {
				getMany: function(e) {
					if (!e.cache) return n.getMany(e);
					var t = Jo(e.keys, e.trans._cache, e.cache === "clone");
					return t ? R.resolve(t) : n.getMany(e).then(function(t) {
						return e.trans._cache = {
							keys: e.keys,
							values: e.cache === "clone" ? er(t) : t
						}, t;
					});
				},
				mutate: function(e) {
					return e.type !== "add" && (e.trans._cache = null), n.mutate(e);
				}
			});
		} };
	}
};
function Xo(e, t) {
	return e.trans.mode === "readonly" && !!e.subscr && !e.trans.explicit && e.trans.db._options.cache !== "disabled" && !t.schema.primaryKey.outbound;
}
function Zo(e, t) {
	switch (e) {
		case "query": return t.values && !t.unique;
		case "get": return !1;
		case "getMany": return !1;
		case "count": return !1;
		case "openCursor": return !1;
	}
}
var Qo = {
	stack: "dbcore",
	level: 0,
	name: "Observability",
	create: function(e) {
		var t = e.schema.name, n = new wo(e.MIN_KEY, e.MAX_KEY);
		return F(F({}, e), {
			transaction: function(t, n, r) {
				if (L.subscr && n !== "readonly") throw new I.ReadOnly(`Readwrite transaction in liveQuery context. Querier source: ${L.querier}`);
				return e.transaction(t, n, r);
			},
			table: function(r) {
				var i = e.table(r), a = i.schema, o = a.primaryKey, s = a.indexes, c = o.extractKey, l = o.outbound, u = o.autoIncrement && s.filter(function(e) {
					return e.compound && e.keyPath.includes(o.keyPath);
				}), d = F(F({}, i), { mutate: function(s) {
					var c = s.trans, l = s.mutatedParts ||= {}, d = function(e) {
						var n = `idb://${t}/${r}/${e}`;
						return l[n] || (l[n] = new wo());
					}, f = d(""), p = d(":dels"), m = s.type, h = s.type === "deleteRange" ? [s.range] : s.type === "delete" ? [s.keys] : s.values.length < 50 ? [Go(o, s).filter(function(e) {
						return e != null;
					}), s.values] : [], g = h[0], _ = h[1], v = s.trans._cache;
					if (Dn(g)) {
						f.addKeys(g);
						var y = m === "delete" || g.length === _.length ? Jo(g, v) : null;
						y || p.addKeys(g), (y || _) && $o(d, a, y, _);
					} else if (g) {
						var b = {
							from: g.lower ?? e.MIN_KEY,
							to: g.upper ?? e.MAX_KEY
						};
						p.add(b), f.add(b);
					} else f.add(n), p.add(n), a.indexes.forEach(function(e) {
						return d(e.name).add(n);
					});
					return i.mutate(s).then(function(e) {
						return g && (s.type === "add" || s.type === "put") && (f.addKeys(e.results), u && u.forEach(function(t) {
							for (var n = s.values.map(function(e) {
								return t.extractKey(e);
							}), r = t.keyPath.findIndex(function(e) {
								return e === o.keyPath;
							}), i = 0, a = e.results.length; i < a; ++i) n[i][r] = e.results[i];
							d(t.name).addKeys(n);
						})), c.mutatedParts = jo(c.mutatedParts || {}, l), e;
					});
				} }), f = function(t) {
					var n = t.query, r = n.index, i = n.range;
					return [r, new wo(i.lower ?? e.MIN_KEY, i.upper ?? e.MAX_KEY)];
				}, p = {
					get: function(e) {
						return [o, new wo(e.key)];
					},
					getMany: function(e) {
						return [o, new wo().addKeys(e.keys)];
					},
					count: f,
					query: f,
					openCursor: f
				};
				return En(p).forEach(function(e) {
					d[e] = function(a) {
						var o = L.subscr, s = !!o, u = Xo(L, i) && Zo(e, a) ? a.obsSet = {} : o;
						if (s) {
							var d = function(e) {
								var n = `idb://${t}/${r}/${e}`;
								return u[n] || (u[n] = new wo());
							}, f = d(""), m = d(":dels"), h = p[e](a), g = h[0], _ = h[1];
							if (e === "query" && g.isPrimaryKey && !a.values ? m.add(_) : d(g.name || "").add(_), !g.isPrimaryKey) {
								if (e === "count") m.add(n);
								else {
									var v = e === "query" && l && a.values && i.query(F(F({}, a), { values: !1 }));
									return i[e].apply(this, arguments).then(function(t) {
										if (e === "query") {
											if (l && a.values) return v.then(function(e) {
												var n = e.result;
												return f.addKeys(n), t;
											});
											var n = a.values ? t.result.map(c) : t.result;
											a.values ? f.addKeys(n) : m.addKeys(n);
										} else if (e === "openCursor") {
											var r = t, i = a.values;
											return r && Object.create(r, {
												key: { get: function() {
													return m.addKey(r.primaryKey), r.key;
												} },
												primaryKey: { get: function() {
													var e = r.primaryKey;
													return m.addKey(e), e;
												} },
												value: { get: function() {
													return i && f.addKey(r.primaryKey), r.value;
												} }
											});
										}
										return t;
									});
								}
							}
						}
						return i[e].apply(this, arguments);
					};
				}), d;
			}
		});
	}
};
function $o(e, t, n, r) {
	function i(t) {
		var i = e(t.name || "");
		function a(e) {
			return e == null ? null : t.extractKey(e);
		}
		var o = function(e) {
			return t.multiEntry && Dn(e) ? e.forEach(function(e) {
				return i.addKey(e);
			}) : i.addKey(e);
		};
		(n || r).forEach(function(e, t) {
			var i = n && a(n[t]), s = r && a(r[t]);
			B(i, s) !== 0 && (i != null && o(i), s != null && o(s));
		});
	}
	t.indexes.forEach(i);
}
function es(e, t, n) {
	if (n.numFailures === 0) return t;
	if (t.type === "deleteRange") return null;
	var r = t.keys ? t.keys.length : "values" in t && t.values ? t.values.length : 1;
	if (n.numFailures === r) return null;
	var i = F({}, t);
	return Dn(i.keys) && (i.keys = i.keys.filter(function(e, t) {
		return !(t in n.failures);
	})), "values" in i && Dn(i.values) && (i.values = i.values.filter(function(e, t) {
		return !(t in n.failures);
	})), i;
}
function ts(e, t) {
	return t.lower === void 0 ? !0 : t.lowerOpen ? B(e, t.lower) > 0 : B(e, t.lower) >= 0;
}
function ns(e, t) {
	return t.upper === void 0 ? !0 : t.upperOpen ? B(e, t.upper) < 0 : B(e, t.upper) <= 0;
}
function rs(e, t) {
	return ts(e, t) && ns(e, t);
}
function is(e, t, n, r, i, a) {
	if (!n || n.length === 0) return e;
	var o = t.query.index, s = o.multiEntry, c = t.query.range, l = r.schema.primaryKey.extractKey, u = o.extractKey, d = (o.lowLevelIndex || o).extractKey, f = n.reduce(function(e, n) {
		var r = e, i = [];
		if (n.type === "add" || n.type === "put") for (var a = new wo(), o = n.values.length - 1; o >= 0; --o) {
			var d = n.values[o], f = l(d);
			if (!a.hasKey(f)) {
				var p = u(d);
				(s && Dn(p) ? p.some(function(e) {
					return rs(e, c);
				}) : rs(p, c)) && (a.addKey(f), i.push(d));
			}
		}
		switch (n.type) {
			case "add":
				var m = new wo().addKeys(t.values ? e.map(function(e) {
					return l(e);
				}) : e);
				r = e.concat(t.values ? i.filter(function(e) {
					var t = l(e);
					return !m.hasKey(t) && (m.addKey(t), !0);
				}) : i.map(function(e) {
					return l(e);
				}).filter(function(e) {
					return !m.hasKey(e) && (m.addKey(e), !0);
				}));
				break;
			case "put":
				var h = new wo().addKeys(n.values.map(function(e) {
					return l(e);
				}));
				r = e.filter(function(e) {
					return !h.hasKey(t.values ? l(e) : e);
				}).concat(t.values ? i : i.map(function(e) {
					return l(e);
				}));
				break;
			case "delete":
				var g = new wo().addKeys(n.keys);
				r = e.filter(function(e) {
					return !g.hasKey(t.values ? l(e) : e);
				});
				break;
			case "deleteRange":
				var _ = n.range;
				r = e.filter(function(e) {
					return !rs(l(e), _);
				});
		}
		return r;
	}, e);
	if (f === e) return e;
	var p = function(e, t) {
		return B(d(e), d(t)) || B(l(e), l(t));
	};
	return f.sort(t.direction === "prev" || t.direction === "prevunique" ? function(e, t) {
		return p(t, e);
	} : p), t.limit && t.limit < Infinity && (f.length > t.limit ? f.length = t.limit : e.length === t.limit && f.length < t.limit && (i.dirty = !0)), a ? Object.freeze(f) : f;
}
function as(e, t) {
	return B(e.lower, t.lower) === 0 && B(e.upper, t.upper) === 0 && !!e.lowerOpen == !!t.lowerOpen && !!e.upperOpen == !!t.upperOpen;
}
function os(e, t, n, r) {
	if (e === void 0) return t === void 0 ? 0 : -1;
	if (t === void 0) return 1;
	var i = B(e, t);
	if (i === 0) {
		if (n && r) return 0;
		if (n) return 1;
		if (r) return -1;
	}
	return i;
}
function ss(e, t, n, r) {
	if (e === void 0) return t === void 0 ? 0 : 1;
	if (t === void 0) return -1;
	var i = B(e, t);
	if (i === 0) {
		if (n && r) return 0;
		if (n) return -1;
		if (r) return 1;
	}
	return i;
}
function cs(e, t) {
	return os(e.lower, t.lower, e.lowerOpen, t.lowerOpen) <= 0 && ss(e.upper, t.upper, e.upperOpen, t.upperOpen) >= 0;
}
function ls(e, t, n, r) {
	var i = No[`idb://${e}/${t}`];
	if (!i) return [];
	var a = i.queries[n];
	if (!a) return [
		null,
		!1,
		i,
		null
	];
	var o = a[(r.query ? r.query.index.name : null) || ""];
	if (!o) return [
		null,
		!1,
		i,
		null
	];
	switch (n) {
		case "query":
			var s = r.direction ?? "next", c = o.find(function(e) {
				return e.req.limit === r.limit && e.req.values === r.values && (e.req.direction ?? "next") === s && as(e.req.query.range, r.query.range);
			});
			return c ? [
				c,
				!0,
				i,
				o
			] : [
				o.find(function(e) {
					return ("limit" in e.req ? e.req.limit : Infinity) >= r.limit && (e.req.direction ?? "next") === s && (!r.values || e.req.values) && cs(e.req.query.range, r.query.range);
				}),
				!1,
				i,
				o
			];
		case "count":
			var l = o.find(function(e) {
				return as(e.req.query.range, r.query.range);
			});
			return [
				l,
				!!l,
				i,
				o
			];
	}
}
function us(e, t, n, r) {
	e.subscribers.add(n), r.addEventListener("abort", function() {
		e.subscribers.delete(n), e.subscribers.size === 0 && ds(e, t);
	});
}
function ds(e, t) {
	setTimeout(function() {
		e.subscribers.size === 0 && or(t, e);
	}, 3e3);
}
var fs = {
	stack: "dbcore",
	level: 0,
	name: "Cache",
	create: function(e) {
		var t = e.schema.name;
		return F(F({}, e), {
			transaction: function(n, r, i) {
				var a = e.transaction(n, r, i);
				if (r === "readwrite") {
					var o = new AbortController(), s = o.signal, c = function(i) {
						return function() {
							if (o.abort(), r === "readwrite") {
								for (var s = /* @__PURE__ */ new Set(), c = 0, l = n; c < l.length; c++) {
									var u = l[c], d = No[`idb://${t}/${u}`];
									if (d) {
										var f = e.table(u), p = d.optimisticOps.filter(function(e) {
											return e.trans === a;
										});
										if (a._explicit && i && a.mutatedParts) for (var m = 0, h = Object.values(d.queries.query); m < h.length; m++) for (var g = h[m], _ = 0, v = g.slice(); _ < v.length; _++) {
											var y = v[_];
											Mo(y.obsSet, a.mutatedParts) && (or(g, y), y.subscribers.forEach(function(e) {
												return s.add(e);
											}));
										}
										else if (p.length > 0) {
											d.optimisticOps = d.optimisticOps.filter(function(e) {
												return e.trans !== a;
											});
											for (var b = 0, x = Object.values(d.queries.query); b < x.length; b++) for (var g = x[b], S = 0, C = g.slice(); S < C.length; S++) {
												var y = C[S];
												if (y.res != null && a.mutatedParts) {
													if (i && !y.dirty) {
														var w = Object.isFrozen(y.res), T = is(y.res, y.req, p, f, y, w);
														y.dirty ? (or(g, y), y.subscribers.forEach(function(e) {
															return s.add(e);
														})) : T !== y.res && (y.res = T, y.promise = R.resolve({ result: T }));
													} else y.dirty && or(g, y), y.subscribers.forEach(function(e) {
														return s.add(e);
													});
												}
											}
										}
									}
								}
								s.forEach(function(e) {
									return e();
								});
							}
						};
					};
					a.addEventListener("abort", c(!1), { signal: s }), a.addEventListener("error", c(!1), { signal: s }), a.addEventListener("complete", c(!0), { signal: s });
				}
				return a;
			},
			table: function(n) {
				var r = e.table(n), i = r.schema.primaryKey;
				return F(F({}, r), {
					mutate: function(e) {
						var a = L.trans;
						if (i.outbound || a.db._options.cache === "disabled" || a.explicit || a.idbtrans.mode !== "readwrite") return r.mutate(e);
						var o = No[`idb://${t}/${n}`];
						if (!o) return r.mutate(e);
						var s = r.mutate(e);
						return (e.type === "add" || e.type === "put") && (e.values.length >= 50 || Go(i, e).some(function(e) {
							return e == null;
						})) ? s.then(function(t) {
							var n = es(o, F(F({}, e), { values: e.values.map(function(e, n) {
								if (t.failures[n]) return e;
								var r = i.keyPath?.includes(".") ? er(e) : F({}, e);
								return Gn(r, i.keyPath, t.results[n]), r;
							}) }), t);
							o.optimisticOps.push(n), queueMicrotask(function() {
								return e.mutatedParts && Io(e.mutatedParts);
							});
						}) : (o.optimisticOps.push(e), e.mutatedParts && Io(e.mutatedParts), s.then(function(t) {
							if (t.numFailures > 0) {
								or(o.optimisticOps, e);
								var n = es(o, e, t);
								n && o.optimisticOps.push(n), e.mutatedParts && Io(e.mutatedParts);
							}
						}), s.catch(function() {
							or(o.optimisticOps, e), e.mutatedParts && Io(e.mutatedParts);
						})), s;
					},
					query: function(e) {
						if (!Xo(L, r) || !Zo("query", e)) return r.query(e);
						var i = L.trans?.db._options.cache === "immutable", a = L, o = a.requery, s = a.signal, c = ls(t, n, "query", e), l = c[0], u = c[1], d = c[2], f = c[3];
						if (l && u) l.obsSet = e.obsSet;
						else {
							var p = r.query(e).then(function(e) {
								var t = e.result;
								if (l && (l.res = t), i) {
									for (var n = 0, r = t.length; n < r; ++n) Object.freeze(t[n]);
									Object.freeze(t);
								}
								return e;
							}).catch(function(e) {
								return f && l && or(f, l), Promise.reject(e);
							});
							l = {
								obsSet: e.obsSet,
								promise: p,
								subscribers: /* @__PURE__ */ new Set(),
								type: "query",
								req: e,
								dirty: !1
							}, f ? f.push(l) : (f = [l], d ||= No[`idb://${t}/${n}`] = {
								queries: {
									query: {},
									count: {}
								},
								objs: /* @__PURE__ */ new Map(),
								optimisticOps: [],
								unsignaledParts: {}
							}, d.queries.query[e.query.index.name || ""] = f);
						}
						return us(l, f, o, s), l.promise.then(function(t) {
							var n = is(t.result, e, d?.optimisticOps, r, l, i);
							return { result: i ? n : er(n) };
						});
					}
				});
			}
		});
	}
};
function ps(e, t) {
	return new Proxy(e, { get: function(e, n, r) {
		return n === "db" ? t : Reflect.get(e, n, r);
	} });
}
var ms = function() {
	function e(t, n) {
		var r = this;
		this._middlewares = {}, this.verno = 0;
		var i = e.dependencies;
		this._options = n = F({
			addons: e.addons,
			autoOpen: !0,
			indexedDB: i.indexedDB,
			IDBKeyRange: i.IDBKeyRange,
			cache: "cloned",
			maxConnections: zi
		}, n), this._deps = {
			indexedDB: n.indexedDB,
			IDBKeyRange: n.IDBKeyRange
		};
		var a = n.addons;
		this._dbSchema = {}, this._versions = [], this._storeNames = [], this._allTables = {}, this.idbdb = null, this._novip = this;
		var o = {
			dbOpenError: null,
			isBeingOpened: !1,
			onReadyBeingFired: null,
			openComplete: !1,
			dbReadyResolve: Cr,
			dbReadyPromise: null,
			cancelOpen: Cr,
			openCanceller: null,
			autoSchema: !0,
			PR1398_maxLoop: 3,
			autoOpen: n.autoOpen
		};
		o.dbReadyPromise = new R(function(e) {
			o.dbReadyResolve = e;
		}), o.openCanceller = new R(function(e, t) {
			o.cancelOpen = t;
		}), this._state = o, this.name = t, this.on = ta(this, "populate", "blocked", "versionchange", "close", { ready: [jr, Cr] }), this.once = function(e, t) {
			var n = function() {
				var i = [...arguments];
				r.on(e).unsubscribe(n), t.apply(r, i);
			};
			return r.on(e, n);
		}, this.on.ready.subscribe = Bn(this.on.ready.subscribe, function(t) {
			return function(n, i) {
				e.vip(function() {
					var e = r._state;
					if (e.openComplete) e.dbOpenError || R.resolve().then(n), i && t(n);
					else if (e.onReadyBeingFired) e.onReadyBeingFired.push(n), i && t(n);
					else {
						t(n);
						var a = r;
						i || t(function e() {
							a.on.ready.unsubscribe(n), a.on.ready.unsubscribe(e);
						});
					}
				});
			};
		}), this.Collection = pa(this), this.Table = ra(this), this.Transaction = Ma(this), this.Version = fo(this), this.WhereClause = Ta(this), this.on("versionchange", function(e) {
			e.newVersion > 0 ? console.warn(`Another connection wants to upgrade database '${r.name}'. Closing db now to resume the upgrade.`) : console.warn(`Another connection wants to delete database '${r.name}'. Closing db now to resume the delete request.`), r.close({ disableAutoOpen: !1 });
		}), this.on("blocked", function(e) {
			!e.newVersion || e.newVersion < e.oldVersion ? console.warn(`Dexie.delete('${r.name}') was blocked`) : console.warn(`Upgrade '${r.name}' blocked by other connection holding version ${e.oldVersion / 10}`);
		}), this._maxKey = La(n.IDBKeyRange), this._createTransaction = function(e, t, n, i) {
			return new r.Transaction(e, t, n, r._options.chromeTransactionDurability, i);
		}, this._fireOnBlocked = function(e) {
			r.on("blocked").fire(e), po.toArray().filter(function(e) {
				return e.name === r.name && e !== r && !e._state.vcFired;
			}).map(function(t) {
				return t.on("versionchange").fire(e);
			});
		}, this.use(Yo), this.use(fs), this.use(Qo), this.use(Uo), this.use(Ko);
		var s = new Proxy(this, { get: function(e, t, n) {
			if (t === "_vip") return !0;
			if (t === "table") return function(e) {
				return ps(r.table(e), s);
			};
			var i = Reflect.get(e, t, n);
			return i instanceof ea ? ps(i, s) : t === "tables" ? i.map(function(e) {
				return ps(e, s);
			}) : t === "_createTransaction" ? function() {
				return ps(i.apply(this, arguments), s);
			} : i;
		} });
		this.vip = s, a.forEach(function(e) {
			return e(r);
		});
	}
	return e.prototype.version = function(e) {
		if (isNaN(e) || e < .1) throw new I.Type("Given version is not a positive number");
		if (e = Math.round(e * 10) / 10, this.idbdb || this._state.isBeingOpened) throw new I.Schema("Cannot add version when database is open");
		this.verno = Math.max(this.verno, e);
		var t = this._versions, n = t.filter(function(t) {
			return t._cfg.version === e;
		})[0];
		return n || (n = new this.Version(e), t.push(n), t.sort(Ya), n.stores({}), this._state.autoSchema = !1, n);
	}, e.prototype._whenReady = function(e) {
		var t = this;
		return this.idbdb && (this._state.openComplete || L.letThrough || this._vip) ? e() : new R(function(e, n) {
			if (t._state.openComplete) return n(new I.DatabaseClosed(t._state.dbOpenError));
			if (!t._state.isBeingOpened) {
				if (!t._state.autoOpen) {
					n(new I.DatabaseClosed());
					return;
				}
				t.open().catch(Cr);
			}
			t._state.dbReadyPromise.then(e, n);
		}).then(e);
	}, e.prototype.use = function(e) {
		var t = e.stack, n = e.create, r = e.level, i = e.name;
		i && this.unuse({
			stack: t,
			name: i
		});
		var a = this._middlewares[t] || (this._middlewares[t] = []);
		return a.push({
			stack: t,
			create: n,
			level: r ?? 10,
			name: i
		}), a.sort(function(e, t) {
			return e.level - t.level;
		}), this;
	}, e.prototype.unuse = function(e) {
		var t = e.stack, n = e.name, r = e.create;
		return t && this._middlewares[t] && (this._middlewares[t] = this._middlewares[t].filter(function(e) {
			return r ? e.create !== r : n ? e.name !== n : !1;
		})), this;
	}, e.prototype.open = function() {
		var e = this;
		return Ai(Xr, function() {
			return zo(e);
		});
	}, e.prototype._close = function() {
		this.on.close.fire(new CustomEvent("close"));
		var e = this._state;
		if (po.remove(this), this.idbdb) {
			try {
				this.idbdb.close();
			} catch {}
			this.idbdb = null;
		}
		e.isBeingOpened || (e.dbReadyPromise = new R(function(t) {
			e.dbReadyResolve = t;
		}), e.openCanceller = new R(function(t, n) {
			e.cancelOpen = n;
		}));
	}, e.prototype.close = function(e) {
		var t = (e === void 0 ? { disableAutoOpen: !0 } : e).disableAutoOpen, n = this._state;
		t ? (n.isBeingOpened && n.cancelOpen(new I.DatabaseClosed()), this._close(), n.autoOpen = !1, n.dbOpenError = new I.DatabaseClosed()) : (this._close(), n.autoOpen = this._options.autoOpen || n.isBeingOpened, n.openComplete = !1, n.dbOpenError = null);
	}, e.prototype.delete = function(e) {
		var t = this;
		e === void 0 && (e = { disableAutoOpen: !0 });
		var n = arguments.length > 0 && typeof arguments[0] != "object", r = this._state;
		return new R(function(i, a) {
			var o = function() {
				t.close(e);
				var n = t._deps.indexedDB.deleteDatabase(t.name);
				n.onsuccess = hi(function() {
					yo(t._deps, t.name), i();
				}), n.onerror = Ea(a), n.onblocked = t._fireOnBlocked;
			};
			if (n) throw new I.InvalidArgument("Invalid closeOptions argument to db.delete()");
			r.isBeingOpened ? r.dbReadyPromise.then(o) : o();
		});
	}, e.prototype.backendDB = function() {
		return this.idbdb;
	}, e.prototype.isOpen = function() {
		return this.idbdb !== null;
	}, e.prototype.hasBeenClosed = function() {
		var e = this._state.dbOpenError;
		return e && e.name === "DatabaseClosedError";
	}, e.prototype.hasFailed = function() {
		return this._state.dbOpenError !== null;
	}, e.prototype.dynamicallyOpened = function() {
		return this._state.autoSchema;
	}, Object.defineProperty(e.prototype, "tables", {
		get: function() {
			var e = this;
			return En(this._allTables).map(function(t) {
				return e._allTables[t];
			});
		},
		enumerable: !1,
		configurable: !0
	}), e.prototype.transaction = function() {
		var e = Vo.apply(this, arguments);
		return this._transaction.apply(this, e);
	}, e.prototype._transaction = function(e, t, n) {
		var r = this, i = L.trans;
		i && i.db === this && e.indexOf("!") === -1 || (i = null);
		var a = e.indexOf("?") !== -1;
		e = e.replace("!", "").replace("?", "");
		var o, s;
		try {
			if (s = t.map(function(e) {
				var t = e instanceof r.Table ? e.name : e;
				if (typeof t != "string") throw TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");
				return t;
			}), e == "r" || e === Vi) o = Vi;
			else if (e == "rw" || e == Hi) o = Hi;
			else throw new I.InvalidArgument("Invalid transaction mode: " + e);
			if (i) {
				if (i.mode === Vi && o === Hi) {
					if (a) i = null;
					else throw new I.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
				}
				i && s.forEach(function(e) {
					if (i && i.storeNames.indexOf(e) === -1) {
						if (a) i = null;
						else throw new I.SubTransaction("Table " + e + " not included in parent transaction.");
					}
				}), a && i && !i.active && (i = null);
			}
		} catch (e) {
			return i ? i._promise(null, function(t, n) {
				n(e);
			}) : z(e);
		}
		var c = H.bind(null, this, o, s, i, n);
		return i ? i._promise(o, c, "lock") : L.trans ? Ai(L.transless, function() {
			return r._whenReady(c);
		}) : this._whenReady(c);
	}, e.prototype.table = function(e) {
		if (!jn(this._allTables, e)) throw new I.InvalidTable(`Table ${e} does not exist`);
		return this._allTables[e];
	}, e;
}(), hs = typeof Symbol < "u" && "observable" in Symbol ? Symbol.observable : "@@observable", gs = function() {
	function e(e) {
		this._subscribe = e;
	}
	return e.prototype.subscribe = function(e, t, n) {
		return this._subscribe(!e || typeof e == "function" ? {
			next: e,
			error: t,
			complete: n
		} : e);
	}, e.prototype[hs] = function() {
		return this;
	}, e;
}(), _s;
try {
	_s = {
		indexedDB: Tn.indexedDB || Tn.mozIndexedDB || Tn.webkitIndexedDB || Tn.msIndexedDB,
		IDBKeyRange: Tn.IDBKeyRange || Tn.webkitIDBKeyRange
	};
} catch {
	_s = {
		indexedDB: null,
		IDBKeyRange: null
	};
}
function vs(e) {
	var t = !1, n, r = new gs(function(r) {
		var i = lr(e);
		function a(t) {
			var n = ci();
			try {
				i && Ci();
				var r = Si(e, t);
				return i && (r = r.finally(wi)), r;
			} finally {
				n && li();
			}
		}
		var o = !1, s, c = {}, l = {}, u = {
			get closed() {
				return o;
			},
			unsubscribe: function() {
				o || (o = !0, s && s.abort(), d && Aa.storagemutated.unsubscribe(m));
			}
		};
		r.start && r.start(u);
		var d = !1, f = function() {
			return Mi(h);
		};
		function p() {
			return Mo(l, c);
		}
		var m = function(e) {
			jo(c, e), p() && f();
		}, h = function() {
			if (!o && _s.indexedDB) {
				c = {};
				var i = {};
				s && s.abort(), s = new AbortController();
				var u = {
					subscr: i,
					signal: s.signal,
					requery: f,
					querier: e,
					trans: null
				}, h = a(u);
				d ||= (Aa.storagemutated.subscribe(m), !0), Promise.resolve(h).then(function(e) {
					t = !0, n = e, o || u.signal.aborted || (p() ? f() : (l = i, p() ? f() : (c = {}, Mi(function() {
						return !o && r.next && r.next(e);
					}))));
				}, function(e) {
					o || u.signal.aborted || (t = !1, ["DatabaseClosedError", "AbortError"].includes(e?.name) || o || Mi(function() {
						o || r.error && r.error(e);
					}));
				});
			}
		};
		return setTimeout(f, 0), u;
	});
	return r.hasValue = function() {
		return t;
	}, r.getValue = function() {
		return n;
	}, r;
}
var ys = ms;
Mn(ys, F(F({}, Sr), {
	delete: function(e) {
		return new ys(e, { addons: [] }).delete();
	},
	exists: function(e) {
		return new ys(e, { addons: [] }).open().then(function(e) {
			return e.close(), !0;
		}).catch("NoSuchDatabaseError", function() {
			return !1;
		});
	},
	getDatabaseNames: function(e) {
		try {
			return _o(ys.dependencies).then(e);
		} catch {
			return z(new I.MissingAPI());
		}
	},
	defineClass: function() {
		function e(e) {
			On(this, e);
		}
		return e;
	},
	ignoreTransaction: function(e) {
		return L.trans ? Ai(L.transless || Xr, e) : e();
	},
	vip: bo,
	async: function(e) {
		return function() {
			try {
				var t = Bo(e.apply(this, arguments));
				return !t || typeof t.then != "function" ? R.resolve(t) : t;
			} catch (e) {
				return z(e);
			}
		};
	},
	spawn: function(e, t, n) {
		try {
			var r = Bo(e.apply(n, t || []));
			return !r || typeof r.then != "function" ? R.resolve(r) : r;
		} catch (e) {
			return z(e);
		}
	},
	currentTransaction: { get: function() {
		return L.trans || null;
	} },
	waitFor: function(e, t) {
		var n = R.resolve(typeof e == "function" ? ys.ignoreTransaction(e) : e).timeout(t || 6e4);
		return L.trans ? L.trans.waitFor(n) : n;
	},
	Promise: R,
	debug: {
		get: function() {
			return Mr;
		},
		set: function(e) {
			Nr(e);
		}
	},
	derive: Fn,
	extend: On,
	props: Mn,
	override: Bn,
	Events: ta,
	on: Aa,
	liveQuery: vs,
	extendObservabilitySet: jo,
	getByKeyPath: Wn,
	setByKeyPath: Gn,
	delByKeyPath: Kn,
	shallowClone: qn,
	deepClone: er,
	getObjectDiff: Wo,
	cmp: B,
	asap: Hn,
	minKey: Ii,
	addons: [],
	connections: { get: po.toArray },
	errnames: vr,
	dependencies: _s,
	cache: No,
	semVer: Pi,
	version: Pi.split(".").map(function(e) {
		return parseInt(e);
	}).reduce(function(e, t, n) {
		return e + t / 10 ** (n * 2);
	})
})), ys.maxKey = La(ys.dependencies.IDBKeyRange), typeof dispatchEvent < "u" && typeof addEventListener < "u" && (Aa(Oa, function(e) {
	if (!xs) {
		var t = new CustomEvent(ka, { detail: e });
		xs = !0, dispatchEvent(t), xs = !1;
	}
}), addEventListener(ka, function(e) {
	var t = e.detail;
	xs || bs(t);
}));
function bs(e) {
	var t = xs;
	try {
		xs = !0, Aa.storagemutated.fire(e), Lo(e, !0);
	} finally {
		xs = t;
	}
}
var xs = !1, Ss, Cs = function() {};
typeof BroadcastChannel < "u" && (Cs = function() {
	Ss = new BroadcastChannel(ka), Ss.onmessage = function(e) {
		return e.data && bs(e.data);
	};
}, Cs(), typeof Ss.unref == "function" && Ss.unref(), Aa(Oa, function(e) {
	xs || Ss.postMessage(e);
})), typeof addEventListener < "u" && (addEventListener("pagehide", function(e) {
	if (!ms.disableBfCache && e.persisted) {
		Mr && console.debug("Dexie: handling persisted pagehide"), Ss?.close();
		for (var t = 0, n = po.toArray(); t < n.length; t++) n[t].close({ disableAutoOpen: !1 });
	}
}), addEventListener("pageshow", function(e) {
	!ms.disableBfCache && e.persisted && (Mr && console.debug("Dexie: handling persisted pageshow"), Cs(), bs({ all: new wo(-Infinity, [[]]) }));
})), R.rejectionMapper = xr, Nr(Mr);
// src/core/notesOrder.ts
var ws = (e) => {
	let t = en(e, "library order"), n = (e) => {
		if (!Array.isArray(e) || !e.every((e) => typeof e == "string")) throw new Gt("library order keys");
		return e;
	};
	return {
		noteOrder: n(t.noteOrder),
		tagOrder: n(t.tagOrder)
	};
};
function Ts(e, t) {
	e.sort((e, t) => t.updatedAt - e.updatedAt || e.key.localeCompare(t.key));
	let n = /* @__PURE__ */ new Map();
	for (let t of e) for (let e of t.tags) {
		let t = Xt(e), r = n.get(t);
		r ? r.count++ : n.set(t, {
			name: e,
			count: 1
		});
	}
	return {
		notes: e,
		tagOrder: [...n.entries()].sort(([, e], [, n]) => n.count - e.count || e.name.localeCompare(n.name, t)).map(([e]) => e)
	};
}
function Es(e, t) {
	return t.filter((t) => e.delete(t)).concat([...e]);
}
function Ds(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e) for (let e of n.tags) t.add(Xt(e));
	return t;
}
var Os = (e, t) => e.length === t.length && e.every((e, n) => e === t[n]);
function ks(e, t, n, r) {
	let i = e.indexOf(t), a = e.indexOf(n);
	if (i < 0 || a < 0 || i === a) return;
	let o = a - Number(i < a) + Number(r === "after");
	if (i === o) return;
	let s = e.slice();
	return s.splice(i, 1), s.splice(o, 0, t), s;
}
// src/core/notesCodec.ts
var As = (e) => {
	if (e.length > Wt.backupCharacters) throw new qt();
	let t;
	try {
		t = JSON.parse(e);
	} catch {
		throw new Gt("JSON");
	}
	let n = en(t, "backup");
	if (n.format !== "music-notes" || n.version !== 1 && n.version !== 2) throw new Gt("backup version");
	if (!Array.isArray(n.notes)) throw new Gt("backup notes");
	if (n.notes.length > Wt.records) throw new qt();
	let r = n.notes.map((e) => cn(e));
	if (new Set(r.map((e) => e.key)).size !== r.length) throw new Gt("duplicate song");
	if (n.version === 1) return { notes: r };
	let i = [...Ds(r)], a = n.tagOrder;
	if (!Array.isArray(a) || a.length !== i.length || new Set(a).size !== i.length) throw new Gt("backup tag order");
	return {
		notes: r,
		tagOrder: a.map((e) => {
			if (typeof e != "number" || !Number.isInteger(e) || e < 0 || e >= i.length) throw new Gt("backup tag index");
			return i[e];
		})
	};
}, js = "{\"format\":\"music-notes\",\"version\":2,\"notes\":[\n", Ms = "\n],\"tagOrder\":[", Ns = "]}", Ps = (e, t, n = []) => {
	if (e.length > Wt.records) throw new qt();
	let r = 63, i = /* @__PURE__ */ new Map(), a = [];
	for (let [n, o] of e.entries()) {
		let e = cn(o), s = JSON.stringify(e);
		r += s.length + (n > 0 ? 2 : 0);
		for (let t of e.tags) {
			let e = Xt(t);
			if (i.has(e)) continue;
			let n = i.size;
			i.set(e, n), r += String(n).length + Number(n > 0);
		}
		if (r > Wt.backupCharacters) throw new qt();
		t && a.push(s);
	}
	if (!t) return "";
	let o = Es(new Set(i.keys()), n).map((e) => i.get(e));
	return js + a.join(",\n") + Ms + o.join(",") + Ns;
}, Fs = (e) => {
	Ps(e, !1);
}, Is = (e, t) => Ps(e, !0, t), Ls = async (e) => {
	let t = (await e.table("notes").toArray()).reduce((e, t) => Math.max(e, cn(t).revision), 0);
	await e.table("metadata").put({
		key: "revision",
		value: t
	});
}, Rs = async (e, t) => {
	let n = en(await e.get("revision"), "revision counter"), r = n.value;
	if (n.key !== "revision" || typeof r != "number" || !Number.isSafeInteger(r) || r < 0 || !Number.isSafeInteger(t) || t < 1 || r > 2 ** 53 - 1 - t) throw new Gt("revision counter");
	return await e.put({
		key: "revision",
		value: r + t
	}), r + 1;
}, zs = class extends ms {
	constructor(e, t) {
		super(e), this.version(1).stores({ notes: "key" }), this.version(2).stores({
			notes: "key",
			metadata: "key"
		}).upgrade(Ls), this.version(3).stores({}).upgrade(async (e) => {
			let { notes: n, tagOrder: r } = Ts((await e.table("notes").toArray()).map(cn), t);
			await e.table("metadata").put({
				key: "order",
				noteOrder: n.map((e) => e.key),
				tagOrder: r
			});
		}), this.on("populate", Ls), this.on("populate", (e) => e.table("metadata").put({
			key: "order",
			noteOrder: [],
			tagOrder: []
		}));
	}
}, Bs = (e = {}) => {
	let t = new zs(e.databaseName ?? "FoliaMusicNotes", e.locale), n = e.now ?? Date.now, r = async (e) => {
		let n = await t.notes.get(e);
		if (n === void 0) return;
		let r = cn(n);
		if (r.key !== e) throw new Gt("stored key");
		return r;
	}, i = async () => (await t.notes.toArray()).map(cn), a = async () => ws(await t.metadata.get("order")), o = () => t.transaction("r", t.notes, t.metadata, async () => {
		let [e, t] = await Promise.all([i(), a()]), n = new Map(e.map((e) => [e.key, e]));
		return {
			notes: Es(new Set(n.keys()), t.noteOrder).map((e) => n.get(e)),
			tagOrder: Es(Ds(e), t.tagOrder)
		};
	}), s = async (e, n = [], r = []) => {
		let i = await a(), o = Es(new Set(e.map((e) => e.key)), n.concat(i.noteOrder)), s = Es(Ds(e), i.tagOrder.concat(r));
		Os(o, i.noteOrder) && Os(s, i.tagOrder) || await t.metadata.put({
			key: "order",
			noteOrder: o,
			tagOrder: s
		});
	}, c = async (e, n) => {
		let r = new Map(e.map((e) => [e.key, e]));
		return t.transaction("rw", t.notes, t.metadata, async () => {
			let a = [...r.keys()], o = await t.notes.bulkGet(a), c = a.flatMap((e, t) => {
				let n = o[t];
				if (n !== void 0) return cn(n), [];
				let i = r.get(e);
				return i ? [i] : [];
			});
			if (await t.notes.count() + c.length > Wt.records) throw new qt();
			if (c.length > 0) {
				let e = await Rs(t.metadata, c.length), r = c.map((t, n) => ({
					...t,
					revision: e + n
				})), a = (await i()).concat(r);
				Fs(a), await t.notes.bulkAdd(r), await s(a, r.map((e) => e.key), n);
			}
			return {
				added: c.length,
				skipped: e.length - c.length
			};
		});
	}, l = async (e) => {
		let n = e.map((e) => M(rn(e.song)));
		n.length && await t.transaction("rw", t.notes, t.metadata, async () => {
			let r = await t.notes.bulkGet(n);
			r.forEach((t, n) => {
				$t(t === void 0 ? void 0 : cn(t), e[n].revision);
			}), r.some((e) => e !== void 0) && (await t.notes.bulkDelete(n), await s(await i()));
		});
	};
	return {
		list: async () => (await o()).notes,
		library: o,
		async move(e, n, r, i) {
			e !== "note" && e !== "tag" || i !== "before" && i !== "after" || await t.transaction("rw", t.metadata, async () => {
				let o = await a(), s = e === "note" ? "noteOrder" : "tagOrder", c = ks(o[s], n, r, i);
				c && await t.metadata.put({
					key: "order",
					...o,
					[s]: c
				});
			});
		},
		watch(e, n) {
			let r = vs(() => Promise.all([
				t.metadata.get("revision"),
				t.metadata.get("order"),
				t.notes.count()
			])).subscribe({
				next: e,
				error: n
			});
			return () => r.unsubscribe();
		},
		get: (e) => r(M(rn(e))),
		async importSongs(e) {
			if (e.length > Wt.records) throw new qt();
			let t = n(), r = e.map((e) => {
				let n = an(e);
				return cn({
					key: M(n),
					song: n,
					...Jt(),
					createdAt: t,
					updatedAt: t,
					revision: 1
				});
			});
			return c(r);
		},
		async save(e, a, o) {
			let c = an(e), l = sn(a), u = M(c);
			return t.transaction("rw", t.notes, t.metadata, async () => {
				let e = await r(u);
				if ($t(e, o), !e && await t.notes.count() >= Wt.records) throw new qt();
				let a = Math.max(n(), e?.updatedAt ?? 0), d = cn({
					key: u,
					song: c,
					...l,
					createdAt: e?.createdAt ?? a,
					updatedAt: a,
					revision: await Rs(t.metadata, 1)
				}), f = (await i()).filter((e) => e.key !== u).concat(d);
				return Fs(f), await t.notes.put(d), e && Os(e.tags, d.tags) || await s(f, e ? [] : [u]), d;
			});
		},
		remove: (e, t) => l([{
			song: e,
			revision: t
		}]),
		removeMany: l,
		async exportBackup() {
			let { notes: e, tagOrder: t } = await o();
			return Is(e, t);
		},
		async importBackup(t) {
			let n = As(t), r = n.tagOrder === void 0 ? Ts(n.notes, e.locale) : n;
			return c(r.notes, r.tagOrder);
		},
		close: () => t.close()
	};
}, Vs = {
	"zh-CN": { translation: { musicNotes: {
		title: "音乐笔记",
		shortcutLabel: "打开音乐笔记",
		shortcutEnabled: "启用快捷键",
		shortcutClear: "清空快捷键",
		shortcutCapture: "按下组合键",
		shortcutNone: "未绑定",
		shortcutConflict: "{{binding}} 按键冲突",
		shortcutUnsupported: "不支持此组合键",
		shortcutReset: "恢复",
		stats: "{{songs}} 首 · {{moments}} 个时刻",
		viewAll: "查看全部",
		close: "关闭",
		back: "返回",
		cancel: "取消",
		searchHint: "搜索歌名、歌手、标签或笔记",
		filterTag: "按标签筛选",
		all: "全部",
		allNotes: "全部笔记",
		nowPlaying: "正在播放",
		paused: "已暂停",
		writeNote: "记一笔",
		noContent: "还没有内容",
		noMatches: "没有找到",
		clearSearch: "清除搜索",
		firstNote: "给正在听的歌写第一条笔记",
		noCurrent: "播放一首歌后就能开始记录",
		emptyHint: "播放一首歌后就能开始记录",
		play: "播放",
		stop: "停止",
		resume: "继续",
		markHere: "记下这个时刻",
		tags: "标签",
		reason: "正文",
		reasonPlaceholder: "这首歌勾起了我的回忆...",
		bookmarks: "时刻",
		momentCount: "{{count}} 个时刻",
		markHint: "播放时点播放条上的图钉，就能记下这一刻。",
		markMoment: "标记此刻",
		momentRecorded: "已记录时刻 {{time}}",
		bookmarkPlaceholder: "为标记添加注释",
		removeBookmark: "删除时刻",
		removeTag: "移除标签 {{tag}}",
		addTagLabel: "新增标签",
		tagLimit: "每首歌最多 {{tags}} 个标签，每个标签最多 {{length}} 个字符。",
		saving: "保存中…",
		saved: "已保存到本地 · 刚刚",
		saveRetry: "保存失败 · 重试",
		remove: "删除这条笔记",
		confirmRemoveInline: "确认删除？",
		bulkDelete: "批量删除",
		selectAll: "全选",
		deselectAll: "取消全选",
		deleteSelected: "删除（{{count}}）",
		confirmBulkDelete: "确认删除选中的 <strong>{{count}}</strong> 首？",
		deleteConflict: "笔记已更改，请重新确认删除。",
		confirmRemove: "删除",
		loading: "正在读取…",
		retry: "重试",
		failed: "操作失败，请重试。",
		capacity: "笔记内容超出容量。",
		unavailable: "暂时无法播放这首歌。",
		sourceLocal: "本地音乐",
		localBadge: "本地",
		neteaseBadge: "网易",
		sourceNetease: "网易云音乐",
		sourceQq: "QQ 音乐",
		showMore: "显示更多",
		importPlaylist: "从歌单导入",
		loginHint: "请先在 Folia 登录音乐账号。",
		playlist: "歌单",
		playlistSearchHint: "搜索歌单",
		import: "导入",
		importing: "正在导入…",
		noPlaylists: "没有可显示的歌单",
		imported: "已导入 {{added}} 首，跳过 {{skipped}} 首已有歌曲。",
		export: "备份（导出）",
		exported: "已导出备份。",
		restore: "恢复备份（导入）"
	} } },
	"zh-TW": { translation: { musicNotes: {
		title: "音樂筆記",
		shortcutLabel: "打開音樂筆記",
		shortcutEnabled: "啟用快捷鍵",
		shortcutClear: "清空快捷鍵",
		shortcutCapture: "按下組合鍵",
		shortcutNone: "未綁定",
		shortcutConflict: "{{binding}} 按鍵衝突",
		shortcutUnsupported: "不支持此組合鍵",
		shortcutReset: "恢復",
		stats: "{{songs}} 首 · {{moments}} 個時刻",
		viewAll: "查看全部",
		close: "關閉",
		back: "返回",
		cancel: "取消",
		searchHint: "搜索歌名、歌手、標籤或筆記",
		filterTag: "按標籤篩選",
		all: "全部",
		allNotes: "全部筆記",
		nowPlaying: "正在播放",
		paused: "已暫停",
		writeNote: "記一筆",
		noContent: "還沒有內容",
		noMatches: "沒有找到",
		clearSearch: "清除搜索",
		firstNote: "給正在聽的歌寫第一條筆記",
		noCurrent: "播放一首歌后就能開始記錄",
		emptyHint: "播放一首歌后就能開始記錄",
		play: "播放",
		stop: "停止",
		resume: "繼續",
		markHere: "記下這個時刻",
		tags: "標籤",
		reason: "正文",
		reasonPlaceholder: "這首歌勾起了我的回憶...",
		bookmarks: "時刻",
		momentCount: "{{count}} 個時刻",
		markHint: "播放時點播放條上的圖釘，就能記下這一刻。",
		markMoment: "標記此刻",
		momentRecorded: "已記錄時刻 {{time}}",
		bookmarkPlaceholder: "為標記添加註釋",
		removeBookmark: "刪除時刻",
		removeTag: "移除標籤 {{tag}}",
		addTagLabel: "新增標籤",
		tagLimit: "每首歌最多 {{tags}} 個標籤，每個標籤最多 {{length}} 個字符。",
		saving: "保存中…",
		saved: "已保存到本地 · 剛剛",
		saveRetry: "保存失敗 · 重試",
		remove: "刪除這條筆記",
		confirmRemoveInline: "確認刪除？",
		bulkDelete: "批量刪除",
		selectAll: "全選",
		deselectAll: "取消全選",
		deleteSelected: "刪除（{{count}}）",
		confirmBulkDelete: "確認刪除選中的 <strong>{{count}}</strong> 首？",
		deleteConflict: "筆記已更改，請重新確認刪除。",
		confirmRemove: "刪除",
		loading: "正在讀取…",
		retry: "重試",
		failed: "操作失敗，請重試。",
		capacity: "筆記內容超出容量。",
		unavailable: "暫時無法播放這首歌。",
		sourceLocal: "本地音樂",
		localBadge: "本地",
		neteaseBadge: "網易",
		sourceNetease: "網易雲音樂",
		sourceQq: "QQ 音樂",
		showMore: "顯示更多",
		importPlaylist: "從歌單導入",
		loginHint: "請先在 Folia 登錄音樂賬號。",
		playlist: "歌單",
		playlistSearchHint: "搜索歌單",
		import: "導入",
		importing: "正在導入…",
		noPlaylists: "沒有可顯示的歌單",
		imported: "已導入 {{added}} 首，跳過 {{skipped}} 首已有歌曲。",
		export: "備份（導出）",
		exported: "已導出備份。",
		restore: "恢復備份（導入）"
	} } },
	en: { translation: { musicNotes: {
		title: "Music notes",
		shortcutLabel: "Open music notes",
		shortcutEnabled: "Enable shortcuts",
		shortcutClear: "Clear shortcut",
		shortcutCapture: "Press a key combination",
		shortcutNone: "Unassigned",
		shortcutConflict: "{{binding}} is already in use",
		shortcutUnsupported: "Unsupported key combination",
		shortcutReset: "Reset",
		stats: "{{songs}} songs · {{moments}} moments",
		viewAll: "View all",
		close: "Close",
		back: "Back",
		cancel: "Cancel",
		searchHint: "Search songs, artists, tags or notes",
		filterTag: "Filter by tag",
		all: "All",
		allNotes: "All notes",
		nowPlaying: "Now playing",
		paused: "Paused",
		writeNote: "Write a note",
		noContent: "Nothing written yet",
		noMatches: "No results",
		clearSearch: "Clear search",
		firstNote: "Write your first note about the song playing",
		noCurrent: "Play a song to start a note",
		emptyHint: "Play a song to start a note",
		play: "Play",
		stop: "Stop",
		resume: "Resume",
		markHere: "Mark this moment",
		tags: "Tags",
		reason: "Note",
		reasonPlaceholder: "This song brings back memories...",
		bookmarks: "Moments",
		momentCount: "{{count}} moments",
		markHint: "Use the pin on the playback bar to mark a moment.",
		markMoment: "Mark this moment",
		momentRecorded: "Marked {{time}}",
		bookmarkPlaceholder: "Add a note to this marker",
		removeBookmark: "Delete moment",
		removeTag: "Remove tag {{tag}}",
		addTagLabel: "New tag",
		tagLimit: "Use up to {{tags}} tags of {{length}} characters each.",
		saving: "Saving…",
		saved: "Saved locally · just now",
		saveRetry: "Save failed · retry",
		remove: "Delete this note",
		confirmRemoveInline: "Confirm deletion?",
		bulkDelete: "Bulk delete",
		selectAll: "Select all",
		deselectAll: "Deselect all",
		deleteSelected: "Delete ({{count}})",
		confirmBulkDelete: "Delete the notes for <strong>{{count}}</strong> selected songs?",
		deleteConflict: "The notes changed. Review them and confirm deletion again.",
		confirmRemove: "Delete",
		loading: "Loading…",
		retry: "Retry",
		failed: "Could not complete the action. Try again.",
		capacity: "The notebook is at capacity.",
		unavailable: "This song is unavailable right now.",
		sourceLocal: "Local music",
		localBadge: "Local",
		neteaseBadge: "NE",
		sourceNetease: "NetEase Cloud Music",
		sourceQq: "QQ Music",
		showMore: "Show more",
		importPlaylist: "Import from playlist",
		loginHint: "Sign in to a music account in Folia.",
		playlist: "Playlists",
		playlistSearchHint: "Search playlists",
		import: "Import",
		importing: "Importing…",
		noPlaylists: "No playlists found",
		imported: "Imported {{added}} songs and skipped {{skipped}} existing songs.",
		export: "Backup (export)",
		exported: "Backup exported.",
		restore: "Restore backup (import)"
	} } },
	in: { translation: { musicNotes: {
		title: "Catatan musik",
		shortcutLabel: "Buka catatan musik",
		shortcutEnabled: "Aktifkan pintasan",
		shortcutClear: "Hapus pintasan",
		shortcutCapture: "Tekan kombinasi tombol",
		shortcutNone: "Belum diatur",
		shortcutConflict: "{{binding}} sudah digunakan",
		shortcutUnsupported: "Kombinasi tombol tidak didukung",
		shortcutReset: "Pulihkan",
		stats: "{{songs}} lagu · {{moments}} momen",
		viewAll: "Lihat semua",
		close: "Tutup",
		back: "Kembali",
		cancel: "Batal",
		searchHint: "Cari lagu, artis, tag, atau catatan",
		filterTag: "Saring berdasarkan tag",
		all: "Semua",
		allNotes: "Semua catatan",
		nowPlaying: "Sedang diputar",
		paused: "Dijeda",
		writeNote: "Tulis catatan",
		noContent: "Belum ada isi",
		noMatches: "Tidak ditemukan",
		clearSearch: "Hapus pencarian",
		firstNote: "Tulis catatan pertama untuk lagu yang diputar",
		noCurrent: "Putar lagu untuk mulai mencatat",
		emptyHint: "Putar lagu untuk mulai mencatat",
		play: "Putar",
		stop: "Hentikan",
		resume: "Lanjutkan",
		markHere: "Tandai momen ini",
		tags: "Tag",
		reason: "Catatan",
		reasonPlaceholder: "Lagu ini membangkitkan kenanganku...",
		bookmarks: "Momen",
		momentCount: "{{count}} momen",
		markHint: "Ketuk pin pada bilah pemutaran untuk menandai momen ini.",
		markMoment: "Tandai momen ini",
		momentRecorded: "Momen {{time}} ditandai",
		bookmarkPlaceholder: "Tambahkan catatan pada penanda",
		removeBookmark: "Hapus momen",
		removeTag: "Hapus tag {{tag}}",
		addTagLabel: "Tag baru",
		tagLimit: "Gunakan hingga {{tags}} tag, masing-masing hingga {{length}} karakter.",
		saving: "Menyimpan…",
		saved: "Tersimpan di perangkat · baru saja",
		saveRetry: "Gagal menyimpan · coba lagi",
		remove: "Hapus catatan ini",
		confirmRemoveInline: "Konfirmasi penghapusan?",
		bulkDelete: "Hapus beberapa",
		selectAll: "Pilih semua",
		deselectAll: "Batalkan pilihan semua",
		deleteSelected: "Hapus ({{count}})",
		confirmBulkDelete: "Hapus catatan untuk <strong>{{count}}</strong> lagu yang dipilih?",
		deleteConflict: "Catatan telah berubah. Periksa dan konfirmasikan penghapusan lagi.",
		confirmRemove: "Hapus",
		loading: "Memuat…",
		retry: "Coba lagi",
		failed: "Tindakan gagal. Coba lagi.",
		capacity: "Kapasitas catatan terlampaui.",
		unavailable: "Lagu ini belum dapat diputar.",
		sourceLocal: "Musik lokal",
		localBadge: "Lokal",
		neteaseBadge: "NE",
		sourceNetease: "NetEase Cloud Music",
		sourceQq: "QQ Music",
		showMore: "Tampilkan lainnya",
		importPlaylist: "Impor dari daftar putar",
		loginHint: "Masuk ke akun musik di Folia.",
		playlist: "Daftar putar",
		playlistSearchHint: "Cari daftar putar",
		import: "Impor",
		importing: "Mengimpor…",
		noPlaylists: "Tidak ada daftar putar",
		imported: "{{added}} lagu diimpor, {{skipped}} lagu yang sudah ada dilewati.",
		export: "Cadangkan (ekspor)",
		exported: "Cadangan diekspor.",
		restore: "Pulihkan cadangan (impor)"
	} } }
}, Hs = (e) => e ? {
	note: e.note,
	tags: e.tags,
	bookmarks: e.bookmarks
} : Jt(), Us = (e, t) => e === t || JSON.stringify(e) === JSON.stringify(t);
function Ws(e, t, n, r) {
	function i(e, t, n) {
		if (Us(t, e)) return n;
		if (r || Us(n, e) || Us(n, t)) return t;
		throw new Kt();
	}
	return {
		note: i(e.note, t.note, n.note),
		tags: i(e.tags, t.tags, n.tags),
		bookmarks: i(e.bookmarks, t.bookmarks, n.bookmarks)
	};
}
var Gs = class {
	constructor(e = Bs()) {
		this.db = e, this.listeners = /* @__PURE__ */ new Set(), this.records = /* @__PURE__ */ new Map(), this.edits = /* @__PURE__ */ new Map(), this.removing = /* @__PURE__ */ new Set(), this.snapshot = {
			ready: !1,
			notes: [],
			tagOrder: [],
			error: !1
		}, this.readVersion = 0, this.orderWrite = Promise.resolve(), this.closing = !1, this.subscribe = (e) => (this.listeners.add(e), () => {
			this.listeners.delete(e);
		}), this.getSnapshot = () => this.snapshot, this.unwatch = this.db.watch(() => {
			this.refresh().catch((e) => this.readError(e));
		}, (e) => this.readError(e));
	}
	getDraft(e) {
		let t = M(e);
		return this.edits.get(t)?.draft ?? Hs(this.records.get(t));
	}
	status(e) {
		let t = M(e), n = this.edits.get(t);
		return n ? n.failed ? "error" : "saving" : this.records.has(t) ? "saved" : "idle";
	}
	publish() {
		let e = new Map(this.records), t = [];
		for (let [n, { song: r, base: i, draft: a, updatedAt: o }] of this.edits) {
			let s = {
				key: n,
				song: r,
				...a,
				revision: i?.revision ?? 0,
				updatedAt: o,
				createdAt: i?.createdAt ?? o
			};
			e.has(n) ? e.set(n, s) : t.push(s);
		}
		let n = [...t.reverse(), ...e.values()];
		this.snapshot = {
			...this.snapshot,
			notes: n
		};
		for (let e of this.listeners) e();
	}
	readError(e) {
		this.closing || (console.warn("[MusicNotes] Could not read the notebook", e), this.snapshot = {
			...this.snapshot,
			error: !0
		}, this.publish());
	}
	refresh() {
		return this.readVersion++, this.reading ??= this.readChanges();
	}
	async readChanges() {
		try {
			let e;
			do {
				e = this.readVersion;
				let { notes: t, tagOrder: n } = await this.db.library();
				if (this.closing) return;
				e === this.readVersion && (this.records = new Map(t.map((e) => [e.key, e])), this.snapshot = {
					...this.snapshot,
					tagOrder: n,
					ready: !0,
					error: !1
				}, this.publish());
			} while (e !== this.readVersion);
		} finally {
			this.reading = void 0;
		}
	}
	edit(e, t, n = !1) {
		let r = M(e);
		if (this.closing || this.removing.has(r) || !this.snapshot.ready) return;
		let i = this.getDraft(e), a = t(i);
		if (a.note === i.note && Us(a.tags, i.tags) && Us(a.bookmarks, i.bookmarks)) return;
		let o = this.records.get(r), s = this.edits.get(r) ?? {
			song: e,
			base: o,
			draft: a,
			updatedAt: 0,
			version: 0,
			savedVersion: 0,
			failed: !1
		};
		s.draft = a, s.updatedAt = Math.max(Date.now(), o?.updatedAt ?? 0), s.version++, s.failed = !1, this.edits.set(r, s), clearTimeout(s.timer);
		let c = () => {
			this.flush(e).catch(() => {});
		};
		n ? c() : s.timer = setTimeout(c, 800), this.publish();
	}
	mark(e, t) {
		if (!Number.isFinite(t) || t < 0 || t > Wt.positionSeconds) throw RangeError("Invalid playback position");
		if (!this.snapshot.ready || this.closing || this.removing.has(M(e))) throw Error("The notebook is unavailable");
		let n = Math.floor(t), { bookmarks: r } = this.getDraft(e), i = r.find((e) => Math.abs(Math.floor(e.positionSeconds) - n) <= 1);
		if (i) return i.id;
		if (r.length >= Wt.bookmarks) throw new qt();
		let a = Yt(r);
		return this.edit(e, (e) => ({
			...e,
			bookmarks: [...e.bookmarks, {
				id: a,
				positionSeconds: n,
				text: ""
			}]
		}), !0), a;
	}
	async write(e, t, n) {
		let { base: r, draft: i, version: a, song: o } = t;
		try {
			let s, c = r?.revision ?? null;
			try {
				s = await this.db.save(o, i, c);
			} catch (e) {
				if (!(e instanceof Kt)) throw e;
				let t = await this.db.get(o);
				if (!t && r && !n) throw e;
				let a = Ws(Hs(r), i, Hs(t), n);
				c = t?.revision ?? null, s = await this.db.save(o, a, c);
			}
			this.readVersion++, this.records.has(e) ? this.records.set(e, s) : this.records = new Map([[e, s], ...this.records]), t.savedVersion = a, t.savedFromRevision = c, t.base = s, a === t.version ? this.edits.delete(e) : t.draft = Ws(i, t.draft, Hs(s), !0);
		} catch (e) {
			throw t.failed = !0, console.warn("[MusicNotes] Could not save the note", e), e;
		} finally {
			this.publish();
		}
	}
	async flushSong(e, t = !1) {
		let n = this.edits.get(e);
		if (!n) return;
		clearTimeout(n.timer);
		let r = n.version;
		for (; n.savedVersion < r && !this.removing.has(e);) n.writing ??= this.write(e, n, t).finally(() => {
			n.writing = void 0;
		}), await n.writing;
	}
	async flush(e) {
		if (e) return this.flushSong(M(e));
		let t = (await Promise.allSettled([...this.edits.keys()].map((e) => this.flushSong(e)))).find((e) => e.status === "rejected");
		if (t?.status === "rejected") throw t.reason;
	}
	retry(e) {
		return this.flushSong(M(e), !0);
	}
	move(...[e, t, n, r]) {
		if (this.closing || !this.snapshot.ready || t === n) return Promise.resolve();
		let i = this.orderWrite.then(() => this.moveSaved(e, t, n, r));
		return this.orderWrite = i.catch(() => void 0), i;
	}
	async moveSaved(...[e, t, n, r]) {
		if (e === "note") for (let e of [t, n]) this.records.has(e) || await this.flushSong(e);
		else {
			let e = new Set([t, n].filter((e) => !this.snapshot.tagOrder.includes(e)));
			for (let [t, n] of this.edits) {
				if (!e.size) break;
				let r = n.draft.tags.map(Xt).filter((t) => e.has(t));
				if (r.length) {
					await this.flushSong(t);
					for (let t of r) e.delete(t);
				}
			}
		}
		await this.db.move(e, t, n, r), await this.refresh();
	}
	remove(e, t) {
		return this.removeMany([{
			song: e,
			revision: t
		}]);
	}
	async removeMany(e) {
		let t = e.map(({ song: e, revision: t }) => {
			let n = M(e), r = this.edits.get(n), i = r?.base?.revision ?? this.records.get(n)?.revision ?? 0;
			if (this.removing.has(n) || i !== t) throw new Kt();
			return {
				key: n,
				song: e,
				revision: t,
				edit: r
			};
		});
		for (let { key: e, edit: n } of t) this.removing.add(e), clearTimeout(n?.timer);
		try {
			await Promise.allSettled(t.map((e) => e.edit?.writing)), await this.db.removeMany(t.map(({ song: e, revision: t, edit: n }) => {
				let r = t || null, i = n?.base?.revision ?? r;
				if (i !== r && n?.savedFromRevision !== r) throw new Kt();
				return {
					song: e,
					revision: i
				};
			})), this.readVersion++;
			for (let { key: e } of t) this.records.delete(e), this.edits.delete(e);
		} catch (e) {
			for (let { key: e } of t) {
				let t = this.edits.get(e);
				t && (t.failed = !0);
			}
			throw e;
		} finally {
			for (let { key: e } of t) this.removing.delete(e);
			this.publish();
		}
	}
	async importSongs(e) {
		await this.flush();
		let t = await this.db.importSongs(e);
		return await this.refresh(), t;
	}
	async importBackup(e) {
		await this.flush();
		let t = await this.db.importBackup(e);
		return await this.refresh(), t;
	}
	async exportBackup() {
		return await Promise.all([this.flush(), this.orderWrite]), this.db.exportBackup();
	}
	async dispose() {
		this.closing = !0, this.unwatch();
		try {
			await this.flush();
		} finally {
			await this.orderWrite, this.listeners.clear(), this.db.close();
		}
	}
}, Ks = /* @__PURE__ */ new Set(), qs = (e, t, n, r) => (Ks.add(e), {
	"zh-CN": e,
	"zh-TW": {
		音乐笔记: "音樂筆記",
		全部笔记: "全部筆記",
		"在正在播放的歌曲上写正文、加标签或记时刻，歌曲就会出现在列表里。编辑会自动保存。": "在正在播放的歌曲上寫正文、加標籤或記時刻，歌曲就會出現在列表裡。編輯會自動保存。",
		时刻: "時刻",
		记下这个时刻: "記下這個時刻",
		"点歌曲播放按钮旁带时间的图钉，记下这个时刻。点已记录的时间可从那里播放。": "點歌曲播放按鈕旁帶時間的圖釘，記下這個時刻。點已記錄的時間可從那裡播放。",
		导入与备份: "導入與備份",
		"恢复备份（导入）": "恢復備份（導入）",
		"用页头的按钮导入歌单或备份笔记。恢复备份时只会补入缺少的歌曲。": "用頁頭的按鈕導入歌單或備份筆記。恢復備份時只會補入缺少的歌曲。",
		"收藏歌曲，整理标签，记下值得再听一次的理由。": "收藏歌曲，整理標籤，記下值得再聽一次的理由。"
	}[e] ?? e,
	en: t,
	in: n,
	vi: r
}), Js = qs("音乐笔记", "Music notes", "Catatan musik", "Ghi chú âm nhạc"), Ys = [
	{
		id: "library",
		title: Js,
		control: qs("全部笔记", "All notes", "Semua catatan", "Tất cả ghi chú"),
		rect: {
			left: .04,
			top: .2,
			width: .29,
			height: .68
		},
		captions: [qs("在正在播放的歌曲上写正文、加标签或记时刻，歌曲就会出现在列表里。编辑会自动保存。", "Write a note, add a tag or mark a moment to add the playing song to your list. Edits are saved automatically.", "Tulis catatan, tambahkan tag, atau tandai momen untuk menambahkan lagu ke daftar. Perubahan tersimpan otomatis.", "Viết ghi chú, thêm nhãn hoặc đánh dấu khoảnh khắc để thêm bài hát vào danh sách. Thay đổi được lưu tự động.")]
	},
	{
		id: "moments",
		title: qs("时刻", "Moments", "Momen", "Khoảnh khắc"),
		control: qs("记下这个时刻", "Mark this moment", "Tandai momen ini", "Đánh dấu khoảnh khắc này"),
		rect: {
			left: .72,
			top: .19,
			width: .18,
			height: .14
		},
		captions: [qs("点歌曲播放按钮旁带时间的图钉，记下这个时刻。点已记录的时间可从那里播放。", "Use the pin next to the playback button to mark the time it shows. Select a saved time to play from there.", "Ketuk tombol pin di samping tombol pemutaran untuk menandai waktu yang ditampilkan. Pilih waktunya untuk memutar dari sana.", "Bấm nút ghim cạnh nút phát để đánh dấu thời gian đang hiển thị. Chọn mốc đã lưu để phát từ đó.")]
	},
	{
		id: "backup",
		title: qs("导入与备份", "Import and backup", "Impor dan cadangan", "Nhập và sao lưu"),
		control: qs("恢复备份（导入）", "Restore backup (import)", "Pulihkan cadangan (impor)", "Khôi phục bản sao lưu (nhập)"),
		rect: {
			left: .8,
			top: .04,
			width: .15,
			height: .11
		},
		captions: [qs("用页头的按钮导入歌单或备份笔记。恢复备份时只会补入缺少的歌曲。", "Use the header buttons to import a playlist or back up your notes. Restoring a backup adds only missing songs.", "Gunakan tombol di bagian atas untuk mengimpor daftar putar atau mencadangkan catatan. Pemulihan hanya menambahkan lagu yang belum ada.", "Dùng các nút ở đầu trang để nhập danh sách phát hoặc sao lưu. Khôi phục chỉ thêm bài hát còn thiếu.")]
	}
], Xs = {
	id: "guide",
	titleKey: Js,
	summaryKey: qs("收藏歌曲，整理标签，记下值得再听一次的理由。", "Keep songs, organize tags and remember why they deserve another listen.", "Simpan lagu, susun tag, dan ingat alasan untuk mendengarkannya lagi.", "Lưu bài hát, sắp xếp nhãn và ghi nhớ lý do để nghe lại."),
	category: "browsing",
	hoverSelector: null,
	scenes: Ys.map((e) => ({
		id: e.id,
		titleKey: e.title,
		anchors: {
			notebook: {
				kind: "synthetic",
				role: "surface",
				labelKey: Js,
				rect: {
					left: .5,
					top: .12,
					width: .72,
					height: .56,
					anchorX: "center"
				}
			},
			control: {
				kind: "relative",
				from: "notebook",
				role: "control",
				labelKey: e.control,
				rect: e.rect
			}
		},
		steps: [
			{
				kind: "highlight",
				id: "show",
				anchor: "control",
				intensity: [0, .4],
				durationMs: 450,
				keyframe: !0
			},
			...e.captions.map((e, t) => ({
				kind: "caption",
				id: `explain${t}`,
				at: "bottom",
				textKey: e,
				pointTo: {
					anchor: "control",
					y: .5
				},
				durationMs: 6200,
				keyframe: !0
			})),
			{
				kind: "pause",
				id: "read"
			}
		]
	}))
};
Object.freeze([...Ks]);
var Zs = (e) => {
	if (e.env.context !== "main") return () => {};
	let t = e.experimental["ponder.targets"];
	if (!t || typeof t != "object" || !("register" in t) || typeof t.register != "function") throw Error("[MusicNotes] Ponder tutorial registration is unavailable");
	let n = t.register(Xs);
	return () => n.unregister();
}, Qs = (e) => e?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
// node_modules/.pnpm/lucide-react@1.74.0_@types+react@19.3.0_react@19.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/toLucideIconData.mjs
function $s(e, t, n = []) {
	if (t == null) throw Error("[lucide]: iconNode is required when icon name is used");
	return {
		name: Qs(e),
		size: 24,
		node: t,
		...n.length > 0 ? { aliases: n } : {}
	};
}
// node_modules/.pnpm/lucide-react@1.74.0_@types+react@19.3.0_react@19.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
var ec = (e) => {
	let t = "", n = !1;
	for (let r of e) r === "-" || r === "_" || r <= " " ? n = t.length > 0 : (t.length === 0 ? t += r.toLowerCase() : t += n ? r.toUpperCase() : r, n = !1);
	return t;
}, tc = (e) => {
	let t = ec(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, nc = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), rc = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": 2,
	"stroke-linecap": "round",
	"stroke-linejoin": "round"
};
// node_modules/.pnpm/lucide-react@1.74.0_@types+react@19.3.0_react@19.3.1/node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs
function ic(e) {
	return e != null;
}
function ac(e, t = {}) {
	let n = t.attributeNames ?? {}, r = (e) => n[e] ?? e, i = e.size ?? e.width ?? rc.width, a = e.size ?? e.height ?? rc.height, o = e.aliases?.filter((e) => typeof e == "string" && e.trim() !== "").map((e) => `lucide-${e}`) ?? [], s = [...e.name ? [`lucide-${e.name}`] : [], ...o], c = t.className?.split(" ").filter(Boolean) ?? [], l = t.includeDefaultClasses === !1 ? nc(...c) : nc("lucide", ...s, ...c), u = t.absoluteStrokeWidth ? Number(t.strokeWidth ?? rc["stroke-width"]) * Number(e.size ?? e.width ?? rc.width) / Number(t.size ?? t.width ?? rc.width) : t.strokeWidth ?? rc["stroke-width"];
	return [
		"svg",
		{
			...Object.entries(rc).reduce((e, [t, n]) => (e[r(t)] = n, e), {}),
			..."color" in t && t.color && { [r("stroke")]: t.color },
			..."size" in t && ic(t.size) && {
				[r("width")]: t.size,
				[r("height")]: t.size
			},
			..."width" in t && ic(t.width) && { [r("width")]: t.width },
			..."height" in t && ic(t.height) && { [r("height")]: t.height },
			[r("stroke-width")]: u,
			...l && { [r("class")]: l },
			[r("viewBox")]: `0 0 ${i} ${a}`,
			...t.hasA11yProp === !1 ? { [r("aria-hidden")]: "true" } : {},
			..."attributes" in t && t.attributes
		},
		e.node.map((e) => {
			let [n, i, a] = e, o = t.nonScalingStroke ? {
				[r("vector-effect")]: "non-scaling-stroke",
				...i
			} : i;
			return a ? [
				n,
				o,
				a
			] : [n, o];
		})
	];
}
// node_modules/.pnpm/lucide-react@1.74.0_@types+react@19.3.0_react@19.3.1/node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconForReact.mjs
function oc(e, t = {}) {
	return ac(e, {
		...t,
		attributeNames: {
			...t.attributeNames,
			class: "className",
			"stroke-width": "strokeWidth",
			"stroke-linecap": "strokeLinecap",
			"stroke-linejoin": "strokeLinejoin",
			"vector-effect": "vectorEffect"
		}
	});
}
// node_modules/.pnpm/lucide-react@1.74.0_@types+react@19.3.0_react@19.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
var sc = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, cc = (0, j.createContext)({}), lc = () => (0, j.useContext)(cc), uc = (0, j.forwardRef)(({ color: e, size: t, width: n, height: r, strokeWidth: i, absoluteStrokeWidth: a, nonScalingStroke: o, className: s = "", children: c, iconNode: l = [], icon: u = {
	node: l,
	aliases: [],
	size: 24
}, ...d }, f) => {
	let { size: p = 24, strokeWidth: m = 2, absoluteStrokeWidth: h = !1, nonScalingStroke: g = !1, color: _ = "currentColor", className: v = "" } = lc() ?? {}, y = !!c || sc(d), [b, x, S = []] = oc(u, {
		color: e ?? _,
		width: n ?? t ?? p,
		height: r ?? t ?? p,
		strokeWidth: i ?? m,
		absoluteStrokeWidth: a ?? h,
		nonScalingStroke: o ?? g,
		className: nc(v, s),
		hasA11yProp: y,
		attributes: d
	});
	return (0, j.createElement)(b, {
		ref: f,
		...x
	}, [...S.map(([e, t]) => (0, j.createElement)(e, t)), ...Array.isArray(c) ? c : [c]]);
});
// node_modules/.pnpm/lucide-react@1.74.0_@types+react@19.3.0_react@19.3.1/node_modules/lucide-react/dist/esm/createLucideIcon.mjs
function dc(e, t = [], n = []) {
	let r = typeof e == "string" ? $s(e, t, n) : e, i = (0, j.forwardRef)(({ className: e, ...t }, n) => (0, j.createElement)(uc, {
		ref: n,
		icon: r,
		className: e,
		...t
	}));
	return r.name && (i.displayName = tc(r.name)), i;
}
// node_modules/.pnpm/lucide-react@1.74.0_@types+react@19.3.0_react@19.3.1/node_modules/lucide-react/dist/esm/icons/check.mjs
var fc = {
	name: "check",
	size: 24,
	node: [["path", {
		d: "M20 6 9 17l-5-5",
		key: "1gmf2c"
	}]]
};
fc.node;
var pc = dc(fc), mc = {
	name: "chevron-left",
	size: 24,
	node: [["path", {
		d: "m15 18-6-6 6-6",
		key: "1wnfg3"
	}]]
};
mc.node;
var hc = dc(mc), gc = {
	name: "download",
	size: 24,
	node: [
		["path", {
			d: "M12 15V3",
			key: "m9g1x1"
		}],
		["path", {
			d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
			key: "ih7n3h"
		}],
		["path", {
			d: "m7 10 5 5 5-5",
			key: "brsn70"
		}]
	]
};
gc.node;
var _c = dc(gc), vc = {
	name: "eighth-note",
	size: 24,
	node: [["path", {
		d: "m19 6-5.2-3.9a.5.5 0 0 0-.8.4V18",
		key: "nsdg4r"
	}], ["circle", {
		cx: "9",
		cy: "18",
		r: "4",
		key: "1972g7"
	}]],
	aliases: ["music-2"]
};
vc.node;
var yc = dc(vc), bc = {
	name: "list-music",
	size: 24,
	node: [
		["path", {
			d: "M16 5H3",
			key: "m91uny"
		}],
		["path", {
			d: "M11 12H3",
			key: "51ecnj"
		}],
		["path", {
			d: "M11 19H3",
			key: "zflm78"
		}],
		["path", {
			d: "M21 16V5",
			key: "yxg4q8"
		}],
		["circle", {
			cx: "18",
			cy: "16",
			r: "3",
			key: "1hluhg"
		}]
	]
};
bc.node;
var xc = dc(bc), Sc = {
	name: "pin",
	size: 24,
	node: [["path", {
		d: "M12 17v5",
		key: "bb1du9"
	}], ["path", {
		d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
		key: "1nkz8b"
	}]]
};
Sc.node;
var Cc = dc(Sc), wc = {
	name: "play",
	size: 24,
	node: [["path", {
		d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
		key: "10ikf1"
	}]]
};
wc.node;
var Tc = dc(wc), Ec = {
	name: "plus",
	size: 24,
	node: [["path", {
		d: "M5 12h14",
		key: "1ays0h"
	}], ["path", {
		d: "M12 5v14",
		key: "s699le"
	}]]
};
Ec.node;
var Dc = dc(Ec), Oc = {
	name: "rotate-ccw",
	size: 24,
	node: [["path", {
		d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
		key: "1357e3"
	}], ["path", {
		d: "M3 3v5h5",
		key: "1xhq8a"
	}]]
};
Oc.node;
var kc = dc(Oc), Ac = {
	name: "square-check",
	size: 24,
	node: [["rect", {
		width: "18",
		height: "18",
		x: "3",
		y: "3",
		rx: "2",
		key: "afitv7"
	}], ["path", {
		d: "m16 9-5.5 5.5L8 12",
		key: "xofnsj"
	}]],
	aliases: ["check-square-2"]
};
Ac.node;
var jc = dc(Ac), Mc = {
	name: "square",
	size: 24,
	node: [["rect", {
		width: "18",
		height: "18",
		x: "3",
		y: "3",
		rx: "2",
		key: "afitv7"
	}]]
};
Mc.node;
var Nc = dc(Mc), Pc = {
	name: "trash",
	size: 24,
	node: [
		["path", {
			d: "M10 11v6",
			key: "nco0om"
		}],
		["path", {
			d: "M14 11v6",
			key: "outv1u"
		}],
		["path", {
			d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
			key: "miytrc"
		}],
		["path", {
			d: "M3 6h18",
			key: "d0wm0j"
		}],
		["path", {
			d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
			key: "e791ji"
		}]
	],
	aliases: ["trash-2"]
};
Pc.node;
var Fc = dc(Pc), Ic = {
	name: "upload",
	size: 24,
	node: [
		["path", {
			d: "M12 3v12",
			key: "1x0j5s"
		}],
		["path", {
			d: "m17 8-5-5-5 5",
			key: "7q97r8"
		}],
		["path", {
			d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
			key: "ih7n3h"
		}]
	]
};
Ic.node;
var Lc = dc(Ic), Rc = {
	name: "x",
	size: 24,
	node: [["path", {
		d: "M18 6 6 18",
		key: "1bl5f8"
	}], ["path", {
		d: "m6 6 12 12",
		key: "d8bk6v"
	}]]
};
Rc.node;
var zc = dc(Rc), Bc = (e) => {
	let t = new MutationObserver(e);
	return t.observe(document.documentElement, {
		attributes: !0,
		attributeFilter: ["data-reduce-motion"]
	}), () => {
		t.disconnect();
	};
}, Vc = (e) => (0, j.useSyncExternalStore)(Bc, () => (document.documentElement.getAttribute("data-reduce-motion") ?? "").split(" ").includes(e), () => !0), Hc = {
	fast: .12,
	move: .22,
	unfold: .3,
	show: .48,
	flash: 2.2,
	tooltipDelay: .4,
	confirm: 1.6
}, Uc = {
	out: [
		.22,
		1,
		.36,
		1
	],
	standard: [
		.4,
		0,
		.2,
		1
	],
	inOut: [
		.65,
		0,
		.35,
		1
	]
}, Wc = (e, t) => t ? "0s" : `${e}s`, Gc = (e) => `cubic-bezier(${e.join(", ")})`, Kc = (e) => ({
	"--st-dur-fast": Wc(Hc.fast, e),
	"--st-dur-move": Wc(Hc.move, e),
	"--st-dur-unfold": Wc(Hc.unfold, e),
	"--st-dur-show": Wc(Hc.show, e),
	"--st-ease-out": Gc(Uc.out),
	"--st-ease-standard": Gc(Uc.standard),
	"--st-ease-in-out": Gc(Uc.inOut)
}), qc = () => Vc("uiMicroMotion"), Jc = (e, t) => ({
	duration: t ? 0 : Hc[e],
	ease: Uc.out
}), Yc = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.Fragment = n, e.jsx = r, e.jsxs = r;
})), W = (/* @__PURE__ */ o(((e, t) => {
	t.exports = Yc();
})))(), Xc = (0, j.createContext)({}), Zc = () => (0, j.useContext)(Xc), Qc = () => {
	let { labelId: e, hintId: t } = Zc();
	return {
		"aria-labelledby": e,
		"aria-describedby": t
	};
}, $c = (0, j.createContext)({});
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/utils/use-constant.mjs
function el(e) {
	let t = (0, j.useRef)(null);
	return t.current === null && (t.current = e()), t.current;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs
var tl = typeof window < "u" ? j.useLayoutEffect : j.useEffect, nl = /* @__PURE__ */ (0, j.createContext)(null);
// node_modules/.pnpm/motion-utils@13.5.0/node_modules/motion-utils/dist/es/array.mjs
function rl(e, t) {
	e.indexOf(t) === -1 && e.push(t);
}
function il(e, t) {
	let n = e.indexOf(t);
	n > -1 && e.splice(n, 1);
}
// node_modules/.pnpm/motion-utils@13.5.0/node_modules/motion-utils/dist/es/clamp.mjs
var al = (e, t, n) => n > t ? t : n < e ? e : n, ol = {}, sl = (e) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(e), cl = (e) => typeof e == "object" && !!e, ll = (e) => /^0[^.\s]+$/u.test(e);
// node_modules/.pnpm/motion-utils@13.5.0/node_modules/motion-utils/dist/es/memo.mjs
/*#__NO_SIDE_EFFECTS__*/
function ul(e) {
	let t;
	return () => (t === void 0 && (t = e()), t);
}
// node_modules/.pnpm/motion-utils@13.5.0/node_modules/motion-utils/dist/es/noop.mjs
var dl = /* @__NO_SIDE_EFFECTS__ */ (e) => e, fl = (...e) => e.reduce((e, t) => (n) => t(e(n))), pl = /* @__NO_SIDE_EFFECTS__ */ (e, t, n) => {
	let r = t - e;
	return r ? (n - e) / r : 1;
}, ml = class {
	constructor() {
		this.subscriptions = [];
	}
	add(e) {
		return rl(this.subscriptions, e), () => this.remove(e);
	}
	remove(e) {
		il(this.subscriptions, e);
	}
	notify(e, t, n) {
		let r = this.subscriptions.length;
		if (r) {
			if (r === 1) this.subscriptions[0](e, t, n);
			else for (let i = 0; i < r; i++) {
				let r = this.subscriptions[i];
				r && r(e, t, n);
			}
		}
	}
	getSize() {
		return this.subscriptions.length;
	}
	clear() {
		this.subscriptions.length = 0;
	}
}, hl = /* @__NO_SIDE_EFFECTS__ */ (e) => e * 1e3, gl = /* @__NO_SIDE_EFFECTS__ */ (e) => e / 1e3, _l = /* @__NO_SIDE_EFFECTS__ */ (e, t) => t ? 1e3 / t * e : 0, vl = (e, t, n) => {
	let r = t - e;
	return ((n - e) % r + r) % r + e;
}, yl = (e, t, n) => (((1 - 3 * n + 3 * t) * e + (3 * n - 6 * t)) * e + 3 * t) * e, bl = 1e-7, xl = 12;
function Sl(e, t, n, r, i) {
	let a, o, s = 0;
	do
		o = t + (n - t) / 2, a = yl(o, r, i) - e, a > 0 ? n = o : t = o;
	while (Math.abs(a) > bl && ++s < xl);
	return o;
}
/*#__NO_SIDE_EFFECTS__*/
function Cl(e, t, n, r) {
	if (e === t && n === r) return dl;
	let i = (t) => Sl(t, 0, 1, e, n);
	return (e) => e === 0 || e === 1 ? e : yl(i(e), t, r);
}
// node_modules/.pnpm/motion-utils@13.5.0/node_modules/motion-utils/dist/es/easing/modifiers/mirror.mjs
var wl = /* @__NO_SIDE_EFFECTS__ */ (e) => (t) => t <= .5 ? e(2 * t) / 2 : (2 - e(2 * (1 - t))) / 2, Tl = /* @__NO_SIDE_EFFECTS__ */ (e) => (t) => 1 - e(1 - t), El = /*@__PURE__*/ Cl(.33, 1.53, .69, .99), Dl = /*@__PURE__*/ Tl(El), Ol = /*@__PURE__*/ wl(Dl), kl = (e) => e >= 1 ? 1 : (e *= 2) < 1 ? .5 * Dl(e) : .5 * (2 - 2 ** (-10 * (e - 1))), Al = (e) => 1 - Math.sin(Math.acos(e)), jl = /* @__PURE__ */ Tl(Al), Ml = /* @__PURE__ */ wl(Al), Nl = /*@__PURE__*/ Cl(.42, 0, 1, 1), Pl = /*@__PURE__*/ Cl(0, 0, .58, 1), Fl = /*@__PURE__*/ Cl(.42, 0, .58, 1), Il = /* @__NO_SIDE_EFFECTS__ */ (e) => Array.isArray(e) && typeof e[0] != "number";
// node_modules/.pnpm/motion-utils@13.5.0/node_modules/motion-utils/dist/es/easing/utils/get-easing-for-segment.mjs
/*#__NO_SIDE_EFFECTS__*/
function Ll(e, t) {
	return /* @__PURE__ */ Il(e) ? e[vl(0, e.length, t)] : e;
}
// node_modules/.pnpm/motion-utils@13.5.0/node_modules/motion-utils/dist/es/easing/utils/is-bezier-definition.mjs
var Rl = /* @__NO_SIDE_EFFECTS__ */ (e) => Array.isArray(e) && typeof e[0] == "number", zl = {
	linear: dl,
	easeIn: Nl,
	easeInOut: Fl,
	easeOut: Pl,
	circIn: Al,
	circInOut: Ml,
	circOut: jl,
	backIn: Dl,
	backInOut: Ol,
	backOut: El,
	anticipate: kl
}, Bl = (e) => typeof e == "string", Vl = (e) => {
	if (/* @__PURE__ */ Rl(e)) {
		e.length;
		let [t, n, r, i] = e;
		return /* @__PURE__ */ Cl(t, n, r, i);
	}
	return Bl(e) ? (zl[e], `${e}`, zl[e]) : e;
}, Hl = {
	delta: 0,
	timestamp: 0,
	isProcessing: !1
}, Ul;
function Wl() {
	Ul = void 0;
}
var Gl = {
	now: () => (Ul === void 0 && Gl.set(Hl.isProcessing || ol.useManualTiming ? Hl.timestamp : performance.now()), Ul),
	set: (e) => {
		Ul = e, queueMicrotask(Wl);
	}
}, Kl = (e) => Math.round(e * 1e5) / 1e5, ql = (e) => (t) => typeof t == "string" && t.startsWith(e), Jl = /*@__PURE__*/ ql("--"), Yl = /*@__PURE__*/ ql("var(--"), Xl = (e) => Yl(e) ? Zl.test(e.split("/*")[0].trim()) : !1, Zl = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
function Ql(e) {
	return typeof e == "string" && e.split("/*")[0].includes("var(--");
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/types/numbers/index.mjs
var $l = {
	test: (e) => typeof e == "number",
	parse: parseFloat,
	transform: (e) => e
}, eu = {
	...$l,
	transform: (e) => al(0, 1, e)
}, tu = {
	...$l,
	default: 1
}, nu = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/types/utils/is-nullish.mjs
function ru(e) {
	return e == null;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/types/utils/single-color-regex.mjs
var iu = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu, G = (e, t) => (n) => !!(typeof n == "string" && iu.test(n) && n.startsWith(e) || t && !ru(n) && Object.prototype.hasOwnProperty.call(n, t)), au = (e, t, n) => (r) => {
	if (typeof r != "string") return r;
	let [i, a, o, s] = r.match(nu);
	return {
		[e]: parseFloat(i),
		[t]: parseFloat(a),
		[n]: parseFloat(o),
		alpha: s === void 0 ? 1 : parseFloat(s)
	};
}, ou = (e) => al(0, 255, e), su = {
	...$l,
	transform: (e) => Math.round(ou(e))
}, cu = {
	test: /*@__PURE__*/ G("rgb", "red"),
	parse: /*@__PURE__*/ au("red", "green", "blue"),
	transform: ({ red: e, green: t, blue: n, alpha: r = 1 }) => "rgba(" + su.transform(e) + ", " + su.transform(t) + ", " + su.transform(n) + ", " + Kl(eu.transform(r)) + ")"
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/types/color/hex.mjs
function lu(e) {
	let t = "", n = "", r = "", i = "";
	return e.length > 5 ? (t = e.substring(1, 3), n = e.substring(3, 5), r = e.substring(5, 7), i = e.substring(7, 9)) : (t = e.substring(1, 2), n = e.substring(2, 3), r = e.substring(3, 4), i = e.substring(4, 5), t += t, n += n, r += r, i += i), {
		red: parseInt(t, 16),
		green: parseInt(n, 16),
		blue: parseInt(r, 16),
		alpha: i ? parseInt(i, 16) / 255 : 1
	};
}
var uu = {
	test: /*@__PURE__*/ G("#"),
	parse: lu,
	transform: cu.transform
}, du = /* @__NO_SIDE_EFFECTS__ */ (e) => ({
	test: (t) => typeof t == "string" && t.endsWith(e) && t.split(" ").length === 1,
	parse: parseFloat,
	transform: (t) => `${t}${e}`
}), fu = /*@__PURE__*/ du("deg"), pu = /*@__PURE__*/ du("%"), K = /*@__PURE__*/ du("px"), mu = /*@__PURE__*/ du("vh"), hu = /*@__PURE__*/ du("vw"), gu = {
	...pu,
	parse: (e) => pu.parse(e) / 100,
	transform: (e) => pu.transform(e * 100)
}, _u = {
	test: /*@__PURE__*/ G("hsl", "hue"),
	parse: /*@__PURE__*/ au("hue", "saturation", "lightness"),
	transform: ({ hue: e, saturation: t, lightness: n, alpha: r = 1 }) => "hsla(" + Math.round(e) + ", " + pu.transform(Kl(t)) + ", " + pu.transform(Kl(n)) + ", " + Kl(eu.transform(r)) + ")"
}, vu = {
	test: (e) => cu.test(e) || uu.test(e) || _u.test(e),
	parse: (e) => cu.test(e) ? cu.parse(e) : _u.test(e) ? _u.parse(e) : uu.parse(e),
	transform: (e) => typeof e == "string" ? e : e.hasOwnProperty("red") ? cu.transform(e) : _u.transform(e),
	getAnimatableNone: (e) => {
		let t = vu.parse(e);
		return t.alpha = 0, vu.transform(t);
	}
}, yu = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu, bu = /*@__PURE__*/ new RegExp(nu.source), xu = /*@__PURE__*/ new RegExp(yu.source, "i");
function Su(e) {
	return isNaN(e) && typeof e == "string" && (bu.test(e) || xu.test(e));
}
var Cu = "number", wu = "color", Tu = "var", Eu = "var(", Du = "${}", Ou = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
function ku(e) {
	let t = e.toString();
	return bu.test(t) || xu.test(t);
}
function Au(e) {
	let t = e.toString(), n = [], r = {
		color: [],
		number: [],
		var: []
	}, i = [], a = 0;
	return {
		values: n,
		split: t.replace(Ou, (e) => (vu.test(e) ? (r.color.push(a), i.push(wu), n.push(vu.parse(e))) : e.startsWith(Eu) ? (r.var.push(a), i.push(Tu), n.push(e)) : (r.number.push(a), i.push(Cu), n.push(parseFloat(e))), ++a, Du)).split(Du),
		indexes: r,
		types: i
	};
}
function ju(e) {
	return Au(e).values;
}
function Mu({ split: e, types: t }) {
	let n = e.length;
	return (r) => {
		let i = "";
		for (let a = 0; a < n; a++) if (i += e[a], r[a] !== void 0) {
			let e = t[a];
			i += e === Cu ? Kl(r[a]) : e === wu ? vu.transform(r[a]) : r[a];
		}
		return i;
	};
}
function Nu(e) {
	return Mu(Au(e));
}
var Pu = (e) => typeof e == "number" ? 0 : vu.test(e) ? vu.getAnimatableNone(e) : e, Fu = (e, t) => typeof e == "number" ? t?.trim().endsWith("/") ? e : 0 : Pu(e);
function Iu(e) {
	let t = Au(e);
	return Mu(t)(t.values.map((e, n) => Fu(e, t.split[n])));
}
var Lu = {
	test: Su,
	parse: ju,
	createTransformer: Nu,
	getAnimatableNone: Iu
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/types/color/hsla-to-rgba.mjs
function Ru(e, t, n) {
	return n < 0 && (n += 1), n > 1 && --n, n < 1 / 6 ? e + (t - e) * 6 * n : n < 1 / 2 ? t : n < 2 / 3 ? e + (t - e) * (2 / 3 - n) * 6 : e;
}
function zu({ hue: e, saturation: t, lightness: n, alpha: r }) {
	e /= 360, t /= 100, n /= 100;
	let i = 0, a = 0, o = 0;
	if (!t) i = a = o = n;
	else {
		let r = n < .5 ? n * (1 + t) : n + t - n * t, s = 2 * n - r;
		i = Ru(s, r, e + 1 / 3), a = Ru(s, r, e), o = Ru(s, r, e - 1 / 3);
	}
	return {
		red: Math.round(i * 255),
		green: Math.round(a * 255),
		blue: Math.round(o * 255),
		alpha: r
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/mix/immediate.mjs
function Bu(e, t) {
	return (n) => n > 0 ? t : e;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/mix/number.mjs
var q = (e, t, n) => e + (t - e) * n, Vu = (e, t, n) => {
	let r = e * e, i = n * (t * t - r) + r;
	return i < 0 ? 0 : Math.sqrt(i);
}, Hu = [
	uu,
	cu,
	_u
], Uu = (e) => Hu.find((t) => t.test(e));
function Wu(e) {
	let t = Uu(e);
	if (!t) return `${e}`, !1;
	let n = t.parse(e);
	return t === _u && (n = zu(n)), n;
}
var Gu = (e, t) => {
	let n = Wu(e), r = Wu(t);
	if (!n || !r) return Bu(e, t);
	let i = { ...n };
	return (e) => (i.red = Vu(n.red, r.red, e), i.green = Vu(n.green, r.green, e), i.blue = Vu(n.blue, r.blue, e), i.alpha = q(n.alpha, r.alpha, e), cu.transform(i));
}, Ku = /* @__PURE__ */ new Set(["none", "hidden"]);
function qu(e, t) {
	return Ku.has(e) ? (n) => n <= 0 ? e : t : (n) => n >= 1 ? t : e;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/mix/complex.mjs
function Ju(e, t) {
	return (n) => q(e, t, n);
}
function Yu(e) {
	return typeof e == "number" ? Ju : typeof e == "string" ? Xl(e) ? Bu : vu.test(e) ? Gu : Qu : Array.isArray(e) ? Xu : typeof e == "object" ? vu.test(e) ? Gu : Zu : Bu;
}
function Xu(e, t) {
	let n = [...e], r = n.length, i = e.map((e, n) => Yu(e)(e, t[n]));
	return (e) => {
		for (let t = 0; t < r; t++) n[t] = i[t](e);
		return n;
	};
}
function Zu(e, t) {
	let n = {
		...e,
		...t
	}, r = {};
	for (let i in n) e[i] !== void 0 && t[i] !== void 0 && (r[i] = Yu(e[i])(e[i], t[i]));
	return (e) => {
		for (let t in r) n[t] = r[t](e);
		return n;
	};
}
function J(e, t) {
	let n = [], r = {
		color: 0,
		var: 0,
		number: 0
	};
	for (let i = 0; i < t.values.length; i++) {
		let a = t.types[i], o = e.indexes[a][r[a]], s = e.values[o] ?? 0;
		n[i] = s, r[a]++;
	}
	return n;
}
var Qu = (e, t) => {
	let n = Lu.createTransformer(t), r = Au(e), i = Au(t);
	return r.indexes.var.length === i.indexes.var.length && r.indexes.color.length === i.indexes.color.length && r.indexes.number.length >= i.indexes.number.length ? Ku.has(e) && !i.values.length || Ku.has(t) && !r.values.length ? qu(e, t) : fl(Xu(J(r, i), i.values), n) : (`${e}${t}`, Bu(e, t));
}, Y = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu;
function X(e, t) {
	let n = Y.exec(e);
	if (!n) return;
	let r = Y.exec(t);
	if (!r || n[2] !== r[2]) return;
	let i = n[2], a = parseFloat(n[1]), o = parseFloat(r[1]);
	return (e) => Kl(q(a, o, e)) + i;
}
function Z(e, t, n) {
	if (typeof e == "number" && typeof t == "number" && typeof n == "number") return q(e, t, n);
	if (typeof e == "string" && typeof t == "string") {
		let n = X(e, t);
		if (n) return n;
	}
	return Yu(e)(e, t);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/frameloop/order.mjs
var $u = [
	"setup",
	"read",
	"resolveKeyframes",
	"preUpdate",
	"update",
	"preRender",
	"render",
	"postRender"
];
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/frameloop/render-step.mjs
function ed(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = !1, i = !1, a = /* @__PURE__ */ new Set(), o = {
		delta: 0,
		timestamp: 0,
		isProcessing: !1
	};
	function s(t) {
		a.has(t) && (n.add(t), e()), t(o);
	}
	let c = {
		schedule: (e, i = !1, o = !1) => {
			let s = o && r ? t : n;
			return i && a.add(e), s.add(e), e;
		},
		cancel: (e) => {
			n.delete(e), a.delete(e);
		},
		process: (e) => {
			if (o = e, r) {
				i = !0;
				return;
			}
			r = !0;
			let a = t;
			t = n, n = a, t.forEach(s), t.clear(), r = !1, i && (i = !1, c.process(e));
		}
	};
	return c;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/frameloop/batcher.mjs
var td = 40;
function nd(e, t, n = {
	delta: 0,
	timestamp: 0,
	isProcessing: !1
}) {
	let r = !1, i = !0, a = () => r = !0, o = $u.reduce((e, t) => (e[t] = ed(a), e), {}), { setup: s, read: c, resolveKeyframes: l, preUpdate: u, update: d, preRender: f, render: p, postRender: m } = o, h = () => {
		let a = ol.useManualTiming, o = a ? n.timestamp : performance.now();
		r = !1, a || (n.delta = i ? 1e3 / 60 : Math.max(Math.min(o - n.timestamp, td), 1)), n.timestamp = o, n.isProcessing = !0, s.process(n), c.process(n), l.process(n), u.process(n), d.process(n), f.process(n), p.process(n), m.process(n), n.isProcessing = !1, r && t && (i = !1, e(h));
	}, g = () => {
		r = !0, i = !0, n.isProcessing || e(h);
	};
	return {
		schedule: $u.reduce((e, t) => {
			let n = o[t];
			return e[t] = (e, t = !1, i = !1) => (r || g(), n.schedule(e, t, i)), e;
		}, {}),
		cancel: (e) => {
			for (let t = 0; t < $u.length; t++) o[$u[t]].cancel(e);
		},
		state: n,
		steps: o
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/frameloop/frame.mjs
var { schedule: Q, cancel: rd, steps: id } = /* @__PURE__ */ nd(typeof requestAnimationFrame < "u" ? requestAnimationFrame : dl, !0, Hl), ad = (e) => {
	let t = ({ timestamp: t }) => e(t);
	return {
		start: (e = !0) => Q.update(t, e),
		stop: () => rd(t),
		now: () => Hl.isProcessing ? Hl.timestamp : Gl.now()
	};
}, od = (e, t, n = 10) => {
	let r = "", i = Math.max(Math.round(t / n), 2);
	for (let t = 0; t < i; t++) r += Math.round(e(t / (i - 1)) * 1e4) / 1e4 + ", ";
	return `linear(${r.substring(0, r.length - 2)})`;
}, sd = 2e4;
function cd(e, t = 50, n = sd, r) {
	let i = 0, a = e.next(i);
	for (r?.push(a.value); !a.done && i < n;) i += t, a = e.next(i), r?.push(a.value);
	return i >= n ? Infinity : i;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/generators/utils/create-generator-easing.mjs
function ld(e, t = 100, n) {
	let r = n({
		...e,
		keyframes: [0, t]
	}), i = Math.min(cd(r), sd);
	return {
		type: "keyframes",
		ease: (e) => r.next(i * e).value / t,
		duration: /* @__PURE__ */ gl(i)
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/generators/spring.mjs
var ud = {
	stiffness: 100,
	damping: 10,
	mass: 1,
	duration: 800,
	bounce: .3,
	visualDuration: .3,
	restSpeed: {
		granular: .01,
		default: 2
	},
	restDelta: {
		granular: .005,
		default: .5
	},
	minDuration: .01,
	maxDuration: 10,
	minDamping: .05
}, dd = (e) => e < 0 ? 1 / Math.max(1 + e, ud.minDamping) : Math.max(1 - e, ud.minDamping);
function fd(e, t) {
	if (!(e > 1)) return 1;
	let n = Math.sqrt(e * e - 1), r = e - n, i = e + n, a = 2 * n * Math.exp(-t) * (1 + t);
	return hd((e) => i * Math.exp(-r * e) - r * Math.exp(-i * e) - a, (e) => Math.exp(-i * e) - Math.exp(-r * e), t) / t;
}
function pd(e, t) {
	return e * Math.sqrt(1 - t * t);
}
var md = 12;
function hd(e, t, n) {
	let r = n;
	for (let n = 1; n < md; n++) r -= e(r) / t(r);
	return r;
}
var gd = .001;
function _d({ duration: e = ud.duration, bounce: t = ud.bounce }) {
	let n, r;
	ud.maxDuration;
	let i = dd(t);
	e = al(ud.minDuration, ud.maxDuration, /* @__PURE__ */ gl(e)), i < 1 ? (n = (t) => {
		let n = t * i, r = n * e, a = pd(t, i), o = Math.exp(-r);
		return gd - n / a * o;
	}, r = (t) => {
		let r = t * i * e, a = i * i * t * t * e, o = Math.exp(-r), s = pd(t * t, i);
		return (-n(t) + gd > 0 ? -1 : 1) * -a * o / s;
	}) : (n = (t) => -.001 + Math.exp(-t * e) * (t * e + 1), r = (t) => Math.exp(-t * e) * (-t * (e * e)));
	let a = 5 / e, o = hd(n, r, a), s = o * fd(i, o * e), c = s * s;
	return {
		stiffness: c,
		damping: i * 2 * Math.sqrt(c),
		duration: /* @__PURE__ */ hl(e)
	};
}
var vd = (e, t) => (t ? e >= 0 : e > 0) && e < Infinity;
function yd(e, t) {
	if (vd(e, t)) return e;
}
function bd(e) {
	let t = yd(e.stiffness), n = yd(e.damping, !0), r = yd(e.mass), i = {
		...e,
		stiffness: t ?? ud.stiffness,
		damping: n ?? ud.damping,
		mass: r ?? ud.mass,
		isResolvedFromDuration: !1,
		isTimeDefined: (t ?? n ?? r) === void 0 && (e.duration !== void 0 || e.bounce !== void 0)
	};
	if (i.isTimeDefined) {
		if (e.visualDuration) {
			let t = dd(e.bounce || 0), n = 2 * Math.PI / (e.visualDuration * 1.2) * fd(t, 2 * Math.PI / 1.2);
			i.stiffness = n * n, i.damping = 2 * t * Math.sqrt(i.stiffness);
		} else Object.assign(i, _d(i)), i.isResolvedFromDuration = !0;
		vd(i.stiffness) && vd(i.damping, !0) || (i.stiffness = ud.stiffness, i.damping = ud.damping);
	}
	return i;
}
function xd(e = ud.visualDuration, t = ud.bounce) {
	let n = typeof e == "object" ? e : {
		visualDuration: e,
		keyframes: [0, 1],
		bounce: t
	}, r = n.keyframes[0], i = n.keyframes[n.keyframes.length - 1], a = {
		done: !1,
		value: r
	}, { stiffness: o, damping: s, mass: c, duration: l, isResolvedFromDuration: u, isTimeDefined: d } = bd({ ...n }), f = (e) => d ? 0 : -/* @__PURE__ */ gl(e), p = s / (2 * Math.sqrt(o * c)), m = /* @__PURE__ */ gl(Math.sqrt(o / c)), h = p * m, g = {
		target: i,
		delta: i - r,
		velocity: f(n.velocity || 0) || 0,
		restSpeed: 0,
		restDelta: 0
	}, _ = () => {
		let e = Math.abs(g.delta) < 5;
		g.restSpeed = n.restSpeed || (e ? ud.restSpeed.granular : ud.restSpeed.default), g.restDelta = n.restDelta || (e ? ud.restDelta.granular : ud.restDelta.default);
	};
	_();
	let v, y, b;
	if (p < 1) {
		let e = pd(m, p), t = {
			A: 0,
			sinC: 0,
			cosC: 0,
			t: -1,
			env: 0,
			sin: 0,
			cos: 0
		};
		b = () => {
			t.A = (g.velocity + h * g.delta) / e, t.sinC = h * t.A + g.delta * e, t.cosC = h * g.delta - t.A * e;
		};
		let n = (n) => {
			n !== t.t && (t.t = n, t.env = Math.exp(-h * n), t.sin = Math.sin(e * n), t.cos = Math.cos(e * n));
		};
		v = (e) => (n(e), g.target - t.env * (t.A * t.sin + g.delta * t.cos)), y = (e) => (n(e), t.env * (t.sinC * t.sin + t.cosC * t.cos));
	} else if (p === 1) {
		v = (e) => g.target - Math.exp(-m * e) * (g.delta + (g.velocity + m * g.delta) * e);
		let e = { C: 0 };
		b = () => {
			e.C = g.velocity + m * g.delta;
		}, y = (t) => Math.exp(-m * t) * (m * e.C * t - g.velocity);
	} else {
		let e = m * Math.sqrt(p * p - 1), t = h - e, n = h + e, r = d ? Infinity : 300 / e, i = (e, t) => Math.exp(t > r ? -e * r - h * (t - r) : -e * t), a = {
			S: 0,
			F: 0
		};
		b = () => {
			let t = (g.velocity + h * g.delta) / e;
			a.S = (g.delta + t) / 2, a.F = (g.delta - t) / 2;
		}, v = (e) => g.target - a.S * i(t, e) - a.F * i(n, e), y = (e) => t * a.S * i(t, e) + n * a.F * i(n, e);
	}
	b();
	let x = u && l || null, S = {
		calculatedDuration: x,
		retarget: (e, t) => {
			g.target = e[e.length - 1], g.delta = g.target - e[0], g.velocity = f(t), n.restSpeed && n.restDelta || _(), S.calculatedDuration = x, a.done = !1, b();
		},
		velocity: (e) => /* @__PURE__ */ hl(y(e)),
		next: (e) => {
			let t = v(e);
			if (u) a.done = e >= l;
			else {
				let n = /* @__PURE__ */ hl(y(e));
				a.done = Math.abs(n) <= g.restSpeed && Math.abs(g.target - t) <= g.restDelta;
			}
			return a.value = a.done ? g.target : t, a;
		},
		toString: () => {
			let e = Math.min(cd(S), sd), t = od((t) => S.next(e * t).value, e, 30);
			return e + "ms " + t;
		},
		toTransition: () => {}
	};
	return S;
}
xd.applyToOptions = (e) => {
	let t = ld(e, 100, xd);
	return e.ease = t.ease, e.duration = /* @__PURE__ */ hl(t.duration), e.type = "keyframes", e;
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/generators/inertia.mjs
function Sd({ keyframes: e, velocity: t = 0, power: n = .8, timeConstant: r = 325, bounceDamping: i = 10, bounceStiffness: a = 500, modifyTarget: o, min: s, max: c, restDelta: l = .5, restSpeed: u }) {
	let d = e[0], f = {
		done: !1,
		value: d
	}, p = (e) => e < s || e > c, m = (e) => s === void 0 ? c : c === void 0 || Math.abs(s - e) < Math.abs(c - e) ? s : c, h = n * t, g = d + h, _ = o === void 0 ? g : o(g);
	_ !== g && (h = _ - d);
	let v = (e) => -h * Math.exp(-e / r), y = (e) => {
		let t = v(e);
		f.done = Math.abs(t) <= l, f.value = f.done ? _ : _ + t;
	}, b, x, S = (e) => {
		p(f.value) && (b = e, x = xd({
			keyframes: [f.value, m(f.value)],
			velocity: -v(e) / r * 1e3,
			damping: i,
			stiffness: a,
			restDelta: l,
			restSpeed: u
		}));
	};
	return S(0), {
		calculatedDuration: null,
		next: (e) => {
			let t = !1;
			return !x && b === void 0 && (t = !0, y(e), S(e)), b !== void 0 && e >= b ? x.next(e - b) : (!t && y(e), f);
		}
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/interpolate.mjs
function Cd(e, t, n) {
	let r = [], i = n || ol.mix || Z, a = e.length - 1;
	for (let n = 0; n < a; n++) {
		let a = i(e[n], e[n + 1]);
		t && (a = fl(Array.isArray(t) ? t[n] || dl : t, a)), r.push(a);
	}
	return r;
}
function wd(e, t, { clamp: n = !0, ease: r, mixer: i } = {}) {
	let a = e.length;
	if (t.length, a === 1) return () => t[0];
	if (a === 2 && t[0] === t[1]) return () => t[1];
	let o = e[0] === e[1];
	e[0] > e[a - 1] && (e = [...e].reverse(), t = [...t].reverse());
	let s = Cd(t, r, i), c = s.length, l = (n) => {
		if (o && n < e[0]) return t[0];
		let r = 0;
		if (c > 1) for (; r < e.length - 2 && !(n < e[r + 1]); r++);
		let i = /* @__PURE__ */ pl(e[r], e[r + 1], n);
		return s[r](i);
	};
	return n ? (t) => l(al(e[0], e[a - 1], t)) : l;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/offsets/fill.mjs
function Td(e, t) {
	let n = e[e.length - 1];
	for (let r = 1; r <= t; r++) {
		let i = /* @__PURE__ */ pl(0, t, r);
		e.push(q(n, 1, i));
	}
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/offsets/default.mjs
function Ed(e) {
	let t = [0];
	return Td(t, e.length - 1), t;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/offsets/time.mjs
function Dd(e, t) {
	return e.map((e) => e * t);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/generators/keyframes.mjs
function Od(e, t) {
	return e.map(() => t || Fl).splice(0, e.length - 1);
}
function kd({ duration: e = 300, keyframes: t, times: n, ease: r = "easeInOut" }) {
	let i = /* @__PURE__ */ Il(r) ? r.map(Vl) : Vl(r) || Fl, a = {
		done: !1,
		value: t[0]
	};
	if (t.length === 2 && !Array.isArray(i) && (!n || n.length !== 2 || n[0] === 0 && n[1] === 1)) {
		let [n, r] = t, o = n === r ? void 0 : (ol.mix || Z)(n, r);
		return {
			calculatedDuration: e,
			next: (t) => (a.value = o ? o(i(e > 0 ? al(0, 1, t / e) : 1)) : r, a.done = t >= e, a)
		};
	}
	let o = wd(Dd(n && n.length === t.length ? n : Ed(t), e), t, { ease: Array.isArray(i) ? i : Od(t, i) });
	return {
		calculatedDuration: e,
		next: (t) => (a.value = o(t), a.done = t >= e, a)
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/generators/utils/velocity.mjs
var Ad = 5;
function jd(e, t, n) {
	let r = Math.max(t - Ad, 0);
	return /* @__PURE__ */ _l(n - e(r), t - r);
}
function Md(e, t, n = 0) {
	return t <= 0 ? n : e.velocity ? e.velocity(t) : jd((t) => e.next(t).value, t, e.next(t).value);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/get-final.mjs
var Nd = (e) => e !== null;
function Pd(e, { repeat: t, repeatType: n = "loop" }, r, i = 1) {
	let a = e.filter(Nd), o = i < 0 || t && n !== "loop" && t % 2 == 1 ? 0 : a.length - 1;
	return !o || r === void 0 ? a[o] : r;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/replace-transition-type.mjs
var Fd = {
	decay: Sd,
	inertia: Sd,
	tween: kd,
	keyframes: kd,
	spring: xd
};
function Id(e) {
	typeof e.type == "string" && (e.type = Fd[e.type]);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/notify-inspector.mjs
function Ld(e, t) {
	return {
		kind: e,
		animation: t,
		timestamp: Gl.now(),
		frameTimestamp: Hl.timestamp,
		frameIsProcessing: Hl.isProcessing
	};
}
function Rd(e, t, n) {
	let r = globalThis.__MOTION_INSPECT__;
	if (r) try {
		r({
			...Ld("animation-start", e),
			options: n ? {
				...t,
				...n
			} : t
		});
	} catch {}
}
function zd(e, t) {
	let n = globalThis.__MOTION_INSPECT__;
	if (n) try {
		n({
			...Ld("layout-animation-start", e),
			node: t
		});
	} catch {}
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/WithPromise.mjs
var Bd = class {
	constructor() {
		this.isResolved = !1;
	}
	get finished() {
		return this._finished ||= this.isResolved ? Promise.resolve() : new Promise((e) => {
			this._resolve = e;
		}), this._finished;
	}
	updateFinished() {
		this._finished = this._resolve = void 0, this.isResolved = !1;
	}
	notifyFinished() {
		this.isResolved = !0, this._resolve?.();
	}
	then(e, t) {
		return this.finished.then(e, t);
	}
}, Vd = (e) => e / 100, Hd = class extends Bd {
	constructor(e) {
		super(), this.state = "idle", this.startTime = null, this.isStopped = !1, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.delayState = {
			done: !1,
			value: void 0
		}, this.stop = () => {
			let { motionValue: e } = this.options;
			e && e.updatedAt !== Gl.now() && this.tick(Gl.now()), this.isStopped = !0, this.state !== "idle" && (this.teardown(), this.options.onStop?.());
		}, this.options = e, this.initAnimation(), this.play(), e.autoplay === !1 && this.pause(), Rd(this, this.options);
	}
	initAnimation() {
		let { options: e } = this;
		Id(e);
		let { type: t = kd, repeat: n = 0, repeatDelay: r = 0, repeatType: i, velocity: a = 0 } = e, { keyframes: o } = e, s = t || kd;
		s !== kd && typeof o[0] != "number" && (this.mixKeyframes = fl(Vd, Z(o[0], o[1])), o = [0, 100]);
		let c = s(o === e.keyframes ? e : {
			...e,
			keyframes: o
		});
		i === "mirror" && (this.mirroredGenerator = s({
			...e,
			keyframes: [...o].reverse(),
			velocity: -a
		})), c.calculatedDuration === null && (c.calculatedDuration = cd(c));
		let { calculatedDuration: l } = c;
		this.calculatedDuration = l, this.resolvedDuration = l + r, this.totalDuration = this.resolvedDuration * (n + 1) - r, this.generator = c;
	}
	updateTime(e) {
		let t = Math.round(e - this.startTime) * this.playbackSpeed;
		this.currentTime = this.holdTime === null ? t : this.holdTime;
	}
	tick(e, t = !1) {
		let { generator: n, totalDuration: r, mixKeyframes: i, mirroredGenerator: a, resolvedDuration: o, calculatedDuration: s } = this;
		if (this.startTime === null) return n.next(0);
		let { delay: c = 0, keyframes: l, repeat: u, repeatType: d, repeatDelay: f, type: p, onUpdate: m, finalKeyframe: h } = this.options;
		this.speed > 0 ? this.startTime = Math.min(this.startTime, e) : this.speed < 0 && (this.startTime = Math.min(e - r / this.speed, this.startTime)), t ? this.currentTime = e : this.updateTime(e);
		let g = this.currentTime - c * (this.playbackSpeed >= 0 ? 1 : -1), _ = this.playbackSpeed >= 0 ? g < 0 : g > r;
		this.currentTime = Math.max(g, 0), this.state === "finished" && this.holdTime === null && (this.currentTime = r);
		let v = this.currentTime, y = n;
		if (u) {
			let e = Math.min(this.currentTime, r) / o, t = Math.floor(e), n = e % 1;
			!n && e >= 1 && (n = 1), n === 1 && t--, t = Math.min(t, u + 1), t % 2 && (d === "reverse" ? (n = 1 - n, f && (n -= f / o)) : d === "mirror" && (y = a)), v = al(0, 1, n) * o;
		}
		let b;
		_ ? (this.delayState.value = l[0], b = this.delayState) : b = y.next(v), i && !_ && (b.value = i(b.value));
		let { done: x } = b;
		!_ && s !== null && (x = this.playbackSpeed >= 0 ? this.currentTime >= r : this.currentTime <= 0);
		let S = this.holdTime === null && (this.state === "finished" || this.state === "running" && x);
		return S && p !== Sd && (b.value = Pd(l, this.options, h, this.speed)), m && m(b.value), S && this.finish(), b;
	}
	then(e, t) {
		return this.finished.then(e, t);
	}
	get duration() {
		return /* @__PURE__ */ gl(this.calculatedDuration);
	}
	get iterationDuration() {
		let { delay: e = 0 } = this.options || {};
		return this.duration + /* @__PURE__ */ gl(e);
	}
	get time() {
		return /* @__PURE__ */ gl(this.currentTime);
	}
	set time(e) {
		e = /* @__PURE__ */ hl(e), this.currentTime = e, this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0 ? this.holdTime = e : this.driver && (this.startTime = this.driver.now() - e / this.playbackSpeed), this.driver ? this.driver.start(!1) : (this.startTime = 0, this.state = "paused", this.holdTime = e, this.tick(e));
	}
	getGeneratorVelocity() {
		return Md(this.generator, this.currentTime, this.options.velocity);
	}
	get speed() {
		return this.playbackSpeed;
	}
	set speed(e) {
		let t = this.playbackSpeed !== e;
		t && this.driver && this.updateTime(Gl.now()), this.playbackSpeed = e, t && this.driver && (this.time = /* @__PURE__ */ gl(this.currentTime));
	}
	play() {
		if (this.isStopped) return;
		let { driver: e = ad, startTime: t } = this.options;
		this.driver ||= e((e) => this.tick(e)), this.options.onPlay?.();
		let n = this.driver.now();
		this.state === "finished" ? (this.updateFinished(), this.startTime = n) : this.holdTime === null ? this.startTime ||= t ?? n : this.startTime = n - this.holdTime, this.state === "finished" && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
	}
	pause() {
		this.state = "paused", this.updateTime(Gl.now()), this.holdTime = this.currentTime;
	}
	complete() {
		this.state !== "running" && this.play(), this.state = "finished", this.holdTime = null;
	}
	finish() {
		this.notifyFinished(), this.teardown(), this.state = "finished", this.options.onComplete?.();
	}
	cancel() {
		this.holdTime = null, this.startTime = 0, this.tick(0), this.teardown(), this.options.onCancel?.();
	}
	teardown() {
		this.state = "idle", this.stopDriver(), this.startTime = this.holdTime = null;
	}
	stopDriver() {
		this.driver &&= (this.driver.stop(), void 0);
	}
	sample(e) {
		return this.startTime = 0, this.tick(e, !0);
	}
	attachTimeline(e) {
		return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), this.driver?.stop(), e.observe(this);
	}
}, Ud = /* @__PURE__ */ new Set([
	"brightness",
	"contrast",
	"saturate",
	"opacity"
]);
function Wd(e) {
	let [t, n] = e.slice(0, -1).split("(");
	if (t === "drop-shadow") return e;
	let [r] = n.match(nu) || [];
	if (!r) return e;
	let i = n.replace(r, ""), a = +!!Ud.has(t);
	return r !== n && (a *= 100), t + "(" + a + i + ")";
}
var Gd = /\b([a-z-]*)\(.*?\)/gu, Kd = {
	...Lu,
	getAnimatableNone: (e) => {
		let t = e.match(Gd);
		return t ? t.map(Wd).join(" ") : e;
	}
}, qd = {
	...Lu,
	getAnimatableNone: (e) => {
		let t = Lu.parse(e);
		return Lu.createTransformer(e)(t.map((e) => typeof e == "number" ? 0 : typeof e == "object" ? {
			...e,
			alpha: 1
		} : e));
	}
}, Jd = {
	...$l,
	transform: Math.round
}, Yd = {
	rotate: fu,
	pathRotation: fu,
	rotateX: fu,
	rotateY: fu,
	rotateZ: fu,
	scale: tu,
	scaleX: tu,
	scaleY: tu,
	scaleZ: tu,
	skew: fu,
	skewX: fu,
	skewY: fu,
	distance: K,
	translateX: K,
	translateY: K,
	translateZ: K,
	x: K,
	y: K,
	z: K,
	perspective: K,
	transformPerspective: K,
	opacity: eu,
	originX: gu,
	originY: gu,
	originZ: K
}, Xd = {
	borderWidth: K,
	borderTopWidth: K,
	borderRightWidth: K,
	borderBottomWidth: K,
	borderLeftWidth: K,
	borderRadius: K,
	borderTopLeftRadius: K,
	borderTopRightRadius: K,
	borderBottomRightRadius: K,
	borderBottomLeftRadius: K,
	width: K,
	maxWidth: K,
	height: K,
	maxHeight: K,
	top: K,
	right: K,
	bottom: K,
	left: K,
	inset: K,
	insetBlock: K,
	insetBlockStart: K,
	insetBlockEnd: K,
	insetInline: K,
	insetInlineStart: K,
	insetInlineEnd: K,
	padding: K,
	paddingTop: K,
	paddingRight: K,
	paddingBottom: K,
	paddingLeft: K,
	paddingBlock: K,
	paddingBlockStart: K,
	paddingBlockEnd: K,
	paddingInline: K,
	paddingInlineStart: K,
	paddingInlineEnd: K,
	margin: K,
	marginTop: K,
	marginRight: K,
	marginBottom: K,
	marginLeft: K,
	marginBlock: K,
	marginBlockStart: K,
	marginBlockEnd: K,
	marginInline: K,
	marginInlineStart: K,
	marginInlineEnd: K,
	fontSize: K,
	backgroundPositionX: K,
	backgroundPositionY: K,
	...Yd,
	zIndex: Jd,
	fillOpacity: eu,
	strokeOpacity: eu,
	numOctaves: Jd
}, Zd = {
	...Xd,
	color: vu,
	backgroundColor: vu,
	outlineColor: vu,
	fill: vu,
	stroke: vu,
	borderColor: vu,
	borderTopColor: vu,
	borderRightColor: vu,
	borderBottomColor: vu,
	borderLeftColor: vu,
	filter: Kd,
	WebkitFilter: Kd,
	mask: qd,
	WebkitMask: qd
}, Qd = (e) => Zd[e], $d = /*@__PURE__*/ new Set([Kd, qd]);
function ef(e, t) {
	let n = Qd(e);
	return $d.has(n) || (n = Lu), n.getAnimatableNone ? n.getAnimatableNone(t) : void 0;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/utils/fill-wildcards.mjs
function tf(e) {
	for (let t = 1; t < e.length; t++) e[t] ?? (e[t] = e[t - 1]);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/dom/parse-transform.mjs
var nf = (e) => e * 180 / Math.PI, rf = (e) => of(nf(Math.atan2(e[1], e[0]))), af = {
	x: 4,
	y: 5,
	translateX: 4,
	translateY: 5,
	scaleX: 0,
	scaleY: 3,
	scale: (e) => (Math.abs(e[0]) + Math.abs(e[3])) / 2,
	rotate: rf,
	rotateZ: rf,
	skewX: (e) => nf(Math.atan(e[1])),
	skewY: (e) => nf(Math.atan(e[2])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[2])) / 2
}, of = (e) => (e %= 360, e < 0 && (e += 360), e), sf = rf, cf = (e) => Math.sqrt(e[0] * e[0] + e[1] * e[1]), lf = (e) => Math.sqrt(e[4] * e[4] + e[5] * e[5]), uf = {
	x: 12,
	y: 13,
	z: 14,
	translateX: 12,
	translateY: 13,
	translateZ: 14,
	scaleX: cf,
	scaleY: lf,
	scale: (e) => (cf(e) + lf(e)) / 2,
	rotateX: (e) => of(nf(Math.atan2(e[6], e[5]))),
	rotateY: (e) => of(nf(Math.atan2(-e[2], e[0]))),
	rotateZ: sf,
	rotate: sf,
	skewX: (e) => nf(Math.atan(e[4])),
	skewY: (e) => nf(Math.atan(e[1])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[4])) / 2
};
function df(e) {
	return +!!e.includes("scale");
}
function ff(e, t) {
	if (!e || e === "none") return df(t);
	let n = e.match(/^matrix3d\(([-\d.e\s,]+)\)$/u), r, i;
	if (n) r = uf, i = n;
	else {
		let t = e.match(/^matrix\(([-\d.e\s,]+)\)$/u);
		r = af, i = t;
	}
	if (!i) return df(t);
	let a = r[t], o = i[1].split(",").map(mf);
	return typeof a == "function" ? a(o) : o[a];
}
var pf = (e, t) => {
	let { transform: n = "none" } = getComputedStyle(e);
	return ff(n, t);
};
function mf(e) {
	return parseFloat(e.trim());
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/keys-transform.mjs
var hf = [
	"transformPerspective",
	"x",
	"y",
	"z",
	"translateX",
	"translateY",
	"translateZ",
	"scale",
	"scaleX",
	"scaleY",
	"rotate",
	"rotateX",
	"rotateY",
	"rotateZ",
	"skew",
	"skewX",
	"skewY"
], gf = /* @__PURE__ */ new Set([...hf, "pathRotation"]), _f = (e) => e === $l || e === K, vf = /* @__PURE__ */ new Set([
	"x",
	"y",
	"z"
]), yf = hf.filter((e) => !vf.has(e));
function bf(e) {
	let t = [];
	return yf.forEach((n) => {
		let r = e.getValue(n);
		if (r !== void 0) {
			let e = r.get(), i = +!!n.startsWith("scale");
			if (e === i) return;
			t.push([n, e]), r.set(i);
		}
	}), t;
}
var xf = /* @__PURE__ */ new Set(["bottom", "right"]);
function Sf(e, t, n, r, i, a) {
	let o = parseFloat(e);
	if (!isNaN(o)) return o;
	let { min: s, max: c } = t()[n], l = c - s;
	return a === "border-box" ? l : l - parseFloat(r) - parseFloat(i);
}
var Cf = {
	width: ({ width: e, paddingLeft: t = "0", paddingRight: n = "0", boxSizing: r }, i) => Sf(e, i, "x", t, n, r),
	height: ({ height: e, paddingTop: t = "0", paddingBottom: n = "0", boxSizing: r }, i) => Sf(e, i, "y", t, n, r),
	top: ({ top: e }) => parseFloat(e),
	left: ({ left: e }) => parseFloat(e),
	bottom: ({ top: e }, t) => {
		let { y: n } = t();
		return parseFloat(e) + (n.max - n.min);
	},
	right: ({ left: e }, t) => {
		let { x: n } = t();
		return parseFloat(e) + (n.max - n.min);
	},
	x: ({ transform: e }) => ff(e, "x"),
	y: ({ transform: e }) => ff(e, "y")
};
Cf.translateX = Cf.x, Cf.translateY = Cf.y;
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/KeyframesResolver.mjs
var wf = /* @__PURE__ */ new Set(), Tf = !1, Ef = !1, Df = !1;
function Of() {
	if (Ef) {
		let e = [], t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
		wf.forEach((r) => {
			r.needsMeasurement && (e.push(r), t.add(r.element), xf.has(r.name) && n.add(r.element));
		});
		let r = /* @__PURE__ */ new Map();
		n.forEach((e) => {
			let t = bf(e);
			t.length && (r.set(e, t), e.render());
		}), e.forEach((e) => e.measureInitialState()), t.forEach((e) => {
			e.render();
			let t = r.get(e);
			t && t.forEach(([t, n]) => {
				e.getValue(t)?.set(n);
			});
		}), e.forEach((e) => e.measureEndState()), e.forEach((e) => {
			e.suspendedScrollY !== void 0 && window.scrollTo(0, e.suspendedScrollY);
		});
	}
	Ef = !1, Tf = !1, wf.forEach((e) => e.complete(Df)), wf.clear();
}
function kf() {
	wf.forEach((e) => {
		e.readKeyframes(), e.needsMeasurement && (Ef = !0);
	});
}
function Af() {
	Df = !0, kf(), Of(), Df = !1;
}
function jf(e, t, n) {
	if (typeof e == "string") {
		if (sl(e) || ll(e)) return parseFloat(e);
		if (!Lu.test(e) && Lu.test(n)) return ef(t, n);
	}
	return e ?? void 0;
}
var Mf = class {
	constructor(e, t, n, r, i, a = !1) {
		this.state = "pending", this.isAsync = !1, this.needsMeasurement = !1, this.unresolvedKeyframes = [...e], this.onComplete = t, this.name = n, this.motionValue = r, this.element = i, this.isAsync = a;
	}
	scheduleResolve() {
		this.state = "scheduled", this.isAsync ? (wf.add(this), Tf || (Tf = !0, Q.read(kf), Q.resolveKeyframes(Of))) : (this.readKeyframes(), this.complete());
	}
	readKeyframes() {
		let { unresolvedKeyframes: e, name: t, element: n, motionValue: r } = this;
		if (e[0] === null) {
			let i = r?.get(), a = e[e.length - 1];
			if (i !== void 0) e[0] = i;
			else if (n && t) {
				let r = jf(n.readValue(t, a), t, a);
				r !== void 0 && (e[0] = r);
			}
			e[0] === void 0 && (e[0] = a), r && i === void 0 && r.set(e[0]);
		}
		tf(e);
	}
	setFinalKeyframe() {}
	measureInitialState() {}
	renderEndStyles() {}
	measureEndState() {}
	complete(e = !1) {
		this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, e), wf.delete(this);
	}
	cancel() {
		this.state === "scheduled" && (wf.delete(this), this.state = "pending");
	}
	resume() {
		this.state === "pending" && this.scheduleResolve();
	}
}, Nf = (e) => e.startsWith("--");
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/dom/style-set.mjs
function Pf(e, t, n) {
	Nf(t) ? e.style.setProperty(t, n) : e.style[t] = n;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/supports/flags.mjs
var Ff = {};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/supports/memo.mjs
function If(e, t) {
	let n = /* @__PURE__ */ ul(e);
	return () => Ff[t] ?? n();
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
var Lf = /* @__PURE__ */ If(() => window.ScrollTimeline !== void 0, "scrollTimeline"), Rf = /*@__PURE__*/ If(() => {
	try {
		document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
	} catch {
		return !1;
	}
	return !0;
}, "linearEasing"), zf = ([e, t, n, r]) => `cubic-bezier(${e}, ${t}, ${n}, ${r})`, Bf = {
	linear: "linear",
	ease: "ease",
	easeIn: "ease-in",
	easeOut: "ease-out",
	easeInOut: "ease-in-out",
	circIn: /*@__PURE__*/ zf([
		0,
		.65,
		.55,
		1
	]),
	circOut: /*@__PURE__*/ zf([
		.55,
		0,
		1,
		.45
	]),
	backIn: /*@__PURE__*/ zf([
		.31,
		.01,
		.66,
		-.59
	]),
	backOut: /*@__PURE__*/ zf([
		.33,
		1.53,
		.69,
		.99
	])
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/waapi/easing/map-easing.mjs
function $(e, t) {
	if (e) return typeof e == "function" ? Rf() ? od(e, t) : "ease-out" : /* @__PURE__ */ Rl(e) ? zf(e) : Array.isArray(e) ? e.map((e) => $(e, t) || Bf.easeOut) : Bf[e];
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/waapi/start-waapi-animation.mjs
function Vf(e, t, n, { delay: r = 0, duration: i = 300, repeat: a = 0, repeatType: o = "loop", ease: s = "easeOut", times: c } = {}, l = void 0) {
	let u = { [t]: n };
	c && (u.offset = c);
	let d = $(s, i);
	Array.isArray(d) && (u.easing = d);
	let f = {
		delay: r,
		duration: i,
		easing: Array.isArray(d) ? "linear" : d,
		fill: "both",
		iterations: a + 1,
		direction: o === "reverse" ? "alternate" : "normal"
	};
	return l && (f.pseudoElement = l), e.animate(u, f);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/generators/utils/is-generator.mjs
function Hf(e) {
	return typeof e == "function" && "applyToOptions" in e;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/waapi/utils/apply-generator.mjs
function Uf({ type: e, ...t }) {
	return Hf(e) && Rf() ? e.applyToOptions(t) : (t.duration ??= 300, t.ease ??= "easeOut", t);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/NativeAnimation.mjs
var Wf = class extends Bd {
	constructor(e) {
		if (super(), this.finishedTime = null, this.isStopped = !1, this.manualStartTime = null, !e) return;
		let { element: t, name: n, keyframes: r, pseudoElement: i, allowFlatten: a = !1, finalKeyframe: o, onComplete: s } = e;
		this.isPseudoElement = !!i, this.allowFlatten = a, this.options = e, e.type;
		let c = Uf(e);
		this.animation = Vf(t, n, r, c, i), c.autoplay === !1 && this.animation.pause(), this.animation.onfinish = () => {
			if (this.finishedTime = this.time, !i) {
				let e = Pd(r, this.options, o, this.speed);
				this.updateMotionValue && this.updateMotionValue(e), Pf(t, n, e), this.animation.cancel();
			}
			s?.(), this.notifyFinished();
		}, Rd(this, e, c);
	}
	play() {
		this.isStopped || (this.manualStartTime = null, this.animation.play(), this.state === "finished" && this.updateFinished());
	}
	pause() {
		this.animation.pause();
	}
	complete() {
		this.animation.finish?.();
	}
	cancel() {
		try {
			this.animation.cancel();
		} catch {}
	}
	stop() {
		if (this.isStopped) return;
		this.isStopped = !0;
		let { state: e } = this;
		e !== "idle" && e !== "finished" && (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel());
	}
	commitStyles() {
		let e = this.options?.element;
		!this.isPseudoElement && e?.isConnected && this.animation.commitStyles?.();
	}
	get duration() {
		let e = this.animation.effect?.getComputedTiming?.().duration || 0;
		return /* @__PURE__ */ gl(Number(e));
	}
	get iterationDuration() {
		let { delay: e = 0 } = this.options || {};
		return this.duration + /* @__PURE__ */ gl(e);
	}
	get time() {
		return /* @__PURE__ */ gl(Number(this.animation.currentTime) || 0);
	}
	set time(e) {
		let t = this.finishedTime !== null;
		this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = /* @__PURE__ */ hl(e), t && this.animation.pause();
	}
	get speed() {
		return this.animation.playbackRate;
	}
	set speed(e) {
		e < 0 && (this.finishedTime = null), this.animation.playbackRate = e;
	}
	get state() {
		return this.finishedTime === null ? this.animation.playState : "finished";
	}
	get startTime() {
		return this.manualStartTime ?? Number(this.animation.startTime);
	}
	set startTime(e) {
		this.manualStartTime = this.animation.startTime = e;
	}
	attachTimeline({ timeline: e, onAttach: t, observe: n, ...r }) {
		return this.allowFlatten && this.animation.effect?.updateTiming({ easing: "linear" }), this.animation.onfinish = null, e && Lf() ? (this.animation.timeline = e, Object.assign(this.animation, r), t?.(this.animation), dl) : n(this);
	}
}, Gf = {
	anticipate: kl,
	backInOut: Ol,
	circInOut: Ml
};
function Kf(e) {
	return e in Gf;
}
function qf(e) {
	typeof e.ease == "string" && Kf(e.ease) && (e.ease = Gf[e.ease]);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/NativeAnimationExtended.mjs
var Jf = 10, Yf = class extends Wf {
	constructor(e) {
		qf(e), Id(e), super(e), e.startTime !== void 0 && e.autoplay !== !1 && (this.startTime = e.startTime), this.options = e;
	}
	updateMotionValue(e) {
		let { motionValue: t, onUpdate: n, onComplete: r, element: i, ...a } = this.options;
		if (!t) return;
		if (e !== void 0) {
			t.set(e);
			return;
		}
		let o = new Hd({
			...a,
			autoplay: !1
		}), s = Math.max(Jf, Gl.now() - this.startTime), c = al(0, Jf, s - Jf), l = o.sample(s).value, { name: u } = this.options;
		i && u && Pf(i, u, l), t.setWithVelocity(o.sample(Math.max(0, s - c)).value, l, c), o.stop();
	}
}, Xf = (e, t) => t !== "zIndex" && !!(typeof e == "number" || Array.isArray(e) || typeof e == "string" && (Lu.test(e) || e === "0") && !e.startsWith("url("));
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/can-animate.mjs
function Zf(e) {
	let t = e[0];
	if (e.length === 1) return !0;
	for (let n = 0; n < e.length; n++) if (e[n] !== t) return !0;
}
function Qf(e, t, n, r) {
	let i = e[0];
	if (i === null) return !1;
	if (t === "display" || t === "visibility") return !0;
	let a = e[e.length - 1], o = Xf(i, t), s = Xf(a, t);
	return !o || !s ? (o !== s && `${t}${i}${a}${o ? a : i}`, !1) : Zf(e) || (n === "spring" || Hf(n)) && r;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/make-animation-instant.mjs
function $f(e) {
	e.duration = 0, e.type = "keyframes";
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/waapi/utils/accelerated-values.mjs
var ep = /* @__PURE__ */ new Set([
	"opacity",
	"clipPath",
	"filter",
	"transform",
	"backgroundColor"
]), tp = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;
function np(e) {
	for (let t = 0; t < e.length; t++) if (typeof e[t] == "string" && tp.test(e[t])) return !0;
	return !1;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/waapi/supports/waapi.mjs
var rp = /* @__PURE__ */ new Set([
	"color",
	"backgroundColor",
	"outlineColor",
	"fill",
	"stroke",
	"borderColor",
	"borderTopColor",
	"borderRightColor",
	"borderBottomColor",
	"borderLeftColor"
]), ip = /*@__PURE__*/ ul(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
function ap(e) {
	let { motionValue: t, name: n, repeatDelay: r, repeatType: i, damping: a, type: o, keyframes: s } = e;
	if (!n || !(ep.has(n) || rp.has(n))) return !1;
	let c = t?.owner?.current;
	if (!(c instanceof HTMLElement) && !(c instanceof SVGElement)) return !1;
	let { onUpdate: l, transformTemplate: u } = t.owner.getProps();
	return ip() && (ep.has(n) || rp.has(n) && np(s)) && (n !== "transform" || !u) && !l && !r && i !== "mirror" && a !== 0 && o !== "inertia";
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/AsyncMotionValueAnimation.mjs
var op = 40, sp = class extends Bd {
	constructor(e) {
		super(), this.stop = () => {
			this._animation && (this._animation.stop(), this.stopTimeline?.()), this.keyframeResolver?.cancel();
		}, this.createdAt = Gl.now();
		let { keyframes: t, name: n, motionValue: r, element: i } = e, a = e;
		a.autoplay ??= !0, a.delay ??= 0, a.type ??= "keyframes", a.repeat ??= 0, a.repeatDelay ??= 0, a.repeatType ??= "loop";
		let o = i?.KeyframeResolver || Mf;
		this.keyframeResolver = new o(t, (e, t, n) => this.onKeyframesResolved(e, t, a, !n), n, r, i), this.keyframeResolver?.scheduleResolve();
	}
	onKeyframesResolved(e, t, n, r) {
		this.keyframeResolver = void 0;
		let { name: i, type: a, velocity: o, delay: s, isHandoff: c, onUpdate: l } = n;
		this.resolvedAt = Gl.now();
		let u = !0;
		Qf(e, i, a, o) || (u = !1, (ol.instantAnimations || !s) && l?.(Pd(e, n, t)), e[0] = e[e.length - 1], $f(n), n.repeat = 0);
		let d = r ? this.resolvedAt && this.resolvedAt - this.createdAt > op ? this.resolvedAt : this.createdAt : void 0, { onComplete: f } = n;
		n.startTime ??= d, n.finalKeyframe = t, n.keyframes = e, n.onComplete = () => {
			f?.(), this.notifyFinished();
		};
		let p = u && !c && ap(n), m;
		if (p) {
			n.element = n.motionValue?.owner?.current;
			try {
				m = new Yf(n);
			} catch {
				m = new Hd(n);
			}
		} else m = new Hd(n);
		this.pendingTimeline &&= (this.stopTimeline = m.attachTimeline(this.pendingTimeline), void 0), this._animation = m;
	}
	get finished() {
		return this._animation ? this._animation.finished : super.finished;
	}
	then(e, t) {
		return this.finished.finally(e).then(() => {});
	}
	get animation() {
		return this._animation || (this.keyframeResolver?.resume(), Af()), this._animation;
	}
	get duration() {
		return this.animation.duration;
	}
	get iterationDuration() {
		return this.animation.iterationDuration;
	}
	get time() {
		return this.animation.time;
	}
	set time(e) {
		this.animation.time = e;
	}
	get speed() {
		return this.animation.speed;
	}
	get state() {
		return this.animation.state;
	}
	set speed(e) {
		this.animation.speed = e;
	}
	get startTime() {
		return this.animation.startTime;
	}
	attachTimeline(e) {
		return this._animation ? this.stopTimeline = this.animation.attachTimeline(e) : this.pendingTimeline = e, () => this.stop();
	}
	play() {
		this.animation.play();
	}
	pause() {
		this.animation.pause();
	}
	complete() {
		this.animation.complete();
	}
	cancel() {
		this._animation && this.animation.cancel(), this.keyframeResolver?.cancel();
	}
}, cp = class {
	constructor(e) {
		this.stop = () => this.runAll("stop"), this.animations = e.filter(Boolean);
	}
	get finished() {
		return Promise.all(this.animations.map((e) => e.finished));
	}
	getAll(e) {
		return this.animations[0][e];
	}
	setAll(e, t) {
		for (let n = 0; n < this.animations.length; n++) this.animations[n][e] = t;
	}
	attachTimeline(e) {
		let t = this.animations.map((t) => t.attachTimeline(e));
		return () => {
			t.forEach((e, t) => {
				e && e(), this.animations[t].stop();
			});
		};
	}
	get time() {
		return this.getAll("time");
	}
	set time(e) {
		this.setAll("time", e);
	}
	get speed() {
		return this.getAll("speed");
	}
	set speed(e) {
		this.setAll("speed", e);
	}
	get state() {
		return this.getAll("state");
	}
	get startTime() {
		return this.getAll("startTime");
	}
	get duration() {
		return lp(this.animations, "duration");
	}
	get iterationDuration() {
		return lp(this.animations, "iterationDuration");
	}
	runAll(e) {
		this.animations.forEach((t) => t[e]());
	}
	play() {
		this.runAll("play");
	}
	pause() {
		this.runAll("pause");
	}
	cancel() {
		this.runAll("cancel");
	}
	complete() {
		this.runAll("complete");
	}
};
function lp(e, t) {
	let n = 0;
	for (let r = 0; r < e.length; r++) {
		let i = e[r][t];
		i !== null && i > n && (n = i);
	}
	return n;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/GroupAnimationWithThen.mjs
var up = class extends cp {
	then(e, t) {
		return this.finished.finally(e).then(() => {});
	}
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/calc-child-stagger.mjs
function dp(e, t, n, r = 0, i = 1) {
	let a = Array.from(e).sort((e, t) => e.sortNodePosition(t)).indexOf(t), o = e.size, s = (o - 1) * r;
	return typeof n == "function" ? n(a, o) : i === 1 ? a * r : s - a * r;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/index.mjs
var fp = 30, pp = (e) => !isNaN(parseFloat(e)), mp = { current: void 0 }, hp = class {
	constructor(e, t = {}) {
		this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (e) => {
			let t = Gl.now();
			if (this.updatedAt !== t && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(e), this.current !== this.prev && (this.notifyChange(), this.dependents)) for (let e of this.dependents) e.dirty();
		}, this.hasAnimated = !1, this.setCurrent(e), this.owner = t.owner;
	}
	setCurrent(e) {
		this.current = e, this.updatedAt = Gl.now(), this.canTrackVelocity === null && e !== void 0 && (this.canTrackVelocity = pp(this.current));
	}
	setPrevFrameValue(e = this.current) {
		this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt;
	}
	onChange(e) {
		return this.on("change", e);
	}
	on(e, t) {
		var n;
		return e === "change" ? this.onChangeSubscribe(t) : ((n = this.events)[e] || (n[e] = new ml())).add(t);
	}
	onChangeSubscribe(e) {
		let { events: t } = this;
		return !t.change && !this.changeSubscriber ? this.changeSubscriber = e : (t.change || (t.change = new ml(), t.change.add(this.changeSubscriber), this.changeSubscriber = void 0), t.change.add(e)), () => {
			this.changeSubscriber === e ? this.changeSubscriber = void 0 : t.change?.remove(e), this.stopIfUnobserved();
		};
	}
	stopIfUnobserved() {
		Q.read(() => {
			!this.changeSubscriber && !this.events.change?.getSize() && this.stop();
		});
	}
	clearListeners() {
		this.changeSubscriber = void 0;
		for (let e in this.events) this.events[e].clear();
	}
	attach(e, t) {
		this.passiveEffect = e, this.stopPassiveEffect = t;
	}
	set(e) {
		this.passiveEffect ? this.passiveEffect(e, this.updateAndNotify) : this.updateAndNotify(e);
	}
	setWithVelocity(e, t, n) {
		this.set(t), this.prev = void 0, this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt - n;
	}
	jump(e, t = !0) {
		this.updateAndNotify(e), this.prev = e, this.prevUpdatedAt = this.prevFrameValue = void 0, t && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
	}
	dirty() {
		this.notifyChange();
	}
	notifyChange() {
		let { current: e, changeSubscriber: t } = this;
		t ? t(e) : this.events.change?.notify(e);
	}
	addDependent(e) {
		this.dependents ||= /* @__PURE__ */ new Set(), this.dependents.add(e);
	}
	removeDependent(e) {
		this.dependents && this.dependents.delete(e);
	}
	get() {
		return mp.current && mp.current.push(this), this.current;
	}
	getPrevious() {
		return this.prev;
	}
	getVelocity() {
		let e = Gl.now();
		if (!this.canTrackVelocity || this.prevFrameValue === void 0 || e - this.updatedAt > fp) return 0;
		let t = Math.min(this.updatedAt - this.prevUpdatedAt, fp);
		return /* @__PURE__ */ _l(parseFloat(this.current) - parseFloat(this.prevFrameValue), t);
	}
	start(e) {
		return this.stop(), new Promise((t) => {
			this.hasAnimated = !0;
			let n = !1, r;
			r = e(() => {
				n = !0, this.events.animationComplete?.notify(), this.animation === r && this.clearAnimation(), t();
			}), n || (this.animation = r), this.events.animationStart?.notify();
		});
	}
	stop() {
		this.animation && (this.animation.stop(), this.events.animationCancel && this.events.animationCancel.notify()), this.clearAnimation();
	}
	isAnimating() {
		return !!this.animation;
	}
	clearAnimation() {
		this.animation = void 0;
	}
	destroy() {
		this.dependents?.clear(), this.events.destroy?.notify(), this.clearListeners(), this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
	}
};
function gp(e, t) {
	return new hp(e, t);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/resolve-transition.mjs
function _p(e, t) {
	if (e?.inherit && t) {
		let { inherit: n, ...r } = e;
		return {
			...t,
			...r
		};
	}
	return e;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/get-value-transition.mjs
function vp(e, t) {
	let n = e?.[t] ?? e?.default ?? e;
	return n === e ? n : _p(n, e);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/utils/default-transitions.mjs
var yp = {
	type: "spring",
	stiffness: 500,
	damping: 25,
	restSpeed: 10
}, bp = (e) => ({
	type: "spring",
	stiffness: 550,
	damping: e === 0 ? 2 * Math.sqrt(550) : 30,
	restSpeed: 10
}), xp = {
	type: "keyframes",
	duration: .8
}, Sp = {
	type: "keyframes",
	ease: [
		.25,
		.1,
		.35,
		1
	],
	duration: .3
}, Cp = (e, { keyframes: t }) => t.length > 2 ? xp : gf.has(e) ? e.startsWith("scale") ? bp(t[1]) : yp : Sp, wp = /* @__PURE__ */ new Set([
	"when",
	"delay",
	"delayChildren",
	"staggerChildren",
	"staggerDirection",
	"repeat",
	"repeatType",
	"repeatDelay",
	"from",
	"elapsed"
]);
function Tp(e) {
	for (let t in e) if (!wp.has(t)) return !0;
	return !1;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/interfaces/motion-value.mjs
var Ep = (e, t, n, r = {}, i, a) => (o) => {
	let s = vp(r, e) || {}, c = s.delay || r.delay || 0, { elapsed: l = 0 } = r;
	l -= /* @__PURE__ */ hl(c);
	let u = {
		keyframes: Array.isArray(n) ? n : [null, n],
		ease: "easeOut",
		velocity: t.getVelocity(),
		...s,
		delay: -l,
		onUpdate: (e) => {
			t.set(e), s.onUpdate && s.onUpdate(e);
		},
		onComplete: () => {
			o(), s.onComplete && s.onComplete();
		},
		name: e,
		motionValue: t,
		element: a ? void 0 : i
	};
	Tp(s) || Object.assign(u, Cp(e, u)), u.duration &&= /* @__PURE__ */ hl(u.duration), u.repeatDelay &&= /* @__PURE__ */ hl(u.repeatDelay), u.from !== void 0 && (u.keyframes[0] = u.from);
	let d = !1;
	if ((u.type === !1 || u.duration === 0 && !u.repeatDelay) && ($f(u), u.delay === 0 && (d = !0)), (ol.instantAnimations || ol.skipAnimations || i?.shouldSkipAnimations || s.skipAnimations) && (d = !0, $f(u), u.delay = 0), u.allowFlatten = !s.type && !s.ease, d && !a && t.get() !== void 0) {
		let e = Pd(u.keyframes, s);
		if (e !== void 0) {
			Q.update(() => {
				u.onUpdate(e), u.onComplete();
			});
			return;
		}
	}
	return s.isSync ? new Hd(u) : new sp(u);
}, Dp = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
function Op(e) {
	let t = Dp.exec(e);
	if (!t) return [,];
	let [, n, r, i] = t;
	return [`--${n ?? r}`, i];
}
function kp(e, t, n = 1) {
	`${e}`;
	let [r, i] = Op(e);
	if (!r) return;
	let a = window.getComputedStyle(t).getPropertyValue(r);
	if (a) {
		let e = a.trim();
		return sl(e) ? parseFloat(e) : e;
	}
	return Xl(i) ? kp(i, t, n + 1) : i;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/resolve-variants.mjs
function Ap(e) {
	let t = [{}, {}];
	return e?.values.forEach((e, n) => {
		t[0][n] = e.get(), t[1][n] = e.getVelocity();
	}), t;
}
function jp(e, t, n, r) {
	let i = (t) => typeof t == "function" ? t(n === void 0 ? e.custom : n, ...Ap(r)) : t;
	return t = i(t), typeof t == "string" && (t = e.variants && e.variants[t]), i(t);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/resolve-dynamic-variants.mjs
function Mp(e, t, n) {
	return jp(e.getProps(), t, n, e);
}
var Np = (e, t) => t === "exit" ? e.presenceContext?.custom : void 0, Pp = /* @__PURE__ */ new Set([
	"width",
	"height",
	"top",
	"left",
	"right",
	"bottom",
	...hf
]), Fp = (e) => Array.isArray(e);
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/setters.mjs
function Ip(e, t, n) {
	e.hasValue(t) ? e.getValue(t).set(n) : e.addValue(t, gp(n));
}
function Lp(e) {
	return Fp(e) ? e[e.length - 1] || 0 : e;
}
function Rp(e, t) {
	let { transitionEnd: n = {}, transition: r = {}, ...i } = Mp(e, t) || {};
	i = {
		...i,
		...n
	};
	for (let t in i) Ip(e, t, Lp(i[t]));
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/utils/is-motion-value.mjs
var zp = (e) => !!(e && e.getVelocity);
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/will-change/is.mjs
function Bp(e) {
	return !!(zp(e) && e.add);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/will-change/add-will-change.mjs
function Vp(e, t) {
	let n = e.getValue("willChange");
	if (Bp(n)) return n.add(t);
	if (!n && ol.WillChange) {
		let n = new ol.WillChange("auto");
		e.addValue("willChange", n), n.add(t);
	}
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/dom/utils/camel-to-dash.mjs
function Hp(e) {
	return e.replace(/([A-Z])/g, (e) => `-${e.toLowerCase()}`);
}
var Up = "data-" + Hp("framerAppearId");
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/optimized-appear/get-appear-id.mjs
function Wp(e) {
	return e.props[Up];
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/interfaces/visual-element-target.mjs
var Gp = typeof window < "u";
function Kp({ protectedKeys: e, needsAnimating: t }, n) {
	let r = n in e && !t[n];
	return t[n] = !1, r;
}
function qp(e, t, { delay: n = 0, transitionOverride: r, type: i } = {}) {
	let { transition: a, transitionEnd: o, ...s } = t, c = e.getDefaultTransition();
	a = a ? _p(a, c) : c;
	let l = a?.reduceMotion, u = a?.skipAnimations;
	r && (a = r);
	let d = [], f = i && e.animationState?.getState()[i], p = a?.path;
	p && p.animateVisualElement(e, s, a, n, d);
	for (let t in s) {
		let r = e.getValue(t, e.latestValues[t] ?? null), i = s[t];
		if (i === void 0 || f && Kp(f, t)) continue;
		let o = {
			delay: n,
			...vp(a || {}, t)
		};
		u && (o.skipAnimations = !0);
		let c = r.get();
		if (c !== void 0 && !r.isAnimating() && !Array.isArray(i) && i === c && !o.velocity) {
			Q.update(() => r.set(i));
			continue;
		}
		let p = !1;
		if (Gp && window.MotionHandoffAnimation) {
			let n = Wp(e);
			if (n) {
				let e = window.MotionHandoffAnimation(n, t, Q);
				e !== null && (o.startTime = e, p = !0);
			}
		}
		Vp(e, t);
		let m = l ?? e.shouldReduceMotion;
		r.start(Ep(t, r, i, m && Pp.has(t) ? { type: !1 } : o, e, p));
		let h = r.animation;
		h && d.push(h);
	}
	if (o) {
		let t = () => Q.update(() => {
			o && Rp(e, o);
		});
		d.length ? Promise.all(d).then(t) : t();
	}
	return d;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/interfaces/visual-element-variant.mjs
function Jp(e, t, n = {}) {
	let r = Mp(e, t, Np(e, n.type)), i = n.transitionOverride || (r?.transition ?? (e.getDefaultTransition() || {})), a = () => Promise.all(r ? qp(e, r, n) : []), o = (r = 0) => {
		let { variantChildren: a } = e, { delayChildren: o = 0, staggerChildren: s, staggerDirection: c } = i, l = [];
		return a?.forEach((e) => {
			e.notify("AnimationStart", t), l.push(Jp(e, t, {
				...n,
				delay: r + (typeof o == "function" ? 0 : o) + dp(a, e, o, s, c)
			}).then(() => e.notify("AnimationComplete", t)));
		}), Promise.all(l);
	}, { when: s } = i;
	return s ? s === "beforeChildren" ? a().then(() => o()) : o().then(a) : Promise.all([a(), o(n.delay)]);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/interfaces/visual-element.mjs
function Yp(e, t, n = {}) {
	return e.notify("AnimationStart", t), (Array.isArray(t) ? Promise.all(t.map((t) => Jp(e, t, n))) : typeof t == "string" ? Jp(e, t, n) : Promise.all(qp(e, Mp(e, t, n.custom), n))).then(() => {
		e.notify("AnimationComplete", t);
	});
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/types/auto.mjs
var Xp = {
	test: (e) => e === "auto",
	parse: (e) => e
}, Zp = (e) => (t) => t.test(e), Qp = [
	$l,
	K,
	pu,
	fu,
	hu,
	mu,
	Xp
], $p = (e) => Qp.find(Zp(e));
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/utils/is-none.mjs
function em(e) {
	return typeof e == "number" ? e === 0 : e === null || e === "none" || e === "0" || ll(e);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/utils/make-none-animatable.mjs
var tm = /* @__PURE__ */ new Set([
	"auto",
	"none",
	"0"
]);
function nm(e, t, n) {
	let r = 0, i;
	for (; r < e.length && !i;) {
		let t = e[r];
		typeof t == "string" && !tm.has(t) && ku(t) && (i = e[r]), r++;
	}
	if (i && n) for (let r of t) e[r] !== i && (e[r] = ef(n, i));
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/keyframes/DOMKeyframesResolver.mjs
var rm = class extends Mf {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i, !0);
	}
	readKeyframes() {
		let { unresolvedKeyframes: e, element: t, name: n } = this;
		if (!t || !t.current) return;
		super.readKeyframes();
		for (let n = 0; n < e.length; n++) {
			let r = e[n];
			if (typeof r == "string" && (r = r.trim(), Xl(r))) {
				let i = kp(r, t.current);
				i !== void 0 && (e[n] = i), n === e.length - 1 && (this.finalKeyframe = r);
			}
		}
		if (this.resolveNoneKeyframes(), !Pp.has(n) || e.length !== 2) return;
		let [r, i] = e;
		if (typeof r == "number" && typeof i == "number") return;
		let a = $p(r), o = $p(i);
		if (Ql(r) !== Ql(i) && Cf[n]) this.needsMeasurement = !0;
		else if (a !== o) {
			if (_f(a) && _f(o)) for (let t = 0; t < e.length; t++) {
				let n = e[t];
				typeof n == "string" && (e[t] = parseFloat(n));
			}
			else Cf[n] && (this.needsMeasurement = !0);
		}
	}
	resolveNoneKeyframes() {
		let { unresolvedKeyframes: e, name: t } = this, n = [];
		for (let t = 0; t < e.length; t++) (e[t] === null || em(e[t])) && n.push(t);
		n.length && nm(e, n, t);
	}
	measure() {
		let { element: e, name: t } = this;
		return Cf[t](window.getComputedStyle(e.current), () => e.measureViewportBox());
	}
	measureInitialState() {
		let { element: e, unresolvedKeyframes: t, name: n } = this;
		if (!e || !e.current) return;
		n === "height" && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = this.measure(), t[0] = this.measuredOrigin;
		let r = t[t.length - 1];
		r !== void 0 && this.motionValue?.jump(r, !1);
	}
	measureEndState() {
		let { element: e, unresolvedKeyframes: t } = this;
		if (!e || !e.current) return;
		this.motionValue?.jump(this.measuredOrigin, !1);
		let n = t.length - 1, r = t[n];
		t[n] = this.measure(), r !== null && this.finalKeyframe === void 0 && (this.finalKeyframe = r), this.removedTransforms?.length && this.removedTransforms.forEach(([t, n]) => {
			e.getValue(t).set(n);
		}), this.resolveNoneKeyframes();
	}
}, im = [
	"borderTopLeftRadius",
	"borderTopRightRadius",
	"borderBottomRightRadius",
	"borderBottomLeftRadius"
], am = [];
function om(e) {
	typeof e.test == "function" && e.read, sm(e), am.unshift(e);
}
function sm(e) {
	il(am, e);
}
function cm(e) {
	return am.find((t) => t.test(e));
}
function lm(e, t, n = {}, r) {
	let i = [], { velocity: a } = n, o = n.reduceMotion ?? r?.shouldReduceMotion;
	for (let s in t) {
		if (s === "transition" || s === "transitionEnd") continue;
		let c = t[s];
		if (c === void 0) continue;
		let l = e(s), u = l.get();
		u !== void 0 && !l.isAnimating() && !Array.isArray(c) && c === u && !a ? Q.update(() => l.set(c)) : (l.start(Ep(s, l, c, o && Pp.has(s) ? { type: !1 } : n, r)), l.animation && i.push(l.animation));
	}
	let { transitionEnd: s } = t;
	if (s) {
		let t = () => Q.update(() => {
			for (let t in s) e(t).set(s[t]);
		});
		i.length ? Promise.all(i).then(t) : t();
	}
	return i;
}
function um(e, t, n, r, i) {
	return lm((r) => {
		let a = e.get(t, r);
		if (!a) {
			let o;
			if (!i) {
				let i = n[r];
				o = dm(i) ?? e.read(t, r, i), `${r}`;
			}
			a = gp(o, { owner: i }), e(t, { [r]: a });
		}
		return a;
	}, n, r, i);
}
function dm(e) {
	let t = Array.isArray(e) ? e[0] : void 0;
	return t === null ? void 0 : t;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/is-html-element.mjs
function fm(e) {
	return cl(e) && "offsetHeight" in e && !("ownerSVGElement" in e);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/is-svg-element.mjs
function pm(e) {
	return cl(e) && "ownerSVGElement" in e;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/types/utils/get-as-type.mjs
var mm = (e, t) => t && typeof e == "number" ? t.transform(e) : e;
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
function hm(e, t, n) {
	if (e == null) return [];
	if (e instanceof EventTarget) return [e];
	if (typeof e == "string") {
		let r = document;
		t && (r = t.current);
		let i = n?.[e] ?? r.querySelectorAll(e);
		return i ? Array.from(i) : [];
	}
	return Array.from(e).filter((e) => e != null);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/effects/MotionValueState.mjs
var gm = class {
	constructor(e = Q.render) {
		this.step = e, this.values = /* @__PURE__ */ new Map(), this.pending = [], this.numPending = 0, this.flush = () => {
			let { pending: e, numPending: t } = this;
			this.numPending = 0;
			for (let n = 0; n < t; n++) e[n]();
		};
	}
	set(e, t, n, r) {
		if (this.values.get(e)?.onRemove(), r) for (let e of this.values.values()) e.value === r && (n = e.render);
		let i = () => n && this.schedule(n);
		t.get() !== void 0 && i();
		let a = t.on("change", i), o = () => {
			a(), n && !r && this.cancel(n), this.values.get(e)?.onRemove === o && this.values.delete(e);
		};
		return this.values.set(e, {
			value: t,
			render: r ? void 0 : n,
			onRemove: o
		}), o;
	}
	get(e) {
		return this.values.get(e)?.value;
	}
	release() {
		let e = /* @__PURE__ */ new Map();
		return this.values.forEach((t, n) => {
			e.set(n, t.value), t.onRemove();
		}), this.transformKeys = this.transformValues = void 0, e;
	}
	schedule(e) {
		let { pending: t, numPending: n } = this;
		for (let r = 0; r < n; r++) if (t[r] === e) return;
		n || this.step(this.flush), t[this.numPending++] = e;
	}
	cancel(e) {
		let { pending: t } = this;
		for (let n = 0; n < this.numPending; n++) if (t[n] === e) {
			t[n] = t[--this.numPending];
			return;
		}
	}
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/effects/utils/create-effect.mjs
function _m(e, { step: t, ...n } = {}) {
	let r = /* @__PURE__ */ new WeakMap();
	return Object.assign((n, i) => {
		let a = r.get(n) ?? new gm(t);
		r.set(n, a);
		let o = [];
		for (let t in i) {
			let r = i[t], s = e(n, a, t, r);
			o.push(s);
		}
		return () => {
			for (let e of o) e();
		};
	}, n, {
		get: (e, t) => r.get(e)?.get(t),
		flush: (e) => r.get(e)?.flush(),
		state: (e) => r.get(e)
	});
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/effects/style/transform.mjs
var vm = {
	x: "translateX",
	y: "translateY",
	z: "translateZ",
	transformPerspective: "perspective"
}, ym = {};
function bm(e) {
	let t = "", { transformKeys: n = [], transformValues: r = {} } = e;
	for (let e = 0; e < n.length; e++) {
		let i = n[e], a = r[i].get();
		a !== void 0 && (typeof a == "number" ? a : parseFloat(a)) !== +!!i.startsWith("scale") && (t += (t && " ") + (ym[i] || (ym[i] = (vm[i] || i) + "(")) + mm(a, Yd[i]) + ")");
	}
	let i = e.get("pathRotation")?.get();
	return i && (t += (t && " ") + "rotate(" + mm(i, Yd.pathRotation) + ")"), t || "none";
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/effects/style/index.mjs
var xm = /* @__PURE__ */ new Set([
	"originX",
	"originY",
	"originZ"
]), Sm = (e, t) => mm(e.get(t)?.get(), Xd[t]), Cm = (e, t, n, r) => {
	let i, a;
	if (gf.has(n)) {
		if (n !== "pathRotation") {
			let e = t.transformKeys ??= [];
			(t.transformValues ??= {})[n] = r, e.includes(n) || (e.push(n), e.sort((e, t) => hf.indexOf(e) - hf.indexOf(t)));
		}
		t.get("transform") || (!fm(e) && !t.get("transformBox") && Cm(e, t, "transformBox", new hp("fill-box")), t.set("transform", new hp("none"), () => {
			e.style.transform = bm(t);
		})), a = t.get("transform");
	} else xm.has(n) ? (t.get("transformOrigin") || t.set("transformOrigin", new hp(""), () => {
		let n = Sm(t, "originX") ?? "50%", r = Sm(t, "originY") ?? "50%", i = Sm(t, "originZ") ?? 0;
		e.style.transformOrigin = `${n} ${r} ${i}`;
	}), a = t.get("transformOrigin")) : i = Nf(n) ? () => {
		e.style.setProperty(n, r.get());
	} : () => {
		e.style[n] = mm(r.get(), Xd[n]);
	};
	return t.set(n, r, i, a);
}, wm = (e) => fm(e) || pm(e), Tm = (e, t) => {
	if (gf.has(t)) return pf(e, t);
	let n = getComputedStyle(e), r = Nf(t) ? n.getPropertyValue(t) : n[t];
	return typeof r == "string" && r.trim() || 0;
}, Em = /*@__PURE__*/ _m(Cm, {
	test: wm,
	read: Tm
}), Dm = {
	x: "translateX",
	y: "translateY",
	z: "translateZ",
	transformPerspective: "perspective"
}, Om = hf.length;
function km(e, t, n) {
	let r = "", i = !0;
	for (let a = 0; a < Om; a++) {
		let o = hf[a], s = e[o];
		if (s === void 0) continue;
		let c = !0;
		if (typeof s == "number") c = s === +!!o.startsWith("scale");
		else {
			let e = parseFloat(s);
			c = o.startsWith("scale") ? e === 1 : e === 0;
		}
		if (!c || n) {
			let e = mm(s, Xd[o]);
			if (!c) {
				i = !1;
				let t = Dm[o] || o;
				r += `${t}(${e}) `;
			}
			n && (t[o] = e);
		}
	}
	let a = e.pathRotation;
	return a && (i = !1, r += `rotate(${mm(a, Xd.pathRotation)}) `), r = r.trim(), n ? r = n(t, i ? "" : r) : i && (r = "none"), r;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/html/utils/build-styles.mjs
function Am(e, t, n) {
	let { style: r, vars: i, transformOrigin: a } = e, o = !1, s = !1;
	for (let e in t) {
		let n = t[e];
		if (gf.has(e)) o = !0;
		else if (Jl(e)) i[e] = n;
		else {
			let t = mm(n, Xd[e]);
			e.startsWith("origin") ? (s = !0, a[e] = t) : r[e] = t;
		}
	}
	if (t.transform || (o || n ? r.transform = km(t, e.transform, n) : r.transform &&= "none"), s) {
		let { originX: e = "50%", originY: t = "50%", originZ: n = 0 } = a;
		r.transformOrigin = `${e} ${t} ${n}`;
	}
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/svg/utils/path.mjs
var jm = {
	offset: "stroke-dashoffset",
	array: "stroke-dasharray"
}, Mm = {
	offset: "strokeDashoffset",
	array: "strokeDasharray"
};
function Nm(e, t, n = 1, r = 0, i = !0) {
	e.pathLength = 1;
	let a = i ? jm : Mm;
	e[a.offset] = `${-r}`, e[a.array] = `${t} ${n}`;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/svg/utils/build-attrs.mjs
var Pm = [
	"transform",
	"opacity",
	"offsetDistance",
	"offsetPath",
	"offsetRotate",
	"offsetAnchor"
];
function Fm(e, { attrX: t, attrY: n, attrScale: r, pathLength: i, pathSpacing: a = 1, pathOffset: o = 0, ...s }, c, l, u) {
	if (Am(e, s, l), c) {
		e.style.viewBox && (e.attrs.viewBox = e.style.viewBox);
		return;
	}
	e.attrs = e.style, e.style = {};
	let { attrs: d, style: f } = e;
	for (let e of Pm) d[e] !== void 0 && (f[e] = d[e], delete d[e]);
	(f.transform || d.transformOrigin) && (f.transformOrigin = d.transformOrigin ?? "50% 50%", delete d.transformOrigin), f.transform && (f.transformBox = u?.transformBox ?? "fill-box", delete d.transformBox), t !== void 0 && (d.x = t), n !== void 0 && (d.y = n), r !== void 0 && (d.scale = r), i !== void 0 && Nm(d, i, a, o, !1);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/effects/attr/index.mjs
function Im(e, t) {
	if (!(t in e)) return !1;
	let n = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), t) || Object.getOwnPropertyDescriptor(e, t);
	return n && typeof n.set == "function";
}
var Lm = (e, t, n, r, i = n) => {
	let a = Im(e, i);
	!a && (i.startsWith("data") || i.startsWith("aria")) && (i = Hp(i));
	let o = Xd[n] || Xd[i], s = a ? () => {
		e[i] = mm(r.get(), Xd[n]);
	} : () => {
		let t = mm(r.get(), o);
		t == null ? e.removeAttribute(i) : e.setAttribute(i, String(t));
	};
	return t.set(n, r, s);
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/effects/svg/index.mjs
function Rm(e, t, n, r) {
	return Q.render(() => e.setAttribute("pathLength", "1")), n === "pathOffset" ? t.set(n, r, () => {
		let t = r.get();
		e.setAttribute("stroke-dashoffset", `${-t}`);
	}) : (t.get("stroke-dasharray") || t.set("stroke-dasharray", new hp("1 1"), () => {
		let n = t.get("pathLength")?.get() ?? 1, r = t.get("pathSpacing")?.get();
		e.setAttribute("stroke-dasharray", `${n} ${r ?? 1 - Number(n)}`);
	}), t.set(n, r, void 0, t.get("stroke-dasharray")));
}
var zm = /*@__PURE__*/ _m((e, t, n, r) => n.startsWith("path") ? Rm(e, t, n, r) : n.startsWith("attr") ? Lm(e, t, n, r, Bm(n)) : (gf.has(n) || xm.has(n) || Nf(n) || n in e.style ? Cm : Lm)(e, t, n, r), {
	test: pm,
	read: (e, t) => gf.has(t) ? Xd[t]?.default || 0 : Nf(t) || Pm.includes(t) ? Tm(e, t) || e.getAttribute(Hp(t)) || 0 : (t = Bm(t), e.getAttribute(Hp(t)) ?? e.getAttribute(t) ?? void 0)
});
function Bm(e) {
	return e.replace(/^attr([A-Z])/, (e, t) => t.toLowerCase());
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/geometry/conversion.mjs
function Vm({ top: e, left: t, right: n, bottom: r }) {
	return {
		x: {
			min: t,
			max: n
		},
		y: {
			min: e,
			max: r
		}
	};
}
function Hm({ x: e, y: t }) {
	return {
		top: t.min,
		right: e.max,
		bottom: t.max,
		left: e.min
	};
}
function Um(e, t) {
	if (!t) return e;
	let n = t({
		x: e.left,
		y: e.top
	}), r = t({
		x: e.right,
		y: e.bottom
	});
	return {
		top: n.y,
		left: n.x,
		bottom: r.y,
		right: r.x
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/utils/has-transform.mjs
function Wm(e) {
	return e === void 0 || e === 1;
}
function Gm({ scale: e, scaleX: t, scaleY: n }) {
	return !Wm(e) || !Wm(t) || !Wm(n);
}
function Km(e) {
	return Gm(e) || qm(e) || e.z || e.rotate || e.rotateX || e.rotateY || e.skewX || e.skewY;
}
function qm(e) {
	return Jm(e.x) || Jm(e.y);
}
function Jm(e) {
	return e && e !== "0%";
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/geometry/delta-apply.mjs
function Ym(e, t, n) {
	return n + t * (e - n);
}
function Xm(e, t, n, r, i) {
	return i !== void 0 && (e = Ym(e, i, r)), Ym(e, n, r) + t;
}
function Zm(e, t = 0, n = 1, r, i) {
	e.min = Xm(e.min, t, n, r, i), e.max = Xm(e.max, t, n, r, i);
}
function Qm(e, { x: t, y: n }) {
	Zm(e.x, t.translate, t.scale, t.originPoint), Zm(e.y, n.translate, n.scale, n.originPoint);
}
var $m = .999999999999, eh = 1.0000000000001;
function th(e, t, n, r = !1) {
	let i = n.length;
	if (!i) return;
	t.x = t.y = 1;
	let a, o;
	for (let s = 0; s < i; s++) {
		a = n[s], o = a.projectionDelta;
		let { visualElement: i } = a.options;
		i && i.props.style && i.props.style.display === "contents" || (r && a.options.layoutScroll && a.scroll && a !== a.root && (nh(e.x, -a.scroll.offset.x), nh(e.y, -a.scroll.offset.y)), o && (t.x *= o.x.scale, t.y *= o.y.scale, Qm(e, o)), r && Km(a.latestValues) && ah(e, a.latestValues, a.layout?.layoutBox));
	}
	t.x < eh && t.x > $m && (t.x = 1), t.y < eh && t.y > $m && (t.y = 1);
}
function nh(e, t) {
	e.min += t, e.max += t;
}
function rh(e, t, n, r, i = .5) {
	Zm(e, t, n, q(e.min, e.max, i), r);
}
function ih(e, t) {
	return typeof e == "string" ? parseFloat(e) / 100 * (t.max - t.min) : e;
}
function ah(e, t, n) {
	let r = n ?? e;
	rh(e.x, ih(t.x, r.x), t.scaleX, t.scale, t.originX), rh(e.y, ih(t.y, r.y), t.scaleY, t.scale, t.originY);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/utils/measure.mjs
function oh(e, t) {
	return Vm(Um(e.getBoundingClientRect(), t));
}
function sh(e, t, n) {
	let r = oh(e, n), { scroll: i } = t;
	return i && (nh(r.x, i.offset.x), nh(r.y, i.offset.y)), r;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/animate/element.mjs
var ch = {}, lh = (e) => pm(e) ? zm : Em, uh = class {
	constructor(e, t) {
		this.effect = e, this.current = t, this.KeyframeResolver = rm;
	}
	getValue(e) {
		return this.effect.get(this.current, e);
	}
	readValue(e, t) {
		return this.effect.read(this.current, e, t);
	}
	render() {
		this.effect.flush(this.current);
	}
	measureViewportBox() {
		return oh(this.current);
	}
	getProps() {
		return ch;
	}
};
function dh(e, t, n, r) {
	if (r) return lm((e) => r.getValue(e, null), t, n, r);
	let i = lh(e);
	return um(i, e, t, n, new uh(i, e));
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/effects/prop/index.mjs
var fh = /*@__PURE__*/ _m((e, t, n, r) => t.set(n, r, () => {
	e[n] = r.get();
}), {
	test: (e) => cl(e),
	read: (e, t) => {
		let n = e[t];
		return typeof n == "string" || typeof n == "number" ? n : void 0;
	}
}), { schedule: ph, cancel: mh } = /* @__PURE__ */ nd(queueMicrotask, !1), hh = {
	x: !1,
	y: !1
};
function gh() {
	return hh.x || hh.y;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/gestures/drag/state/set-active.mjs
function _h(e) {
	return e === "x" || e === "y" ? hh[e] ? null : (hh[e] = !0, () => {
		hh[e] = !1;
	}) : hh.x || hh.y ? null : (hh.x = hh.y = !0, () => {
		hh.x = hh.y = !1;
	});
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/gestures/utils/setup.mjs
function vh(e, t) {
	let n = hm(e), r = new AbortController();
	return [
		n,
		{
			passive: !0,
			...t,
			signal: r.signal
		},
		() => r.abort()
	];
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/gestures/hover.mjs
function yh(e) {
	return !(e.pointerType === "touch" || gh());
}
function bh(e, t, n = {}) {
	let [r, i, a] = vh(e, n);
	return r.forEach((e) => {
		let n = !1, r = !1, a, o = () => {
			e.removeEventListener("pointerleave", u);
		}, s = (e) => {
			a &&= (a(e), void 0), o();
		}, c = (e) => {
			n = !1, window.removeEventListener("pointerup", c), window.removeEventListener("pointercancel", c), r && (r = !1, s(e));
		}, l = () => {
			n = !0, window.addEventListener("pointerup", c, i), window.addEventListener("pointercancel", c, i);
		}, u = (e) => {
			e.pointerType !== "touch" && (n ? r = !0 : s(e));
		};
		e.addEventListener("pointerenter", (n) => {
			if (!yh(n)) return;
			r = !1;
			let o = t(e, n);
			typeof o == "function" && (a = o, e.addEventListener("pointerleave", u, i));
		}, i), e.addEventListener("pointerdown", l, i);
	}), a;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/gestures/utils/is-node-or-child.mjs
var xh = (e, t) => t ? e === t || xh(e, t.parentElement) : !1, Sh = (e) => e.pointerType === "mouse" ? typeof e.button != "number" || e.button <= 0 : e.isPrimary !== !1, Ch = /* @__PURE__ */ new Set([
	"BUTTON",
	"INPUT",
	"SELECT",
	"TEXTAREA",
	"A"
]);
function wh(e) {
	return Ch.has(e.tagName) || e.isContentEditable === !0;
}
var Th = /* @__PURE__ */ new Set([
	"INPUT",
	"SELECT",
	"TEXTAREA"
]);
function Eh(e) {
	return Th.has(e.tagName) || e.isContentEditable === !0;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/gestures/press/utils/state.mjs
var Dh = /* @__PURE__ */ new WeakSet();
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/gestures/press/utils/keyboard.mjs
function Oh(e) {
	return (t) => {
		t.key === "Enter" && e(t);
	};
}
function kh(e, t) {
	e.dispatchEvent(new PointerEvent("pointer" + t, {
		isPrimary: !0,
		bubbles: !0
	}));
}
var Ah = (e, t) => {
	let n = e.currentTarget;
	if (!n) return;
	let r = Oh(() => {
		if (Dh.has(n)) return;
		kh(n, "down");
		let e = Oh(() => {
			kh(n, "up");
		});
		n.addEventListener("keyup", e, t), n.addEventListener("blur", () => kh(n, "cancel"), t);
	});
	n.addEventListener("keydown", r, t), n.addEventListener("blur", () => n.removeEventListener("keydown", r), t);
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/gestures/press/index.mjs
function jh(e) {
	return Sh(e) && !gh();
}
var Mh = /* @__PURE__ */ new WeakSet();
function Nh(e, t, n = {}) {
	let [r, i, a] = vh(e, n), o = (e) => {
		let r = e.currentTarget;
		if (!jh(e) || Mh.has(e)) return;
		Dh.add(r), n.stopPropagation && Mh.add(e);
		let a = t(r, e), o = {
			...i,
			capture: !0
		}, s = (e, t) => {
			window.removeEventListener("pointerup", c, o), window.removeEventListener("pointercancel", l, o), Dh.has(r) && Dh.delete(r), jh(e) && typeof a == "function" && a(e, { success: t });
		}, c = (e) => {
			s(e, r === window || r === document || n.useGlobalTarget || xh(r, e.target));
		}, l = (e) => {
			s(e, !1);
		};
		window.addEventListener("pointerup", c, o), window.addEventListener("pointercancel", l, o);
	};
	return r.forEach((e) => {
		(n.useGlobalTarget ? window : e).addEventListener("pointerdown", o, i), fm(e) && (e.addEventListener("focus", (e) => Ah(e, i)), !wh(e) && !e.hasAttribute("tabindex") && (e.tabIndex = 0));
	}), a;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/resize/handle-element.mjs
var Ph = /* @__PURE__ */ new WeakMap(), Fh, Ih = (e, t, n) => (r, i) => i && i[0] ? i[0][e + "Size"] : pm(r) && "getBBox" in r ? r.getBBox()[t] : r[n], Lh = /*@__PURE__*/ Ih("inline", "width", "offsetWidth"), Rh = /*@__PURE__*/ Ih("block", "height", "offsetHeight");
function zh({ target: e, borderBoxSize: t }) {
	Ph.get(e)?.forEach((n) => {
		n(e, {
			get width() {
				return Lh(e, t);
			},
			get height() {
				return Rh(e, t);
			}
		});
	});
}
function Bh(e) {
	e.forEach(zh);
}
function Vh() {
	typeof ResizeObserver < "u" && (Fh = new ResizeObserver(Bh));
}
function Hh(e, t) {
	Fh || Vh();
	let n = hm(e);
	return n.forEach((e) => {
		let n = Ph.get(e);
		n || (n = /* @__PURE__ */ new Set(), Ph.set(e, n)), n.add(t), Fh?.observe(e);
	}), () => {
		n.forEach((e) => {
			let n = Ph.get(e);
			n?.delete(t), n?.size || Fh?.unobserve(e);
		});
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/resize/handle-window.mjs
var Uh = /* @__PURE__ */ new Set(), Wh;
function Gh() {
	Wh = () => {
		let e = {
			get width() {
				return window.innerWidth;
			},
			get height() {
				return window.innerHeight;
			}
		};
		Uh.forEach((t) => t(e));
	}, window.addEventListener("resize", Wh);
}
function Kh(e) {
	return Uh.add(e), Wh || Gh(), () => {
		Uh.delete(e), !Uh.size && typeof Wh == "function" && (window.removeEventListener("resize", Wh), Wh = void 0);
	};
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/resize/index.mjs
function qh(e, t) {
	return typeof e == "function" ? Kh(e) : Hh(e, t);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/stats/buffer.mjs
var Jh = {
	value: null,
	addProjectionMetrics: null
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/is-svg-svg-element.mjs
function Yh(e) {
	return pm(e) && e.tagName === "svg";
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/transform.mjs
function Xh(...e) {
	let t = !Array.isArray(e[0]), n = t ? 0 : -1, r = e[0 + n], i = e[1 + n], a = e[2 + n], o = e[3 + n], s = wd(i, a, o);
	return t ? s(r) : s;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/utils/as-number.mjs
var Zh = (e) => typeof e == "number" ? e : parseFloat(e), Qh = () => ({
	translate: 0,
	scale: 1,
	origin: 0,
	originPoint: 0
}), $h = () => ({
	x: Qh(),
	y: Qh()
}), eg = () => ({
	min: 0,
	max: 0
}), tg = () => ({
	x: eg(),
	y: eg()
}), ng = /* @__PURE__ */ new WeakMap();
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/is-animation-controls.mjs
function rg(e) {
	return typeof e == "object" && !!e && typeof e.start == "function";
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/is-variant-label.mjs
function ig(e) {
	return typeof e == "string" || Array.isArray(e);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/variant-props.mjs
var ag = [
	"animate",
	"whileInView",
	"whileFocus",
	"whileHover",
	"whileTap",
	"whileDrag",
	"exit"
], og = ["initial", ...ag];
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/is-controlling-variants.mjs
function sg(e) {
	if (rg(e.animate)) return !0;
	for (let t = 0; t < og.length; t++) if (ig(e[og[t]])) return !0;
	return !1;
}
function cg(e) {
	return !!(sg(e) || e.variants);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/motion-values.mjs
function lg(e, t, n) {
	for (let r in t) {
		let i = t[r], a = n[r];
		if (zp(i)) e.addValue(r, i);
		else if (zp(a)) e.addValue(r, gp(i, { owner: e }));
		else if (a !== i) {
			if (e.hasValue(r)) {
				let t = e.getValue(r);
				t.liveStyle === !0 ? t.jump(i) : t.hasAnimated || t.set(i);
			} else {
				let t = e.getStaticValue(r);
				e.addValue(r, gp(t === void 0 ? i : t, { owner: e }));
			}
		}
	}
	for (let r in n) t[r] === void 0 && e.removeValue(r);
	return t;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/reduced-motion/state.mjs
var ug = { current: null }, dg = { current: !1 }, fg = typeof window < "u";
function pg() {
	if (dg.current = !0, fg) {
		if (window.matchMedia) {
			let e = window.matchMedia("(prefers-reduced-motion)"), t = () => ug.current = e.matches;
			e.addEventListener("change", t), t();
		} else ug.current = !1;
	}
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/VisualElement.mjs
var mg = [
	"AnimationStart",
	"AnimationComplete",
	"Update",
	"BeforeLayoutMeasure",
	"LayoutMeasure",
	"LayoutAnimationStart",
	"LayoutAnimationComplete"
], hg = {};
function gg(e) {
	hg = e;
}
function _g() {
	return hg;
}
var vg = class {
	scrapeMotionValuesFromProps(e, t, n) {
		return {};
	}
	constructor({ parent: e, props: t, presenceContext: n, reducedMotionConfig: r, skipAnimations: i, blockInitialAnimation: a, visualState: o }, s = {}) {
		this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = !1, this.isControllingVariants = !1, this.shouldReduceMotion = null, this.shouldSkipAnimations = !1, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = Mf, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = !1, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
			this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
		}, this.renderScheduledAt = 0, this.scheduleRender = () => {
			let e = Gl.now();
			this.renderScheduledAt < e && (this.renderScheduledAt = e, Q.render(this.render, !1, !0));
		};
		let { latestValues: c, renderState: l } = o;
		this.latestValues = c, this.baseTarget = { ...c }, this.initialValues = t.initial ? { ...c } : {}, this.renderState = l, this.parent = e, this.props = t, this.presenceContext = n, this.depth = e ? e.depth + 1 : 0, this.reducedMotionConfig = r, this.skipAnimationsConfig = i, this.options = s, this.blockInitialAnimation = !!a, this.isControllingVariants = sg(t), this.isVariantNode = cg(t), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(e && e.current);
		let { willChange: u, ...d } = this.scrapeMotionValuesFromProps(t, {}, this);
		for (let e in d) {
			let t = d[e];
			c[e] !== void 0 && zp(t) && t.set(c[e]);
		}
	}
	mount(e) {
		if (this.hasBeenMounted) for (let e in this.initialValues) this.values.get(e)?.jump(this.initialValues[e]), this.latestValues[e] = this.initialValues[e];
		if (this.current = e, ng.set(e, this), this.projection && !this.projection.instance && this.projection.mount(e), this.isVariantNode && !this.isControllingVariants) {
			let e = this;
			do
				e = e.props.inherit !== !1 && e.parent;
			while (e && !e.isVariantNode);
			if (e) {
				let { variantChildren: t } = e;
				t.add(this), this.removeFromVariantTree = () => t.delete(this);
			}
		}
		this.values.forEach((e, t) => this.bindToMotionValue(t, e)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = !1 : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = !0 : (dg.current || pg(), this.shouldReduceMotion = ug.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? !1, this.parent?.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = !0;
	}
	unmount() {
		this.projection && this.projection.unmount(), rd(this.notifyUpdate), rd(this.render), this.valueSubscriptions.forEach((e) => e()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), this.parent?.removeChild(this);
		for (let e in this.events) this.events[e].clear();
		for (let e in this.features) {
			let t = this.features[e];
			t && (t.unmount(), t.isMounted = !1);
		}
		this.current = null;
	}
	addChild(e) {
		this.children.add(e), this.enteringChildren ??= /* @__PURE__ */ new Set(), this.enteringChildren.add(e);
	}
	removeChild(e) {
		this.children.delete(e), this.enteringChildren && this.enteringChildren.delete(e);
	}
	bindToMotionValue(e, t) {
		if (this.valueSubscriptions.has(e) && this.valueSubscriptions.get(e)(), t.accelerate && ep.has(e) && this.current instanceof HTMLElement) {
			let { factory: n, keyframes: r, times: i, ease: a, duration: o } = t.accelerate, s = new Wf({
				element: this.current,
				name: e,
				keyframes: r,
				times: i,
				ease: a,
				duration: /* @__PURE__ */ hl(o)
			}), c = n(s);
			this.valueSubscriptions.set(e, () => {
				c(), s.cancel();
			});
			return;
		}
		let n = gf.has(e);
		n && this.onBindTransform && this.onBindTransform();
		let r = t.on("change", (t) => {
			this.latestValues[e] = t, this.props.onUpdate && Q.preRender(this.notifyUpdate), n && this.projection && (this.projection.isTransformDirty = !0), this.scheduleRender();
		}), i;
		typeof window < "u" && window.MotionCheckAppearSync && (i = window.MotionCheckAppearSync(this, e, t)), this.valueSubscriptions.set(e, () => {
			r(), i && i();
		});
	}
	sortNodePosition(e) {
		return !this.current || !e.current || !this.sortInstanceNodePosition || this.type !== e.type ? 0 : this.sortInstanceNodePosition(this.current, e.current);
	}
	updateFeatures() {
		let e = "animation";
		for (e in hg) {
			let t = hg[e];
			if (!t) continue;
			let { isEnabled: n, Feature: r } = t;
			if (!this.features[e] && r && n(this.props) && (this.features[e] = new r(this)), this.features[e]) {
				let t = this.features[e];
				t.isMounted ? t.update() : (t.mount(), t.isMounted = !0);
			}
		}
	}
	triggerBuild() {
		this.build(this.renderState, this.latestValues, this.props);
	}
	measureViewportBox() {
		return this.current ? this.measureInstanceViewportBox(this.current, this.props) : tg();
	}
	getStaticValue(e) {
		return this.latestValues[e];
	}
	setStaticValue(e, t) {
		this.latestValues[e] = t;
	}
	update(e, t) {
		(e.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = e, this.prevPresenceContext = this.presenceContext, this.presenceContext = t;
		for (let t = 0; t < mg.length; t++) {
			let n = mg[t];
			this.propEventSubscriptions[n] && (this.propEventSubscriptions[n](), delete this.propEventSubscriptions[n]);
			let r = e["on" + n];
			r && (this.propEventSubscriptions[n] = this.on(n, r));
		}
		this.prevMotionValues = lg(this, this.scrapeMotionValuesFromProps(e, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
	}
	getProps() {
		return this.props;
	}
	getVariant(e) {
		return this.props.variants ? this.props.variants[e] : void 0;
	}
	getDefaultTransition() {
		return this.props.transition;
	}
	getTransformPagePoint() {
		return this.props.transformPagePoint;
	}
	addValue(e, t) {
		let n = this.values.get(e);
		if (t !== n) {
			n && this.removeValue(e), this.bindToMotionValue(e, t), this.values.set(e, t);
			let r = t.get();
			r !== void 0 && (this.latestValues[e] = r);
		}
	}
	removeValue(e) {
		this.values.delete(e);
		let t = this.valueSubscriptions.get(e);
		t && (t(), this.valueSubscriptions.delete(e)), delete this.latestValues[e], this.removeValueFromRenderState(e, this.renderState);
	}
	hasValue(e) {
		return this.values.has(e);
	}
	getValue(e, t) {
		if (this.props.values && this.props.values[e]) return this.props.values[e];
		let n = this.values.get(e);
		return n === void 0 && t !== void 0 && (n = gp(t ?? this.getDefaultValue?.(e), { owner: this }), this.addValue(e, n)), n;
	}
	readValue(e, t) {
		let n = this.latestValues[e] !== void 0 || !this.current ? this.latestValues[e] : this.getBaseTargetFromProps(this.props, e) ?? this.readValueFromInstance(this.current, e, this.options);
		return n != null && (typeof n == "string" && (sl(n) || ll(n)) ? n = parseFloat(n) : typeof n != "number" && !Lu.test(n) && Lu.test(t) && (n = ef(e, t)), this.setBaseTarget(e, zp(n) ? n.get() : n)), zp(n) ? n.get() : n;
	}
	setBaseTarget(e, t) {
		this.baseTarget[e] = t;
	}
	on(e, t) {
		return this.events[e] || (this.events[e] = new ml()), this.events[e].add(t);
	}
	notify(e, ...t) {
		this.events[e] && this.events[e].notify(...t);
	}
	scheduleRenderMicrotask() {
		ph.render(this.render);
	}
}, yg = class extends vg {
	constructor() {
		super(...arguments), this.KeyframeResolver = rm;
	}
	sortInstanceNodePosition(e, t) {
		return e.compareDocumentPosition(t) & 2 ? 1 : -1;
	}
	getBaseTargetFromProps(e, t) {
		let n = e.style;
		return n ? n[t] : void 0;
	}
	removeValueFromRenderState(e, { vars: t, style: n }) {
		delete t[e], delete n[e];
	}
	handleChildMotionValue() {
		this.childSubscription && (this.childSubscription(), delete this.childSubscription);
		let { children: e } = this.props;
		zp(e) && (this.childSubscription = e.on("change", (e) => {
			this.current && (this.current.textContent = `${e}`);
		}));
	}
}, bg = class {
	constructor(e) {
		this.isMounted = !1, this.node = e;
	}
	update() {}
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/html/utils/render.mjs
function xg(e, { style: t, vars: n }, r, i) {
	let a = e.style, o;
	for (o in t) a[o] = t[o];
	for (o in i?.applyProjectionStyles(a, r), n) a.setProperty(o, n[o]);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/styles/scale-correction.mjs
var Sg = {};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/is-forced-motion-value.mjs
function Cg(e, { layout: t, layoutId: n }) {
	return gf.has(e) || e.startsWith("origin") || (t || n !== void 0) && (!!Sg[e] || e === "opacity");
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/html/utils/scrape-motion-values.mjs
function wg(e, t, n) {
	let r = e.style, i = t?.style, a = {};
	if (!r) return a;
	for (let t in r) (zp(r[t]) || i && zp(i[t]) || Cg(t, e) || n?.getValue(t)?.liveStyle !== void 0) && (a[t] = r[t]);
	return a;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/html/HTMLVisualElement.mjs
function Tg(e) {
	return window.getComputedStyle(e);
}
var Eg = class extends yg {
	constructor() {
		super(...arguments), this.type = "html", this.renderInstance = xg;
	}
	mount(e) {
		e.style, super.mount(e);
	}
	readValueFromInstance(e, t) {
		if (gf.has(t)) return this.projection?.isProjecting ? df(t) : pf(e, t);
		{
			let n = Tg(e), r = (Jl(t) ? n.getPropertyValue(t) : n[t]) || 0;
			return typeof r == "string" ? r.trim() : r;
		}
	}
	measureInstanceViewportBox(e, { transformPagePoint: t }) {
		return oh(e, t);
	}
	build(e, t, n) {
		Am(e, t, n.transformTemplate);
	}
	scrapeMotionValuesFromProps(e, t, n) {
		return wg(e, t, n);
	}
}, Dg = /* @__PURE__ */ new Set([
	"baseFrequency",
	"diffuseConstant",
	"kernelMatrix",
	"kernelUnitLength",
	"keySplines",
	"keyTimes",
	"limitingConeAngle",
	"markerHeight",
	"markerWidth",
	"numOctaves",
	"targetX",
	"targetY",
	"surfaceScale",
	"specularConstant",
	"specularExponent",
	"stdDeviation",
	"tableValues",
	"viewBox",
	"gradientTransform",
	"pathLength",
	"startOffset",
	"textLength",
	"lengthAdjust"
]), Og = (e) => typeof e == "string" && e.toLowerCase() === "svg";
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/svg/utils/render.mjs
function kg(e, t, n, r) {
	xg(e, t, void 0, r);
	for (let n in t.attrs) e.setAttribute(Dg.has(n) ? n : Hp(n), t.attrs[n]);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/svg/utils/scrape-motion-values.mjs
function Ag(e, t, n) {
	let r = wg(e, t, n);
	for (let n in e) if (zp(e[n]) || zp(t[n])) {
		let t = hf.indexOf(n) === -1 ? n : "attr" + n.charAt(0).toUpperCase() + n.substring(1);
		r[t] = e[n];
	}
	return r;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/svg/SVGVisualElement.mjs
var jg = class extends yg {
	constructor() {
		super(...arguments), this.type = "svg", this.isSVGTag = !1, this.measureInstanceViewportBox = tg;
	}
	getBaseTargetFromProps(e, t) {
		return gf.has(t) ? super.getBaseTargetFromProps(e, t) ?? df(t) : e[t];
	}
	getDefaultValue(e) {
		return gf.has(e) ? this.latestValues[e] ?? df(e) : void 0;
	}
	readValueFromInstance(e, t) {
		if (gf.has(t)) {
			let e = Qd(t);
			return e && e.default || 0;
		}
		if (Pm.includes(t)) {
			let n = getComputedStyle(e)[t];
			if (typeof n == "string" && n) return n.trim();
		}
		return t = Dg.has(t) ? t : Hp(t), e.getAttribute(t);
	}
	scrapeMotionValuesFromProps(e, t, n) {
		return Ag(e, t, n);
	}
	build(e, t, n) {
		Fm(e, t, this.isSVGTag, n.transformTemplate, n.style);
	}
	renderInstance(e, t, n, r) {
		kg(e, t, n, r);
	}
	mount(e) {
		this.isSVGTag = Og(e.tagName), super.mount(e);
	}
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/shallow-compare.mjs
function Mg(e, t) {
	if (!Array.isArray(t)) return !1;
	let n = t.length;
	if (n !== e.length) return !1;
	for (let r = 0; r < n; r++) if (t[r] !== e[r]) return !1;
	return !0;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/render/utils/animation-state.mjs
var Ng = [...ag].reverse();
function Pg(e) {
	let t = (t) => Promise.all(t.map(({ animation: t, options: n }) => Yp(e, t, n))), n = Ig(), r = !0, i = !1;
	function a(a) {
		let { props: o, parent: s, manuallyAnimateOnMount: c } = e, l = r || i, u = [], d = /* @__PURE__ */ new Set(), f = {}, p = Infinity, m = e;
		do
			m = m.props.inherit !== !1 && m.parent;
		while (m && !m.isControllingVariants);
		if (Ng.forEach((t, r) => {
			let i = n[t], h = o[t], g = m && m.props[t], _ = h === void 0 ? ig(g) || g === !1 ? g : void 0 : h, v = ig(_), y = t === a ? i.isActive : null;
			y === !1 && (p = r);
			let b = v && h === void 0 && !(l && c);
			if (i.protectedKeys = { ...f }, !i.isActive && y === null || !_ && !i.prevProp || rg(_) || typeof _ == "boolean") return;
			if (t === "exit" && i.isActive && y !== !0) {
				f = {
					...f,
					...i.prevResolvedValues
				};
				return;
			}
			let x = Fg(i.prevProp, _), S = x || v && (y && !b || r > p), C = !1, w = Array.isArray(_) ? _ : [_], T = {};
			if (y !== !1) for (let n of w) {
				let { transition: r, transitionEnd: i, ...a } = Mp(e, n, Np(e, t)) || {};
				T = {
					...T,
					...a,
					...i
				};
			}
			let { prevResolvedValues: E } = i;
			for (let t in {
				...E,
				...T
			}) {
				if (t in f) continue;
				let n = T[t], r = E[t], a = Array.isArray(n) && Array.isArray(r) ? !Mg(n, r) || x : n !== r;
				if (a && n == null) d.add(t);
				else if (a || n !== void 0 && d.has(t)) {
					S = !0, d.delete(t) && (C = !0), i.needsAnimating[t] = !0;
					let n = e.getValue(t);
					n && (n.liveStyle = !1);
				} else i.protectedKeys[t] = !0;
			}
			if (i.prevProp = _, i.prevResolvedValues = T, i.isActive && (f = {
				...f,
				...T
			}), S && (!(b && x) || C)) for (let n of w) {
				let r = { type: t };
				if (typeof n == "string" && l && c && s?.enteringChildren) {
					let t = Mp(s, n)?.transition?.delayChildren;
					r.delay = dp(s.enteringChildren, e, t);
				}
				u.push({
					animation: n,
					options: r
				});
			}
		}), d.size) {
			let { initial: t } = o, n = {}, r = typeof t != "boolean" && Mp(e, Array.isArray(t) ? t[0] : t, e.presenceContext?.custom);
			r && r.transition && (n.transition = r.transition), d.forEach((i) => {
				let a = e.getValue(i);
				a && (a.liveStyle = !0);
				let s = r && !Array.isArray(t) ? r[i] : void 0, c = e.getBaseTargetFromProps(o, i);
				n[i] = (s === void 0 ? c !== void 0 && !zp(c) ? c : e.initialValues[i] === void 0 ? e.baseTarget[i] : void 0 : s) ?? null;
			}), u.push({ animation: n });
		}
		let h = l && e.blockInitialAnimation || r && !c && (o.initial === !1 || o.initial === o.animate);
		return r = i = !1, !h && u.length ? t(u) : Promise.resolve();
	}
	function o(t, r) {
		if (n[t].isActive === r) return Promise.resolve();
		e.variantChildren?.forEach((e) => e.animationState?.setActive(t, r)), n[t].isActive = r;
		let i = a(t);
		for (let e in n) n[e].protectedKeys = {};
		return i;
	}
	return {
		animateChanges: a,
		setActive: o,
		setAnimateFunction: (n) => {
			t = n(e);
		},
		getState: () => n,
		reset: () => {
			n = Ig(), i = !0;
		}
	};
}
function Fg(e, t) {
	return typeof t == "string" ? t !== e : Array.isArray(t) ? !Mg(t, e) : !1;
}
function Ig() {
	let e = {};
	for (let t of ag) e[t] = {
		isActive: t === "animate",
		protectedKeys: {},
		needsAnimating: {},
		prevResolvedValues: {}
	};
	return e;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/geometry/copy.mjs
function Lg(e, t) {
	e.min = t.min, e.max = t.max;
}
function Rg(e, t) {
	Lg(e.x, t.x), Lg(e.y, t.y);
}
function zg(e, t) {
	e.translate = t.translate, e.scale = t.scale, e.originPoint = t.originPoint, e.origin = t.origin;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/geometry/delta-calc.mjs
var Bg = .9999, Vg = 1.0001, Hg = -.01, Ug = .01;
function Wg(e) {
	return e.max - e.min;
}
function Gg(e, t, n) {
	return Math.abs(e - t) <= n;
}
function Kg(e, t, n, r = .5) {
	e.origin = r, e.originPoint = q(t.min, t.max, e.origin), e.scale = Wg(n) / Wg(t), e.translate = q(n.min, n.max, e.origin) - e.originPoint, (e.scale >= Bg && e.scale <= Vg || isNaN(e.scale)) && (e.scale = 1), (e.translate >= Hg && e.translate <= Ug || isNaN(e.translate)) && (e.translate = 0);
}
function qg(e, t, n, r) {
	Kg(e.x, t.x, n.x, r ? r.originX : void 0), Kg(e.y, t.y, n.y, r ? r.originY : void 0);
}
function Jg(e, t, n, r = 0) {
	e.min = (r ? q(n.min, n.max, r) : n.min) + t.min, e.max = e.min + Wg(t);
}
function Yg(e, t, n, r) {
	Jg(e.x, t.x, n.x, r?.x), Jg(e.y, t.y, n.y, r?.y);
}
function Xg(e, t, n, r = 0) {
	let i = r ? q(n.min, n.max, r) : n.min;
	e.min = t.min - i, e.max = e.min + Wg(t);
}
function Zg(e, t, n, r) {
	Xg(e.x, t.x, n.x, r?.x), Xg(e.y, t.y, n.y, r?.y);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/geometry/delta-remove.mjs
function Qg(e, t, n, r, i) {
	return e -= t, e = Ym(e, 1 / n, r), i !== void 0 && (e = Ym(e, 1 / i, r)), e;
}
function $g(e, t = 0, n = 1, r = .5, i, a = e, o = e) {
	if (pu.test(t) && (t = parseFloat(t), t = q(o.min, o.max, t / 100) - o.min), typeof t != "number") return;
	let s = q(a.min, a.max, r);
	e === a && (s -= t), e.min = Qg(e.min, t, n, s, i), e.max = Qg(e.max, t, n, s, i);
}
function e_(e, t, [n, r, i], a, o) {
	$g(e, t[n], t[r], t[i], t.scale, a, o);
}
var t_ = [
	"x",
	"scaleX",
	"originX"
], n_ = [
	"y",
	"scaleY",
	"originY"
];
function r_(e, t, n, r) {
	e_(e.x, t, t_, n ? n.x : void 0, r ? r.x : void 0), e_(e.y, t, n_, n ? n.y : void 0, r ? r.y : void 0);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/geometry/utils.mjs
function i_(e) {
	return e.translate === 0 && e.scale === 1;
}
function a_(e) {
	return i_(e.x) && i_(e.y);
}
function o_(e, t) {
	return e.min === t.min && e.max === t.max;
}
function s_(e, t) {
	return o_(e.x, t.x) && o_(e.y, t.y);
}
function c_(e, t) {
	return Math.round(e.min) === Math.round(t.min) && Math.round(e.max) === Math.round(t.max);
}
function l_(e, t) {
	return c_(e.x, t.x) && c_(e.y, t.y);
}
function u_(e) {
	return Wg(e.x) / Wg(e.y);
}
function d_(e, t) {
	return e.translate === t.translate && e.scale === t.scale && e.originPoint === t.originPoint;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/utils/each-axis.mjs
function f_(e) {
	return [e("x"), e("y")];
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/styles/scale-border-radius.mjs
function p_(e, t) {
	return t.max === t.min ? 0 : e / (t.max - t.min) * 100;
}
var m_ = { correct: (e, t) => {
	if (!t.target) return e;
	if (typeof e == "string") {
		if (K.test(e)) e = parseFloat(e);
		else return e;
	}
	return `${p_(e, t.target.x)}% ${p_(e, t.target.y)}%`;
} }, h_ = { correct: (e, { treeScale: t, projectionDelta: n }) => {
	let r = e, i = Lu.parse(e);
	if (i.length > 5) return r;
	let a = Lu.createTransformer(e), o = typeof i[0] == "number" ? 0 : 1, s = n.x.scale * t.x, c = n.y.scale * t.y;
	i[0 + o] /= s, i[1 + o] /= c;
	let l = q(s, c, .5);
	return typeof i[2 + o] == "number" && (i[2 + o] /= l), typeof i[3 + o] == "number" && (i[3 + o] /= l), a(i);
} };
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/styles/transform.mjs
function g_(e, t, n) {
	let r = "", i = e.x.translate / t.x, a = e.y.translate / t.y, o = n?.z || 0;
	if ((i || a || o) && (r = `translate3d(${i}px, ${a}px, ${o}px) `), (t.x !== 1 || t.y !== 1) && (r += `scale(${1 / t.x}, ${1 / t.y}) `), n) {
		let { transformPerspective: e, rotate: t, pathRotation: i, rotateX: a, rotateY: o, skewX: s, skewY: c } = n;
		e && (r = `perspective(${e}px) ${r}`), t && (r += `rotate(${t}deg) `), i && (r += `rotate(${i}deg) `), a && (r += `rotateX(${a}deg) `), o && (r += `rotateY(${o}deg) `), s && (r += `skewX(${s}deg) `), c && (r += `skewY(${c}deg) `);
	}
	let s = e.x.scale * t.x, c = e.y.scale * t.y;
	return (s !== 1 || c !== 1) && (r += `scale(${s}, ${c})`), r || "none";
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/animation/mix-values.mjs
var __ = im.length, v_ = (e) => typeof e == "number" || K.test(e);
function y_(e, t, n, r, i, a) {
	i ? (e.opacity = q(0, n.opacity ?? 1, x_(r)), e.opacityExit = q(t.opacity ?? 1, 0, S_(r))) : a && (e.opacity = q(t.opacity ?? 1, n.opacity ?? 1, r));
	for (let i = 0; i < __; i++) {
		let a = im[i], o = b_(t, a), s = b_(n, a);
		(o !== void 0 || s !== void 0) && (o ||= 0, s ||= 0, o === 0 || s === 0 || v_(o) === v_(s) ? (e[a] = Math.max(q(Zh(o), Zh(s), r), 0), (pu.test(s) || pu.test(o)) && (e[a] += "%")) : e[a] = s);
	}
	(t.rotate || n.rotate) && (e.rotate = q(t.rotate || 0, n.rotate || 0, r));
}
function b_(e, t) {
	return e[t] === void 0 ? e.borderRadius : e[t];
}
var x_ = /*@__PURE__*/ C_(0, .5, jl), S_ = /*@__PURE__*/ C_(.5, .95, dl);
function C_(e, t, n) {
	return (r) => r < e ? 0 : r > t ? 1 : n(/* @__PURE__ */ pl(e, t, r));
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/animation/animate/single-value.mjs
function w_(e, t, n) {
	let r = zp(e) ? e : gp(e);
	return r.start(Ep("", r, t, n)), r.animation;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/events/add-dom-event.mjs
function T_(e, t, n, r = { passive: !0 }) {
	return e.addEventListener(t, n, r), () => e.removeEventListener(t, n, r);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/utils/compare-by-depth.mjs
var E_ = (e, t) => e.depth - t.depth, D_ = class {
	constructor() {
		this.children = [], this.isDirty = !1;
	}
	add(e) {
		rl(this.children, e), this.isDirty = !0;
	}
	remove(e) {
		il(this.children, e), this.isDirty = !0;
	}
	forEach(e) {
		this.isDirty && this.children.sort(E_), this.isDirty = !1, this.children.forEach(e);
	}
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/utils/delay.mjs
function O_(e, t) {
	let n = Gl.now(), r = ({ timestamp: i }) => {
		let a = i - n;
		a >= t && (rd(r), e(a - t));
	};
	return Q.setup(r, !0), () => rd(r);
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/value/utils/resolve-motion-value.mjs
function k_(e) {
	return zp(e) ? e.get() : e;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/shared/stack.mjs
var A_ = class {
	constructor() {
		this.members = [];
	}
	add(e) {
		rl(this.members, e);
		for (let t = this.members.length - 1; t >= 0; t--) {
			let n = this.members[t];
			if (n === e || n === this.lead || n === this.prevLead) continue;
			let r = n.instance;
			r && r.isConnected !== !1 || n.snapshot || (il(this.members, n), n.unmount());
		}
		e.scheduleRender();
	}
	remove(e) {
		if (il(this.members, e), e === this.prevLead && (this.prevLead = void 0), e === this.lead) {
			let e = this.members[this.members.length - 1];
			e && this.promote(e);
		}
	}
	relegate(e) {
		for (let t = this.members.indexOf(e) - 1; t >= 0; t--) {
			let e = this.members[t];
			if (e.isPresent !== !1 && e.instance?.isConnected !== !1) return this.promote(e), !0;
		}
		return !1;
	}
	promote(e, t) {
		let n = this.lead;
		if (e !== n && (this.prevLead = n, this.lead = e, e.show(), n)) {
			n.updateSnapshot(), e.scheduleRender();
			let { layoutDependency: r } = n.options, { layoutDependency: i } = e.options;
			(r === void 0 || r !== i) && (e.resumeFrom = n, t && (n.preserveOpacity = !0), n.snapshot && (e.snapshot = n.snapshot, e.snapshot.latestValues = n.animationValues || n.latestValues), e.root?.isUpdating && (e.isLayoutDirty = !0)), e.options.crossfade === !1 && n.hide();
		}
	}
	exitAnimationComplete() {
		this.members.forEach((e) => {
			e.options.onExitComplete?.(), e.resumingFrom?.options.onExitComplete?.();
		});
	}
	scheduleRender() {
		this.members.forEach((e) => e.instance && e.scheduleRender(!1));
	}
	removeLeadSnapshot() {
		this.lead?.snapshot && (this.lead.snapshot = void 0);
	}
}, j_ = {
	borderRadius: {
		...m_,
		applyTo: [...im]
	},
	borderTopLeftRadius: m_,
	borderTopRightRadius: m_,
	borderBottomLeftRadius: m_,
	borderBottomRightRadius: m_,
	boxShadow: h_
}, M_ = {
	hasAnimatedSinceResize: !0,
	hasEverUpdated: !1
};
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/node/create-projection-node.mjs
Object.assign(Sg, {
	...j_,
	...Sg
});
var N_ = {
	nodes: 0,
	calculatedTargetDeltas: 0,
	calculatedProjections: 0
}, P_ = [
	"",
	"X",
	"Y",
	"Z"
], F_ = 1e3, I_ = 0;
function L_(e, t, n, r) {
	let { latestValues: i } = t;
	i[e] && (n[e] = i[e], t.setStaticValue(e, 0), r && (r[e] = 0));
}
function R_(e) {
	if (e.hasCheckedOptimisedAppear = !0, e.root === e) return;
	let { visualElement: t } = e.options;
	if (!t) return;
	let n = Wp(t);
	if (window.MotionHasOptimisedAnimation(n, "transform")) {
		let { layout: t, layoutId: r } = e.options;
		window.MotionCancelOptimisedAnimation(n, "transform", Q, !(t || r));
	}
	let { parent: r } = e;
	r && !r.hasCheckedOptimisedAppear && R_(r);
}
function z_({ attachResizeListener: e, defaultParent: t, measureScroll: n, checkIsScrollRoot: r, resetTransform: i }) {
	return class {
		constructor(e = {}, n = t?.()) {
			this.id = I_++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = !1, this.isAnimationBlocked = !1, this.isLayoutDirty = !1, this.isProjectionDirty = !1, this.isSharedProjectionDirty = !1, this.isTransformDirty = !1, this.updateManuallyBlocked = !1, this.updateBlockedByResize = !1, this.isUpdating = !1, this.isSVG = !1, this.needsReset = !1, this.shouldResetTransform = !1, this.hasCheckedOptimisedAppear = !1, this.treeScale = {
				x: 1,
				y: 1
			}, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = !1, this.updateScheduled = !1, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = !1, this.checkUpdateFailed = () => {
				this.isUpdating && (this.isUpdating = !1, this.clearAllSnapshots());
			}, this.updateProjection = () => {
				this.projectionUpdateScheduled = !1, Jh.value && (N_.nodes = N_.calculatedTargetDeltas = N_.calculatedProjections = 0), this.nodes.forEach(H_), this.nodes.forEach(Q_), this.nodes.forEach($_), this.nodes.forEach(U_), Jh.addProjectionMetrics && Jh.addProjectionMetrics(N_);
			}, this.resolvedRelativeTargetAt = 0, this.hasProjected = !1, this.isVisible = !0, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = e, this.root = n ? n.root || n : this, this.path = n ? [...n.path, n] : [], this.parent = n, this.depth = n ? n.depth + 1 : 0;
			for (let e = 0; e < this.path.length; e++) this.path[e].shouldResetTransform = !0;
			this.root === this && (this.nodes = new D_());
		}
		addEventListener(e, t) {
			return this.eventHandlers.has(e) || this.eventHandlers.set(e, new ml()), this.eventHandlers.get(e).add(t);
		}
		notifyListeners(e, ...t) {
			let n = this.eventHandlers.get(e);
			n && n.notify(...t);
		}
		hasListeners(e) {
			return this.eventHandlers.has(e);
		}
		mount(t) {
			if (this.instance) return;
			this.isSVG = pm(t) && !Yh(t), this.instance = t;
			let { layoutId: n, layout: r, visualElement: i } = this.options;
			if (i && !i.current && i.mount(t), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (r || n) && (this.isLayoutDirty = !0), e) {
				let n, r = 0, i = () => this.root.updateBlockedByResize = !1;
				Q.read(() => {
					r = window.innerWidth;
				}), e(t, () => {
					let e = window.innerWidth;
					e !== r && (r = e, this.root.updateBlockedByResize = !0, n && n(), n = O_(i, 250), M_.hasAnimatedSinceResize && (M_.hasAnimatedSinceResize = !1, this.nodes.forEach(Z_)));
				});
			}
			n && this.root.registerSharedNode(n, this), this.options.animate !== !1 && i && (n || r) && this.addEventListener("didUpdate", ({ delta: e, hasLayoutChanged: t, hasRelativeLayoutChanged: n, layout: r }) => {
				if (this.isTreeAnimationBlocked()) {
					this.target = void 0, this.relativeTarget = void 0;
					return;
				}
				let a = this.options.transition || i.getDefaultTransition() || ov, { onLayoutAnimationStart: o, onLayoutAnimationComplete: s } = i.getProps(), c = !this.targetLayout || !l_(this.targetLayout, r), l = !t && n;
				if (this.options.layoutRoot || this.resumeFrom || l || t && (c || !this.currentAnimation)) {
					this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
					let t = {
						...vp(a, "layout"),
						onPlay: o,
						onComplete: s
					};
					(i.shouldReduceMotion || this.options.layoutRoot) && (t.delay = 0, t.type = !1), this.startAnimation(t), this.setAnimationOrigin(e, l, t.path);
				} else t || Z_(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
				this.targetLayout = r;
			});
		}
		unmount() {
			this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
			let e = this.getStack();
			e && e.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), rd(this.updateProjection);
		}
		blockUpdate() {
			this.updateManuallyBlocked = !0;
		}
		unblockUpdate() {
			this.updateManuallyBlocked = !1;
		}
		isUpdateBlocked() {
			return this.updateManuallyBlocked || this.updateBlockedByResize;
		}
		isTreeAnimationBlocked() {
			return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || !1;
		}
		startUpdate() {
			this.isUpdateBlocked() || (this.isUpdating = !0, this.nodes && this.nodes.forEach(ev), this.animationId++);
		}
		getTransformTemplate() {
			let { visualElement: e } = this.options;
			return e && e.getProps().transformTemplate;
		}
		willUpdate(e = !0) {
			if (this.root.hasTreeAnimated = !0, this.root.isUpdateBlocked()) {
				this.options.onExitComplete && this.options.onExitComplete();
				return;
			}
			if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && R_(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty) return;
			this.isLayoutDirty = !0;
			for (let e = 0; e < this.path.length; e++) {
				let t = this.path[e];
				t.shouldResetTransform = !0, (typeof t.latestValues.x == "string" || typeof t.latestValues.y == "string") && (t.isLayoutDirty = !0), t.updateScroll("snapshot"), t.options.layoutRoot && t.willUpdate(!1);
			}
			let { layoutId: t, layout: n } = this.options;
			if (t === void 0 && !n) return;
			let r = this.getTransformTemplate();
			this.prevTransformTemplateValue = r ? r(this.latestValues, "") : void 0, this.updateSnapshot(), e && this.notifyListeners("willUpdate");
		}
		update() {
			if (this.updateScheduled = !1, this.isUpdateBlocked()) {
				let e = this.updateBlockedByResize;
				this.unblockUpdate(), this.updateBlockedByResize = !1, this.clearAllSnapshots(), e && this.nodes.forEach(K_), this.nodes.forEach(G_);
				return;
			}
			if (this.animationId <= this.animationCommitId) {
				this.nodes.forEach(q_);
				return;
			}
			this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = !1, this.nodes.forEach(J_), this.nodes.forEach(Y_), this.nodes.forEach(X_), this.nodes.forEach(B_), this.nodes.forEach(V_)) : this.nodes.forEach(q_), this.clearAllSnapshots();
			let e = Gl.now();
			Hl.delta = al(0, 1e3 / 60, e - Hl.timestamp), Hl.timestamp = e, Hl.isProcessing = !0, id.update.process(Hl), id.preRender.process(Hl), id.render.process(Hl), Hl.isProcessing = !1;
		}
		didUpdate() {
			this.updateScheduled || (this.updateScheduled = !0, ph.read(this.scheduleUpdate));
		}
		clearAllSnapshots() {
			this.nodes.forEach(W_), this.sharedNodes.forEach(tv);
		}
		scheduleUpdateProjection() {
			this.projectionUpdateScheduled || (this.projectionUpdateScheduled = !0, Q.preRender(this.updateProjection, !1, !0));
		}
		scheduleCheckAfterUnmount() {
			Q.postRender(() => {
				this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
			});
		}
		updateSnapshot() {
			!this.snapshot && this.instance && (this.snapshot = this.measure(), this.snapshot && !Wg(this.snapshot.measuredBox.x) && !Wg(this.snapshot.measuredBox.y) && (this.snapshot = void 0));
		}
		updateLayout() {
			if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
			if (this.resumeFrom && !this.resumeFrom.instance) for (let e = 0; e < this.path.length; e++) this.path[e].updateScroll();
			let e = this.layout;
			this.layout = this.measure(!1), this.layoutCorrected ||= tg(), this.isLayoutDirty = !1, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
			let { visualElement: t } = this.options;
			t && t.notify("LayoutMeasure", this.layout.layoutBox, e ? e.layoutBox : void 0);
		}
		updateScroll(e = "measure") {
			let t = !!(this.options.layoutScroll && this.instance);
			if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === e && (t = !1), t && this.instance) {
				let t = r(this.instance);
				this.scroll = {
					animationId: this.root.animationId,
					phase: e,
					isRoot: t,
					offset: n(this.instance),
					wasRoot: this.scroll ? this.scroll.isRoot : t
				};
			}
		}
		resetTransform() {
			if (!i) return;
			let e = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, t = this.projectionDelta && !a_(this.projectionDelta), n = this.getTransformTemplate(), r = n ? n(this.latestValues, "") : void 0, a = r !== this.prevTransformTemplateValue;
			e && this.instance && (t || Km(this.latestValues) || a) && (i(this.instance, r), this.shouldResetTransform = !1, this.scheduleRender());
		}
		measure(e = !0) {
			let t = this.measurePageBox(), n = this.removeElementScroll(t);
			return e && (n = this.removeTransform(n)), uv(n), {
				animationId: this.root.animationId,
				measuredBox: t,
				layoutBox: n,
				latestValues: {},
				source: this.id
			};
		}
		measurePageBox() {
			let { visualElement: e } = this.options;
			if (!e) return tg();
			let t = e.measureViewportBox();
			if (!(this.scroll?.wasRoot || this.path.some(fv))) {
				let { scroll: e } = this.root;
				e && (nh(t.x, e.offset.x), nh(t.y, e.offset.y));
			}
			return t;
		}
		removeElementScroll(e) {
			let t = tg();
			if (Rg(t, e), this.scroll?.wasRoot) return t;
			for (let n = 0; n < this.path.length; n++) {
				let r = this.path[n], { scroll: i, options: a } = r;
				r !== this.root && i && a.layoutScroll && (i.wasRoot && Rg(t, e), nh(t.x, i.offset.x), nh(t.y, i.offset.y));
			}
			return t;
		}
		applyTransform(e, t = !1, n) {
			let r = n || tg();
			Rg(r, e);
			for (let e = 0; e < this.path.length; e++) {
				let n = this.path[e];
				!t && n.options.layoutScroll && n.scroll && n !== n.root && (nh(r.x, -n.scroll.offset.x), nh(r.y, -n.scroll.offset.y)), Km(n.latestValues) && ah(r, n.latestValues, n.layout?.layoutBox);
			}
			return Km(this.latestValues) && ah(r, this.latestValues, this.layout?.layoutBox), r;
		}
		removeTransform(e) {
			let t = tg();
			Rg(t, e);
			for (let e = 0; e < this.path.length; e++) {
				let n = this.path[e];
				if (!Km(n.latestValues)) continue;
				let r;
				n.instance && (Gm(n.latestValues) && n.updateSnapshot(), r = tg(), Rg(r, n.measurePageBox())), r_(t, n.latestValues, n.snapshot?.layoutBox, r);
			}
			return Km(this.latestValues) && r_(t, this.latestValues), t;
		}
		setTargetDelta(e) {
			this.targetDelta = e, this.root.scheduleUpdateProjection(), this.isProjectionDirty = !0;
		}
		setOptions(e) {
			this.options = {
				...this.options,
				...e,
				crossfade: e.crossfade === void 0 || e.crossfade
			};
		}
		clearMeasurements() {
			this.scroll = void 0, this.layout = void 0, this.snapshot = void 0, this.prevTransformTemplateValue = void 0, this.targetDelta = void 0, this.target = void 0, this.isLayoutDirty = !1;
		}
		forceRelativeParentToResolveTarget() {
			this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== Hl.timestamp && this.relativeParent.resolveTargetDelta(!0);
		}
		resolveTargetDelta(e = !1) {
			let t = this.getLead();
			this.isProjectionDirty ||= t.isProjectionDirty, this.isTransformDirty ||= t.isTransformDirty, this.isSharedProjectionDirty ||= t.isSharedProjectionDirty;
			let n = !!this.resumingFrom || this !== t;
			if (!(e || n && this.isSharedProjectionDirty || this.isProjectionDirty || this.parent?.isProjectionDirty || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
			let { layout: r, layoutId: i } = this.options;
			if (!this.layout || !(r || i)) return;
			this.resolvedRelativeTargetAt = Hl.timestamp;
			let a = this.getClosestProjectingParent();
			!this.targetDelta && !this.relativeTarget && (this.options.layoutAnchor !== !1 && a && a.layout ? this.createRelativeTarget(a, this.layout.layoutBox, a.layout.layoutBox) : this.removeRelativeTarget()), (this.relativeTarget || this.targetDelta) && (this.target || (this.target = tg(), this.targetWithTransforms = tg()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), Yg(this.target, this.relativeTarget, this.relativeParent.target, this.options.layoutAnchor || void 0)) : this.targetDelta ? (this.resumingFrom ? this.applyTransform(this.layout.layoutBox, !1, this.target) : Rg(this.target, this.layout.layoutBox), Qm(this.target, this.targetDelta)) : Rg(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = !1, this.options.layoutAnchor !== !1 && a && !!a.resumingFrom == !!this.resumingFrom && !a.options.layoutScroll && a.target && this.animationProgress !== 1 ? this.createRelativeTarget(a, this.target, a.target) : this.relativeParent = this.relativeTarget = void 0), Jh.value && N_.calculatedTargetDeltas++);
		}
		getClosestProjectingParent() {
			if (!(!this.parent || Gm(this.parent.latestValues) || qm(this.parent.latestValues))) return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
		}
		isProjecting() {
			return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
		}
		createRelativeTarget(e, t, n) {
			this.relativeParent = e, this.forceRelativeParentToResolveTarget(), this.relativeTarget = tg(), this.relativeTargetOrigin = tg(), Zg(this.relativeTargetOrigin, t, n, this.options.layoutAnchor || void 0), Rg(this.relativeTarget, this.relativeTargetOrigin);
		}
		removeRelativeTarget() {
			this.relativeParent = this.relativeTarget = void 0;
		}
		calcProjection() {
			let e = this.getLead(), t = !!this.resumingFrom || this !== e, n = !0;
			if ((this.isProjectionDirty || this.parent?.isProjectionDirty) && (n = !1), t && (this.isSharedProjectionDirty || this.isTransformDirty) && (n = !1), this.resolvedRelativeTargetAt === Hl.timestamp && (n = !1), n) return;
			let { layout: r, layoutId: i } = this.options;
			if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(r || i)) return;
			Rg(this.layoutCorrected, this.layout.layoutBox);
			let a = this.treeScale.x, o = this.treeScale.y;
			th(this.layoutCorrected, this.treeScale, this.path, t), e.layout && !e.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (e.target = e.layout.layoutBox, e.targetWithTransforms = tg());
			let { target: s } = e;
			s ? (!this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (zg(this.prevProjectionDelta.x, this.projectionDelta.x), zg(this.prevProjectionDelta.y, this.projectionDelta.y)), qg(this.projectionDelta, this.layoutCorrected, s, this.latestValues), this.treeScale.x === a && this.treeScale.y === o && d_(this.projectionDelta.x, this.prevProjectionDelta.x) && d_(this.projectionDelta.y, this.prevProjectionDelta.y) || (this.hasProjected = !0, this.scheduleRender(), this.notifyListeners("projectionUpdate", s)), Jh.value && N_.calculatedProjections++) : this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
		}
		hide() {
			this.isVisible = !1;
		}
		show() {
			this.isVisible = !0;
		}
		scheduleRender(e = !0) {
			if (this.options.visualElement?.scheduleRender(), e) {
				let e = this.getStack();
				e && e.scheduleRender();
			}
			this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
		}
		createProjectionDeltas() {
			this.prevProjectionDelta = $h(), this.projectionDelta = $h(), this.projectionDeltaWithTransform = $h();
		}
		setAnimationOrigin(e, t = !1, n) {
			let r = this.snapshot, i = r ? r.latestValues : {}, a = { ...this.latestValues }, o = $h();
			this.relativeParent && this.relativeParent.options.layoutRoot || (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !t;
			let s = tg(), c = (r ? r.source : void 0) !== (this.layout ? this.layout.source : void 0), l = this.getStack(), u = !l || l.members.length <= 1, d = !(!c || u || this.options.crossfade !== !0 || this.path.some(av));
			this.animationProgress = 0;
			let f, p = n?.interpolateProjection(e);
			this.mixTargetDelta = (t) => {
				let n = t / 1e3, r = p?.(n);
				r ? (o.x.translate = r.x, o.x.scale = q(e.x.scale, 1, n), o.x.origin = e.x.origin, o.x.originPoint = e.x.originPoint, o.y.translate = r.y, o.y.scale = q(e.y.scale, 1, n), o.y.origin = e.y.origin, o.y.originPoint = e.y.originPoint) : (nv(o.x, e.x, n), nv(o.y, e.y, n)), this.setTargetDelta(o), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout && (Zg(s, this.layout.layoutBox, this.relativeParent.layout.layoutBox, this.options.layoutAnchor || void 0), iv(this.relativeTarget, this.relativeTargetOrigin, s, n), f && s_(this.relativeTarget, f) && (this.isProjectionDirty = !1), f ||= tg(), Rg(f, this.relativeTarget)), c && (this.animationValues = a, y_(a, i, this.latestValues, n, d, u)), r && r.rotate !== void 0 && (this.animationValues ||= a, this.animationValues.pathRotation = r.rotate), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = n;
			}, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
		}
		startAnimation(e) {
			this.notifyListeners("animationStart"), this.currentAnimation?.stop(), this.resumingFrom?.currentAnimation?.stop(), this.pendingAnimation &&= (rd(this.pendingAnimation), void 0), this.pendingAnimation = Q.update(() => {
				M_.hasAnimatedSinceResize = !0, this.motionValue ||= gp(0), this.motionValue.jump(0, !1), this.currentAnimation = w_(this.motionValue, [0, 1e3], {
					...e,
					velocity: 0,
					isSync: !0,
					onUpdate: (t) => {
						this.mixTargetDelta(t), e.onUpdate && e.onUpdate(t);
					},
					onComplete: () => {
						e.onComplete && e.onComplete(), this.completeAnimation();
					}
				}), zd(this.currentAnimation, this), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
			});
		}
		completeAnimation() {
			this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
			let e = this.getStack();
			e && e.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = void 0, this.notifyListeners("animationComplete");
		}
		finishAnimation() {
			this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(F_), this.currentAnimation.stop()), this.completeAnimation();
		}
		applyTransformsToTarget() {
			let e = this.getLead(), { targetWithTransforms: t, layout: n, latestValues: r } = e, { target: i } = e;
			if (t && i && n) {
				if (this !== e && this.layout && n && dv(this.options.animationType, this.layout.layoutBox, n.layoutBox)) {
					i = this.target || tg();
					let t = Wg(this.layout.layoutBox.x);
					i.x.min = e.target.x.min, i.x.max = i.x.min + t;
					let n = Wg(this.layout.layoutBox.y);
					i.y.min = e.target.y.min, i.y.max = i.y.min + n;
				}
				Rg(t, i), ah(t, r), qg(this.projectionDeltaWithTransform, this.layoutCorrected, t, r);
			}
		}
		registerSharedNode(e, t) {
			this.sharedNodes.has(e) || this.sharedNodes.set(e, new A_()), this.sharedNodes.get(e).add(t);
			let n = t.options.initialPromotionConfig;
			t.promote({
				transition: n ? n.transition : void 0,
				preserveFollowOpacity: n && n.shouldPreserveFollowOpacity ? n.shouldPreserveFollowOpacity(t) : void 0
			});
		}
		isLead() {
			let e = this.getStack();
			return !e || e.lead === this;
		}
		getLead() {
			let { layoutId: e } = this.options;
			return e && this.getStack()?.lead || this;
		}
		getPrevLead() {
			let { layoutId: e } = this.options;
			return e ? this.getStack()?.prevLead : void 0;
		}
		getStack() {
			let { layoutId: e } = this.options;
			if (e) return this.root.sharedNodes.get(e);
		}
		promote({ needsReset: e, transition: t, preserveFollowOpacity: n } = {}) {
			let r = this.getStack();
			r && r.promote(this, n), e && (this.projectionDelta = void 0, this.needsReset = !0), t && this.setOptions({ transition: t });
		}
		relegate() {
			let e = this.getStack();
			return e ? e.relegate(this) : !1;
		}
		resetSkewAndRotation() {
			let { visualElement: e } = this.options;
			if (!e) return;
			let t = !1, { latestValues: n } = e;
			if ((n.z || n.rotate || n.rotateX || n.rotateY || n.rotateZ || n.skewX || n.skewY) && (t = !0), !t) return;
			let r = {};
			n.z && L_("z", e, r, this.animationValues);
			for (let t = 0; t < P_.length; t++) L_(`rotate${P_[t]}`, e, r, this.animationValues), L_(`skew${P_[t]}`, e, r, this.animationValues);
			e.render();
			for (let t in r) e.setStaticValue(t, r[t]), this.animationValues && (this.animationValues[t] = r[t]);
			e.scheduleRender();
		}
		applyProjectionStyles(e, t) {
			if (!this.instance || this.isSVG) return;
			if (!this.isVisible) {
				e.visibility = "hidden";
				return;
			}
			let n = this.getTransformTemplate();
			if (this.needsReset) {
				this.needsReset = !1, e.visibility = "", e.opacity = "", e.pointerEvents = k_(t?.pointerEvents) || "", e.transform = n ? n(this.latestValues, "") : "none";
				return;
			}
			let r = this.getLead();
			if (!this.projectionDelta || !this.layout || !r.target) {
				this.options.layoutId && (e.opacity = this.latestValues.opacity === void 0 ? 1 : this.latestValues.opacity, e.pointerEvents = k_(t?.pointerEvents) || ""), this.hasProjected && !Km(this.latestValues) && (e.transform = n ? n({}, "") : "none", this.hasProjected = !1);
				return;
			}
			e.visibility = "";
			let i = r.animationValues || r.latestValues;
			this.applyTransformsToTarget();
			let a = g_(this.projectionDeltaWithTransform, this.treeScale, i);
			n && (a = n(i, a)), e.transform = a;
			let { x: o, y: s } = this.projectionDelta;
			e.transformOrigin = `${o.origin * 100}% ${s.origin * 100}% 0`, e.opacity = r.animationValues ? r === this ? i.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : i.opacityExit : r === this ? i.opacity === void 0 ? "" : i.opacity : i.opacityExit === void 0 ? 0 : i.opacityExit;
			for (let t in Sg) {
				if (i[t] === void 0) continue;
				let { correct: n, applyTo: o, isCSSVariable: s } = Sg[t], c = a === "none" ? i[t] : n(i[t], r);
				if (o) {
					let t = o.length;
					for (let n = 0; n < t; n++) e[o[n]] = c;
				} else s ? this.options.visualElement.renderState.vars[t] = c : e[t] = c;
			}
			this.options.layoutId && (e.pointerEvents = r === this ? k_(t?.pointerEvents) || "" : "none");
		}
		clearSnapshot() {
			this.resumeFrom = this.snapshot = void 0;
		}
		resetTree() {
			this.root.nodes.forEach((e) => e.currentAnimation?.stop()), this.root.nodes.forEach(G_), this.root.sharedNodes.clear();
		}
	};
}
function B_(e) {
	e.updateLayout();
}
function V_(e) {
	let t = e.resumeFrom?.snapshot || e.snapshot;
	if (e.isLead() && e.layout && t && e.hasListeners("didUpdate")) {
		let { layoutBox: n, measuredBox: r } = e.layout, { animationType: i } = e.options, a = t.source !== e.layout.source;
		if (i === "size") f_((e) => {
			let r = a ? t.measuredBox[e] : t.layoutBox[e], i = Wg(r);
			r.min = n[e].min, r.max = r.min + i;
		});
		else if (i === "x" || i === "y") {
			let e = i === "x" ? "y" : "x";
			Lg(a ? t.measuredBox[e] : t.layoutBox[e], n[e]);
		} else dv(i, t.layoutBox, n) && f_((r) => {
			let i = a ? t.measuredBox[r] : t.layoutBox[r], o = Wg(n[r]);
			i.max = i.min + o, e.relativeTarget && !e.currentAnimation && (e.isProjectionDirty = !0, e.relativeTarget[r].max = e.relativeTarget[r].min + o);
		});
		let o = $h();
		qg(o, n, t.layoutBox);
		let s = $h();
		a ? qg(s, e.applyTransform(r, !0), t.measuredBox) : qg(s, n, t.layoutBox);
		let c = !a_(o), l = !1;
		if (!e.resumeFrom) {
			let r = e.getClosestProjectingParent();
			if (r && !r.resumeFrom) {
				let { snapshot: i, layout: a } = r;
				if (i && a) {
					let o = e.options.layoutAnchor || void 0, s = tg();
					Zg(s, t.layoutBox, i.layoutBox, o);
					let c = tg();
					Zg(c, n, a.layoutBox, o), l_(s, c) || (l = !0), r.options.layoutRoot && (e.relativeTarget = c, e.relativeTargetOrigin = s, e.relativeParent = r);
				}
			}
		}
		e.notifyListeners("didUpdate", {
			layout: n,
			snapshot: t,
			delta: s,
			layoutDelta: o,
			hasLayoutChanged: c,
			hasRelativeLayoutChanged: l
		});
	} else if (e.isLead()) {
		let { onExitComplete: t } = e.options;
		t && t();
	}
	e.options.transition = void 0;
}
function H_(e) {
	Jh.value && N_.nodes++, e.parent && (e.isProjecting() || (e.isProjectionDirty = e.parent.isProjectionDirty), e.isSharedProjectionDirty ||= !!(e.isProjectionDirty || e.parent.isProjectionDirty || e.parent.isSharedProjectionDirty), e.isTransformDirty ||= e.parent.isTransformDirty);
}
function U_(e) {
	e.isProjectionDirty = e.isSharedProjectionDirty = e.isTransformDirty = !1;
}
function W_(e) {
	e.clearSnapshot();
}
function G_(e) {
	e.clearMeasurements();
}
function K_(e) {
	e.isLayoutDirty = !0, e.updateLayout();
}
function q_(e) {
	e.isLayoutDirty = !1;
}
function J_(e) {
	e.isAnimationBlocked && e.layout && !e.isLayoutDirty && (e.snapshot = e.layout, e.isLayoutDirty = !0);
}
function Y_(e) {
	e.relativeTarget && e.relativeParent?.isLayoutDirty && (e.currentAnimation ? e.isLayoutDirty = !0 : (e.targetDelta = void 0, e.removeRelativeTarget()));
}
function X_(e) {
	let { visualElement: t } = e.options;
	t && t.getProps().onBeforeLayoutMeasure && t.notify("BeforeLayoutMeasure"), e.resetTransform();
}
function Z_(e) {
	e.finishAnimation(), e.targetDelta = e.relativeTarget = e.target = void 0, e.isProjectionDirty = !0;
}
function Q_(e) {
	e.resolveTargetDelta();
}
function $_(e) {
	e.calcProjection();
}
function ev(e) {
	e.resetSkewAndRotation();
}
function tv(e) {
	e.removeLeadSnapshot();
}
function nv(e, t, n) {
	e.translate = q(t.translate, 0, n), e.scale = q(t.scale, 1, n), e.origin = t.origin, e.originPoint = t.originPoint;
}
function rv(e, t, n, r) {
	e.min = q(t.min, n.min, r), e.max = q(t.max, n.max, r);
}
function iv(e, t, n, r) {
	rv(e.x, t.x, n.x, r), rv(e.y, t.y, n.y, r);
}
function av(e) {
	return e.animationValues && e.animationValues.opacityExit !== void 0;
}
var ov = {
	duration: .45,
	ease: [
		.4,
		0,
		.1,
		1
	]
}, sv = (e) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(e), cv = sv("applewebkit/") && !sv("chrome/") ? Math.round : dl;
function lv(e) {
	e.min = cv(e.min), e.max = cv(e.max);
}
function uv(e) {
	lv(e.x), lv(e.y);
}
function dv(e, t, n) {
	return e === "position" || e === "preserve-aspect" && !Gg(u_(t), u_(n), .2);
}
function fv(e) {
	return e !== e.root && e.scroll?.wasRoot;
}
// node_modules/.pnpm/motion-dom@13.5.1/node_modules/motion-dom/dist/es/projection/node/DocumentProjectionNode.mjs
var pv = z_({
	attachResizeListener: (e, t) => T_(e, "resize", t),
	measureScroll: () => ({
		x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0,
		y: document.documentElement.scrollTop || document.body?.scrollTop || 0
	}),
	checkIsScrollRoot: () => !0
}), mv = { current: void 0 }, hv = z_({
	measureScroll: (e) => ({
		x: e.scrollLeft,
		y: e.scrollTop
	}),
	defaultParent: () => {
		if (!mv.current) {
			let e = new pv({});
			e.mount(window), e.setOptions({ layoutScroll: !0 }), mv.current = e;
		}
		return mv.current;
	},
	resetTransform: (e, t) => {
		e.style.transform = t === void 0 ? "none" : t;
	},
	checkIsScrollRoot: (e) => window.getComputedStyle(e).position === "fixed"
}), gv = (0, j.createContext)({
	transformPagePoint: (e) => e,
	isStatic: !1,
	reducedMotion: "never"
});
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/utils/use-composed-ref.mjs
function _v(e, t) {
	if (typeof e == "function") return e(t);
	e != null && (e.current = t);
}
function vv(...e) {
	return (t) => {
		let n = !1, r = e.map((e) => {
			let r = _v(e, t);
			return !n && typeof r == "function" && (n = !0), r;
		});
		if (n) return () => {
			for (let t = 0; t < r.length; t++) {
				let n = r[t];
				typeof n == "function" ? n() : _v(e[t], null);
			}
		};
	};
}
function yv(...e) {
	return j.useCallback(vv(...e), e);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs
var bv = class extends j.Component {
	getSnapshotBeforeUpdate(e) {
		let t = this.props.childRef.current;
		if (fm(t) && e.isPresent && !this.props.isPresent && this.props.pop !== !1) {
			let e = t.offsetParent, n = fm(e) && e.offsetWidth || 0, r = fm(e) && e.offsetHeight || 0, i = getComputedStyle(t), a = this.props.sizeRef.current;
			a.height = parseFloat(i.height), a.width = parseFloat(i.width), a.top = t.offsetTop, a.left = t.offsetLeft, a.right = n - a.width - a.left, a.bottom = r - a.height - a.top, a.direction = i.direction;
		}
		return null;
	}
	componentDidUpdate() {}
	render() {
		return this.props.children;
	}
};
function xv({ children: e, isPresent: t, anchorX: n, anchorY: r, root: i, pop: a }) {
	let o = (0, j.useId)(), s = (0, j.useRef)(null), c = (0, j.useRef)({
		width: 0,
		height: 0,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		direction: "ltr"
	}), { nonce: l } = (0, j.useContext)(gv), u = yv(s, a === !1 ? void 0 : e.props?.ref ?? e?.ref);
	return (0, j.useInsertionEffect)(() => {
		let { width: e, height: u, top: d, left: f, right: p, bottom: m, direction: h } = c.current;
		if (t || a === !1 || !s.current || !e || !u) return;
		let g = h === "rtl", _ = n === "left" ? g ? `right: ${p}` : `left: ${f}` : g ? `left: ${f}` : `right: ${p}`, v = r === "bottom" ? `bottom: ${m}` : `top: ${d}`;
		s.current.dataset.motionPopId = o;
		let y = document.createElement("style");
		l && (y.nonce = l);
		let b = i ?? document.head;
		return b.appendChild(y), y.sheet && y.sheet.insertRule(`
          [data-motion-pop-id="${o}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${u}px !important;
            ${_}px !important;
            ${v}px !important;
          }
        `), () => {
			s.current?.removeAttribute("data-motion-pop-id"), b.contains(y) && b.removeChild(y);
		};
	}, [t]), (0, W.jsx)(bv, {
		isPresent: t,
		childRef: s,
		sizeRef: c,
		pop: a,
		children: a === !1 ? e : j.cloneElement(e, { ref: u })
	});
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs
var Sv = ({ children: e, initial: t, isPresent: n, onExitComplete: r, custom: i, presenceAffectsLayout: a, mode: o, anchorX: s, anchorY: c, root: l }) => {
	let u = el(Cv), d = (0, j.useId)(), f = (0, j.useRef)(n), p = (0, j.useRef)(r);
	tl(() => {
		f.current = n, p.current = r;
	});
	let m = !0, h = (0, j.useMemo)(() => (m = !1, {
		id: d,
		initial: t,
		isPresent: n,
		custom: i,
		onExitComplete: (e) => {
			u.set(e, !0);
			for (let e of u.values()) if (!e) return;
			r && r();
		},
		register: (e) => (u.set(e, !1), () => {
			u.delete(e), !f.current && !u.size && p.current?.();
		})
	}), [
		n,
		u,
		r
	]);
	return a && m && (h = { ...h }), (0, j.useMemo)(() => {
		u.forEach((e, t) => u.set(t, !1));
	}, [n]), j.useEffect(() => {
		!n && !u.size && r && r();
	}, [n]), e = (0, W.jsx)(xv, {
		pop: o === "popLayout",
		isPresent: n,
		anchorX: s,
		anchorY: c,
		root: l,
		children: e
	}), (0, W.jsx)(nl.Provider, {
		value: h,
		children: e
	});
};
function Cv() {
	return /* @__PURE__ */ new Map();
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs
function wv(e = !0) {
	let t = (0, j.useContext)(nl);
	if (t === null) return [!0, null];
	let { isPresent: n, onExitComplete: r, register: i } = t, a = (0, j.useId)();
	(0, j.useEffect)(() => {
		if (e) return i(a);
	}, [e]);
	let o = (0, j.useCallback)(() => e && r && r(a), [
		a,
		r,
		e
	]);
	return !n && r ? [!1, o] : [!0];
}
function Tv() {
	return Ev((0, j.useContext)(nl));
}
function Ev(e) {
	return e === null || e.isPresent;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/components/AnimatePresence/utils.mjs
var Dv = (e) => e.key || "";
function Ov(e) {
	let t = [];
	return j.Children.forEach(e, (e) => {
		(0, j.isValidElement)(e) && t.push(e);
	}), t;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs
var kv = ({ children: e, custom: t, initial: n = !0, onExitComplete: r, presenceAffectsLayout: i = !0, mode: a = "sync", propagate: o = !1, anchorX: s = "left", anchorY: c = "top", root: l }) => {
	let [u, d] = wv(o), f = (0, j.useMemo)(() => Ov(e), [e]), p = o && !u ? [] : f.map(Dv), m = (0, j.useRef)(!0), h = el(() => /* @__PURE__ */ new Map()), g = (0, j.useRef)(/* @__PURE__ */ new Set()), [_, v] = (0, j.useState)(f), [y, b] = (0, j.useState)(f);
	tl(() => {
		o && !u && !y.length && d?.();
	}, [
		u,
		o,
		y.length,
		d
	]), tl(() => {
		m.current = !1;
		for (let e = 0; e < y.length; e++) {
			let t = Dv(y[e]);
			p.includes(t) ? (h.delete(t), g.current.delete(t)) : h.get(t) !== !0 && h.set(t, !1);
		}
	}, [
		y,
		p.length,
		p.join("-")
	]);
	let x = [];
	if (f !== _) {
		let e = [...f], t = 0;
		for (let n of y) {
			let r = p.indexOf(Dv(n));
			r === -1 ? (e.splice(t++, 0, n), x.push(n)) : t = r + x.length + 1;
		}
		return x.every((e) => h.get(Dv(e))) ? e = f : a === "wait" && (e = x), b(Ov(e)), v(f), null;
	}
	let { forceRender: S } = (0, j.useContext)($c);
	return (0, W.jsx)(W.Fragment, { children: y.map((e) => {
		let _ = Dv(e), b = o && !u ? !1 : f === y || p.includes(_);
		return (0, W.jsx)(Sv, {
			isPresent: b,
			initial: !m.current || n ? void 0 : !1,
			custom: t,
			presenceAffectsLayout: i,
			mode: a,
			root: l,
			onExitComplete: b ? void 0 : () => {
				if (g.current.has(_)) return;
				if (h.has(_)) g.current.add(_), h.set(_, !0);
				else return;
				let e = !0;
				h.forEach((t) => {
					t || (e = !1);
				}), e && (S?.(), v([]), o && d?.(), r && r());
			},
			anchorX: s,
			anchorY: c,
			children: e
		}, _);
	}) });
}, Av = (0, j.createContext)({ strict: !1 }), jv = {
	animation: [
		"animate",
		"variants",
		"whileHover",
		"whileTap",
		"exit",
		"whileInView",
		"whileFocus",
		"whileDrag"
	],
	exit: ["exit"],
	drag: ["drag", "dragControls"],
	focus: ["whileFocus"],
	hover: [
		"whileHover",
		"onHoverStart",
		"onHoverEnd"
	],
	tap: [
		"whileTap",
		"onTap",
		"onTapStart",
		"onTapCancel"
	],
	pan: [
		"onPan",
		"onPanStart",
		"onPanSessionStart",
		"onPanEnd"
	],
	inView: [
		"whileInView",
		"onViewportEnter",
		"onViewportLeave"
	],
	layout: ["layout", "layoutId"]
}, Mv = !1;
function Nv() {
	if (Mv) return;
	let e = {};
	for (let t in jv) e[t] = { isEnabled: (e) => jv[t].some((t) => !!e[t]) };
	gg(e), Mv = !0;
}
function Pv() {
	return Nv(), _g();
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/features/load-features.mjs
function Fv(e) {
	let t = Pv();
	for (let n in e) t[n] = {
		...t[n],
		...e[n]
	};
	gg(t);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/context/MotionContext/index.mjs
var Iv = /* @__PURE__ */ (0, j.createContext)({});
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/context/MotionContext/utils.mjs
function Lv(e, t) {
	if (sg(e)) {
		let { initial: t, animate: n } = e;
		return {
			initial: t === !1 || ig(t) ? t : void 0,
			animate: ig(n) ? n : void 0
		};
	}
	return e.inherit === !1 ? {} : t;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/context/MotionContext/create.mjs
function Rv(e) {
	let { initial: t, animate: n } = Lv(e, (0, j.useContext)(Iv));
	return (0, j.useMemo)(() => ({
		initial: t,
		animate: n
	}), [zv(t), zv(n)]);
}
function zv(e) {
	return Array.isArray(e) ? e.join(" ") : e;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/html/utils/create-render-state.mjs
var Bv = () => ({
	style: {},
	transform: {},
	transformOrigin: {},
	vars: {}
});
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/html/use-props.mjs
function Vv(e, t, n) {
	for (let r in t) !zp(t[r]) && !Cg(r, n) && (e[r] = t[r]);
}
function Hv({ transformTemplate: e }, t) {
	return (0, j.useMemo)(() => {
		let n = Bv();
		return Am(n, t, e), Object.assign({}, n.vars, n.style);
	}, [t]);
}
function Uv(e, t) {
	let n = e.style || {}, r = {};
	return Vv(r, n, e), Object.assign(r, Hv(e, t)), r;
}
function Wv(e, t) {
	let n = {}, r = Uv(e, t);
	return e.drag && e.dragListener !== !1 && (n.draggable = !1, r.userSelect = r.WebkitUserSelect = r.WebkitTouchCallout = "none", r.touchAction = e.drag === !0 ? "none" : `pan-${e.drag === "x" ? "y" : "x"}`), e.tabIndex === void 0 && (e.onTap || e.onTapStart || e.whileTap) && (n.tabIndex = 0), n.style = r, n;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/svg/utils/create-render-state.mjs
var Gv = () => ({
	...Bv(),
	attrs: {}
});
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/svg/use-props.mjs
function Kv(e, t, n, r) {
	let i = (0, j.useMemo)(() => {
		let n = Gv();
		return Fm(n, t, Og(r), e.transformTemplate, e.style), {
			...n.attrs,
			style: { ...n.style }
		};
	}, [t]);
	if (e.style) {
		let t = {};
		Vv(t, e.style, e), i.style = {
			...t,
			...i.style
		};
	}
	return i;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/utils/valid-prop.mjs
var qv = /* @__PURE__ */ new Set(/* @__PURE__ */ "animate.exit.variants.initial.style.values.transition.transformTemplate.custom.inherit.onBeforeLayoutMeasure.onAnimationStart.onAnimationComplete.onUpdate.onDragStart.onDrag.onDragEnd.onMeasureDragConstraints.onDirectionLock.onDragTransitionEnd._dragX._dragY.onHoverStart.onHoverEnd.onViewportEnter.onViewportLeave.globalTapTarget.propagate.ignoreStrict.viewport".split("."));
function Jv(e) {
	return e.startsWith("while") || e.startsWith("drag") && e !== "draggable" || e.startsWith("layout") || e.startsWith("onTap") || e.startsWith("onPan") || e.startsWith("onLayout") || qv.has(e);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/dom/utils/filter-props.mjs
function Yv(e, t) {
	return e.startsWith("on") ? !Jv(e) : t?.(e) ?? !Jv(e);
}
function Xv(e, t, n, r) {
	let i = {};
	for (let a in e) a === "values" && typeof e.values == "object" || zp(e[a]) || (Yv(a, r) || n === !0 && Jv(a) || !t && !Jv(a) || e.draggable && a.startsWith("onDrag")) && (i[a] = e[a]);
	return i;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/svg/lowercase-elements.mjs
var Zv = [
	"animate",
	"circle",
	"defs",
	"desc",
	"ellipse",
	"g",
	"image",
	"line",
	"filter",
	"marker",
	"mask",
	"metadata",
	"path",
	"pattern",
	"polygon",
	"polyline",
	"rect",
	"stop",
	"switch",
	"symbol",
	"svg",
	"text",
	"tspan",
	"use",
	"view"
];
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/dom/utils/is-svg-component.mjs
function Qv(e) {
	return typeof e != "string" || e.includes("-") ? !1 : !!(Zv.indexOf(e) > -1 || /[A-Z]/u.test(e));
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/dom/use-render.mjs
function $v(e, t, n, { latestValues: r }, i, a = !1, o, s) {
	let c = (o ?? Qv(e) ? Kv : Wv)(t, r, i, e), l = Xv(t, typeof e == "string", a, s), u = e === j.Fragment ? {} : {
		...l,
		...c,
		ref: n
	}, { children: d } = t, f = (0, j.useMemo)(() => zp(d) ? d.get() : d, [d]);
	return (0, j.createElement)(e, {
		...u,
		children: f
	});
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs
function ey({ scrapeMotionValuesFromProps: e, createRenderState: t }, n, r, i) {
	return {
		latestValues: ty(n, r, i, e),
		renderState: t()
	};
}
function ty(e, t, n, r) {
	let i = {}, a = r(e, {});
	for (let e in a) i[e] = k_(a[e]);
	let { initial: o, animate: s } = e, c = sg(e), l = cg(e);
	t && l && !c && e.inherit !== !1 && (o === void 0 && (o = t.initial), s === void 0 && (s = t.animate));
	let u = n ? n.initial === !1 : !1;
	u ||= o === !1;
	let d = u ? s : o;
	if (d && typeof d != "boolean" && !rg(d)) {
		let t = Array.isArray(d) ? d : [d];
		for (let n = 0; n < t.length; n++) {
			let r = jp(e, t[n]);
			if (r) {
				let { transitionEnd: e, transition: t, ...n } = r;
				for (let e in n) {
					let t = n[e];
					if (Array.isArray(t)) {
						let e = u ? t.length - 1 : 0;
						t = t[e];
					}
					t !== null && (i[e] = t);
				}
				for (let t in e) i[t] = e[t];
			}
		}
	}
	return i;
}
var ny = (e) => (t, n) => {
	let r = (0, j.useContext)(Iv), i = (0, j.useContext)(nl), a = () => ey(e, t, r, i);
	return n ? a() : el(a);
}, ry = /*@__PURE__*/ ny({
	scrapeMotionValuesFromProps: wg,
	createRenderState: Bv
}), iy = /*@__PURE__*/ ny({
	scrapeMotionValuesFromProps: Ag,
	createRenderState: Gv
}), ay = Symbol.for("motionComponentSymbol");
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs
function oy(e, t, n) {
	let r = (0, j.useRef)(n);
	(0, j.useInsertionEffect)(() => {
		r.current = n;
	});
	let i = (0, j.useRef)(null);
	return (0, j.useCallback)((n) => {
		n && e.onMount?.(n), t && (n ? t.mount(n) : t.unmount());
		let a = r.current;
		if (typeof a == "function") {
			if (n) {
				let e = a(n);
				typeof e == "function" && (i.current = e);
			} else i.current ? (i.current(), i.current = null) : a(n);
		} else a && (a.current = n);
	}, [t]);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs
var sy = (0, j.createContext)({});
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/utils/is-ref-object.mjs
function cy(e) {
	return e && typeof e == "object" && Object.prototype.hasOwnProperty.call(e, "current");
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs
function ly(e, t, n, r, i, a) {
	let { visualElement: o } = (0, j.useContext)(Iv), s = (0, j.useContext)(Av), c = (0, j.useContext)(nl), l = (0, j.useContext)(gv), u = l.reducedMotion, d = l.skipAnimations, f = (0, j.useRef)(null), p = (0, j.useRef)(!1);
	r ||= s.renderer, !f.current && r && (f.current = r(e, {
		visualState: t,
		parent: o,
		props: n,
		presenceContext: c,
		blockInitialAnimation: c ? c.initial === !1 : !1,
		reducedMotionConfig: u,
		skipAnimations: d,
		isSVG: a
	}), p.current && f.current && (f.current.manuallyAnimateOnMount = !0));
	let m = f.current, h = (0, j.useContext)(sy);
	m && !m.projection && i && (m.type === "html" || m.type === "svg") && uy(f.current, n, i, h);
	let g = (0, j.useRef)(!1);
	(0, j.useInsertionEffect)(() => {
		m && g.current && m.update(n, c);
	});
	let _ = n[Up], v = (0, j.useRef)(!!_ && typeof window < "u" && !window.MotionHandoffIsComplete?.(_) && window.MotionHasOptimisedAnimation?.(_));
	return tl(() => {
		p.current && m && (m.animationState?.animateChanges(), m.enteringChildren = void 0);
	}, []), tl(() => {
		p.current = !0, m && (g.current = !0, window.MotionIsMounted = !0, m.updateFeatures(), m.scheduleRenderMicrotask(), v.current && m.animationState && m.animationState.animateChanges());
	}), (0, j.useEffect)(() => {
		m && (!v.current && m.animationState && m.animationState.animateChanges(), v.current &&= (queueMicrotask(() => {
			window.MotionHandoffMarkAsComplete?.(_);
		}), !1), m.enteringChildren = void 0);
	}), m;
}
function uy(e, t, n, r) {
	let { layoutId: i, layout: a, drag: o, dragConstraints: s, layoutScroll: c, layoutRoot: l, layoutAnchor: u, layoutCrossfade: d } = t;
	e.projection = new n(e.latestValues, t["data-framer-portal-id"] ? void 0 : dy(e.parent)), e.projection.setOptions({
		layoutId: i,
		layout: a,
		alwaysMeasureLayout: !!o || s && cy(s),
		visualElement: e,
		animationType: typeof a == "string" ? a : "both",
		initialPromotionConfig: r,
		crossfade: d,
		layoutScroll: c,
		layoutRoot: l,
		layoutAnchor: u
	});
}
function dy(e) {
	if (e) return e.options.allowProjection === !1 ? dy(e.parent) : e.projection;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/index.mjs
function fy(e, { forwardMotionProps: t = !1, type: n } = {}, r, i) {
	r && Fv(r);
	let a = n ? n === "svg" : Qv(e), o = a ? iy : ry;
	function s(n, s) {
		let c, l = {
			...(0, j.useContext)(gv),
			...n,
			layoutId: py(n)
		}, { isStatic: u, isValidProp: d } = l, f = Rv(n), p = o(n, u);
		if (!u && typeof window < "u") {
			my(l, r);
			let t = hy(l);
			c = t.MeasureLayout, f.visualElement = ly(e, p, l, i, t.ProjectionNode, a);
		}
		return (0, W.jsxs)(Iv.Provider, {
			value: f,
			children: [c && f.visualElement ? (0, W.jsx)(c, {
				visualElement: f.visualElement,
				...l
			}) : null, $v(e, n, oy(p, f.visualElement, s), p, u, t, a, d)]
		});
	}
	s.displayName = `motion.${typeof e == "string" ? e : `create(${e.displayName ?? e.name ?? ""})`}`;
	let c = (0, j.forwardRef)(s);
	return c[ay] = e, c;
}
function py({ layoutId: e }) {
	let t = (0, j.useContext)($c).id;
	return t && e !== void 0 ? t + "-" + e : e;
}
function my(e, t) {
	(0, j.useContext)(Av).strict;
}
function hy(e) {
	let { drag: t, layout: n } = Pv();
	if (!t && !n) return {};
	let r = {
		...t,
		...n
	};
	return {
		MeasureLayout: t?.isEnabled(e) || n?.isEnabled(e) ? r.MeasureLayout : void 0,
		ProjectionNode: r.ProjectionNode
	};
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/components/create-proxy.mjs
function gy(e, t) {
	if (typeof Proxy > "u") return fy;
	let n = /* @__PURE__ */ new Map(), r = (n, r) => fy(n, r, e, t);
	return new Proxy((e, t) => r(e, t), { get: (i, a) => a === "create" ? r : (n.has(a) || n.set(a, fy(a, void 0, e, t)), n.get(a)) });
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/render/dom/create-visual-element.mjs
var _y = (e, t) => t.isSVG ?? Qv(e) ? new jg(t) : new Eg(t, { allowProjection: e !== j.Fragment }), vy = class extends bg {
	constructor(e) {
		super(e), e.animationState ||= Pg(e);
	}
	updateAnimationControlsSubscription() {
		let { animate: e } = this.node.getProps();
		rg(e) && (this.unmountControls = e.subscribe(this.node));
	}
	mount() {
		this.updateAnimationControlsSubscription();
	}
	update() {
		let { animate: e } = this.node.getProps(), { animate: t } = this.node.prevProps || {};
		e !== t && this.updateAnimationControlsSubscription();
	}
	unmount() {
		this.node.animationState.reset(), this.unmountControls?.();
	}
}, yy = 0, by = {
	animation: { Feature: vy },
	exit: { Feature: class extends bg {
		constructor() {
			super(...arguments), this.id = yy++;
		}
		update() {
			let { presenceContext: e, prevPresenceContext: t, animationState: n } = this.node;
			if (!e || !n) return;
			let { isPresent: r, onExitComplete: i } = e, a = t?.isPresent;
			if (r === a) return;
			if (r && a === !1) {
				if (this.exit === !0) {
					let { initial: e } = this.node.getProps();
					if (e && !Array.isArray(e)) {
						let { transition: t, transitionEnd: n, ...r } = Mp(this.node, e) || {};
						for (let e in r) this.node.getValue(e)?.jump(r[e]);
					}
					this.node.blockInitialAnimation = !1, n.reset(), n.animateChanges();
				} else n.setActive("exit", !1);
				this.exit = void 0;
				return;
			}
			let o = this.exit = n.setActive("exit", !r);
			i && !r && o.then(() => {
				this.exit === o && (this.exit = !0, i(this.id));
			});
		}
		mount() {
			let { register: e, onExitComplete: t } = this.node.presenceContext || {};
			t && t(this.id), e && (this.unmount = e(this.id));
		}
		unmount() {}
	} }
};
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/events/event-info.mjs
function xy(e) {
	return { point: {
		x: e.pageX,
		y: e.pageY
	} };
}
var Sy = (e) => (t) => Sh(t) && e(t, xy(t));
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/events/add-pointer-event.mjs
function Cy(e, t, n, r) {
	return T_(e, t, Sy(n), r);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/utils/get-context-window.mjs
var wy = ({ current: e }) => e ? e.ownerDocument.defaultView : null, Ty = (e, t) => Math.abs(e - t);
function Ey(e, t) {
	let n = Ty(e.x, t.x), r = Ty(e.y, t.y);
	return Math.sqrt(n ** 2 + r ** 2);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/gestures/pan/PanSession.mjs
var Dy = /*#__PURE__*/ new Set(["auto", "scroll"]), Oy = class {
	constructor(e, t, { transformPagePoint: n, contextWindow: r = window, dragSnapToOrigin: i = !1, distanceThreshold: a = 3, element: o } = {}) {
		if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.removeScrollListeners = null, this.onElementScroll = (e) => {
			this.handleScroll(e.target);
		}, this.onWindowScroll = () => {
			this.handleScroll(window);
		}, this.updatePoint = () => {
			if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
			this.hasPendingMove = !1, this.lastRawMoveEventInfo && (this.lastMoveEventInfo = ky(this.lastRawMoveEventInfo, this.transformPagePoint));
			let e = jy(this.lastMoveEventInfo, this.history), t = this.startEvent !== null, n = Ey(e.offset, {
				x: 0,
				y: 0
			}) >= this.distanceThreshold;
			if (!t && !n) return;
			let { point: r } = e;
			this.history.push({
				...r,
				timestamp: Gl.now()
			});
			let { onStart: i, onMove: a } = this.handlers;
			t || (i && i(this.lastMoveEvent, e), this.startEvent = this.lastMoveEvent), a && a(this.lastMoveEvent, e);
		}, this.handlePointerMove = (e, t) => {
			this.lastMoveEvent = e, this.lastRawMoveEventInfo = t, this.lastMoveEventInfo = ky(t, this.transformPagePoint), this.hasPendingMove = !0, Q.update(this.updatePoint, !0);
		}, this.handlePointerUp = (e, t) => {
			this.hasPendingMove && this.updatePoint(), this.end();
			let { onEnd: n, onSessionEnd: r, resumeAnimation: i } = this.handlers;
			if ((this.dragSnapToOrigin || !this.startEvent) && i && i(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
			let a = jy(e.type === "pointercancel" ? this.lastMoveEventInfo : ky(t, this.transformPagePoint), this.history);
			this.startEvent && n && n(e, a), r && r(e, a);
		}, !Sh(e)) return;
		this.dragSnapToOrigin = i, this.handlers = t, this.transformPagePoint = n, this.distanceThreshold = a, this.contextWindow = r || window;
		let s = ky(xy(e), this.transformPagePoint), { point: c } = s, { timestamp: l } = Hl;
		this.history = [{
			...c,
			timestamp: l
		}];
		let { onSessionStart: u } = t;
		u && u(e, jy(s, this.history));
		let d = {
			passive: !0,
			capture: !0
		};
		this.removeListeners = fl(Cy(this.contextWindow, "pointermove", this.handlePointerMove, d), Cy(this.contextWindow, "pointerup", this.handlePointerUp, d), Cy(this.contextWindow, "pointercancel", this.handlePointerUp, d)), o && this.startScrollTracking(o);
	}
	startScrollTracking(e) {
		let t = e.parentElement;
		for (; t;) {
			let e = getComputedStyle(t);
			(Dy.has(e.overflowX) || Dy.has(e.overflowY)) && this.scrollPositions.set(t, {
				x: t.scrollLeft,
				y: t.scrollTop
			}), t = t.parentElement;
		}
		this.scrollPositions.set(window, {
			x: window.scrollX,
			y: window.scrollY
		}), window.addEventListener("scroll", this.onElementScroll, { capture: !0 }), window.addEventListener("scroll", this.onWindowScroll), this.removeScrollListeners = () => {
			window.removeEventListener("scroll", this.onElementScroll, { capture: !0 }), window.removeEventListener("scroll", this.onWindowScroll);
		};
	}
	handleScroll(e) {
		let t = this.scrollPositions.get(e);
		if (!t) return;
		let n = e === window, r = n ? {
			x: window.scrollX,
			y: window.scrollY
		} : {
			x: e.scrollLeft,
			y: e.scrollTop
		}, i = {
			x: r.x - t.x,
			y: r.y - t.y
		};
		(i.x !== 0 || i.y !== 0) && (n ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += i.x, this.lastMoveEventInfo.point.y += i.y) : this.history.length > 0 && (this.history[0].x -= i.x, this.history[0].y -= i.y), this.scrollPositions.set(e, r), Q.update(this.updatePoint, !0));
	}
	updateHandlers(e) {
		this.handlers = e;
	}
	end() {
		this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), rd(this.updatePoint);
	}
};
function ky(e, t) {
	return t ? { point: t(e.point) } : e;
}
function Ay(e, t) {
	return {
		x: e.x - t.x,
		y: e.y - t.y
	};
}
function jy({ point: e }, t) {
	return {
		point: e,
		delta: Ay(e, Ny(t)),
		offset: Ay(e, My(t)),
		velocity: Py(t, .1)
	};
}
function My(e) {
	return e[0];
}
function Ny(e) {
	return e[e.length - 1];
}
function Py(e, t) {
	if (e.length < 2) return {
		x: 0,
		y: 0
	};
	let n = e.length - 1, r = null, i = Ny(e);
	for (; n >= 0 && (r = e[n], !(i.timestamp - r.timestamp > /* @__PURE__ */ hl(t)));) n--;
	if (!r) return {
		x: 0,
		y: 0
	};
	r === e[0] && e.length > 2 && i.timestamp - r.timestamp > /* @__PURE__ */ hl(t) * 2 && (r = e[1]);
	let a = /* @__PURE__ */ gl(i.timestamp - r.timestamp);
	if (a === 0) return {
		x: 0,
		y: 0
	};
	let o = {
		x: (i.x - r.x) / a,
		y: (i.y - r.y) / a
	};
	return o.x === Infinity && (o.x = 0), o.y === Infinity && (o.y = 0), o;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/gestures/drag/utils/constraints.mjs
function Fy(e, { min: t, max: n }, r) {
	return t !== void 0 && e < t ? e = r ? q(t, e, r.min) : Math.max(e, t) : n !== void 0 && e > n && (e = r ? q(n, e, r.max) : Math.min(e, n)), e;
}
function Iy(e, t, n) {
	return {
		min: t === void 0 ? void 0 : e.min + t,
		max: n === void 0 ? void 0 : e.max + n - (e.max - e.min)
	};
}
function Ly(e, { top: t, left: n, bottom: r, right: i }) {
	return {
		x: Iy(e.x, n, i),
		y: Iy(e.y, t, r)
	};
}
function Ry(e, t) {
	let n = t.min - e.min, r = t.max - e.max;
	return t.max - t.min < e.max - e.min && ([n, r] = [r, n]), {
		min: n,
		max: r
	};
}
function zy(e, t) {
	return {
		x: Ry(e.x, t.x),
		y: Ry(e.y, t.y)
	};
}
function By(e, t) {
	let n = .5, r = Wg(e), i = Wg(t);
	return i > r ? n = /* @__PURE__ */ pl(t.min, t.max - r, e.min) : r > i && (n = /* @__PURE__ */ pl(e.min, e.max - i, t.min)), al(0, 1, n);
}
function Vy(e, t) {
	let n = {};
	return t.min !== void 0 && (n.min = t.min - e.min), t.max !== void 0 && (n.max = t.max - e.min), n;
}
var Hy = .35;
function Uy(e = Hy) {
	return e === !1 ? e = 0 : e === !0 && (e = Hy), {
		x: Wy(e, "left", "right"),
		y: Wy(e, "top", "bottom")
	};
}
function Wy(e, t, n) {
	return {
		min: Gy(e, t),
		max: Gy(e, n)
	};
}
function Gy(e, t) {
	return typeof e == "number" ? e : e[t] || 0;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/gestures/drag/VisualElementDragControls.mjs
var Ky = /* @__PURE__ */ new WeakMap(), qy = class {
	constructor(e) {
		this.openDragLock = null, this.isDragging = !1, this.currentDirection = null, this.originPoint = {
			x: 0,
			y: 0
		}, this.constraints = !1, this.hasMutatedConstraints = !1, this.elastic = tg(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = e;
	}
	start(e, { snapToCursor: t = !1, distanceThreshold: n } = {}) {
		let { presenceContext: r } = this.visualElement;
		if (r && r.isPresent === !1) return;
		let i = (e) => {
			t && this.snapToCursor(e), this.stopAnimation();
		}, a = (e, t) => {
			let { drag: n, dragPropagation: r, onDragStart: i } = this.getProps();
			if (n && !r && (this.openDragLock && this.openDragLock(), this.openDragLock = _h(n), !this.openDragLock)) return;
			this.latestPointerEvent = e, this.latestPanInfo = t, this.isDragging = !0, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = !0, this.visualElement.projection.target = void 0), f_((e) => {
				let t = this.getAxisMotionValue(e).get() || 0;
				if (pu.test(t)) {
					let { projection: n } = this.visualElement;
					if (n && n.layout) {
						let r = n.layout.layoutBox[e];
						r && (t = Wg(r) * (parseFloat(t) / 100));
					}
				}
				this.originPoint[e] = t;
			}), i && Q.update(() => i(e, t), !1, !0), Vp(this.visualElement, "transform");
			let { animationState: a } = this.visualElement;
			a && a.setActive("whileDrag", !0);
		}, o = (e, t) => {
			this.latestPointerEvent = e, this.latestPanInfo = t;
			let { dragPropagation: n, dragDirectionLock: r, onDirectionLock: i, onDrag: a } = this.getProps();
			if (!n && !this.openDragLock) return;
			let { offset: o } = t;
			r && this.currentDirection === null ? (this.currentDirection = Zy(o), this.currentDirection !== null && i && i(this.currentDirection)) : (this.updateAxis("x", t.point, o), this.updateAxis("y", t.point, o), this.visualElement.render(), a && Q.update(() => a(e, t), !1, !0));
		}, s = (e, t) => {
			this.latestPointerEvent = e, this.latestPanInfo = t, this.stop(e, t), this.latestPointerEvent = null, this.latestPanInfo = null;
		}, c = () => {
			let { dragSnapToOrigin: e } = this.getProps();
			(e || this.constraints) && this.startAnimation({
				x: 0,
				y: 0
			});
		}, { dragSnapToOrigin: l } = this.getProps();
		this.panSession = new Oy(e, {
			onSessionStart: i,
			onStart: a,
			onMove: o,
			onSessionEnd: s,
			resumeAnimation: c
		}, {
			transformPagePoint: this.visualElement.getTransformPagePoint(),
			dragSnapToOrigin: l,
			distanceThreshold: n,
			contextWindow: wy(this.visualElement),
			element: this.visualElement.current
		});
	}
	stop(e, t) {
		let n = e || this.latestPointerEvent, r = t || this.latestPanInfo, i = this.isDragging;
		if (this.cancel(), !i || !r || !n) return;
		let { velocity: a } = r;
		this.startAnimation(a);
		let { onDragEnd: o } = this.getProps();
		o && Q.postRender(() => o(n, r));
	}
	cancel() {
		this.isDragging = !1;
		let { projection: e, animationState: t } = this.visualElement;
		e && (e.isAnimationBlocked = !1), this.endPanSession();
		let { dragPropagation: n } = this.getProps();
		!n && this.openDragLock && (this.openDragLock(), this.openDragLock = null), t && t.setActive("whileDrag", !1);
	}
	endPanSession() {
		this.panSession && this.panSession.end(), this.panSession = void 0;
	}
	updateAxis(e, t, n) {
		let { drag: r } = this.getProps();
		if (!n || !Xy(e, r, this.currentDirection)) return;
		let i = this.getAxisMotionValue(e), a = this.originPoint[e] + n[e];
		this.constraints && this.constraints[e] && (a = Fy(a, this.constraints[e], this.elastic[e])), i.set(a);
	}
	resolveConstraints() {
		let { dragConstraints: e, dragElastic: t } = this.getProps(), n = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(!1) : this.visualElement.projection?.layout, r = this.constraints;
		e && cy(e) ? this.constraints ||= this.resolveRefConstraints() : this.constraints = e && n ? Ly(n.layoutBox, e) : !1, this.elastic = Uy(t), r !== this.constraints && !cy(e) && n && this.constraints && !this.hasMutatedConstraints && f_((e) => {
			this.constraints !== !1 && this.getAxisMotionValue(e) && (this.constraints[e] = Vy(n.layoutBox[e], this.constraints[e]));
		});
	}
	resolveRefConstraints() {
		let { dragConstraints: e, onMeasureDragConstraints: t } = this.getProps();
		if (!e || !cy(e)) return !1;
		let n = e.current, { projection: r } = this.visualElement;
		if (!r || !r.layout) return !1;
		r.root && (r.root.scroll = void 0, r.root.updateScroll());
		let i = sh(n, r.root, this.visualElement.getTransformPagePoint()), a = zy(r.layout.layoutBox, i);
		if (t) {
			let e = t(Hm(a));
			this.hasMutatedConstraints = !!e, e && (a = Vm(e));
		}
		return a;
	}
	startAnimation(e) {
		let { drag: t, dragMomentum: n, dragElastic: r, dragTransition: i, dragSnapToOrigin: a, onDragTransitionEnd: o } = this.getProps(), s = this.constraints || {}, c = f_((o) => {
			if (!Xy(o, t, this.currentDirection)) return;
			let c = s && s[o] || {};
			(a === !0 || a === o) && (c = {
				min: 0,
				max: 0
			});
			let l = r ? 200 : 1e6, u = r ? 40 : 1e7, d = {
				type: "inertia",
				velocity: n ? e[o] : 0,
				bounceStiffness: l,
				bounceDamping: u,
				timeConstant: 750,
				restDelta: 1,
				restSpeed: 10,
				...i,
				...c
			};
			return this.startAxisValueAnimation(o, d);
		});
		return Promise.all(c).then(o);
	}
	startAxisValueAnimation(e, t) {
		let n = this.getAxisMotionValue(e);
		return Vp(this.visualElement, e), n.start(Ep(e, n, 0, t, this.visualElement, !1));
	}
	stopAnimation() {
		f_((e) => this.getAxisMotionValue(e).stop());
	}
	getAxisMotionValue(e) {
		let t = `_drag${e.toUpperCase()}`;
		return this.visualElement.getProps()[t] || this.visualElement.getValue(e, this.visualElement.latestValues[e] ?? 0);
	}
	snapToCursor({ clientX: e, clientY: t }) {
		let { drag: n } = this.getProps(), r = {
			x: e,
			y: t
		}, i = this.visualElement.getTransformPagePoint()?.(r) || r, a = this.visualElement.measureViewportBox();
		f_((e) => {
			if (!Xy(e, n, this.currentDirection)) return;
			let t = this.getAxisMotionValue(e), { min: r, max: o } = a[e];
			t.set((t.get() || 0) + i[e] - q(r, o, .5));
		});
	}
	scalePositionWithinConstraints() {
		if (!this.visualElement.current) return;
		let { drag: e, dragConstraints: t } = this.getProps(), { projection: n } = this.visualElement;
		if (!cy(t) || !n || !this.constraints) return;
		this.stopAnimation();
		let r = this.constraints, i = {
			x: 0,
			y: 0
		};
		f_((e) => {
			let t = this.getAxisMotionValue(e).get();
			i[e] = By({
				min: t,
				max: t
			}, r[e]);
		});
		let { transformTemplate: a } = this.visualElement.getProps();
		this.visualElement.current.style.transform = a ? a({}, "") : "none", n.root && n.root.updateScroll(), n.updateLayout(), this.constraints = !1, this.resolveConstraints(), f_((t) => {
			let n = this.getAxisMotionValue(t);
			if (!Xy(t, e, null) || !n.get()) return;
			let { min: r, max: a } = this.constraints[t];
			n.set(q(r, a, i[t]));
		}), this.visualElement.render();
	}
	addListeners() {
		if (!this.visualElement.current) return;
		Ky.set(this.visualElement, this);
		let e = this.visualElement.current, t = Cy(e, "pointerdown", (t) => {
			let { drag: n, dragListener: r = !0 } = this.getProps(), i = t.target, a = i !== e && Eh(i);
			n && r && !a && this.start(t);
		}), n, r = () => {
			let { dragConstraints: t } = this.getProps();
			cy(t) && t.current && (this.constraints = this.resolveRefConstraints(), n ||= Yy(e, t.current, () => this.scalePositionWithinConstraints()));
		}, { projection: i } = this.visualElement, a = i.addEventListener("measure", r);
		i && !i.layout && (i.root && i.root.updateScroll(), i.updateLayout()), Q.read(r);
		let o = T_(window, "resize", () => this.scalePositionWithinConstraints()), s = i.addEventListener("didUpdate", (({ delta: e, hasLayoutChanged: t }) => {
			this.isDragging && t && (f_((t) => {
				let n = this.getAxisMotionValue(t);
				n && (this.originPoint[t] += e[t].translate, n.set(n.get() + e[t].translate));
			}), this.visualElement.render());
		}));
		return () => {
			o(), t(), a(), s && s(), n && n();
		};
	}
	getProps() {
		let e = this.visualElement.getProps(), { drag: t = !1, dragDirectionLock: n = !1, dragPropagation: r = !1, dragConstraints: i = !1, dragElastic: a = Hy, dragMomentum: o = !0 } = e;
		return {
			...e,
			drag: t,
			dragDirectionLock: n,
			dragPropagation: r,
			dragConstraints: i,
			dragElastic: a,
			dragMomentum: o
		};
	}
};
function Jy(e) {
	let t = !0;
	return () => {
		t ? t = !1 : e();
	};
}
function Yy(e, t, n) {
	let r = qh(e, Jy(n)), i = qh(t, Jy(n));
	return () => {
		r(), i();
	};
}
function Xy(e, t, n) {
	return (t === !0 || t === e) && (n === null || n === e);
}
function Zy(e, t = 10) {
	let n = null;
	return Math.abs(e.y) > t ? n = "y" : Math.abs(e.x) > t && (n = "x"), n;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/gestures/drag/index.mjs
var Qy = class extends bg {
	constructor(e) {
		super(e), this.removeGroupControls = dl, this.removeListeners = dl, this.controls = new qy(e);
	}
	mount() {
		let { dragControls: e } = this.node.getProps();
		e && (this.removeGroupControls = e.subscribe(this.controls)), this.removeListeners = this.controls.addListeners() || dl;
	}
	update() {
		let { dragControls: e } = this.node.getProps(), { dragControls: t } = this.node.prevProps || {};
		e !== t && (this.removeGroupControls(), e && (this.removeGroupControls = e.subscribe(this.controls)));
	}
	unmount() {
		this.removeGroupControls(), this.removeListeners(), this.controls.isDragging || this.controls.endPanSession();
	}
}, $y = (e) => (t, n) => {
	e && Q.update(() => e(t, n), !1, !0);
}, eb = class extends bg {
	constructor() {
		super(...arguments), this.removePointerDownListener = dl;
	}
	onPointerDown(e) {
		this.session = new Oy(e, this.createPanHandlers(), {
			transformPagePoint: this.node.getTransformPagePoint(),
			contextWindow: wy(this.node)
		});
	}
	createPanHandlers() {
		let { onPanSessionStart: e, onPanStart: t, onPan: n, onPanEnd: r } = this.node.getProps();
		return {
			onSessionStart: $y(e),
			onStart: $y(t),
			onMove: $y(n),
			onEnd: (e, t) => {
				delete this.session, r && Q.postRender(() => r(e, t));
			}
		};
	}
	mount() {
		this.removePointerDownListener = Cy(this.node.current, "pointerdown", (e) => this.onPointerDown(e));
	}
	update() {
		this.session && this.session.updateHandlers(this.createPanHandlers());
	}
	unmount() {
		this.removePointerDownListener(), this.session && this.session.end();
	}
}, tb = !1, nb = class extends j.Component {
	componentDidMount() {
		let { visualElement: e, layoutGroup: t, switchLayoutGroup: n, layoutId: r } = this.props, { projection: i } = e;
		i && (t.group && t.group.add(i), n && n.register && r && n.register(i), tb && i.root.didUpdate(), i.addEventListener("animationComplete", () => {
			this.safeToRemove();
		}), i.setOptions({
			...i.options,
			layoutDependency: this.props.layoutDependency,
			onExitComplete: () => this.safeToRemove()
		})), M_.hasEverUpdated = !0;
	}
	getSnapshotBeforeUpdate(e) {
		let { layoutDependency: t, visualElement: n, drag: r, isPresent: i } = this.props, { projection: a } = n;
		return a && (a.isPresent = i, e.layoutDependency !== t && a.setOptions({
			...a.options,
			layoutDependency: t
		}), tb = !0, r || e.layoutDependency !== t || t === void 0 || e.isPresent !== i ? a.willUpdate() : this.safeToRemove(), e.isPresent !== i && (i ? a.promote() : a.relegate() || Q.postRender(() => {
			let e = a.getStack();
			e && e.members.length || this.safeToRemove();
		}))), null;
	}
	componentDidUpdate() {
		let { visualElement: e, layoutAnchor: t } = this.props, { projection: n } = e;
		n && (n.options.layoutAnchor = t, n.root.didUpdate(), ph.postRender(() => {
			!n.currentAnimation && n.isLead() && this.safeToRemove();
		}));
	}
	componentWillUnmount() {
		let { visualElement: e, layoutGroup: t, switchLayoutGroup: n } = this.props, { projection: r } = e;
		tb = !0, r && (r.scheduleCheckAfterUnmount(), t && t.group && t.group.remove(r), n && n.deregister && n.deregister(r));
	}
	safeToRemove() {
		let { safeToRemove: e } = this.props;
		e && e();
	}
	render() {
		return null;
	}
};
function rb(e) {
	let [t, n] = wv(), r = (0, j.useContext)($c);
	return (0, W.jsx)(nb, {
		...e,
		layoutGroup: r,
		switchLayoutGroup: (0, j.useContext)(sy),
		isPresent: t,
		safeToRemove: n
	});
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/features/drag.mjs
var ib = {
	pan: { Feature: eb },
	drag: {
		Feature: Qy,
		ProjectionNode: hv,
		MeasureLayout: rb
	}
};
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/gestures/hover.mjs
function ab(e, t, n) {
	let { props: r } = e;
	e.animationState && r.whileHover && e.animationState.setActive("whileHover", n === "Start");
	let i = r["onHover" + n];
	i && Q.postRender(() => i(t, xy(t)));
}
var ob = class extends bg {
	mount() {
		let { current: e } = this.node;
		e && (this.unmount = bh(e, (e, t) => (ab(this.node, t, "Start"), (e) => ab(this.node, e, "End"))));
	}
	unmount() {}
}, sb = class extends bg {
	constructor() {
		super(...arguments), this.isActive = !1;
	}
	onFocus() {
		let e = !1;
		try {
			e = this.node.current.matches(":focus-visible");
		} catch {
			e = !0;
		}
		e && this.node.animationState && (this.node.animationState.setActive("whileFocus", !0), this.isActive = !0);
	}
	onBlur() {
		this.isActive && this.node.animationState && (this.node.animationState.setActive("whileFocus", !1), this.isActive = !1);
	}
	mount() {
		this.unmount = fl(T_(this.node.current, "focus", () => this.onFocus()), T_(this.node.current, "blur", () => this.onBlur()));
	}
	unmount() {}
};
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/gestures/press.mjs
function cb(e, t, n) {
	let { props: r } = e;
	if (e.current instanceof HTMLButtonElement && e.current.disabled) return;
	e.animationState && r.whileTap && e.animationState.setActive("whileTap", n === "Start");
	let i = r["onTap" + (n === "End" ? "" : n)];
	i && Q.postRender(() => i(t, xy(t)));
}
var lb = class extends bg {
	mount() {
		let { current: e } = this.node;
		if (!e) return;
		let { globalTapTarget: t, propagate: n } = this.node.props;
		this.unmount = Nh(e, (e, t) => (cb(this.node, t, "Start"), (e, { success: t }) => cb(this.node, e, t ? "End" : "Cancel")), {
			useGlobalTarget: t,
			stopPropagation: n?.tap === !1
		});
	}
	unmount() {}
}, ub = /* @__PURE__ */ new WeakMap(), db = /* @__PURE__ */ new WeakMap(), fb = (e) => {
	let t = ub.get(e.target);
	t && t(e);
}, pb = (e) => {
	e.forEach(fb);
};
function mb({ root: e, ...t }) {
	let n = e || document;
	db.has(n) || db.set(n, {});
	let r = db.get(n), i = JSON.stringify(t);
	return r[i] || (r[i] = new IntersectionObserver(pb, {
		root: e,
		...t
	})), r[i];
}
function hb(e, t, n) {
	let r = mb(t);
	return ub.set(e, n), r.observe(e), () => {
		ub.delete(e), r.unobserve(e);
	};
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/features/viewport/index.mjs
var gb = {
	some: 0,
	all: 1
}, _b = class extends bg {
	constructor() {
		super(...arguments), this.hasEnteredView = !1, this.isInView = !1;
	}
	startObserver() {
		this.stopObserver?.();
		let { viewport: e = {} } = this.node.getProps(), { root: t, margin: n, amount: r = "some", once: i } = e, a = {
			root: t ? t.current : void 0,
			rootMargin: n,
			threshold: typeof r == "number" ? r : gb[r]
		}, o = (e) => {
			let { isIntersecting: t } = e;
			if (this.isInView === t || (this.isInView = t, i && !t && this.hasEnteredView)) return;
			t && (this.hasEnteredView = !0), this.node.animationState && this.node.animationState.setActive("whileInView", t);
			let { onViewportEnter: n, onViewportLeave: r } = this.node.getProps(), a = t ? n : r;
			a && a(e);
		};
		this.stopObserver = hb(this.node.current, a, o);
	}
	mount() {
		this.startObserver();
	}
	update() {
		if (typeof IntersectionObserver > "u") return;
		let { props: e, prevProps: t } = this.node;
		[
			"amount",
			"margin",
			"root"
		].some(vb(e, t)) && this.startObserver();
	}
	unmount() {
		this.stopObserver?.(), this.hasEnteredView = !1, this.isInView = !1;
	}
};
function vb({ viewport: e = {} }, { viewport: t = {} } = {}) {
	return (n) => e[n] !== t[n];
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/motion/features/gestures.mjs
var yb = {
	inView: { Feature: _b },
	tap: { Feature: lb },
	focus: { Feature: sb },
	hover: { Feature: ob }
}, bb = { layout: {
	ProjectionNode: hv,
	MeasureLayout: rb
} }, xb = /*@__PURE__*/ gy({
	...by,
	...yb,
	...ib,
	...bb
}, _y);
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/value/use-motion-value.mjs
function Sb(e) {
	let t = el(() => gp(e)), { isStatic: n } = (0, j.useContext)(gv);
	if (n) {
		let [, n] = (0, j.useState)(e);
		(0, j.useEffect)(() => t.on("change", n), []);
	}
	return t;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/value/use-combine-values.mjs
function Cb(e, t) {
	let n = Sb(t()), r = () => n.set(t());
	return r(), tl(() => {
		let t = () => Q.preRender(r, !1, !0), n = e.map((e) => e.on("change", t));
		return () => {
			n.forEach((e) => e()), rd(r);
		};
	}), n;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/value/use-computed.mjs
function wb(e) {
	mp.current = [], e();
	let t = Cb(mp.current, e);
	return mp.current = void 0, t;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/value/use-transform.mjs
function Tb(e, t, n, r) {
	if (typeof e == "function") return wb(e);
	if (n !== void 0 && !Array.isArray(n) && typeof t != "function") return Db(e, t, n, r);
	let i = typeof t == "function" ? t : Xh(t, n, r), a = Array.isArray(e) ? Eb(e, i) : Eb([e], ([e]) => i(e)), o = Array.isArray(e) ? void 0 : e.accelerate;
	if (o && !o.isTransformed && typeof t != "function" && Array.isArray(n) && r?.clamp !== !1) {
		let e = r?.ease;
		a.accelerate = {
			...o,
			times: [
				0,
				...t,
				1
			],
			keyframes: [
				n[0],
				...n,
				n[n.length - 1]
			],
			isTransformed: !0,
			...e ? { ease: Array.isArray(e) ? [e[0], ...e] : e } : {}
		};
	}
	return a;
}
function Eb(e, t) {
	let n = el(() => []);
	return Cb(e, () => {
		n.length = 0;
		let r = e.length;
		for (let t = 0; t < r; t++) n[t] = e[t].get();
		return t(n);
	});
}
function Db(e, t, n, r) {
	let i = el(() => Object.keys(n)), a = el(() => ({}));
	for (let o of i) a[o] = Tb(e, t, n[o], r);
	return a;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/utils/use-animation-frame.mjs
function Ob(e) {
	let t = (0, j.useRef)(0), { isStatic: n } = (0, j.useContext)(gv);
	(0, j.useEffect)(() => {
		if (n) return;
		let r = ({ timestamp: n, delta: r }) => {
			t.current ||= n, e(n - t.current, r);
		};
		return Q.update(r, !0), () => rd(r);
	}, [e]);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/utils/is-dom-keyframes.mjs
function kb(e) {
	return typeof e == "object" && !Array.isArray(e);
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/animate/resolve-subjects.mjs
function Ab(e, t, n, r) {
	return e == null ? [] : typeof e == "string" && kb(t) ? hm(e, n, r) : e instanceof NodeList ? Array.from(e) : Array.isArray(e) ? e.filter((e) => e != null) : [e];
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/sequence/utils/calc-repeat-duration.mjs
function jb(e, t, n) {
	return e * (t + 1) + n * t;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/sequence/utils/calc-time.mjs
function Mb(e, t, n, r) {
	return typeof t == "number" ? t : t.startsWith("-") || t.startsWith("+") ? Math.max(0, e + parseFloat(t)) : t === "<" ? n : t.startsWith("<") ? Math.max(0, n + parseFloat(t.slice(1))) : r.get(t) ?? e;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/sequence/utils/edit.mjs
function Nb(e, t, n) {
	for (let r = 0; r < e.length; r++) {
		let i = e[r];
		i.at > t && i.at < n && (il(e, i), r--);
	}
}
function Pb(e, t, n, r, i, a) {
	Nb(e, i, a);
	for (let o = 0; o < t.length; o++) e.push({
		value: t[o],
		at: q(i, a, r[o]),
		easing: /* @__PURE__ */ Ll(n, o)
	});
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/sequence/utils/normalize-times.mjs
function Fb(e, t, n = 0) {
	let r = t + 1 + t * n;
	for (let t = 0; t < e.length; t++) e[t] = e[t] / r;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/sequence/utils/sort.mjs
function Ib(e, t) {
	return e.at === t.at ? e.value === null ? 1 : t.value === null ? -1 : 0 : e.at - t.at;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/sequence/create.mjs
var Lb = "easeInOut", Rb = 20;
function zb(e, { defaultTransition: t = {}, ...n } = {}, r, i) {
	let a = t.duration || .3, o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), c = {}, l = /* @__PURE__ */ new Map(), u = 0, d = 0, f = 0;
	for (let n = 0; n < e.length; n++) {
		let o = e[n];
		if (typeof o == "string") {
			l.set(o, d);
			continue;
		}
		if (!Array.isArray(o)) {
			l.set(o.name, Mb(d, o.at, u, l));
			continue;
		}
		let [p, m, h = {}] = o;
		h.at !== void 0 && (d = Mb(d, h.at, u, l));
		let g = 0, _ = (e, n, r, o = 0, s = 0) => {
			let c = Hb(e), { delay: l = 0, times: u = Ed(c), type: p = t.type || "keyframes", repeat: m, repeatType: h, repeatDelay: _ = 0, ...v } = n, { ease: y = t.ease || "easeOut", duration: b } = n, x = typeof l == "function" ? l(o, s) : l, S = c.length, C = Hf(p) ? p : i?.[p || "keyframes"];
			if (S <= 2 && C) {
				let e = 100;
				if (S === 2 && Gb(c)) {
					let t = c[1] - c[0];
					e = Math.abs(t);
				}
				let n = {
					...t,
					...v
				};
				b !== void 0 && (n.duration = /* @__PURE__ */ hl(b));
				let r = ld(n, e, C);
				y = r.ease, b = r.duration;
			}
			b ??= a;
			let w = d + x;
			u.length === 1 && u[0] === 0 && (u[1] = 1);
			let T = u.length - c.length;
			if (T > 0 && Td(u, T), c.length === 1 && c.unshift(null), m && `${m}${Rb}`, m && m < Rb) {
				let e = b > 0 ? _ / b : 0;
				b = jb(b, m, _);
				let t = [...c], n = [...u];
				y = Array.isArray(y) ? [...y] : [y];
				let r = [...y], i = h === "reverse" || h === "mirror", a = t, o = r;
				i && (a = [...t].reverse(), h === "reverse" && (o = [...r].reverse().map((e) => typeof e == "function" ? /* @__PURE__ */ Tl(e) : e)));
				for (let s = 0; s < m; s++) {
					let l = i && s % 2 == 0, d = l ? a : t, f = l ? o : r, p = (s + 1) * (1 + e);
					e > 0 && (c.push(c[c.length - 1]), u.push(p), y.push("linear")), c.push(...d);
					for (let e = 0; e < d.length; e++) u.push(n[e] + p), y.push(e === 0 ? "linear" : /* @__PURE__ */ Ll(f, e - 1));
				}
				Fb(u, m, e);
			}
			let E = w + b;
			Pb(r, c, y, u, w, E), g = Math.max(x + b, g), f = Math.max(E, f);
		};
		if (zp(p)) {
			let e = Bb(p, s);
			_(m, h, Vb("default", e));
		} else {
			let e = Ab(p, m, r, c), t = e.length;
			for (let n = 0; n < t; n++) {
				m = m, h = h;
				let r = e[n], i = Bb(r, s);
				for (let e in m) _(m[e], Ub(h, e), Vb(e, i), n, t);
			}
		}
		u = d, d += g;
	}
	return s.forEach((e, r) => {
		for (let i in e) {
			let a = e[i];
			a.sort(Ib);
			let s = [], c = [], l = [];
			for (let e = 0; e < a.length; e++) {
				let { at: t, value: n, easing: r } = a[e];
				s.push(n), c.push(/* @__PURE__ */ pl(0, f, t)), l.push(r || "easeOut");
			}
			c[0] !== 0 && (c.unshift(0), s.unshift(s[0]), l.unshift(Lb)), c[c.length - 1] !== 1 && (c.push(1), s.push(null)), o.has(r) || o.set(r, {
				keyframes: {},
				transition: {}
			});
			let u = o.get(r);
			u.keyframes[i] = s;
			let { type: d, ...p } = t;
			u.transition[i] = {
				...p,
				duration: f,
				ease: l,
				times: c,
				...n
			};
		}
	}), o;
}
function Bb(e, t) {
	return !t.has(e) && t.set(e, {}), t.get(e);
}
function Vb(e, t) {
	return t[e] || (t[e] = []), t[e];
}
function Hb(e) {
	return Array.isArray(e) ? e : [e];
}
function Ub(e, t) {
	return e && e[t] ? {
		...e,
		...e[t]
	} : { ...e };
}
var Wb = (e) => typeof e == "number", Gb = (e) => e.every(Wb);
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/animate/subject.mjs
function Kb(e, t) {
	return zp(e) || typeof e == "number" || typeof e == "string" && !kb(t);
}
function qb(e, t, n, r) {
	let i = [];
	if (Kb(e, t)) i.push(w_(e, kb(t) && t.default || t, n && (n.default || n)));
	else {
		if (e == null) return i;
		let a = Ab(e, t, r), o = a.length;
		for (let e = 0; e < o; e++) {
			let r = a[e], s = { ...n };
			"delay" in s && typeof s.delay == "function" && (s.delay = s.delay(e, o)), r instanceof Element ? i.push(...dh(r, t, s, ng.get(r))) : i.push(...um(cm(r) ?? fh, r, t, s));
		}
	}
	return i;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/animate/sequence.mjs
function Jb(e, t, n) {
	let r = [];
	return zb(e.map((e) => {
		if (Array.isArray(e) && typeof e[0] == "function") {
			let t = e[0], n = gp(0);
			return n.on("change", t), e.length === 1 ? [n, [0, 1]] : e.length === 2 ? [
				n,
				[0, 1],
				e[1]
			] : [
				n,
				e[1],
				e[2]
			];
		}
		return e;
	}), t, n, { spring: xd }).forEach(({ keyframes: e, transition: t }, n) => {
		r.push(...qb(n, e, t));
	}), r;
}
// node_modules/.pnpm/framer-motion@13.5.1_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/framer-motion/dist/es/animation/animate/index.mjs
function Yb(e) {
	return Array.isArray(e) && e.some(Array.isArray);
}
function Xb(e = {}) {
	let { scope: t, reduceMotion: n, skipAnimations: r } = e;
	function i(e, i, a) {
		let o = [], s, c = {};
		if (n !== void 0 && (c.reduceMotion = n), r !== void 0 && (c.skipAnimations = r), Yb(e)) {
			let { onComplete: n, ...r } = i || {};
			typeof n == "function" && (s = n), o = Jb(e, {
				...c,
				...r
			}, t);
		} else {
			let { onComplete: n, ...r } = a || {};
			typeof n == "function" && (s = n), o = qb(e, i, {
				...c,
				...r
			}, t);
		}
		let l = new up(o);
		return s && l.finished.then(s), t && (t.animations.push(l), l.finished.then(() => {
			il(t.animations, l);
		})), l;
	}
	return i;
}
var Zb = Object.assign(Xb(), {
	addEffect: om,
	removeEffect: sm
}), Qb = (e) => {
	let t = e.trim(), n = t.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i)?.[1];
	if (n) {
		let e = n.length === 3 ? [...n].map((e) => e + e).join("") : n;
		return {
			r: parseInt(e.slice(0, 2), 16),
			g: parseInt(e.slice(2, 4), 16),
			b: parseInt(e.slice(4, 6), 16)
		};
	}
	let r = t.match(/^rgba?\(([^)]+)\)$/);
	if (!r) return null;
	let [i, a, o] = r[1].split(",").slice(0, 3).map((e) => Number.parseFloat(e.trim()));
	return [
		i,
		a,
		o
	].every(Number.isFinite) ? {
		r: i,
		g: a,
		b: o
	} : null;
}, $b = (e) => {
	let t = Math.max(0, Math.min(255, Math.round(e))) / 255;
	return t <= .03928 ? t / 12.92 : ((t + .055) / 1.055) ** 2.4;
}, ex = (e) => {
	let t = Qb(e);
	return t ? .2126 * $b(t.r) + .7152 * $b(t.g) + .0722 * $b(t.b) : 0;
}, tx = (e, t) => {
	let n = ex(e), r = ex(t);
	return (Math.max(n, r) + .05) / (Math.min(n, r) + .05);
}, nx = "#17171a", rx = "#ffffff", ix = (e) => tx(nx, e) >= tx(rx, e) ? nx : rx, ax = (e, t) => {
	let n = t?.accentColor || (e ? "#18181b" : "#f4f4f5");
	return {
		"--st-win": e ? "#f3f3f4" : "#1a1a1d",
		"--st-side": e ? "#e9e9eb" : "#141416",
		"--st-card": e ? "#ffffff" : "#232327",
		"--st-menu": e ? "#ffffff" : "#2b2b30",
		"--st-raise": e ? "#ffffff" : "#45454c",
		"--st-knob": e ? "#ffffff" : "#ececee",
		"--st-pv": e ? "#ececef" : "#151517",
		"--st-ok": e ? "#1e9a5c" : "#56c98d",
		"--st-warn": e ? "#b97a10" : "#e3a949",
		"--st-err": e ? "#d04444" : "#ef6f6f",
		"--st-t1": "var(--text-primary)",
		"--st-t2": "color-mix(in srgb, var(--text-primary) 62%, transparent)",
		"--st-t3": "color-mix(in srgb, var(--text-primary) 42%, transparent)",
		"--st-line": "color-mix(in srgb, var(--text-primary) 8%, transparent)",
		"--st-line2": "color-mix(in srgb, var(--text-primary) 16%, transparent)",
		"--st-fill": "color-mix(in srgb, var(--text-primary) 7%, transparent)",
		"--st-fill2": "color-mix(in srgb, var(--text-primary) 12%, transparent)",
		"--st-track": "color-mix(in srgb, var(--text-primary) 17%, transparent)",
		"--st-accent": n,
		"--st-on-accent": ix(n)
	};
}, ox = (0, j.createContext)({ isDaylight: !1 }), sx = () => (0, j.useContext)(ox), cx = (e, t, n, { side: r, align: i, fill: a = !1 }) => {
	let { scrollLeft: o = 0, scrollTop: s = 0 } = n, c = {
		under: n.top + n.height - 8 - (e.top + e.height + 6),
		over: e.top - 6 - (n.top + 8)
	}, l = r === "under" ? "over" : "under", u = t.height <= c[r] || t.height > c[l] && c[r] >= c[l] ? r : l, d = u === "under" ? { top: e.top + e.height + 6 - n.top + s } : { bottom: n.top + n.height - e.top + 6 - s }, f = (e) => Math.max(8, Math.min(e, n.width - t.width - 8));
	return {
		side: u,
		...a ? {
			left: 8 + o,
			right: 8 - o
		} : i === "end" ? { right: f(n.left + n.width - (e.left + e.width)) - o } : { left: f(e.left - n.left + (i === "center" ? (e.width - t.width) / 2 : 0)) + o },
		...d,
		maxHeight: Math.max(0, c[u])
	};
}, lx = 260, ux = ({ text: e, className: t, children: n }) => {
	let { isDaylight: r } = sx(), i = qc(), a = (0, j.useRef)(null), o = (0, j.useRef)(null), s = (0, j.useRef)(void 0), [c, l] = (0, j.useState)(!1), [u, d] = (0, j.useState)(null), f = () => l(!0), p = (0, j.useCallback)(() => {
		window.clearTimeout(s.current), l(!1);
	}, []);
	return (0, j.useEffect)(() => () => window.clearTimeout(s.current), []), (0, j.useEffect)(() => {
		e || p();
	}, [e, p]), (0, j.useLayoutEffect)(() => {
		let e = a.current, t = o.current;
		c && t?.isConnected && !t.matches(":popover-open") && t.showPopover(), d(c && e && t ? cx(e.getBoundingClientRect(), {
			width: t.offsetWidth,
			height: t.offsetHeight
		}, {
			left: 0,
			top: 0,
			width: window.innerWidth,
			height: window.innerHeight
		}, {
			side: "over",
			align: "center"
		}) : null);
	}, [c, e]), (0, j.useEffect)(() => {
		if (!c) return;
		let e = (e) => {
			e.key === "Escape" && p();
		};
		return window.addEventListener("scroll", p, !0), window.addEventListener("keydown", e, !0), () => {
			window.removeEventListener("scroll", p, !0), window.removeEventListener("keydown", e, !0);
		};
	}, [c, p]), e ? /* @__PURE__ */ (0, W.jsxs)("span", {
		ref: a,
		className: t,
		onMouseEnter: () => {
			s.current = window.setTimeout(f, Hc.tooltipDelay * 1e3);
		},
		onMouseLeave: p,
		onMouseDown: p,
		onFocus: (e) => {
			e.target.matches(":focus-visible") && f();
		},
		onBlur: p,
		children: [n, /* @__PURE__ */ (0, W.jsx)(kv, { children: c && /* @__PURE__ */ (0, W.jsx)(xb.span, {
			ref: o,
			role: "tooltip",
			popover: "manual",
			initial: { opacity: 0 },
			animate: u ? {
				opacity: 1,
				y: [u.side === "over" ? 4 : -4, 0]
			} : { opacity: 0 },
			exit: { opacity: 0 },
			transition: Jc("fast", i),
			className: "pointer-events-none fixed z-[210] rounded-md px-2 py-1 text-xs leading-[18px] shadow-[0_6px_18px_rgba(0,0,0,0.3)] [overflow-wrap:anywhere]",
			style: {
				margin: 0,
				border: 0,
				right: "auto",
				left: u?.left ?? 0,
				top: u?.top ?? "auto",
				bottom: u?.bottom ?? "auto",
				visibility: u ? "visible" : "hidden",
				maxWidth: Math.min(lx, window.innerWidth - 16),
				width: "max-content",
				color: r ? "#ffffff" : "#17171a",
				backgroundColor: r ? "#26262b" : "#ececee"
			},
			children: e
		}) })]
	}) : /* @__PURE__ */ (0, W.jsx)("span", {
		className: t,
		children: n
	});
}, dx = "st-t-fast inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap transition-[background-color,color,opacity,scale] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40", fx = "h-9 rounded-lg border border-transparent bg-transparent text-[color:var(--st-t2)] enabled:hover:border-[var(--st-err)] enabled:hover:text-[color:var(--st-err)] focus-visible:border-[var(--st-err)] focus-visible:text-[color:var(--st-err)]", px = {
	dangerOutline: `${fx} px-3 text-[13px]`,
	fill: "h-8 rounded-lg bg-[var(--st-fill)] px-3 text-[13px] text-[color:var(--st-t1)] enabled:hover:bg-[var(--st-fill2)]",
	primary: "h-8 rounded-lg bg-[var(--st-accent)] px-3 text-[13px] text-[color:var(--st-on-accent)] enabled:hover:opacity-90",
	quiet: "h-6 rounded-md px-1.5 text-xs text-[color:var(--st-t2)] enabled:hover:bg-[var(--st-fill)] enabled:hover:text-[color:var(--st-t1)]"
}, mx = {
	dangerOutline: `${fx} w-9`,
	fill: "h-8 w-8 rounded-lg bg-[var(--st-fill)] text-[color:var(--st-t2)] enabled:hover:bg-[var(--st-fill2)] enabled:hover:text-[color:var(--st-t1)] disabled:bg-transparent",
	primary: "h-8 w-8 rounded-lg bg-[var(--st-accent)] text-[color:var(--st-on-accent)] enabled:hover:opacity-90",
	quiet: "h-6 w-6 rounded-md text-[color:var(--st-t2)] enabled:hover:bg-[var(--st-fill)] enabled:hover:text-[color:var(--st-t1)]"
}, hx = ({ onClick: e, variant: t, icon: n, tip: r, disabled: i, children: a, buttonRef: o, ...s }) => {
	let { labelId: c } = Zc();
	return /* @__PURE__ */ (0, W.jsx)(ux, {
		text: r,
		className: "inline-flex shrink-0",
		children: /* @__PURE__ */ (0, W.jsxs)("button", {
			ref: o,
			...s,
			type: "button",
			onClick: e,
			disabled: i,
			"aria-label": a ? void 0 : r,
			"aria-describedby": a ? void 0 : c,
			className: `${dx} aria-disabled:opacity-40 aria-disabled:cursor-not-allowed ${(a ? px : mx)[t ?? "fill"]}`,
			children: [n && /* @__PURE__ */ (0, W.jsx)(n, { size: t === "dangerOutline" ? 20 : 14 }), a]
		})
	});
}, gx = "st-t-fast max-w-full rounded-lg border border-transparent bg-[var(--st-fill)] text-[color:var(--st-t1)] outline-none transition-colors placeholder:text-[color:var(--st-t3)] focus-within:border-[var(--st-accent)] h-8 text-[13px]", _x = (e, t) => {
	let n = (0, j.useRef)(e), r = (0, j.useRef)(!1);
	return {
		enter: () => {
			n.current = e, r.current = !1;
		},
		typed: () => {
			r.current = !0;
		},
		finish: () => {
			t && r.current && n.current !== e && (n.current = e, r.current = !1, t());
		}
	};
}, vx = ({ value: e, onChange: t, onCommit: n, type: r, placeholder: i, disabled: a }) => {
	let o = _x(e, n);
	return /* @__PURE__ */ (0, W.jsx)("input", {
		type: r ?? "text",
		...Qc(),
		value: e,
		placeholder: i,
		disabled: a,
		spellCheck: !1,
		onChange: (e) => {
			o.typed(), t(e.target.value);
		},
		onFocus: o.enter,
		onBlur: o.finish,
		onKeyDown: (e) => {
			e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && o.finish();
		},
		className: `${gx} w-[260px] px-2.5 disabled:cursor-not-allowed disabled:opacity-40`
	});
}, yx = "/*! tailwindcss v4.3.5 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:block))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after{--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scale-z:1;--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-space-y-reverse:0;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial}::backdrop{--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scale-z:1;--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-space-y-reverse:0;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial}}}@layer theme{:root,:host{--font-sans:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\";--font-mono:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace;--color-yellow-400:#fac800;--color-zinc-950:#09090b;--color-white:#fff;--spacing:.25rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--text-sm:.875rem;--text-sm--line-height:calc(1.25 / .875);--text-base:1rem;--text-base--line-height:calc(1.5 / 1);--text-lg:1.125rem;--text-lg--line-height:calc(1.75 / 1.125);--text-xl:1.25rem;--text-xl--line-height:calc(1.75 / 1.25);--font-weight-normal:400;--font-weight-medium:500;--font-weight-semibold:600;--font-weight-bold:700;--radius-md:.375rem;--radius-lg:.5rem;--radius-xl:.75rem;--radius-2xl:1rem;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--default-font-family:var(--font-sans);--default-mono-font-family:var(--font-mono)}@supports (color:lab(0% 0 0)){:root,:host{--color-yellow-400:lab(83.2664% 8.65132 106.895);--color-zinc-950:lab(2.51107% .242703 -.886115)}}}@layer base{*,:after,:before{box-sizing:border-box;border:0 solid;margin:0;padding:0}::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}::file-selector-button{box-sizing:border-box;border:0 solid;margin:0;padding:0}html,:host{-webkit-text-size-adjust:100%;tab-size:4;line-height:1.5;font-family:var(--default-font-family,-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\");font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;-webkit-text-decoration:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,samp,pre{font-family:var(--default-mono-font-family,ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace);font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}small{font-size:80%}sub,sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}:-moz-focusring:where(:not(iframe)){outline:auto}progress{vertical-align:baseline}summary{display:list-item}ol,ul,menu{list-style:none}img,svg,video,canvas,audio,iframe,embed,object{vertical-align:middle;display:block}img,video{max-width:100%;height:auto}button,input,select,optgroup,textarea{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}:where(select:is([multiple],[size])) optgroup{font-weight:bolder}:where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}::file-selector-button{margin-inline-end:4px}::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor}@supports (color:color-mix(in lab, red, red)){::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}}textarea{resize:vertical}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-datetime-edit{padding-block:0}::-webkit-datetime-edit-year-field{padding-block:0}::-webkit-datetime-edit-month-field{padding-block:0}::-webkit-datetime-edit-day-field{padding-block:0}::-webkit-datetime-edit-hour-field{padding-block:0}::-webkit-datetime-edit-minute-field{padding-block:0}::-webkit-datetime-edit-second-field{padding-block:0}::-webkit-datetime-edit-millisecond-field{padding-block:0}::-webkit-datetime-edit-meridiem-field{padding-block:0}::-webkit-calendar-picker-indicator{line-height:1}:-moz-ui-invalid{box-shadow:none}button,input:where([type=button],[type=reset],[type=submit]){appearance:button}::file-selector-button{appearance:button}::-webkit-inner-spin-button{height:auto}::-webkit-outer-spin-button{height:auto}[hidden]:where(:not([hidden=until-found])){display:none!important}}@layer components;@layer utilities{.pointer-events-auto{pointer-events:auto}.pointer-events-none{pointer-events:none}.invisible{visibility:hidden}.visible{visibility:visible}.sr-only{clip-path:inset(50%);white-space:nowrap;border-width:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.sticky{position:sticky}.inset-0{inset:0}.inset-auto{inset:auto}.inset-x-1{inset-inline:var(--spacing)}.top-0{top:0}.top-1\\/2{top:50%}.top-\\[3px\\]{top:3px}.top-full{top:100%}.right-0{right:0}.bottom-0{bottom:0}.left-0{left:0}.left-\\[3px\\]{left:3px}.isolate{isolation:isolate}.-z-10{z-index:calc(10 * -1)}.z-10{z-index:10}.z-20{z-index:20}.z-30{z-index:30}.z-\\[200\\]{z-index:200}.z-\\[210\\]{z-index:210}.container{width:100%}@media (min-width:40rem){.container{max-width:40rem}}@media (min-width:48rem){.container{max-width:48rem}}@media (min-width:64rem){.container{max-width:64rem}}@media (min-width:80rem){.container{max-width:80rem}}@media (min-width:96rem){.container{max-width:96rem}}.m-0{margin:0}.m-3{margin:calc(var(--spacing) * 3)}.-mx-1{margin-inline:calc(var(--spacing) * -1)}.mx-1{margin-inline:var(--spacing)}.-mt-0\\.5{margin-top:calc(var(--spacing) * -.5)}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)}.mt-1{margin-top:var(--spacing)}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)}.mt-2{margin-top:calc(var(--spacing) * 2)}.mt-2\\.5{margin-top:calc(var(--spacing) * 2.5)}.mt-7{margin-top:calc(var(--spacing) * 7)}.mt-\\[7px\\]{margin-top:7px}.mr-auto{margin-right:auto}.mb-1{margin-bottom:var(--spacing)}.mb-2{margin-bottom:calc(var(--spacing) * 2)}.mb-3{margin-bottom:calc(var(--spacing) * 3)}.ml-1\\.5{margin-left:calc(var(--spacing) * 1.5)}.ml-3{margin-left:calc(var(--spacing) * 3)}.ml-auto{margin-left:auto}.block{display:block}.contents{display:contents}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline{display:inline}.inline-block{display:inline-block}.inline-flex{display:inline-flex}.inline-grid{display:inline-grid}.size-4{width:calc(var(--spacing) * 4);height:calc(var(--spacing) * 4)}.size-10{width:calc(var(--spacing) * 10);height:calc(var(--spacing) * 10)}.size-16{width:calc(var(--spacing) * 16);height:calc(var(--spacing) * 16)}.size-full{width:100%;height:100%}.h-0\\.5{height:calc(var(--spacing) * .5)}.h-1\\.5{height:calc(var(--spacing) * 1.5)}.h-3{height:calc(var(--spacing) * 3)}.h-4{height:calc(var(--spacing) * 4)}.h-6{height:calc(var(--spacing) * 6)}.h-8{height:calc(var(--spacing) * 8)}.h-9{height:calc(var(--spacing) * 9)}.h-\\[18px\\]{height:18px}.h-\\[136px\\]{height:136px}.h-\\[720px\\]{height:720px}.h-full{height:100%}.max-h-52{max-height:calc(var(--spacing) * 52)}.max-h-64{max-height:calc(var(--spacing) * 64)}.max-h-96{max-height:calc(var(--spacing) * 96)}.max-h-\\[min\\(720px\\,100\\%\\)\\]{max-height:min(720px,100%)}.min-h-0{min-height:0}.min-h-6{min-height:calc(var(--spacing) * 6)}.min-h-8{min-height:calc(var(--spacing) * 8)}.min-h-12{min-height:calc(var(--spacing) * 12)}.min-h-14{min-height:calc(var(--spacing) * 14)}.min-h-\\[min\\(420px\\,100\\%\\)\\]{min-height:min(420px,100%)}.w-1\\.5{width:calc(var(--spacing) * 1.5)}.w-2{width:calc(var(--spacing) * 2)}.w-4{width:calc(var(--spacing) * 4)}.w-6{width:calc(var(--spacing) * 6)}.w-8{width:calc(var(--spacing) * 8)}.w-9{width:calc(var(--spacing) * 9)}.w-10{width:calc(var(--spacing) * 10)}.w-40{width:calc(var(--spacing) * 40)}.w-64{width:calc(var(--spacing) * 64)}.w-\\[18px\\]{width:18px}.w-\\[260px\\]{width:260px}.w-\\[400px\\]{width:400px}.w-\\[600px\\]{width:600px}.w-\\[772px\\]{width:772px}.w-\\[880px\\]{width:880px}.w-\\[1160px\\]{width:1160px}.w-full{width:100%}.w-max{width:max-content}.w-px{width:1px}.max-w-\\[264px\\]{max-width:264px}.max-w-\\[540px\\]{max-width:540px}.max-w-\\[calc\\(100\\%-16px\\)\\]{max-width:calc(100% - 16px)}.max-w-full{max-width:100%}.min-w-0{min-width:0}.min-w-\\[176px\\]{min-width:176px}.min-w-full{min-width:100%}.flex-1{flex:1}.flex-\\[1_1_140px\\]{flex:140px}.shrink{flex-shrink:1}.shrink-0{flex-shrink:0}.basis-32{flex-basis:calc(var(--spacing) * 32)}.basis-full{flex-basis:100%}.-translate-x-1\\/2{--tw-translate-x:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.translate-x-4{--tw-translate-x:calc(var(--spacing) * 4);translate:var(--tw-translate-x) var(--tw-translate-y)}.-translate-y-1\\/2{--tw-translate-y:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.scale-50{--tw-scale-x:50%;--tw-scale-y:50%;--tw-scale-z:50%;scale:var(--tw-scale-x) var(--tw-scale-y)}.transform{transform:var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )}.cursor-not-allowed{cursor:not-allowed}.cursor-pointer{cursor:pointer}.resize{resize:both}.resize-none{resize:none}.\\[scrollbar-width\\:none\\]{scrollbar-width:none}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.place-items-center{place-items:center}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.justify-end{justify-content:flex-end}.gap-1{gap:var(--spacing)}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-2\\.5{gap:calc(var(--spacing) * 2.5)}.gap-3{gap:calc(var(--spacing) * 3)}.gap-4{gap:calc(var(--spacing) * 4)}.gap-\\[18px\\]{gap:18px}:where(.space-y-1>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(var(--spacing) * var(--tw-space-y-reverse));margin-block-end:calc(var(--spacing) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-2>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-3>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-4>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)))}.gap-x-3{column-gap:calc(var(--spacing) * 3)}.gap-x-6{column-gap:calc(var(--spacing) * 6)}.gap-y-1{row-gap:var(--spacing)}.self-end{align-self:flex-end}.truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.overflow-hidden{overflow:hidden}.overflow-x-auto{overflow-x:auto}.overflow-y-auto{overflow-y:auto}.overscroll-contain{overscroll-behavior:contain}.rounded{border-radius:.25rem}.rounded-2xl{border-radius:var(--radius-2xl)}.rounded-\\[5px\\]{border-radius:5px}.rounded-\\[10px\\]{border-radius:10px}.rounded-full{border-radius:3.40282e38px}.rounded-lg{border-radius:var(--radius-lg)}.rounded-md{border-radius:var(--radius-md)}.rounded-xl{border-radius:var(--radius-xl)}.border{border-style:var(--tw-border-style);border-width:1px}.border-0{border-style:var(--tw-border-style);border-width:0}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-\\[var\\(--st-line\\)\\]{border-color:var(--st-line)}.border-transparent{border-color:#0000}.bg-\\[var\\(--sheet-scrim\\)\\]{background-color:var(--sheet-scrim)}.bg-\\[var\\(--st-accent\\)\\]{background-color:var(--st-accent)}.bg-\\[var\\(--st-card\\)\\]{background-color:var(--st-card)}.bg-\\[var\\(--st-err\\)\\]{background-color:var(--st-err)}.bg-\\[var\\(--st-fill\\)\\]{background-color:var(--st-fill)}.bg-\\[var\\(--st-fill2\\)\\]{background-color:var(--st-fill2)}.bg-\\[var\\(--st-knob\\)\\]{background-color:var(--st-knob)}.bg-\\[var\\(--st-menu\\)\\]{background-color:var(--st-menu)}.bg-\\[var\\(--st-ok\\)\\]{background-color:var(--st-ok)}.bg-\\[var\\(--st-on-accent\\)\\]{background-color:var(--st-on-accent)}.bg-\\[var\\(--st-pv\\)\\]{background-color:var(--st-pv)}.bg-\\[var\\(--st-t3\\)\\]{background-color:var(--st-t3)}.bg-\\[var\\(--st-track\\)\\]{background-color:var(--st-track)}.bg-\\[var\\(--st-warn\\)\\]{background-color:var(--st-warn)}.bg-\\[var\\(--st-win\\)\\]{background-color:var(--st-win)}.bg-current{background-color:currentColor}.bg-transparent{background-color:#0000}.bg-yellow-400{background-color:var(--color-yellow-400)}.object-cover{object-fit:cover}.p-0{padding:0}.p-1{padding:var(--spacing)}.p-2{padding:calc(var(--spacing) * 2)}.p-4{padding:calc(var(--spacing) * 4)}.px-1{padding-inline:var(--spacing)}.px-1\\.5{padding-inline:calc(var(--spacing) * 1.5)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)}.px-3{padding-inline:calc(var(--spacing) * 3)}.px-4{padding-inline:calc(var(--spacing) * 4)}.px-6{padding-inline:calc(var(--spacing) * 6)}.py-1{padding-block:var(--spacing)}.py-2{padding-block:calc(var(--spacing) * 2)}.py-2\\.5{padding-block:calc(var(--spacing) * 2.5)}.py-3{padding-block:calc(var(--spacing) * 3)}.pt-1{padding-top:var(--spacing)}.pt-1\\.5{padding-top:calc(var(--spacing) * 1.5)}.pt-2{padding-top:calc(var(--spacing) * 2)}.pt-3{padding-top:calc(var(--spacing) * 3)}.pt-4{padding-top:calc(var(--spacing) * 4)}.pr-3{padding-right:calc(var(--spacing) * 3)}.pr-4{padding-right:calc(var(--spacing) * 4)}.pb-0\\.5{padding-bottom:calc(var(--spacing) * .5)}.pb-1\\.5{padding-bottom:calc(var(--spacing) * 1.5)}.pb-3{padding-bottom:calc(var(--spacing) * 3)}.pb-4{padding-bottom:calc(var(--spacing) * 4)}.pb-5{padding-bottom:calc(var(--spacing) * 5)}.pl-2{padding-left:calc(var(--spacing) * 2)}.pl-3{padding-left:calc(var(--spacing) * 3)}.pl-4{padding-left:calc(var(--spacing) * 4)}.pl-6{padding-left:calc(var(--spacing) * 6)}.pl-10{padding-left:calc(var(--spacing) * 10)}.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}.align-middle{vertical-align:middle}.font-mono{font-family:var(--font-mono)}.text-base{font-size:var(--text-base);line-height:var(--tw-leading,var(--text-base--line-height))}.text-lg{font-size:var(--text-lg);line-height:var(--tw-leading,var(--text-lg--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.text-xl{font-size:var(--text-xl);line-height:var(--tw-leading,var(--text-xl--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.text-\\[11px\\]{font-size:11px}.text-\\[13px\\]{font-size:13px}.leading-5{--tw-leading:calc(var(--spacing) * 5);line-height:calc(var(--spacing) * 5)}.leading-8{--tw-leading:calc(var(--spacing) * 8);line-height:calc(var(--spacing) * 8)}.leading-9{--tw-leading:calc(var(--spacing) * 9);line-height:calc(var(--spacing) * 9)}.leading-\\[18px\\]{--tw-leading:18px;line-height:18px}.leading-\\[19px\\]{--tw-leading:19px;line-height:19px}.leading-none{--tw-leading:1;line-height:1}.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}.font-normal{--tw-font-weight:var(--font-weight-normal);font-weight:var(--font-weight-normal)}.font-semibold{--tw-font-weight:var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.\\[overflow-wrap\\:anywhere\\]{overflow-wrap:anywhere}.break-words{overflow-wrap:break-word}.whitespace-nowrap{white-space:nowrap}.text-\\[color\\:var\\(--st-on-accent\\)\\]{color:var(--st-on-accent)}.text-\\[color\\:var\\(--st-t1\\)\\]{color:var(--st-t1)}.text-\\[color\\:var\\(--st-t2\\)\\]{color:var(--st-t2)}.text-\\[color\\:var\\(--st-t3\\)\\]{color:var(--st-t3)}.text-white{color:var(--color-white)}.text-zinc-950{color:var(--color-zinc-950)}.tabular-nums{--tw-numeric-spacing:tabular-nums;font-variant-numeric:var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )}.opacity-0{opacity:0}.opacity-40{opacity:.4}.opacity-70{opacity:.7}.shadow{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-2xl{--tw-shadow:0 25px 50px -12px var(--tw-shadow-color,#00000040);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-\\[0_0_0_1px_var\\(--st-line\\)\\]{--tw-shadow:0 0 0 1px var(--tw-shadow-color,var(--st-line));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-\\[0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]{--tw-shadow:0 1px 2px var(--tw-shadow-color,#0000004d);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-\\[0_6px_18px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]{--tw-shadow:0 6px 18px var(--tw-shadow-color,#0000004d);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-\\[inset_0_0_0_1\\.5px_var\\(--st-t3\\)\\]{--tw-shadow:inset 0 0 0 1.5px var(--tw-shadow-color,var(--st-t3));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a), 0 4px 6px -4px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-xl{--tw-shadow:0 20px 25px -5px var(--tw-shadow-color,#0000001a), 0 8px 10px -6px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-1{--tw-ring-shadow:var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-\\[var\\(--st-line2\\)\\]{--tw-ring-color:var(--st-line2)}.outline{outline-style:var(--tw-outline-style);outline-width:1px}.blur{--tw-blur:blur(8px);filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.filter{filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[background-color\\,box-shadow\\]{transition-property:background-color,box-shadow;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[background-color\\,color\\,opacity\\,scale\\]{transition-property:background-color,color,opacity,scale;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[background-color\\,color\\,opacity\\]{transition-property:background-color,color,opacity;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[background-color\\,color\\,scale\\]{transition-property:background-color,color,scale;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[opacity\\,scale\\]{transition-property:opacity,scale;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[translate\\,width\\,background-color\\]{transition-property:translate,width,background-color;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-opacity{transition-property:opacity;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.outline-none{--tw-outline-style:none;outline-style:none}:is(:where(.group):active :is(:where(.group):enabled .group-enabled\\:group-active\\:w-\\[22px\\])){width:22px}:is(:where(.group):active :is(:where(.group):enabled .group-enabled\\:group-active\\:translate-x-3)){--tw-translate-x:calc(var(--spacing) * 3);translate:var(--tw-translate-x) var(--tw-translate-y)}.placeholder\\:text-\\[color\\:var\\(--st-t3\\)\\]::placeholder{color:var(--st-t3)}.first\\:mt-5:first-child{margin-top:calc(var(--spacing) * 5)}.focus-within\\:border-\\[var\\(--st-accent\\)\\]:focus-within{border-color:var(--st-accent)}@media (hover:hover){.hover\\:bg-\\[var\\(--st-fill\\)\\]:hover{background-color:var(--st-fill)}.hover\\:bg-\\[var\\(--st-fill2\\)\\]:hover{background-color:var(--st-fill2)}.hover\\:text-\\[color\\:var\\(--st-t1\\)\\]:hover{color:var(--st-t1)}.hover\\:opacity-90:hover{opacity:.9}.hover\\:opacity-100:hover{opacity:1}}.focus-visible\\:border-\\[var\\(--st-err\\)\\]:focus-visible{border-color:var(--st-err)}.focus-visible\\:text-\\[color\\:var\\(--st-err\\)\\]:focus-visible{color:var(--st-err)}.active\\:scale-\\[0\\.97\\]:active{scale:.97}@media (hover:hover){.enabled\\:hover\\:border-\\[var\\(--st-err\\)\\]:enabled:hover{border-color:var(--st-err)}.enabled\\:hover\\:bg-\\[var\\(--st-fill\\)\\]:enabled:hover{background-color:var(--st-fill)}.enabled\\:hover\\:bg-\\[var\\(--st-fill2\\)\\]:enabled:hover{background-color:var(--st-fill2)}.enabled\\:hover\\:text-\\[color\\:var\\(--st-err\\)\\]:enabled:hover{color:var(--st-err)}.enabled\\:hover\\:text-\\[color\\:var\\(--st-t1\\)\\]:enabled:hover{color:var(--st-t1)}.enabled\\:hover\\:opacity-90:enabled:hover{opacity:.9}}.enabled\\:active\\:scale-\\[0\\.97\\]:enabled:active{scale:.97}.disabled\\:pointer-events-none:disabled{pointer-events:none}.disabled\\:cursor-default:disabled{cursor:default}.disabled\\:cursor-not-allowed:disabled{cursor:not-allowed}.disabled\\:bg-transparent:disabled{background-color:#0000}.disabled\\:opacity-40:disabled{opacity:.4}.aria-checked\\:bg-\\[var\\(--st-fill2\\)\\][aria-checked=true]{background-color:var(--st-fill2)}.aria-disabled\\:cursor-not-allowed[aria-disabled=true]{cursor:not-allowed}.aria-disabled\\:opacity-40[aria-disabled=true]{opacity:.4}.aria-pressed\\:bg-\\[var\\(--st-fill\\)\\][aria-pressed=true]{background-color:var(--st-fill)}.aria-pressed\\:bg-\\[var\\(--st-fill2\\)\\][aria-pressed=true]{background-color:var(--st-fill2)}.aria-pressed\\:text-\\[color\\:var\\(--st-t1\\)\\][aria-pressed=true]{color:var(--st-t1)}.aria-selected\\:bg-\\[var\\(--st-fill\\)\\][aria-selected=true]{background-color:var(--st-fill)}@media (min-width:48rem){.md\\:gap-\\[22px\\]{gap:22px}.md\\:p-6{padding:calc(var(--spacing) * 6)}.md\\:px-8{padding-inline:calc(var(--spacing) * 8)}.md\\:pt-2{padding-top:calc(var(--spacing) * 2)}.md\\:pr-4{padding-right:calc(var(--spacing) * 4)}.md\\:pb-4{padding-bottom:calc(var(--spacing) * 4)}.md\\:pl-8{padding-left:calc(var(--spacing) * 8)}}.\\[\\&_input\\]\\:w-full input{width:100%}.\\[\\&\\.st-card\\]\\:overflow-visible.st-card{overflow:visible}}.st-window :focus-visible:not(input,textarea,select){outline:2px solid var(--st-accent);outline-offset:2px}.st-window .st-focus-inside:focus-visible{outline-offset:-2px}.st-slider:focus-visible{outline:none}.st-slider:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 2px var(--st-card), 0 0 0 4px var(--st-accent)}.st-slider::-webkit-slider-thumb{transition:transform var(--st-dur-fast) var(--st-ease-out)}.st-slider:active::-webkit-slider-thumb{transform:scale(1.15)}.st-slider-stacked{display:contents}.st-row>div:has(>.st-slider-stacked){display:contents}.st-row>div[inert]:has(>.st-slider-stacked)>.st-slider-stacked>*{opacity:.4}.st-t-fast{transition-duration:var(--st-dur-fast);transition-timing-function:var(--st-ease-standard)}.st-t-move{transition-duration:var(--st-dur-move);transition-timing-function:var(--st-ease-out)}.st-t-unfold{transition-duration:var(--st-dur-unfold);transition-timing-function:var(--st-ease-out)}.st-row:before{content:\"\";background:var(--st-line);height:1px;position:absolute;top:0;left:16px;right:0}.st-row[data-sub]:before{left:40px}.st-card>.st-row:first-child:before,.st-card>.st-unfold:first-child>div>.st-row:first-child:before{display:none}.st-unfold{opacity:0;visibility:hidden;transition:grid-template-rows var(--st-dur-unfold) var(--st-ease-out), opacity var(--st-dur-unfold) var(--st-ease-out), visibility 0s linear var(--st-dur-unfold);grid-template-rows:0fr;display:grid}.st-unfold[data-open]{opacity:1;visibility:visible;grid-template-rows:1fr;transition-delay:0s}.st-unfold[data-instant]{transition:none}.st-unfold>div{min-width:0;min-height:0;overflow:hidden}.st-scroll::-webkit-scrollbar{width:12px}.st-scroll::-webkit-scrollbar-track{background:0 0}.st-scroll::-webkit-scrollbar-thumb{background:var(--st-fill2);background-clip:content-box;border:4px solid #0000;border-radius:6px}@keyframes st-pop-in{0%{opacity:0;transform:translateY(var(--st-pop-shift)) scale(.98)}}@keyframes st-pop-out{to{opacity:0;transform:translateY(var(--st-pop-shift)) scale(.98)}}.st-pop{animation:st-pop-in var(--st-dur-move,0s) var(--st-ease-out,ease) backwards}.st-pop[data-leaving]{animation:st-pop-out var(--st-dur-fast,0s) var(--st-ease-standard,ease) forwards}@keyframes st-page-in{0%{opacity:0;transform:translateY(6px)}}.st-page-in{animation:st-page-in var(--st-dur-move) var(--st-ease-out) backwards}.st-swatch[aria-pressed=true]{box-shadow:inset 0 0 0 1px var(--st-line2), 0 0 0 2px var(--st-swatch-gap,var(--st-card)), 0 0 0 3.5px var(--st-t1)}.music-notes-layout{grid-template-rows:minmax(0,1fr);grid-template-columns:minmax(0,min(20rem,35%)) minmax(0,1fr);display:grid;overflow:hidden}.music-notes-list{border-inline-end:1px solid var(--st-line);min-width:0;min-height:0;overflow:clip}.music-notes-editor{max-width:45rem}.music-notes-back{display:none}.music-notes-layout[data-first]{display:flex}.music-notes-layout[data-first] .music-notes-detail{flex-direction:column;flex:1;align-items:center;display:flex}.music-notes-layout[data-first] .music-notes-detail>:last-child{margin-block:auto}.music-notes-layout[data-first] [data-music-notes=tags]{order:1}.music-notes-layout[data-first] .music-notes-editor>:last-child{order:2}.music-notes-hover{opacity:0}.group:hover .music-notes-hover,.group:focus-within .music-notes-hover{opacity:1}[data-sort-key]{cursor:grab;-webkit-user-select:none;user-select:none;position:relative}[data-sort-key][data-dragging]{cursor:grabbing;opacity:.55}[data-sort-key][data-insert]:after{content:\"\";z-index:1;pointer-events:none;border-color:var(--st-accent);border-style:dashed;border-width:0;position:absolute}[data-sort-axis=vertical] [data-insert]:after{border-block-start-width:2px;inset-inline:2px}[data-sort-axis=vertical] [data-insert=before]:after{top:0}[data-sort-axis=vertical] [data-insert=after]:after{bottom:0}[data-sort-axis=horizontal] [data-insert]:after{border-inline-start-width:2px;inset-block:1px}[data-sort-axis=horizontal] [data-insert=before]:after{inset-inline-start:0}[data-sort-axis=horizontal] [data-insert=after]:after{inset-inline-end:0}@media (hover:none){.music-notes-hover{opacity:1}}@media (max-width:899px){.music-notes-layout{flex-direction:column;display:flex}.music-notes-list,.music-notes-detail{flex:1}.music-notes-list{border:0}.music-notes-back{display:block}.music-notes-layout[data-detail]>.music-notes-list,.music-notes-layout:not([data-first]):not([data-detail])>.music-notes-detail{display:none}}:host{font-family:var(--folium-font,sans-serif)}@property --tw-translate-x{syntax:\"*\";inherits:false;initial-value:0}@property --tw-translate-y{syntax:\"*\";inherits:false;initial-value:0}@property --tw-translate-z{syntax:\"*\";inherits:false;initial-value:0}@property --tw-scale-x{syntax:\"*\";inherits:false;initial-value:1}@property --tw-scale-y{syntax:\"*\";inherits:false;initial-value:1}@property --tw-scale-z{syntax:\"*\";inherits:false;initial-value:1}@property --tw-rotate-x{syntax:\"*\";inherits:false}@property --tw-rotate-y{syntax:\"*\";inherits:false}@property --tw-rotate-z{syntax:\"*\";inherits:false}@property --tw-skew-x{syntax:\"*\";inherits:false}@property --tw-skew-y{syntax:\"*\";inherits:false}@property --tw-space-y-reverse{syntax:\"*\";inherits:false;initial-value:0}@property --tw-border-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-leading{syntax:\"*\";inherits:false}@property --tw-font-weight{syntax:\"*\";inherits:false}@property --tw-ordinal{syntax:\"*\";inherits:false}@property --tw-slashed-zero{syntax:\"*\";inherits:false}@property --tw-numeric-figure{syntax:\"*\";inherits:false}@property --tw-numeric-spacing{syntax:\"*\";inherits:false}@property --tw-numeric-fraction{syntax:\"*\";inherits:false}@property --tw-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:\"*\";inherits:false}@property --tw-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:\"*\";inherits:false}@property --tw-inset-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:\"*\";inherits:false}@property --tw-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:\"*\";inherits:false}@property --tw-inset-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:\"*\";inherits:false}@property --tw-ring-offset-width{syntax:\"<length>\";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:\"*\";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-blur{syntax:\"*\";inherits:false}@property --tw-brightness{syntax:\"*\";inherits:false}@property --tw-contrast{syntax:\"*\";inherits:false}@property --tw-grayscale{syntax:\"*\";inherits:false}@property --tw-hue-rotate{syntax:\"*\";inherits:false}@property --tw-invert{syntax:\"*\";inherits:false}@property --tw-opacity{syntax:\"*\";inherits:false}@property --tw-saturate{syntax:\"*\";inherits:false}@property --tw-sepia{syntax:\"*\";inherits:false}@property --tw-drop-shadow{syntax:\"*\";inherits:false}@property --tw-drop-shadow-color{syntax:\"*\";inherits:false}@property --tw-drop-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-drop-shadow-size{syntax:\"*\";inherits:false}", bx = (e) => [Math.floor(e / 60), Math.floor(e % 60)].map((e) => String(e).padStart(2, "0")).join(":");
function xx({ anchor: e, bookmark: t, notebook: n, song: r, placeholder: i, close: a, reportFailure: o, signal: s }) {
	let c = (0, j.useRef)(null), l = (0, j.useRef)(t.text), u = (0, j.useRef)(l.current), d = (0, j.useRef)(!1), f = (e) => {
		if (!d.current && (d.current = !0, e && u.current !== l.current)) try {
			n.edit(r, (e) => ({
				...e,
				bookmarks: e.bookmarks.map((e) => e.id === t.id ? {
					...e,
					text: u.current
				} : e)
			}), !0), n.flush(r).catch(o);
		} catch {
			o();
		}
	}, p = (0, j.useRef)(f);
	return p.current = f, (0, j.useLayoutEffect)(() => {
		let t = c.current;
		if (!t) return;
		t.showPopover();
		let n = () => {
			let n = {
				left: 0,
				top: 0,
				width: window.innerWidth,
				height: window.innerHeight
			}, r = cx(e.getBoundingClientRect(), t.getBoundingClientRect(), n, {
				side: "over",
				align: "center"
			});
			t.style.left = `${r.left}px`, t.style.top = r.top === void 0 ? "auto" : `${r.top}px`, t.style.bottom = r.bottom === void 0 ? "auto" : `${r.bottom}px`;
		};
		n(), t.focus({ preventScroll: !0 }), window.addEventListener("resize", n), window.addEventListener("scroll", n, !0);
		let r = () => p.current(!0);
		return s.addEventListener("abort", r, { once: !0 }), window.addEventListener("pagehide", r), () => {
			s.removeEventListener("abort", r), window.removeEventListener("resize", n), window.removeEventListener("scroll", n, !0), window.removeEventListener("pagehide", r), r();
		};
	}, [e, s]), /* @__PURE__ */ (0, W.jsx)("input", {
		ref: c,
		popover: "manual",
		type: "text",
		defaultValue: t.text,
		className: `${gx} fixed inset-auto m-0 w-64 bg-[var(--st-menu)] px-2.5 shadow-lg`,
		"aria-label": i,
		placeholder: i,
		maxLength: Wt.bookmarkText,
		onChange: (e) => {
			u.current = e.currentTarget.value;
		},
		onBlur: () => {
			f(!0), a();
		},
		onKeyDown: (t) => {
			t.stopPropagation(), t.nativeEvent.isComposing || t.keyCode === 229 || (t.key === "Enter" || t.key === "Escape") && (t.preventDefault(), f(t.key === "Enter"), a(), e.querySelector("button")?.focus({ preventScroll: !0 }));
		}
	});
}
function Sx({ folium: e, port: t, notebook: n, i18n: r, notify: i, ctx: a, song: o, signal: s }) {
	let c = (0, j.useRef)(null), [l, u] = (0, j.useState)(null), d = o && l && n.getDraft(o).bookmarks.find((e) => e.id === l), f = e.host.folium.minor >= 10 ? e.theme.getCurrent() : void 0, p = f?.isDaylight ?? !1, m = {
		...ax(p, f),
		"--text-primary": f?.primaryColor ?? a.getColors().text,
		"--st-accent": f?.accentColor ?? a.getColors().fill
	}, h = () => i(r.t("musicNotes.failed"));
	return /* @__PURE__ */ (0, W.jsx)(ox.Provider, {
		value: {
			theme: f,
			isDaylight: p
		},
		children: /* @__PURE__ */ (0, W.jsxs)("span", {
			ref: c,
			className: "inline-flex",
			style: m,
			children: [/* @__PURE__ */ (0, W.jsx)(hx, {
				icon: Cc,
				variant: "primary",
				tip: r.t("musicNotes.markMoment"),
				disabled: !o || !n.getSnapshot().ready,
				onClick: () => {
					let e = t.currentSong();
					if (o && e && M(e) === M(o)) try {
						u(n.mark(e, a.playbackTime.get())), n.flush(e).catch(h);
					} catch {
						h();
					}
				}
			}), c.current && o && d && /* @__PURE__ */ (0, W.jsx)(xx, {
				anchor: c.current,
				notebook: n,
				song: o,
				bookmark: d,
				signal: s,
				close: () => u(null),
				reportFailure: h,
				placeholder: `${bx(d.positionSeconds)} · ${r.t("musicNotes.bookmarkPlaceholder")}`
			}, d.id)]
		})
	});
}
function Cx(e, t, n, r, i, a) {
	let o = (e) => (i, a) => {
		let o = document.createElement("style");
		o.textContent = yx;
		let s = document.createElement("div");
		i.append(o, s);
		let c = (0, g.createRoot)(s), l = () => c.render(e(a, t.currentSong())), u = [
			a.onChange(l),
			t.subscribe(l),
			n.subscribe(l)
		];
		return r.on("languageChanged", l), l(), () => {
			u.forEach((e) => e()), r.off("languageChanged", l), c.unmount(), s.remove(), o.remove();
		};
	}, s = e.registries.progressButtons.register({
		id: "mark-moment",
		slot: "progress.trailing",
		mount: o((o, s) => /* @__PURE__ */ (0, W.jsx)(Sx, {
			folium: e,
			port: t,
			notebook: n,
			i18n: r,
			notify: i,
			ctx: o,
			song: s,
			signal: a
		}, s && M(s)))
	}), c = e.registries.progressLayers.register({
		id: "moments",
		mount: o((r, i) => {
			if (!i || !n.getSnapshot().ready || !r.getDuration()) return null;
			let a = e.host.folium.minor >= 10 ? e.theme.getCurrent() : void 0;
			return /* @__PURE__ */ (0, W.jsx)(ox.Provider, {
				value: {
					theme: a,
					isDaylight: a?.isDaylight ?? !1
				},
				children: n.getDraft(i).bookmarks.map((e) => {
					let n = [bx(e.positionSeconds), e.text].filter(Boolean).join(" · ");
					return /* @__PURE__ */ (0, W.jsx)("span", {
						className: "pointer-events-auto absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2",
						style: {
							left: `${r.timeToRatio(e.positionSeconds) * 100}%`,
							color: r.getColors().text
						},
						children: /* @__PURE__ */ (0, W.jsx)(ux, {
							text: n,
							className: "inline-flex",
							children: /* @__PURE__ */ (0, W.jsx)("button", {
								type: "button",
								"aria-label": n,
								className: "flex h-3 w-2 items-center justify-center opacity-70 hover:opacity-100",
								onClick: () => {
									let n = t.currentSong();
									n && M(n) === M(i) && r.seek(e.positionSeconds);
								},
								children: /* @__PURE__ */ (0, W.jsx)("span", { className: "h-full w-px bg-current" })
							})
						})
					}, e.id);
				})
			});
		})
	});
	return () => {
		c.unregister(), s.unregister();
	};
}
// src/kit/Toggle.tsx
var wx = ({ checked: e, onChange: t, disabled: n, labelledBy: r }) => /* @__PURE__ */ (0, W.jsx)("button", {
	type: "button",
	role: "switch",
	"aria-checked": e,
	...Qc(),
	...r ? { "aria-labelledby": r } : {},
	disabled: n,
	onClick: () => t(!e),
	className: `st-t-move group relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${e ? "bg-[var(--st-accent)]" : "bg-[var(--st-track)]"}`,
	children: /* @__PURE__ */ (0, W.jsx)("span", { className: `st-t-move absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-[translate,width,background-color] group-enabled:group-active:w-[22px] ${e ? "translate-x-4 bg-[var(--st-on-accent)] group-enabled:group-active:translate-x-3" : "bg-[var(--st-knob)]"}` })
}), Tx = "Ctrl+N", Ex = "openNotebook", Dx = "shortcutsEnabled", Ox = {
	"zh-CN": "快捷键",
	"zh-TW": "快速鍵",
	en: "Keyboard shortcut",
	in: "Pintasan papan ketik"
}, kx = {
	"zh-CN": "启用快捷键",
	"zh-TW": "啟用快速鍵",
	en: "Enable shortcuts",
	in: "Aktifkan pintasan"
}, Ax = {
	"zh-CN": "打开音乐笔记",
	"zh-TW": "開啟音樂筆記",
	en: "Open music notes",
	in: "Buka catatan lagu",
	vi: "Mở ghi chú bài hát"
};
function jx(e) {
	return /^(?:Ctrl|Meta)\+[BFGJKP]$/u.test(e) || [
		"Alt+F4",
		"Meta+Q",
		"F6",
		"Shift+F6"
	].includes(e);
}
function Mx(e) {
	if (e.getModifierState("AltGraph")) return null;
	let t = /^(?:Key[A-Z]|Digit\d)$/u.test(e.code) ? e.code.replace(/^(Key|Digit)/u, "") : /^F(?:[1-9]|1\d|2[0-4])$/u.test(e.key) ? e.key : null;
	return !t || !e.ctrlKey && !e.metaKey && !e.altKey && !/^F\d+$/u.test(t) ? null : [
		e.ctrlKey && "Ctrl",
		e.altKey && "Alt",
		e.shiftKey && "Shift",
		e.metaKey && "Meta",
		t
	].filter(Boolean).join("+");
}
function Nx({ ctx: e, i18n: t }) {
	let n = e.settings.get()[Dx] !== !1, r = (0, j.useId)(), i = e.getTheme(), a = {
		...ax(i.isDaylight, i),
		"--text-primary": i.primaryColor
	};
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		className: "space-y-3 text-sm",
		style: a,
		children: [/* @__PURE__ */ (0, W.jsxs)("div", {
			className: "flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, W.jsx)("span", {
				id: r,
				children: t.getFixedT(e.locale)("musicNotes.shortcutEnabled")
			}), /* @__PURE__ */ (0, W.jsx)(wx, {
				checked: n,
				labelledBy: r,
				onChange: (t) => e.settings.set({ [Dx]: t })
			})]
		}), /* @__PURE__ */ (0, W.jsx)(Px, {
			ctx: e,
			i18n: t,
			enabled: n
		}, String(n))]
	});
}
function Px({ ctx: e, i18n: t, enabled: n }) {
	let [r, i] = (0, j.useState)(!1), [a, o] = (0, j.useState)(null), s = (0, j.useId)(), c = (0, j.useRef)(null);
	(0, j.useLayoutEffect)(() => {
		let e = c.current?.getRootNode();
		if (!r || !(e instanceof ShadowRoot)) return;
		let t = e.host, n = t.getAttribute("data-folia-key-capture");
		return t.setAttribute("data-folia-key-capture", "true"), () => {
			n === null ? t.removeAttribute("data-folia-key-capture") : t.setAttribute("data-folia-key-capture", n);
		};
	}, [r]);
	let l = e.settings.get()[Ex], u = typeof l == "string" ? l : Tx, d = t.getFixedT(e.locale), f = a === "unsupported" ? d("musicNotes.shortcutUnsupported") : a ? d("musicNotes.shortcutConflict", { binding: a.conflict }) : d("musicNotes.shortcutCapture"), p = (t) => {
		e.settings.set({ [Ex]: t }), i(!1), c.current?.focus();
	};
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		className: "flex flex-wrap items-center justify-between gap-3",
		children: [/* @__PURE__ */ (0, W.jsx)("span", { children: d("musicNotes.shortcutLabel") }), /* @__PURE__ */ (0, W.jsxs)("div", {
			className: "ml-auto flex flex-wrap items-center justify-end gap-2",
			children: [
				/* @__PURE__ */ (0, W.jsx)("button", {
					ref: c,
					type: "button",
					"data-music-notes-recorder": "",
					"data-folia-key-capture": r || void 0,
					"aria-label": d("musicNotes.shortcutLabel"),
					"aria-pressed": r,
					"aria-describedby": s,
					disabled: !n,
					className: `${gx} px-3 disabled:cursor-not-allowed disabled:opacity-40`,
					onClick: () => {
						i(!0), o(null);
					},
					onBlur: () => i(!1),
					onKeyDown: (e) => {
						if (!r || e.key === "Tab" || (e.preventDefault(), e.stopPropagation(), e.repeat || e.nativeEvent.isComposing || e.keyCode === 229)) return;
						if (e.key === "Escape") {
							i(!1);
							return;
						}
						let t = ["Delete", "Backspace"].includes(e.key) && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey;
						if ([
							"Control",
							"Alt",
							"Meta",
							"Shift"
						].includes(e.key)) return;
						let n = t ? "" : Mx(e.nativeEvent);
						n === null ? o("unsupported") : jx(n) ? o({ conflict: n }) : p(n);
					},
					children: /* @__PURE__ */ (0, W.jsx)("span", {
						id: s,
						"aria-live": "polite",
						children: r ? f : u ? u.split("+").join(" + ") : d("musicNotes.shortcutNone")
					})
				}),
				u && /* @__PURE__ */ (0, W.jsx)(hx, {
					variant: "quiet",
					icon: zc,
					tip: d("musicNotes.shortcutClear"),
					disabled: !n,
					onClick: () => p("")
				}),
				u !== Tx && /* @__PURE__ */ (0, W.jsx)(hx, {
					variant: "quiet",
					icon: kc,
					tip: d("musicNotes.shortcutReset"),
					disabled: !n,
					onClick: () => p(Tx)
				})
			]
		})]
	});
}
function Fx(e, t, n) {
	let r = e.registries.settingsSections.register({
		id: "shortcuts",
		label: Ox,
		settings: [{
			key: Dx,
			type: "boolean",
			label: kx,
			defaultValue: !0
		}, {
			key: Ex,
			type: "text",
			label: Ax,
			defaultValue: Tx
		}],
		settingsPanel(e, n) {
			let r = document.createElement("style");
			r.textContent = yx;
			let i = document.createElement("div");
			e.append(r, i);
			let a = (0, g.createRoot)(i), o = () => a.render(/* @__PURE__ */ (0, W.jsx)(Nx, {
				ctx: n,
				i18n: t
			})), s = n.onChange(o), c = n.settings.onChange(o);
			return o(), () => {
				s(), c(), a.unmount(), i.remove(), r.remove();
			};
		}
	}), i = (e) => {
		if (e.repeat || e.defaultPrevented || e.isComposing || e.keyCode === 229 || e.composedPath().some((e) => e instanceof HTMLElement && (e.isContentEditable || e.matches("input, textarea, select, dialog, [role=\"dialog\"], [role=\"menu\"], [role=\"textbox\"], [role=\"combobox\"], [data-music-notes-recorder]")))) return;
		let t = Mx(e);
		t && t === r.settings.get()[Ex] && !jx(t) && (e.preventDefault(), e.stopPropagation(), n());
	}, a = (t) => e.registries.commands.register({
		id: "open",
		globalShortcut: t,
		label: Ax,
		keywords: [
			"notes",
			"tags",
			"笔记",
			"备注",
			"标签"
		],
		run: n
	}), o = r.settings.get()[Dx] !== !1, s = a(o);
	o && window.addEventListener("keydown", i, !0);
	let c = r.settings.onChange(() => {
		let e = r.settings.get()[Dx] !== !1;
		e !== o && (o = e, s.unregister(), s = a(o), o ? window.addEventListener("keydown", i, !0) : window.removeEventListener("keydown", i, !0));
	});
	return () => {
		c(), window.removeEventListener("keydown", i, !0), s.unregister(), r.unregister();
	};
}
// src/kit/Chips.tsx
var Ix = ({ items: e, disabled: t }) => /* @__PURE__ */ (0, W.jsx)("div", {
	role: "group",
	...Qc(),
	"aria-disabled": t || void 0,
	className: `flex max-w-full flex-wrap justify-end gap-1.5${t ? " pointer-events-none opacity-40" : ""}`,
	children: e.map((e) => /* @__PURE__ */ (0, W.jsxs)("button", {
		type: "button",
		role: "checkbox",
		"aria-checked": e.checked,
		disabled: t || e.disabled,
		"data-settings-row": e.id,
		onClick: () => e.onChange(!e.checked),
		className: `st-t-fast inline-flex h-8 items-center gap-2 rounded-lg bg-[var(--st-fill)] pl-2 pr-3 text-[13px] transition-[background-color,color,scale] hover:bg-[var(--st-fill2)] active:scale-[0.97] ${e.checked ? "text-[color:var(--st-t1)]" : "text-[color:var(--st-t2)]"}${e.disabled && !t ? " pointer-events-none opacity-40" : ""}`,
		children: [/* @__PURE__ */ (0, W.jsx)("span", {
			className: `st-t-fast grid h-4 w-4 place-items-center rounded-[5px] transition-[background-color,box-shadow] ${e.checked ? "bg-[var(--st-accent)] text-[color:var(--st-on-accent)]" : "shadow-[inset_0_0_0_1.5px_var(--st-t3)]"}`,
			children: /* @__PURE__ */ (0, W.jsx)(pc, {
				size: 12,
				strokeWidth: 3,
				className: `st-t-move transition-[opacity,scale] ${e.checked ? "" : "scale-50 opacity-0"}`
			})
		}), e.label]
	}, e.id))
}), Lx = "st-card overflow-hidden rounded-xl bg-[var(--st-card)] shadow-[0_0_0_1px_var(--st-line)]", Rx = {
	ok: "bg-[var(--st-ok)]",
	warn: "bg-[var(--st-warn)]",
	error: "bg-[var(--st-err)]"
}, zx = ({ tone: e, children: t }) => /* @__PURE__ */ (0, W.jsxs)("span", {
	role: "status",
	className: "inline-flex min-w-0 items-start gap-1.5 text-xs leading-[18px] text-[color:var(--st-t2)]",
	children: [/* @__PURE__ */ (0, W.jsx)("span", {
		"aria-hidden": !0,
		className: `st-t-fast mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${e ? Rx[e] : "bg-[var(--st-t3)]"}`
	}), /* @__PURE__ */ (0, W.jsx)("span", {
		className: "min-w-0",
		children: t
	})]
}), Bx = [
	"cx",
	"cy",
	"len",
	"ang",
	"bend",
	"w",
	"o"
], Vx = 4, Hx = (e) => e * 180 / Math.PI, Ux = (e) => e * Math.PI / 180, Wx = (e, t, n, r, i) => ({
	cx: (e + n) / 2,
	cy: (t + r) / 2,
	len: Math.hypot(n - e, r - t),
	ang: Hx(Math.atan2(r - t, n - e)),
	bend: 0,
	w: i,
	o: 1
});
function Gx(e, t) {
	switch (e) {
		case "bars": return [
			4.5,
			9.5,
			14.5,
			19.5
		].map((e) => Wx(e, 6, e, 18, t));
		case "success": return [
			Wx(5, 12.5, 7.6, 15.1, t),
			Wx(7.6, 15.1, 10.2, 17.7, t),
			Wx(10.2, 17.7, 14.6, 12.6, t),
			Wx(14.6, 12.6, 19, 7.5, t)
		];
		case "error": return [
			Wx(6.5, 6.5, 12, 12, t),
			Wx(12, 12, 17.5, 17.5, t),
			Wx(17.5, 6.5, 12, 12, t),
			Wx(12, 12, 6.5, 17.5, t)
		];
	}
}
function Kx(e) {
	let t = Math.max(e.len, .01) / 2, n = Ux(e.ang), r = Math.cos(n) * t, i = Math.sin(n) * t, a = (e.cx - r).toFixed(3), o = (e.cy - i).toFixed(3), s = (e.cx + r).toFixed(3), c = (e.cy + i).toFixed(3);
	if (Math.abs(e.bend) < .004) return `M${a} ${o}L${s} ${c}`;
	let l = (1 / Math.abs(e.bend)).toFixed(3);
	return `M${a} ${o}A${l} ${l} 0 0 ${+(e.bend > 0)} ${s} ${c}`;
}
function qx(e, t, n) {
	let r = n ? 180 : 360;
	return t + Math.round((e - t) / r) * r;
}
var Jx = (e, t) => {
	let n = 2 * Math.PI / (e * 1.2);
	return {
		type: "spring",
		stiffness: n * n,
		damping: 2 * (1 - t) * n,
		mass: 1,
		restDelta: .001,
		restSpeed: .01
	};
}, Yx = Jx(.46, 0), Xx = Jx(.52, 0);
function Zx({ values: e, wave: t }) {
	let n = Tb(() => {
		let n = t.get(), r = {};
		for (let t of Bx) r[t] = e[t].get() + (n[t] ?? 0);
		return Kx(r);
	}), r = Tb(() => Math.max(0, e.w.get() + (t.get().w ?? 0))), i = Tb(() => Math.min(1, Math.max(0, e.o.get())));
	return /* @__PURE__ */ (0, W.jsx)(xb.path, {
		d: n,
		strokeWidth: r,
		opacity: i
	});
}
function Qx({ status: e = "loading", size: t = 32, strokeWidth: n = 2.5, className: r }) {
	let i = Vc("uiMicroMotion"), a = e === "loading" ? "bars" : e, [o] = (0, j.useState)(() => Gx(a, n).map((e) => Object.fromEntries(Bx.map((t) => [t, gp(e[t])])))), [s] = (0, j.useState)(() => Array.from({ length: Vx }, () => gp({}))), c = Sb(+(e === "loading")), l = Sb(1), u = (0, j.useRef)(0), d = (0, j.useRef)(a);
	(0, j.useLayoutEffect)(() => {
		d.current = a;
	}, [a]), (0, j.useEffect)(() => {
		let e = Gx(a, n), t = [], r = a === "success" || a === "error";
		if (e.forEach((e, n) => {
			let a = o[n];
			Bx.forEach((o) => {
				let s = a[o], c = e[o];
				if (o === "ang" && (c = qx(s.get(), c, e.bend === 0 && a.bend.get() < .004)), i) {
					s.set(c);
					return;
				}
				let l = r ? n * .035 : 0;
				t.push(Zb(s, c, {
					...r ? Xx : Yx,
					delay: l
				}));
			});
		}), i) c.set(+!r), s.forEach((e) => e.set({})), l.set(1);
		else return t.push(Zb(c, +!r, r ? {
			duration: .2,
			ease: [
				.2,
				.8,
				.2,
				1
			]
		} : {
			duration: .3,
			ease: [
				.2,
				.8,
				.2,
				1
			]
		})), r && t.push(Zb(l, [
			1,
			1.14,
			1
		], {
			duration: .42,
			times: [
				0,
				.35,
				1
			],
			ease: ["easeOut", "easeInOut"]
		})), () => {
			t.forEach((e) => e.stop());
		};
	}, [
		a,
		n,
		i,
		c,
		l,
		o,
		s
	]), Ob((e, t) => {
		if (i) return;
		let n = d.current !== "success" && d.current !== "error", r = c.get();
		if (!n && r < .001) return;
		let a = Math.min(t, 64) / 1e3;
		u.current += a * (n ? 1 : r);
		let o = u.current, l = d.current, f = [
			{},
			{},
			{},
			{}
		];
		if (l === "bars") for (let e = 0; e < Vx; e += 1) {
			let t = .5 + .5 * Math.sin(o / .95 * Math.PI * 2 - e * .7);
			f[e] = { len: -7.5 * (1 - t) * r };
		}
		s.forEach((e, t) => e.set(f[t]));
	});
	let f = Tb(() => `scale(${l.get().toFixed(4)})`);
	return /* @__PURE__ */ (0, W.jsx)("span", {
		className: `inline-flex shrink-0 items-center justify-center ${r ?? ""}`,
		"data-status": e,
		style: {
			width: t,
			height: t
		},
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, W.jsx)("svg", {
			className: "block",
			viewBox: "0 0 24 24",
			width: t,
			height: t,
			fill: "none",
			stroke: "currentColor",
			strokeLinecap: "round",
			"aria-hidden": "true",
			focusable: "false",
			children: /* @__PURE__ */ (0, W.jsx)(xb.g, {
				style: {
					transform: f,
					transformOrigin: "12px 12px",
					transformBox: "view-box"
				},
				children: o.map((e, t) => /* @__PURE__ */ (0, W.jsx)(Zx, {
					values: e,
					wave: s[t]
				}, t))
			})
		})
	});
}
// src/kit/sheetKeys.ts
var $x = m(), eS = ({ taken: e, held: t, composing: n, popupOpen: r, closeDisabled: i }) => !e && !t && !n && !r && !i, tS = (e, t, n) => e === 0 ? null : t < 0 ? n ? e - 1 : 0 : n ? t === 0 ? e - 1 : null : t === e - 1 ? 0 : null, nS = {
	s: "w-[400px]",
	m: "w-[600px]",
	l: "h-[720px] w-[880px]",
	xl: "h-[720px] w-[1160px]",
	side: "min-h-[min(420px,100%)] w-[772px]"
}, rS = {
	scroll: "st-scroll overflow-y-auto overscroll-contain",
	fill: "flex flex-col overflow-hidden",
	panes: "flex overflow-hidden"
}, iS = "a[href], button, input, select, textarea, [tabindex]", aS = (e) => Array.from(e.querySelectorAll(iS)).filter((e) => e.tabIndex >= 0 && !e.hasAttribute("disabled") && !e.closest("[inert]") && e.getClientRects().length > 0), oS = (0, j.createContext)(void 0), sS = [], cS = (e, t, n) => ({
	"--text-primary": "var(--sheet-ink)",
	...ax(e, t),
	...Kc(n)
}), lS = (e) => ({
	"--sheet-scrim": "var(--st-track)",
	"--sheet-ink": e?.primaryColor ?? "var(--folium-text)"
}), uS = (e, t) => e ? /* @__PURE__ */ (0, W.jsxs)("div", {
	className: "relative flex min-h-0 flex-1",
	children: [e, /* @__PURE__ */ (0, W.jsx)("div", {
		className: "flex min-w-0 flex-1 flex-col",
		children: t
	})]
}) : t, dS = ({ onClose: e, size: t = "m", title: n, subtitle: r, headerActions: i, children: a, footer: o, footerNote: s, body: c = "scroll", isDaylight: l, closeDisabled: u = !1, closeDisabledTip: d, closeTip: f, titleLead: p, aside: m, underlay: h, restHeight: g, overlay: _, quiet: v = !1, leave: y, from: b, ponderId: x }) => {
	let { t: S } = Ht(), C = sx(), w = l ?? C.isDaylight, T = C.theme, E = qc(), D = Tv(), ee = (0, j.useId)(), te = (0, j.useRef)(null), ne = (0, j.useRef)(!1), re = (0, j.useContext)(oS)?.getRootNode(), [ie] = (0, j.useState)(() => re?.activeElement instanceof HTMLElement ? re.activeElement : null), ae = (0, j.useMemo)(() => ({
		isDaylight: w,
		theme: T
	}), [w, T]), oe = () => {
		u || e();
	}, O = (0, j.useRef)(oe);
	O.current = oe;
	let se = (0, j.useRef)(u);
	se.current = u, (0, j.useEffect)(() => {
		let e = te.current;
		if (!D || !e) return;
		let t = Symbol("sheet");
		sS.push(t), e.contains(re?.activeElement ?? null) || (e.querySelector("[data-autofocus]") ?? e).focus({ preventScroll: !0 });
		let n = (n) => {
			if (sS[sS.length - 1] !== t) return;
			let r = (n.ctrlKey || n.metaKey) && !n.altKey && !n.shiftKey && n.key.toLowerCase() === "k";
			if (n.key === "F6" || r) n.preventDefault(), n.stopPropagation();
			else if (n.key === "Escape") n.stopPropagation(), eS({
				taken: n.defaultPrevented,
				held: n.repeat,
				composing: n.isComposing,
				popupOpen: e.querySelector("[aria-haspopup][aria-expanded=\"true\"]") !== null,
				closeDisabled: se.current
			}) && (n.preventDefault(), O.current());
			else if (n.key === "Tab") {
				let t = re?.activeElement?.closest("[data-folia-keyboard-window=\"true\"]");
				if (t && !t.contains(e)) return;
				let r = aS(e), i = tS(r.length, r.indexOf(re?.activeElement), n.shiftKey);
				(r.length === 0 || i !== null) && (n.preventDefault(), (i === null ? e : r[i]).focus());
			}
		};
		return e.addEventListener("keydown", n), () => {
			e.removeEventListener("keydown", n), sS.splice(sS.indexOf(t), 1);
			let r = re?.activeElement;
			ie?.isConnected && (!r || r === document.body || e.contains(r)) && ie.focus({ preventScroll: !0 });
		};
	}, [
		D,
		ie,
		re
	]);
	let ce = {
		opacity: 0,
		x: 0,
		y: 12,
		scale: .985
	}, [le] = (0, j.useState)(() => b ? {
		opacity: 0,
		x: b.x,
		y: b.y,
		scale: .9
	} : ce), ue = y === "through" ? {
		opacity: 0,
		scale: 1.08,
		transition: {
			duration: E ? 0 : Hc.unfold,
			ease: Uc.standard
		}
	} : {
		...ce,
		transition: Jc("move", E)
	};
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		"data-folia-keyboard-window": D ? "true" : void 0,
		"data-folia-sheet": D ? "true" : void 0,
		inert: !D,
		className: `fixed inset-0 z-[200] flex justify-center p-4 ${g ? "items-start" : "items-center"}`,
		style: g ? {
			...lS(T),
			paddingTop: `max(16px, calc(50vh - ${g / 2}px))`
		} : lS(T),
		onMouseDown: (e) => {
			ne.current = e.target === e.currentTarget;
		},
		onClick: (e) => {
			e.target === e.currentTarget && ne.current && oe();
		},
		children: [/* @__PURE__ */ (0, W.jsx)(xb.div, {
			"aria-hidden": !0,
			initial: { opacity: 0 },
			animate: { opacity: 1 },
			exit: { opacity: 0 },
			transition: Jc("move", E),
			className: "pointer-events-none absolute inset-0 bg-[var(--sheet-scrim)]"
		}), /* @__PURE__ */ (0, W.jsx)(xb.div, {
			ref: te,
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": ee,
			"data-ponder": x,
			tabIndex: -1,
			initial: le,
			animate: {
				opacity: 1,
				x: 0,
				y: 0,
				scale: 1,
				transition: Jc("unfold", E)
			},
			exit: ue,
			className: `st-window relative flex max-h-[min(720px,100%)] max-w-full flex-col overflow-hidden rounded-2xl bg-[var(--st-win)] text-[color:var(--st-t1)] shadow-2xl ring-1 ring-[var(--st-line2)] ${nS[t]}${h ? " isolate" : ""}`,
			style: {
				outline: "none",
				...cS(w, T, E)
			},
			children: /* @__PURE__ */ (0, W.jsxs)(ox.Provider, {
				value: ae,
				children: [
					h && /* @__PURE__ */ (0, W.jsx)("div", {
						"aria-hidden": !0,
						className: "pointer-events-none absolute inset-0 -z-10",
						children: h
					}),
					_ && /* @__PURE__ */ (0, W.jsx)("div", {
						"aria-hidden": !0,
						className: "pointer-events-none absolute inset-0 z-10",
						children: _
					}),
					uS(m, /* @__PURE__ */ (0, W.jsxs)(W.Fragment, { children: [
						/* @__PURE__ */ (0, W.jsxs)("header", {
							className: `flex shrink-0 items-start gap-3 pl-6 pr-4 pt-4 ${c === "panes" ? "border-b border-[var(--st-line)] pb-3" : ""}`,
							children: [
								/* @__PURE__ */ (0, W.jsxs)("div", {
									className: `st-t-fast min-w-0 flex-1 transition-opacity ${v ? "opacity-0" : ""}`,
									children: [/* @__PURE__ */ (0, W.jsxs)("h2", {
										id: ee,
										className: `text-base font-semibold leading-8 ${p ? "flex items-center gap-2.5" : ""}`,
										children: [p, p ? /* @__PURE__ */ (0, W.jsx)("span", {
											className: "min-w-0 truncate",
											children: n
										}) : n]
									}), r && /* @__PURE__ */ (0, W.jsx)("p", {
										className: "-mt-0.5 text-xs leading-[18px] text-[color:var(--st-t2)]",
										children: r
									})]
								}),
								i && /* @__PURE__ */ (0, W.jsx)("div", {
									className: "flex min-h-8 shrink-0 items-center gap-2",
									children: i
								}),
								/* @__PURE__ */ (0, W.jsx)(ux, {
									text: u ? d : f,
									className: `inline-flex shrink-0 ${_ ? "relative z-20" : ""}`,
									children: /* @__PURE__ */ (0, W.jsx)("button", {
										type: "button",
										onClick: oe,
										"aria-label": S("musicNotes.close"),
										"aria-disabled": u || void 0,
										className: `st-t-fast grid h-8 w-8 place-items-center rounded-lg text-[color:var(--st-t2)] transition-[background-color,color,opacity] ${u ? "cursor-not-allowed opacity-40" : "hover:bg-[var(--st-fill)] hover:text-[color:var(--st-t1)]"}`,
										children: /* @__PURE__ */ (0, W.jsx)(zc, { size: 16 })
									})
								})
							]
						}),
						/* @__PURE__ */ (0, W.jsx)("div", {
							className: `min-h-0 flex-1 ${rS[c]} ${c === "panes" ? "" : `px-6 ${t === "s" ? "pb-4 pt-1" : "pb-5 pt-3"}`}`,
							children: a
						}),
						(o || s) && /* @__PURE__ */ (0, W.jsxs)("footer", {
							className: `flex shrink-0 flex-wrap items-center justify-end gap-2 px-4 ${t === "s" ? "pb-4 pt-1" : "border-t border-[var(--st-line)] py-3"}`,
							children: [s && /* @__PURE__ */ (0, W.jsx)("div", {
								className: "mr-auto min-w-0 flex-1 text-xs leading-[18px] text-[color:var(--st-t2)]",
								children: s
							}), o]
						})
					] }))
				]
			})
		})]
	});
}, fS = ({ isOpen: e, ...t }) => {
	let n = (0, j.useContext)(oS);
	return n ? (0, $x.createPortal)(/* @__PURE__ */ (0, W.jsx)(kv, { children: e && /* @__PURE__ */ (0, W.jsx)(dS, { ...t }) }), n) : null;
}, pS = "st-t-fast inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm transition-[background-color,color,opacity,scale] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40", mS = {
	fill: "bg-[var(--st-fill)] text-[color:var(--st-t1)] enabled:hover:bg-[var(--st-fill2)]",
	primary: "bg-[var(--st-accent)] text-[color:var(--st-on-accent)] enabled:hover:opacity-90",
	danger: "bg-[var(--st-err)] font-bold text-white enabled:hover:opacity-90"
}, hS = ({ variant: e, ...t }) => /* @__PURE__ */ (0, W.jsx)("button", {
	type: "button",
	...t,
	className: `${pS} ${mS[e ?? "fill"]}`
});
// src/ui/MusicNotesImport.tsx
function gS({ port: e, disabled: t, onImport: n }) {
	let { t: r } = Ht(), i = e.accounts(), [a, o] = (0, j.useState)(null), [s, c] = (0, j.useState)([]), [l, u] = (0, j.useState)(null), [d, f] = (0, j.useState)(""), [p, m] = (0, j.useState)(30), [h, g] = (0, j.useState)(!1), [_, v] = (0, j.useState)(!1), y = (0, j.useRef)(null), b = (0, j.useRef)(null);
	(0, j.useEffect)(() => () => y.current?.abort(), []);
	let x = a && i.find((e) => e.source === a.source && e.id === a.id), S = () => {
		y.current?.abort(), o(null), c([]), u(null), g(!1), v(!1);
	};
	(0, j.useEffect)(() => {
		a && !x && S();
	}, [a, x?.id]);
	let C = async (t) => {
		y.current?.abort();
		let n = new AbortController();
		y.current = n, o(t), u(null), c([]), g(!0), v(!1), m(30), f("");
		try {
			let r = await e.playlists(t.source, n.signal);
			n.signal.aborted || c(r);
		} catch (e) {
			n.signal.aborted || (console.warn("[MusicNotes] playlist read failed", e), v(!0));
		} finally {
			n.signal.aborted || g(!1);
		}
	}, w = d.trim().toLocaleLowerCase(), T = x ? s.filter((e) => e.accountId === x.id && e.source === x.source && e.name.toLocaleLowerCase().includes(w)) : [], E = T.slice(0, p), D = l && E.includes(l) ? l : null, ee = t ? r("musicNotes.importing") : x && h ? r("musicNotes.loading") : null, te = !(!x || h || _);
	return /* @__PURE__ */ (0, W.jsxs)("section", {
		"data-music-notes": "import",
		className: "flex min-h-0 flex-col items-start gap-3",
		children: [
			i.length ? /* @__PURE__ */ (0, W.jsx)("div", {
				className: "max-w-full shrink-0",
				children: /* @__PURE__ */ (0, W.jsx)(Ix, {
					disabled: t,
					items: i.map((e) => ({
						id: `${e.source}:${e.id}`,
						label: e.name,
						checked: x?.source === e.source && x.id === e.id,
						onChange: (t) => {
							t ? C(e) : S();
						}
					}))
				})
			}) : /* @__PURE__ */ (0, W.jsx)(zx, { children: r("musicNotes.loginHint") }),
			x && _ && /* @__PURE__ */ (0, W.jsx)(hx, {
				onClick: () => void C(x),
				children: r("musicNotes.retry")
			}),
			te && /* @__PURE__ */ (0, W.jsxs)(W.Fragment, { children: [/* @__PURE__ */ (0, W.jsx)("div", {
				className: "max-w-full shrink-0",
				children: /* @__PURE__ */ (0, W.jsx)(vx, {
					value: d,
					disabled: t,
					onChange: (e) => {
						f(e), m(30), b.current && (b.current.scrollTop = 0);
					},
					placeholder: r("musicNotes.playlistSearchHint")
				})
			}), /* @__PURE__ */ (0, W.jsxs)("div", {
				ref: b,
				className: "st-scroll max-h-96 min-h-0 w-full overflow-y-auto overscroll-contain",
				role: "group",
				"aria-label": r("musicNotes.playlist"),
				"aria-busy": t,
				children: [E.map((e) => /* @__PURE__ */ (0, W.jsx)("button", {
					type: "button",
					disabled: t,
					"aria-pressed": D === e,
					onClick: () => u((t) => t === e ? null : e),
					className: "block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--st-fill)] aria-pressed:bg-[var(--st-fill2)]",
					children: e.name
				}, e.id)), !T.length && /* @__PURE__ */ (0, W.jsx)(zx, { children: r("musicNotes.noPlaylists") })]
			})] }),
			(te || ee) && /* @__PURE__ */ (0, W.jsxs)("div", {
				className: "flex w-full shrink-0 flex-wrap items-center justify-end gap-2",
				children: [ee && /* @__PURE__ */ (0, W.jsxs)("span", {
					role: "status",
					className: "mr-auto inline-flex items-center gap-2 text-sm text-[color:var(--st-t2)]",
					children: [/* @__PURE__ */ (0, W.jsx)(Qx, { size: 20 }), ee]
				}), te && /* @__PURE__ */ (0, W.jsxs)(W.Fragment, { children: [T.length > p && /* @__PURE__ */ (0, W.jsx)(hx, {
					disabled: t,
					onClick: () => m((e) => e + 30),
					children: r("musicNotes.showMore")
				}), /* @__PURE__ */ (0, W.jsx)(hx, {
					disabled: t || !D,
					icon: _c,
					onClick: () => {
						D && n(D);
					},
					children: r("musicNotes.import")
				})] })]
			})
		]
	});
}
// src/ui/NotebookActions.tsx
function _S({ open: e, title: t, onClose: n, busy: r, footer: i, fill: a, children: o }) {
	let [s, c] = (0, j.useState)(null);
	return /* @__PURE__ */ (0, W.jsxs)(W.Fragment, { children: [/* @__PURE__ */ (0, W.jsx)("div", {
		ref: c,
		className: "contents"
	}), /* @__PURE__ */ (0, W.jsx)(oS.Provider, {
		value: s,
		children: /* @__PURE__ */ (0, W.jsx)(fS, {
			isOpen: e,
			onClose: n,
			title: t,
			size: i ? "s" : "m",
			body: a ? "fill" : "scroll",
			closeDisabled: r,
			footer: i,
			children: o
		})
	})] });
}
function vS({ notebook: e, port: t, notify: n, importRequest: r }) {
	let { t: i } = Ht(), [a, o] = (0, j.useState)(!1), [s, c] = (0, j.useState)(!1), l = (0, j.useRef)(null), u = (0, j.useRef)(null), d = (0, j.useRef)(r), f = (0, j.useRef)(null), p = (0, j.useRef)(null), m = (0, j.useRef)(null);
	(0, j.useEffect)(() => {
		if (d.current !== r) {
			d.current = r;
			let e = l.current?.getRootNode()?.activeElement;
			u.current = e instanceof HTMLElement ? e : l.current, o(!0);
		}
	}, [r]), (0, j.useEffect)(() => () => m.current?.abort(), []);
	let h = () => {
		u.current = l.current, o(!0);
	}, g = () => {
		o(!1), requestAnimationFrame(() => {
			let e = u.current;
			(e?.isConnected ? e : l.current)?.focus({ preventScroll: !0 });
		});
	}, _ = async (e) => {
		if (m.current) return;
		let t = new AbortController();
		m.current = t, c(!0);
		try {
			await e(t.signal);
		} catch (e) {
			t.signal.aborted || (console.warn("[MusicNotes] library operation failed", e), n(i(e instanceof qt ? "musicNotes.capacity" : "musicNotes.failed")));
		} finally {
			m.current = null, t.signal.aborted || c(!1);
		}
	};
	return /* @__PURE__ */ (0, W.jsxs)(W.Fragment, { children: [
		/* @__PURE__ */ (0, W.jsxs)("div", {
			className: "flex shrink-0 items-center gap-1",
			children: [
				/* @__PURE__ */ (0, W.jsx)(hx, {
					buttonRef: l,
					variant: "quiet",
					icon: xc,
					tip: i("musicNotes.importPlaylist"),
					disabled: s,
					onClick: h
				}),
				/* @__PURE__ */ (0, W.jsx)(hx, {
					variant: "quiet",
					icon: _c,
					tip: i("musicNotes.restore"),
					"aria-disabled": s,
					onClick: () => {
						m.current || f.current?.click();
					}
				}),
				/* @__PURE__ */ (0, W.jsx)(hx, {
					variant: "quiet",
					icon: Lc,
					tip: i("musicNotes.export"),
					"aria-disabled": s,
					onClick: () => void _(async (t) => {
						let r = await e.exportBackup();
						if (t.aborted || !p.current) return;
						let a = URL.createObjectURL(new Blob([r], { type: "application/json" }));
						try {
							p.current.href = a, p.current.download = `folia-music-notes-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, p.current.click();
						} finally {
							setTimeout(() => URL.revokeObjectURL(a), 1e3);
						}
						n(i("musicNotes.exported"));
					})
				})
			]
		}),
		/* @__PURE__ */ (0, W.jsx)(_S, {
			open: a,
			title: i("musicNotes.importPlaylist"),
			onClose: g,
			busy: s,
			fill: !0,
			children: /* @__PURE__ */ (0, W.jsx)(gS, {
				port: t,
				disabled: s,
				onImport: (r) => _(async (a) => {
					document.visibilityState === "visible" && await new Promise((e) => {
						let t = () => {
							cancelAnimationFrame(n), window.clearTimeout(r), a.removeEventListener("abort", t), e();
						}, n = requestAnimationFrame(() => {
							window.clearTimeout(r), r = window.setTimeout(t, 0);
						}), r = window.setTimeout(t, 80);
						a.addEventListener("abort", t, { once: !0 });
					}), a.throwIfAborted();
					let o = await t.readPlaylist(r, a);
					a.throwIfAborted();
					let s = await e.importSongs(o);
					a.aborted || (n(i("musicNotes.imported", { ...s })), g());
				})
			})
		}),
		/* @__PURE__ */ (0, W.jsx)("input", {
			type: "file",
			hidden: !0,
			ref: f,
			accept: "application/json,.json",
			"aria-label": i("musicNotes.restore"),
			onChange: (t) => {
				let r = t.currentTarget.files?.[0];
				t.currentTarget.value = "", r && _(async (t) => {
					if (r.size > Wt.backupCharacters * 4) throw new qt();
					let a = await r.text();
					t.throwIfAborted();
					let o = await e.importBackup(a);
					t.aborted || n(i("musicNotes.imported", { ...o }));
				});
			}
		}),
		/* @__PURE__ */ (0, W.jsx)("a", {
			hidden: !0,
			ref: p
		})
	] });
}
function yS({ song: e, revision: t, notebook: n, notify: r }) {
	let { t: i } = Ht(), [a, o] = (0, j.useState)(null), s = a !== null, [c, l] = (0, j.useState)(!1), u = async () => {
		if (!(c || a === null)) {
			o(null), l(!0);
			try {
				await n.remove(e, a);
			} catch (e) {
				console.warn("[MusicNotes] delete failed", e), r(i(e instanceof Kt ? "musicNotes.deleteConflict" : "musicNotes.failed"));
			} finally {
				l(!1);
			}
		}
	};
	return /* @__PURE__ */ (0, W.jsx)("span", {
		className: "inline-grid",
		"data-confirming": s || void 0,
		onBlur: () => o(null),
		onKeyDown: (e) => {
			e.repeat && (e.key === "Enter" || e.key === " ") && e.preventDefault(), s && e.key === "Escape" && !e.nativeEvent.isComposing && e.keyCode !== 229 && (e.preventDefault(), e.stopPropagation(), o(null));
		},
		children: /* @__PURE__ */ (0, W.jsx)(hx, {
			variant: "dangerOutline",
			icon: Fc,
			tip: s ? void 0 : i("musicNotes.remove"),
			disabled: c,
			onClick: () => {
				s ? u() : o(t);
			},
			children: s ? i("musicNotes.confirmRemoveInline") : void 0
		})
	});
}
// src/ui/SortableGroup.tsx
var bS = "[data-sort-key][draggable=\"true\"]";
function xS(e) {
	let t = e.closest(".st-scroll");
	if (!t) return;
	let n = (e) => {
		let t = 0;
		for (let n = e; n; n = n.offsetParent) t += n.offsetTop;
		return t;
	}, r = n(e) - n(t) - t.clientTop, i = r + e.offsetHeight;
	r < t.scrollTop ? t.scrollTop = r : i > t.scrollTop + t.clientHeight && (t.scrollTop = i - t.clientHeight);
}
function SS({ ref: e, axis: t, order: n, children: r }) {
	let i = Tv();
	return /* @__PURE__ */ (0, W.jsx)(xb.div, {
		ref: e,
		inert: !i,
		"aria-hidden": !i || void 0,
		className: t === "vertical" ? "min-w-0" : "inline-flex min-w-0 max-w-full shrink-0",
		layout: "position",
		layoutDependency: n,
		initial: { opacity: 0 },
		animate: { opacity: 1 },
		exit: { opacity: 0 },
		transition: {
			...Jc("fast", !1),
			layout: Jc("move", !1)
		},
		children: r
	});
}
function CS(e, t) {
	let { currentTarget: n, clientX: r, clientY: i } = e, a = e.target instanceof Element ? e.target : null, o = a?.closest(bS) ?? null;
	if (a?.closest("[inert]")) return null;
	if (!o) {
		if (a?.closest("button, input, [data-sort-fixed]")) return null;
		let e = Infinity, t = Infinity;
		for (let a of n.querySelectorAll(bS)) {
			if (a.closest("[inert]")) continue;
			let n = a.getBoundingClientRect(), s = Math.max(n.top - i, i - n.bottom, 0), c = Math.max(n.left - r, r - n.right, 0);
			(s < e || s === e && c < t) && (o = a, e = s, t = c);
		}
	}
	if (!o) return null;
	let s = o.getBoundingClientRect(), c = t === "vertical" ? i < s.top + s.height / 2 : r < s.left + s.width / 2;
	return {
		node: o,
		side: c ? "before" : "after"
	};
}
function wS({ axis: e, move: t, className: n, label: r, before: i, after: a, children: o }) {
	let s = qc(), c = (0, j.useRef)(null), l = (0, j.useRef)(null), u = (0, j.useRef)(null), d = (0, j.useRef)(null), f = (0, j.useRef)(0), p = (0, j.useRef)(!1), [m, h] = (0, j.useState)(), g = JSON.stringify(o.map((e) => e.key)), _ = (e) => {
		(e?.node !== u.current?.node || e?.side !== u.current?.side) && (u.current?.node.removeAttribute("data-insert"), e && (e.node.dataset.insert = e.side), u.current = e);
	}, v = () => {
		l.current && (l.current.removeAttribute("data-dragging"), f.current = performance.now() + 350), l.current = null, _(null);
	};
	(0, j.useLayoutEffect)(() => {
		let e = c.current?.getRootNode();
		return e instanceof ShadowRoot && h(e), window.addEventListener("blur", v), () => {
			window.removeEventListener("blur", v), v();
		};
	}, []), (0, j.useLayoutEffect)(() => {
		l.current && (!l.current.matches(bS) || l.current.closest("[inert]") || !c.current?.contains(l.current)) && v();
		let e = d.current;
		if (!e || !c.current?.contains(e)) {
			d.current = null;
			return;
		}
		let t = e.getRootNode(), n = e.ownerDocument.activeElement;
		for (; n?.shadowRoot?.activeElement;) n = n.shadowRoot.activeElement;
		(!n || n === e.ownerDocument.body || t instanceof ShadowRoot && n === t.host) && e.focus({ preventScroll: !0 }), t.activeElement === e && xS(e), d.current = null;
	}, [g]);
	let y = (t) => {
		if (!l.current?.matches(bS) || l.current.closest("[inert]") || !t.currentTarget.contains(l.current)) return null;
		let n = CS(t, e);
		return n && n.node !== l.current ? n : null;
	};
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		ref: c,
		role: r ? "group" : void 0,
		"aria-label": r,
		"data-sort-axis": e,
		className: n,
		onPointerDownCapture: (e) => {
			f.current = 0, d.current = null, p.current = e.target instanceof Element && !!e.target.closest("[data-sort-fixed]");
		},
		onClickCapture: (e) => {
			performance.now() < f.current && (e.preventDefault(), e.stopPropagation());
		},
		onBlurCapture: (e) => {
			e.relatedTarget && e.target === d.current && (d.current = null);
		},
		onKeyDown: (e) => {
			e.key === "Escape" && l.current ? (e.preventDefault(), e.stopPropagation(), v()) : f.current = 0;
		},
		onDragStart: (e) => {
			let t = e.target instanceof Element ? e.target.closest(bS) : null;
			!t || p.current || t.closest("[inert]") ? e.preventDefault() : (l.current = t, t.dataset.dragging = "", e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("application/x-folia-music-notes-sort", t.dataset.sortKey));
		},
		onDragOver: (e) => {
			if (!l.current) return;
			let t = y(e);
			t && (e.preventDefault(), e.dataTransfer.dropEffect = "move"), _(t);
		},
		onDragLeave: (e) => {
			e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget) || _(null);
		},
		onDrop: (e) => {
			if (!l.current) return;
			e.preventDefault(), e.stopPropagation();
			let n = l.current.dataset.sortKey, r = y(e), i = e.currentTarget.getRootNode().activeElement;
			v(), r && (i instanceof HTMLElement && e.currentTarget.contains(i) && (d.current = i), t(n, r.node.dataset.sortKey, r.side));
		},
		onDragEnd: v,
		children: [
			i,
			s ? o : /* @__PURE__ */ (0, W.jsx)(kv, {
				initial: !1,
				mode: "popLayout",
				root: m,
				children: o.map((t) => /* @__PURE__ */ (0, W.jsx)(SS, {
					axis: e,
					order: g,
					children: t
				}, t.key))
			}),
			a
		]
	});
}
// src/ui/NoteTags.tsx
var TS = "st-t-fast inline-flex h-8 min-w-0 shrink-0 items-center justify-center rounded-lg text-sm transition-colors hover:bg-[var(--st-fill2)]";
function ES({ tags: e, options: t, change: n, notify: r, moveTag: i }) {
	let { t: a } = Ht(), [o, s] = (0, j.useState)(!1), [c, l] = (0, j.useState)(""), [u, d] = (0, j.useState)(-1), f = (0, j.useId)(), p = (0, j.useRef)(null), m = (0, j.useMemo)(() => new Map(e.map((e) => [Xt(e), e])), [e]), h = (0, j.useMemo)(() => {
		let e = new Map(m), n = [];
		for (let r of t) {
			if (!e.size) break;
			let t = Xt(r), i = e.get(t);
			i !== void 0 && (n.push(i), e.delete(t));
		}
		return n.concat([...e.values()]);
	}, [t, m]), g = Xt(Zt(c).at(-1) ?? ""), _ = (0, j.useMemo)(() => {
		let e = [];
		if (!o) return e;
		for (let n of t) {
			let t = Xt(n);
			if (!m.has(t) && t.includes(g) && e.push(n), e.length === 8) break;
		}
		return e;
	}, [
		t,
		m,
		g,
		o
	]), v = Wt, y = (e) => {
		s(!1), l(""), d(-1), e && requestAnimationFrame(() => p.current?.querySelector("button")?.focus());
	}, b = (t, i = !0) => {
		let o = Zt(c);
		t && o.splice(-1, 1, t);
		let s = N([...e, ...o]);
		s.length > v.tags || s.some((e) => e.length > v.tag) ? r(a("musicNotes.tagLimit", {
			tags: v.tags,
			length: v.tag
		})) : (s.length > e.length && n((e) => N([...e, ...o])), y(i));
	}, x = /* @__PURE__ */ (0, W.jsx)("span", {
		ref: p,
		"data-sort-fixed": "",
		className: "relative inline-flex min-w-0",
		children: o ? /* @__PURE__ */ (0, W.jsxs)(W.Fragment, { children: [/* @__PURE__ */ (0, W.jsx)("input", {
			autoFocus: !0,
			role: "combobox",
			"aria-label": a("musicNotes.tags"),
			"aria-expanded": _.length > 0,
			"aria-autocomplete": "list",
			"aria-controls": _.length ? f : void 0,
			"aria-activedescendant": u >= 0 && _[u] ? `${f}-${u}` : void 0,
			className: `${gx} w-40 px-2.5`,
			value: c,
			onChange: (e) => {
				l(e.currentTarget.value), d(-1);
			},
			onBlur: () => b(void 0, !1),
			onKeyDown: (e) => {
				e.nativeEvent.isComposing || e.keyCode === 229 || (e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), y(!0)), e.key === "Enter" && (e.preventDefault(), b(_[u])), (e.key === "ArrowDown" || e.key === "ArrowUp") && _.length && (e.preventDefault(), e.stopPropagation(), d((t) => e.key === "ArrowDown" ? (t + 1) % _.length : (t <= 0 ? _.length : t) - 1)));
			}
		}), _.length > 0 && /* @__PURE__ */ (0, W.jsx)("div", {
			id: f,
			role: "listbox",
			className: "absolute left-0 top-full z-10 mt-1 min-w-full rounded-lg border border-[var(--st-line)] bg-[var(--st-card)] p-1 shadow-lg",
			children: _.map((e, t) => /* @__PURE__ */ (0, W.jsx)("button", {
				type: "button",
				role: "option",
				id: `${f}-${t}`,
				tabIndex: -1,
				"aria-selected": u === t,
				onMouseDown: (e) => e.preventDefault(),
				onClick: () => b(e),
				className: "block w-full truncate rounded-md px-2 py-1 text-left text-sm hover:bg-[var(--st-fill)] aria-selected:bg-[var(--st-fill)]",
				children: e
			}, Xt(e)))
		})] }) : /* @__PURE__ */ (0, W.jsx)(hx, {
			variant: "quiet",
			icon: Dc,
			tip: a("musicNotes.addTagLabel"),
			onClick: () => s(!0)
		})
	});
	return /* @__PURE__ */ (0, W.jsx)("div", {
		"data-music-notes": "tags",
		children: /* @__PURE__ */ (0, W.jsx)(wS, {
			axis: "horizontal",
			move: i,
			label: a("musicNotes.tags"),
			after: x,
			className: "relative flex flex-wrap items-center gap-1.5",
			children: h.map((e) => /* @__PURE__ */ (0, W.jsxs)("span", {
				role: "group",
				"aria-label": e,
				"data-sort-key": Xt(e),
				draggable: !0,
				className: `${TS} st-focus-inside group relative max-w-full bg-[var(--st-fill)] px-4`,
				children: [/* @__PURE__ */ (0, W.jsx)("span", {
					className: "truncate",
					children: e
				}), /* @__PURE__ */ (0, W.jsx)("button", {
					type: "button",
					"data-sort-fixed": "",
					"aria-label": a("musicNotes.removeTag", { tag: e }),
					className: "music-notes-hover absolute right-0 top-0 inline-flex size-4 items-center justify-center rounded-md text-[color:var(--st-t2)] hover:text-[color:var(--st-t1)]",
					onClick: () => n((t) => t.filter((t) => Xt(t) !== Xt(e))),
					children: /* @__PURE__ */ (0, W.jsx)(zc, {
						size: 12,
						"aria-hidden": !0
					})
				})]
			}, Xt(e)))
		})
	});
}
// src/ui/NoteCover.tsx
function DS({ song: e, port: t, large: n = !1 }) {
	let { t: r } = Ht(), i = (0, j.useRef)(null), [a, o] = (0, j.useState)(null), { id: s, source: c } = e, l = (0, j.useRef)(e);
	l.current = e, (0, j.useEffect)(() => {
		let e = !0;
		o(null);
		let n = () => {
			t.cover(l.current).then((t) => {
				e && o(t);
			}, () => void 0);
		}, r;
		return i.current && typeof IntersectionObserver < "u" ? (r = new IntersectionObserver((e) => {
			e.some((e) => e.isIntersecting) && (r?.disconnect(), n());
		}), r.observe(i.current)) : n(), () => {
			e = !1, r?.disconnect();
		};
	}, [
		t,
		c,
		s
	]);
	let u = c.replace(/^online:/u, ""), d = c === "local" ? r("musicNotes.sourceLocal") : u === "qq" ? r("musicNotes.sourceQq") : u === "netease" ? r("musicNotes.sourceNetease") : u, f = u === "local" ? r("musicNotes.localBadge") : u === "netease" ? r("musicNotes.neteaseBadge") : u === "qq" ? "QQ" : u;
	return /* @__PURE__ */ (0, W.jsxs)("span", {
		ref: i,
		className: `relative shrink-0 ${n ? "size-16" : "size-10"}`,
		children: [/* @__PURE__ */ (0, W.jsx)("span", {
			className: "grid size-full place-items-center overflow-hidden rounded-lg bg-[var(--st-fill2)] text-[color:var(--st-t3)]",
			children: a ? /* @__PURE__ */ (0, W.jsx)("img", {
				src: a,
				alt: "",
				draggable: n ? void 0 : !1,
				loading: "lazy",
				decoding: "async",
				className: "size-full object-cover",
				onError: () => o(null)
			}) : /* @__PURE__ */ (0, W.jsx)(yc, {
				size: n ? 24 : 16,
				"aria-hidden": !0
			})
		}), /* @__PURE__ */ (0, W.jsx)("span", {
			title: d,
			"aria-label": d,
			className: "absolute bottom-0 right-0 max-w-full truncate rounded bg-[var(--st-card)] px-1 text-xs leading-none text-[color:var(--st-t2)]",
			children: f
		})]
	});
}
// src/ui/NoteMoments.tsx
var OS = (e) => `${Math.floor(e / 60).toString().padStart(2, "0")}:${String(Math.floor(e % 60)).padStart(2, "0")}`;
function kS({ port: e, onMark: t }) {
	let { t: n } = Ht(), r = (0, j.useId)(), [i, a] = (0, j.useState)(() => Math.floor(e.currentTime()));
	(0, j.useEffect)(() => {
		let t = window.setInterval(() => a(Math.floor(e.currentTime())), 1e3);
		return () => window.clearInterval(t);
	}, [e]);
	let o = n("musicNotes.markHere");
	return /* @__PURE__ */ (0, W.jsx)(ux, {
		text: o,
		className: "inline-flex shrink-0",
		children: /* @__PURE__ */ (0, W.jsxs)("button", {
			type: "button",
			"aria-label": o,
			"aria-describedby": r,
			onClick: t,
			className: "st-t-fast inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-yellow-400 px-2.5 text-xs text-zinc-950 hover:opacity-90 active:scale-[0.97]",
			children: [/* @__PURE__ */ (0, W.jsx)(Cc, {
				size: 14,
				"aria-hidden": "true"
			}), /* @__PURE__ */ (0, W.jsx)("span", {
				id: r,
				className: "tabular-nums",
				children: OS(i)
			})]
		})
	});
}
function AS({ notebook: e, port: t, song: n, notify: r, focusRequest: i, showHint: a }) {
	let { t: o } = Ht(), s = (0, j.useRef)(/* @__PURE__ */ new Map()), c = [...e.getDraft(n).bookmarks].sort((e, t) => e.positionSeconds - t.positionSeconds);
	(0, j.useLayoutEffect)(() => {
		if (!i) return;
		let e = s.current.get(i.id);
		e?.focus({ preventScroll: !0 }), e?.scrollIntoView?.({
			block: "nearest",
			inline: "nearest"
		});
	}, [i]);
	let l = async (e) => {
		try {
			if (await t.playAt(n, e)) return;
		} catch {}
		r(o("musicNotes.unavailable"));
	}, u = c.map((t) => /* @__PURE__ */ (0, W.jsxs)("div", {
		className: "group flex min-w-0 items-center gap-2 border-b border-[var(--st-line)] py-1",
		children: [
			/* @__PURE__ */ (0, W.jsx)("button", {
				type: "button",
				className: "rounded-md px-1 py-1 text-sm tabular-nums text-[color:var(--st-t2)] hover:bg-[var(--st-fill)]",
				onClick: () => {
					l(t.positionSeconds);
				},
				children: OS(t.positionSeconds)
			}),
			/* @__PURE__ */ (0, W.jsx)("input", {
				type: "text",
				value: t.text,
				ref: (e) => {
					e ? s.current.set(t.id, e) : s.current.delete(t.id);
				},
				maxLength: Wt.bookmarkText,
				placeholder: o("musicNotes.bookmarkPlaceholder"),
				"aria-label": `${OS(t.positionSeconds)} · ${o("musicNotes.bookmarkPlaceholder")}`,
				className: "min-w-0 flex-1 bg-transparent py-1 text-sm text-[color:var(--st-t1)] outline-none placeholder:text-[color:var(--st-t3)]",
				onChange: (r) => {
					let i = r.currentTarget.value;
					e.edit(n, (e) => ({
						...e,
						bookmarks: e.bookmarks.map((e) => e.id === t.id ? {
							...e,
							text: i
						} : e)
					}));
				},
				onKeyDown: (e) => {
					e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && e.currentTarget.blur();
				},
				onBlur: () => {
					e.flush(n).catch(() => void 0);
				}
			}),
			/* @__PURE__ */ (0, W.jsxs)("div", {
				className: "music-notes-hover flex shrink-0 gap-1",
				children: [/* @__PURE__ */ (0, W.jsx)(hx, {
					variant: "quiet",
					icon: Tc,
					tip: o("musicNotes.play"),
					onClick: () => {
						l(t.positionSeconds);
					}
				}), /* @__PURE__ */ (0, W.jsx)(hx, {
					variant: "quiet",
					icon: Fc,
					tip: o("musicNotes.removeBookmark"),
					onClick: () => e.edit(n, (e) => ({
						...e,
						bookmarks: e.bookmarks.filter((e) => e.id !== t.id)
					}), !0)
				})]
			})
		]
	}, t.id));
	return /* @__PURE__ */ (0, W.jsxs)("section", {
		"data-music-notes": "bookmarks",
		className: "space-y-2 border-t border-[var(--st-line)] pt-4",
		children: [/* @__PURE__ */ (0, W.jsxs)("h3", {
			className: "flex items-center gap-2 text-sm font-medium",
			children: [
				o("musicNotes.bookmarks"),
				" ",
				/* @__PURE__ */ (0, W.jsx)("span", {
					className: "font-normal tabular-nums text-[color:var(--st-t3)]",
					children: c.length
				})
			]
		}), u.length ? /* @__PURE__ */ (0, W.jsx)("div", { children: u }) : a && /* @__PURE__ */ (0, W.jsx)("p", {
			className: "text-sm text-[color:var(--st-t2)]",
			children: o("musicNotes.markHint")
		})]
	});
}
// src/ui/MusicNoteEditor.tsx
function jS({ notebook: e, port: t, song: n, playbackState: r, notify: i, tags: a, first: o, revision: s, bodyRef: c, onImport: l }) {
	let { t: u } = Ht(), d = e.getDraft(n), [f, p] = (0, j.useState)(null), m = () => {
		let e = t.currentSong();
		return e !== null && M(e) === M(n);
	}, h = async () => {
		try {
			if (r === "playing") {
				t.pause(n);
				return;
			}
			if (r === "paused" && (!m() || t.playbackState() !== "paused") || await t.play(n)) return;
		} catch {}
		i(u("musicNotes.unavailable"));
	}, g = () => {
		if (m() && t.playbackState() !== "stopped") try {
			p({ id: e.mark(n, t.currentTime()) });
		} catch (e) {
			i(u(e instanceof qt ? "musicNotes.capacity" : "musicNotes.failed"));
		}
	}, _ = () => {
		let e = c.current;
		e && (e.style.height = "auto", e.style.height = `${e.scrollHeight}px`);
	};
	return (0, j.useLayoutEffect)(_, [
		d.note,
		c,
		o
	]), (0, j.useEffect)(() => {
		let e = c.current;
		if (!e?.parentElement || typeof ResizeObserver > "u") return;
		let t = e.clientWidth, n = new ResizeObserver(() => {
			e.clientWidth !== t && (t = e.clientWidth, _());
		});
		return n.observe(e.parentElement), () => n.disconnect();
	}, [c]), /* @__PURE__ */ (0, W.jsxs)("div", {
		"data-music-notes": "editor",
		className: `music-notes-editor flex w-full flex-col gap-4 ${o ? Lx + " p-4 md:p-6 [&.st-card]:overflow-visible" : ""}`,
		children: [
			o && /* @__PURE__ */ (0, W.jsx)("h2", {
				className: "text-xl font-semibold",
				children: u("musicNotes.firstNote")
			}),
			/* @__PURE__ */ (0, W.jsxs)("header", {
				className: "flex min-w-0 flex-wrap items-center gap-3",
				children: [
					/* @__PURE__ */ (0, W.jsx)(DS, {
						song: n,
						port: t,
						large: !0
					}),
					/* @__PURE__ */ (0, W.jsxs)("div", {
						className: "min-w-0 flex-1 basis-32 space-y-1",
						children: [/* @__PURE__ */ (0, W.jsx)("h2", {
							className: "break-words text-lg font-semibold",
							children: n.title
						}), /* @__PURE__ */ (0, W.jsx)("p", {
							className: "text-sm text-[color:var(--st-t2)]",
							children: [n.artist, n.album].filter(Boolean).join(" · ")
						})]
					}),
					/* @__PURE__ */ (0, W.jsxs)("div", {
						className: "ml-auto flex max-w-full flex-wrap items-center justify-end gap-3",
						children: [
							/* @__PURE__ */ (0, W.jsx)(hx, {
								variant: "primary",
								icon: r === "playing" ? Nc : Tc,
								onClick: () => {
									h();
								},
								children: u(r === "playing" ? "musicNotes.stop" : r === "paused" ? "musicNotes.resume" : "musicNotes.play")
							}),
							r !== "stopped" && /* @__PURE__ */ (0, W.jsx)(kS, {
								port: t,
								onMark: g
							}),
							s !== void 0 && !o && /* @__PURE__ */ (0, W.jsx)(yS, {
								notebook: e,
								song: n,
								revision: s,
								notify: i
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, W.jsx)(ES, {
				tags: d.tags,
				options: a,
				notify: i,
				moveTag: (...t) => e.move("tag", ...t).catch((e) => {
					console.warn("[MusicNotes] Could not reorder tags", e), i(u("musicNotes.failed"));
				}),
				change: (t) => e.edit(n, (e) => ({
					...e,
					tags: t(e.tags)
				}), !0)
			}),
			/* @__PURE__ */ (0, W.jsx)("div", {
				"data-music-notes": "note",
				children: /* @__PURE__ */ (0, W.jsx)("textarea", {
					ref: c,
					rows: 2,
					value: d.note,
					"aria-label": u("musicNotes.reason"),
					placeholder: u("musicNotes.reasonPlaceholder"),
					maxLength: Wt.note,
					className: "block min-h-12 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base font-normal text-[color:var(--st-t1)] outline-none placeholder:text-[color:var(--st-t3)]",
					onChange: (t) => {
						let r = t.currentTarget.value;
						e.edit(n, (e) => ({
							...e,
							note: r
						}));
					},
					onBlur: () => {
						e.flush(n).catch(() => void 0);
					}
				})
			}),
			o ? /* @__PURE__ */ (0, W.jsx)("div", { children: /* @__PURE__ */ (0, W.jsx)(hx, {
				onClick: l,
				children: u("musicNotes.importPlaylist")
			}) }) : /* @__PURE__ */ (0, W.jsx)(AS, {
				notebook: e,
				port: t,
				song: n,
				notify: i,
				focusRequest: f,
				showHint: r === "stopped"
			})
		]
	});
}
// src/kit/Popover.tsx
var MS = ":is(button, [href], input, select, textarea, [tabindex]):not([tabindex=\"-1\"], :disabled)", NS = ({ anchorRef: e, matchWidthRef: t, open: n, onClose: r, side: i = "under", align: a = "start", fill: o = !1, focusRef: s, className: c = "", children: l, ...u }) => {
	let d = (0, j.useRef)(null), f = (0, j.useRef)(r);
	f.current = r;
	let [p, m] = (0, j.useState)(null), [h, g] = (0, j.useState)(null), [_, v] = (0, j.useState)(n);
	if (n && !_ && v(!0), (0, j.useLayoutEffect)(() => {
		m(e.current?.closest(".st-window") ?? null);
	}, [e, n]), (0, j.useLayoutEffect)(() => {
		let r = e.current, s = d.current;
		if (!n || !p || !r || !s) return;
		let c = p.getBoundingClientRect(), l = t?.current?.getBoundingClientRect();
		s.style.width = l ? `${l.width}px` : "", g(cx(l ?? r.getBoundingClientRect(), {
			width: s.offsetWidth,
			height: s.scrollHeight
		}, {
			left: c.left + p.clientLeft,
			top: c.top + p.clientTop,
			width: p.clientWidth,
			height: p.clientHeight,
			scrollLeft: p.scrollLeft,
			scrollTop: p.scrollTop
		}, {
			side: i,
			align: a,
			fill: o
		}));
		let u = () => f.current(), m = (e) => {
			let t = e.composedPath()[0];
			!s.contains(t) && !r.contains(t) && u();
		}, h = !0, _ = (e) => !s.contains(e) && !r.contains(e), v = (e) => {
			let t = e.relatedTarget;
			t ? _(t) && u() : queueMicrotask(() => {
				h && _(s.getRootNode().activeElement) && u();
			});
		}, y = (e) => {
			e.target instanceof Node && e.target.contains(r) && u();
		};
		return document.addEventListener("pointerdown", m, !0), s.addEventListener("focusout", v), r.addEventListener("focusout", v), window.addEventListener("scroll", y, !0), window.addEventListener("resize", u), () => {
			h = !1, document.removeEventListener("pointerdown", m, !0), s.removeEventListener("focusout", v), r.removeEventListener("focusout", v), window.removeEventListener("scroll", y, !0), window.removeEventListener("resize", u), s.contains(s.getRootNode().activeElement) && r.focus({ preventScroll: !0 });
		};
	}, [
		n,
		p,
		e,
		t,
		i,
		a,
		o
	]), (0, j.useLayoutEffect)(() => {
		let e = d.current;
		n && h && e && ((s?.current?.matches(":disabled") ? null : s?.current) ?? e.querySelector(MS) ?? e).focus({ preventScroll: !0 });
	}, [
		n,
		h,
		s
	]), !p || !_) return null;
	let y = h?.side ?? i, b = o || a === "center" ? "center" : a === "end" ? "right" : "left", x = h ? {
		left: h.left,
		right: h.right,
		top: h.top,
		bottom: h.bottom,
		maxHeight: h.maxHeight
	} : o ? {
		left: 8,
		right: 8,
		top: 0
	} : {
		left: 0,
		top: 0
	};
	return (0, $x.createPortal)(/* @__PURE__ */ (0, W.jsx)("div", {
		ref: d,
		...u,
		tabIndex: -1,
		inert: !n,
		"data-leaving": n ? void 0 : "",
		onKeyDown: (e) => {
			e.key === "Escape" && !e.nativeEvent.isComposing && (e.preventDefault(), e.stopPropagation(), r());
		},
		onAnimationEnd: (e) => {
			!n && e.target === e.currentTarget && (v(!1), g(null));
		},
		style: {
			...x,
			transformOrigin: `${b} ${y === "over" ? "bottom" : "top"}`,
			"--st-pop-shift": y === "over" ? "4px" : "-4px",
			outline: "none"
		},
		className: `st-pop st-scroll absolute z-30 flex flex-col overflow-y-auto overscroll-contain rounded-[10px] bg-[var(--st-menu)] text-[color:var(--st-t1)] shadow-xl ring-1 ring-[var(--st-line2)] ${o ? "" : "w-max max-w-[calc(100%-16px)] "}${c}`,
		children: l
	}), p);
};
// src/ui/NoteList.tsx
function PS({ tags: e, active: t, onChange: n, move: r }) {
	let { t: i } = Ht(), [a, o] = (0, j.useState)(!1), [s, c] = (0, j.useState)(0), [l, u] = (0, j.useState)(16), d = (0, j.useRef)(null), f = (0, j.useRef)(null), p = (0, j.useRef)(null), m = (0, j.useRef)(null), h = (0, j.useId)(), g = i("musicNotes.all"), _ = i("musicNotes.viewAll"), v = e.findIndex((e) => Xt(e) === t), y = e[v];
	(0, j.useLayoutEffect)(() => {
		let t = () => {
			if (!d.current || !f.current) return;
			let [t, n, r, ...i] = [...f.current.children].map((e) => e.getBoundingClientRect().width), a = parseFloat(getComputedStyle(f.current).columnGap) || 0, s = d.current.clientWidth - t;
			if (i.reduce((e, t) => e + a + t, 0) <= s) {
				i.length < e.length ? u((e) => e * 2) : (c(e.length), o(!1));
				return;
			}
			let l = (e) => {
				let t = s - a - e, n = i.findIndex((e) => (t -= a + e, t < 0));
				return n === -1 ? i.length : n;
			}, p = l(n), m = v >= p ? Math.min(p, l(r)) : p;
			c(m);
		};
		if (t(), typeof ResizeObserver > "u" || !d.current || !f.current) return;
		let n = new ResizeObserver(t);
		return n.observe(d.current), n.observe(f.current), () => n.disconnect();
	}, [
		e,
		g,
		_,
		v,
		l
	]);
	let b = e.slice(0, s), x = s < e.length, S = v >= s, C = `${TS} px-2 text-[color:var(--st-t2)] aria-pressed:bg-[var(--st-fill)] aria-pressed:text-[color:var(--st-t1)]`, w = (e, r) => {
		let i = Xt(e);
		return /* @__PURE__ */ (0, W.jsx)("button", {
			type: "button",
			ref: r && i === t ? m : void 0,
			"data-sort-key": i,
			draggable: !0,
			"aria-pressed": t === i,
			className: `${C} max-w-full`,
			onClick: () => {
				n(i), o(!1);
			},
			children: /* @__PURE__ */ (0, W.jsx)("span", {
				className: "truncate",
				children: e
			})
		}, i);
	};
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		ref: d,
		className: "relative min-w-0",
		children: [
			/* @__PURE__ */ (0, W.jsx)("div", {
				"aria-hidden": !0,
				className: "pointer-events-none invisible absolute inset-0 overflow-hidden",
				children: /* @__PURE__ */ (0, W.jsx)("div", {
					ref: f,
					className: "flex w-max gap-1.5",
					children: [
						g,
						_,
						y ?? _,
						...e.slice(0, l)
					].map((e, t) => /* @__PURE__ */ (0, W.jsx)("span", {
						className: C,
						children: e
					}, t))
				})
			}),
			/* @__PURE__ */ (0, W.jsx)(wS, {
				axis: "horizontal",
				move: r,
				label: i("musicNotes.filterTag"),
				className: "relative flex min-w-0 items-center gap-1.5",
				before: /* @__PURE__ */ (0, W.jsx)("button", {
					type: "button",
					className: C,
					"aria-pressed": !t,
					onClick: () => n(""),
					children: g
				}),
				after: x && /* @__PURE__ */ (0, W.jsx)("span", {
					className: "inline-flex min-w-0",
					children: /* @__PURE__ */ (0, W.jsx)("button", {
						type: "button",
						ref: p,
						className: `${C} max-w-full`,
						"aria-pressed": S,
						"aria-haspopup": "dialog",
						"aria-expanded": a,
						"aria-controls": a ? h : void 0,
						onClick: () => o((e) => !e),
						children: /* @__PURE__ */ (0, W.jsx)("span", {
							className: "truncate",
							children: S ? y : _
						})
					})
				}),
				children: b.map((e) => w(e, !1))
			}),
			a && x && /* @__PURE__ */ (0, W.jsx)(NS, {
				open: !0,
				id: h,
				role: "dialog",
				"aria-label": i("musicNotes.filterTag"),
				anchorRef: p,
				matchWidthRef: d,
				focusRef: m,
				onClose: () => o(!1),
				children: /* @__PURE__ */ (0, W.jsx)("div", {
					className: "st-scroll relative min-h-0 max-h-52 overflow-y-auto overscroll-contain p-2",
					onFocus: (e) => xS(e.target),
					onKeyDown: (e) => {
						if (e.altKey || e.ctrlKey || e.metaKey) return;
						if (e.key === "Tab") {
							o(!1);
							return;
						}
						let t = [...e.currentTarget.querySelectorAll("button:not([inert] *)")], n = t.indexOf(e.target), r;
						if (e.key === "Home") r = 0;
						else if (e.key === "End") r = t.length - 1;
						else if (e.key === "ArrowDown" || e.key === "ArrowRight") r = (n + 1) % t.length;
						else if (e.key === "ArrowUp" || e.key === "ArrowLeft") r = (n + t.length - 1) % t.length;
						else return;
						e.preventDefault(), e.stopPropagation(), t[r]?.focus({ preventScroll: !0 });
					},
					children: /* @__PURE__ */ (0, W.jsx)(wS, {
						axis: "horizontal",
						move: r,
						className: "relative flex flex-wrap items-center gap-1.5",
						children: e.map((e) => w(e, !0))
					})
				})
			})
		]
	});
}
function FS(e) {
	let t = e.note.trim().split(/\r?\n/u, 1)[0], n = e.bookmarks.at(-1)?.text.trim();
	return t || n || e.tags.join(" · ");
}
function IS({ notes: e, tags: t, port: n, current: r, paused: i, selection: a, select: o, notebook: s, notify: c }) {
	let { t: l } = Ht(), [u, d] = (0, j.useState)(""), [f, p] = (0, j.useState)(""), [m, h] = (0, j.useState)(""), [g, _] = (0, j.useState)(50), [v, y] = (0, j.useState)(null), [b, x] = (0, j.useState)(null), [S, C] = (0, j.useState)(!1), w = (0, j.useRef)(null), T = (0, j.useRef)(null), E = (0, j.useMemo)(() => v ? e.filter((e) => v.has(e.key)) : [], [v, e]), D = () => {
		y(null), requestAnimationFrame(() => w.current?.focus({ preventScroll: !0 }));
	}, ee = async () => {
		if (b && !S) {
			C(!0);
			try {
				await s.removeMany(b), D();
			} catch (e) {
				console.warn("[MusicNotes] batch delete failed", e), c(l(e instanceof Kt ? "musicNotes.deleteConflict" : "musicNotes.failed"));
			} finally {
				x(null), C(!1);
			}
		}
	}, te = t.find((e) => Xt(e) === m);
	(0, j.useEffect)(() => {
		let e = setTimeout(() => {
			p(u), _(50);
		}, 180);
		return () => clearTimeout(e);
	}, [u]);
	let ne = (0, j.useMemo)(() => !f.trim() && !te ? e : Qt(e, f, te), [
		e,
		f,
		te
	]), re = v !== null && ne.length > 0 && ne.every((e) => v.has(e.key)), ie = () => {
		if (!v) return;
		let e = new Set(v);
		for (let t of ne) re ? e.delete(t.key) : e.add(t.key);
		y(e);
	}, ae = r && M(r), oe = ae ? e.find((e) => e.key === ae) : void 0, O = ne.slice(0, g), se = (e) => {
		h(e), _(50);
	}, ce = (e, t, n, r) => s.move(e, t, n, r).catch((e) => {
		console.warn("[MusicNotes] Could not reorder the notebook", e), c(l("musicNotes.failed"));
	}), le = (e, t, r = !1) => {
		let i = M(e), s = v?.has(i) ? jc : Nc;
		return /* @__PURE__ */ (0, W.jsxs)("button", {
			type: "button",
			"data-song-key": i,
			role: v ? "checkbox" : void 0,
			"data-sort-key": r ? i : void 0,
			draggable: r,
			"aria-checked": v?.has(i),
			"aria-pressed": v ? void 0 : i === a,
			className: "group st-focus-inside flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--st-fill)] aria-pressed:bg-[var(--st-fill2)] aria-checked:bg-[var(--st-fill2)]",
			onClick: () => {
				v ? y((e) => {
					if (!e) return e;
					let t = new Set(e);
					return t.has(i) ? t.delete(i) : t.add(i), t;
				}) : o(e, !t, !0);
			},
			children: [
				v && /* @__PURE__ */ (0, W.jsx)(s, {
					"aria-hidden": !0,
					size: 16,
					className: "shrink-0 text-[color:var(--st-t2)]"
				}),
				/* @__PURE__ */ (0, W.jsx)(DS, {
					song: e,
					port: n
				}),
				/* @__PURE__ */ (0, W.jsxs)("span", {
					className: "flex min-w-0 flex-1 flex-col",
					children: [/* @__PURE__ */ (0, W.jsx)("span", {
						className: "truncate text-sm text-[color:var(--st-t1)]",
						children: [e.title, e.artist].filter(Boolean).join(" · ")
					}), /* @__PURE__ */ (0, W.jsx)("span", {
						className: "truncate text-xs text-[color:var(--st-t2)]",
						children: t ? FS(t) || l("musicNotes.noContent") : l("musicNotes.writeNote")
					})]
				}),
				!!t?.bookmarks.length && /* @__PURE__ */ (0, W.jsx)("span", {
					className: `text-xs tabular-nums text-[color:var(--st-t3)] ${i === a ? "" : "music-notes-hover"}`,
					children: l("musicNotes.momentCount", { count: t.bookmarks.length })
				})
			]
		}, i);
	};
	return /* @__PURE__ */ (0, W.jsxs)("aside", {
		className: "music-notes-list flex flex-col gap-4 p-4",
		"aria-label": l("musicNotes.allNotes"),
		children: [
			/* @__PURE__ */ (0, W.jsxs)("div", {
				className: "shrink-0 space-y-2",
				children: [/* @__PURE__ */ (0, W.jsxs)("label", {
					className: "block [&_input]:w-full",
					children: [/* @__PURE__ */ (0, W.jsx)("span", {
						className: "sr-only",
						children: l("musicNotes.searchHint")
					}), /* @__PURE__ */ (0, W.jsx)(vx, {
						value: u,
						onChange: d,
						placeholder: l("musicNotes.searchHint")
					})]
				}), /* @__PURE__ */ (0, W.jsx)(PS, {
					tags: t,
					active: te ? m : "",
					onChange: se,
					move: (...e) => ce("tag", ...e)
				})]
			}),
			/* @__PURE__ */ (0, W.jsxs)("div", {
				ref: T,
				className: "st-scroll min-h-0 space-y-4 overflow-y-auto overscroll-contain",
				onKeyDown: (e) => {
					if (e.altKey || e.ctrlKey || e.metaKey || e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
					let t = [...e.currentTarget.querySelectorAll("button[data-song-key]:not([inert] *)")], n = t.indexOf(e.target);
					if (n === -1) return;
					e.preventDefault(), e.stopPropagation();
					let i = t[Math.max(0, Math.min(t.length - 1, n + (e.key === "ArrowDown" ? 1 : -1)))], a = i.dataset.songKey, s = a === ae ? r : O.find((e) => e.key === a)?.song;
					!v && s && o(s, !1, !1), i.focus();
				},
				children: [!v && r && /* @__PURE__ */ (0, W.jsxs)("section", { children: [/* @__PURE__ */ (0, W.jsx)("h3", {
					className: "mb-2 px-2 text-xs font-medium text-[color:var(--st-t2)]",
					children: l(i ? "musicNotes.paused" : "musicNotes.nowPlaying")
				}), le(r, oe)] }), /* @__PURE__ */ (0, W.jsxs)("section", { children: [
					/* @__PURE__ */ (0, W.jsxs)("div", {
						className: `mb-2 flex flex-wrap items-center justify-between gap-1 px-2 ${v ? "sticky top-0 z-10 bg-[var(--st-win)]" : ""}`,
						children: [/* @__PURE__ */ (0, W.jsx)("h3", {
							className: "text-xs font-medium text-[color:var(--st-t2)]",
							children: l("musicNotes.allNotes")
						}), v ? /* @__PURE__ */ (0, W.jsxs)("div", {
							className: "ml-auto flex max-w-full flex-wrap items-center justify-end gap-1",
							children: [
								/* @__PURE__ */ (0, W.jsx)(hx, {
									variant: "quiet",
									disabled: !ne.length || u.trim() !== f.trim(),
									onClick: ie,
									children: l(re ? "musicNotes.deselectAll" : "musicNotes.selectAll")
								}),
								/* @__PURE__ */ (0, W.jsx)(hx, {
									variant: "quiet",
									"data-cancel-note-selection": "",
									onClick: D,
									children: l("musicNotes.cancel")
								}),
								/* @__PURE__ */ (0, W.jsx)(hx, {
									variant: "quiet",
									icon: Fc,
									disabled: !E.length,
									onClick: () => x(E),
									children: l("musicNotes.deleteSelected", { count: E.length })
								})
							]
						}) : /* @__PURE__ */ (0, W.jsx)(hx, {
							buttonRef: w,
							variant: "quiet",
							onClick: () => {
								y(/* @__PURE__ */ new Set()), requestAnimationFrame(() => {
									(T.current?.querySelector("[role=\"checkbox\"]") ?? T.current?.querySelector("[data-cancel-note-selection]"))?.focus({ preventScroll: !0 });
								});
							},
							children: l("musicNotes.bulkDelete")
						})]
					}),
					/* @__PURE__ */ (0, W.jsx)(wS, {
						axis: "vertical",
						move: (...e) => ce("note", ...e),
						className: "relative min-w-0",
						children: O.map((e) => le(e.song, e, !v))
					}),
					ne.length > g && /* @__PURE__ */ (0, W.jsx)(hx, {
						variant: "quiet",
						onClick: () => _((e) => e + 50),
						children: l("musicNotes.showMore")
					}),
					!ne.length && (f.trim() || te) && /* @__PURE__ */ (0, W.jsxs)("div", {
						className: "flex items-center gap-2 px-2 py-2 text-sm text-[color:var(--st-t2)]",
						children: [
							l("musicNotes.noMatches"),
							" ",
							/* @__PURE__ */ (0, W.jsx)(hx, {
								variant: "quiet",
								onClick: () => {
									d(""), p(""), se("");
								},
								children: l("musicNotes.clearSearch")
							})
						]
					})
				] })]
			}),
			/* @__PURE__ */ (0, W.jsx)(_S, {
				open: b !== null,
				title: l("musicNotes.bulkDelete"),
				busy: S,
				onClose: () => x(null),
				footer: /* @__PURE__ */ (0, W.jsxs)(W.Fragment, { children: [/* @__PURE__ */ (0, W.jsx)(hS, {
					"data-autofocus": !0,
					disabled: S,
					onClick: () => x(null),
					children: l("musicNotes.cancel")
				}), /* @__PURE__ */ (0, W.jsx)(hS, {
					variant: "danger",
					disabled: S,
					onClick: () => {
						ee();
					},
					children: l("musicNotes.confirmRemove")
				})] }),
				children: /* @__PURE__ */ (0, W.jsx)("p", {
					className: "text-sm",
					children: /* @__PURE__ */ (0, W.jsx)(Lt, {
						i18nKey: "musicNotes.confirmBulkDelete",
						count: b?.length ?? 0,
						components: { strong: /* @__PURE__ */ (0, W.jsx)("strong", { className: "font-bold" }) }
					})
				})
			})
		]
	});
}
// src/ui/useMusicNotesLibrary.ts
var LS = (e) => (0, j.useSyncExternalStore)(e.subscribe, e.getSnapshot);
// src/ui/MusicNotesWindow.tsx
function RS({ notebook: e, song: t, revision: n }) {
	let { t: r } = Ht(), i = e.status(t), a = (0, j.useRef)(n), [o, s] = (0, j.useState)(!1);
	return (0, j.useEffect)(() => {
		if (a.current === n || (a.current = n, s(n > 0), !n)) return;
		let e = window.setTimeout(() => s(!1), 6e4);
		return () => window.clearTimeout(e);
	}, [n]), /* @__PURE__ */ (0, W.jsx)("div", {
		role: "status",
		className: "text-xs text-[color:var(--st-t2)]",
		children: i === "error" ? /* @__PURE__ */ (0, W.jsx)(hx, {
			variant: "quiet",
			onClick: () => {
				e.retry(t).catch(() => void 0);
			},
			children: r("musicNotes.saveRetry")
		}) : i === "saving" ? r("musicNotes.saving") : i === "saved" && o ? r("musicNotes.saved") : null
	});
}
function zS({ notebook: e, port: t, playbackSelection: n, locale: r, theme: i, notify: a }) {
	let { t: o } = Ht(), { notes: s, tagOrder: c, ready: l, error: u } = LS(e), [, d] = (0, j.useState)(0);
	(0, j.useEffect)(() => t.subscribe(() => d((e) => e + 1)), [t]);
	let f = t.currentSong(), p = f && M(f), m = t.playbackState(), h = m === "playing" ? f : null;
	(0, j.useLayoutEffect)(() => {
		m !== "paused" && (n.key = m === "playing" ? p : null);
	}, [
		m,
		p,
		n
	]);
	let [g, _] = (0, j.useState)(null), [v, y] = (0, j.useState)(!1), [b, x] = (0, j.useState)(0), [S, C] = (0, j.useState)(0), w = (0, j.useRef)(null), T = (0, j.useRef)(!1), E = (0, j.useRef)(null), D = (0, j.useRef)(null), ee = (0, j.useRef)(!1), te = (0, j.useRef)(!1), ne = (0, j.useMemo)(() => new Map(s.map((e) => [e.key, e])), [s]), re = g && M(g), ie = re ? ne.get(re)?.song ?? (re === p ? f : null) : null, ae = m === "paused" && n.key === p ? f : null, oe = (0, j.useMemo)(() => s.reduce((e, t) => !e || t.updatedAt > e.updatedAt || t.updatedAt === e.updatedAt && t.key.localeCompare(e.key) < 0 ? t : e, void 0), [s]), O = ie ?? h ?? ae ?? oe?.song ?? null, se = h ?? (p && !ne.has(p) ? ae : null), ce = O && M(O), le = ce ? ne.get(ce)?.revision : void 0, ue = (0, j.useRef)(null), de = (0, j.useRef)(!1), fe = (0, j.useRef)(O);
	fe.current = O, (0, j.useEffect)(() => {
		let t = fe.current;
		return () => {
			t && e.flush(t).catch(() => void 0);
		};
	}, [ce, e]);
	let pe = (0, j.useMemo)(() => {
		let e = /* @__PURE__ */ new Map();
		for (let t of s) for (let n of t.tags) {
			let t = Xt(n);
			e.has(t) || e.set(t, n);
		}
		let t = [];
		for (let n of c) {
			let r = e.get(n);
			r !== void 0 && (t.push(r), e.delete(n));
		}
		return [...t, ...e.values()];
	}, [s, c]), me = (0, j.useMemo)(() => s.reduce((e, t) => e + t.bookmarks.length, 0), [s]), he = (t, n, r) => {
		O && M(t) !== ce && e.flush(O).catch(() => void 0), _(t), r && (te.current = !v, y(!0)), n && (T.current = !0, C((e) => e + 1));
	};
	(0, j.useLayoutEffect)(() => {
		let e = E.current, t = ue.current;
		ue.current = ce && ne.has(ce) ? ce : null;
		let n = de.current && ne.size === 0;
		if (de.current = ne.size > 0, !e || !l) return;
		let r = e.querySelector(".music-notes-list"), i = e.getRootNode(), a = e.ownerDocument.activeElement;
		if ((!i.activeElement || i.activeElement === e.ownerDocument.body) && (!a || a === e.ownerDocument.body || i instanceof ShadowRoot && a === i.host) && (n || t && !ne.has(t) && D.current && !D.current.isConnected) && (r ? (ee.current = !0, v && y(!1)) : (w.current ?? e.querySelector(".music-notes-detail button"))?.focus()), !v && ee.current) ee.current = !1, (r?.querySelector("button[data-song-key][aria-pressed=\"true\"]") ?? r?.querySelector("input"))?.focus();
		else if (T.current && w.current) w.current.focus(), T.current = !1;
		else if (v && te.current) {
			let t = e.querySelector(".music-notes-back button");
			t?.getClientRects().length && t.focus();
		}
		te.current = !1;
	}, [
		S,
		ce,
		l,
		v,
		ne
	]);
	let ge = qc(), _e = {
		...ax(i.isDaylight, i),
		...Kc(ge),
		"--text-primary": i.primaryColor
	}, ve = !s.length, ye = () => x((e) => e + 1);
	return /* @__PURE__ */ (0, W.jsx)(ox.Provider, {
		value: {
			isDaylight: i.isDaylight,
			theme: i
		},
		children: /* @__PURE__ */ (0, W.jsxs)("div", {
			ref: E,
			className: "st-window music-notes-page relative flex size-full min-h-0 flex-col overflow-hidden bg-[var(--st-win)] text-[color:var(--st-t1)]",
			lang: r,
			style: _e,
			children: [/* @__PURE__ */ (0, W.jsxs)("header", {
				className: "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--st-line)] px-4 py-3 md:px-8",
				children: [/* @__PURE__ */ (0, W.jsxs)("div", {
					className: "flex flex-wrap items-center gap-x-3",
					children: [/* @__PURE__ */ (0, W.jsx)("h1", {
						className: "text-xl font-semibold",
						children: o("musicNotes.title")
					}), l && O && /* @__PURE__ */ (0, W.jsx)(RS, {
						notebook: e,
						song: O,
						revision: le ?? 0
					}, ce)]
				}), /* @__PURE__ */ (0, W.jsxs)("div", {
					className: "ml-auto flex items-center gap-2",
					children: [/* @__PURE__ */ (0, W.jsx)("span", {
						className: "text-right text-xs tabular-nums text-[color:var(--st-t2)]",
						children: l && o("musicNotes.stats", {
							songs: s.length,
							moments: me
						})
					}), /* @__PURE__ */ (0, W.jsx)(vS, {
						notebook: e,
						port: t,
						notify: a,
						importRequest: b
					})]
				})]
			}), l ? /* @__PURE__ */ (0, W.jsxs)("div", {
				className: "music-notes-layout min-h-0 flex-1",
				"data-first": ve || void 0,
				"data-detail": v || void 0,
				children: [!ve && /* @__PURE__ */ (0, W.jsx)(IS, {
					notes: s,
					tags: pe,
					port: t,
					select: he,
					notebook: e,
					notify: a,
					current: se,
					paused: m === "paused",
					selection: ce
				}), /* @__PURE__ */ (0, W.jsxs)("section", {
					className: "music-notes-detail st-scroll min-h-0 min-w-0 overflow-y-auto p-4 md:px-8",
					onFocusCapture: (e) => {
						D.current = e.target, ve && y(!0);
					},
					children: [!ve && /* @__PURE__ */ (0, W.jsx)("div", {
						className: "music-notes-back mb-3",
						children: /* @__PURE__ */ (0, W.jsx)(hx, {
							variant: "quiet",
							icon: hc,
							onClick: () => {
								O && e.flush(O).catch(() => void 0), ee.current = !0, y(!1);
							},
							children: o("musicNotes.back")
						})
					}), O ? /* @__PURE__ */ (0, W.jsx)(jS, {
						notebook: e,
						port: t,
						notify: a,
						tags: pe,
						first: ve,
						bodyRef: w,
						song: O,
						revision: le,
						playbackState: ce === p ? m : "stopped",
						onImport: ye
					}, ce) : /* @__PURE__ */ (0, W.jsxs)("div", {
						className: "space-y-4 text-center",
						children: [/* @__PURE__ */ (0, W.jsx)("p", {
							className: "text-sm text-[color:var(--st-t2)]",
							children: o("musicNotes.noCurrent")
						}), /* @__PURE__ */ (0, W.jsx)(hx, {
							onClick: ye,
							children: o("musicNotes.importPlaylist")
						})]
					})]
				}, "detail")]
			}) : /* @__PURE__ */ (0, W.jsx)("div", {
				className: "grid flex-1 place-items-center",
				children: u ? /* @__PURE__ */ (0, W.jsx)(zx, {
					tone: "error",
					children: o("musicNotes.failed")
				}) : /* @__PURE__ */ (0, W.jsxs)("span", {
					role: "status",
					className: "text-[color:var(--st-t2)]",
					children: [/* @__PURE__ */ (0, W.jsx)(Qx, { size: 20 }), /* @__PURE__ */ (0, W.jsx)("span", {
						className: "sr-only",
						children: o("musicNotes.loading")
					})]
				})
			})]
		})
	});
}
// src/client.tsx
function BS(e) {
	if (e.env.context !== "main") return;
	let t = new AbortController(), n = xn(e, t.signal), r = document.documentElement.lang || navigator.language, i = new Gs(Bs({ locale: r })), a = ze();
	a.init({
		resources: Vs,
		fallbackLng: "en",
		lng: r,
		initAsync: !1,
		interpolation: { escapeValue: !1 }
	});
	let o = new MutationObserver(() => {
		let e = document.documentElement.lang;
		e && e !== a.language && a.changeLanguage(e);
	});
	o.observe(document.documentElement, {
		attributes: !0,
		attributeFilter: ["lang"]
	});
	let s = (t) => e.ui.toast(t), c = () => {
		i.flush().catch((t) => e.log.warn("Could not save music notes", t));
	}, l = { key: null }, u = e.events.on("playback.songChanged", () => {
		if (c(), l.key) {
			let e = n.currentSong();
			e && M(e) === l.key || (l.key = null);
		}
	});
	window.addEventListener("pagehide", c);
	let d = Cx(e, n, i, a, s, t.signal), f = Zs(e), p = {
		id: "notebook",
		order: 300,
		label: {
			"zh-CN": "音乐笔记",
			"zh-TW": "音樂筆記",
			en: "Music notes",
			in: "Catatan lagu",
			vi: "Ghi chú bài hát"
		},
		mount(t, r) {
			let o = document.createElement("div");
			o.style.cssText = "width:100%;height:100%;min-height:0";
			let u = document.createElement("style");
			u.textContent = yx, t.append(u, o);
			let d = o.getRootNode(), f = (d instanceof ShadowRoot ? d.host.closest("[data-folium-home-page]") : null) ?? t, h = (t) => {
				if (!(t instanceof KeyboardEvent) || t.key !== "Escape" || t.defaultPrevented || t.isComposing || t.keyCode === 229 || t.repeat || t.ctrlKey || t.shiftKey || t.metaKey || t.altKey || o.querySelector("[data-folia-sheet=\"true\"]")) return;
				t.preventDefault(), t.stopPropagation();
				let n = o.querySelector("[data-cancel-note-selection]");
				n ? n.click() : (m.unregister(), m = e.registries.homeTabs.register(p));
			};
			f.addEventListener("keydown", h);
			let _ = (0, g.createRoot)(o);
			a.changeLanguage(r.locale);
			let v = () => _.render(/* @__PURE__ */ (0, W.jsx)(Ut, {
				i18n: a,
				children: /* @__PURE__ */ (0, W.jsx)(zS, {
					port: n,
					notebook: i,
					playbackSelection: l,
					locale: r.locale,
					theme: r.getTheme(),
					notify: s
				})
			}));
			v();
			let y = r.onChange(v);
			return () => {
				f.removeEventListener("keydown", h), y(), _.unmount(), c(), o.remove(), u.remove();
			};
		}
	}, m = e.registries.homeTabs.register(p), h = Fx(e, a, () => {
		e.ui.openHomeTab("notebook");
	}), _, v, y = () => {
		if (!i.getSnapshot().ready) return;
		window.clearTimeout(v);
		let t;
		try {
			t = n.isPlaying() && n.currentSong();
		} catch (t) {
			t instanceof Error && t.message === "playback-unavailable-in-main-context" ? v = window.setTimeout(y, 250) : e.log.warn("Could not read the current song", t);
		}
		t ? _ ||= e.registries.commands.register({
			id: "mark-moment",
			label: {
				"zh-CN": "记录时刻到笔记",
				"zh-TW": "記錄時刻到筆記",
				en: "Mark this moment in music notes",
				in: "Tandai momen ini di catatan musik",
				vi: "Đánh dấu khoảnh khắc vào ghi chú"
			},
			keywords: [
				"图钉",
				"时刻",
				"笔记",
				"bookmark"
			],
			async run() {
				let t = n.isPlaying() && n.currentSong();
				if (t) try {
					let e = n.currentTime(), r = i.mark(t, e), o = i.getDraft(t).bookmarks.find((e) => e.id === r)?.positionSeconds ?? e;
					await i.flush(t);
					let c = [Math.floor(o / 60), Math.floor(o % 60)].map((e) => String(e).padStart(2, "0")).join(":");
					s(a.t("musicNotes.momentRecorded", { time: c }));
				} catch (t) {
					e.log.warn("Could not mark this moment", t), s(a.t("musicNotes.failed"));
				}
			}
		}) : (_?.unregister(), _ = void 0);
	}, b = n.subscribe(y), x = i.subscribe(() => {
		i.getSnapshot().ready && (x(), y());
	});
	return y(), () => {
		t.abort(), o.disconnect(), window.removeEventListener("pagehide", c), u(), b(), x(), window.clearTimeout(v), _?.unregister(), h(), m.unregister(), d(), f(), i.dispose().catch((t) => e.log.warn("Could not close music notes", t));
	};
}
export { BS as default };
