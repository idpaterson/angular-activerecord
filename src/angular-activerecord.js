angular.module('ActiveRecord', ['ng']).factory('ActiveRecord', function($http, $q) {
	'use strict';

	/**
	 * If the value of the named property is a function then invoke it; otherwise, return it.
	 * @ignore
	 */
	var _result = function (object, property) {
		 if (object == null) return null;
		var value = object[property];
		return angular.isFunction(value) ? value.call(object) : value;
	};

	/**
	 * @class ActiveRecord  ActiveRecord for AngularJS
	 * @constructor
	 * @param {Object} [properties]  Initialize the record with these property values.
	 * @param {Object} [options]
	 */
	var ActiveRecord = function ActiveRecord(properties, options) {
		this.$initialize.apply(this, arguments);
	};
	ActiveRecord.prototype = {

		/**
		 * @property {String} $idAttribute  The default name for the JSON id attribute is "id".
		 */
		$idAttribute: 'id',

		/**
		 * @property {String} $urlRoot  Used by $url to generate URLs based on the model id. "[urlRoot]/id"
		 */
		$urlRoot: null,

		/**
		 * Constructor logic
		 * (which is called by the autogenerated constructor via ActiveRecord.extend)
		 * @param {Object} [properties]  Initialize the record with these property values.
		 * @param {Object} [options]
		 */
		$initialize: function (properties, options) {
			options = options || {};
			var defaults = _result(this, '$defaults');
			if (defaults) {
				angular.extend(this, defaults);
			}
			if (properties) {
				if (options.parse) {
					properties = this.$parse(properties);
				}
				angular.extend(this, properties);
			}
			if (options.url) {
				this.$url = options.url;
			}
			if (options.urlRoot) {
				this.$urlRoot = options.urlRoot;
			}
		},

		/**
		 * (re)load data from the backend.
		 * @param {Object} [options] sync options
		 * @return $q.promise
		 */
		$fetch: function (options) {
			var model = this;
			var deferred = $q.defer();
			this.$sync('read', this, options).then(function (response) {
				var data = model.$parse(response.data, options);
				if (angular.isObject(data)) {
					angular.extend(model, data);
					deferred.resolve(model);
				} else {
					deferred.reject('Not a valid response type');
				}
			}, deferred.reject);
			return deferred.promise;
		},

		/**
		 * Save the record to the backend.
		 * @param {Object} [values] Set these values before saving the record.
		 * @param {Object} [options] sync options
		 * @return $q.promise
		 */
		$save: function (values, options) {
			if (values) {
				if (angular.isString(values)) {
					values = {};
					values[arguments[0]] = options;
					options = arguments[2]
				}
				angular.extend(this, values);
			}
			var operation = this.$isNew() ? 'create' : 'update';
			var model = this;
			return this.$sync(operation, this, options).then(function (response) {
				var data = model.$parse(response.data, options);
				if (angular.isObject(data)) {
					angular.extend(model, data);
				}
				return model;
			});
		},

		/**
		 * Destroy this model on the server if it was already persisted.
		 * @param {Object} [options] sync options
		 * @return $q.promise
		 */
		$destroy: function (options) {
			var defer = $.defer();
			if (this.$isNew()) {
				defer.resolve();
				return defer;
			}
			this.$sync('delete', this, options).then(function () {
				defer.resolve();
			}, defer.reject);
			return defer;
		},

		/**
		 * Generate the url for the $save, $fetch and $destroy methods.
		 */
		$url: function() {
			var urlRoot = _result(this, '$urlRoot');
			if (typeof this[this.$idAttribute] === 'undefined') {
				return urlRoot;
			}
			if (urlRoot === null) {
				throw 'Implement this.$url() or specify this.$urlRoot';
			}
			return urlRoot + (urlRoot.charAt(urlRoot.length - 1) === '/' ? '' : '/') + encodeURIComponent(this[this.$idAttribute]);
		},

		/**
		 * Process the data from the response and return the record-properties.
		 * @param {Object} data  The data from the sync response.
		 * @param {Object} [options] sync options
		 * @return $q.promise
		 */
		$parse: function (data, options) {
			return data;
		},

		/**
		 * A model is new if it lacks an id.
		 */
		$isNew: function () {
			return this[this.$idAttribute] == null;
		},

		/**
		 * By default calls ActiveRecord.sync
		 * Override to change the backend implementation on a per model bases.
		 */
		$sync: function (operation, model, options) {
			return ActiveRecord.sync.apply(this, arguments);
		}
	};

	/**
	 * Preform a CRUD operation on the backend.
	 *
	 * @static
	 * @return $q.promise
	 */
	ActiveRecord.sync = function (operation, model, options) {
		if (typeof options === 'undefined') {
			options = {};
		}
		if (!options.method) {
			var crudMapping = {
				create: 'POST',
				read: 'GET',
				update: 'PUT',
				"delete": 'DELETE'
			};
			options.method = crudMapping[operation];
		}
		if (!options.url) {
			options.url = _result(model, '$url');
		}
		if (operation === 'create' || operation === 'update') {
			options.data = model;
		}
		return $http(options);
	};

	/**
	 * Create a subclass.
	 * @static
	 * @return {Function} Constructor
	 */
	ActiveRecord.extend = function(protoProps, staticProps) {
		var parent = this;
		var child;

		if (protoProps && typeof protoProps.$constructor === 'function') {
			child = protoProps.$constructor;
		} else {
			child = function () { return parent.apply(this, arguments); };
		}
		angular.extend(child, parent, staticProps);
		var Surrogate = function () { this.$constructor = child; };
		Surrogate.prototype = parent.prototype;
		child.prototype = new Surrogate();
		if (protoProps) {
			angular.extend(child.prototype, protoProps);
		}
		child.__super__ = parent.prototype;
		return child;
	};

	/**
	 * Load a single record.
	 *
	 * @static
	 * @param {Mixed} id
	 * @param {Object} [options]
	 * @return $q.promise
	 */
	ActiveRecord.fetchOne = function (id, options) {
		var model = new this();
		model[model.$idAttribute] = id;
		return model.$fetch(options);
	};

	/**
	 * Load a collection of records.
	 *
	 * @static
	 * @param {Object} [options]
	 * @return $q.promise
	 */
	ActiveRecord.fetchAll = function (options) {
		var ModelType = this;
		var model = new ModelType();
		var deferred = $q.defer();
		model.$sync('read', model, options).then(function (response) {
			var data = model.$parse(response.data, options);
			if (angular.isArray(data)) {
				var models = [];
				angular.forEach(data, function (item) {
					models.push(new ModelType(item));
				});
				deferred.resolve(models);
			} else {
				deferred.reject('Not a valid response, expecting an array');
			}
		}, deferred.reject);
		return deferred.promise;
	};
	return ActiveRecord;
});