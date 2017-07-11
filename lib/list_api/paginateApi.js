/**
 * Gets a special Query object that will paginate documents in the list
 *
 * Example:
 *     list.paginate({
 *         page: 1,
 *         perPage: 100,
 *         maxPages: 10
 *     }).exec(function(err, results) {
 *         // do something
 *     });
 *
 * @param {Object} options
 * @param {Function} callback (optional)
 */

var _ = require('lodash');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));

function paginate (options) {
	
	var list = this;
	list.pagination = { maxPages: maxPages };

	var currentPage = Number(options.page) || 1;
	var resultsPerPage = Number(options.perPage) || 50;
	var maxPages = Number(options.maxPages) || 10;
	var skip = (currentPage - 1) * resultsPerPage;
	var param = options.apiDetails.read.params;
	var model = {
		_url: options.apiDetails.read.endpoint,
		_method: options.apiDetails.read.method,
		_params: {},
		_urlParamsBuilder: function() {
			if (options.apiDetails.read.params) {
				if (param.searchByField) {

					var searchQuery = (_.size(options.filters['$or'])) ? options.filters['$or'][0] : {};
					_.forEach(searchQuery,function(value,key){
						model._params[key]=_.replace(value,/ /g,'%20');
					});
					
					var searchQueryRegex = (_.size(options.filters)) ? options.filters : {};
					_.forEach(searchQueryRegex,function(value,key){
						
						if (key!='$or'){
							if (value instanceof RegExp) {
								model._params[key]=_.replace(value.source,/ /g,'%20');
							}	
							else {
								if (value instanceof Object) {
									_.forEach(value,function(valObj,keyObj){
										if (keyObj=='$ne') {
											model._params[key]=_.replace(!valObj,/ /g,'%20');
										}
									});
								}
								else {
									model._params[key]=_.replace(value,/ /g,'%20');
								}
								
							}
						}
					});
				}
			}
		},
		exec: function(){
			this._urlParamsBuilder();
			
			var request = superagent.get(this._url);
			
			if (model._params) {
				
				var props = [];
				for (var key in model._params){
					props.push({
						key: key,
						value: model._params[key]
					});
				}
				props.map(options.apiDetails.read.params.prepareSearchField).forEach(function(param) {
					request = request.query(param);
				});
				
				if (param.limit) {
					request = request.query(param.limit + '=' + resultsPerPage);
				}
				
				if (param.offset) {
					request = request.query(param.offset + '=' + skip);
				}

			}
			
			return request.endAsync()
				.then(function (res) {
					var responseBody = {};
					responseBody.data = res.body;
					responseBody.raw = {
						params: model._params,
						url: model._url,
						method: model._method,
						operation: 'listing'
					};
					
					return Bluebird.props({
						total: Bluebird
							.resolve()
							.then(() => options.apiDetails.read.countResponseData(responseBody)),
						results: Bluebird
							.resolve()
							.then(() => _.forEach(options.apiDetails.read.getResponseData(responseBody), (item) =>  {
								item.id = item[options.apiDetails.read.primaryKey];
								item.get = function (colName) {
									return this[colName];
								};
							})),
						currentPage: Bluebird.resolve(currentPage),
						totalPages: Bluebird
							.resolve()
							.then(() => options.apiDetails.read.countResponseData(responseBody))
							.then(count => _.ceil(count / resultsPerPage)),
						pages: Bluebird.resolve([]),
						previous: Bluebird.resolve(currentPage !== 1),
						next: Bluebird.resolve(currentPage < this.totalPages ? currentPage + 1 : currentPage),
						first: Bluebird.resolve((currentPage - 1 ) * resultsPerPage + 1),
						last: Bluebird.resolve((currentPage - 1 ) * resultsPerPage + _.size(options.apiDetails.read.getResponseData(responseBody)))
					});
				})
				.then(function (item) {
					for(var i = 1; i <= item.totalPages; i++){
						item.pages.push(i);
					}

					return item;
				});
		}
	};
	return model;
}

module.exports = paginate;
